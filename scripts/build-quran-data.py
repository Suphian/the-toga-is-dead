#!/usr/bin/env python3
"""Rebuild the offline Quran Art index from a checksum-pinned QAC snapshot.

Python standard library only. Run from any directory: python scripts/build-quran-data.py
The source is downloaded into memory; its records are never altered or republished
as scripture. The output is a DEM annotation index for a geometric visualization.
"""
from pathlib import Path
import hashlib
import json
import re
import urllib.request

SOURCE = 'https://raw.githubusercontent.com/bnjasim/quranic-corpus/c633959d54b4ecee2f1363777f08f1bd55d9dcda/quranic-corpus-morphology-0.4.txt'
SHA256 = 'a1d12923815341face765083805d2148ed2d9f5cc3f7d6665219d887675d8c46'
NAMES = "Al-Fatihah|Al-Baqara|Ali Imran|An-Nisa|Al-Ma’idah|Al-An’am|Al-A’raf|Al-Anfal|At-Tawbah|Yunus|Hud|Yusuf|Ar-Ra’d|Ibrahim|Al-Hijr|An-Nahl|Al-Isra|Al-Kahf|Maryam|Ta-Ha|Al-Anbiya|Al-Hajj|Al-Mu’minun|An-Nur|Al-Furqan|Ash-Shu’ara|An-Naml|Al-Qasas|Al-Ankabut|Ar-Rum|Luqman|As-Sajdah|Al-Ahzab|Saba|Fatir|Ya-Sin|As-Saffat|Sad|Az-Zumar|Ghafir|Fussilat|Ash-Shura|Az-Zukhruf|Ad-Dukhan|Al-Jathiyah|Al-Ahqaf|Muhammad|Al-Fath|Al-Hujurat|Qaf|Adh-Dhariyat|At-Tur|An-Najm|Al-Qamar|Ar-Rahman|Al-Waqi’ah|Al-Hadid|Al-Mujadila|Al-Hashr|Al-Mumtahanah|As-Saff|Al-Jumu’ah|Al-Munafiqun|At-Taghabun|At-Talaq|At-Tahrim|Al-Mulk|Al-Qalam|Al-Haqqah|Al-Ma’arij|Nuh|Al-Jinn|Al-Muzzammil|Al-Muddaththir|Al-Qiyamah|Al-Insan|Al-Mursalat|An-Naba|An-Nazi’at|Abasa|At-Takwir|Al-Infitar|Al-Mutaffifin|Al-Inshiqaq|Al-Buruj|At-Tariq|Al-A’la|Al-Ghashiyah|Al-Fajr|Al-Balad|Ash-Shams|Al-Layl|Ad-Duha|Ash-Sharh|At-Tin|Al-Alaq|Al-Qadr|Al-Bayyinah|Az-Zalzalah|Al-Adiyat|Al-Qari’ah|At-Takathur|Al-Asr|Al-Humazah|Al-Fil|Quraysh|Al-Ma’un|Al-Kawthar|Al-Kafirun|An-Nasr|Al-Masad|Al-Ikhlas|Al-Falaq|An-Nas".split('|')

def main():
    raw = urllib.request.urlopen(SOURCE, timeout=45).read()
    assert hashlib.sha256(raw).hexdigest() == SHA256, 'Source checksum changed; review before rebuilding.'
    text = raw.decode('utf-8-sig')
    notice, records = text.split('LOCATION\tFORM\tTAG\tFEATURES', 1)
    chapters = [{'id': i+1, 'name': n, 'verses': 0, 'tokens': []} for i, n in enumerate(NAMES)]
    verse_words = {}
    rows = []
    for line in records.splitlines():
        if not line.strip():
            continue
        location, form, tag, features = line.split('\t')
        s, v, w, segment = map(int, re.fullmatch(r'\((\d+):(\d+):(\d+):(\d+)\)', location).groups())
        chapters[s-1]['verses'] = max(chapters[s-1]['verses'], v)
        verse_words[s, v] = max(verse_words.get((s, v), 0), w)
        if tag == 'DEM':
            rows.append((s, v, w, segment, form, features))
    for s, v, w, segment, form, features in rows:
        lemma = next(f[4:] for f in features.split('|') if f.startswith('LEM:'))
        chapters[s-1]['tokens'].append({'verse': v, 'word': w, 'segment': segment,
            'form': form, 'lemma': lemma, 'features': features, 'verseWords': verse_words[s,v]})
    assert len(rows) == 1059 and len(chapters) == 114
    assert sum(c['verses'] for c in chapters) == 6236
    assert chapters[0]['tokens'] == []
    assert chapters[1]['tokens'][0]['verse'] == 2 and chapters[1]['tokens'][0]['word'] == 1
    target = Path(__file__).resolve().parents[1] / 'projects' / 'quran-art' / 'previous-web-edition'
    target.mkdir(parents=True, exist_ok=True)
    result = {'version': 1, 'source': SOURCE, 'sourceSha256': SHA256,
        'sourceName': 'Quranic Arabic Corpus, morphology v0.4',
        'copyrightNotice': notice.strip(), 'totalDemonstratives': len(rows), 'chapters': chapters}
    (target / 'data.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
    (target / 'SOURCE_NOTICE.txt').write_text(notice.strip()+'\n\nSnapshot: '+SOURCE+'\nSHA-256: '+SHA256+'\n', encoding='utf-8')
    print(f'Built {len(chapters)} chapters, {len(rows)} DEM records, 6,236 verses; verified checksum and locations.')

if __name__ == '__main__':
    main()
