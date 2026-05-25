# Anthropic API capabilities relevant to the pipeline

Investigation date: 2026-05-24. Anthropic Python SDK version checked: `0.104.1`.
Models checked: `claude-haiku-4-5`, `claude-opus-4-7` (current GA models).

## Finding: token-level logprobs are NOT available on the Anthropic API

The Compression-Prediction Explorer's `score()` stage needs per-token surprisal
(`-log2 p(token | context)`) on an arbitrary source string. That requires the
reference model to return per-token logprobs. **As of 2026-05-24 the Anthropic
API does not expose this capability on any surface.**

### Evidence

1. **SDK signature.** `anthropic.Anthropic().messages.create` (SDK 0.104.1)
   accepts these parameters and nothing else:

   ```
   max_tokens, messages, model, cache_control, container, inference_geo,
   metadata, output_config, service_tier, stop_sequences, stream, system,
   temperature, thinking, tool_choice, tools, top_k, top_p,
   extra_headers, extra_query, extra_body, timeout
   ```

   No `logprobs`, `top_logprobs`, or similar. No related field on the response
   object either — `Message` exposes `id`, `content`, `model`, `role`,
   `stop_reason`, `stop_sequence`, `stop_details`, `type`, `usage`, `container`,
   with no token-level probability information anywhere.

2. **Documentation.** The official Messages API reference at
   `https://platform.claude.com/docs/en/api/messages` lists the full request
   parameter set; logprobs are absent. The Claude Platform release notes
   (checked through 2026-05-19) contain no mention of logprobs, log
   probabilities, or any token-probability beta.

3. **Live API smoke test.** A request to `claude-haiku-4-5` with
   `extra_body={"logprobs": True, "top_logprobs": 5}` returns:

   ```
   HTTP 400 invalid_request_error
   "logprobs: Extra inputs are not permitted"
   ```

   The API actively rejects the parameter; it is not silently ignored.

4. **OpenAI-compatibility endpoint.** Anthropic ships an OpenAI-compatible
   `/v1/chat/completions` endpoint. It accepts `logprobs: true` in the request
   body without error, but the response contains no `logprobs` field — the
   parameter is silently dropped. This endpoint is not a viable workaround.

5. **Third-party indicators.** The `anerli/anthropic-logprobs` GitHub repo,
   which surfaces in every search for the topic, is explicitly a proposal for
   how logprobs *could* integrate with the Anthropic API. It does not
   implement a workaround; it documents the missing capability.

### What's available instead

- `usage.input_tokens` and `usage.output_tokens` — aggregate counts only,
  not per-position probabilities.
- Token counting API (`/v1/messages/count_tokens`) — returns total token
  counts for a prompt, no probabilities.
- Generation is fully accessible (text out, tool calls, structured outputs,
  streaming), so `reconstruct()` — which only needs the model to write the
  filler text for a gap — is unblocked.

### Implications for Phase 0

The implementation plan committed to "Reference model: Claude API. The
pipeline calls Claude for surprisal scoring (via token-level logprob access)
and for gap reconstruction." Half of that commitment — surprisal scoring —
cannot be honored against the current Anthropic API surface. The pipeline
shape is model-agnostic at the `score()` boundary (the plan explicitly notes
this), so swapping the scoring backend does not require rewriting
reconciliation, span selection, reconstruction, or fidelity.

Realistic options for unblocking Phase 0, none of which we should pick
unilaterally:

1. **Use a different reference model for `score()` only.** OpenAI's API
   (`logprobs=True`, `top_logprobs` up to 20) and several open-weight models
   served via vLLM/TGI/Together (`logprobs` supported) all expose what's
   needed. `reconstruct()` and `fidelity()` would still use Claude. Cost is
   low for fairy-tale-sized inputs. Risk: the surprisal model and the
   reconstruction model are no longer "the same model," which the abstract
   leans on as the "anti-magic guarantee" — that needs an explicit decision.

