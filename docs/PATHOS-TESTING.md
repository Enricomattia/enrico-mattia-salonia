# Πathos reliability checks

## Automated checks

```powershell
npm ci
npm run build
npm run test:pathos
npm run test:pathos-images
npm run test:pathos-match
```

The browser suite uses Playwright and an installed Microsoft Edge by default. To use Chrome, set `$env:PATHOS_BROWSER='chrome'`. Alternatively install Playwright Chromium with `npx playwright install chromium` and set `$env:PATHOS_BROWSER='chromium'`.

Owner-only discovery checks: `test:pathos-match` tests server verification of missing/invalid/other-user tokens, cross-origin rejection, bounds/fixed catalogue targets, public-config consistency, provider failures and local scoring/evidence/self-exclusion. Its browser stage uses synthetic private records and mocked services to verify public gating, search/preview without writes, explicit planned-entry Save, exact-edition protection, escaped output, phone layouts and worker cleanup on sign-out. It asserts that catalogue requests contain no archive text and worker inputs contain no covers, ISBNs, source URLs or passages.

For actual on-device inference, build/start the local site (default `http://127.0.0.1:3118`) and run `npm run test:pathos-match-real`; set `PATHOS_SITE_URL` for another local port. Alternatively `$env:PATHOS_REAL_MODEL='1'; node tests/pathos-discovery-browser.cjs` exercises the whole owner preview → real model → match UI against synthetic data. These opt-in checks download roughly 118 MB of multilingual weights plus runtime/tokenizer, use no paid AI service, and assert that external requests are asset GET/HEADs rather than review uploads. Both actual-model paths passed in Edge on 14 October 2026; Italian/English and cross-media positive examples matched. Real public Open Library search/detail also returned a book, author and description. Owner login and a valid user's TMDB token are mocked in ordinary automated checks; no production records are written. Predictive accuracy on the owner's real history and physical mobile inference performance remain unmeasured.

To start the update test from the released v3 app rather than a test version of the current app:

```powershell
$env:PATHOS_UPDATE_BASELINE_REF='9bbad84'
npm run test:pathos
```

All archives are synthetic. The suite runs a temporary local HTTP server, isolated browser contexts and a temporary persistent profile. It never imports an owner's archive or writes to live Supabase. External requests in the ordinary test contexts are blocked or stubbed. The persistent update profile only uses synthetic local data. The test output includes the path to a screenshot for layout inspection.

For the actual preview v4 → v5 cycle, `tests/pathos-preview-update.cjs` has separate `seed` and `verify` stages. Set `PATHOS_PREVIEW_URL` to a stable Netlify PR hostname and `PATHOS_PREVIEW_PROFILE` to a dedicated `pathos-preview-*` directory under the OS temporary directory. Run `node tests/pathos-preview-update.cjs seed` while v4 is deployed, deploy v5 to the same hostname, then run `node tests/pathos-preview-update.cjs verify`. It refuses production URLs and normal browser profiles. It checks the actual waiting worker/banner and preserves the synthetic archive across activation and offline browser restart.

On 14 October 2026 this was exercised on `https://deploy-preview-6--astonishing-choux-4647df.netlify.app`: v4 (`90837d5`) → v5 (`6165eba`). Update/Later, re-offering after reload, an open-entry guard, two clients (the peer was not reloaded), versioned-cache cleanup, archive continuity and offline editing passed. The initial final-restart assertion was too strict about optional empty edition fields added by the edit form; it was corrected to compare every originally recorded value. The `reopen` stage then confirmed the saved offline review, original edition values/uploaded cover and passage after a full browser restart. Desktop and 390px screenshots were inspected. This is a browser/PWA test, not a native installation or physical mobile-device test.

Coverage: form create/edit/delete/reload; JSON export/restore/cancellation/undo; invalid/future-schema backups, duplicate IDs, dangling references and malformed editions/passages; aborted transactions; failed-save recovery; stale and simultaneous windows; ISBN enrichment preservation; offline reload/edit/reopen; sequential staged updates (Later, two clients, open entry, failed/pending saves, versioned-cache cleanup); offline browser restart; and hosted guest/owner flows with a stubbed Supabase client.

Interface checks additionally cover single-review work details, one review per work with accessible earlier reviews for repeats, searching older reviews, removal of Home's Recent reviews section, and exact-edition images in the full Timeline at narrow widths. These checks run in both Personal and the hosted signed-out UI and assert that changing views does not rewrite records. To verify the Next.js iframe/header integration too, build and start the site locally, set `PATHOS_SITE_URL` to its local URL, and run the suite. It checks the full desktop/mobile iframe viewport, retained `noindex`, and unchanged header/navigation on Research and Home.

`tests/pathos-timeline.cjs`, called by the browser suite for both variants, additionally checks Current above the timeline (hidden when empty), winding row direction on larger screens, chronological DOM/keyboard order, Home's 12-card limit, the complete full Timeline, exact-edition artwork, empty/partial rows, and absence of page-wide horizontal overflow at 320, 390, 600, 601, 768 and 1280px. At 600px and below it verifies a single chronological column, cards occupying at least 90% of the content width, no timeline horizontal overflow and hidden horizontal controls. It exercises vertical touch gestures through Chromium's touch emulation, keyboard navigation, native vertical wheel scrolling, mobile navigation/filters and Personal form sizing. Resizing back to desktop must retain the winding rows. Synthetic posters make screenshots easy to inspect; set `PATHOS_UI_SCREENSHOTS` to an output directory to keep them. Browser touch emulation is not a physical mobile-device test.

