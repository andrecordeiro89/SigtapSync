alter table public.staging_aihs
  add column if not exists patient_name text,
  add column if not exists patient_cns text,
  add column if not exists patient_birth_date date,
  add column if not exists patient_gender text;

create unique index if not exists ux_patients_hospital_cns on public.patients(hospital_id, cns);
create unique index if not exists ux_aihs_hospital_number on public.aihs(hospital_id, aih_number);

create or replace function public.merge_staging_to_core(p_hospital_id uuid)
returns json as $$
declare v_patients_from_staging integer; v_patients_from_aihs integer; v_aihs_upserted integer; v_procs_inserted integer;
begin
  insert into public.patients (hospital_id, name, cns, birth_date, gender, address, city, state, zip_code, phone, email, medical_record, nationality, mother_name, neighborhood, responsible_name, document_type, document_number, race_color, address_complement, municipality, state_uf, postal_code, prontuario)
  select sp.hospital_id, coalesce(sp.name,'')::text, sp.cns, sp.birth_date, sp.gender, sp.address, sp.city, sp.state, sp.zip_code, sp.phone, sp.email, coalesce(sp.medical_record, sp.prontuario), coalesce(sp.nationality, sp.nacionalidade), coalesce(sp.mother_name, sp.nome_mae), coalesce(sp.neighborhood, sp.bairro), coalesce(sp.responsible_name, sp.nome_responsavel), coalesce(sp.document_type, sp.tipo_documento), coalesce(sp.document_number, sp.documento), coalesce(sp.race_color, sp.raca_cor), coalesce(sp.address_complement, sp.complemento_endereco), coalesce(sp.municipality, sp.city), coalesce(sp.state_uf, sp.state), coalesce(sp.postal_code, sp.zip_code), sp.prontuario
  from public.staging_patients sp
  where sp.hospital_id = p_hospital_id
  on conflict (hospital_id, cns) do update set name = excluded.name, birth_date = excluded.birth_date, gender = excluded.gender, address = excluded.address, city = excluded.city, state = excluded.state, zip_code = excluded.zip_code, phone = excluded.phone, email = excluded.email, medical_record = excluded.medical_record;

  with ins as (select count(*) as c from public.staging_patients where hospital_id = p_hospital_id)
  select c into v_patients_from_staging from ins;

  insert into public.patients (hospital_id, name, cns, birth_date, gender)
  select sa.hospital_id, coalesce(sa.patient_name,'')::text, nullif(sa.patient_cns,''), sa.patient_birth_date, sa.patient_gender
  from public.staging_aihs sa
  where sa.hospital_id = p_hospital_id and (sa.patient_cns is not null and sa.patient_cns <> '')
  on conflict (hospital_id, cns) do update set name = excluded.name, birth_date = excluded.birth_date, gender = excluded.gender;

  with ins2 as (select count(*) as c from public.staging_aihs where hospital_id = p_hospital_id and (patient_cns is not null and patient_cns <> ''))
  select c into v_patients_from_aihs from ins2;

  insert into public.aihs (hospital_id, patient_id, aih_number, procedure_code, admission_date, discharge_date, estimated_discharge_date, main_cid, secondary_cid, professional_cbo, requesting_physician, original_value, processing_status, match_found, rejection_reason, requires_manual_review, source_file, import_batch_id, authorization_date, procedure_requested, procedure_changed, discharge_reason, specialty, care_modality, care_character, estimated_original_value, aih_anterior, aih_posterior, competencia, situacao, tipo, data_autorizacao, motivo_encerramento, cns_autorizador, cns_solicitante, cns_responsavel, procedimento_solicitado, mudanca_procedimento, especialidade, modalidade, caracter_atendimento)
  select sa.hospital_id,
         coalesce(p.id, (
           select p2.id from public.patients p2
           where p2.hospital_id = sa.hospital_id and p2.cns = sa.patient_cns limit 1
         )),
         sa.aih_number, coalesce(sa.procedure_code, sa.procedimento_solicitado), sa.admission_date, sa.discharge_date, sa.estimated_discharge_date, sa.main_cid, sa.secondary_cid, sa.professional_cbo, sa.requesting_physician, sa.original_value, coalesce(sa.processing_status,'pending'), coalesce(sa.match_found,false), sa.rejection_reason, coalesce(sa.requires_manual_review,false), sa.source_file, sa.import_batch_id, coalesce(sa.authorization_date, sa.data_autorizacao::date), coalesce(sa.procedure_requested, sa.procedimento_solicitado), coalesce(sa.procedure_changed, sa.mudanca_procedimento), coalesce(sa.discharge_reason, sa.motivo_encerramento), coalesce(sa.specialty, sa.especialidade), coalesce(sa.care_modality, sa.modalidade), coalesce(sa.care_character, sa.caracter_atendimento), sa.estimated_original_value, sa.aih_anterior, sa.aih_posterior, sa.competencia, sa.situacao, sa.tipo, sa.data_autorizacao, sa.motivo_encerramento, sa.cns_autorizador, sa.cns_solicitante, sa.cns_responsavel, sa.procedimento_solicitado, sa.mudanca_procedimento, sa.especialidade, sa.modalidade, sa.caracter_atendimento
  from public.staging_aihs sa
  left join public.patients p on p.hospital_id = sa.hospital_id and p.cns = (select sp.cns from public.staging_patients sp where sp.hospital_id = sa.hospital_id and sp.patient_key = sa.patient_key limit 1)
  where sa.hospital_id = p_hospital_id
  on conflict (hospital_id, aih_number) do update set patient_id = excluded.patient_id, procedure_code = excluded.procedure_code, admission_date = excluded.admission_date, discharge_date = excluded.discharge_date, competencia = excluded.competencia;

  with up as (select count(*) as c from public.staging_aihs where hospital_id = p_hospital_id)
  select c into v_aihs_upserted from up;

  insert into public.procedure_records (hospital_id, patient_id, aih_id, procedure_code, procedure_name, procedure_description, procedure_date, quantity, sequencia, value_charged, unit_value, total_value, professional_name, professional_cns, professional_cbo, billing_status, billing_date, payment_date, notes, descricao_original, match_status, match_confidence, observacoes, care_modality, care_character, status, authorization_type, cnes, codigo_procedimento_original, competencia)
  select spr.hospital_id,
         coalesce(p.id, null),
         a.id,
         coalesce(spr.procedure_code, spr.codigo_procedimento_original), spr.procedure_name, spr.procedure_description, coalesce(spr.procedure_date, spr.execution_date), spr.quantity, spr.sequencia, spr.value_charged, spr.unit_value, spr.total_value, coalesce(spr.professional_name, spr.professional), spr.professional_cns, spr.professional_cbo, spr.billing_status, spr.billing_date, spr.payment_date, spr.notes, spr.descricao_original, spr.match_status, spr.match_confidence, spr.observacoes, spr.care_modality, spr.care_character, spr.status, spr.authorization_type, spr.cnes, spr.codigo_procedimento_original, spr.competencia
  from public.staging_procedure_records spr
  join public.aihs a on a.hospital_id = spr.hospital_id and a.aih_number = spr.aih_number
  left join public.patients p on p.hospital_id = spr.hospital_id and p.cns = (select sp.cns from public.staging_patients sp where sp.hospital_id = spr.hospital_id and sp.patient_key = spr.patient_key limit 1)
  where spr.hospital_id = p_hospital_id;

  return json_build_object('patients_staging', v_patients_from_staging, 'patients_aihs', v_patients_from_aihs, 'aihs', v_aihs_upserted, 'procedures', v_procs_inserted);
end; $$ language plpgsql;
