# 🔐 SISAIH01 - Troubleshooting de Autenticação

## 🐛 Problema Encontrado

### Erro 401 (Unauthorized)

```
Failed to load resource: the server responded with a status of 401 ()
```

### Erro 400 (Bad Request)

```
Erro no lote 1: Object
Failed to load resource: the server responded with a status of 400 ()
```

---

## 🔍 Causa Raiz

O erro 401 indica que o **usuário não estava autenticado** ou a **sessão havia expirado** ao tentar salvar os dados no Supabase.

Possíveis causas:
1. ✅ Sessão do Supabase expirou
2. ✅ Token de autenticação inválido
3. ✅ RLS (Row Level Security) bloqueando o acesso
4. ✅ Usuário não estava logado

---

## ✅ Solução Implementada

### 1. Verificação de Autenticação

Adicionei verificações em múltiplos níveis:

```typescript
// 1. Verificar se usuário está logado
const { user } = useAuth();

if (!user) {
  toast.error('Usuário não autenticado');
  return;
}

// 2. Verificar sessão do Supabase
const { data: { session }, error: sessionError } = await supabase.auth.getSession();

if (sessionError || !session) {
  toast.error('Sessão expirada', {
    description: 'Por favor, faça login novamente'
  });
  return;
}
```

### 2. Melhorias no Tratamento de Erros

```typescript
// Logs detalhados para debug
console.log('✅ Sessão válida, iniciando salvamento...');
console.log(`📦 Processando lote ${i + 1}/${totalBatches}`);

if (error) {
  console.error(`❌ Erro no lote ${i + 1}:`, error);
  console.error('Detalhes do erro:', {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code
  });
}
```

### 3. Lotes Menores

Reduzi o tamanho dos lotes para evitar timeout:

```typescript
// Antes: 500 registros por lote
const BATCH_SIZE = 500;

// Agora: 100 registros por lote
const BATCH_SIZE = 100;
```

### 4. Simplificação do Upsert

Removi parâmetros desnecessários que poderiam causar erro 400:

```typescript
// Antes (mais complexo)
.upsert(dadosParaInserir, { 
  onConflict: 'numero_aih',
  ignoreDuplicates: false 
})
.select();

// Agora (simplificado)
.upsert(dadosParaInserir, { 
  onConflict: 'numero_aih'
});
```

---

## 🚀 Como Testar Agora

### 1. Recarregar a Página

```bash
# Pressione Ctrl + Shift + R (hard refresh)
```

### 2. Verificar no Console

Abra o console do navegador (F12) e procure por:

```
✅ Sessão válida, iniciando salvamento...
📦 Processando lote 1/X (100 registros)
✅ Lote 1 salvo com sucesso
```

### 3. Se Ainda Der Erro 401

**Solução 1: Fazer Logout e Login Novamente**

```
1. Clicar no botão de logout
2. Fazer login novamente
3. Tentar salvar novamente
```

**Solução 2: Limpar Cache do Navegador**

```
1. Pressionar Ctrl + Shift + Delete
2. Limpar cache e cookies
3. Recarregar página
4. Fazer login
```

---

## 🔧 Verificações Adicionais

### Verificar RLS no Supabase

Execute este SQL no Supabase para verificar as políticas:

```sql
-- Ver políticas da tabela aih_registros
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
WHERE tablename = 'aih_registros';
```

**Resultado esperado:** Deve ter 4 políticas (SELECT, INSERT, UPDATE, DELETE)

### Verificar Sessão no Console

No console do navegador, execute:

```javascript
// Verificar sessão atual
const { data, error } = await supabase.auth.getSession();
console.log('Sessão:', data);
console.log('Erro:', error);

// Verificar usuário atual
const { data: { user } } = await supabase.auth.getUser();
console.log('Usuário:', user);
```

---

## 📊 Logs Úteis

Durante o salvamento, você verá logs como:

```
✅ Sessão válida, iniciando salvamento...
📦 Processando lote 1/5 (100 registros)
✅ Lote 1 salvo com sucesso
📦 Processando lote 2/5 (100 registros)
✅ Lote 2 salvo com sucesso
...
```

### Se houver erro, você verá:

```
❌ Erro no lote 1: {
  message: "new row violates row-level security policy",
  details: "...",
  hint: "...",
  code: "42501"
}
```

