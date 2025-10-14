-- =====================================================
-- ADICIONAR COLUNA PGT_ADM NA TABELA AIHS
-- Pagamento Administrativo: "sim" ou "não"
-- =====================================================

-- 1. Adicionar coluna
ALTER TABLE aihs 
ADD COLUMN IF NOT EXISTS pgt_adm VARCHAR(3) DEFAULT 'não';

-- 2. Adicionar constraint para aceitar apenas "sim" ou "não"
ALTER TABLE aihs
ADD CONSTRAINT check_pgt_adm CHECK (pgt_adm IN ('sim', 'não'));

-- 3. Criar índice para performance (se necessário filtrar por esse campo)
CREATE INDEX IF NOT EXISTS idx_aihs_pgt_adm ON aihs(pgt_adm);

-- 4. Atualizar registros existentes com valor padrão
UPDATE aihs 
SET pgt_adm = 'não' 
WHERE pgt_adm IS NULL;

-- 5. Comentário na coluna
COMMENT ON COLUMN aihs.pgt_adm IS 'Indica se a AIH tem pagamento administrativo: "sim" ou "não". Padrão: "não"';

-- ✅ CONCLUÍDO: Coluna pgt_adm adicionada com sucesso!

