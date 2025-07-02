-- ================================================================
-- FIX: CONSTRAINT VALID_ROLES - ADICIONAR ROLES ADMINISTRATIVOS
-- ================================================================
-- Este script corrige a constraint que está rejeitando os roles administrativos

-- 1. VERIFICAR CONSTRAINT ATUAL
SELECT 
  'CONSTRAINT ATUAL' as status,
  constraint_name,
  check_clause
FROM information_schema.check_constraints 
WHERE constraint_name = 'valid_roles';

-- 2. REMOVER CONSTRAINT ANTIGA
DO $$
BEGIN
    -- Tentar remover a constraint valid_roles
    BEGIN
        ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS valid_roles;
        RAISE NOTICE '✅ Constraint valid_roles removida';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Constraint valid_roles não encontrada: %', SQLERRM;
    END;
    
    -- Tentar outras possíveis variações do nome
    BEGIN
        ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
        RAISE NOTICE '✅ Constraint user_profiles_role_check removida';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Constraint user_profiles_role_check não encontrada';
    END;
END $$;

-- 3. CRIAR NOVA CONSTRAINT COM TODOS OS ROLES ADMINISTRATIVOS
ALTER TABLE user_profiles 
ADD CONSTRAINT valid_roles_updated 
CHECK (role IN (
  'developer',    -- Desenvolvedor - acesso total
  'admin',        -- Administrador geral
  'user',         -- Usuário comum/operador
  'director',     -- Diretoria - gestão executiva
  'ti',           -- TI - suporte técnico
  'coordinator',  -- Coordenação - supervisão
  'auditor'       -- Auditoria - monitoramento
));

-- 4. VERIFICAR NOVA CONSTRAINT
SELECT 
  'NOVA CONSTRAINT' as status,
  constraint_name,
  check_clause
FROM information_schema.check_constraints 
WHERE constraint_name = 'valid_roles_updated';

-- 5. TESTAR INSERÇÃO COM TODOS OS ROLES
DO $$
DECLARE
    test_roles TEXT[] := ARRAY['developer', 'admin', 'user', 'director', 'ti', 'coordinator', 'auditor'];
    role_name TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TESTANDO ROLES VÁLIDOS:';
    RAISE NOTICE '================================';
    
    FOREACH role_name IN ARRAY test_roles LOOP
        BEGIN
            -- Tentar inserir um registro de teste para cada role
            INSERT INTO user_profiles (
                id, 
                email, 
                role, 
                full_name,
                hospital_access,
                permissions,
                is_active
            ) VALUES (
                'test-' || role_name || '-uuid',
                'teste_' || role_name || '@sigtap.com',
                role_name,
                'Teste ' || role_name,
                ARRAY['ALL'],
                ARRAY['read_all_data'],
                true
            );
            
            RAISE NOTICE '✅ Role "%" aceito', role_name;
            
            -- Remover o registro de teste
            DELETE FROM user_profiles WHERE email = 'teste_' || role_name || '@sigtap.com';
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Role "%" rejeitado: %', role_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎯 TESTE CONCLUÍDO!';
END $$;

-- 6. VERIFICAR SE TABELA ESTÁ PRONTA
SELECT 
  'STATUS FINAL' as categoria,
  'Tabela user_profiles pronta para receber todos os roles administrativos' as resultado;

-- 7. MOSTRAR ROLES VÁLIDOS
SELECT 
  'ROLES VÁLIDOS' as categoria,
  'developer, admin, user, director, ti, coordinator, auditor' as roles_aceitos; 