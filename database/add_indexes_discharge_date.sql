-- Índices para otimizar filtros por data de alta (discharge_date)
-- Janela de consulta padrão: [início do dia, início do próximo dia)

-- Índice simples por discharge_date
CREATE INDEX IF NOT EXISTS idx_aihs_discharge_date
ON aihs(discharge_date);

-- Índice composto por hospital e discharge_date para recortes por hospital
CREATE INDEX IF NOT EXISTS idx_aihs_hospital_discharge_date
ON aihs(hospital_id, discharge_date);


