create or replace function public.rollback_import_batch(p_hospital_id uuid, p_import_batch uuid)
returns json as $$
declare v_procs_deleted integer := 0; v_aihs_deleted integer := 0;
begin
  with delp as (
    delete from public.procedure_records where hospital_id = p_hospital_id and import_batch_id = p_import_batch returning 1
  ) select count(*) into v_procs_deleted from delp;

  with delaih as (
    delete from public.aihs where hospital_id = p_hospital_id and import_batch_id = p_import_batch returning 1
  ) select count(*) into v_aihs_deleted from delaih;

  return json_build_object('procedures_deleted', v_procs_deleted, 'aihs_deleted', v_aihs_deleted);
end; $$ language plpgsql;
