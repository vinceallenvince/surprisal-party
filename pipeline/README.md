# pipeline

Offline build-time Python pipeline for the Compression-Prediction Explorer.

It runs entirely offline: reconcile model tokens to words, score per-token
surprisal, pick the discrete slider positions, find and reconstruct the removed
gaps, score reconstruction fidelity, and write a versioned JSON cache per corpus
for the runtime to render. Scoring and reconstruction use a local
**Qwen2.5-7B-Instruct** model (`transformers` + `torch`). See
`../docs/implementation-plan.md` for the rules these layers enforce.

## Layout

```
pipeline/
├── pyproject.toml
├── cprediction/
│   ├── __init__.py
│   ├── reconciliation.py        # normalize() + reconcile()
│   ├── score.py                 # per-token surprisals (model)
│   ├── thresholds.py            # discrete slider positions
│   ├── spans.py                 # find_gaps()
│   ├── reconstruct.py           # gap reconstruction (model)
│   ├── fidelity.py              # fidelity()
│   ├── cache.py                 # write_cache() — versioned JSON for runtime
│   └── run.py                   # end-to-end pipeline driver
└── tests/
    ├── test_reconciliation.py
    ├── test_thresholds.py
    ├── test_spans.py
    ├── test_fidelity.py
    ├── test_cache.py
    └── ...integration tests
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

## Adding a corpus

One plain-text file in, one JSON cache out. The **slug** (kebab-case filename
stem) must match across the source file, the cache, and the runtime manifest.

1. **Add the source text** at `corpus/<slug>.txt` — e.g. `corpus/hansel-and-gretel.txt`.

2. **Generate the cache.** From `pipeline/` with the venv installed (see *Running
   the tests* above), run the driver — positional args are `<input> <output.md>`:

   ```bash
   caffeinate -is .venv/bin/python -m cprediction.run \
       corpus/<slug>.txt output/<slug>.md
   ```

   This loads the local Qwen2.5-7B-Instruct model and writes **both**
   `output/<slug>.md` (human-readable) and `output/<slug>.json` (the runtime
   cache). It's slow and pins the CPU/GPU, so `caffeinate -is` keeps the machine
   awake for the whole run.

3. **Copy the cache into the runtime** — the runtime serves caches from
   `public/tales/`:

   ```bash
   cp output/<slug>.json ../runtime/public/tales/<slug>.json
   ```

4. **Register it in the runtime manifest** `runtime/src/lib/corpora.ts` so the
   corpus picker lists it. Add an entry using the cache's `metadata.title` and
   `metadata.word_count`:

   ```ts
   { slug: 'hansel-and-gretel', title: 'Hansel and Gretel', wordCount: 50 }
   ```

The runtime fetches `/tales/<slug>.json` at load; no rebuild of the pipeline is
needed once the JSON and manifest entry are in place.
