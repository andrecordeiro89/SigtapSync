-- ================================================================
-- CORREÇÃO: Permitir NULL em data_internacao e data_nascimento
-- Alguns registros SISAIH01 (tipo 03 - Continuação) não têm esses dados
-- ================================================================

-- 1. Tornar data_internacao NULLABLE
ALTER TABLE aih_registros 
ALTER COLUMN data_internacao DROP NOT NULL;

-- 2. Tornar data_nascimento NULLABLE (pode também estar vazio)
ALTER TABLE aih_registros 
ALTER COLUMN data_nascimento DROP NOT NULL;

-- 3. Tornar sexo NULLABLE (pode estar vazio em registros de continuação)
ALTER TABLE aih_registros 
ALTER COLUMN sexo DROP NOT NULL;

-- 4. Verificar resultado
SELECT 
  column_name,
  data_type,
  is_nullable,
  CASE 
    WHEN is_nullable = 'YES' THEN '✅ Permite NULL'
    ELSE '⚠️ Obrigatório'
  END as status
FROM information_schema.columns
WHERE table_name = 'aih_registros'
  AND column_name IN ('data_internacao', 'data_nascimento', 'sexo', 'nome_paciente')
ORDER BY column_name;

-- ================================================================
-- MENSAGEM DE SUCESSO
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Campos tornados opcionais:';
  RAISE NOTICE '   - data_internacao agora permite NULL';
  RAISE NOTICE '   - data_nascimento agora permite NULL';
  RAISE NOTICE '   - sexo agora permite NULL';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Registros tipo 03 (Continuação) agora podem ser salvos';
END $$;

