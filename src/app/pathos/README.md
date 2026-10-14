# Πathos on the personal website

Πathos is an unlisted cultural archive served at `/pathos`.

- `src/app/pathos/page.tsx`: page route with `noindex, nofollow` metadata. Embeds the client archive.
- `public/pathos/app.html`: the archive UI, without personal data bundled in source.
- `public/pathos/config.js`: browser-safe Supabase URL, publishable key and public archive owner ID. **Never include a secret key or password.**
- `public/pathos/sync.js`: owner login and authenticated saving; anonymous users see the public archive.
- Supabase tables `pathos_works` and `pathos_experiences` use row-level security. Public reads go through a publication-filtered RPC.

## Release notes

The owner has confirmed saving and deleting experiences across refreshes, including basic mobile use. The anonymous deploy preview has been checked: it displays all 167 public works/experiences and 36 written reviews.

The route is **not linked from the site's main navigation**. It is publicly accessible to anyone who knows the URL, so being unlisted does not grant secrecy. The page and its direct HTML both request search-engine `noindex`.

## Maintenance

Export a JSON backup periodically. Hosted saves compare against the latest cloud archive and use a same-origin Web Lock where available. If another window/device has saved newer data, export the current tab's changes and reload. Simultaneous cross-device saves still require a database-side conditional-write improvement. Supabase records remain the source of truth.

Restore validates IDs, references, editions and passages, downloads a recovery JSON backup, and asks before replacing the online archive (including publication settings). Keep that recovery file.

The independent, account-free Personal PWA is available at `/pathos-personal/`. It uses IndexedDB, JSON export/restore with a device-local Undo copy, and staged service-worker updates. It never loads the owner's Supabase archive. See [the project handoff](../../../docs/PATHOS.md) and [reliability checks](../../../docs/PATHOS-TESTING.md).
