-- 0016_import_assessment_rpc.sql — atomic assessment import (no orphan rows).
-- Inserts the assessment AND its answer key in a single transaction (a function body
-- is atomic), replacing the prior two-step insert that could orphan an assessment row
-- if the key insert failed. The caller (importAssessment) still does validation +
-- whitelist-rebuilds the questions before passing them in.

create or replace function public.import_assessment(
  p_instructor    uuid,
  p_title         text,
  p_type          assessment_type,
  p_total_points  integer,
  p_questions     jsonb,
  p_answer_key    jsonb
) returns uuid
  language plpgsql security definer set search_path=public as $$
declare
  v_id uuid;
begin
  insert into assessments (instructor_id, title, type, total_points, questions)
  values (p_instructor, p_title, p_type, p_total_points, p_questions)
  returning id into v_id;

  insert into assessment_keys (assessment_id, answer_key)
  values (v_id, p_answer_key);

  return v_id;
end;
$$;

-- service-role only (called from the importAssessment server action via admin client).
revoke all on function public.import_assessment(uuid, text, assessment_type, integer, jsonb, jsonb) from anon, authenticated;
grant execute on function public.import_assessment(uuid, text, assessment_type, integer, jsonb, jsonb) to service_role;
