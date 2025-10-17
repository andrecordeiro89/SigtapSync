# ⚡ SISAIH01 - Quick Start

## 🚀 Em 3 Passos

### 1️⃣ Criar Tabela no Supabase (2 minutos)

```bash
# 1. Abrir Supabase Dashboard
https://app.supabase.com

# 2. SQL Editor → New Query

# 3. Copiar e Colar o conteúdo de:
database/create_aih_registros_table.sql

# 4. Click "Run" (Ctrl + Enter)

# 5. Verificar sucesso:
✅ Tabela criada
✅ 8 índices criados
✅ 3 views criadas
✅ Trigger configurado
✅ RLS habilitado
```

### 2️⃣ Testar Localmente (5 minutos)

```bash
# 1. Terminal
npm run dev

# 2. Browser
http://localhost:5173

# 3. Login no sistema

# 4. Menu lateral → "SISAIH01"

# 5. Upload arquivo de teste
```

### 3️⃣ Validar Funcionamento (3 minutos)

```sql
-- No Supabase SQL Editor, execute:

-- 1. Verificar tabela
SELECT COUNT(*) FROM aih_registros;

-- 2. Ver estatísticas
SELECT * FROM aih_registros_stats;

-- 3. Ver primeiros registros
SELECT 
  numero_aih,
  nome_paciente,
  data_internacao,
  cns
FROM aih_registros
LIMIT 5;
```

---

## ✅ Checklist Rápido

- [ ] SQL executado no Supabase
- [ ] Servidor dev rodando
- [ ] Menu "SISAIH01" aparece no sidebar
- [ ] Upload de arquivo funciona
- [ ] Estatísticas aparecem
- [ ] Busca funciona
- [ ] Exportar CSV funciona
- [ ] Salvar no banco funciona
- [ ] Dados aparecem no banco

---

## 🎯 Pronto!

Se todos os itens acima estão ✅, seu sistema está **funcionando perfeitamente**.

---

## 📚 Próximos Passos

- **Usar:** Consulte `docs/SISAIH01_GUIA_DE_USO.md`
- **Desenvolver:** Consulte `docs/SISAIH01_DESENVOLVIMENTO.md`
- **Problemas:** Consulte `SISAIH01_CHECKLIST.md` (seção Troubleshooting)

---

## 🆘 Problemas?

### Erro: "relation 'aih_registros' does not exist"
➡️ Execute o SQL no Supabase (passo 1)

### Erro: "Failed to fetch"
➡️ Verifique se você está logado no sistema

### Menu não aparece
➡️ Faça hard refresh (Ctrl + Shift + R)

### Caracteres estranhos
➡️ Use upload de arquivo (não cole conteúdo)

---

**Tempo total:** ~10 minutos

🚀 **Bom trabalho!**

