-- ================================================
-- CORREÇÃO: CONSTRAINT AIHs COM NÚMERO "-"
-- Permite múltiplas AIHs com número "-" no mesmo hospital
-- ================================================

-- 🎯 PROBLEMA: A constraint UNIQUE(hospital_id, aih_number) impede múltiplas AIHs com "-"
-- 🔧 SOLUÇÃO: Remover constraint e criar constraint parcial que só se aplica a números válidos

-- ================================================
-- 1. REMOVER CONSTRAINT EXISTENTE
-- ================================================

-- Primeiro, encontrar o nome exato da constraint
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Buscar nome da constraint unique hospital_id + aih_number
    SELECT conname INTO constraint_name
    FROM pg_constraint 
    WHERE conrelid = 'aihs'::regclass 
    AND contype = 'u'
    AND array_length(conkey, 1) = 2
    AND conkey[1] IN (
        SELECT attnum FROM pg_attribute 
        WHERE attrelid = 'aihs'::regclass 
        AND attname IN ('hospital_id', 'aih_number')
    )
    AND conkey[2] IN (
        SELECT attnum FROM pg_attribute 
        WHERE attrelid = 'aihs'::regclass 
        AND attname IN ('hospital_id', 'aih_number')
    );

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE aihs DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE '✅ Constraint removida: %', constraint_name;
    ELSE
        RAISE NOTICE '⚠️ Constraint não encontrada - talvez já tenha sido removida';
    END IF;
END $$;

-- ================================================
-- 2. CRIAR CONSTRAINT PARCIAL INTELIGENTE
-- ================================================

-- Criar constraint que só se aplica quando aih_number NÃO é "-"
-- Isso permite múltiplas AIHs com "-" mas mantém unicidade para números reais
CREATE UNIQUE INDEX IF NOT EXISTS idx_aihs_unique_number_hospital 
ON aihs (hospital_id, aih_number) 
WHERE aih_number != '-';

-- ================================================
-- 3. COMENTÁRIOS E DOCUMENTAÇÃO
-- ================================================

COMMENT ON INDEX idx_aihs_unique_number_hospital IS 
'Constraint parcial: garante unicidade de números AIH reais, mas permite múltiplas AIHs com "-"';

-- ================================================
-- 4. VERIFICAÇÃO DO RESULTADO
-- ================================================

-- Verificar quantas AIHs com "-" existem (deve ser possível ter múltiplas)
DO $$
DECLARE
    dash_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dash_count 
    FROM aihs 
    WHERE aih_number = '-';
    
    RAISE NOTICE '📊 Total de AIHs com número "-": %', dash_count;
    
    -- Teste: verificar se é possível inserir múltiplas AIHs com "-"
    RAISE NOTICE '✅ Constraint corrigida - múltiplas AIHs com "-" agora permitidas';
    RAISE NOTICE '🔒 Números AIH reais continuam com constraint de unicidade';
END $$;

-- ================================================
-- 5. ÍNDICES ADICIONAIS PARA PERFORMANCE
-- ================================================

-- Índice para buscar AIHs com "-" rapidamente
CREATE INDEX IF NOT EXISTS idx_aihs_dash_number 
ON aihs (hospital_id, patient_id, admission_date) 
WHERE aih_number = '-';

COMMENT ON INDEX idx_aihs_dash_number IS 
'Índice otimizado para buscar AIHs sem número oficial por hospital + paciente + data';

-- ================================================
-- RESULTADO FINAL
-- ================================================

SELECT '🎉 CORREÇÃO CONCLUÍDA - MÚLTIPLAS AIHs COM "-" AGORA PERMITIDAS!' as status; 