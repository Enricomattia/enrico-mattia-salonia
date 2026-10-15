# Πathos — Project handoff for Codex

_Last checked against the GitHub repository: 15 October 2026._

## 1. What Πathos is

**Πathos** is a personal cultural diary/archive for experiences with **books, films, television, theatre, videogames, albums, concerts, exhibitions, podcasts, opera and other media**. Its purpose is to remember *what* was experienced, *when*, *how it was judged*, and *why it mattered*: dates, ratings, reviews, favourite works, quotations/passages, editions and contextual notes. It is not intended to be an attention-driven social network.

Its author had previously tracked books in **The StoryGraph** and films in **Letterboxd**; Πathos was created to unify these records and cover media those services handle poorly. It started as a single local HTML app, then evolved into an online owner archive and a separate, installable, offline-first app other people can use.

The branding is **Πathos**, with an uppercase Greek Pi. Keep the UI understated, personal, quick to use, and visually consistent with the existing site. The user has repeatedly preferred **removing unnecessary interface copy and decoration** over adding more.

## 2. Two distinct applications — already published

| | Owner's hosted Πathos | Πathos Personal |
| --- | --- | --- |
| Live entry point | <https://enricomattiasalonia.com/pathos> | <https://enricomattiasalonia.com/pathos-personal/> |
| Purpose | The owner's personal archive, viewable by friends | Anybody's independent cultural diary |
| Storage | Supabase (cloud) | IndexedDB on the local device/browser profile |
| Account | Owner signs in to edit | **No account** |
| Public access | Visitors can read only published entries | Not shared/published; local to the device |
| Installation | Ordinary website | PWA manifest, installable standalone window |
| Offline | Do not assume offline editing/sync | Offline app shell; locally saved records |
| Updates | Site deploy | Service-worker update banner and app reload |

Both applications are in the **same GitHub repository** alongside the owner's personal website. They are separate entry points and **must not be combined accidentally**. In particular, never populate Πathos Personal with the owner's archive. Local data is scoped to a web origin/browser profile and storage key, **not globally synchronized**. Installing on another device starts with another local archive. Preview deployments and the production domain also have different browser storage.

`/pathos` and `/pathos-personal/` were deliberately left **unlinked from the main website navigation**. The Next.js routes use `noindex` metadata; the hosted app HTML also has `noindex` directives. This makes the routes unlisted, **not access-controlled**: the owner wants to be able to give a direct link to friends.

## 3. Architecture and exact file map

Repository: <https://github.com/Enricomattia/enrico-mattia-salonia>

The surrounding site uses **Next.js 16**, React, TypeScript, and Netlify. Πathos itself is currently built largely as **single-file, browser-side HTML/CSS/JavaScript applications**, not a reusable React component library.

```text
src/app/pathos/page.tsx                   # /pathos; iframe /pathos/app.html
public/pathos/app.html                    # owner's interface
public/pathos/config.js                   # public Supabase config, no private keys
public/pathos/sync.js                     # Supabase auth, reads, owner saves
src/app/api/pathos/page-images/route.ts   # same-origin online image suggestions
src/lib/pathos-page-images.ts            # bounded public-page fetch and image extraction
src/app/api/pathos/catalogue/route.ts      # authenticated owner-only catalogue/check API
src/lib/pathos-catalogue.ts               # owner verification, bounded public metadata
public/pathos/discover.js, discover.css  # hosted owner search/preview and match panel
public/pathos/match-engine.mjs            # local matching and evidence assembly
public/pathos/match-worker.js             # on-device multilingual embeddings

src/app/pathos-personal/page.tsx          # /pathos-personal -> /pathos-personal/index.html
public/pathos-personal/index.html         # interface + local-first storage
public/pathos-personal/manifest.webmanifest
public/pathos-personal/sw.js              # install, cache, update handling
public/pathos-personal/icon-192.png
public/pathos-personal/icon-512.png
```

Current layout notes:

