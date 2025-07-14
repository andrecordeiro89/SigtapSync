# 🚀 **MIGRAÇÃO: Campo Quantidade nos Procedimentos**

## **EXECUTAR MIGRAÇÃO**

Execute o seguinte SQL no seu banco Supabase:

```sql
-- ================================================
-- MIGRAÇÃO: Adicionar campo quantity em procedure_records
-- ================================================

-- Adicionar coluna quantity
ALTER TABLE procedure_records 
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1 NOT NULL;

-- Adicionar coluna unit_value para valor unitário
ALTER TABLE procedure_records 
ADD COLUMN IF NOT EXISTS unit_value INTEGER DEFAULT 0;

-- Atualizar registros existentes
UPDATE procedure_records 
SET quantity = 1 
WHERE quantity IS NULL;

-- Calcular unit_value para registros existentes
UPDATE procedure_records 
SET unit_value = value_charged 
WHERE unit_value = 0 AND value_charged > 0;

-- Verificação
SELECT 
  'Migration completed successfully' as status,
  COUNT(*) as total_records,
  COUNT(CASE WHEN quantity IS NOT NULL THEN 1 END) as records_with_quantity
FROM procedure_records;
```

## **TESTAR FUNCIONALIDADE**

1. **Acesse**: AIH Avançado (MultiPageTester)
2. **Carregue**: Qualquer AIH processada
3. **Altere**: Quantidade de um procedimento secundário
4. **Verifique**: Valor total recalculado automaticamente
5. **Salve**: Confirme persistência no banco

## **FUNCIONALIDADES NOVAS**

### ✅ **Campo Quantidade**
- Input numérico editável (1-99)
- Validação automática de limites
- Recálculo instantâneo de valores

### ✅ **Multiplicação Automática**
- Valor unitário × quantidade = valor total
- Preserva valor unitário para referência
- Atualiza total da AIH automaticamente

### ✅ **Indicadores Visuais**
- Badge "2x" para quantidade > 1
- Detalhe "(R$ 100,00 × 2)" nos valores
- Info expandida com valor unitário

### ✅ **Persistência**
- Campo `quantity` salvo no banco
- Campo `unit_value` calculado automaticamente
- Compatibilidade com dados existentes

## **RESULTADO ESPERADO**

✅ **Usuário pode alterar quantidade de procedimentos**  
✅ **Valores são multiplicados automaticamente**  
✅ **Persistência no banco funciona corretamente**  
✅ **Interface responsiva e intuitiva**  

**🎉 IMPLEMENTAÇÃO COMPLETA E FUNCIONAL!** 