2. **Use a local model for `score()` only.** A small open model (Llama 3.x,
   Qwen, GPT-2 even) run locally via `transformers` gives exact logprobs for
   free, no API. Same drift caveat as (1), plus a heavier local dependency.

3. **Approximate surprisal without true logprobs.** Possible techniques —
   stop-sequence probing, repeated sampling at low temperature, masked
   continuation scoring — are all expensive, noisy, and would require
   significant validation before they could be trusted to drive the slider.
   Not recommended as a first move.

4. **Wait / petition.** Anthropic has not announced logprobs on any
   timeline. Not a Phase 0 option.

### Recommendation

Stop and consult on the model decision before writing `score.py`. The
remaining Phase 0 modules (`fidelity`, `thresholds`, `spans`, `reconstruct`,
`run`) can be designed and unit-tested independent of which scoring backend
is chosen, but `score.py` itself needs the decision first.

## Resolution (2026-05-24): OpenAI `gpt-5.4-mini` for both stages

The reference model was swapped from Claude to **OpenAI `gpt-5.4-mini`**.
OpenAI exposes per-token logprobs natively (`logprobs=True`,
`top_logprobs` up to 20) and is used for *both* surprisal scoring and gap
reconstruction. Using a single model preserves the abstract's *one model,
both directions* anti-magic guarantee — the fade and the reconstruction
share a source.

Implementation plan and README were updated to reflect the change. A
local model (Llama/Qwen/etc. via `transformers`) remains the natural
escalation for Phase 1 if full offline reproducibility becomes desirable.

## Endpoint and logprobs surface used by `score.py` (Phase 0)

OpenAI Python SDK version: `openai==2.38.0`.

`score()` uses the **chat-completions** endpoint
(`client.chat.completions.create`) with `logprobs=True` and
`top_logprobs=5`. Logprobs are only returned for tokens the model
*generates*, not for tokens in the prompt — the legacy `/v1/completions`
`echo=True` mode is unavailable for the `gpt-5.x` family.

To get logprobs over the *source* text we therefore use an
**echo strategy**: a deterministic system prompt instructs the model to
reproduce the user message verbatim with `temperature=0.0`. The output
token stream is then the (normalized) source text, and the per-position
logprobs are exactly the surprisals we need. The model output is
defensively verified to match the normalized source — a mismatch raises
so the caller can chunk and retry. Cost is roughly 2x prompt tokens; for
LRRH-sized inputs (≈1.4k words) this is pennies.

Conversion: OpenAI logprobs are natural-log; `score()` divides by
`ln(2)` to emit surprisal in bits.

`reconstruct()` uses the same endpoint without `logprobs`. Both stages
target `gpt-5.4-mini`.

## Second resolution (2026-05-24): pivot from OpenAI to a local model

When the echo strategy was run end-to-end on the full LRRH text, **all
surprisals collapsed to ~0 bits** (range ±0.0001 bits per token). The
diagnosis: conditioning a chat-tuned model on a system prompt
instructing verbatim echo makes the model essentially 100% certain of
every token of its own output. The logprobs measure the model's
confidence in obeying the instruction, not the text's information
content. The output was structurally garbage — kernel "survivors" at
deep compression were random scraps (`oak-trees`, `Red-Cap` everywhere)
where the model happened to be 99.9% sure rather than 99.99%, not the
genuinely load-bearing tokens of the story.

Workarounds attempted, all failed:

1. **Iterative scoring via chat completions** (one call per source
   token, look up actual token in `top_logprobs`). Chat models treat
   incomplete input as a query and respond as an assistant. Given
   `"Once upon a time there was a"` the model emits `"It sounds like
   you're starting a lovely story!"` not `" dear"`. The "first output
   token" is a response opener, not a continuation. Token-boundary
   issues compound the problem (assistant-start tokens have no leading
   space; mid-text tokens do).

