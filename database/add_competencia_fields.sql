-- Adiciona campo de competência (mês de competência) para AIHs e Procedure Records
-- Armazena como DATE no primeiro dia do mês (ex.: 2025-03-01)

-- AIHs
ALTER TABLE IF EXISTS aihs
  ADD COLUMN IF NOT EXISTS competencia DATE;

CREATE INDEX IF NOT EXISTS idx_aihs_competencia
  ON aihs(hospital_id, competencia);

-- Procedure Records
ALTER TABLE IF EXISTS procedure_records
  ADD COLUMN IF NOT EXISTS competencia DATE;

CREATE INDEX IF NOT EXISTS idx_procedure_records_competencia
  ON procedure_records(hospital_id, competencia);

-- Backfill inicial: usar mês da data de alta se existir; caso contrário, mês da admissão
UPDATE aihs
SET competencia = COALESCE(date_trunc('month', discharge_date), date_trunc('month', admission_date))
WHERE competencia IS NULL;

-- Opcional: propagar competência da AIH para procedure_records sem competência
UPDATE procedure_records pr
SET competencia = a.competencia
FROM aihs a
WHERE pr.aih_id = a.id
  AND pr.competencia IS NULL
  AND a.competencia IS NOT NULL;


