-- ================================================================
-- VERIFICAÇÃO: Status do RLS na tabela aih_registros
-- ================================================================

-- 1. Verificar se RLS está habilitado ou não
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_habilitado,
  CASE 
    WHEN rowsecurity = true THEN '⚠️ RLS ESTÁ ATIVO - PRECISA DESABILITAR'
    WHEN rowsecurity = false THEN '✅ RLS DESABILITADO - OK'
  END as status
FROM pg_tables 
WHERE tablename = 'aih_registros';

-- 2. Ver políticas ativas (deve estar vazio se RLS desabilitado)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  CASE 
    WHEN COUNT(*) OVER() > 0 THEN '⚠️ TEM POLÍTICAS ATIVAS'
    ELSE '✅ SEM POLÍTICAS'
  END as status_politicas
FROM pg_policies
WHERE tablename = 'aih_registros';

-- 3. Testar INSERT direto (para verificar se funciona)
-- DESCOMENTE PARA TESTAR:
/*
INSERT INTO aih_registros (
  numero_aih,
  tipo_aih,
  nome_paciente,
  data_nascimento,
  data_internacao,
  sexo
) VALUES (
  'TESTE123456789',
  '01',
  'PACIENTE TESTE',
  '1990-01-01',
  '2024-10-17',
  'M'
)
ON CONFLICT (numero_aih) DO UPDATE
SET nome_paciente = 'PACIENTE TESTE ATUALIZADO';

-- Se funcionar, deletar o teste:
DELETE FROM aih_registros WHERE numero_aih = 'TESTE123456789';
*/

-- ================================================================
-- SE RLS AINDA ESTIVER ATIVO, EXECUTE:
-- ================================================================

-- Desabilitar RLS
ALTER TABLE aih_registros DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas (se existirem)
DROP POLICY IF EXISTS "Usuários autenticados podem ler aih_registros" ON aih_registros;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir aih_registros" ON aih_registros;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar aih_registros" ON aih_registros;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar aih_registros" ON aih_registros;
DROP POLICY IF EXISTS "public_select_aih_registros" ON aih_registros;
DROP POLICY IF EXISTS "public_insert_aih_registros" ON aih_registros;
DROP POLICY IF EXISTS "public_update_aih_registros" ON aih_registros;
DROP POLICY IF EXISTS "public_delete_aih_registros" ON aih_registros;

-- Verificar novamente
SELECT 
  tablename,
  rowsecurity,
  CASE 
    WHEN rowsecurity = false THEN '✅ SUCESSO - RLS DESABILITADO'
    ELSE '❌ AINDA ATIVO - PROBLEMA'
  END as resultado
FROM pg_tables 
WHERE tablename = 'aih_registros';

