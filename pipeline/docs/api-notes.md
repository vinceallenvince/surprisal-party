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
