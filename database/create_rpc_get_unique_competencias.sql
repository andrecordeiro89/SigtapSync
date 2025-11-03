-- ================================================================
-- FUNÇÕES RPC PARA BUSCAR COMPETÊNCIAS ÚNICAS
-- Data: 2025-11-03
-- ================================================================
-- Objetivo: Buscar competências únicas de forma otimizada
-- Benefício: Evita trazer milhares de registros para o frontend
-- ================================================================

-- 1. FUNÇÃO: Buscar competências únicas de AIHs
CREATE OR REPLACE FUNCTION get_unique_competencias_aihs(p_hospital_id UUID DEFAULT NULL)
RETURNS TABLE (competencia DATE)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_hospital_id IS NULL THEN
    -- Retornar todas as competências de todos os hospitais
    RETURN QUERY
    SELECT DISTINCT a.competencia
    FROM aihs a
    WHERE a.competencia IS NOT NULL
    ORDER BY a.competencia DESC;
  ELSE
    -- Retornar competências apenas do hospital específico
    RETURN QUERY
    SELECT DISTINCT a.competencia
    FROM aihs a
    WHERE a.hospital_id = p_hospital_id
      AND a.competencia IS NOT NULL
    ORDER BY a.competencia DESC;
  END IF;
END;
$$;

-- 2. FUNÇÃO: Buscar competências únicas de Altas Hospitalares
CREATE OR REPLACE FUNCTION get_unique_competencias_altas(p_hospital_id UUID DEFAULT NULL)
RETURNS TABLE (competencia DATE)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_hospital_id IS NULL THEN
    -- Retornar todas as competências de todos os hospitais
    RETURN QUERY
    SELECT DISTINCT h.competencia
    FROM hospital_discharges h
    WHERE h.competencia IS NOT NULL
    ORDER BY h.competencia DESC;
  ELSE
    -- Retornar competências apenas do hospital específico
    RETURN QUERY
    SELECT DISTINCT h.competencia
    FROM hospital_discharges h
    WHERE h.hospital_id = p_hospital_id
      AND h.competencia IS NOT NULL
    ORDER BY h.competencia DESC;
  END IF;
END;
$$;

-- 3. COMENTÁRIOS
COMMENT ON FUNCTION get_unique_competencias_aihs IS 'Retorna lista de competências únicas das AIHs, ordenadas da mais recente para a mais antiga';
COMMENT ON FUNCTION get_unique_competencias_altas IS 'Retorna lista de competências únicas das Altas Hospitalares, ordenadas da mais recente para a mais antiga';

-- 4. TESTAR AS FUNÇÕES
-- Teste 1: Buscar todas as competências de AIHs
SELECT * FROM get_unique_competencias_aihs(NULL);

-- Teste 2: Buscar competências de um hospital específico (substituir pelo UUID real)
-- SELECT * FROM get_unique_competencias_aihs('seu-hospital-uuid-aqui');

-- Teste 3: Buscar todas as competências de Altas
SELECT * FROM get_unique_competencias_altas(NULL);

-- ✅ FINALIZADO
SELECT 'Funções RPC criadas com sucesso!' as status;

