-- Explicitly requested public favourites and published cover artwork.
-- Only works with a published experience remain eligible. No records, RLS,
-- publication flags, grants or owner-write functions are modified.
DO $patch$
DECLARE
  definition text := pg_get_functiondef('public.pathos_get_public_archive(uuid)'::regprocedure);
  work_anchor text := $anchor$   'cover',w.document->>'cover',$anchor$;
  experience_anchor text := $anchor$    'tags', coalesce(e.document->'tags', '[]'::jsonb),$anchor$;
BEGIN
  IF position('where e.owner_id=p_owner_id and e.is_public=true' in definition)=0
     OR position('and exists(select 1 from visible v where v.work_id=w.work_id)' in definition)=0
     OR position(work_anchor in definition)=0 OR position(experience_anchor in definition)=0
  THEN RAISE EXCEPTION 'Public archive definition changed; inspect before patching'; END IF;
  IF position('''liked''' in definition)=0 THEN
    definition := replace(definition,work_anchor,work_anchor || E'\n' ||
      $field$   'liked',coalesce(w.document->'liked'='true'::jsonb,false),$field$);
  END IF;
  IF position('''cover'', coalesce(e.document' in definition)=0 THEN
    definition := replace(definition,experience_anchor,experience_anchor || E'\n' ||
      $field$    'cover', coalesce(e.document->'cover', '""'::jsonb),$field$);
  END IF;
  EXECUTE definition;
END;
$patch$;

-- Rollback: remove only these projections; stored data is retained.
-- DO $rollback$
-- DECLARE definition text := pg_get_functiondef('public.pathos_get_public_archive(uuid)'::regprocedure);
-- BEGIN
--   definition := replace(definition,$field$   'liked',coalesce(w.document->'liked'='true'::jsonb,false),$field$ || E'\n','');
--   definition := replace(definition,$field$    'cover', coalesce(e.document->'cover', '""'::jsonb),$field$ || E'\n','');
--   EXECUTE definition;
-- END;
-- $rollback$;
