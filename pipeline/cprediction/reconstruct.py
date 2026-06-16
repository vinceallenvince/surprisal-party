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


# Markers the placeholder mode puts in the prompt; the model is told never to
# echo them, but we also strip any that leak (it tends to render "[...]" as
# "(...)"). Matches <<<FILL>>> and a bracketed/parenthesized ASCII or Unicode
# ellipsis.
_MARKER_RE = re.compile(r"<<<\s*FILL\s*>>>|[\[(]\s*(?:\.\.\.|…)\s*[\])]")


def _strip_markers(text: str) -> str:
    """Remove any residual prompt markers from a placeholder-mode reply.

    Defensive cleanup for ``reconstruct_placeholder``: drop leaked markers, pull
    spaces back off punctuation they orphaned, and collapse the resulting
    whitespace.
    """
    text = _MARKER_RE.sub(" ", text)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


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


# Forward (left-only / "causal") reconstruction prompt — the prototype variant.
# Mirrors the directionality of surprisal scoring (-log2 p(token | PRECEDING
# context)): the model sees only the text leading up to the gap and predicts
# what was removed next, with no right context to anchor against. The preceding
# text it receives is itself the *surviving* (compressed) text at this
# threshold, so this is "rebuild the removed words from what is still stored".
# Deliberately GENERAL — no fairy-tale / Grimm / Andersen framing — so it
# applies to any future corpus.
_SYSTEM_PROMPT_FORWARD = (
    "You are reconstructing a removed passage of a text. The user gives you "
    "the text that comes immediately before a gap. Note that this preceding "
    "text may itself be abridged — some of its own words may already have been "
    "removed — so read it as the compressed record of what came before. From "
    "that preceding text alone, predict the words that were removed at the "
    "gap: the words that come next.\n\n"
    "Rules:\n"
    "- Output ONLY the predicted text for the gap. No preamble, no "
    "explanation, no quotation marks around your answer, no surrounding "
    "context.\n"
    "- If the preceding text ends with a space, do not add a leading space.\n"
    "- Match the voice, register, and style of the preceding text.\n"
    "- Predict only the missing passage — roughly its expected length — not a "
    "continuation of the whole text."
)


# Bidirectional gap-fill prompt for the "surviving-bidirectional" prototype:
# full surviving (compressed) text on the left, a MINIMAL surviving anchor on
# the right. The right side only tells the model what the fill must connect
# into — it is not symmetric with the left. Generalized (no fairy-tale / Grimm /
# Andersen framing) so it applies to any corpus.
_SYSTEM_PROMPT_GAP = (
    "You are reconstructing a removed passage of a text. The user gives you "
    "the text immediately BEFORE a gap and a short bit of text immediately "
    "AFTER it. Note that the BEFORE text may itself be abridged — some of its "
    "own words already removed — so read it as the compressed record of what "
    "came before. Fill the gap with the words that were removed, so the text "
    "reads continuously from BEFORE into AFTER.\n\n"
    "Rules:\n"
    "- Output ONLY the replacement text for the gap. No preamble, no "
    "explanation, no quotation marks around your answer, no BEFORE/AFTER "
    "labels, no surrounding context.\n"
    "- Match the spacing implied by the context: if BEFORE ends with a space, "
    "do not add a leading space.\n"
    "- Match the voice, register, and style of the surrounding text.\n"
    "- Keep the length proportional to the missing passage; it must lead "
    "naturally into the AFTER text."
)


