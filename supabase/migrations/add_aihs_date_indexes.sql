create index if not exists idx_aihs_hospital_admission on public.aihs (hospital_id, admission_date);
create index if not exists idx_aihs_hospital_discharge on public.aihs (hospital_id, discharge_date) where discharge_date is not null;
create index if not exists idx_aihs_processing_status on public.aihs (processing_status);
create index if not exists idx_aihs_updated_at on public.aihs (updated_at);
