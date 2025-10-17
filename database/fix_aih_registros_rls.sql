-- ================================================================
-- CORREÇÃO: Desabilitar RLS para aih_registros
-- Sistema usa user_profiles customizado, não Supabase Auth
-- ================================================================

-- OPÇÃO 1: DESABILITAR RLS COMPLETAMENTE (MAIS SIMPLES)
ALTER TABLE aih_registros DISABLE ROW LEVEL SECURITY;

-- ================================================================
-- OPÇÃO 2 (ALTERNATIVA): Políticas Permissivas
-- Use apenas se quiser manter RLS ativo
-- ================================================================

/*
-- Remover políticas antigas
DROP POLICY IF EXISTS "Usuários autenticados podem ler aih_registros" ON aih_registros;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir aih_registros" ON aih_registros;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar aih_registros" ON aih_registros;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar aih_registros" ON aih_registros;

-- Criar políticas permissivas (permite tudo)
CREATE POLICY "public_select_aih_registros" ON aih_registros FOR SELECT USING (true);
CREATE POLICY "public_insert_aih_registros" ON aih_registros FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_aih_registros" ON aih_registros FOR UPDATE USING (true);
CREATE POLICY "public_delete_aih_registros" ON aih_registros FOR DELETE USING (true);
*/

-- ================================================================
-- VERIFICAÇÃO
-- ================================================================

-- Verificar se RLS está desabilitado
SELECT 
  tablename,
  rowsecurity,
  CASE 
    WHEN rowsecurity = false THEN '✅ RLS Desabilitado'
    ELSE '⚠️ RLS Ativo'
  END as status
FROM pg_tables 
WHERE tablename = 'aih_registros';

-- Ver políticas (deve estar vazio se RLS desabilitado)
SELECT 
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE tablename = 'aih_registros';

-- ================================================================
-- MENSAGEM DE SUCESSO
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ RLS desabilitado para aih_registros';
  RAISE NOTICE '✅ Tabela agora aceita INSERT/UPDATE sem autenticação';
  RAISE NOTICE '✅ Sistema pode persistir dados livremente';
END $$;

