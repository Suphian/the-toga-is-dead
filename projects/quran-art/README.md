# Quran Art

Three arrangements of one rule for every surah: **114 surahs and 342 artworks**. The gallery lives at `/quran`; each surah has a named detail page such as `/surah/al-fajr`. The detail pages share a verse selector and explain the theory behind each approach in permanently visible sections.

This directory contains the source and saved text data. The generated public files are in `../../site/quran/` and `../../site/surah/`. They are a self-contained addition to the existing static site. The Toga game remains at `/Toga`.

## Regenerate

Use Node.js 24 or newer. From this directory:

```sh
npm ci
node scripts/build_site.js
```

The build reads the checked-in dataset without making network requests. It writes the gallery, 114 detail pages, 342 downloadable SVG artworks (1200×1200 exports of a 600-unit square frame), and 342 PNG thumbnails (640×640). The SVGs use the same geometry as the interactive detail pages. The raster thumbnails are rendered from those SVGs with pinned `@resvg/resvg-js`; they are not AI-generated images.

To recalculate the dataset from its saved source responses, run `python scripts/derive_data.py`. Add `--fetch` only when intentionally replacing the source snapshots with a fresh Quran.com response. Review the resulting data changes before rebuilding. The data script validates chapter ordering, each chapter's verse count, and all 6,236 numbered verses.

For a local preview, run `npm run dev` from the repository root and open `/quran` on the reported local server. This generator does not need to run in Vercel: the committed `site/` output is served directly.

## Text and counting

The Arabic text is the [Quran.com Uthmani transcription](https://api.quran.com/api/v4/quran/verses/uthmani); surah names and verse counts come from its [chapter metadata](https://api.quran.com/api/v4/chapters?language=en). The original response bodies, retrieval time, derived measurements, and source SHA-256 checksums are retained in `data/`. See [data/method.md](data/method.md) for the full counting convention.

Words are split on Unicode whitespace. Length counts Unicode letter codepoints, excluding tatweel and small annotation waw/yeh (U+0640, U+06E5, U+06E6). Combining marks and empty tokens are removed; attached prefixes remain attached. There is no spelling normalization or Unicode decomposition. Shadda does not double a letter, and dagger alif does not add one. These are measurements of the supplied transcription, not traditional letter totals or pronunciation.

Only numbered verses are used. This includes the basmala at 1:1 and within 27:30; no unnumbered opening basmala is added. All statistics use population standard deviation.

## One rule, three arrangements

Every drawing follows one invariant: **one letter is one unit of line, and every word boundary is a small break.** Breaks are carved out of the ink on both sides of a boundary (0.45u wide, at most 4 units, drawn only when a letter is at least 2 units wide), so a verse's total length stays exactly proportional to its letters and dense surahs degrade to continuous strokes rather than speckle. The frame is a 600-unit square with a 40-unit margin, exported at 1200×1200; thumbnails are 640×640. `geometry.js` is shared by the generator and the browser, so exports and interactive views use one implementation. Each artwork is fitted uniformly to its own frame; displayed size does not compare surah lengths. The remaining constants (stroke, break and swell sizes) live in one `style` object and set the visual style only; none of them changes a length ratio.

**Rays.** Verse i of V is a straight ray from an inner circle of radius r₀ = clamp(0.19V, 24, 70), at angle θᵢ = 90° + 360°(i − 1)/V measured counter-clockwise on screen, so verse 1 points up and later verses follow the reading direction. Its length is L·u with u = (260 − r₀)/L_max, so the longest verse reaches the frame. Words sit along the ray from the centre outward.

**Rows.** Verse i is a horizontal row at y = 2.4u(i − 1), aligned to a common right edge where reading begins, with length L·u and u = min(520/L_max, 520/2.4(V − 1)). The block is centred; relative lengths remain proportional to letter counts.

**Spiral.** The whole surah is one Archimedean spiral r = r₀ + pθ/2π read from the centre outward, one letter per unit of arc, word after word. The number of turns is n = clamp(√(S/16), 1.25, 40) for S total letters, so ink density stays even; p = (260 − 0.9)/(n + 0.85) and r₀ = p/2. Each word pushes the line radially by δ = A·tanh[(ℓ − μ)/σ]·sin²(πt), with μ and σ the surah's mean word length and spread, spread over at least 24 units of arc and soft-clamped so the total never exceeds A = min(0.35p, (p − w − 0.8)/2); neighbouring turns therefore never touch.

The geometry is deterministic. No AI-generated artwork or external image assets are used in this gallery.
