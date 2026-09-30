'use strict';
// Crawl and entity layer for the generated Quran pages: canonical URL, per-page
// description, Open Graph/Twitter, icon links and JSON-LD, plus the <picture>
// wrapper and lossless WebP copies of the PNG thumbnails. Metadata only: nothing
// here adds visible copy, and the WebP files are pixel-identical to the PNGs.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ORIGIN = 'https://suph.app';
const PERSON_ID = 'https://suphian.com/#person';
const WEBSITE_ID = `${ORIGIN}/#website`;
const COLLECTION_URL = `${ORIGIN}/quran`;
const COLLECTION_NAME = 'Quran Art';

const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeJSON = data => JSON.stringify(data).replace(/</g, '\\u003c');
const absolute = pathname => ORIGIN + pathname;
// One canonical form: the gallery has no trailing slash, surah pages always do.
const surahUrl = slug => `${ORIGIN}/surah/${slug}/`;

const data = file => JSON.parse(fs.readFileSync(path.join(__dirname, '../data', file), 'utf8'));
const {source} = data('surahs.json');
// The compact dataset has no revelation place; the saved Quran.com chapter metadata does.
const places = new Map(data('chapters-raw.json').chapters.map(chapter => [chapter.id, chapter.revelation_place]));
const PLACE_NAMES = {makkah: 'Makkah', madinah: 'Madinah'};
const revelationPlace = id => {
  const name = PLACE_NAMES[places.get(id)];
  if (!name) throw new Error(`No revelation place for surah ${id}`);
  return name;
};

// Data fields (name, Arabic name, number, verse count, revelation place) followed by
// the page's own subtitle; no new prose.
const surahDescription = (c, tagline, total) =>
  `${c.name} (${c.name_arabic}), surah ${c.id} of ${total}: ${c.verses.length} verses, revealed in ${revelationPlace(c.id)}. ${tagline}`;

const person = {'@type':'Person', '@id':PERSON_ID, name:'Suphian Tweel', url:'https://suphian.com/'};
const website = {'@type':'WebSite', '@id':WEBSITE_ID, url:`${ORIGIN}/`, name:'Suph.app', author:{'@id':PERSON_ID}};
const quranSource = {'@type':'CreativeWork', name:`${source.provider} ${source.text} transcription`, url:source.verses_url, publisher:{'@type':'Organization', name:source.provider, url:'https://quran.com/'}};

const collectionGraph = ({description, image, chapters}) => [website, person, {
  '@type':'CollectionPage', '@id':COLLECTION_URL, url:COLLECTION_URL, name:COLLECTION_NAME, description,
  inLanguage:'en', image, author:{'@id':PERSON_ID}, isPartOf:{'@id':WEBSITE_ID}, isBasedOn:quranSource,
  mainEntity:{'@type':'ItemList', numberOfItems:chapters.length,
    itemListElement:chapters.map((c, index) => ({'@type':'ListItem', position:index + 1, url:surahUrl(c.slug), name:c.name}))},
}];

const artworkGraph = ({c, name, description, images, dateCreated}) => [website, person, {
  '@type':'VisualArtwork', '@id':`${surahUrl(c.slug)}#artwork`, url:surahUrl(c.slug), name, description,
  image:images, creator:{'@id':PERSON_ID}, dateCreated,
  isPartOf:{'@type':'CollectionPage', '@id':COLLECTION_URL, url:COLLECTION_URL, name:COLLECTION_NAME},
  isBasedOn:quranSource,
  about:{'@type':'Chapter', name:c.name, alternateName:c.name_arabic, position:c.id, isPartOf:{'@type':'Book', name:'Quran', inLanguage:'ar'}},
}];

const ICONS = '<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">';

// Everything a generated <head> carries after <title>. `image` is a PNG thumbnail.
const tags = ({title, description, canonical, image, graph}) => [
  `<meta name="description" content="${esc(description)}">`,
  '<meta name="author" content="Suphian Tweel">',
  `<link rel="canonical" href="${esc(canonical)}">`,
  ICONS,
  '<link rel="author" href="/humans.txt">',
  '<meta property="og:type" content="website">',
  `<meta property="og:site_name" content="${COLLECTION_NAME}">`,
  '<meta property="og:locale" content="en_US">',
  `<meta property="og:title" content="${esc(title)}">`,
  `<meta property="og:description" content="${esc(description)}">`,
  `<meta property="og:url" content="${esc(canonical)}">`,
  `<meta property="og:image" content="${esc(image.url)}">`,
  '<meta property="og:image:type" content="image/png">',
  `<meta property="og:image:width" content="${image.width}">`,
  `<meta property="og:image:height" content="${image.height}">`,
  `<meta property="og:image:alt" content="${esc(image.alt)}">`,
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:creator" content="@suphian">',
  `<meta name="twitter:title" content="${esc(title)}">`,
  `<meta name="twitter:description" content="${esc(description)}">`,
  `<meta name="twitter:image" content="${esc(image.url)}">`,
  `<meta name="twitter:image:alt" content="${esc(image.alt)}">`,
  `<script type="application/ld+json">${safeJSON({'@context':'https://schema.org', '@graph':graph})}</script>`,
].join('');

// display:contents keeps the <img> as the layout child, so existing CSS applies unchanged.
const picture = (stem, imgAttributes) =>
  `<picture style="display:contents"><source type="image/webp" srcset="${stem}.webp"><img src="${stem}.png" ${imgAttributes}></picture>`;

// Lossless WebP: pixel-identical to the PNG thumbnail, roughly a third of its size.
const writeWebp = (png, file) => sharp(png).webp({lossless:true, effort:4}).toFile(file);

module.exports = {ORIGIN, PERSON_ID, WEBSITE_ID, COLLECTION_URL, absolute, surahUrl, surahDescription, collectionGraph, artworkGraph, tags, picture, writeWebp};
