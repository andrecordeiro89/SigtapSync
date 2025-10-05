-- ================================================================
-- ÍNDICES DE PERFORMANCE PARA OTIMIZAÇÃO DO SISTEMA
-- ================================================================
-- Criado em: 05/10/2025
-- Propósito: Otimizar queries da tela Analytics - Aba Profissionais
-- Impacto Esperado: Redução de 50-70% no tempo de carregamento
-- ================================================================

-- ================================================================
-- PASSO 1: CRIAR EXTENSÕES NECESSÁRIAS
-- ================================================================
-- ⚠️ IMPORTANTE: Criar extensão pg_trgm ANTES dos índices que a utilizam

-- Criar extensão pg_trgm (necessária para busca textual com trigram)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

COMMENT ON EXTENSION pg_trgm IS 
'Suporte para busca textual com trigram - usado em índices de nome de médicos e pacientes';

-- Verificar se a extensão foi criada
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    RAISE EXCEPTION 'Extensão pg_trgm não foi criada. Verifique permissões.';
  ELSE
    RAISE NOTICE '✅ Extensão pg_trgm criada com sucesso';
  END IF;
END $$;

-- ================================================================
-- PASSO 2: ÍNDICES PARA TABELA AIHS
-- ================================================================

-- 🚀 OTIMIZAÇÃO #2.1: Índice composto para filtro de hospital + data
-- Usado em: getDoctorsWithPatientsFromProceduresView
-- Query: WHERE hospital_id IN (...) AND admission_date >= ... AND admission_date <= ...
CREATE INDEX IF NOT EXISTS idx_aihs_hospital_admission_discharge 
ON aihs(hospital_id, admission_date, discharge_date)
WHERE hospital_id IS NOT NULL;

COMMENT ON INDEX idx_aihs_hospital_admission_discharge IS 
'Otimiza filtros por hospital e período de admissão/alta - Aba Profissionais';

-- 🚀 OTIMIZAÇÃO #2.2: Índice para busca por médico responsável
-- Usado em: Agrupamento de AIHs por médico
-- Query: WHERE cns_responsavel = ...
CREATE INDEX IF NOT EXISTS idx_aihs_cns_responsavel_active 
ON aihs(cns_responsavel, hospital_id, admission_date)
WHERE cns_responsavel IS NOT NULL 
  AND processing_status IN ('matched', 'approved');

COMMENT ON INDEX idx_aihs_cns_responsavel_active IS 
'Otimiza busca de AIHs por médico responsável (CNS) - Agrupamento hierárquico';

-- 🚀 OTIMIZAÇÃO #2.3: Índice para calculated_total_value
-- Usado em: Cálculo de KPIs e valores totais
CREATE INDEX IF NOT EXISTS idx_aihs_total_value 
ON aihs(calculated_total_value)
WHERE calculated_total_value IS NOT NULL 
  AND calculated_total_value > 0;

COMMENT ON INDEX idx_aihs_total_value IS 
'Otimiza cálculos de valores totais e KPIs financeiros';

-- ================================================================
-- ÍNDICES PARA TABELA PROCEDURE_RECORDS
-- ================================================================

-- 🚀 OTIMIZAÇÃO #2.4: Índice composto para vincular procedimentos com AIHs
-- Usado em: getProceduresByAihIds
-- Query: WHERE aih_id IN (...) AND match_status IN (...)
CREATE INDEX IF NOT EXISTS idx_procedure_records_aih_status_value 
ON procedure_records(aih_id, match_status, total_value)
WHERE match_status IN ('approved', 'matched', 'manual');

COMMENT ON INDEX idx_procedure_records_aih_status_value IS 
'Otimiza carregamento de procedimentos por AIH com filtro de status';

-- 🚀 OTIMIZAÇÃO #2.5: Índice para busca por paciente
-- Usado em: getProceduresByPatientIds
-- Query: WHERE patient_id IN (...) AND match_status IN (...)
CREATE INDEX IF NOT EXISTS idx_procedure_records_patient_status 
ON procedure_records(patient_id, match_status, procedure_date DESC)
WHERE match_status IN ('approved', 'matched', 'manual');

COMMENT ON INDEX idx_procedure_records_patient_status IS 
'Otimiza carregamento de procedimentos por paciente';

-- 🚀 OTIMIZAÇÃO #2.6: Índice para CBO (filtro de anestesistas)
-- Usado em: Exclusão de anestesistas 04.xxx dos cálculos
-- Query: WHERE professional_cbo = '225151' AND procedure_code LIKE '04%'
CREATE INDEX IF NOT EXISTS idx_procedure_records_cbo_code 
ON procedure_records(professional_cbo, procedure_code)
WHERE professional_cbo IS NOT NULL;

