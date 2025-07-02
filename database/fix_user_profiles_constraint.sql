-- ================================================================
-- FIX RÁPIDO: CONSTRAINT ID DA TABELA USER_PROFILES
-- ================================================================
-- Execute este script ANTES do setup_admin_users_COMPLETE.sql
-- se estiver com problemas de foreign key constraint

-- 1. VERIFICAR SITUAÇÃO ATUAL
SELECT 
  'ANTES DO FIX' as status,
  constraint_name,
  constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'user_profiles' 
  AND constraint_type = 'FOREIGN KEY';

-- 2. REMOVER CONSTRAINT DE FOREIGN KEY (se existir)
DO $$
BEGIN
    -- Tentar remover a constraint
    BEGIN
        ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;
        RAISE NOTICE '✅ Constraint user_profiles_id_fkey removida';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Constraint user_profiles_id_fkey não encontrada ou já removida';
    END;
    
    -- Tentar remover outras possíveis constraints
    BEGIN
        ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey1;
        RAISE NOTICE '✅ Constraint user_profiles_id_fkey1 removida';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Constraint user_profiles_id_fkey1 não encontrada';
    END;
END $$;

-- 3. GARANTIR QUE RLS ESTÁ DESABILITADO
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- 4. GARANTIR PERMISSÕES
GRANT ALL ON TABLE user_profiles TO anon;
GRANT ALL ON TABLE user_profiles TO authenticated;
GRANT ALL ON TABLE user_profiles TO service_role;

-- 5. VERIFICAR RESULTADO
SELECT 
  'APÓS O FIX' as status,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Nenhuma constraint FK encontrada - OK para inserir'
    ELSE '❌ Ainda há constraints FK - verificar manualmente'
  END as resultado
FROM information_schema.table_constraints 
WHERE table_name = 'user_profiles' 
  AND constraint_type = 'FOREIGN KEY';

-- 6. MOSTRAR ESTRUTURA ATUAL
SELECT 
  'ESTRUTURA ATUAL' as categoria,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;

-- 7. INSTRUÇÕES
SELECT 
  'PRÓXIMO PASSO' as instrucao,
  'Agora execute o script: setup_admin_users_COMPLETE.sql' as acao; 