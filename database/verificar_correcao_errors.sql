-- ===================================================
-- VERIFICAÇÃO PÓS-CORREÇÃO DOS ERROS
-- ===================================================

-- 1. Verificar estrutura da tabela aihs
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'aihs' 
ORDER BY ordinal_position;

-- 2. Verificar se existem dados na tabela aihs
SELECT 
    COUNT(*) as total_aihs,
    COUNT(DISTINCT hospital_id) as hospitais_distintos,
    COUNT(DISTINCT processing_status) as status_distintos
FROM aihs;

-- 3. Verificar hospitais ativos
SELECT 
    id,
    name,
    cnpj,
    city,
    state,
    is_active
FROM hospitals 
WHERE is_active = true
ORDER BY name;

-- 4. Verificar se existem colunas processed_at e created_by
SELECT 
    'processed_at' as coluna,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'aihs' AND column_name = 'processed_at'
        ) THEN '✅ EXISTE'
        ELSE '❌ NÃO EXISTE'
    END as status
UNION ALL
SELECT 
    'created_by' as coluna,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'aihs' AND column_name = 'created_by'
        ) THEN '✅ EXISTE'
        ELSE '❌ NÃO EXISTE'
    END as status
UNION ALL
SELECT 
    'processed_by' as coluna,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'aihs' AND column_name = 'processed_by'
        ) THEN '❌ AINDA EXISTE (ERRO)'
        ELSE '✅ NÃO EXISTE (CORRETO)'
    END as status;

-- 5. Verificar AIHs recentes
SELECT 
    id,
    aih_number,
    procedure_code,
    processing_status,
    created_at,
    processed_at,
    created_by
FROM aihs 
ORDER BY created_at DESC 
LIMIT 10;

-- 6. Verificar usuários com acesso 'ALL'
SELECT 
    id,
    email,
    role,
    full_name,
    hospital_access
FROM user_profiles 
WHERE hospital_access @> ARRAY['ALL']::text[]
ORDER BY email;

-- 7. Teste da query corrigida
SELECT 
    id,
    aih_number,
    procedure_code,
    admission_date,
    processing_status,
    hospital_id,
    created_at,
    processed_at,   -- ✅ CORRIGIDO
    created_by      -- ✅ CORRIGIDO
FROM aihs 
LIMIT 5;

-- 8. Verificar logs de auditoria recentes
SELECT 
    action,
    table_name,
    created_at,
    user_id
FROM audit_logs 
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC 
LIMIT 10; 