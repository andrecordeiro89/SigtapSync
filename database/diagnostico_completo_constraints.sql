-- ================================================================
-- DIAGNÓSTICO COMPLETO: CONSTRAINTS E TABELA USER_PROFILES  
-- ================================================================

-- 1. VERIFICAR SE TABELA EXISTS
SELECT 
  'TABELA' as categoria,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') 
    THEN 'user_profiles EXISTE'
    ELSE 'user_profiles NAO EXISTE'
  END as status;

-- 2. VERIFICAR CONSTRAINTS DE FOREIGN KEY
SELECT 
  'FK CONSTRAINTS' as categoria,
  constraint_name,
  'PROBLEMÁTICA' as status
FROM information_schema.table_constraints 
WHERE table_name = 'user_profiles' 
  AND constraint_type = 'FOREIGN KEY';

-- 3. VERIFICAR CONSTRAINTS DE CHECK (ROLES)
SELECT 
  'CHECK CONSTRAINTS' as categoria,
  constraint_name,
  check_clause
FROM information_schema.check_constraints 
WHERE table_name = 'user_profiles';

-- 4. TESTE DE INSERÇÃO
DO $$
BEGIN
    BEGIN
        INSERT INTO user_profiles (
            id, email, role, full_name, hospital_access, permissions, is_active
        ) VALUES (
            'test-uuid',
            'teste@sigtap.com',
            'director',
            'Teste',
            ARRAY['ALL'],
            ARRAY['read_all_data'],
            true
        );
        
        RAISE NOTICE 'TESTE INSERÇÃO: SUCESSO';
        DELETE FROM user_profiles WHERE email = 'teste@sigtap.com';
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'TESTE INSERÇÃO: FALHOU - %', SQLERRM;
    END;
END $$; 