# Quran Art

Three numerical interpretations of every surah: **114 surahs and 342 artworks**. The gallery lives at `/quran`; each surah has a named detail page such as `/surah/al-fajr`. The detail pages share a verse selector and explain the theory behind each approach in permanently visible sections.

This directory contains the source and saved text data. The generated public files are in `../../site/quran/` and `../../site/surah/`. They are a self-contained addition to the existing static site. The Toga game remains at `/Toga`.

## Regenerate

Use Node.js 24 or newer. From this directory:

```sh
npm ci
node scripts/build_site.js
```

The build reads the checked-in dataset without making network requests. It writes the gallery, 114 detail pages, 342 downloadable SVG artworks, and 342 PNG thumbnails. The SVGs use the same geometry as the interactive detail pages. The raster thumbnails are rendered from those SVGs with pinned `@resvg/resvg-js`; they are not AI-generated images.

To recalculate the dataset from its saved source responses, run `python scripts/derive_data.py`. Add `--fetch` only when intentionally replacing the source snapshots with a fresh Quran.com response. Review the resulting data changes before rebuilding. The data script validates chapter ordering, each chapter's verse count, and all 6,236 numbered verses.

For a local preview, run `npm run dev` from the repository root and open `/quran` on the reported local server. This generator does not need to run in Vercel: the committed `site/` output is served directly.

## Text and counting

The Arabic text is the [Quran.com Uthmani transcription](https://api.quran.com/api/v4/quran/verses/uthmani); surah names and verse counts come from its [chapter metadata](https://api.quran.com/api/v4/chapters?language=en). The original response bodies, retrieval time, derived measurements, and source SHA-256 checksums are retained in `data/`. See [data/method.md](data/method.md) for the full counting convention.

Words are split on Unicode whitespace. Length counts Unicode letter codepoints, excluding tatweel and small annotation waw/yeh (U+0640, U+06E5, U+06E6). Combining marks and empty tokens are removed; attached prefixes remain attached. There is no spelling normalization or Unicode decomposition. Shadda does not double a letter, and dagger alif does not add one. These are measurements of the supplied transcription, not traditional letter totals or pronunciation.

Only numbered verses are used. This includes the basmala at 1:1 and within 27:30; no unnumbered opening basmala is added. All statistics use population standard deviation.

## Three mappings

The same mapping rules are applied to every surah. The constants set the visual style and do not assert hidden numerical meaning. `geometry.js` is shared by the generator and browser, so exports and interactive views use one implementation. Each artwork is fitted uniformly to its own frame; displayed size does not compare surah lengths.

**Verse Shell.** A verse with W words, L letters, mean word length μᵥ and spread σᵥ becomes a rippled ring: R = 40 + 2L, A = 0.25σᵥ/(μᵥ + σᵥ), and r(θ) = R[1 + A cos(Wθ)]. For verse i of V, rotation is 2π(i − 1)/V and height is 12(i − 1). The display projects y to 0.42y − 0.907[z − 6(V − 1)]. Generalizing the stack's rotation and center to V preserves the original Al-Fajr geometry at V = 30.

**Word Current.** Read the entire surah's word lengths in order, with global mean μ and spread σ. A word of length ℓ draws a circular arc of length s = 10ℓ and signed turn Δ = (3π/4)tanh[(ℓ − μ)/σ]. The path begins at (0, 0), facing right; each arc continues with the preceding arc's end position and heading. A zero turn is straight. If σ = 0, the whole path is straight. The path is tangent-continuous and is not forced closed.

**Verse Lines.** Each ayah is one centered horizontal line. A verse with L retained letters spans x = −3L to +3L at y = 12(i − 1). A uniform scale fits the entire surah; relative lengths therefore remain proportional to letter counts. Subtle word-boundary marks reveal word grouping where space permits. The selected verse’s whole line is highlighted in copper. This replaces the earlier Fourier Bloom study.

The mathematical geometry is deterministic. No AI-generated artwork or external image assets are used in this gallery.