---

## 🛡️ Políticas RLS Corretas

Se o erro persistir, verifique se as políticas RLS estão corretas:

```sql
-- Habilitar RLS
ALTER TABLE aih_registros ENABLE ROW LEVEL SECURITY;

-- Política de INSERT (usuários autenticados)
DROP POLICY IF EXISTS "Usuários autenticados podem inserir aih_registros" ON aih_registros;
CREATE POLICY "Usuários autenticados podem inserir aih_registros"
  ON aih_registros
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política de UPDATE (usuários autenticados)
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar aih_registros" ON aih_registros;
CREATE POLICY "Usuários autenticados podem atualizar aih_registros"
  ON aih_registros
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política de SELECT (usuários autenticados)
DROP POLICY IF EXISTS "Usuários autenticados podem ler aih_registros" ON aih_registros;
CREATE POLICY "Usuários autenticados podem ler aih_registros"
  ON aih_registros
  FOR SELECT
  TO authenticated
  USING (true);
```

### ⚠️ Importante: Verificar Role

Execute no Supabase:

```sql
-- Ver role do usuário atual
SELECT current_user, session_user;

-- Ver se RLS está habilitado
SELECT 
  tablename,
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'aih_registros';
```

---

## 🎯 Resultado Esperado Após Correção

Quando funcionar corretamente, você verá:

### Console do Navegador:
```
✅ Sessão válida, iniciando salvamento...
📦 Processando lote 1/5 (100 registros)
✅ Lote 1 salvo com sucesso
📦 Processando lote 2/5 (100 registros)
✅ Lote 2 salvo com sucesso
📦 Processando lote 3/5 (100 registros)
✅ Lote 3 salvo com sucesso
📦 Processando lote 4/5 (100 registros)
✅ Lote 4 salvo com sucesso
📦 Processando lote 5/5 (100 registros)
✅ Lote 5 salvo com sucesso
```

### Toast de Sucesso:
```
✅ 500 registros salvos com sucesso!
Dados gravados na tabela aih_registros
```

### No Supabase:
```sql
SELECT COUNT(*) FROM aih_registros;
-- Deve retornar o número de registros salvos
```

---

## 📞 Se o Problema Persistir

1. **Verificar Logs do Supabase:**
   - Ir em Supabase Dashboard
   - Clicar em "Logs"
   - Filtrar por "API"
   - Procurar por erros 401 ou 400

2. **Verificar Autenticação:**
   ```sql
   -- No Supabase SQL Editor
   SELECT auth.uid();  -- Deve retornar o UUID do usuário
   ```

3. **Desabilitar RLS Temporariamente (APENAS PARA TESTE):**
   ```sql
   ALTER TABLE aih_registros DISABLE ROW LEVEL SECURITY;
   -- Testar salvamento
   -- Se funcionar, o problema é RLS
   -- LEMBRAR DE REABILITAR:
   ALTER TABLE aih_registros ENABLE ROW LEVEL SECURITY;
   ```

4. **Verificar Variáveis de Ambiente:**
   ```typescript
   // No código, verificar se as keys estão corretas
   console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
   console.log('Supabase Anon Key:', import.meta.env.VITE_SUPABASE_ANON_KEY);
   ```

---

## ✅ Checklist de Resolução

- [ ] Fazer logout e login novamente
- [ ] Limpar cache do navegador
- [ ] Verificar logs no console (F12)
- [ ] Verificar políticas RLS no Supabase
- [ ] Testar salvamento com arquivo pequeno (10-20 registros)
- [ ] Verificar sessão no console do navegador
- [ ] Verificar logs de erro no Supabase Dashboard
- [ ] Se necessário, recriar políticas RLS

---

## 📈 Melhorias Implementadas

✅ **Verificação de autenticação** antes de salvar
✅ **Verificação de sessão** do Supabase
✅ **Logs detalhados** para debug
✅ **Lotes menores** (100 em vez de 500)
✅ **Tratamento de erros** aprimorado
✅ **Feedback visual** melhorado
✅ **Mensagens de erro** mais claras

---

**Data:** 17 de Outubro de 2024  
**Status:** ✅ Correções implementadas - Pronto para teste

