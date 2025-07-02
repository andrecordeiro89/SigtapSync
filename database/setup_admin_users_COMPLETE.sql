-- ================================================================
-- SETUP COMPLETO DOS USUÁRIOS ADMINISTRATIVOS - SIGTAP SYNC
-- ================================================================
-- Este script configura todos os usuários administrativos com acesso total
-- Execução: Cole no SQL Editor do Supabase e execute

BEGIN;

-- ================================================================
-- 1. VERIFICAR E CORRIGIR ESTRUTURA DAS TABELAS
-- ================================================================

-- 1.1 Verificar e corrigir user_profiles
DO $$
BEGIN
    -- Remover constraint de FK se existir
    BEGIN
        ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;
        RAISE NOTICE '✅ Constraint de FK removida - usando sistema próprio';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ FK constraint não encontrada ou já removida';
    END;
    
    -- Remover constraint de roles antiga
    BEGIN
        ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS valid_roles;
        RAISE NOTICE '✅ Constraint valid_roles removida';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Constraint valid_roles não encontrada';
    END;
    
    -- Remover outras possíveis constraints de role
    BEGIN
        ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
        RAISE NOTICE '✅ Constraint user_profiles_role_check removida';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Constraint user_profiles_role_check não encontrada';
    END;
END $$;

-- Criar nova constraint de roles com todos os valores administrativos
ALTER TABLE user_profiles 
ADD CONSTRAINT valid_roles_admin 
CHECK (role IN (
  'developer',    -- Desenvolvedor - acesso total
  'admin',        -- Administrador geral  
  'user',         -- Usuário comum/operador
  'director',     -- Diretoria - gestão executiva
  'ti',           -- TI - suporte técnico
  'coordinator',  -- Coordenação - supervisão
  'auditor'       -- Auditoria - monitoramento
));

-- 1.2 Verificar e criar tabela audit_logs se necessário
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[] DEFAULT '{}',
  user_id UUID,
  hospital_id UUID,
  ip_address INET,
  user_agent TEXT,
  operation_type VARCHAR(100),
  session_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Garantir permissões na tabela audit_logs
GRANT ALL ON TABLE audit_logs TO anon;
GRANT ALL ON TABLE audit_logs TO authenticated;
GRANT ALL ON TABLE audit_logs TO service_role;

-- Desabilitar RLS na tabela audit_logs
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- ================================================================
-- 2. LIMPEZA PRÉVIA (remover registros inconsistentes)
-- ================================================================
DELETE FROM user_profiles WHERE email IN (
  'diretoria@sigtap.com',
  'ti@sigtap.com', 
  'coordenacao@sigtap.com',
  'auditoria@sigtap.com',
  'admin@sigtap.com'
);

-- ================================================================
-- 3. INSERÇÃO DOS USUÁRIOS ADMINISTRATIVOS COM UUIDs PRÓPRIOS
-- ================================================================

-- DIRETORIA - Acesso total a todos os hospitais
INSERT INTO user_profiles (
  id,
  email,
  full_name,
  role,
  hospital_access,
  permissions,
  is_active,
  created_at,
  updated_at
) VALUES (
  '10000000-1000-4000-8000-100000000001',
  'diretoria@sigtap.com',
  'Diretoria SIGTAP',
  'director',
  ARRAY['ALL'],
  ARRAY[
    'read_all_data',
    'write_all_data', 
    'delete_data',
    'manage_users',
    'access_all_hospitals',
    'generate_reports',
    'import_sigtap',
    'manage_procedures',
    'audit_access',
    'system_admin'
  ],
  true,
  NOW(),
  NOW()
);

-- TI - Acesso técnico total
INSERT INTO user_profiles (
  id,
  email,
  full_name,
  role,
  hospital_access,
  permissions,
  is_active,
  created_at,
  updated_at
) VALUES (
  '10000000-1000-4000-8000-100000000002',
  'ti@sigtap.com',
  'TI SIGTAP',
  'ti',
  ARRAY['ALL'],
  ARRAY[
    'read_all_data',
    'write_all_data',
    'delete_data',
    'manage_users',
    'access_all_hospitals',
    'generate_reports',
    'import_sigtap',
    'manage_procedures',
    'audit_access',
    'system_admin',
    'database_access',
    'debug_mode'
  ],
  true,
  NOW(),
  NOW()
);

