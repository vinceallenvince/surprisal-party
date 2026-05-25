"""Compression-Prediction Explorer offline pipeline package."""

from cprediction.fidelity import fidelity
from cprediction.reconciliation import Token, Word, normalize, reconcile
from cprediction.spans import Gap, find_gaps
from cprediction.thresholds import select_thresholds

__all__ = [
    "Gap",
    "Token",
    "Word",
    "fidelity",
    "find_gaps",
    "normalize",
    "reconcile",
    "select_thresholds",
]