- Owner route uses a same-origin `iframe` occupying the full dynamic viewport (`100dvh`). The academic-site header is hidden only on `/pathos`; the site's other pages retain their header and navigation. The Πathos header remains inside its app.
- Hosted `sync.js` uses the Supabase JS browser client and a public `PATHOS_CONFIG`. Check the actual auth and save flow before any changes.
- The personal app opens the IndexedDB database `pathos-personal`, stores the archive in an `archives` object store under the key `personal`, and maintains an in-memory copy while queuing writes. **Do not rename or clear this storage without a tested migration.** The source includes a `schemaVersion` field for the archive.
- The PWA manifest uses `display: standalone`. The personal service worker caches the offline app shell and eligible remote cover images; remote metadata requests are still network-dependent.
- Both interfaces share conceptual functionality, but are presently **separate copies of the UI code**. A future shared-core refactor has been discussed but not undertaken.

Release changes in PR #6 (`codex/pathos-reliability`):

- Personal keeps the same IndexedDB version, store and `personal` archive key. Each save compares the stored archive with the last successful read/write **inside the same read/write transaction**. A stale window cannot overwrite newer records; its in-memory changes remain exportable. Export those changes and reload to resume editing against the current archive. An older app window without this check must be closed/reloaded after updating.
- JSON restore validates the supported schema version, unique work/experience IDs, work references, text fields, edition fields and passages before migrating a clone. It asks before replacement. Personal atomically stores the previous archive at `archives['before-restore']` with the replacement. **Undo last restore** survives reload and swaps archives with confirmation. Only the most recent pre-restore copy is retained; it is device-local and does not replace external backups. A failed restore transaction preserves both the current archive and the previous recovery copy.
- Hosted restore downloads a recovery JSON file and requires confirmation before replacing the online archive, including publication settings. Keep the downloaded file. Recovery is not silently persisted as a private archive in browser storage.
- Hosted saves use a fresh owner-session check, an archive comparison against the latest cloud read, and a same-origin Web Lock where available. This rejects previously saved changes from other windows/devices, but **is not an atomic cross-device conditional write**. A simultaneous save on another device (or from an old client) can still race the preflight read; resolving that needs a separately reviewed server-side revision check.
- Automatic ISBN enrichment fills missing edition fields and preserves recorded metadata, identifiers and uploaded/manual covers. Editing an edition also preserves its contributors.
- Save errors remain visible and block Personal updates; a later successful write clears the failure. Personal refuses updates/restores while an entry dialog, import or metadata operation is open/running, and prevents new edits while preparing an update. Unsaved form entries are not auto-saved.
- The service worker uses shell cache `pathos-personal-shell-v10` and looks up shell assets in its own versioned cache, so a waiting release's cache cannot be served prematurely. Cover-cache behavior and the standalone manifest are unchanged. Preview v4/v5 provided the real reliability update-cycle check; v6 stages interface simplifications and v7 adds official-page image suggestions. Release v8 adds winding timelines, mobile layout improvements and Current above the Home timeline. The v9 follow-up makes both timelines vertical and nearly full-width on phones (600px and narrower), retaining winding rows on larger screens. Release v10 adds viewing language and publication series and promotes Timeline into the primary navigation.

## 4. What the user wants the experience to feel like

### Core areas

- **Home:** the latest **12 dated experiences** use a single vertical list on phones (600px and narrower), with cards filling nearly all available content width and no sideways scrolling. Larger screens retain a winding, three-column timeline: the first row reads left to right, the next right to left, joined by rounded turns. Scroll vertically through the rows and pan horizontally when the canvas exceeds the screen, using touch, trackpad or arrow buttons. Vertical wheel scrolling stays vertical; this replaces the previous wheel-to-horizontal behavior at the user's request. DOM, keyboard and screen-reader order remain chronological, newest first. **Current appears above the timeline** when there are in-progress experiences, and stays hidden when there are none. There is no Recent reviews section. Empty timelines have no decorative line.
- **Library:** all works, filters by media/status and other useful criteria, simple manual addition and editing.
- **Timeline:** replaces the redundant Reviews primary page. Shows all dated, non-planned experiences with the existing responsive timeline. Reviews remain on their individual experiences, in work details, Library search and exports; removing the review browser does not delete any writing.
- **Insights:** statistics and charts that are **interactive**. Clicking a distribution bar, e.g. a rating, should reveal the corresponding experiences. Avoid explanatory filler text that was intentionally removed.
- **More:** secondary features: **Passages**, metadata and covers, import and backups. Passages retains its existing search, media/year/featured filters and sorting in its own secondary page. The primary Timeline uses the same responsive layout as Home (vertical on phones, winding rows on larger screens) across the content width. Both timelines retain cover/poster images on desktop and mobile, preferring each experience's exact edition cover. Each card has its own date; the full Timeline no longer groups records in a narrow monthly list.

