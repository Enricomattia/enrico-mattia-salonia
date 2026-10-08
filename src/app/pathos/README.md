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

Export a JSON backup periodically. Be careful with whole-archive imports and full-archive saves: use the latest cloud data when editing; do not overwrite from a stale browser tab. Supabase records are the source of truth after migration.

Future enhancement: installable, offline-first PWA with a separate local archive for other users. This is **not** part of the current launch.
