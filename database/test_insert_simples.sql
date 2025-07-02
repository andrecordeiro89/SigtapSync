-- ================================================================
-- TESTE SIMPLES: INSERÇÃO APÓS CORREÇÃO DA CONSTRAINT
-- ================================================================
-- Execute este script para testar se a correção funcionou

-- 1. TESTE DE INSERÇÃO SIMPLES
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
  '99999999-9999-4999-8999-999999999999',
  'teste@sigtap.com',
  'Usuário Teste',
  'admin',
  ARRAY['ALL'],
  ARRAY['read_all_data', 'write_all_data'],
  true,
  NOW(),
  NOW()
);

-- 2. VERIFICAR SE FOI INSERIDO
SELECT 
  'TESTE DE INSERÇÃO' as resultado,
  CASE 
    WHEN EXISTS (SELECT 1 FROM user_profiles WHERE email = 'teste@sigtap.com') 
    THEN '✅ SUCESSO - Inserção funcionou!'
    ELSE '❌ FALHOU - Ainda há problemas'
  END as status;

-- 3. MOSTRAR O REGISTRO CRIADO
SELECT 
  'DADOS INSERIDOS' as categoria,
  id,
  email,
  role,
  hospital_access,
  permissions
FROM user_profiles 
WHERE email = 'teste@sigtap.com';

-- 4. LIMPEZA DO TESTE
DELETE FROM user_profiles WHERE email = 'teste@sigtap.com';

-- 5. CONFIRMAÇÃO DA LIMPEZA
SELECT 
  'LIMPEZA DO TESTE' as resultado,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM user_profiles WHERE email = 'teste@sigtap.com') 
    THEN '✅ Registro de teste removido'
    ELSE '⚠️ Registro de teste ainda existe'
  END as status;

-- 6. CONCLUSÃO
SELECT 
  'CONCLUSÃO' as categoria,
  'Sistema pronto para executar setup_admin_users_COMPLETE.sql' as resultado; 