-- ============================================
-- VERIFICAR RLS (ROW LEVEL SECURITY) NA TABELA DOCTORS
-- ============================================

-- 1. Verificar se RLS está ativado
SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename = 'doctors';

-- 2. Listar políticas RLS ativas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'doctors';

-- 3. Verificar se o médico específico é visível para anon
SET ROLE anon;
SELECT id, name, cns, is_active
FROM doctors
WHERE cns = '702002315432783';
RESET ROLE;

-- 4. Verificar se há filtros hospital_id que possam bloquear
SELECT id, name, cns, hospital_id, is_active
FROM doctors
WHERE cns = '702002315432783';