-- COORDENAÇÃO - Supervisão geral
INSERT INTO user_profiles (
  id,
  email,
  full_name,
  role,
  hospital_access,
  permissions,
  is_active,
  created_at,
  updated_at
) VALUES (
  '10000000-1000-4000-8000-100000000003',
  'coordenacao@sigtap.com',
  'Coordenação SIGTAP',
  'coordinator',
  ARRAY['ALL'],
  ARRAY[
    'read_all_data',
    'write_all_data',
    'delete_data',
    'manage_users',
    'access_all_hospitals',
    'generate_reports',
    'import_sigtap',
    'manage_procedures',
    'audit_access'
  ],
  true,
  NOW(),
  NOW()
);

-- AUDITORIA - Monitoramento completo
INSERT INTO user_profiles (
  id,
  email,
  full_name,
  role,
  hospital_access,
  permissions,
  is_active,
  created_at,
  updated_at
) VALUES (
  '10000000-1000-4000-8000-100000000004',
  'auditoria@sigtap.com',
  'Auditoria SIGTAP',
  'auditor',
  ARRAY['ALL'],
  ARRAY[
    'read_all_data',
    'audit_access',
    'access_all_hospitals',
    'generate_reports',
    'manage_procedures',
    'write_all_data'
  ],
  true,
  NOW(),
  NOW()
);

-- ADMIN - Administrador geral
INSERT INTO user_profiles (
  id,
  email,
  full_name,
  role,
  hospital_access,
  permissions,
  is_active,
  created_at,
  updated_at
) VALUES (
  '10000000-1000-4000-8000-100000000005',
  'admin@sigtap.com',
  'Administrador SIGTAP',
  'admin',
  ARRAY['ALL'],
  ARRAY[
    'read_all_data',
    'write_all_data',
    'delete_data',
    'manage_users',
    'access_all_hospitals',
    'generate_reports',
    'import_sigtap',
    'manage_procedures',
    'audit_access',
    'system_admin'
  ],
  true,
  NOW(),
  NOW()
);

-- ================================================================
-- 4. INSERIR LOG DE AUDITORIA DA CRIAÇÃO
-- ================================================================
INSERT INTO audit_logs (
  table_name,
  record_id,
  action,
  new_values,
  changed_fields,
  user_id,
  hospital_id,
  ip_address,
  user_agent,
  operation_type,
  session_id,
  created_at
) VALUES (
  'user_profiles',
  '10000000-1000-4000-8000-100000000001',
  'ADMIN_SETUP',
  '{"users_created": ["diretoria@sigtap.com", "ti@sigtap.com", "coordenacao@sigtap.com", "auditoria@sigtap.com", "admin@sigtap.com"]}'::jsonb,
  ARRAY['email', 'role', 'permissions', 'hospital_access'],
  null,
  null,
  '127.0.0.1',
  'SQL Script - Admin Setup',
  'ADMIN_SETUP',
  'setup-admin-users-' || extract(epoch from now()),
  NOW()
);

COMMIT;

-- ================================================================
-- 5. VERIFICAÇÃO DOS USUÁRIOS CRIADOS
-- ================================================================
SELECT 
  '🟢 USUÁRIOS ADMINISTRATIVOS CRIADOS' as status,
  email,
  full_name,
  role,
  hospital_access,
  array_length(permissions, 1) as total_permissions,
  is_active,
  created_at
FROM user_profiles 
WHERE email IN (
  'diretoria@sigtap.com',
  'ti@sigtap.com',
  'coordenacao@sigtap.com', 
  'auditoria@sigtap.com',
  'admin@sigtap.com'
)
ORDER BY 
  CASE role
    WHEN 'director' THEN 1
    WHEN 'admin' THEN 2  
    WHEN 'ti' THEN 3
    WHEN 'coordinator' THEN 4
    WHEN 'auditor' THEN 5
  END;

