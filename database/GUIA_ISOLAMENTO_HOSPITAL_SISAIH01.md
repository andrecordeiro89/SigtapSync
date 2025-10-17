# 🔐 GUIA: Isolamento de Dados por Hospital - SISAIH01

## 📋 **Visão Geral**

Este guia explica como o sistema garante que **cada operador veja apenas os dados do seu hospital** no módulo SISAIH01.

---

## 🎯 **Estratégia Implementada**

### **Abordagem Simplificada:**
1. ✅ **Ao salvar:** Usar `hospital_id` do usuário logado
2. ✅ **Ao consultar:** Filtrar por `hospital_id` do usuário
3. ✅ **No frontend:** Controle de acesso baseado em roles
4. ✅ **RLS (opcional):** Pode ser habilitado para segurança extra

---

## 💾 **1. SALVAMENTO DE DADOS**

### **Como Funciona:**

Quando um operador faz upload do arquivo SISAIH01:

```typescript
// ✅ IMPLEMENTADO NO SISAIH01Page.tsx

const handleSalvarNoBanco = async () => {
  // 1. Pegar hospital_id do usuário logado
  const { user, getCurrentHospital } = useAuth();
  const hospitalIdUsuario = getCurrentHospital();
  
  // 2. Validar se usuário tem hospital
  if (!hospitalIdUsuario || hospitalIdUsuario === 'ALL') {
    toast.error('Usuário sem hospital vinculado');
    return;
  }
  
  // 3. Adicionar hospital_id a TODOS os registros
  const dadosParaInserir = lote.map(r => ({
    ...r,
    hospital_id: hospitalIdUsuario // 🔐 Vincula ao hospital do usuário
  }));
  
  // 4. Salvar no banco
  await supabase
    .from('aih_registros')
    .upsert(dadosParaInserir);
};
```

### **Resultado:**
- ✅ Todos os registros ficam vinculados ao hospital do operador
- ✅ Não importa qual CNES está no arquivo
- ✅ Isolamento garantido

---

## 📊 **2. CONSULTA DE DADOS (TODO - Implementar)**

### **Próximo Passo: Adicionar Filtro nas Queries**

Para garantir que cada operador veja apenas seus dados, precisamos filtrar as queries:

```typescript
// EXEMPLO: Carregar registros do hospital do usuário

const carregarRegistros = async () => {
  const { user, getCurrentHospital } = useAuth();
  const hospitalIdUsuario = getCurrentHospital();
  
  // Filtrar por hospital do usuário
  const { data, error } = await supabase
    .from('aih_registros')
    .select('*')
    .eq('hospital_id', hospitalIdUsuario) // 🔐 Filtro obrigatório
    .order('created_at', { ascending: false });
    
  return data;
};
```

---

## 🔒 **3. CONTROLE DE ACESSO POR ROLE**

### **Permissões por Tipo de Usuário:**

| Role | Acesso | Comportamento |
|------|--------|---------------|
| **Operador** | Apenas seu hospital | Vê e salva apenas no hospital vinculado |
| **Coordenador** | Vários hospitais | Pode ter acesso a múltiplos hospitais |
| **Diretor/Admin** | TODOS os hospitais | Vê dados de todos os hospitais |
| **Auditor** | TODOS (leitura) | Vê tudo, mas não pode modificar |

### **Implementação:**

```typescript
const { user, hasFullAccess, canAccessAllHospitals } = useAuth();

// Verificar se pode ver todos os hospitais
if (canAccessAllHospitals()) {
  // Carregar todos os registros (sem filtro)
  query = supabase.from('aih_registros').select('*');
} else {
  // Filtrar pelo hospital do usuário
  query = supabase
    .from('aih_registros')
    .select('*')
    .eq('hospital_id', hospitalIdUsuario);
}
```

---

## 🛡️ **4. RLS (ROW LEVEL SECURITY) - OPCIONAL**

### **Opção A: RLS Desabilitado (Atual - Mais Simples)**

**Vantagens:**
- ✅ Mais simples de implementar
- ✅ Sem overhead de performance
- ✅ Controle total no frontend

**Desvantagens:**
- ⚠️ Depende do código do frontend estar correto
- ⚠️ Menos seguro se houver bug no código

**Quando usar:** Ideal para maioria dos casos

### **Opção B: RLS Habilitado (Mais Seguro)**

**Vantagens:**
- ✅ Segurança no nível do banco de dados
- ✅ Impossível burlar via frontend
- ✅ Auditoria garantida

**Desvantagens:**
- ⚠️ Mais complexo de configurar
- ⚠️ Pequeno overhead de performance
- ⚠️ Requer configuração de sessão

**Como habilitar:**
```sql
-- Execute o arquivo:
database/configure_rls_aih_registros_por_hospital.sql
```

**Quando usar:** Ambientes de alta segurança ou compliance rigoroso

---

## 📝 **5. CHECKLIST DE IMPLEMENTAÇÃO**

### **✅ Já Implementado:**
- [x] Import do `useAuth` no SISAIH01Page.tsx
- [x] Pegar `hospital_id` do usuário logado
- [x] Validar que usuário tem hospital antes de salvar
- [x] Adicionar `hospital_id` a todos os registros ao salvar
- [x] Mensagens de erro para usuários sem hospital

