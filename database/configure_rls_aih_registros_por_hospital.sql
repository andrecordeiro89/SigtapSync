-- ================================================================
-- CONFIGURAR RLS (ROW LEVEL SECURITY) PARA ISOLAMENTO POR HOSPITAL
-- Tabela: aih_registros (SISAIH01)
-- ================================================================
-- Objetivo: Cada operador vê apenas os registros do seu hospital
-- Diretores/Admins veem todos os registros
-- ================================================================

-- Passo 1: Habilitar RLS na tabela (se ainda não estiver habilitado)
ALTER TABLE aih_registros ENABLE ROW LEVEL SECURITY;

-- Passo 2: Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Usuários autenticados podem ler aih_registros" ON aih_registros;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir aih_registros" ON aih_registros;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar aih_registros" ON aih_registros;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar aih_registros" ON aih_registros;
DROP POLICY IF EXISTS "aih_registros_select_policy" ON aih_registros;
DROP POLICY IF EXISTS "aih_registros_insert_policy" ON aih_registros;
DROP POLICY IF EXISTS "aih_registros_update_policy" ON aih_registros;
DROP POLICY IF EXISTS "aih_registros_delete_policy" ON aih_registros;

-- ================================================================
-- FUNÇÕES AUXILIARES PARA RLS
-- ================================================================

-- Função: Verificar se usuário tem acesso total (admin/diretor)
CREATE OR REPLACE FUNCTION has_full_access_sisaih01()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Buscar role do usuário na tabela user_profiles
  -- Usando auth.uid() que retorna o UUID do usuário autenticado
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = auth.uid();
  
  -- Roles com acesso total: developer, admin, director, coordinator, auditor, ti
  RETURN user_role IN ('developer', 'admin', 'director', 'coordinator', 'auditor', 'ti');
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: Obter hospital_id do usuário logado
CREATE OR REPLACE FUNCTION get_user_hospital_id()
RETURNS UUID AS $$
DECLARE
  hospital_id_value UUID;
BEGIN
  -- Buscar hospital_id do usuário na sessão
  -- Primeiro tenta pegar da sessão (variável local)
  hospital_id_value := current_setting('app.current_hospital_id', TRUE)::UUID;
  
  IF hospital_id_value IS NOT NULL THEN
    RETURN hospital_id_value;
  END IF;
  
  -- Fallback: buscar do user_profiles (não recomendado pois user_profiles não tem hospital_id único)
  -- Retorna NULL se não encontrar
  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- POLÍTICAS RLS - SELECT (LEITURA)
-- ================================================================

-- Política: Usuários com acesso total veem TODOS os registros
CREATE POLICY "aih_registros_select_full_access"
ON aih_registros
FOR SELECT
TO authenticated
USING (
  has_full_access_sisaih01() = TRUE
);

-- Política: Operadores veem apenas registros do seu hospital
CREATE POLICY "aih_registros_select_hospital_only"
ON aih_registros
FOR SELECT
TO authenticated
USING (
  hospital_id = current_setting('app.current_hospital_id', TRUE)::UUID
);

-- ================================================================
-- POLÍTICAS RLS - INSERT (CRIAÇÃO)
-- ================================================================

-- Política: Usuários podem inserir registros apenas no seu hospital
CREATE POLICY "aih_registros_insert_policy"
ON aih_registros
FOR INSERT
TO authenticated
WITH CHECK (
  -- Ou tem acesso total, ou o hospital_id do registro é o mesmo do usuário
  has_full_access_sisaih01() = TRUE
  OR
  hospital_id = current_setting('app.current_hospital_id', TRUE)::UUID
);

-- ================================================================
-- POLÍTICAS RLS - UPDATE (ATUALIZAÇÃO)
-- ================================================================

-- Política: Usuários podem atualizar apenas registros do seu hospital
CREATE POLICY "aih_registros_update_policy"
ON aih_registros
FOR UPDATE
TO authenticated
USING (
  has_full_access_sisaih01() = TRUE
  OR
  hospital_id = current_setting('app.current_hospital_id', TRUE)::UUID
)
WITH CHECK (
  has_full_access_sisaih01() = TRUE
  OR
  hospital_id = current_setting('app.current_hospital_id', TRUE)::UUID
);

