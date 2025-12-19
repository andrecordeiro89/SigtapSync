CREATE INDEX IF NOT EXISTS idx_aihs_hospital_competencia ON public.aihs(hospital_id, competencia);
CREATE INDEX IF NOT EXISTS idx_aihs_hospital_admission ON public.aihs(hospital_id, admission_date);
CREATE INDEX IF NOT EXISTS idx_aihs_hospital_discharge ON public.aihs(hospital_id, discharge_date);
CREATE INDEX IF NOT EXISTS idx_aihs_procedure_code ON public.aihs(procedure_code);
CREATE INDEX IF NOT EXISTS idx_aihs_aih_number ON public.aihs(aih_number);

CREATE INDEX IF NOT EXISTS idx_proc_records_hospital_date ON public.procedure_records(hospital_id, procedure_date);
CREATE INDEX IF NOT EXISTS idx_proc_records_hospital_competencia ON public.procedure_records(hospital_id, competencia);
CREATE INDEX IF NOT EXISTS idx_proc_records_procedure_code ON public.procedure_records(procedure_code);
CREATE INDEX IF NOT EXISTS idx_proc_records_match_status ON public.procedure_records(match_status);
CREATE INDEX IF NOT EXISTS idx_proc_records_aih_id ON public.procedure_records(aih_id);
CREATE INDEX IF NOT EXISTS idx_proc_records_billing_status ON public.procedure_records(billing_status);
