-- Synthetic fixtures only; the caller must keep this inside BEGIN / ROLLBACK.
DO $test$
DECLARE
  owner uuid := (select owner_id from public.pathos_works limit 1);
  work text := 'pathos-preferences-test-' || gen_random_uuid()::text;
  hidden_work text := 'pathos-private-test-' || gen_random_uuid()::text;
  published text := gen_random_uuid()::text;
  hidden text := gen_random_uuid()::text;
  result jsonb;
  visible jsonb;
  visible_work jsonb;
BEGIN
  INSERT INTO public.pathos_works(owner_id,work_id,document) VALUES
    (owner,work,jsonb_build_object('id',work,'title','Synthetic favourite','type','Book','liked',true,'owned',true,'sourceMetadata',jsonb_build_object('private','Keep private'))),
    (owner,hidden_work,jsonb_build_object('id',hidden_work,'title','Private favourite','type','Book','liked',true));
  INSERT INTO public.pathos_experiences(owner_id,experience_id,work_id,is_public,document) VALUES
    (owner,published,work,true,jsonb_build_object('id',published,'workId',work,'moods',jsonb_build_array('reflective'),'cover','data:image/jpeg;base64,synthetic','viewingLanguage','Italian','edition',jsonb_build_object('series','Nuovi Coralli'))),
    (owner,hidden,work,false,jsonb_build_object('id',hidden,'workId',work,'moods',jsonb_build_array('private mood'),'review','Private review','cover','private cover')),
    (owner,gen_random_uuid()::text,hidden_work,false,jsonb_build_object('id','private-only','workId',hidden_work));
  result := public.pathos_get_public_archive(owner);
  SELECT e INTO visible FROM jsonb_array_elements(result->'experiences') e WHERE e->>'id'=published;
  SELECT w INTO visible_work FROM jsonb_array_elements(result->'works') w WHERE w->>'id'=work;
  IF visible_work IS NULL OR visible_work->'liked' IS DISTINCT FROM 'true'::jsonb
    OR visible_work ? 'owned' OR visible_work ? 'sourceMetadata'
    OR visible ? 'moods'
    OR visible->>'cover' IS DISTINCT FROM 'data:image/jpeg;base64,synthetic'
    OR visible->>'viewingLanguage' IS DISTINCT FROM 'Italian'
    OR visible->'edition'->>'series' IS DISTINCT FROM 'Nuovi Coralli'
  THEN RAISE EXCEPTION 'Public projection failed'; END IF;
  IF EXISTS(select 1 from jsonb_array_elements(result->'experiences') e where e->>'id'=hidden)
    OR EXISTS(select 1 from jsonb_array_elements(result->'works') w where w->>'id'=hidden_work)
  THEN RAISE EXCEPTION 'Private records exposed'; END IF;
  IF jsonb_array_length(public.pathos_get_public_archive(gen_random_uuid())->'works')<>0
  THEN RAISE EXCEPTION 'Owner scoping failed'; END IF;
END;
$test$;
SELECT 'Favourite and cover projection passed; moods, private experiences and private-only favourites remain hidden' as result;
