CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_aihs_hospital_admission_discharge 
ON aihs(hospital_id, admission_date, discharge_date)
WHERE hospital_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aihs_cns_responsavel_active 
ON aihs(cns_responsavel, hospital_id, admission_date)
WHERE cns_responsavel IS NOT NULL 
  AND processing_status IN ('matched', 'approved');

CREATE INDEX IF NOT EXISTS idx_aihs_total_value 
ON aihs(calculated_total_value)
WHERE calculated_total_value IS NOT NULL 
  AND calculated_total_value > 0;

CREATE INDEX IF NOT EXISTS idx_procedure_records_aih_status_value 
ON procedure_records(aih_id, match_status, total_value)
WHERE match_status IN ('approved', 'matched', 'manual');

CREATE INDEX IF NOT EXISTS idx_procedure_records_patient_status 
ON procedure_records(patient_id, match_status, procedure_date DESC)
WHERE match_status IN ('approved', 'matched', 'manual');

CREATE INDEX IF NOT EXISTS idx_procedure_records_cbo_code 
ON procedure_records(professional_cbo, procedure_code)
WHERE professional_cbo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_doctors_cns_active 
ON doctors(cns, name, specialty, crm)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_doctors_name_trgm 
ON doctors USING gin(name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_hospitals_id_name_cnes 
ON hospitals(id, name, cnes);

CREATE INDEX IF NOT EXISTS idx_patients_name_trgm 
ON patients USING gin(name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_patients_cns 
ON patients(cns)
WHERE cns IS NOT NULL;

ANALYZE aihs;
ANALYZE procedure_records;
ANALYZE doctors;
ANALYZE hospitals;
ANALYZE patients;
