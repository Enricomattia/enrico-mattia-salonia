-- Add only the explicitly recorded viewing language to published experiences.
-- No archive rows, publication flags, policies or permissions are modified.
-- Abort if the inspected function changes before this patch is applied.
DO $patch$
DECLARE
  current_definition text := pg_get_functiondef('public.pathos_get_public_archive(uuid)'::regprocedure);
  anchor text := $anchor$    'venue', coalesce(e.document->'venue', '""'::jsonb),$anchor$;
BEGIN
  IF position('''viewingLanguage''' in current_definition) > 0 THEN
    RETURN;
  END IF;
  IF position(anchor in current_definition) = 0
     OR position('where e.owner_id=p_owner_id and e.is_public=true' in current_definition) = 0
  THEN
    RAISE EXCEPTION 'Public archive definition changed; inspect it before applying this patch';
  END IF;
  EXECUTE replace(current_definition, anchor, anchor || E'\n' ||
    $field$    'viewingLanguage', coalesce(e.document->'viewingLanguage', '""'::jsonb),$field$);
END;
$patch$;

-- Rollback (removes only the public projection, retaining stored languages):
-- DO $rollback$
-- BEGIN
--   EXECUTE replace(pg_get_functiondef('public.pathos_get_public_archive(uuid)'::regprocedure),
--     $field$    'viewingLanguage', coalesce(e.document->'viewingLanguage', '""'::jsonb),$field$ || E'\n', '');
-- END;
-- $rollback$;
