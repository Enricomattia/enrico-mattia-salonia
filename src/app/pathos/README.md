# Πathos staging route

This draft introduces a safe /pathos placeholder only.

- Supabase project "pathos" has two RLS-protected tables:
  public.pathos_works and public.pathos_experiences.
- The editor account has been created and confirmed.
- All archive data remains private by default.
- The public read-only RPC returns only explicitly published experiences.
- No private archive, JSON backups, TMDB tokens or secret keys are committed.
- The complete v0.5.6 interface and the hosted sync bridge still require integration into this repository, followed by authenticated end-to-end tests.
- Do **not** merge or publish this draft as Πathos v1.0. Current local Πathos v0.5.6 remains the working app.