-- ================================================================
-- POLÍTICAS RLS - DELETE (EXCLUSÃO)
-- ================================================================

-- Política: Apenas admins podem deletar
CREATE POLICY "aih_registros_delete_policy"
ON aih_registros
FOR DELETE
TO authenticated
USING (
  has_full_access_sisaih01() = TRUE
);

-- ================================================================
-- COMENTÁRIOS
-- ================================================================

COMMENT ON POLICY "aih_registros_select_full_access" ON aih_registros IS 
'Administradores e diretores veem todos os registros SISAIH01';

COMMENT ON POLICY "aih_registros_select_hospital_only" ON aih_registros IS 
'Operadores veem apenas registros do seu hospital';

COMMENT ON POLICY "aih_registros_insert_policy" ON aih_registros IS 
'Usuários podem inserir registros apenas no seu hospital';

COMMENT ON POLICY "aih_registros_update_policy" ON aih_registros IS 
'Usuários podem atualizar apenas registros do seu hospital';

COMMENT ON POLICY "aih_registros_delete_policy" ON aih_registros IS 
'Apenas administradores podem deletar registros';

-- ================================================================
-- GUIA DE USO: Configurar hospital_id na sessão
-- ================================================================

/*
IMPORTANTE: Para as políticas RLS funcionarem, você deve configurar
o hospital_id na sessão ANTES de fazer queries. 

No JavaScript/TypeScript (frontend):

// Ao fazer login ou trocar de hospital:
await supabase.rpc('set_session_hospital_id', { 
  hospital_id: 'uuid-do-hospital' 
});

// Depois disso, todas as queries respeitarão o RLS automaticamente

OU

// Configurar diretamente via SQL:
SET app.current_hospital_id = 'uuid-do-hospital';

// Verificar configuração:
SELECT current_setting('app.current_hospital_id', TRUE);
*/

-- ================================================================
-- FUNÇÃO AUXILIAR: Configurar hospital_id na sessão
-- ================================================================

CREATE OR REPLACE FUNCTION set_session_hospital_id(hospital_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Configurar variável de sessão
  PERFORM set_config('app.current_hospital_id', hospital_id::TEXT, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_session_hospital_id IS 
'Configura o hospital_id na sessão para RLS funcionar corretamente';

-- ================================================================
-- TESTES DE VERIFICAÇÃO
-- ================================================================

-- Verificar se RLS está habilitado
SELECT 
  tablename,
  rowsecurity as rls_habilitado
FROM pg_tables
WHERE tablename = 'aih_registros';

-- Listar políticas criadas
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'aih_registros'
ORDER BY policyname;

-- ================================================================
-- MENSAGENS DE SUCESSO
-- ================================================================

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  -- Contar políticas criadas
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'aih_registros';

  RAISE NOTICE '';
  RAISE NOTICE '✅ RLS configurado com sucesso!';
  RAISE NOTICE '✅ % políticas criadas', policy_count;
  RAISE NOTICE '✅ Funções auxiliares criadas';
  RAISE NOTICE '';
  RAISE NOTICE '📋 RESUMO DAS POLÍTICAS:';
  RAISE NOTICE '   🔒 SELECT: Operadores veem apenas seu hospital';
  RAISE NOTICE '   🔒 INSERT: Operadores inserem apenas no seu hospital';
  RAISE NOTICE '   🔒 UPDATE: Operadores atualizam apenas seu hospital';
  RAISE NOTICE '   🔒 DELETE: Apenas administradores';
  RAISE NOTICE '';
  RAISE NOTICE '💡 IMPORTANTE: Configure o hospital_id na sessão:';
  RAISE NOTICE '   SELECT set_session_hospital_id(''uuid-do-hospital'');';
  RAISE NOTICE '';
END $$;

-- ================================================================
-- FIM DO SCRIPT
-- ================================================================

