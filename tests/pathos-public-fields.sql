-- Synthetic public/private fixtures are visible only in this transaction.
-- Always roll back; never use archive replacement or alter existing rows.
BEGIN;
DO $test$
DECLARE
  fixture_owner uuid := (select owner_id from public.pathos_works limit 1);
  fixture_work text := 'pathos-field-test-' || gen_random_uuid()::text;
  public_id text := gen_random_uuid()::text;
  private_id text := gen_random_uuid()::text;
  result jsonb;
  visible jsonb;
BEGIN
  IF fixture_owner IS NULL THEN RAISE EXCEPTION 'An existing owner is required'; END IF;
  INSERT INTO public.pathos_works(owner_id, work_id, document)
    VALUES(fixture_owner, fixture_work, jsonb_build_object('id',fixture_work,'title','Synthetic field test','type','Film'));
  INSERT INTO public.pathos_experiences(owner_id, experience_id, work_id, is_public, document)
    VALUES
      (fixture_owner, public_id, fixture_work, true, jsonb_build_object('id',public_id,'workId',fixture_work,'viewingLanguage','Italian','edition',jsonb_build_object('publisher','Einaudi','series','Nuovi Coralli','seriesNumber','15'),'details',jsonb_build_object('privateNote','Never expose'))),
      (fixture_owner, private_id, fixture_work, false, jsonb_build_object('id',private_id,'workId',fixture_work,'viewingLanguage','Private language','review','Private review'));
  result := public.pathos_get_public_archive(fixture_owner);
  SELECT e INTO visible FROM jsonb_array_elements(result->'experiences') e WHERE e->>'id'=public_id;
  IF visible IS NULL OR visible->>'viewingLanguage' IS DISTINCT FROM 'Italian'
     OR visible->'edition'->>'series' IS DISTINCT FROM 'Nuovi Coralli'
     OR visible->'edition'->>'seriesNumber' IS DISTINCT FROM '15'
     OR visible ? 'details'
  THEN RAISE EXCEPTION 'Published field projection failed'; END IF;
  IF EXISTS(select 1 from jsonb_array_elements(result->'experiences') e where e->>'id'=private_id)
  THEN RAISE EXCEPTION 'Private experience was exposed'; END IF;
  IF jsonb_array_length(public.pathos_get_public_archive(gen_random_uuid())->'experiences') <> 0
  THEN RAISE EXCEPTION 'Owner boundary failed'; END IF;
END;
$test$;
ROLLBACK;
SELECT 'Public language/series, private filtering and owner scoping passed; fixtures rolled back' AS result;
