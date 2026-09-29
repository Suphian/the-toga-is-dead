"""Fetch once, then reproduce the Quran art inputs from saved Quran.com responses.

Run with --fetch to refresh the raw responses. Without it, uses the saved files.
Only Python standard-library modules are needed.
"""

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import unicodedata
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
VERSE_URL = 'https://api.quran.com/api/v4/quran/verses/uthmani'
CHAPTER_URL = 'https://api.quran.com/api/v4/chapters?language=en'


def letters_only(token):
    return ''.join(c for c in token
                   if c not in '\u0640\u06e5\u06e6'
                   and unicodedata.category(c).startswith('L'))


def record(verse):
    words = [w for token in verse['text_uthmani'].split()
             if (w := letters_only(token))]
    lengths = [len(w) for w in words]
    count = len(lengths)
    assert count > 0, verse['verse_key']
    total = sum(lengths)
    mean = total / count
    sd = math.sqrt(sum((n - mean) ** 2 for n in lengths) / count)
    return dict(verse_number=int(verse['verse_key'].split(':')[1]),
                verse_key=verse['verse_key'], arabic=verse['text_uthmani'],
                words=words, word_lengths=lengths, word_count=count,
                letter_count=total, mean_word_length=mean, word_length_sd=sd)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch', action='store_true')
    args = parser.parse_args()
    DATA.mkdir(parents=True, exist_ok=True)
    paths = [(VERSE_URL, DATA / 'quran-uthmani-raw.json'),
             (CHAPTER_URL, DATA / 'chapters-raw.json')]
    if args.fetch:
        for url, path in paths:
            request = Request(url, headers={'User-Agent': 'Quran-Art-Studies/1.0'})
            with urlopen(request, timeout=60) as response:
                content = response.read()
            json.loads(content)  # Never overwrite a valid snapshot with an HTML error.
            path.write_bytes(content)
        (DATA / 'retrieved-at.txt').write_text(
            datetime.now(timezone.utc).isoformat() + '\n', encoding='utf-8')

    raw_verses = json.loads(paths[0][1].read_bytes())['verses']
    metadata = json.loads(paths[1][1].read_bytes())['chapters']
    assert len(metadata) == 114
    assert [v['id'] for v in metadata] == list(range(1, 115))
    assert len(raw_verses) == 6236
    grouped = {i: [] for i in range(1, 115)}
    for verse in raw_verses:
        chapter = int(verse['verse_key'].split(':')[0])
        grouped[chapter].append(record(verse))

    chapters = []
    for chapter in metadata:
        cid = chapter['id']
        verses = grouped[cid]
        assert len(verses) == chapter['verses_count'], cid
        assert [v['verse_key'] for v in verses] == [f'{cid}:{i}' for i in range(1, len(verses)+1)]
        name = chapter['name_simple']
        slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
        chapters.append(dict(id=cid, name=name, name_arabic=chapter['name_arabic'],
                             slug=slug, verses=verses))

    old_path = ROOT.parent / 'Al-Fajr' / 'data' / 'al-fajr-counts.json'
    if old_path.exists():
        assert chapters[88]['verses'] == json.loads(old_path.read_text(encoding='utf-8'))

    source = dict(
        provider='Quran.com', text='Uthmani', verses_url=VERSE_URL,
        chapters_url=CHAPTER_URL,
        retrieved_at=(DATA / 'retrieved-at.txt').read_text(encoding='utf-8').strip(),
        raw_sha256={path.name: hashlib.sha256(path.read_bytes()).hexdigest() for _, path in paths},
        counting='Split on Unicode whitespace; retain Unicode L* characters except U+0640, U+06E5 and U+06E6; drop empty words; no Unicode or spelling normalization; population standard deviation.',
        basmala='Count only the numbered verses returned by the source. This includes the basmala as 1:1 and its occurrence inside 27:30. No unnumbered opening basmala is added to other chapters.',
        note='These are measurements of the supplied Unicode transcription, not traditional letter counts, phonemes, syllables, or root analysis.',
        verse_count=len(raw_verses), chapter_count=len(chapters),
        word_count=sum(v['word_count'] for c in chapters for v in c['verses']),
        letter_count=sum(v['letter_count'] for c in chapters for v in c['verses']))
    data = dict(source=source, chapters=chapters)
    payload = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    (DATA / 'surahs.json').write_text(payload + '\n', encoding='utf-8')
    (DATA / 'surahs.js').write_text('window.QURAN_STUDIES = ' + payload + ';\n', encoding='utf-8')
    (DATA / 'method.md').write_text(
        '# Quran art: text measurements\n\n'
        f'Source: [{VERSE_URL}]({VERSE_URL}); chapter metadata: [{CHAPTER_URL}]({CHAPTER_URL}).\n\n'
        'The two `*-raw.json` files are unchanged HTTP response bodies. `retrieved-at.txt` records the retrieval time in UTC. The generated dataset includes source SHA-256 checksums.\n\n'
        '1. Split original verse text on Unicode whitespace. Attached conjunctions remain attached.\n'
        '2. Remove tatweel U+0640 and Quranic small waw/yeh U+06E5/U+06E6; retain only characters in Unicode categories beginning with L. This discards combining vowels, recitation marks and pause signs.\n'
        '3. Drop resulting empty tokens. Do not decompose Unicode or convert spelling. Shadda does not double a letter; dagger alif adds no letter.\n'
        '4. A word length is its retained letter codepoint count. For each verse compute W = number of words, L = sum of lengths, mean = L/W, and population standard deviation = sqrt(sum((length-mean)^2)/W).\n\n'
        + source['basmala'] + '\n\n' + source['note'] + '\n\n'
        'Reproduce the compact JSON and offline JavaScript dataset with `python scripts/derive_data.py`. Add `--fetch` to refresh the source snapshots. The script verifies all 114 chapter verse counts and ordering against source metadata, checks 6,236 numbered verses, and compares Al-Fajr byte-for-value with the earlier count records when available.\n',
        encoding='utf-8')
    print(json.dumps(source, indent=2, ensure_ascii=True))
    print(json.dumps({p.name: p.stat().st_size for p in DATA.iterdir() if p.is_file()}, indent=2))
    print('Basmala checks:', json.dumps({'1:1': chapters[0]['verses'][0]['words'],
                                       '27:30': chapters[26]['verses'][29]['words']}))


if __name__ == '__main__':
    main()