### **⏳ Próximos Passos (TODO):**
- [ ] **Adicionar filtro nas queries de listagem**
- [ ] Carregar apenas registros do hospital do usuário
- [ ] Filtrar estatísticas por hospital
- [ ] Testar com múltiplos usuários de hospitais diferentes
- [ ] (Opcional) Habilitar RLS para segurança extra

---

## 🔧 **6. IMPLEMENTAÇÃO: FILTRAR QUERIES**

### **Modificar SISAIH01Page.tsx:**

```typescript
// TODO: Adicionar ao componente SISAIH01Page

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const SISAIH01Page = () => {
  const { user, getCurrentHospital, canAccessAllHospitals } = useAuth();
  const hospitalIdUsuario = getCurrentHospital();
  
  // Carregar registros do banco ao abrir a tela
  useEffect(() => {
    carregarRegistrosSalvos();
  }, [hospitalIdUsuario]);
  
  const carregarRegistrosSalvos = async () => {
    try {
      let query = supabase
        .from('aih_registros')
        .select('*');
      
      // 🔐 Filtrar por hospital (exceto admins)
      if (!canAccessAllHospitals() && hospitalIdUsuario) {
        query = query.eq('hospital_id', hospitalIdUsuario);
      }
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(1000);
      
      if (error) throw error;
      
      console.log(`📊 ${data.length} registros carregados do banco`);
      // Processar e exibir dados...
      
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
    }
  };
  
  // ... resto do componente
};
```

---

## 🎯 **7. CENÁRIOS DE USO**

### **Cenário 1: Hospital Apucarana (Operador)**

**Usuário:** João (Operador)  
**Hospital:** Hospital Apucarana (ID: abc-123)

**Ações:**
1. Faz upload de arquivo SISAIH01 com 500 registros
2. Sistema adiciona `hospital_id = abc-123` a todos
3. Salva no banco com sucesso
4. Ao visualizar, vê apenas esses 500 registros
5. Não vê registros de outros hospitais

### **Cenário 2: Diretor Geral**

**Usuário:** Maria (Diretora)  
**Hospital:** TODOS (`hospital_id = 'ALL'`)

**Ações:**
1. Acessa tela SISAIH01
2. Sistema carrega TODOS os registros (sem filtro)
3. Vê 5.000 registros de 10 hospitais diferentes
4. Pode filtrar por hospital manualmente
5. Visão consolidada de toda a rede

### **Cenário 3: Coordenador Multi-Hospital**

**Usuário:** Pedro (Coordenador)  
**Hospital:** Múltiplos (`hospital_access = ['abc-123', 'def-456']`)

**Ações:**
1. Pode fazer upload em qualquer hospital que tem acesso
2. Ao visualizar, vê registros de todos os hospitais permitidos
3. Seletor de hospital no topo da tela
4. Relatórios consolidados por hospital

---

## 🚨 **8. SEGURANÇA E VALIDAÇÕES**

### **Validações no Frontend:**

✅ **Antes de salvar:**
```typescript
if (!hospitalIdUsuario || hospitalIdUsuario === 'ALL') {
  toast.error('Operadores devem ter um hospital específico');
  return;
}
```

✅ **Ao consultar:**
```typescript
if (!canAccessAllHospitals()) {
  query = query.eq('hospital_id', hospitalIdUsuario);
}
```

### **Validações no Banco (RLS):**

✅ **Se RLS habilitado:**
```sql
-- Operadores só veem registros do seu hospital
CREATE POLICY "isolamento_hospital"
ON aih_registros
FOR SELECT
USING (
  hospital_id = current_setting('app.current_hospital_id')::UUID
  OR
  has_full_access() = TRUE
);
```

---

## 📊 **9. ANÁLISES E RELATÓRIOS**

### **Por Hospital (Operador):**
```sql
-- Estatísticas do meu hospital
SELECT 
  COUNT(*) as total_registros,
  COUNT(DISTINCT cns) as pacientes_unicos,
  MIN(data_internacao) as primeira_internacao,
  MAX(data_internacao) as ultima_internacao
FROM aih_registros
WHERE hospital_id = 'abc-123';
```

### **Consolidado (Diretor):**
```sql
-- Estatísticas de todos os hospitais
SELECT 
  h.name as hospital,
  COUNT(*) as total_registros,
  COUNT(DISTINCT ar.cns) as pacientes_unicos
FROM aih_registros ar
JOIN hospitals h ON ar.hospital_id = h.id
GROUP BY h.name
ORDER BY total_registros DESC;
```

---

## ✅ **10. RESUMO**

### **Implementação Atual:**
| Componente | Status | Detalhes |
|------------|--------|----------|
| Salvamento | ✅ Completo | Usa hospital_id do usuário |
| Validação | ✅ Completo | Bloqueia usuários sem hospital |
| Consulta | ⏳ Pendente | Precisa adicionar filtros |
| RLS | ⚙️ Opcional | Script pronto para uso |

### **Próxima Ação:**
1. ✅ **Executar SQL** `add_hospital_id_to_aih_registros.sql`
2. ⏳ **Implementar filtros** nas queries de listagem
3. ⏳ **Testar** com múltiplos usuários
4. ⚙️ **Habilitar RLS** (opcional)

---

## 📞 **Suporte**

Em caso de dúvidas sobre isolamento de dados:
1. Verificar `hospital_id` do usuário no console
2. Verificar políticas RLS no Supabase
3. Consultar logs de auditoria
4. Revisar este guia

---

**Última Atualização:** 17/10/2025  
**Versão:** 1.0  
**Status:** Salvamento implementado, consulta pendente

