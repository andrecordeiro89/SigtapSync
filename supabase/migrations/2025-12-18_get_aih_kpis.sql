create or replace function public.get_aih_kpis(
  hospital_ids uuid[] default null,
  competencia date default null,
  care_character text default null,
  discharge_from date default null,
  discharge_to date default null,
  doctor_name text default null,
  patient_name text default null
) returns table(
  total_aihs integer,
  total_value numeric,
  average_ticket numeric
)
language sql
stable
as $$
  select
    count(*)::int as total_aihs,
    (coalesce(sum(a.calculated_total_value), 0)::numeric / 100.0) as total_value,
    case
      when count(*) > 0
      then (coalesce(sum(a.calculated_total_value), 0)::numeric / 100.0) / count(*)
      else 0
    end as average_ticket
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

grant execute on function public.get_aih_kpis(uuid[], date, text, date, date, text, text) to authenticated;