# Placeholder prompt for the "surviving-placeholder" prototype. The context is
# CONTIGUOUS surviving text with removed spans shown as markers — other removed
# spans as "[...]" and the ONE target span as "<<<FILL>>>". Preserving the
# structure (rather than deleting words and concatenating survivors) stops the
# model reciting/regenerating, and the explicit target marker makes it a precise
# fill. Only survivors are ever revealed. Generalized — no corpus-specific
# framing.
_SYSTEM_PROMPT_PLACEHOLDER = (
    "You are reconstructing the words removed at one point in an abridged "
    "text. The user gives you a passage in which removed spans are shown as "
    "[...] markers, and the ONE span you must reconstruct is marked <<<FILL>>>. "
    "Using the surrounding words, predict the words that were removed at the "
    "<<<FILL>>> marker.\n\n"
    "Rules:\n"
    "- Output ONLY the words that belong at <<<FILL>>> — nothing else. No "
    "preamble, no explanation, no quotation marks.\n"
    "- NEVER output a marker. Do not write <<<FILL>>>, [...], (...), or any "
    "ellipsis in brackets or parentheses anywhere in your answer.\n"
    "- Do NOT copy, continue, or rewrite the surrounding text or the other "
    "[...] spans. Reconstruct only the single <<<FILL>>> span.\n"
    "- Match the voice, register, and style of the surrounding text.\n"
    "- Keep the length proportional to the missing span (usually only a few "
    "words)."
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

    user_msg = f"LEFT: {left_context}\n<<<GAP>>>\nRIGHT: {right_context}"
    # Cap based on the known or estimated gap size. When the caller knows the
    # actual word count (``expected_words``), use a generous budget scaled to
    # it; otherwise fall back to the older context-based heuristic so direct
    # callers without a known gap size still get a reasonable budget.
    if expected_words is not None:
        max_new = max(64, int(expected_words * 2.5))
    else:
        max_new = max(64, _gap_word_count(left_context, right_context) * 2)
    return _generate_reply(_SYSTEM_PROMPT, user_msg, max_new)


def reconstruct_forward(
    left_context: str,
    expected_words: int | None = None,
) -> str:
    """Left-only ("causal") reconstruction — the prototype variant.

    Predicts the removed span from the PRECEDING text alone (no right context),
    mirroring the directionality of surprisal scoring. ``left_context`` is the
    *surviving* (compressed) text up to the gap, so this is "rebuild the removed
    words from what is still stored". Greedy/deterministic, same as
    :func:`reconstruct`.
    """

    if expected_words is not None:
        max_new = max(64, int(expected_words * 2.5))
    else:
        max_new = max(64, len(left_context.split()) * 2)
    # The preceding text IS the user turn; the system prompt frames the task as
    # "predict what comes next". No gap marker / right context.
    return _generate_reply(_SYSTEM_PROMPT_FORWARD, left_context, max_new)


def reconstruct_gap(
    left_context: str,
    right_context: str,
    expected_words: int | None = None,
) -> str:
    """Asymmetric bidirectional reconstruction — the "surviving-bidirectional"
    prototype.

    ``left_context`` is the full SURVIVING (compressed) prefix; ``right_context``
    is a MINIMAL surviving anchor (1–2 words) after the gap. Unlike
    :func:`reconstruct` (baseline), both sides are drawn from survivors only —
    no removed neighbors leak in — and the right side is a small landmark, not a
    symmetric window. Greedy/deterministic.
    """

    if expected_words is not None:
        max_new = max(64, int(expected_words * 2.5))
    else:
        max_new = max(64, _gap_word_count(left_context, right_context) * 2)
    user_msg = f"BEFORE: {left_context}\n<<<GAP>>>\nAFTER: {right_context}"
    return _generate_reply(_SYSTEM_PROMPT_GAP, user_msg, max_new)


def reconstruct_placeholder(
    context: str,
    expected_words: int | None = None,
) -> str:
    """Placeholder-based reconstruction — the "surviving-placeholder" prototype.

    ``context`` is contiguous surviving text in which removed spans appear as
    ``[...]`` markers and the single target span as ``<<<FILL>>>``. The model
    fills only the target marker. Preserving the structure (vs deleting words)
    is what stops the recite/regenerate behavior the concatenation variants hit.
    Greedy/deterministic.
    """

    if expected_words is not None:
        max_new = max(64, int(expected_words * 2.5))
    else:
        max_new = max(64, len(context.split()) * 2)
    return _strip_markers(_generate_reply(_SYSTEM_PROMPT_PLACEHOLDER, context, max_new))


def _generate_reply(system_prompt: str, user_msg: str, max_new: int) -> str:
    """Run one deterministic chat completion and return the cleaned reply.

    Shared by :func:`reconstruct` (gap-fill, bidirectional) and
    :func:`reconstruct_forward` (left-only). Greedy decoding; thinking mode
    disabled; residual ``<think>`` blocks stripped defensively.
    """

    tokenizer = get_tokenizer()
    model = get_model()

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_msg},
    ]
    chat_inputs = tokenizer.apply_chat_template(
        messages,
        add_generation_prompt=True,
        return_tensors="pt",
        return_dict=True,
        # Qwen3 introduced a "thinking mode" that wraps reasoning in
        # <think>...</think> before the actual reply. We want only the reply,
        # so we disable thinking at the chat-template level. Tokenizers that
        # don't recognize the flag silently ignore it, so this remains a safe
        # no-op on older Qwen2.5-family tokenizers.
        enable_thinking=False,
    )
    prompt_ids = chat_inputs["input_ids"].to(model.device)
    attention_mask = chat_inputs["attention_mask"].to(model.device)

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
