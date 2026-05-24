# pipeline

Offline build-time Python pipeline for the Compression-Prediction Explorer.

Phase 0 contains only the **tokenization reconciliation** layer: the bridge
between model tokens (subword BPE pieces with leading whitespace, BOS/EOS
markers, etc.) and user-visible words. See `../docs/implementation-plan.md`
for the rules this layer enforces.

## Layout

```
pipeline/
├── pyproject.toml
├── cprediction/
│   ├── __init__.py
│   └── reconciliation.py        # normalize() + reconcile()
└── tests/
    └── test_reconciliation.py
```

The pipeline is a proper Python package (`cprediction`) so additional Phase 1
modules (`score.py`, `reconstruct.py`) can land alongside `reconciliation.py`
without restructuring.

## Running the tests

Requires Python 3.11+. Install the package and its dev dependencies into a
local virtualenv, then run pytest:

```bash
cd pipeline
python -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'
pytest
```
