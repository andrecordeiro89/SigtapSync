-- ================================================================
-- FUNÇÕES HELPER PARA O FRONTEND (VERSÃO CORRIGIDA)
-- ================================================================
-- Funções utilitárias que o código TypeScript pode chamar via RPC
-- Execute no SQL Editor do Supabase
-- ================================================================

-- ================================================================
-- FUNÇÃO 1: Obter informações sobre views materializadas
-- ================================================================
CREATE OR REPLACE FUNCTION get_materialized_views_info()
RETURNS TABLE(
  name text,
  size text,
  view_exists boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    matviewname::text as name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname))::text as size,
    true as view_exists
  FROM pg_matviews
  WHERE schemaname = 'public'
  AND matviewname IN (
    'v_doctor_revenue_monthly',
    'v_doctors_aggregated', 
    'v_specialty_revenue_stats',
    'v_hospital_revenue_stats'
  )
  ORDER BY matviewname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- FUNÇÃO 2: Verificar se views materializadas existem
-- ================================================================
CREATE OR REPLACE FUNCTION check_materialized_views_exist()
RETURNS TABLE(
  view_name text,
  view_exists boolean,
  is_materialized boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.view_name::text,
    (mv.matviewname IS NOT NULL) as view_exists,
    (mv.matviewname IS NOT NULL) as is_materialized
  FROM (
    VALUES 
      ('v_doctor_revenue_monthly'),
      ('v_doctors_aggregated'),
      ('v_specialty_revenue_stats'),
      ('v_hospital_revenue_stats')
  ) AS v(view_name)
  LEFT JOIN pg_matviews mv 
    ON mv.schemaname = 'public' 
    AND mv.matviewname = v.view_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- FUNÇÃO 3: Obter estatísticas de performance das views
-- ================================================================
CREATE OR REPLACE FUNCTION get_views_performance_stats()
RETURNS TABLE(
  view_name text,
  total_rows bigint,
  last_vacuum timestamp,
  last_analyze timestamp
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.relname::text as view_name,
    c.reltuples::bigint as total_rows,
    pg_stat_get_last_vacuum_time(c.oid) as last_vacuum,
    pg_stat_get_last_analyze_time(c.oid) as last_analyze
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
  AND c.relkind = 'm' -- materialized views
  AND c.relname IN (
    'v_doctor_revenue_monthly',
    'v_doctors_aggregated', 
    'v_specialty_revenue_stats',
    'v_hospital_revenue_stats'
  )
  ORDER BY c.relname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- COMENTÁRIOS DE DOCUMENTAÇÃO
-- ================================================================
COMMENT ON FUNCTION get_materialized_views_info() IS 
'Retorna informações sobre as views materializadas (nome, tamanho, se existe)';

COMMENT ON FUNCTION check_materialized_views_exist() IS 
'Verifica se as views materializadas existem no banco';

COMMENT ON FUNCTION get_views_performance_stats() IS 
'Retorna estatísticas de performance das views materializadas';

-- ================================================================
-- VERIFICAÇÃO: Testar se as funções foram criadas
-- ================================================================
SELECT 
  proname as function_name,
  'OK' as status
FROM pg_proc
WHERE proname IN (
  'get_materialized_views_info',
  'check_materialized_views_exist',
  'get_views_performance_stats',
  'refresh_revenue_views'
)
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- ================================================================
-- TESTE RÁPIDO: Chamar as funções
-- ================================================================
-- Teste 1: Ver informações das views
SELECT * FROM get_materialized_views_info();

-- Teste 2: Verificar se existem
SELECT * FROM check_materialized_views_exist();

-- ================================================================
-- RESULTADO ESPERADO:
-- Teste 1:
--   v_doctors_aggregated         | XX KB | true
--   v_doctor_revenue_monthly     | XX KB | true
--   v_hospital_revenue_stats     | XX KB | true
--   v_specialty_revenue_stats    | XX KB | true
--
-- Teste 2:
--   v_doctors_aggregated         | true  | true
--   v_doctor_revenue_monthly     | true  | true
--   v_hospital_revenue_stats     | true  | true
--   v_specialty_revenue_stats    | true  | true
-- ================================================================

