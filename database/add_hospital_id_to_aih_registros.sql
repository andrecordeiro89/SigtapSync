-- ================================================================
-- ADICIONAR COLUNA HOSPITAL_ID À TABELA AIH_REGISTROS
-- ================================================================
-- Objetivo: Relacionar registros SISAIH01 com os hospitais cadastrados
-- Relacionamento: aih_registros.cnes_hospital -> hospitals.cnes
-- ================================================================

-- Passo 1: Adicionar coluna hospital_id (UUID nullable)
ALTER TABLE aih_registros 
ADD COLUMN IF NOT EXISTS hospital_id UUID;

-- Passo 2: Comentar a coluna
COMMENT ON COLUMN aih_registros.hospital_id IS 
'Chave estrangeira para hospitals - relacionado automaticamente via CNES';

-- Passo 3: Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_aih_registros_hospital_id 
ON aih_registros(hospital_id);

COMMENT ON INDEX idx_aih_registros_hospital_id IS 
'Índice para filtro por hospital - relacionamento via CNES';

-- Passo 4: Adicionar Foreign Key (sem ON DELETE CASCADE para preservar dados)
ALTER TABLE aih_registros 
ADD CONSTRAINT fk_aih_registros_hospital 
FOREIGN KEY (hospital_id) 
REFERENCES hospitals(id)
ON DELETE SET NULL; -- Se hospital for deletado, apenas limpa a referência

-- Passo 5: Preencher hospital_id existente baseado no CNES
-- (Executar após adicionar a coluna)
UPDATE aih_registros ar
SET hospital_id = h.id
FROM hospitals h
WHERE ar.cnes_hospital IS NOT NULL
  AND h.cnes IS NOT NULL
  AND TRIM(REPLACE(ar.cnes_hospital, '0', '')) = TRIM(REPLACE(h.cnes, '0', ''))
  AND ar.hospital_id IS NULL;

-- Passo 6: Verificar quantos registros foram relacionados
SELECT 
  COUNT(*) FILTER (WHERE hospital_id IS NOT NULL) as relacionados,
  COUNT(*) FILTER (WHERE hospital_id IS NULL) as sem_relacao,
  COUNT(*) as total
FROM aih_registros;

-- Passo 7: Ver CNES que não foram relacionados
SELECT DISTINCT 
  ar.cnes_hospital,
  COUNT(*) as quantidade_registros
FROM aih_registros ar
WHERE ar.hospital_id IS NULL
  AND ar.cnes_hospital IS NOT NULL
  AND ar.cnes_hospital != ''
GROUP BY ar.cnes_hospital
ORDER BY quantidade_registros DESC;

-- ================================================================
-- VIEWS ATUALIZADAS COM HOSPITAL_ID
-- ================================================================

-- Dropar view existente para permitir alteração de estrutura
DROP VIEW IF EXISTS aih_registros_por_hospital;

-- View atualizada para análise por hospital (com nome do hospital)
CREATE VIEW aih_registros_por_hospital AS
SELECT 
  ar.cnes_hospital,
  h.name as nome_hospital,
  h.city as cidade_hospital,
  h.state as estado_hospital,
  COUNT(*) as total_aihs,
  COUNT(DISTINCT ar.cns) as pacientes_unicos,
  COUNT(CASE WHEN ar.sexo = 'M' THEN 1 END) as masculino,
  COUNT(CASE WHEN ar.sexo = 'F' THEN 1 END) as feminino,
  MIN(ar.data_internacao) as primeira_internacao,
  MAX(ar.data_internacao) as ultima_internacao
FROM aih_registros ar
LEFT JOIN hospitals h ON ar.hospital_id = h.id
WHERE ar.cnes_hospital IS NOT NULL
GROUP BY ar.cnes_hospital, h.name, h.city, h.state
ORDER BY total_aihs DESC;

COMMENT ON VIEW aih_registros_por_hospital IS 
'Análise de registros SISAIH01 por hospital com dados completos';

-- ================================================================
-- MENSAGENS DE SUCESSO
-- ================================================================

DO $$
DECLARE
  relacionados INTEGER;
  sem_relacao INTEGER;
  total INTEGER;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE hospital_id IS NOT NULL),
    COUNT(*) FILTER (WHERE hospital_id IS NULL),
    COUNT(*)
  INTO relacionados, sem_relacao, total
  FROM aih_registros;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Coluna hospital_id adicionada com sucesso!';
  RAISE NOTICE '✅ Foreign Key criada: aih_registros -> hospitals';
  RAISE NOTICE '✅ Índice de performance criado';
  RAISE NOTICE '';
  RAISE NOTICE '📊 ESTATÍSTICAS DE RELACIONAMENTO:';
  RAISE NOTICE '   ✅ Registros relacionados: % (%.2f%%)', 
    relacionados, (relacionados::FLOAT / NULLIF(total, 0) * 100);
  RAISE NOTICE '   ⚠️ Registros sem relação: % (%.2f%%)', 
    sem_relacao, (sem_relacao::FLOAT / NULLIF(total, 0) * 100);
  RAISE NOTICE '   📦 Total de registros: %', total;
  RAISE NOTICE '';
  
  IF sem_relacao > 0 THEN
    RAISE NOTICE '💡 DICA: Cadastre os hospitais faltantes no sistema';
    RAISE NOTICE '   Execute o SELECT acima para ver os CNES não relacionados';
  END IF;
END $$;

-- ================================================================
-- FIM DO SCRIPT
-- ================================================================

