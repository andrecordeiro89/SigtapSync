-- =====================================================
-- VERIFICAÇÃO FINAL - PERSISTÊNCIA SIGTAP
-- Execute para confirmar que tudo está funcionando
-- =====================================================

SELECT '🎯 VERIFICAÇÃO FINAL DA PERSISTÊNCIA SIGTAP' as titulo;

-- 1. DADOS SALVOS
SELECT 
    '📊 DADOS SALVOS' as secao,
    COUNT(*) as total_procedimentos,
    MIN(code) as primeiro_codigo,
    MAX(code) as ultimo_codigo,
    COUNT(DISTINCT version_id) as versoes_diferentes
FROM sigtap_procedures;

-- 2. VERSÃO ATIVA
SELECT 
    '✅ VERSÃO ATIVA' as secao,
    version_name as nome_versao,
    total_procedures as procedimentos_declarados,
    is_active as ativa,
    to_char(created_at, 'DD/MM/YYYY HH24:MI') as criada_em
FROM sigtap_versions 
WHERE is_active = true;

-- 3. AMOSTRA DE DADOS (o que o frontend vai carregar)
SELECT 
    '🔍 AMOSTRA DE DADOS' as secao,
    sp.code as codigo,
    LEFT(sp.description, 50) || '...' as descricao_resumida,
    sp.value_amb as valor_ambulatorial,
    sp.value_hosp as valor_hospitalar,
    sp.value_prof as valor_profissional
FROM sigtap_procedures sp
JOIN sigtap_versions sv ON sp.version_id = sv.id
WHERE sv.is_active = true
ORDER BY sp.code
LIMIT 5;

-- 4. ESTATÍSTICAS FINAIS
SELECT 
    '📈 ESTATÍSTICAS FINAIS' as secao,
    (SELECT COUNT(*) FROM sigtap_procedures) as total_procedimentos,
    (SELECT COUNT(*) FROM sigtap_versions WHERE is_active = true) as versoes_ativas,
    CASE 
        WHEN (SELECT COUNT(*) FROM sigtap_procedures) >= 4000 THEN '✅ EXCELENTE'
        WHEN (SELECT COUNT(*) FROM sigtap_procedures) >= 2000 THEN '⚠️ BOM'
        ELSE '❌ INSUFICIENTE'
    END as status_dados,
    CASE 
        WHEN (SELECT COUNT(*) FROM sigtap_versions WHERE is_active = true) = 1 THEN '✅ CORRETO'
        WHEN (SELECT COUNT(*) FROM sigtap_versions WHERE is_active = true) = 0 THEN '❌ SEM VERSÃO ATIVA'
        ELSE '⚠️ MÚLTIPLAS VERSÕES'
    END as status_versao;

-- 5. RESULTADO FINAL
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM sigtap_procedures) >= 4000 
        AND (SELECT COUNT(*) FROM sigtap_versions WHERE is_active = true) = 1
        THEN '🎉 PERSISTÊNCIA CONFIRMADA! Todos os usuários devem ver os dados.'
        ELSE '⚠️ PRECISA CORREÇÃO - Execute fix_persistencia_sigtap_URGENTE.sql'
    END as resultado_final;

-- 🎯 VERIFICAÇÃO FINAL: Tabelas procedure_records e aih_matches POPULADAS
-- Execute após processar uma AIH multi-página

-- ✅ 1. CONTADORES GERAIS
SELECT 
  'CONTADORES GERAIS' as secao,
  (SELECT COUNT(*) FROM patients) as total_pacientes,
  (SELECT COUNT(*) FROM aihs) as total_aihs,
  (SELECT COUNT(*) FROM procedure_records) as total_procedimentos,
  (SELECT COUNT(*) FROM aih_matches) as total_matches;

-- ✅ 2. ÚLTIMAS AIHs PROCESSADAS
SELECT 
  'ULTIMAS AIHS PROCESSADAS' as secao,
  id,
  aih_number,
  total_procedures,
  calculated_total_value,
  processing_status,
  created_at
FROM aihs 
ORDER BY created_at DESC 
LIMIT 5;

-- ✅ 3. PROCEDIMENTOS DA ÚLTIMA AIH
WITH ultima_aih AS (
  SELECT id FROM aihs ORDER BY created_at DESC LIMIT 1
)
SELECT 
  'PROCEDIMENTOS ULTIMA AIH' as secao,
  pr.procedure_code,
  pr.procedure_name,
  pr.execution_date,
  pr.professional_name,
  pr.unit_value::float / 100 as valor_reais,
  pr.notes,
  pr.status,
  pr.created_at
FROM procedure_records pr
JOIN ultima_aih ua ON pr.aih_id = ua.id
ORDER BY pr.notes; -- Para ordenar por sequência

-- ✅ 4. MATCHES DA ÚLTIMA AIH
WITH ultima_aih AS (
  SELECT id FROM aihs ORDER BY created_at DESC LIMIT 1
)
SELECT 
  'MATCHES ULTIMA AIH' as secao,
  am.id,
  sp.code as procedure_code,
  sp.name as procedure_name,
  am.calculated_total::float / 100 as valor_total_reais,
  am.match_confidence::float / 100 as confidence_percent,
  am.status,
  am.created_at
FROM aih_matches am
JOIN ultima_aih ua ON am.aih_id = ua.id
LEFT JOIN sigtap_procedures sp ON am.procedure_id = sp.id
ORDER BY am.created_at;

-- ✅ 5. ESTATÍSTICAS POR HOSPITAL
SELECT 
  'ESTATISTICAS POR HOSPITAL' as secao,
  h.name as hospital,
  COUNT(DISTINCT p.id) as total_pacientes,
  COUNT(DISTINCT a.id) as total_aihs,
  COUNT(pr.id) as total_procedimentos,
  COUNT(am.id) as total_matches,
  AVG(a.total_procedures) as media_procs_por_aih
FROM hospitals h
LEFT JOIN patients p ON p.hospital_id = h.id
LEFT JOIN aihs a ON a.patient_id = p.id
LEFT JOIN procedure_records pr ON pr.aih_id = a.id
LEFT JOIN aih_matches am ON am.aih_id = a.id
GROUP BY h.id, h.name
ORDER BY total_aihs DESC;

-- ✅ 6. VERIFICAÇÃO DE INTEGRIDADE
SELECT 
  'VERIFICACAO INTEGRIDADE' as secao,
  COUNT(*) as aihs_sem_procedimentos
FROM aihs a
LEFT JOIN procedure_records pr ON pr.aih_id = a.id
WHERE pr.id IS NULL;

SELECT 
  'VERIFICACAO MATCHES' as secao,
  COUNT(*) as procedimentos_sem_match
FROM procedure_records pr
LEFT JOIN aih_matches am ON am.aih_id = pr.aih_id
WHERE am.id IS NULL;

-- ✅ 7. RESUMO FINANCEIRO
SELECT 
  'RESUMO FINANCEIRO' as secao,
  COUNT(*) as total_procedimentos,
  SUM(total_value)::float / 100 as soma_total_reais,
  AVG(total_value)::float / 100 as media_valor_reais,
  MAX(total_value)::float / 100 as maior_valor_reais,
  MIN(total_value)::float / 100 as menor_valor_reais
FROM procedure_records
WHERE total_value > 0;

-- 🎯 RESULTADO ESPERADO:
-- ✅ procedure_records > 0 (todos os procedimentos salvos)
-- ✅ aih_matches > 0 (matches SIGTAP salvos)
-- ✅ AIHs com total_procedures correto
-- ✅ Integridade: 0 AIHs sem procedimentos
-- ✅ Valores em reais corretos (não em centavos) 