The vertical-phone follow-up (shell v9) passed the production build and full Edge suite on 14 October 2026 with `PATHOS_UPDATE_BASELINE_REF=30d4426`, checking the production v8 → v9 update, archive continuity and offline browser restart. Phone Home/full Timeline screenshots were inspected; this update changes presentation only.

On 14 October 2026, the production build and complete Edge regression suite passed with `PATHOS_UPDATE_BASELINE_REF=1b226e1` (v7 → local v8) and `PATHOS_SITE_URL` pointing at the built local site. Desktop and 390px screenshots of both timelines/variants were inspected. Touch momentum must settle before subsequent keyboard tests; otherwise emulated gesture scrolling can consume an immediately following wheel event. Archive continuity, staged updates, offline restart and the hosted iframe/header checks passed. The final Current-first layout also passed the full suite from the production baseline `9bbad84` (v3 → v8), plus all nine image-extractor checks. To exercise a real preview v7 → v8 update, set `PATHOS_PREVIEW_FROM_VERSION=7` and `PATHOS_PREVIEW_TO_VERSION=8` for both stages of `pathos-preview-update.cjs`. Physical mobile Safari and native installed-window checks remain manual.

Official-page artwork checks cover automatic suggestions for a webpage accidentally entered as its own cover, explicit image choice and Save, Cancel, preservation of existing manual covers and visibility/review fields, and graceful offline/blocked-site behavior in Personal and mocked hosted owner saves. `npm run test:pathos-images` exercises extraction (including the KA-IN-shaped organization-logo trap), relative URLs and final redirects, private IPv4/IPv6/encoded address rejection, mixed/private DNS answers, pinned connections without credentials, redirect revalidation, response/time bounds and direct-image/no-image cases. These server-module tests use the installed TypeScript compiler and Node's test runner; use Node 22.12+ or the bundled Node 24 runtime.

On 14 October 2026 the built local endpoint was tested against the actual KA-IN official page and returned its two production PNGs. Browser testing loaded both real images, selected one, saved a synthetic event and reloaded successfully. Local endpoint checks returned HTTP 400 for loopback/metadata targets and HTTP 403 for an unrelated Origin. No production record was changed; the existing published KA-IN cover is still its event-page URL until its owner chooses an image and saves after deployment.

The optional live command `node tests/pathos-public-boundary.cjs` performs **read-only anonymous** table/RPC requests using the public config. It prints only statuses/counts and rejects unexpected public experience fields. It does not test authenticated owner writes.

## Live privacy inspection — 14 October 2026

Read-only inspection of current Supabase function definitions and policies confirmed:

- `pathos_works` and `pathos_experiences` have RLS, with authenticated owner checks on reads/writes (`auth.uid() = owner_id`).
- `pathos_get_my_archive` and `pathos_replace_my_archive` are invoker functions, executable by authenticated users, not anonymous visitors. Replacement validates IDs/references and scopes changes to the signed-in owner.
- `pathos_get_public_archive` is intentionally public and `SECURITY DEFINER`, has an empty `search_path`, filters `is_public = true` and constructs its public documents from selected fields. Only works associated with those visible experiences are returned.
- There were 169 works/experiences and 167 published experiences. The anonymous HTTP check returned the same 167 public experiences; direct table reads and the private RPC returned HTTP 401.
- No live records, policies, functions or auth settings were changed. Actual owner sign-in/write and another authenticated account's access were not exercised against production.

Supabase advisors flag the public definer RPC as executable by anonymous/authenticated users; that is intentional for this archive and is constrained by its publication filter. Advisors also report disabled leaked-password protection. That is a separate auth-setting review, not changed here. References: [public definer RPC advisor](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated definer RPC advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Netlify and installed-window release gate

Use a stable PR deploy-preview hostname across both deployments. Production and preview browser storage are distinct. Export a JSON backup before switching origins; use synthetic test data for release validation. Steps 1–5 were exercised on PR #6 as recorded above; native checks in step 6 and authenticated live checks in step 7 remain manual.

1. Install/open preview release A. Add a book with an exact edition, uploaded cover, review and passage. Export JSON, reload and compare. Keep a second window open.
2. Deploy release B to the same preview hostname, with a distinct service-worker shell cache version. Existing windows should keep A until Update is accepted. Check Later, app relaunch and update re-offering.
3. Open an entry and leave changes unsaved. Finish/save or explicitly close it before updating. The new client should refuse update while the entry is open. Update waits for queued writes and refuses after a failed save; retrying a successful save must unblock it.
4. Accept Update in one window. Verify B's worker/cache, unchanged IDs/editions/passages and no forced reload of the other window. Close/reload the older window before further editing; older releases do not have the new concurrency guard.
5. Disconnect, reload, edit/save, close all app/browser windows, restart the installed app offline and verify records and uploaded covers. Remote catalogue searches and uncached artwork may remain unavailable. Reconnect and recheck update delivery.
6. Confirm native standalone styling: no browser navigation chrome, redundant ready-status or Install button; save errors and update prompts remain available. Check at least desktop and one mobile browser. Validate manifest scope/start URL and icons.
7. On hosted preview, sign out and check public-only reads; sign in as owner and use explicitly approved test data for create/edit/delete/reload. Check a second account cannot read/write the owner's rows. Do not overwrite production with fixtures.

Never mark these steps passed from a production build alone. Do not merge automatically.

## Small friend pilot, after approval

Use two or three volunteers: one StoryGraph import, one Letterboxd import and one manual/mobile user. Have each start with an empty Personal archive, add/edit an entry and passage, export a backup, restore with confirmation, use Undo, reopen offline and try an update. Explain that each browser/device has its own archive and that clearing site data removes its local copies. Record confusing steps and failed tasks before adding onboarding UI or new features. Invitations require the user's chosen recipients and explicit sending authorization.
