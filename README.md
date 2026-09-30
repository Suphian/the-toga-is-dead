# Suph.app

A minimal project gallery at [suph.app](https://suph.app), with three black-and-white dither cards rendered from real, muted video. The homepage contains only the wordmark and project names. Playback respects reduced motion and pauses in hidden tabs. Video sources and licenses are recorded in [SOURCES.md](site/assets/projects/SOURCES.md).

- **[The Toga Is Dead](https://suph.app/Toga)**: the existing browser game, now at `/Toga`.
- **[Quran Art](https://suph.app/quran)**: three arrangements of one rule (a letter is a unit of line, a word boundary is a break) for each of the 114 surahs, with a visual gallery, linked verse highlighting, explanations, and SVG downloads. See [its sources and method](projects/quran-art/README.md).
- **Coming soon**: a looping film of ink blooming in water.

Old root invitations with `?room=` and theme links still open Toga with their query and fragment intact. Game modules remain at their original root paths, and same-origin saved games keep their existing storage keys.

## The Toga Is Dead

A desktop-first 3D browser succession game for 2–4 players, with solo practice, same-screen play, and online invitations. Choose the medieval coastal kingdom or the Roman empire. Two and three players compete individually; four players form teams: seats 1 + 3 versus seats 2 + 4. The GitHub repository is `Suphian/the-toga-is-dead`; the Vercel hosting project remains `ceoisdead`.

This independent prototype implements the standard mechanics described in [RULES.md](RULES.md), with original interface, architecture, illustrations, and procedural audio. The coastal board includes miniature landmarks, villages, forests, docks, boats, moving water, faction pieces, and move animations. Morning, golden-hour, and moonlight settings change the atmosphere locally.

The [standard-rule audit](docs/RULES-AUDIT.md) maps setup, cards, borders, turns, and scoring to the official publisher rulebook and regression tests, and records the prototype's remaining edge-case conventions.

**Play: [suph.app/Toga](https://suph.app/Toga)**, also [ceoisdead.vercel.app/Toga](https://ceoisdead.vercel.app/Toga). Choose **Invite your friends** in the welcome menu, or **New game → Invite friends**, select 2, 3, or 4 players, and create the table. Send the same invitation link to everyone. Guests need no Vercel or ChatGPT account. Each guest takes a seat and can choose their name and character; when everyone has joined, the host selects **Start game with everyone**. The plain domain opens the project gallery.

The five-chapter **Field guide** explains play and includes a pass demonstration that leaves the match unchanged. **Read aloud** uses the browser/device speech service when available. The four illustrated contenders are decorative identities with no special powers. Music is an original 72-second Web Audio arrangement; it defaults off, starts only after interaction, and pauses in hidden tabs. Sound, volume, and atmosphere preferences stay on the current device.

**Your turn** opens a clear turn announcement. A persistent identity badge marks your own seat, and the right-hand tips follow card selection, confirmation, and mandatory recruitment. The board displays the next region and consecutive passes needed to settle it; resolved regions are visibly locked. Opponent cards animate onto the table, and the most recently played card remains visible. Tips can be hidden without changing the match. The dice tray has been removed. A DOM board remains available when WebGL is unavailable.

**My games** lists open, closed, and completed tables saved in this browser. **Save & leave table** pauses your session; **Resume** restores it. Online games need the host and all players to return. Clearing browser data removes these saves; there is no account-based cross-device library.

## Run locally

Install [Node.js 24 or newer](https://nodejs.org/), then:

```sh
git clone https://github.com/Suphian/the-toga-is-dead.git
cd the-toga-is-dead
npm run dev
```

Open **http://127.0.0.1:3000** for the gallery, **/Toga** for the game, and **/quran** for Quran Art. The static site needs no npm installation or build step. Fonts and three.js are self-hosted; only PeerJS (from esm.sh, for online rooms) and the PostHog proxy are external. Refresh after editing files.

`npm test` runs the dependency-free engine, room transport, and audio lifecycle tests. The development server uses Node built-ins and serves only `site/`.

## Work with a friend

1. The repository owner adds the friend's GitHub account under **Settings → Collaborators → Add people**.
2. Each person clones the repository and opens it in Codex or an editor using their own account.
3. Start one focused feature from updated `main`:

   ```sh
   git switch main
   git pull --ff-only
   git switch -c feature/my-change
   ```

4. Make the change, run `npm test`, and check it in the browser.
5. Stage the paths you changed, commit a working milestone, and push the branch:

   ```sh
   git add site
   git commit -m "Add my feature"
   git push -u origin feature/my-change
   ```

   Stage tests, scripts, or documentation explicitly when they are part of the change.
6. Open a pull request, review each other's work, and merge when the relevant checks pass. Start the next feature from updated `main`.

Agree on module ownership before editing together. Scene props, guide improvements, illustrations, audio, and transport work can proceed independently. A useful Codex prompt is:

> Read README.md, AGENTS.md, and RULES.md. Implement [one feature] on my current branch. Keep rules separate from presentation, add a meaningful regression test if behavior changes, run the relevant checks, and commit working milestones.

Sharing a ChatGPT conversation provides context; GitHub branches and pull requests carry the code.

## Edit and play together live

Both collaborators can use VS Code Live Share. The host opens the project, runs `npm run dev`, starts a Live Share session, and shares its invitation. Choose **Share server**, enter **3000**, and let the friend open it under **Shared Servers**. Both can edit the shared files and refresh their browsers while the host stays online.

For local-network testing, set `HOST=0.0.0.0` and optionally `PORT` before starting the server. The default binds to your own computer; Live Share works with that default.

## Deployment and online rooms

The Vercel project is **ceoisdead** in team **suph**, with production domain **suph.app**. `vercel.json` publishes `site/` without install or build commands. Git integration supplies production updates from `main` and branch previews for reviewing changes. The Netlify configuration remains as an alternative static-host setup.

Rooms use PeerJS/WebRTC. Up to three guests connect to the host, which validates seat ownership, state revision, and legal moves before broadcasting updates. Seats freeze when the match starts; any disconnect pauses everyone. Guests can refresh or resume from **My games**. Their private seat token is stored with the game on this browser and is never included in the shared link or public lobby.

Host snapshots preserve the game, original invitation ID, player choices, and reserved seats. The host can close the tab and reopen that table from **My games**; guests then reconnect with their saved seats. The table pauses while anyone is absent. An already-open host tab must be closed before the same table can be hosted again. These casual rooms have no account authentication or server persistence, and some networks block direct connections. Same-screen and practice modes remain available. Existing local corporate-themed saves restore with medieval presentation while retaining players, moves, and turn order.

## Project map

suph.app sends product analytics and error tracking to PostHog through the same-origin `/ingest` proxy; it sets no cookies beyond PostHog's own and only loads on the production host.

- `site/index.html`, `site/projects/`: minimal gallery and video dither renderer.
- `site/projects/ph.js`: PostHog loader and `suphTrack`; host-gated to suph.app, `api_host: '/ingest'`, with autocapture, heatmaps, dead clicks, surveys and session recording pinned off in `posthog.init`. Toga room ids are kept out in two layers: the SDK masks `room` and `theme` query values as `<masked>` (`mask_personal_data_properties` + `custom_personal_data_properties`; this covers `$current_url`, the nested web-vitals URLs and heatmap keys, and also masks ad click ids such as `gclid`), then `before_send` walks the whole event (nested objects and arrays, 8 levels) and removes the `room` and `theme` parameters from every URL on suph.app, from every `*url*`/`*referrer*` property, and from URL-shaped object keys. Other query parameters are kept.
- `site/fonts/`, `site/vendor/three/`: self-hosted web fonts and the three.js build.
- `site/Toga/index.html`: game metadata, styles, and pinned browser imports.
- `site/quran/` and `site/surah/`: Quran Art gallery, named surah pages, and artwork exports.
- `site/app.js`: game interface, saves, turn orchestration, and room integration.
- `site/presentation.js`: medieval/Roman labels, contender identities, and original SVG emblems.
- `site/experience.js`: welcome menu, five-chapter guide, device read-aloud, sound controls, and atmosphere settings.
- `site/audio.js`: original procedural music and SFX; no downloaded audio assets.
- `site/styles.css`, `site/kingdom.css`: responsive interface and historical presentation.
- `site/scene.js`, `site/world.js`, `site/landmarks.js`: scene entry point, coastal board, and original procedural architecture.
- `site/guidance.js`: pure next-step instructions derived from the real game state.
- `site/turn-feedback.js`: turn modals, opponent card animation, and persistent last action.
- `site/game-library.js`: validated same-browser archives and private room resume records.
- `site/assets/`: generated portraits, menu panorama, social cover, prompts, and retained legacy models; see [asset provenance](site/assets/README.md).
- `site/room.js`: peer transport, assigned seats, lobby, and private reconnect tokens.
- `site/game/engine.js`: deterministic rules, serialization, and practice AI.
- `test/`: engine, transport, and audio lifecycle tests.
- `scripts/serve.mjs`: local static server.
- `scripts/browser-smoke.mjs`: gameplay, responsive layout, and network checks.
- `scripts/browser-experience.mjs`: menu, guide, sound controls, themes, atmosphere, and legacy-save checks.
- `scripts/browser-multiplayer.mjs`: larger tables, lobbies, turn authority, and guest refresh reconnection.
- `scripts/browser-guidance.mjs`: turn modals, personal identity, card/recruitment instructions, and last-card feedback in two real browsers.
- `scripts/browser-library.mjs`: multiple saves, archive/reopen, completed review, and real host/guest fresh-tab recovery.

CI checks JavaScript syntax, runs Node tests, and runs the browser verification scripts with pinned Playwright. Screenshots and reports are retained in the `browser-results` artifact. Reports distinguish completed real-network checks from unavailable signaling/network services. See [AGENTS.md](AGENTS.md) for local browser-test commands.

## Quran Art

The Quran gallery lives at `/quran`, with a page for each surah at `/surah/{name}` (for example `/surah/al-fajr`). Each page compares Rays, Rows, and Spiral, three arrangements of one rule: a letter is a unit of line and a word boundary is a break. Verse highlighting is linked across the three, the mathematics stays visible, and every artwork downloads as SVG. All 114 surahs and 342 artworks are included.

Source, provenance, and regeneration instructions are in [`projects/quran-art/README.md`](projects/quran-art/README.md). Public output is isolated in `site/quran/` and `site/surah/`; the Toga game is unchanged.