On phones, all four primary pages remain visible in a sticky navigation row; More opens the same secondary menu as desktop. Phone timelines scroll vertically, hide horizontal arrows/direction marks and keep covers visible. Only larger-screen timeline canvases may pan sideways; the whole page must fit the screen. Library uses two columns; filters and single-column entry forms fit narrow screens, inputs use 16px text to avoid automatic iOS zoom, and actions have larger touch targets. Personal still hides ready-status and Install controls in standalone mode while showing save errors. These are presentation changes: no storage, edition, publication or authentication behavior changes.

Work details show each experience's review once, with no duplicate Latest review summary or experience/review count chips. A single experience is the standard display; repeat experiences retain their separate dates, editions and reviews. A discreet Log again action still opens the repeat-experience form. Library cards show an experience count only when there is more than one.

### Owner-only discovery and free local matching

The signed-in hosted owner has a **Find a work** action. Search books (Open Library) or films (TMDB), open a preview without adding anything, then optionally open **Add to Planned** or **Log experience**. Only the existing form's Save writes records. Book previews are work-level: their generic covers never fill an exact-edition cover. Logging opens the existing edition picker with the edition unselected. Existing works retain their recorded editions. Current remains above the Home timeline; public navigation and Personal are unchanged.

`/api/pathos/catalogue` requires a bearer access token, verifies it through Supabase Auth's `/auth/v1/user` and compares the returned user ID to the fixed owner. The three public configuration identifiers match `public/pathos/config.js`; a test detects drift. Browser flags and publishable keys do not authorize calls. Cross-site requests are rejected. Searches and details fetch fixed Open Library/TMDB endpoints with bounded bodies/timeouts, no redirects and a two-lookup concurrency cap. Auth tokens go only to Supabase. The existing device-local TMDB read token is sent in `X-Pathos-TMDB` and forwarded only to TMDB; optionally configure `PATHOS_TMDB_TOKEN` on the server. No OpenAI key or paid AI endpoint is used. Film search still needs that free non-commercial TMDB token; missing setup is explained in the UI. No database/RLS/schema changes.

The owner explicitly requested **free** matching, so the initial OpenAI API proposal was replaced with a local content-based recommender. Enabling matching downloads the pinned Transformers.js 3.8.1 runtime and `Xenova/paraphrase-multilingual-MiniLM-L12-v2` q8 weights, revision `2c4055b12046f11709e9df2c122e59ffbdc2f900` (about 118 MB weights, plus tokenizer/runtime). Model assets may be browser-cached. Inference runs in a Web Worker, without sending history to an AI service or incurring AI API charges. Searches still disclose the search query to their catalogue providers. Existing hosting/catalogue quotas remain applicable.

Every eligible non-planned past experience contributes a local representation using metadata, tags and a bounded review excerpt. Target-work experiences are excluded to avoid scoring a book against its own review. Review excerpts are chunked for the small encoder context; all eligible experiences are considered, while very long reviews are truncated. Cosine/subject/creator similarity identifies related works across media, then explicit ratings relative to the owner's average inform fit. Favourites have a small weight boost; repeat experiences are preserved with reduced per-work influence. Unrated reviews can establish similarity, but are not guessed to be likes/dislikes. The evidence panel shows actual titles, ratings, shared catalogue subjects and review excerpts, including relevant negative evidence. It uses templates rather than generated literary analysis.

Every completed match also prints a short explanation: how the comparable ratings relate to the owner's average, which recorded works support the connection, their actual ratings, shared catalogue subjects and/or creator, plus specific reasons for limited confidence (small rated history, few distinct comparisons or a short/missing description). Evidence cards for rated works come from the same nearest comparisons used in the verdict; unrated connections can fill remaining cards and are labelled **unrated**, without assigning them a like/dislike. One or two rated experiences no longer block matching: the panel explains tentative connections while retaining **Not enough evidence**. With no eligible history it explains the absence of evidence immediately, without downloading the model. The paragraph is assembled locally from those facts; it is not an LLM interpretation of the work or review. Scoring thresholds, privacy and paid-service behavior are unchanged.

