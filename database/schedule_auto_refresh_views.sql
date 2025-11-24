-- ================================================================
-- AGENDAMENTO AUTOMÁTICO DE REFRESH DAS VIEWS
-- ================================================================
-- Este script cria um agendamento para atualizar as views 
-- materializadas automaticamente a cada 1 hora
-- ================================================================

-- ================================================================
-- OPÇÃO 1: USAR PG_CRON (se disponível no Supabase)
-- ================================================================
-- Verificar se pg_cron está habilitado:
-- SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Se pg_cron estiver disponível, agendar refresh a cada hora:
-- SELECT cron.schedule(
--   'refresh-revenue-views',           -- nome do job
--   '0 * * * *',                        -- a cada hora (minuto 0)
--   'SELECT refresh_revenue_views();'   -- comando a executar
-- );

-- ================================================================
-- OPÇÃO 2: TRIGGER AUTOMÁTICO (Atualizar quando dados mudam)
-- ================================================================
-- Criar função trigger que refresha as views quando procedure_records muda

CREATE OR REPLACE FUNCTION trigger_refresh_revenue_views()
RETURNS TRIGGER AS $$
BEGIN
  -- Executar refresh em background (não bloqueia)
  PERFORM refresh_revenue_views();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger que dispara após INSERT/UPDATE/DELETE em procedure_records
-- NOTA: Isso pode ser pesado se houver muitas operações
-- Considere usar apenas em horários específicos ou em lotes

-- DROP TRIGGER IF EXISTS after_procedure_change ON procedure_records;
-- CREATE TRIGGER after_procedure_change
-- AFTER INSERT OR UPDATE OR DELETE ON procedure_records
-- FOR EACH STATEMENT
-- EXECUTE FUNCTION trigger_refresh_revenue_views();

-- ================================================================
-- OPÇÃO 3: REFRESH MANUAL (RECOMENDADO)
-- ================================================================
-- Execute este comando manualmente ou via cron job externo:
-- SELECT refresh_revenue_views();

-- Ou via API/código TypeScript em horários estratégicos
-- (ex: diariamente às 2h da madrugada)

-- ================================================================
-- OPÇÃO 4: FUNÇÃO INTELIGENTE DE REFRESH (Apenas se necessário)
-- ================================================================
-- Refresh apenas se houver mudanças significativas

CREATE OR REPLACE FUNCTION smart_refresh_revenue_views()
RETURNS TABLE(refreshed boolean, reason text) AS $$
DECLARE
  last_procedure_update timestamp;
  last_view_refresh timestamp;
BEGIN
  -- Verificar última atualização de procedure_records
  SELECT MAX(updated_at) INTO last_procedure_update
  FROM procedure_records;
  
  -- Verificar última atualização das views materializadas
  -- (use uma tabela de controle ou metadados do PostgreSQL)
  
  -- Se houver mudanças, fazer refresh
  IF last_procedure_update > COALESCE(
    (SELECT last_refresh FROM view_refresh_log 
     WHERE view_name = 'v_doctors_aggregated' 
     ORDER BY last_refresh DESC LIMIT 1),
    '2000-01-01'::timestamp
  ) THEN
    PERFORM refresh_revenue_views();
    
    -- Registrar o refresh
    INSERT INTO view_refresh_log (view_name, last_refresh)
    VALUES ('v_doctors_aggregated', NOW());
    
    RETURN QUERY SELECT true, 'Views atualizadas devido a mudanças nos dados';
  ELSE
    RETURN QUERY SELECT false, 'Nenhuma atualização necessária';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Criar tabela de log de refresh (se não existir)
CREATE TABLE IF NOT EXISTS view_refresh_log (
  id SERIAL PRIMARY KEY,
  view_name TEXT NOT NULL,
  last_refresh TIMESTAMP DEFAULT NOW(),
  duration_ms INTEGER
);

-- ================================================================
-- COMANDOS ÚTEIS PARA MANUTENÇÃO
-- ================================================================

-- Ver tamanho das views materializadas:
-- SELECT 
--   schemaname,
--   matviewname,
--   pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
-- FROM pg_matviews 
-- WHERE schemaname = 'public';

-- Ver última atualização (se houver log):
-- SELECT * FROM view_refresh_log ORDER BY last_refresh DESC LIMIT 10;

-- Refresh manual de todas as views (execute quando necessário):
-- SELECT refresh_revenue_views();

-- Refresh individual de uma view específica:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY v_doctors_aggregated;

-- ================================================================
-- INSTRUÇÕES DE USO
-- ================================================================

-- 1. Para refresh automático via cron externo:
--    - Configure um job no servidor para executar:
--    curl -X POST "https://SEU_PROJETO.supabase.co/rest/v1/rpc/refresh_revenue_views" \
--      -H "apikey: SUA_API_KEY" \
--      -H "Authorization: Bearer SUA_API_KEY"

-- 2. Para refresh via código TypeScript (melhor opção):
--    - Chame a função ao iniciar a aplicação (uma vez ao dia)
--    - Implemente em um endpoint protegido de admin

-- 3. Para refresh manual:
--    - Execute no SQL Editor: SELECT refresh_revenue_views();

-- ================================================================
-- MONITORAMENTO DE PERFORMANCE
-- ================================================================

-- Ver estatísticas de acesso às views:
-- SELECT 
--   schemaname,
--   matviewname,
--   n_tup_ins as rows_inserted,
--   n_tup_upd as rows_updated,
--   n_tup_del as rows_deleted,
--   last_vacuum,
--   last_autovacuum,
--   last_analyze,
--   last_autoanalyze
-- FROM pg_stat_user_tables 
-- WHERE schemaname = 'public'
-- AND relname LIKE 'v_%';

-- ================================================================