2. **Iterative scoring via the Responses API** (same call shape, newer
   endpoint with `top_logprobs` up to 20). Same chat framing, same
   distortion.

3. **Single-pass "recite verbatim" via instructions.** Even with strong
   framing ("You are reciting Grimm's fairy tale Little Red-Cap from
   memory, verbatim"), the model paraphrases — variations appear within
   the first sentence ("she never wanted to wear" vs. source's "she
   would never wear"). Continuation isn't faithful enough to use as a
   scoring signal.

4. **Legacy `/v1/completions` with `gpt-3.5-turbo-instruct` +
   `max_tokens=1, logprobs=5` (iterative).** This *worked*: real
   surprisal signal, 22/29 top-1 matches on the LRRH opening, 2/29
   out-of-range, total 24.2 bits for 29 tokens. But the only model that
   gives this surface is `gpt-3.5-turbo-instruct` — an older model with
   deprecation risk. If OpenAI sunsets it, the pipeline breaks; and any
   future Tier C live-prediction layer would inherit that risk.

## Third resolution: local model via `transformers`

Reference model: **`Qwen/Qwen2.5-7B-Instruct`** (Apache 2.0). Loaded
locally via `transformers`. Properties:

- One forward pass over the source returns exact per-token logits over
  the whole sequence; surprisal is `-log_softmax(logits)[next_token]`
  in bits.
- *One model, both directions* is bit-for-bit literal — the same
  weights drive scoring and reconstruction.
- Zero API surface dependency. The model file is owned forever.
- Reproducible: pin the model revision + seeds → identical outputs
  across machines.
- Clean Tier C escalation path: self-host the same weights behind a
  thin endpoint (Modal, Replicate, vLLM, FastAPI) when live prediction
  becomes desirable.

The `openai`, `tiktoken`, and `python-dotenv` runtime dependencies are
removed. `transformers`, `torch`, `accelerate`, and `sentencepiece`
are added. `.env.example` is reduced to a comment — the pipeline reads
no environment variables. First run downloads ~14 GB of weights to
`~/.cache/huggingface/`; subsequent runs load from disk in seconds.

### Implementation surface in use (Phase 0)

- **Model singleton:** `cprediction/_model.py` exposes `get_model()`,
  `get_tokenizer()`, and `MODEL_ID`. Both `score` and `reconstruct` reach
  for the same cached handles, so *one model, both directions* is
  bit-for-bit literal. The loader picks the best single device
  available (`cuda` > `mps` > `cpu`) and loads in `bfloat16`. On a
  24 GB Apple Silicon machine the whole model sits on MPS — no
  disk/CPU offloading, no per-forward-pass overhead.
- **Scoring (`score.py`):** tokenizes the normalized source with
  `add_special_tokens=False` (Qwen2.5 does not prepend a BOS for plain
  text; we suppress special tokens defensively so the surprisal stream
  aligns one-to-one with source characters). One `model(input_ids)`
  forward pass yields logits; surprisal is
  `-log_softmax(logits[:-1])[next_id] / ln(2)` in bits, computed with
  `torch.nn.functional.log_softmax` for stability. The first token
  carries surprisal `0.0` (no left context) so the
  `"".join(t.text for t in tokens) == normalized_source` invariant
  holds for `reconcile()`.
- **Reconstruction (`reconstruct.py`):** uses
  `tokenizer.apply_chat_template(..., return_dict=True)` (newer
  transformers returns a `BatchEncoding`, not a tensor — older code that
  passes the result directly to `model.generate` will fail with an
  `AttributeError` on `.shape`) with a system prompt that frames the
  task as filling a gap, plus a user turn shaped as
  `LEFT: ... \n<<<GAP>>>\nRIGHT: ...`. Greedy decoding
  (`do_sample=False`), `max_new_tokens` scaled to roughly twice the
  larger of the left/right word counts with a floor of 64.
