# Quran art: text measurements

Source: [https://api.quran.com/api/v4/quran/verses/uthmani](https://api.quran.com/api/v4/quran/verses/uthmani); chapter metadata: [https://api.quran.com/api/v4/chapters?language=en](https://api.quran.com/api/v4/chapters?language=en).

The two `*-raw.json` files are unchanged HTTP response bodies. `retrieved-at.txt` records the retrieval time in UTC. The generated dataset includes source SHA-256 checksums.

1. Split original verse text on Unicode whitespace. Attached conjunctions remain attached.
2. Remove tatweel U+0640 and Quranic small waw/yeh U+06E5/U+06E6; retain only characters in Unicode categories beginning with L. This discards combining vowels, recitation marks and pause signs.
3. Drop resulting empty tokens. Do not decompose Unicode or convert spelling. Shadda does not double a letter; dagger alif adds no letter.
4. A word length is its retained letter codepoint count. For each verse compute W = number of words, L = sum of lengths, mean = L/W, and population standard deviation = sqrt(sum((length-mean)^2)/W).

Count only the numbered verses returned by the source. This includes the basmala as 1:1 and its occurrence inside 27:30. No unnumbered opening basmala is added to other chapters.

These are measurements of the supplied Unicode transcription, not traditional letter counts, phonemes, syllables, or root analysis.

Reproduce the compact JSON and offline JavaScript dataset with `python scripts/derive_data.py`. Add `--fetch` to refresh the source snapshots. The script verifies all 114 chapter verse counts and ordering against source metadata, checks 6,236 numbered verses, and compares Al-Fajr byte-for-value with the earlier count records when available.
