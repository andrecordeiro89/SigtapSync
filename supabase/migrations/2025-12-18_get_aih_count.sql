-- RPC otimizada para contagem de AIHs com filtros
create or replace function public.get_aih_count(
  hospital_ids uuid[] default null,
  competencia date default null,
  care_character text default null,
  discharge_from date default null,
  discharge_to date default null,
  doctor_name text default null,
  patient_name text default null
) returns integer
language sql
stable
as $$
  select count(*)
  from public.aihs a
  left join public.patients p on p.id = a.patient_id
  left join public.doctors d on d.cns = a.cns_responsavel
  where (hospital_ids is null or a.hospital_id = any (hospital_ids))
    and (competencia is null or a.competencia = competencia)
    and (care_character is null or a.care_character = care_character)
    and (
      (discharge_from is null and discharge_to is null)
      or (
        a.discharge_date is not null
        and (discharge_from is null or a.discharge_date >= discharge_from::timestamptz)
        and (discharge_to is null or a.discharge_date < (discharge_to::timestamptz + interval '1 day'))
      )
    )
    and (patient_name is null or (p.name is not null and p.name ilike '%' || patient_name || '%'))
    and (doctor_name is null or (d.name is not null and d.name ilike '%' || doctor_name || '%'));
$$;

grant execute on function public.get_aih_count(uuid[], date, text, date, date, text, text) to authenticated;
