create or replace function public.repair_aih_by_number(p_hospital_id uuid, p_aih_number text)
returns table (updated_count integer)
language plpgsql
security definer
as $$
declare
  v_aih_id uuid;
  v_codes text[];
  v_updated integer := 0;
begin
  select id into v_aih_id
  from public.aihs
  where hospital_id = p_hospital_id and aih_number = p_aih_number
  limit 1;

  if v_aih_id is null then
    return query select 0;
    return;
  end if;

  select array_agg(distinct pr.procedure_code) into v_codes
  from public.procedure_records pr
  where pr.aih_id = v_aih_id;

  if v_codes is null or array_length(v_codes, 1) is null then
    return query select 0;
    return;
  end if;

  -- Map codes to IDs/descriptions on active version
  with resolved as (
    select sp.code, sp.id as procedure_id, sp.description
    from public.sigtap_procedures sp
    join public.sigtap_versions v on v.id = sp.version_id
    where sp.code = any(v_codes) and v.is_active = true
  )
  update public.procedure_records pr
  set match_status = 'matched',
      procedure_id = coalesce(pr.procedure_id, r.procedure_id),
      procedure_description = case
        when pr.procedure_description is null or pr.procedure_description like 'Procedimento%'
        then r.description
        else pr.procedure_description
      end,
      updated_at = now()
  from resolved r
  where pr.aih_id = v_aih_id and pr.procedure_code = r.code;

  get diagnostics v_updated = row_count;

  -- refresh AIH stats
  update public.aihs a
  set approved_procedures = (select count(*) from public.procedure_records pr where pr.aih_id = a.id and pr.match_status = 'matched'),
      total_procedures = (select count(*) from public.procedure_records pr where pr.aih_id = a.id),
      updated_at = now()
  where a.id = v_aih_id;

  return query select v_updated;
end;
$$;

comment on function public.repair_aih_by_number(uuid, text)
is 'Atualiza procedimentos de uma AIH para status matched e preenche descrição/ID a partir do SIGTAP ativo.';
