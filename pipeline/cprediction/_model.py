"""Singleton loader for the local reference model.

Both ``score`` and ``reconstruct`` reach for the same weights — *one model,
both directions* is a literal identity here, not a wish. The 7B model takes
15–30 seconds to load from disk on first call, so we cache it at module
level and hand out the cached handle on every subsequent call.

The loader picks a single device via :func:`_pick_device` (CUDA, then
Apple MPS, then CPU) and moves the whole model onto it with ``.to(device)``.
We deliberately avoid ``device_map="auto"`` / accelerate offload — keeping
the full model on one accelerator avoids paying disk/CPU offload cost on
every forward pass. ``torch.bfloat16`` is used throughout because the
numerics are stable enough for scoring and we save ~half the memory
vs. fp32.
"""

from __future__ import annotations

import sys
from typing import Optional

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, PreTrainedModel, PreTrainedTokenizerBase


MODEL_ID: str = "Qwen/Qwen2.5-7B-Instruct"
"""HuggingFace repo id for the reference model used by score() and reconstruct()."""


_MODEL: Optional[PreTrainedModel] = None
_TOKENIZER: Optional[PreTrainedTokenizerBase] = None


def _log(msg: str) -> None:
    print(f"[cprediction._model] {msg}", file=sys.stderr, flush=True)


def get_tokenizer() -> PreTrainedTokenizerBase:
    """Return the cached tokenizer, loading it on first call."""
    global _TOKENIZER
    if _TOKENIZER is None:
        _log(f"loading tokenizer {MODEL_ID}...")
        _TOKENIZER = AutoTokenizer.from_pretrained(MODEL_ID)
    return _TOKENIZER


def _pick_device() -> str:
    """Choose the best single device available.

    We prefer placing the whole model on one accelerator so we don't pay
    the (severe) cost of disk/CPU offloading on every forward pass.
    """
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def get_model() -> PreTrainedModel:
    """Return the cached model, loading it on first call.

    First call takes ~15-30 s and consumes ~14 GB of disk via the HF cache.
    Subsequent calls return the cached handle immediately.
    """
    global _MODEL
    if _MODEL is None:
        device = _pick_device()
        _log(f"loading model {MODEL_ID} (bfloat16, device='{device}')...")
        _MODEL = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            dtype=torch.bfloat16,
        )
        _MODEL.to(device)
        _MODEL.eval()
        _log(f"model loaded on {device}")
    return _MODEL