**Strong / mixed / weaker match** and **Low / Moderate confidence** are experimental estimates, not calibrated probabilities. Sparse metadata or history produces Not enough evidence. Synthetic positive/negative tests establish functioning, not predictive accuracy on the owner's tastes; held-out-history evaluation and user feedback should precede stronger accuracy claims. The model can be slow or unavailable on some browsers/devices, and failures stay visible. Private embeddings/texts live only in worker memory (bounded session cache); sign-out hides/closes discovery, aborts lookups, clears results and terminates the worker. No private match cache is persisted. All server catalogue calls, including the pre-inference owner check, enforce owner access independently of UI visibility.

### Experience model

- Distinguish a **work** from an **experience of a work**. Re-readings/re-watches can have different dates, ratings, reviews and, for books, editions.
- Media categories include books, film, TV, theatre, videogames, albums, concerts, exhibitions, podcasts, opera and other categories supported by the existing code.
- Useful fields include status (completed/in progress/planned/did not finish), start/end dates, rating, review, passages/quotes, tags, venue, source URL, cover, favourite status and repeat experience.
- Films have optional **Viewing language**, stored as `experience.viewingLanguage`. Record the language actually watched, never infer it from a film's original language. Repeat viewings start with a blank language and retain separate choices. The field appears in work details and is searchable in Library.
- Exact book editions have optional **Publication series** and **Series number**, stored as `edition.series` and `edition.seriesNumber` alongside `edition.publisher`. For example: `Einaudi · Nuovi Coralli n. 15`. The number is text, allowing values such as `2 bis`. Repeat readings retain independent edition choices, and manual series values survive enrichment, edits and backups. These are additive optional fields; schema version 6, IDs and storage keys remain unchanged.
- Add a little **Today** shortcut near date fields; this was a requested UX improvement and should be preserved.
- Dates must remain flexible: users may log an experience on the same day or have incomplete dates; do not reintroduce validation that unnecessarily forces finish after start for every status.
- Keep the interface simple; do not invent new mandatory form fields.

### Metadata and images

- Books: prioritize **correct edition** (language, publisher, cover, year, format). Existing manual edition editing supports **ISBN, EAN/barcode, StoryGraph UID and other identifiers**, plus hand-uploaded covers. Matching the *wrong* edition is worse than having no cover. In particular, a generic Open Library cover does not establish exact edition identity.
- Films: metadata/cover enrichment through TMDB where already implemented. Keep any user-supplied API credential out of commits.
- Other cultural works: the entry form's More details section has **Find image** beside the reference/event URL for theatre, concerts, exhibitions, opera and other non-book/non-TMDB media. Pasting/changing an event link suggests images when the cover is blank or contains that same webpage URL. Opening an existing entry with the same page URL in both fields also suggests images; this handles the current KA-IN record without silently changing it. Existing image covers are not looked up automatically. Choose **Use image**, then **Save**; cancelling or merely loading suggestions never changes the archive. Replacing a different existing cover requires confirmation. Manual cover URLs remain available.
- Image suggestions come from `/api/pathos/page-images`, an online, same-origin Next.js Node route shared by both interfaces. It receives only the requested public URL, not the archive, IDs, reviews or credentials. It considers Open Graph, Twitter cards, JSON-LD images and ordinary/lazy page images, resolves relative URLs, deduplicates candidates and excludes obvious logos/icons and organization-logo metadata. It returns at most six choices, never an automatic saved cover. On the real KA-IN page, two production photos were found; its organization metadata incorrectly points to unrelated DARDUST artwork, which is excluded. Books keep their exact-edition workflow; Film/TV keep TMDB.
- The fetcher accepts ordinary public HTTP(S) URLs only (no credentials/custom ports), rejects nonpublic IPv4/IPv6 and mixed DNS answers, pins a validated address for the connection, rechecks each redirect (maximum three), limits HTML to 2 MiB and lookup time to eight seconds, and forwards no cookies/auth headers. Candidate image hosts are also checked. The route limits input size/concurrency, refuses cross-site browser requests and marks responses no-store/noindex. This is metadata lookup, not cloud sync or an image proxy. Some sites may block fetching or hotlinking; failure leaves the current cover intact.
- Cover images from external services may not load when offline unless cached. Event-image selections are remote URLs; their availability offline is not guaranteed by the current Open Library/TMDB cover cache. Image lookup requires a connection, while local records and JSON backup/restore continue to work offline. Uploaded local images should be preserved in backups.

