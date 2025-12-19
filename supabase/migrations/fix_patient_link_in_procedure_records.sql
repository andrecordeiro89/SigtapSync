-- Alinhar patient_id dos procedimentos ao patient_id da AIH vinculada
UPDATE public.procedure_records pr
SET patient_id = a.patient_id
FROM public.aihs a
WHERE pr.aih_id = a.id
  AND a.patient_id IS NOT NULL
  AND (pr.patient_id IS DISTINCT FROM a.patient_id);

-- Corrigir procedimentos com patient_id nulo quando AIH possui paciente
UPDATE public.procedure_records pr
SET patient_id = a.patient_id
FROM public.aihs a
WHERE pr.aih_id = a.id
  AND pr.patient_id IS NULL
  AND a.patient_id IS NOT NULL;

-- Opcional: bloquear futuras divergências via trigger simples (somente se necessário)
-- create or replace function public.pr_enforce_patient_link()
-- returns trigger as $$
-- begin
--   if NEW.aih_id is not null then
--     select patient_id into strict NEW.patient_id from public.aihs where id = NEW.aih_id;
--   end if;
--   return NEW;
-- end; $$ language plpgsql;
-- drop trigger if exists trg_pr_enforce_patient_link on public.procedure_records;
-- create trigger trg_pr_enforce_patient_link before insert or update on public.procedure_records
-- for each row execute function public.pr_enforce_patient_link();
