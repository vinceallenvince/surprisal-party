/**
 * Corpus manifest — the static, ordered list of corpora the explorer can load.
 *
 * The runtime is a static export with no server: there is no directory listing
 * of `public/tales/`, so the set of available corpora is declared here, by
 * hand, and shipped in the bundle. The corpus-picker drawer renders this list;
 * `ExplorerContainer` fetches `/tales/<slug>.json` for the active slug.
 *
 * ---------------------------------------------------------------------------
 * ADDING A CORPUS (two steps, both required):
 *   1. Generate its cache with the offline pipeline and drop the resulting
 *      `<slug>.json` into `runtime/public/tales/`.
 *   2. Add an entry to `CORPORA` below — `{ slug, title, wordCount }`. The
 *      `slug` MUST match the JSON filename (without `.json`); `title` and
 *      `wordCount` are display metadata (mirror the cache's
 *      `metadata.title` / `metadata.word_count`).
 * A corpus "lights up" in the drawer as soon as its entry exists here AND its
 * JSON is present. Do not list a corpus whose JSON is not yet shipped.
 * ---------------------------------------------------------------------------
 *
 * Only one corpus exists today (Little Red Riding Hood). The list is ordered;
 * the first entry is the default the explorer loads on first paint.
 */

export type Corpus = {
  /** Filename stem under `public/tales/` — `<slug>.json` is fetched at runtime. */
  slug: string;
  /** Display title (mirrors the cache's `metadata.title`). */
  title: string;
  /** Word count shown as the drawer meta line (mirrors `metadata.word_count`). */
  wordCount: number;
};

/** The ordered list of shipped corpora. First entry is the default. */
export const CORPORA: readonly Corpus[] = [
  {
    slug: 'little-red-riding-hood',
    title: 'Little Red Riding Hood',
    wordCount: 1378,
  },
  {
    slug: 'hansel-and-gretel',
    title: 'Hansel and Gretel',
    wordCount: 2931,
  },
  {
    slug: 'cinderella',
    title: 'Cinderella',
    wordCount: 2452,
  },
  {
    slug: 'rumpelstiltskin',
    title: 'Rumpelstiltskin',
    wordCount: 1124,
  },
  {
    slug: 'rapunzel',
    title: 'Rapunzel',
    wordCount: 1397,
  },
  {
    slug: 'snow-white',
    title: 'Snow White',
    wordCount: 2380,
  },
  {
    slug: 'sleeping-beauty',
    title: 'Sleeping Beauty',
    wordCount: 1510,
  },
  {
    slug: 'emperors-new-clothes',
    title: "The Emperor's New Clothes",
    wordCount: 1869,
  },
];

/** The slug the explorer loads on first paint (first manifest entry). */
export const DEFAULT_CORPUS_SLUG = CORPORA[0].slug;
