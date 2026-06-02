/**
 * Tale-cache types — the runtime's mirror of the authoritative pydantic
 * schema in `pipeline/cprediction/cache.py` (schema_version 0.1.0).
 *
 * Source of truth: the pydantic models are authoritative (per
 * `runtime/CLAUDE.md`). These definitions were hand-mirrored field-for-field
 * against `cache.py`, cross-checked against its `model_json_schema()` output
 * (run `python3 -c "import sys; sys.path.insert(0,'pipeline'); from
 * cprediction.cache import TaleCache; import json;
 * print(json.dumps(TaleCache.model_json_schema()))"` to regenerate the
 * reference). They are expressed as `zod` schemas so the same definition
 * serves both compile-time types (via `z.infer`) and a lightweight runtime
 * validation of the fetched JSON — a belt-and-suspenders check before the UI
 * trusts the cache.
 *
 * Numeric bounds mirror the pydantic `Field(ge=..., le=...)` constraints. The
 * pipeline's `_RoundedFloatModel` sets `extra="forbid"`; we mirror that with
 * `.strict()` so an unexpected field surfaces as a validation error rather
 * than being silently ignored.
 *
 * If `cache.py` changes shape, bump these in lockstep — the runtime must not
 * invent fields the schema does not define.
 */

import { z } from 'zod';

/** The schema_version this runtime understands. */
export const SUPPORTED_SCHEMA_VERSION = '0.1.0';

/** WordEntry — one reconciled word. Mirrors `cache.WordEntry`. */
export const WordEntrySchema = z
  .object({
    index: z.number().int().min(0),
    core: z.string(),
    trailing_punct: z.string(),
    is_terminal_punct: z.boolean(),
    is_empty_core: z.boolean(),
    char_start: z.number().int().min(0),
    char_end: z.number().int().min(0),
    surprisal: z.number(),
  })
  .strict();

/** GapEntry — one gap at one slider position. Mirrors `cache.GapEntry`. */
export const GapEntrySchema = z
  .object({
    id: z.number().int().min(0),
    start_word_index: z.number().int().min(0),
    end_word_index: z.number().int().min(0),
    word_indices: z.array(z.number().int()),
    actual_text: z.string(),
    predicted_text: z.string(),
    fidelity: z.number().min(0).max(1),
  })
  .strict();

/** PositionEntry — one slider position. Mirrors `cache.PositionEntry`. */
export const PositionEntrySchema = z
  .object({
    index: z.number().int().min(0),
    threshold: z.number(),
    words_remaining: z.number().int().min(0),
    words_removed: z.number().int().min(0),
    stored_bits: z.number().min(0),
    predicted_bits: z.number().min(0),
    gaps: z.array(GapEntrySchema),
  })
  .strict();

/** CacheMetadata — provenance and totals. Mirrors `cache.CacheMetadata`. */
export const CacheMetadataSchema = z
  .object({
    title: z.string(),
    source_file: z.string(),
    model_id: z.string(),
    generated_at: z.string(),
    total_bits: z.number().min(0),
    word_count: z.number().int().min(0),
    token_count: z.number().int().min(0),
  })
  .strict();

/** TaleCache — the full cache document. Mirrors `cache.TaleCache`. */
export const TaleCacheSchema = z
  .object({
    schema_version: z.string(),
    metadata: CacheMetadataSchema,
    source: z.string(),
    words: z.array(WordEntrySchema),
    kernel_word_indices: z.array(z.number().int()),
    positions: z.array(PositionEntrySchema),
  })
  .strict();

export type WordEntry = z.infer<typeof WordEntrySchema>;
export type GapEntry = z.infer<typeof GapEntrySchema>;
export type PositionEntry = z.infer<typeof PositionEntrySchema>;
export type CacheMetadata = z.infer<typeof CacheMetadataSchema>;
export type TaleCache = z.infer<typeof TaleCacheSchema>;

/**
 * Parse and validate an unknown value as a {@link TaleCache}.
 *
 * Throws a `ZodError` if the shape does not match the schema. Loading / error
 * UX (skeletons, retries, slow-network states) is Phase 3; for now callers
 * keep a minimal null-guard around this.
 */
export function parseTaleCache(data: unknown): TaleCache {
  return TaleCacheSchema.parse(data);
}
