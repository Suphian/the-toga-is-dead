# Quran Art: web edition

This is a static, offline-data adaptation of Suphian's [Quran Art](https://github.com/Suphian/quran-art) experiment. The original code expects dependency-head data that is not present in that repository. This edition uses actual **demonstrative morphology and verse positions**, not invented dependency relationships.

## Data

The bundled `data.json` contains all 1,059 `DEM`-tagged morphological segments from the Quranic Arabic Corpus morphology v0.4, grouped into all 114 chapters. The source corpus identifies `DEM` as demonstrative pronouns: this, that, these, those. Chapter verse counts are computed from the same complete dataset. Chapter names are conventional English transliterations used for navigation.

- Primary documentation: https://corpus.quran.com/documentation/tagset.jsp
- Primary source/download terms: https://corpus.quran.com/download/
- Pinned verbatim source mirror: https://raw.githubusercontent.com/bnjasim/quranic-corpus/c633959d54b4ecee2f1363777f08f1bd55d9dcda/quranic-corpus-morphology-0.4.txt
- SHA-256: `a1d12923815341face765083805d2148ed2d9f5cc3f7d6665219d887675d8c46`
- Original copyright and license notices: [SOURCE_NOTICE.txt](SOURCE_NOTICE.txt)

Annotation: © 2011 Kais Dukes, GNU General Public License with the published corpus terms. Underlying text: © 2008–2009 Tanzil.info, CC BY-ND 3.0, with the original terms retained. Corpus forms and feature strings in the index are copied unchanged. Forms shown in the interface use the source's Buckwalter transliteration. These are annotation excerpts, not a replacement Quran text.

## Drawing rules

Tokens are processed in numeric chapter, verse, word, segment order. Start at (0,0), facing upward. Add the following angle based on each token's exact corpus lemma, then draw one segment. Angles are artistic encoding decisions, not statements about linguistic meaning.

| Corpus lemma (Buckwalter) | Turn |
| --- | ---: |
| ha`*aA | −60° |
| *a`lik | +60° |
| >uwla`^}ik | +120° |
| *aA | −30° |
| hunaA | 0° |
| tilokum | +90° |
| ha`*a`n | −90° |
| >uwlaA^' | −120° |
| ha`ka*aA | +30° |
| ha`tayon | −90° |
| *a`nik | +90° |

Segment length = `1 + word position / words in that verse + min(verse gap, 12) / 12`. The first occurrence has a gap of zero. Scale the entire composition uniformly to fit the drawing. No randomness is used. Stroke thickness is constant. Red highlights the inspected segment and its endpoint. A chapter with zero demonstratives intentionally has no line.

The export contains the complete drawing and source metadata, including original copyright notices. The timeline and corpus link make each segment inspectable. These drawings are visual interpretations of annotations; they do not interpret the Quran's meaning.

## Rebuild

From the repository root, with Python 3 and internet access:

    python scripts/build-quran-data.py

The standard-library-only builder fetches the pinned snapshot, verifies its SHA-256, checks the 1,059 records, 114 chapters and 6,236 verse total, and writes the compact index and original notices. No build, Python, or external API is required in production. The UI uses `/Quran/data.json` from the same deployment. Google Fonts enhance typography; local system font fallbacks work without that service.
