# 📋 Instruções: Adicionar Pagamento Administrativo (pgt_adm)

## ✅ Resumo da Funcionalidade

Adicionamos um campo **"Pagamento Administrativo"** nos cards de AIH na tela de **Pacientes**.

### 🎯 Comportamento:
- **Toggle visual** no card de cada AIH
- Valores: `"sim"` ou `"não"` (padrão: `"não"`)
- **Atualização automática** no banco ao clicar
- **Feedback visual** instantâneo com optimistic update
- **Notificação toast** confirmando a alteração

---

## 🗄️ 1. Executar SQL no Banco de Dados

### Opção A: Via Supabase Dashboard (Recomendado)

1. Acesse: **Supabase Dashboard → SQL Editor**
2. Copie e execute o conteúdo do arquivo: `database/add_pgt_adm_column.sql`

### Opção B: Via Cliente PostgreSQL Local

```bash
psql -h <SEU_HOST> -U <SEU_USER> -d <SEU_DATABASE> -f database/add_pgt_adm_column.sql
```

### O que o SQL faz:
```sql
-- ✅ Adiciona coluna pgt_adm (VARCHAR(3), padrão "não")
-- ✅ Adiciona constraint CHECK (apenas "sim" ou "não")
-- ✅ Cria índice para performance
-- ✅ Atualiza registros existentes com "não"
-- ✅ Adiciona comentário na coluna
```

---

## 🎨 2. Interface Implementada

### Localização:
- **Arquivo**: `src/components/PatientManagement.tsx`
- **Linha**: ~1690-1709 (Toggle no card)

### Visual:
```
┌─────────────────────────────────────────┐
│  [📅 Editar] [🟢 Pgt. Adm] [🗑️ Excluir] │
└─────────────────────────────────────────┘
```

- **Verde** quando `pgt_adm = 'sim'` (ativado)
- **Cinza** quando `pgt_adm = 'não'` (desativado)

---

## 🔧 3. Lógica de Atualização

### Função: `handleTogglePgtAdm`
```typescript
// Alterna automaticamente entre "sim" e "não"
// Atualiza UI imediatamente (optimistic update)
// Salva no banco em background
// Reverte se houver erro
```

### Estado gerenciado:
- `savingPgtAdm`: controla loading do botão
- Atualização via Supabase direto (`.update()`)

---

## ✅ 4. Verificação

Após executar o SQL, verifique:

```sql
-- Verificar se a coluna foi criada
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'aihs' AND column_name = 'pgt_adm';

-- Resultado esperado:
-- column_name | data_type | column_default
-- pgt_adm     | varchar   | 'não'::character varying
```

---

## 🧪 5. Teste Manual

1. **Acesse a tela Pacientes** no sistema
2. **Localize um card de AIH**
3. **Clique no botão "Pgt. Adm"** (deve estar cinza)
4. **Observe**:
   - ✅ Botão muda para verde imediatamente
   - ✅ Toast de confirmação aparece
   - ✅ Valor persiste após refresh da página
5. **Clique novamente** para desativar
   - ✅ Botão volta para cinza
   - ✅ Toast de confirmação aparece

---

## 📊 6. Estrutura de Dados

### Tabela: `aihs`
```sql
CREATE TABLE aihs (
  ...
  pgt_adm VARCHAR(3) DEFAULT 'não' CHECK (pgt_adm IN ('sim', 'não')),
  ...
);
```

### Interface TypeScript:
```typescript
interface AIH {
  ...
  pgt_adm?: 'sim' | 'não'; // Pagamento Administrativo
  ...
}
```

---

## 🚀 7. Próximos Passos (Opcional)

### Possíveis Melhorias:
- [ ] Adicionar filtro de "Pgt. Adm" nos filtros da tela
- [ ] Incluir estatísticas de AIHs com/sem pgt_adm no Dashboard
- [ ] Exportar campo em relatórios CSV/PDF
- [ ] Adicionar auditoria de alterações do campo

---

## 📝 Notas Técnicas

- ✅ **Optimistic Update**: UI atualiza antes da confirmação do banco
- ✅ **Rollback automático**: Se falhar, reverte a mudança
- ✅ **RLS compatível**: Respeita as políticas de segurança existentes
- ✅ **Sem breaking changes**: Coluna opcional, não quebra código existente

---

## ⚠️ Troubleshooting

### Erro: "column 'pgt_adm' does not exist"
**Solução**: Execute o SQL de criação da coluna

### Erro: "violates check constraint"
**Solução**: Certifique-se de usar apenas "sim" ou "não" (lowercase)

### Toggle não atualiza
**Solução**: Verifique o console do navegador (F12) para erros

---

**✅ Implementação Concluída!**

