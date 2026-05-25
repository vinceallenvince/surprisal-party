"""Per-token surprisal scoring against a locally-loaded reference model.

`score(text)` returns the normalized source plus a list of :class:`Token`
objects (text + surprisal in bits), ready to feed directly into
:func:`cprediction.reconciliation.reconcile`.

How it works
------------
Tokenize the normalized source with the model's tokenizer (no chat
template — we want raw text tokenization, exactly the form the model saw
during pretraining for next-token prediction). One forward pass yields
``logits`` of shape ``[1, seq_len, vocab_size]``. The logits at position
``i`` are the model's prediction distribution for the token at position
``i+1``. Per-position surprisal in bits is then::

    surprisal[i+1] = -log_softmax(logits[i])[token_id[i+1]] / ln(2)

We use ``torch.nn.functional.log_softmax`` for numerical stability and
divide by ``math.log(2)`` to convert nats to bits.

The first token has no left context. We emit it with surprisal ``0.0`` so
the token stream still reconstructs the source exactly when concatenated,
and the conservation invariant downstream sums cleanly. (The alternative —
omitting it — would break the ``"".join(t.text for t in tokens) == source``
assertion that ``reconcile`` relies on.)

BOS handling
------------
Qwen2.5's tokenizer does not prepend a BOS token by default when called as
``tokenizer(text, add_special_tokens=False)`` and even with the default it
typically returns no BOS for plain text (its ``bos_token`` is ``None``).
We pass ``add_special_tokens=False`` defensively so the surprisal stream
aligns one-to-one with the source characters.
"""

from __future__ import annotations

import math
import sys

import torch
import torch.nn.functional as F

from cprediction._model import MODEL_ID, get_model, get_tokenizer
from cprediction.reconciliation import Token, normalize


def score(source_text: str) -> tuple[str, list[Token]]:
    """Score ``source_text`` and return ``(normalized_text, tokens)``.

    The returned tuple is shaped to plug directly into
    ``reconcile(*score(t))``. Tokens are emitted in order with text decoded
    from their token ids (so the concatenation exactly reproduces the
    normalized source) and ``surprisal`` in bits.

    Raises:
        RuntimeError: if the decoded token stream does not reproduce the
            normalized source. This indicates a tokenizer quirk we have
            not accounted for — surfacing it loudly is better than letting
            it slide into a broken pipeline.
    """

    normalized = normalize(source_text)
    tokenizer = get_tokenizer()
    model = get_model()

    encoding = tokenizer(
        normalized,
        add_special_tokens=False,
        return_tensors="pt",
    )
    input_ids = encoding["input_ids"].to(model.device)

    if input_ids.shape[1] == 0:
        return normalized, []

    # Context-window guard: the model can only attend to as many positions
    # as its rotary/positional embeddings cover. Overflowing silently leads
    # to garbage logits at the tail, so we refuse loudly. Longer corpora
    # will need a chunking strategy (sliding window with overlap) — out of
    # scope for Phase 0.
    max_ctx = getattr(model.config, "max_position_embeddings", None)
    if max_ctx is not None and input_ids.shape[1] > max_ctx:
        raise RuntimeError(
            f"Input length {input_ids.shape[1]} tokens exceeds the model's "
            f"context window of {max_ctx} tokens ({MODEL_ID}). "
            "Chunking (sliding-window scoring with overlap) will be needed "
            "for corpora this long."
        )

    print(
        f"[cprediction.score] forward pass: {input_ids.shape[1]:,} tokens",
        file=sys.stderr,
        flush=True,
    )

    with torch.no_grad():
        outputs = model(input_ids)
    logits = outputs.logits[0]  # [seq_len, vocab_size]

    # Surprisal for token at position i (i >= 1) is computed from the
    # log-softmax of logits at position i-1.
    log_probs = F.log_softmax(logits[:-1].float(), dim=-1)  # [seq_len-1, vocab]
    next_ids = input_ids[0, 1:]  # [seq_len-1]
    next_log_probs = log_probs.gather(-1, next_ids.unsqueeze(-1)).squeeze(-1)
    # Convert nats -> bits.
    surprisal_bits = (-next_log_probs / math.log(2.0)).tolist()

    token_id_list = input_ids[0].tolist()

    tokens: list[Token] = []
    decoded_parts: list[str] = []
    for idx, tok_id in enumerate(token_id_list):
        text = tokenizer.decode([tok_id])
        if idx == 0:
            # No left context for the first token; emit with 0.0 so it
            # still carries character coverage for reconciliation.
            s = 0.0
        else:
            # Clamp tiny negative float noise from log_softmax; mathematically
            # surprisal is always >= 0.
            s = max(0.0, float(surprisal_bits[idx - 1]))
        tokens.append(Token(text=text, surprisal=s))
        decoded_parts.append(text)

    decoded = "".join(decoded_parts)
    if decoded != normalized:
        # Diagnose the first divergence to make this debuggable.
        first_diff = _first_diff(normalized, decoded)
        raise RuntimeError(
            "Decoded token stream does not reproduce the normalized source. "
            f"Model: {MODEL_ID}. Expected {len(normalized)} chars, got "
            f"{len(decoded)}. First divergence at offset {first_diff}: "
            f"expected {normalized[first_diff:first_diff+20]!r}, got "
            f"{decoded[first_diff:first_diff+20]!r}."
        )

    return normalized, tokens


def _first_diff(a: str, b: str) -> int:
    for i, (x, y) in enumerate(zip(a, b)):
        if x != y:
            return i
    return min(len(a), len(b))
