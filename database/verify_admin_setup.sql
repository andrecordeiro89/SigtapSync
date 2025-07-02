-- ================================================================
-- VERIFICAÇÃO RÁPIDA DOS USUÁRIOS ADMINISTRATIVOS
-- ================================================================
-- Execute este script para verificar se tudo está configurado corretamente

-- 1. VERIFICAR SE TODOS OS USUÁRIOS EXISTEM
SELECT 
  '👥 USUÁRIOS ADMINISTRATIVOS' as categoria,
  email,
  full_name,
  role,
  is_active,
  CASE 
    WHEN 'ALL' = ANY(hospital_access) THEN '✅ TOTAL'
    ELSE '❌ LIMITADO'
  END as acesso_hospital
FROM user_profiles 
WHERE email IN (
  'diretoria@sigtap.com',
  'ti@sigtap.com',
  'coordenacao@sigtap.com', 
  'auditoria@sigtap.com',
  'admin@sigtap.com'
)
ORDER BY role;

-- 2. RESUMO GERAL
SELECT 
  '📊 RESUMO GERAL' as categoria,
  COUNT(*) as total_configurados,
  COUNT(CASE WHEN is_active THEN 1 END) as ativos,
  COUNT(CASE WHEN 'ALL' = ANY(hospital_access) THEN 1 END) as com_acesso_total
FROM user_profiles 
WHERE email IN (
  'diretoria@sigtap.com',
  'ti@sigtap.com',
  'coordenacao@sigtap.com',
  'auditoria@sigtap.com',
  'admin@sigtap.com'
);

-- 3. PERMISSÕES POR USUÁRIO
SELECT 
  '🔑 PERMISSÕES CRÍTICAS' as categoria,
  email,
  role,
  CASE WHEN 'system_admin' = ANY(permissions) THEN '✅' ELSE '❌' END as admin,
  CASE WHEN 'access_all_hospitals' = ANY(permissions) THEN '✅' ELSE '❌' END as hospitais,
  CASE WHEN 'import_sigtap' = ANY(permissions) THEN '✅' ELSE '❌' END as sigtap,
  CASE WHEN 'generate_reports' = ANY(permissions) THEN '✅' ELSE '❌' END as reports
FROM user_profiles 
WHERE email IN (
  'diretoria@sigtap.com',
  'ti@sigtap.com',
  'coordenacao@sigtap.com',
  'auditoria@sigtap.com', 
  'admin@sigtap.com'
)
ORDER BY role;

-- 4. VERIFICAR SE HÁ PROBLEMAS
SELECT 
  '⚠️ DIAGNÓSTICO' as categoria,
  CASE 
    WHEN COUNT(*) != 5 THEN '❌ Nem todos os usuários foram criados'
    WHEN COUNT(CASE WHEN is_active THEN 1 END) != 5 THEN '❌ Alguns usuários estão inativos'
    WHEN COUNT(CASE WHEN 'ALL' = ANY(hospital_access) THEN 1 END) != 5 THEN '❌ Alguns não têm acesso total'
    ELSE '✅ Tudo configurado corretamente!'
  END as status
FROM user_profiles 
WHERE email IN (
  'diretoria@sigtap.com',
  'ti@sigtap.com',
  'coordenacao@sigtap.com',
  'auditoria@sigtap.com',
  'admin@sigtap.com'
); 