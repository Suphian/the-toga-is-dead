# Homepage footage

These licensed clips illustrate each project through real video rendered as dither.
They are not recordings of the projects. The Toga clip depicts a sculpture, without a betrayal scene.

## Toga
- Creator: The Instagrapher
- Clip: Close Up of a Sculpture
- Source: https://www.pexels.com/video/close-up-of-a-sculpture-7534448/
- Original file: https://videos.pexels.com/video-files/7534448/7534448-hd_1920_1080_24fps.mp4
- Local browser asset: `assets/projects/toga.mp4`
- Actual content: filmed tracking shot of a Roman stone head, without a stabbing action.

## Quran Art
- Creator: Almas
- Clip: Close-Up on Scrolling Quran Pages
- Source: https://www.pexels.com/video/close-up-on-scrolling-quran-pages-10662285/
- Original file: https://videos.pexels.com/video-files/10662285/10662285-hd_3840_2160_30fps.mp4
- Local browser asset: `assets/projects/quran.mp4`
- Actual content: live-action close-up of Quran pages turning.

## Coming soon
- Creator: Aferali
- Clip: Black Ink Swirling in Water
- Source: https://www.pexels.com/video/black-ink-swirling-in-water-6577871/
- Original file: https://videos.pexels.com/video-files/6577871/6577871-hd_1920_1080_24fps.mp4
- Local browser asset: `assets/projects/coming.mp4`
- Actual content: filmed black ink blooming and swirling in water against a plain light background.
- Processing: seconds 3–11, centered square crop, 720 × 720 pixels, grayscale, 24 fps, followed by the reversed frames. Duplicate turnaround endpoints are removed to create a continuous 15.917-second forward/reverse loop. Silent H.264 with fast-start metadata; 956,610 bytes. The downloaded source decodes as 1280 × 720 despite the resolution in its original filename.

All clips are used under the Pexels license, which permits free website use and modification: https://www.pexels.com/license/

The Toga and Quran Art browser copies are silent H.264, at most 9 seconds, 960 pixels wide and 24 fps. The card renderer applies black-and-white ordered dithering at runtime, with occasional sparse red accents.

## Delivery encodes

The browser assets `toga`, `quran` and `coming` (`.mp4` H.264 and `.webm` VP9) are grayscale, audio-free re-encodes of the processed originals kept in `assets-src/projects/`, at the same resolution and 24 fps. Regenerate with `python scripts/optimize-media.py videos`. The dither reads luminance only, so dropping chroma does not change the rendered cards.