COMMENT ON INDEX idx_procedure_records_cbo_code IS 
'Otimiza filtro de anestesistas e procedimentos específicos';

-- ================================================================
-- ÍNDICES PARA TABELA DOCTORS
-- ================================================================

-- 🚀 OTIMIZAÇÃO #2.7: Índice para busca por CNS (lista de médicos)
-- Usado em: Query paralela de dados dos médicos
-- Query: WHERE cns IN (...)
CREATE INDEX IF NOT EXISTS idx_doctors_cns_active 
ON doctors(cns, name, specialty, crm)
WHERE is_active = true;

COMMENT ON INDEX idx_doctors_cns_active IS 
'Otimiza busca de dados de médicos por CNS - Query paralela';

-- 🚀 OTIMIZAÇÃO #2.8: Índice para busca por nome (filtros)
-- Usado em: Filtro de busca por nome de médico
-- Query: WHERE name ILIKE '%...'
CREATE INDEX IF NOT EXISTS idx_doctors_name_trgm 
ON doctors USING gin(name gin_trgm_ops);

COMMENT ON INDEX idx_doctors_name_trgm IS 
'Otimiza busca textual por nome de médico (trigram)';

-- ================================================================
-- ÍNDICES PARA TABELA HOSPITALS
-- ================================================================

-- 🚀 OTIMIZAÇÃO #2.9: Índice para busca rápida de hospitais
-- Usado em: Query paralela de dados dos hospitais
-- Query: WHERE id IN (...)
CREATE INDEX IF NOT EXISTS idx_hospitals_id_name_cnes 
ON hospitals(id, name, cnes);

COMMENT ON INDEX idx_hospitals_id_name_cnes IS 
'Otimiza busca de dados de hospitais - Query paralela';

-- ================================================================
-- ÍNDICES PARA TABELA PATIENTS
-- ================================================================

-- 🚀 OTIMIZAÇÃO #2.10: Índice para busca por nome de paciente
-- Usado em: Filtro de busca por nome de paciente
-- Query: WHERE name ILIKE '%...'
CREATE INDEX IF NOT EXISTS idx_patients_name_trgm 
ON patients USING gin(name gin_trgm_ops);

COMMENT ON INDEX idx_patients_name_trgm IS 
'Otimiza busca textual por nome de paciente (trigram)';

-- 🚀 OTIMIZAÇÃO #2.11: Índice para busca por CNS de paciente
-- Usado em: Identificação única de pacientes
CREATE INDEX IF NOT EXISTS idx_patients_cns 
ON patients(cns)
WHERE cns IS NOT NULL;

COMMENT ON INDEX idx_patients_cns IS 
'Otimiza busca de pacientes por CNS';

-- ================================================================
-- ESTATÍSTICAS E MANUTENÇÃO
-- ================================================================

-- Atualizar estatísticas das tabelas para otimizador de queries
ANALYZE aihs;
ANALYZE procedure_records;
ANALYZE doctors;
ANALYZE hospitals;
ANALYZE patients;

-- ================================================================
-- VERIFICAÇÃO DE ÍNDICES CRIADOS
-- ================================================================

-- Query para verificar índices criados
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ================================================================
-- ESTIMATIVA DE IMPACTO
-- ================================================================

/*
ANTES (sem índices otimizados):
- Query AIHs: ~500ms (scan sequencial)
- Query Procedimentos: ~800ms (scan sequencial)
- Query Médicos: ~200ms (scan sequencial)
- TOTAL: ~1500ms

DEPOIS (com índices otimizados):
- Query AIHs: ~150ms (index scan)
- Query Procedimentos: ~250ms (index scan)
- Query Médicos: ~50ms (index scan)
- TOTAL: ~450ms

MELHORIA ESPERADA: 70% mais rápido ✅
*/

-- ================================================================
-- NOTAS DE MANUTENÇÃO
-- ================================================================

/*
1. REINDEX PERIÓDICO (recomendado mensalmente):
   REINDEX TABLE aihs;
   REINDEX TABLE procedure_records;
   REINDEX TABLE doctors;

2. VACUUM ANALYZE (recomendado semanalmente):
   VACUUM ANALYZE aihs;
   VACUUM ANALYZE procedure_records;

3. MONITORAMENTO:
   - Verificar tamanho dos índices: pg_indexes_size('table_name')
   - Verificar uso dos índices: pg_stat_user_indexes
   - Identificar índices não usados para remoção

4. EXTENSÕES NECESSÁRIAS:
   - pg_trgm (para busca textual): CREATE EXTENSION IF NOT EXISTS pg_trgm;
*/

-- ✅ Extensão pg_trgm já foi criada no início do script
