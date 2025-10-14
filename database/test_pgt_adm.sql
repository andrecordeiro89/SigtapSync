-- =====================================================
-- SCRIPT DE TESTE: Verificar Pagamento Administrativo
-- =====================================================

-- 1️⃣ Verificar se a coluna existe
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'aihs' 
  AND column_name = 'pgt_adm';

-- 2️⃣ Verificar distribuição de valores
SELECT 
  pgt_adm,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentual
FROM aihs
GROUP BY pgt_adm
ORDER BY total DESC;

-- 3️⃣ Ver exemplos de AIHs com pagamento administrativo
SELECT 
  aih_number,
  pgt_adm,
  competencia,
  admission_date,
  processing_status
FROM aihs
WHERE pgt_adm = 'sim'
LIMIT 10;

-- 4️⃣ Testar UPDATE manual (opcional)
-- UPDATE aihs SET pgt_adm = 'sim' WHERE aih_number = 'SEU_AIH_NUMBER_AQUI';

-- 5️⃣ Verificar constraint (deve falhar)
-- UPDATE aihs SET pgt_adm = 'talvez' WHERE id = 'algum_id'; -- ❌ Deve dar erro

