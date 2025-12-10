create or replace function public.merge_staging_to_core_safe(p_hospital_id uuid, p_force_update boolean default false, p_dry_run boolean default false)
returns json as $$
declare v_patients_from_staging integer := 0; v_patients_from_aihs integer := 0; v_aihs_inserted integer := 0; v_aihs_updated integer := 0; v_procs_inserted integer := 0;
begin
  if p_dry_run then
    return json_build_object(
      'dry_run', true,
      'staging_patients', (select count(*) from public.staging_patients where hospital_id = p_hospital_id),
      'staging_aihs', (select count(*) from public.staging_aihs where hospital_id = p_hospital_id),
      'staging_procedure_records', (select count(*) from public.staging_procedure_records where hospital_id = p_hospital_id)
    );
  end if;

  insert into public.patients (hospital_id, name, cns, birth_date, gender, address, city, state, zip_code, phone, email, medical_record)
  select sp.hospital_id, coalesce(sp.name,'')::text, nullif(sp.cns,''), sp.birth_date, sp.gender, sp.address, sp.city, sp.state, sp.zip_code, sp.phone, sp.email, coalesce(sp.medical_record, sp.prontuario)
  from public.staging_patients sp
  where sp.hospital_id = p_hospital_id
  on conflict on constraint ux_patients_hospital_cns_partial do update set 
    name = excluded.name,
    birth_date = excluded.birth_date,
    gender = excluded.gender,
    address = excluded.address,
    city = excluded.city,
    state = excluded.state,
    zip_code = excluded.zip_code,
    phone = excluded.phone,
    email = excluded.email,
    medical_record = excluded.medical_record;
  get diagnostics v_patients_from_staging = row_count;

  insert into public.patients (hospital_id, name, cns, birth_date, gender)
  select sa.hospital_id, coalesce(sa.patient_name,'')::text, nullif(sa.patient_cns,''), sa.patient_birth_date, sa.patient_gender
  from public.staging_aihs sa
  where sa.hospital_id = p_hospital_id and (sa.patient_cns is not null and sa.patient_cns <> '')
  on conflict on constraint ux_patients_hospital_cns_partial do update set name = excluded.name, birth_date = excluded.birth_date, gender = excluded.gender;
  get diagnostics v_patients_from_aihs = row_count;

  if p_force_update then
    with up as (
      insert into public.aihs (hospital_id, patient_id, aih_number, procedure_code, admission_date, discharge_date, estimated_discharge_date, main_cid, secondary_cid, professional_cbo, requesting_physician, original_value, processing_status, match_found, rejection_reason, requires_manual_review, source_file, import_batch_id, authorization_date, procedure_requested, procedure_changed, discharge_reason, specialty, care_modality, care_character, estimated_original_value, aih_anterior, aih_posterior, competencia, situacao, tipo, data_autorizacao, motivo_encerramento, cns_autorizador, cns_solicitante, cns_responsavel, procedimento_solicitado, mudanca_procedimento, especialidade, modalidade, caracter_atendimento)
      select sa.hospital_id,
             coalesce(p.id, (
               select p2.id from public.patients p2
               where p2.hospital_id = sa.hospital_id and p2.cns = sa.patient_cns limit 1
             )),
             sa.aih_number, coalesce(sa.procedure_code, sa.procedimento_solicitado), sa.admission_date, sa.discharge_date, sa.estimated_discharge_date, sa.main_cid, sa.secondary_cid, sa.professional_cbo, sa.requesting_physician, sa.original_value, coalesce(sa.processing_status,'pending'), coalesce(sa.match_found,false), sa.rejection_reason, coalesce(sa.requires_manual_review,false), sa.source_file, sa.import_batch_id, coalesce(sa.authorization_date, sa.data_autorizacao::date), coalesce(sa.procedure_requested, sa.procedimento_solicitado), coalesce(sa.procedure_changed, sa.mudanca_procedimento), coalesce(sa.discharge_reason, sa.motivo_encerramento), coalesce(sa.specialty, sa.especialidade), coalesce(sa.care_modality, sa.modalidade), coalesce(sa.care_character, sa.caracter_atendimento), sa.estimated_original_value, sa.aih_anterior, sa.aih_posterior, sa.competencia, sa.situacao, sa.tipo, sa.data_autorizacao, sa.motivo_encerramento, sa.cns_autorizador, sa.cns_solicitante, sa.cns_responsavel, sa.procedimento_solicitado, sa.mudanca_procedimento, sa.especialidade, sa.modalidade, sa.caracter_atendimento
      from public.staging_aihs sa
      left join public.patients p on p.hospital_id = sa.hospital_id and p.cns = (select sp.cns from public.staging_patients sp where sp.hospital_id = sa.hospital_id and sp.patient_key = sa.patient_key limit 1)
      where sa.hospital_id = p_hospital_id and sa.aih_number is not null and sa.aih_number <> '' and sa.aih_number <> '-'
      on conflict on constraint ux_aihs_hospital_number_partial do update set patient_id = excluded.patient_id, procedure_code = excluded.procedure_code, admission_date = excluded.admission_date, discharge_date = excluded.discharge_date, competencia = excluded.competencia
      returning 1
    ) select count(*) into v_aihs_updated from up;
  else
    with ins as (
      insert into public.aihs (hospital_id, patient_id, aih_number, procedure_code, admission_date, discharge_date, estimated_discharge_date, main_cid, secondary_cid, professional_cbo, requesting_physician, original_value, processing_status, match_found, rejection_reason, requires_manual_review, source_file, import_batch_id, authorization_date, procedure_requested, procedure_changed, discharge_reason, specialty, care_modality, care_character, estimated_original_value, aih_anterior, aih_posterior, competencia, situacao, tipo, data_autorizacao, motivo_encerramento, cns_autorizador, cns_solicitante, cns_responsavel, procedimento_solicitado, mudanca_procedimento, especialidade, modalidade, caracter_atendimento)
      select sa.hospital_id,
             coalesce(p.id, (
               select p2.id from public.patients p2
               where p2.hospital_id = sa.hospital_id and p2.cns = sa.patient_cns limit 1
             )),
             sa.aih_number, coalesce(sa.procedure_code, sa.procedimento_solicitado), sa.admission_date, sa.discharge_date, sa.estimated_discharge_date, sa.main_cid, sa.secondary_cid, sa.professional_cbo, sa.requesting_physician, sa.original_value, coalesce(sa.processing_status,'pending'), coalesce(sa.match_found,false), sa.rejection_reason, coalesce(sa.requires_manual_review,false), sa.source_file, sa.import_batch_id, coalesce(sa.authorization_date, sa.data_autorizacao::date), coalesce(sa.procedure_requested, sa.procedimento_solicitado), coalesce(sa.procedure_changed, sa.mudanca_procedimento), coalesce(sa.discharge_reason, sa.motivo_encerramento), coalesce(sa.specialty, sa.especialidade), coalesce(sa.care_modality, sa.modalidade), coalesce(sa.care_character, sa.caracter_atendimento), sa.estimated_original_value, sa.aih_anterior, sa.aih_posterior, sa.competencia, sa.situacao, sa.tipo, sa.data_autorizacao, sa.motivo_encerramento, sa.cns_autorizador, sa.cns_solicitante, sa.cns_responsavel, sa.procedimento_solicitado, sa.mudanca_procedimento, sa.especialidade, sa.modalidade, sa.caracter_atendimento
      from public.staging_aihs sa
      left join public.patients p on p.hospital_id = sa.hospital_id and p.cns = (select sp.cns from public.staging_patients sp where sp.hospital_id = sa.hospital_id and sp.patient_key = sa.patient_key limit 1)
      where sa.hospital_id = p_hospital_id and sa.aih_number is not null and sa.aih_number <> '' and sa.aih_number <> '-'
      on conflict on constraint ux_aihs_hospital_number_partial do nothing
      returning 1
    ) select count(*) into v_aihs_inserted from ins;
  end if;

  with ins as (
    insert into public.procedure_records (hospital_id, patient_id, aih_id, procedure_code, procedure_name, procedure_description, procedure_date, quantity, sequencia, value_charged, unit_value, total_value, professional_name, professional_cns, professional_cbo, billing_status, billing_date, payment_date, notes, descricao_original, match_status, match_confidence, observacoes, care_modality, care_character, status, authorization_type, cnes, codigo_procedimento_original, competencia)
    select spr.hospital_id,
           coalesce(p.id, null),
           a.id,
           coalesce(spr.procedure_code, spr.codigo_procedimento_original), spr.procedure_name, spr.procedure_description, coalesce(spr.procedure_date, spr.execution_date), spr.quantity, spr.sequencia, spr.value_charged, spr.unit_value, spr.total_value, coalesce(spr.professional_name, spr.professional), spr.professional_cns, spr.professional_cbo, spr.billing_status, spr.billing_date, spr.payment_date, spr.notes, spr.descricao_original, spr.match_status, spr.match_confidence, spr.observacoes, spr.care_modality, spr.care_character, spr.status, spr.authorization_type, spr.cnes, spr.codigo_procedimento_original, spr.competencia
    from public.staging_procedure_records spr
    join public.aihs a on a.hospital_id = spr.hospital_id and a.aih_number = spr.aih_number
    left join public.patients p on p.hospital_id = spr.hospital_id and p.cns = (select sp.cns from public.staging_patients sp where sp.hospital_id = spr.hospital_id and sp.patient_key = spr.patient_key limit 1)
    where spr.hospital_id = p_hospital_id
    returning 1
  ) select count(*) into v_procs_inserted from ins;

  return json_build_object('patients_staging', v_patients_from_staging, 'patients_aihs', v_patients_from_aihs, 'aihs_inserted', v_aihs_inserted, 'aihs_updated', v_aihs_updated, 'procedures', v_procs_inserted, 'force_update', p_force_update);
end; $$ language plpgsql;