### Visual/product decisions worth preserving

- Greek Pi mark and **Πathos** name; no generic “Cultural Archive” branding.
- Minimal text and unobtrusive UI; no large promotional introductions or overexplained chart/timeline captions.
- Owner's hosted archive is publicly browsable to people with its link, but only the owner can edit.
- Installed personal PWA should have a **clean standalone window**: no “— Offline” window-title suffix or redundant “Saved on this device” / “Installed” status; still show meaningful save errors and actual update prompts.
- No account or Supabase setup required for users of the personal PWA.

## 5. Cloud data and privacy — hosted owner's Πathos

The owner authenticates through Supabase email/password. Site visitors who are not signed in can see only published experiences and safe fields. New hosted experiences are **public by default**, including entries logged again, discovery/planned entries and CSV imports. The entry form has a visible **Keep this experience private** checkbox, applying to its review and passages too. Explicit `isPublic: false` remains private. Editing a legacy entry with a false/missing flag keeps it private; existing archives and JSON restores retain their recorded visibility without bulk changes. Personal remains local-only with no publication controls.

The public RPC's explicit projection includes optional `viewingLanguage`; publication series travels in the already-projected `edition` object. `scripts/pathos-public-viewing-language.sql` adds only that one safe field to the inspected function and includes a rollback that removes its public projection without deleting stored languages. It preserves the owner/publication filter, permissions, RLS and private archive write function. The database's fallback for malformed/missing publication settings remains private; new-entry defaults are applied by the hosted UI, never by migrating old records.

The Supabase implementation uses:

- `public.pathos_works`: work documents (`JSONB`) scoped to owner.
- `public.pathos_experiences`: experience documents (`JSONB`) with a public visibility flag.
- `pathos_get_my_archive()`: authenticated owner's full archive.
- `pathos_get_public_archive(p_owner_id)`: intentionally public RPC returning only published data/allowed fields.
- `pathos_replace_my_archive(p_archive)`: writes the owner's archive, behind authorization/RLS controls.

Tables have row-level security. The public RPC is deliberately usable by anonymous visitors, but **must never reveal unpublished records or fields**. Before editing database functions or policies, retrieve and inspect their current definitions and existing production data. Test public reads while signed out, authenticated owner reads/writes and unauthorized writes separately. Never put `service_role`, passwords, database connection strings or raw archive dumps into GitHub. The Supabase URL and publishable key in `public/pathos/config.js` are *public* identifiers and **must not be treated as a security boundary**.

The owner requested the new public default on 15 October 2026. Preserve existing visibility in any future changes; do not bulk-toggle an archive without explicit authorization.

## 6. Local data and updates — Πathos Personal

The personal version is **local-only** by deliberate design. Friends download/install the PWA, add their own works and experiences, and keep the data on that browser profile/device. It includes JSON export/restore and existing import workflows (including StoryGraph and Letterboxd, as supported by the checked-in implementation). They should back up regularly; deleting site data or changing devices **will not magically recover their archive**.

The PWA's current update architecture:

1. The browser registers `/pathos-personal/sw.js` with scope `/pathos-personal/`.
2. A new worker downloads/caches the next app shell and **waits** rather than immediately taking over.
3. The app notices a waiting worker and offers a small **“A new version of Πathos is available”** banner, with **Update** and **Later**.
4. Update checks occur on app launch and at intervals/when focus or connectivity returns, subject to browser availability.
5. Clicking **Update** waits for pending IndexedDB writes. A failed save blocks the reload; the user is prompted to export a backup.
6. The app messages the worker with `SKIP_WAITING`; when the new worker becomes controller, the app reloads.
7. The local IndexedDB archive is not part of the service-worker cache and should survive normal updates.

