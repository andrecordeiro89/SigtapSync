-- ================================================
-- CORREÇÃO DE OVERFLOW DE INTEIROS - SIGTAP
-- Altera tipos INTEGER para BIGINT em campos que podem ter valores grandes
-- ================================================

-- Header informativo
SELECT '🔧 CORRIGINDO OVERFLOW DE INTEIROS...' as info;

-- ================================================
-- 1. CORRIGIR TABELA sigtap_procedures
-- ================================================
SELECT '📋 CORRIGINDO TABELA sigtap_procedures...' as info;

-- Alterar campos de valores financeiros (podem ser grandes quando em centavos)
ALTER TABLE sigtap_procedures 
ALTER COLUMN value_amb TYPE BIGINT;

ALTER TABLE sigtap_procedures 
ALTER COLUMN value_amb_total TYPE BIGINT;

ALTER TABLE sigtap_procedures 
ALTER COLUMN value_hosp TYPE BIGINT;

ALTER TABLE sigtap_procedures 
ALTER COLUMN value_prof TYPE BIGINT;

ALTER TABLE sigtap_procedures 
ALTER COLUMN value_hosp_total TYPE BIGINT;

-- Alterar campo pontos (pode ter valores grandes)
ALTER TABLE sigtap_procedures 
ALTER COLUMN points TYPE BIGINT;

-- Alterar outros campos numéricos que podem ser grandes
ALTER TABLE sigtap_procedures 
ALTER COLUMN max_quantity TYPE BIGINT;

SELECT '✅ Tabela sigtap_procedures corrigida' as info;

-- ================================================
-- 2. CORRIGIR TABELA sigtap_procedimentos_oficial
-- ================================================
SELECT '📋 CORRIGINDO TABELA sigtap_procedimentos_oficial...' as info;

-- Campos numéricos que podem ter overflow
ALTER TABLE sigtap_procedimentos_oficial 
ALTER COLUMN quantidade_maxima TYPE BIGINT;

ALTER TABLE sigtap_procedimentos_oficial 
ALTER COLUMN dias_permanencia TYPE BIGINT;

ALTER TABLE sigtap_procedimentos_oficial 
ALTER COLUMN pontos TYPE BIGINT;

ALTER TABLE sigtap_procedimentos_oficial 
ALTER COLUMN idade_minima TYPE BIGINT;

ALTER TABLE sigtap_procedimentos_oficial 
ALTER COLUMN idade_maxima TYPE BIGINT;

ALTER TABLE sigtap_procedimentos_oficial 
ALTER COLUMN tempo_permanencia TYPE BIGINT;

SELECT '✅ Tabela sigtap_procedimentos_oficial corrigida' as info;

-- ================================================
-- 3. CORRIGIR TABELA aihs (valores financeiros)
-- ================================================
SELECT '📋 CORRIGINDO TABELA aihs...' as info;

ALTER TABLE aihs 
ALTER COLUMN original_value TYPE BIGINT;

SELECT '✅ Tabela aihs corrigida' as info;

-- ================================================
-- 4. CORRIGIR TABELA aih_matches (valores calculados)
-- ================================================
SELECT '📋 CORRIGINDO TABELA aih_matches...' as info;

ALTER TABLE aih_matches 
ALTER COLUMN calculated_value_amb TYPE BIGINT;

ALTER TABLE aih_matches 
ALTER COLUMN calculated_value_hosp TYPE BIGINT;

ALTER TABLE aih_matches 
ALTER COLUMN calculated_value_prof TYPE BIGINT;

ALTER TABLE aih_matches 
ALTER COLUMN calculated_total TYPE BIGINT;

SELECT '✅ Tabela aih_matches corrigida' as info;

-- ================================================
-- 5. CORRIGIR TABELA procedure_records (valores cobrados)
-- ================================================
SELECT '📋 CORRIGINDO TABELA procedure_records...' as info;

ALTER TABLE procedure_records 
ALTER COLUMN value_charged TYPE BIGINT;

SELECT '✅ Tabela procedure_records corrigida' as info;

-- ================================================
-- 6. VERIFICAR ALTERAÇÕES
-- ================================================
SELECT '🔍 VERIFICANDO ALTERAÇÕES...' as info;

DO $$
DECLARE
    rec RECORD;
    total_fixed INTEGER := 0;
BEGIN
    FOR rec IN
        SELECT 
            c.table_name,
            c.column_name,
            c.data_type
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
        AND c.table_name IN ('sigtap_procedures', 'sigtap_procedimentos_oficial', 'aihs', 'aih_matches', 'procedure_records')
        AND c.column_name IN ('value_amb', 'value_amb_total', 'value_hosp', 'value_prof', 'value_hosp_total', 
                              'points', 'max_quantity', 'quantidade_maxima', 'dias_permanencia', 'pontos',
                              'idade_minima', 'idade_maxima', 'tempo_permanencia', 'original_value',
                              'calculated_value_amb', 'calculated_value_hosp', 'calculated_value_prof', 
                              'calculated_total', 'value_charged')
        AND c.data_type = 'bigint'
        ORDER BY c.table_name, c.column_name
    LOOP
        RAISE NOTICE '✅ %.% = %', rec.table_name, rec.column_name, rec.data_type;
        total_fixed := total_fixed + 1;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 TOTAL DE CAMPOS CORRIGIDOS: %', total_fixed;
    RAISE NOTICE '✨ Agora os valores grandes não causarão mais overflow!';
END
$$;

-- ================================================
-- 7. LIMPAR DADOS PROBLEMÁTICOS (OPCIONAL)
-- ================================================
SELECT '🧹 VERIFICANDO DADOS PROBLEMÁTICOS...' as info;

-- Verificar se há procedimentos com valores extremamente altos que ainda podem causar problemas
DO $$
DECLARE
    max_value_sa DECIMAL;
    max_value_sh DECIMAL;
    max_value_sp DECIMAL;
    max_pontos BIGINT;
BEGIN
    -- Verificar valores máximos na tabela oficial
    SELECT 
        MAX(valor_sa), 
        MAX(valor_sh), 
        MAX(valor_sp),
        MAX(pontos)
    INTO max_value_sa, max_value_sh, max_value_sp, max_pontos
    FROM sigtap_procedimentos_oficial;
    
    RAISE NOTICE 'Valor SA máximo: R$ %', max_value_sa;
    RAISE NOTICE 'Valor SH máximo: R$ %', max_value_sh;
    RAISE NOTICE 'Valor SP máximo: R$ %', max_value_sp;
    RAISE NOTICE 'Pontos máximo: %', max_pontos;
    
    -- Verificar se algum valor em centavos excederia BIGINT
    IF (max_value_sa * 100) > 9223372036854775807 OR 
       (max_value_sh * 100) > 9223372036854775807 OR 
       (max_value_sp * 100) > 9223372036854775807 THEN
        RAISE NOTICE '⚠️  ATENÇÃO: Alguns valores ainda podem causar overflow mesmo com BIGINT!';
    ELSE
        RAISE NOTICE '✅ Todos os valores estão dentro do limite do BIGINT';
    END IF;
END
$$;

SELECT '🎯 CORREÇÃO CONCLUÍDA! Agora você pode executar a sincronização novamente.' as info; 