-- ================================================================
-- 6. VERIFICAÇÃO DETALHADA DAS PERMISSÕES
-- ================================================================
SELECT 
  '🔍 DETALHAMENTO DAS PERMISSÕES' as status,
  email,
  role,
  CASE 
    WHEN 'ALL' = ANY(hospital_access) THEN '✅ ACESSO TOTAL'
    ELSE '❌ ACESSO LIMITADO'
  END as hospital_access_status,
  CASE 
    WHEN 'system_admin' = ANY(permissions) THEN '✅ ADMIN'
    ELSE '❌ SEM ADMIN'
  END as admin_permission,
  CASE 
    WHEN 'access_all_hospitals' = ANY(permissions) THEN '✅ TODOS HOSPITAIS'
    ELSE '❌ LIMITADO'
  END as hospital_permission,
  CASE 
    WHEN 'import_sigtap' = ANY(permissions) THEN '✅ SIGTAP'
    ELSE '❌ SEM SIGTAP'
  END as sigtap_permission,
  CASE 
    WHEN 'generate_reports' = ANY(permissions) THEN '✅ RELATÓRIOS'
    ELSE '❌ SEM RELATÓRIOS'
  END as reports_permission
FROM user_profiles 
WHERE email IN (
  'diretoria@sigtap.com',
  'ti@sigtap.com',
  'coordenacao@sigtap.com',
  'auditoria@sigtap.com', 
  'admin@sigtap.com'
)
ORDER BY role;

-- ================================================================
-- 7. VERIFICAÇÃO DO SISTEMA DE AUTENTICAÇÃO
-- ================================================================
SELECT 
  '🔐 VERIFICAÇÃO DE ACESSO NO SISTEMA' as status,
  COUNT(*) as total_admins,
  COUNT(CASE WHEN is_active THEN 1 END) as ativos,
  COUNT(CASE WHEN 'ALL' = ANY(hospital_access) THEN 1 END) as com_acesso_total,
  COUNT(CASE WHEN 'system_admin' = ANY(permissions) THEN 1 END) as com_permissao_admin
FROM user_profiles 
WHERE email IN (
  'diretoria@sigtap.com',
  'ti@sigtap.com', 
  'coordenacao@sigtap.com',
  'auditoria@sigtap.com',
  'admin@sigtap.com'
);

-- ================================================================
-- 8. TESTE DE FUNCIONALIDADES (Simulação)
-- ================================================================
SELECT 
  '🧪 TESTE DE FUNCIONALIDADES DISPONÍVEIS' as status,
  email,
  role,
  CASE 
    WHEN role IN ('director', 'admin', 'ti', 'coordinator', 'auditor') 
    THEN '✅ Dashboard, Consulta SIGTAP, AIH Avançado, Pacientes, SIGTAP Import, Upload Teste, Relatórios'
    ELSE '❌ Acesso limitado'
  END as funcionalidades_visiveis
FROM user_profiles 
WHERE email IN (
  'diretoria@sigtap.com',
  'ti@sigtap.com',
  'coordenacao@sigtap.com', 
  'auditoria@sigtap.com',
  'admin@sigtap.com'
)
ORDER BY role;

-- ================================================================
-- 9. RELATÓRIO FINAL DE CONFIGURAÇÃO
-- ================================================================
SELECT 
  '📊 RELATÓRIO FINAL DE CONFIGURAÇÃO' as status,
  'Usuários administrativos configurados com sucesso!' as resultado,
  NOW() as data_configuracao;

-- ================================================================
-- 10. PRÓXIMOS PASSOS
-- ================================================================
SELECT 
  '📝 PRÓXIMOS PASSOS' as orientacao,
  'Todos os emails administrativos foram criados e podem fazer login no sistema.' as passo_1,
  'Eles terão acesso total a todas as funcionalidades.' as passo_2,
  'Verifique os logs de auditoria para monitorar os acessos.' as passo_3; 