**Verification status:** the app was previously reported installed and functioning as a standalone window. On 14 October 2026 the reliability branch passed isolated Edge browser tests for create/edit/delete/reload, JSON round trips (edition IDs, reviews, passages and uploaded cover), cancelled/invalid restores, atomic rollback and undo, save-failure recovery, stale/simultaneous local windows, CSV imports, offline edits/reopen and a full offline browser restart. The suite also serves sequential releases on one local origin, including an update from commit `9bbad84` (shell v3), and verifies Update/Later, two clients, open-entry guards, failed/pending writes and cache cleanup. A real two-deployment test on PR #6's stable Netlify preview additionally verified shell v4 → v5, Later/re-offering, an open-entry guard, two clients, activation/cache cleanup, archive continuity, offline editing and a browser restart. Desktop and narrow-viewport screenshots were inspected. Native installation and actual mobile-device checks remain manual release gates. See [PATHOS-TESTING.md](PATHOS-TESTING.md).

Important: the current worker has named caches and a manually incremented app-shell version. **Coordinate cache version changes, staging and activation** for future releases. The shell is intentionally scoped to `/pathos-personal/`; do not let worker caching hijack `/pathos` or the owner's wider site.

## 7. History / current release status

- Original single-page prototype evolved through multiple UI iterations.
- Hosted archive migrated to Supabase and became available at `/pathos`; its owner may sign in to create/edit while guests browse published entries. Its GitHub PR #4 was merged.
- Personal PWA was developed in **PR #5**, with an empty archive, IndexedDB, independent route, manifest/icons, service worker, standalone title/header cleanup and staged update banner. **PR #5 was verified merged into `main` on 14 October 2026.**
- Netlify is used for production and pull-request deploy previews. The user has reported that both deployed applications work.

## 8. Near-term roadmap (discuss, then implement)

**Reliability first:**

1. **Finish native release verification:** verify a native installed window and mobile PWA. Local browser tests and the real Netlify preview cycle already cover offline editing, restart, restore and multiple clients; retain these as regression checks.
2. **Review cloud concurrency:** a database-side conditional save remains necessary for fully atomic protection against simultaneous edits from different devices. Preserve the current visibility semantics and prepare fixtures/rollback before proposing that change.
3. **Backup resilience:** exercise representative StoryGraph/Letterboxd collections and external JSON backups with early users. Evaluate an unobtrusive reminder only after observing backup habits.
4. **Initial user testing:** after review, invite a few friends with different needs (StoryGraph/Letterboxd imports, manual entry, mobile PWA) and follow the short pilot checklist in PATHOS-TESTING.md. Do not send invitations automatically.

**Later feature work:**

- Expand official-page image extraction only in response to real failures (for example sites that require JavaScript); preserve user choice and manual covers. The basic public-page chooser is now implemented on the reliability branch.
- Improve search, edition matching and reliable cover selection, including titles and languages without ISBNs.
- Share more interaction/UI code between hosted and personal modes, while retaining clearly separated storage and privacy boundaries. Make this a deliberate refactor with migrations/tests, not an incidental rewrite.
- Optionally explore publishing personal-app reviews someday, but **do not add user accounts or cloud storage by default**; this was an idea, not an approved feature.

## 9. Working instructions for a new Codex session

Before proposing code, inspect `public/pathos/app.html`, `public/pathos/sync.js`, `public/pathos-personal/index.html`, `public/pathos-personal/sw.js`, both Next.js routes and the manifest. Compare the implementation with this handoff, identify discrepancies and ask before changing stable user behavior.

A good first prompt:

> Read `AGENTS.md` and `docs/PATHOS.md`, inspect the current Πathos implementations in the repository, and summarize their architecture, data-safety boundaries, and release workflow. Then propose a small, testable plan for improving personal-PWA backup reliability and verifying its update banner. Do not change production data or merge anything without my approval.

Development commands from the repository root:

```bash
npm ci
npm run dev
npm run build
```

Use a feature branch and a Netlify deploy preview for review. The website's existing `npm run lint` script should be examined before using it as a pass/fail gate; its command may lag the current Next.js version.

**This document is a handoff, not an override of actual source code.** If a deployment or product decision has changed since the date above, prefer the current repo and confirm the intended behavior with the user before implementing.
