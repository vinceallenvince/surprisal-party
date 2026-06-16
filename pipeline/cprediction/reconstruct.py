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


# Placeholder prompt for the "surviving-placeholder" strategy. The context is
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


def reconstruct_placeholder(
    context: str,
    expected_words: int | None = None,
) -> str:
    """Reconstruct one removed gap from the surviving context.

    ``context`` is contiguous surviving text in which other removed spans appear
    as ``[...]`` markers and the single target span as ``<<<FILL>>>``. The model
    fills only the target marker, and never sees the removed words themselves.
    Greedy/deterministic.
    """

    if expected_words is not None:
        max_new = max(64, int(expected_words * 2.5))
    else:
        max_new = max(64, len(context.split()) * 2)
    return _strip_markers(_generate_reply(_SYSTEM_PROMPT_PLACEHOLDER, context, max_new))


def _generate_reply(system_prompt: str, user_msg: str, max_new: int) -> str:
    """Run one deterministic chat completion and return the cleaned reply.

    Greedy decoding; thinking mode disabled; residual ``<think>`` blocks
    stripped defensively.
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
