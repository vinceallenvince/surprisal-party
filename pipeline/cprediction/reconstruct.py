"""Gap reconstruction against the locally-loaded reference model.

Given the surviving left/right context surrounding a removed span, ask the
model to fill the gap with plausible, source-faithful content. Returns
the reconstructed span as a plain string (no surrounding context, no
markup).

This module shares the model singleton with ``cprediction.score`` —
*one model, both directions* is bit-for-bit literal.
"""

from __future__ import annotations

import re

import torch

from cprediction._model import get_model, get_tokenizer


# Qwen3 models support a "thinking mode" that emits a <think>...</think>
# reasoning block before the actual response. We disable it via the
# tokenizer's ``enable_thinking=False`` flag (see the Qwen3-8B model card),
# but also strip any residual block defensively in case a future tokenizer
# revision ignores the flag.
_THINK_BLOCK_RE = re.compile(r"<think>.*?</think>\s*", re.DOTALL | re.IGNORECASE)


def _strip_think_blocks(text: str) -> str:
    """Remove any ``<think>...</think>`` reasoning traces from model output."""
    return _THINK_BLOCK_RE.sub("", text)


_SYSTEM_PROMPT = (
    "You are completing a missing passage of a classic fairy tale. The user "
    "will give you the text immediately before and after a gap. Write the "
    "words that fill the gap so the story reads as a single continuous "
    "piece in the same voice and register as the surrounding prose.\n\n"
    "Rules:\n"
    "- Output ONLY the replacement text for the gap. No preamble, no "
    "explanation, no quotation marks around your answer, no <<<GAP>>> "
    "marker, no surrounding context.\n"
    "- Match the spacing implied by the context. If the left side ends "
    "with a space, do not add a leading space; if the right side starts "
    "with a letter, include a trailing space only if grammar requires it.\n"
    "- Stay faithful to the canonical Grimm/Andersen version of the tale "
    "where possible.\n"
    "- Keep the length proportional to the gap's apparent role in the "
    "sentence."
)


def _gap_word_count(left: str, right: str) -> int:
    """A coarse estimate of how big the gap is, in words.

    We don't actually know the gap length from the caller's perspective —
    this is just a heuristic for ``max_new_tokens``. We assume the gap is
    roughly as long as the surrounding context's average sentence; the
    cap below is generous enough that this rarely matters.
    """
    return max(len(left.split()), len(right.split()), 16)


def reconstruct(
    left_context: str,
    right_context: str,
    expected_words: int | None = None,
) -> str:
    """Return the model's reconstruction of the gap between two contexts.

    Args:
        left_context: surviving text immediately before the gap.
        right_context: surviving text immediately after the gap.
        expected_words: if known, the actual word count of the removed span.
            When provided, controls ``max_new_tokens`` directly via a
            generous budget proportional to gap size, so long gaps don't
            get truncated to one-word predictions. When ``None`` (the
            default), falls back to the older context-based heuristic so
            direct callers without a known gap size still work.

    Returns:
        The reconstructed span as a plain string. May be empty if the
        model chooses to fill with nothing (a legitimate low-information
        answer for some gaps).
    """

    tokenizer = get_tokenizer()
    model = get_model()

    user_msg = f"LEFT: {left_context}\n<<<GAP>>>\nRIGHT: {right_context}"
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]
    chat_inputs = tokenizer.apply_chat_template(
        messages,
        add_generation_prompt=True,
        return_tensors="pt",
        return_dict=True,
        # Qwen3 introduced a "thinking mode" that wraps reasoning in
        # <think>...</think> before the actual reply. We want only the gap
        # fill, so we disable thinking at the chat-template level. Tokenizers
        # that don't recognize the flag silently ignore it, so this remains
        # a safe no-op on older Qwen2.5-family tokenizers.
        enable_thinking=False,
    )
    prompt_ids = chat_inputs["input_ids"].to(model.device)
    attention_mask = chat_inputs["attention_mask"].to(model.device)

    # Cap based on the known or estimated gap size. Deterministic greedy
    # decoding. When the caller knows the actual word count (``expected_words``),
    # use a generous budget scaled to it; otherwise fall back to the older
    # context-based heuristic so direct callers without a known gap size
    # still get a reasonable budget.
    if expected_words is not None:
        max_new = max(64, int(expected_words * 2.5))
    else:
        max_new = max(64, _gap_word_count(left_context, right_context) * 2)

    with torch.no_grad():
        output_ids = model.generate(
            prompt_ids,
            attention_mask=attention_mask,
            max_new_tokens=max_new,
            do_sample=False,
            temperature=None,
            top_p=None,
            pad_token_id=tokenizer.eos_token_id,
        )

    # Slice off the prompt so we decode only the model's reply.
    new_ids = output_ids[0, prompt_ids.shape[1]:]
    text = tokenizer.decode(new_ids, skip_special_tokens=True)
    # Belt-and-suspenders: even with enable_thinking=False, strip any
    # residual <think>...</think> blocks in case a future tokenizer
    # revision disregards the flag.
    text = _strip_think_blocks(text)
    return text.strip()
