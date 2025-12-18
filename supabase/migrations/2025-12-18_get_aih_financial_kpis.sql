create or replace function public.get_aih_financial_kpis(
  hospital_ids text[] default null,
  competencia text default null,
  care_character text default null,
  discharge_from date default null,
  discharge_to date default null,
  doctor_name text default null,
  patient_name text default null
) returns table(
  sigtap_total_value numeric,
  increment_total numeric,
  increment_elective numeric,
  increment_urgency numeric,
  total_value numeric,
  medical_payment_total numeric
)
language sql
stable
as $$
  with base as (
    select
      a.id as aih_id,
      a.care_character,
      upper(coalesce(d.name, '')) as doctor_name,
      coalesce(sum(case 
        when pr.total_value is not null then pr.total_value 
        else 0 end), 0) as sigtap_total_cents,
      coalesce(sum(case 
        when pr.total_value is not null and regexp_replace(coalesce(pr.procedure_code, ''), '[\\.\\s-]', '', 'g') like '04%' then pr.total_value 
        else 0 end), 0) as medical_cents,
      array_agg(coalesce(pr.procedure_code, '')) as procedure_codes,
      array_agg(coalesce(pr.total_value, 0)) as procedure_values
    from public.aihs a
    left join public.patients p on p.id = a.patient_id
    left join public.doctors d on d.cns = a.cns_responsavel
    left join public.procedure_records pr on pr.aih_id = a.id
    where (hospital_ids is null or a.hospital_id = any (hospital_ids))
      and (competencia is null or a.competencia = competencia)
      and (care_character is null or a.care_character = care_character)
      and (
        (discharge_from is null and discharge_to is null)
        or (
          a.discharge_date is not null
          and (discharge_from is null or a.discharge_date >= discharge_from::timestamp)
          and (discharge_to is null or a.discharge_date < (discharge_to::timestamp + interval '1 day'))
        )
      )
      and (patient_name is null or (p.name is not null and p.name ilike '%' || patient_name || '%'))
      and (doctor_name is null or (d.name is not null and d.name ilike '%' || doctor_name || '%'))
      and (pr.total_value is null or pr.total_value >= 0)
    group by a.id, a.care_character, d.name
  ),
  excluded as (
    select unnest(array[
      '0408040092','0408040050','0408040068','0408040084','0408040076',
      '0408050063','0408050047','0408050071','0408050055','0408050160','0408050896',
      '0404010016','0404010024','0404010032','0404010350','0404010415','0404010482','0404010520','0404010334','0404010326','0404010512'
    ]) as code_norm
  ),
  calc as (
    select
      b.aih_id,
      b.sigtap_total_cents,
      b.medical_cents,
      case 
        when coalesce(regexp_replace(coalesce(b.care_character::text, ''), '^0+', '', 'g'), '') = '1'
             and b.doctor_name not in ('HUMBERTO MOREIRA DA SILVA')
        then (
          select coalesce(sum(val_reais), 0) * 1.5
          from unnest(b.procedure_codes, b.procedure_values) as u(code, cents)
          where regexp_replace(coalesce(code, ''), '[\\.\\s-]', '', 'g') not in (select code_norm from excluded)
        )
        else 0
      end as inc_elective,
      case 
        when coalesce(regexp_replace(coalesce(b.care_character::text, ''), '^0+', '', 'g'), '') = '2'
        then (
          select coalesce(sum(val_reais), 0) * 0.2
          from unnest(b.procedure_codes, b.procedure_values) as u(code, cents)
          where regexp_replace(coalesce(code, ''), '[\\.\\s-]', '', 'g') not in (select code_norm from excluded)
        )
        else 0
      end as inc_urgency
    from (
      select 
        aih_id,
        care_character,
        doctor_name,
        sigtap_total_cents,
        medical_cents,
        procedure_codes,
        procedure_values,
        (select array_agg(cents/100.0) from unnest(procedure_values) cents) as procedure_values_reais
      from base
    ) b,
    lateral (
      select 1
    ) l
  )
  select
    coalesce(sum(b.sigtap_total_cents), 0) / 100.0 as sigtap_total_value,
    coalesce(sum(c.inc_elective), 0) + coalesce(sum(c.inc_urgency), 0) as increment_total,
    coalesce(sum(c.inc_elective), 0) as increment_elective,
    coalesce(sum(c.inc_urgency), 0) as increment_urgency,
    (coalesce(sum(b.sigtap_total_cents), 0) / 100.0) + (coalesce(sum(c.inc_elective), 0) + coalesce(sum(c.inc_urgency), 0)) as total_value,
    coalesce(sum(b.medical_cents), 0) / 100.0 as medical_payment_total
  from base b
  left join calc c on c.aih_id = b.aih_id;
$$;

grant execute on function public.get_aih_financial_kpis to authenticated;
