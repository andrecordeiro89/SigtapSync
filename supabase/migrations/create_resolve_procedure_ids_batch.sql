-- Ensure clean redeploy
drop function if exists public.resolve_procedure_ids_batch(text[], uuid) cascade;
drop function if exists public.get_latest_sigtap_version() cascade;

-- Create helper to get latest active SIGTAP version
create or replace function public.get_latest_sigtap_version()
returns uuid
language sql
security definer
as $$
  select id
  from public.sigtap_versions
  where is_active = true
  order by created_at desc
  limit 1;
$$;

-- Batch resolver: map SIGTAP codes to procedure IDs and descriptions
create or replace function public.resolve_procedure_ids_batch(
  p_codes text[],
  p_version_id uuid default public.get_latest_sigtap_version()
)
returns table (code text, procedure_id uuid, description text)
language sql
security definer
as $$
  select sp.code, sp.id as procedure_id, sp.description
  from public.sigtap_procedures sp
  join public.sigtap_versions v on v.id = sp.version_id
  where sp.code = any(p_codes)
    and (
      (p_version_id is null and v.is_active = true)
      or sp.version_id = p_version_id
    );
$$;

comment on function public.resolve_procedure_ids_batch(text[], uuid)
is 'Resolve a lista de códigos SIGTAP para IDs/descrições da versão ativa (ou específica).';
