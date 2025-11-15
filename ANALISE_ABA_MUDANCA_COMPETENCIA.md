# 📊 ANÁLISE DETALHADA E SISTEMÁTICA - ABA "MUDANÇA DE COMPETÊNCIA"
## Tela Pacientes - Modo Operador

**Data da Análise:** 2025-01-20  
**Componente:** `src/components/PatientManagement.tsx`  
**Aba Analisada:** `mudanca-competencia`

---

## 📋 SUMÁRIO EXECUTIVO

A aba "Mudança de Competência" permite alterar a competência SUS de múltiplas AIHs em lote, movendo-as para a próxima competência (mês seguinte). A análise revela que **os dados são carregados uma única vez** e filtrados no frontend, o que pode causar problemas de performance e inconsistências.

---

## 🔍 1. ESTRUTURA DE ESTADOS

### 1.1 Estados Específicos da Aba

```typescript
// Linha 200-204
const [activeTab, setActiveTab] = useState<'pacientes' | 'mudanca-competencia'>('pacientes');
const [selectedAIHsForBatch, setSelectedAIHsForBatch] = useState<Set<string>>(new Set());
const [isUpdatingBatch, setIsUpdatingBatch] = useState(false);
const [selectedCompetenciaForBatch, setSelectedCompetenciaForBatch] = useState<string>('all');
```

**Análise:**
- ✅ Estados bem definidos e isolados
- ✅ `selectedAIHsForBatch` usa `Set` para performance
- ⚠️ `selectedCompetenciaForBatch` é independente de `selectedCompetencia` (aba Pacientes)

### 1.2 Estados Compartilhados

```typescript
// Linha 145-160
const [aihs, setAIHs] = useState<AIH[]>([]); // Dados principais
const [availableCompetencias, setAvailableCompetencias] = useState<string[]>([]); // Lista de competências
const [isLoading, setIsLoading] = useState(false);
const [currentPage, setCurrentPage] = useState(0);
const [itemsPerPage] = useState(10);
```

**Análise:**
- ✅ Dados compartilhados entre abas (eficiente)
- ⚠️ **PROBLEMA:** Mesmos dados usados para ambas as abas, mas filtros diferentes

---

## 📥 2. CARREGAMENTO DE DADOS

### 2.1 Função Principal: `loadAIHs()`

**Localização:** Linha 651-730

```typescript
const loadAIHs = async () => {
  setIsLoading(true);
  try {
    const hospitalIdToLoad = selectedHospitalFilter !== 'all' 
      ? selectedHospitalFilter 
      : currentHospitalId;
    
    // ✅ FILTRO DE COMPETÊNCIA APLICADO NO SQL (BACKEND)
    const competenciaFilter = (selectedCompetencia && selectedCompetencia !== 'all') 
      ? selectedCompetencia 
      : undefined;
    
    const batch = await persistenceService.getAIHs(hospitalIdToLoad, {
      limit: pageSize,
      offset,
      competencia: competenciaFilter // ✅ NOVO: Filtrar no SQL
    });
    
    setAIHs(batch.data || []);
  } catch (error) {
    // Tratamento de erro
  } finally {
    setIsLoading(false);
  }
};
```

**Análise Crítica:**

#### ✅ **PONTOS POSITIVOS:**
1. **Filtro de competência aplicado no SQL** (linha 666-675)
2. **Paginação no backend** (limit/offset)
3. **Uso de `AIHPersistenceService`** (camada de abstração)

#### ⚠️ **PROBLEMAS IDENTIFICADOS:**

**PROBLEMA #1: Filtro de Competência Aplicado Apenas na Aba "Pacientes"**
```typescript
// Linha 666-675: Filtro aplicado apenas quando selectedCompetencia !== 'all'
const competenciaFilter = (selectedCompetencia && selectedCompetencia !== 'all') 
  ? selectedCompetencia 
  : undefined;
```

**Impacto:**
- Quando o usuário está na aba "Mudança de Competência", o filtro `selectedCompetenciaForBatch` **NÃO é aplicado no SQL**
- Todos os dados são carregados do banco e filtrados no frontend (linha 994-1001)
- **Ineficiente para grandes volumes de dados**

**PROBLEMA #2: Dados Carregados Uma Única Vez**
```typescript
// Linha 591-596: useEffect que carrega dados
useEffect(() => {
  loadAIHs();
}, [currentHospitalId, selectedHospitalFilter, selectedCompetencia]);
```

**Impacto:**
- `selectedCompetenciaForBatch` **NÃO está nas dependências**
- Ao mudar o filtro na aba "Mudança de Competência", os dados **NÃO são recarregados**
- Filtragem acontece apenas no frontend (JavaScript)

**PROBLEMA #3: Duplicação de Lógica de Filtro**
```typescript
// Linha 992-1004: Filtro no frontend para aba "Mudança de Competência"
const filteredData = unifiedData.filter(item => {
  if (activeTab === 'mudanca-competencia' && selectedCompetenciaForBatch !== 'all') {
    if (selectedCompetenciaForBatch === 'sem_competencia') {
      if (item.competencia) return false;
    } else {
      if (!item.competencia || item.competencia !== selectedCompetenciaForBatch) {
        return false;
      }
    }
  }
  // ... outros filtros
});
```

**Impacto:**
- Lógica de filtro duplicada (backend + frontend)
- Inconsistência potencial entre abas
- Performance degradada com muitos dados

---

## 🔄 3. FLUXO DE DADOS

### 3.1 Fluxo Atual (Como Está)

```
┌─────────────────────────────────────────────────────────┐
│ 1. USUÁRIO ABRE ABA "MUDANÇA DE COMPETÊNCIA"            │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. loadAIHs() É CHAMADO (useEffect linha 591)          │
│    - Usa selectedCompetencia (aba Pacientes)            │
│    - selectedCompetenciaForBatch NÃO é usado           │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. DADOS CARREGADOS DO BANCO (SQL)                      │
│    - Filtro: selectedCompetencia (se != 'all')          │
│    - Paginação: limit/offset                            │
│    - Retorna: Array de AIHs                             │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. DADOS ARMAZENADOS NO ESTADO                          │
│    - setAIHs(batch.data)                                │
│    - unifiedData = aihs (linha ~950)                    │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 5. FILTRO NO FRONTEND (linha 992-1004)                  │
│    - Verifica activeTab === 'mudanca-competencia'       │
│    - Aplica selectedCompetenciaForBatch                 │
│    - Filtra array em memória                            │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 6. PAGINAÇÃO NO FRONTEND (linha 1043-1046)              │
│    - filteredData.slice(currentPage * itemsPerPage)      │
│    - Renderiza apenas página atual                      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 7. RENDERIZAÇÃO NA TABELA (linha 2582-2670)             │
│    - paginatedData.map()                                │
│    - Mostra competência atual e próxima                 │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Problemas no Fluxo

1. **Carregamento Ineficiente:**
   - Dados carregados com filtro da aba "Pacientes"
   - Filtro da aba "Mudança de Competência" aplicado depois
   - Pode carregar dados desnecessários

2. **Falta de Recarregamento:**
   - Ao mudar `selectedCompetenciaForBatch`, dados não são recarregados
   - Filtragem apenas no frontend

3. **Inconsistência:**
   - Aba "Pacientes": filtro no SQL (eficiente)
   - Aba "Mudança de Competência": filtro no frontend (ineficiente)

---

## 🗄️ 4. CONSUMO DE DADOS DO BANCO

### 4.1 Query SQL Executada

**Serviço:** `AIHPersistenceService.getAIHs()`  
**Arquivo:** `src/services/aihPersistenceService.ts`  
**Linha:** 1546-1632

```typescript
// Query base
let query = supabase
  .from('aihs')
  .select(`
    *,
    patients (id, name, cns, birth_date, gender, medical_record),
    aih_matches (id, overall_score, calculated_total, status, match_confidence),
    hospitals (id, name)
  `);

// ✅ Filtro de competência (APENAS se selectedCompetencia !== 'all')
if (filters?.competencia && filters.competencia !== 'all') {
  if (filters.competencia === 'sem_competencia') {
    query = query.is('competencia', null);
  } else {
    query = query.eq('competencia', filters.competencia);
  }
}

// Ordenação
query = query.order('updated_at', { ascending: false });

// Paginação
if (filters?.limit) {
  query = query.limit(filters.limit);
}
if (filters?.offset) {
  query = query.range(filters.offset, filters.offset + filters.limit - 1);
}
```

**Análise:**

#### ✅ **PONTOS POSITIVOS:**
1. **JOIN otimizado** com `patients`, `aih_matches`, `hospitals`
2. **Filtro de competência no SQL** (quando aplicado)
3. **Paginação no backend** (reduz transferência de dados)
4. **Ordenação por `updated_at`** (mais recentes primeiro)

#### ⚠️ **PROBLEMAS:**

**PROBLEMA #1: Filtro Não Aplicado na Aba "Mudança de Competência"**
- Quando `activeTab === 'mudanca-competencia'`, o filtro `selectedCompetenciaForBatch` **não é passado** para `getAIHs()`
- Query carrega **todos os dados** (ou filtrados por `selectedCompetencia` da aba Pacientes)
- Filtragem acontece depois no JavaScript

**PROBLEMA #2: Paginação Limitada**
- Paginação aplicada no SQL, mas **apenas para aba "Pacientes"**
- Na aba "Mudança de Competência", se carregar todos os dados, pode haver problemas de performance

**PROBLEMA #3: Falta de Contagem Total**
- Não há query separada para contar total de registros
- Paginação pode não funcionar corretamente

---

## 🎯 5. FILTRAGEM DE DADOS

### 5.1 Filtro no Frontend (Aba "Mudança de Competência")

**Localização:** Linha 992-1004

```typescript
const filteredData = unifiedData.filter(item => {
  // ✅ NOVO: Filtro de competência específico para aba "Mudança de Competência"
  if (activeTab === 'mudanca-competencia' && selectedCompetenciaForBatch !== 'all') {
    if (selectedCompetenciaForBatch === 'sem_competencia') {
      if (item.competencia) return false; // Excluir se tem competência
    } else {
      if (!item.competencia || item.competencia !== selectedCompetenciaForBatch) {
        return false; // Excluir se não é a competência selecionada
      }
    }
  }
  
  // Filtro de busca textual (sempre aplicado)
  if (!globalSearch) return true;
  const searchLower = globalSearch.toLowerCase();
  return (
    item.aih_number.toLowerCase().includes(searchLower) ||
    (item.patient?.name && item.patient.name.toLowerCase().includes(searchLower)) ||
    (item.patient?.cns && item.patient.cns.includes(globalSearch))
  );
});
```

**Análise:**

#### ✅ **PONTOS POSITIVOS:**
1. **Lógica clara** e bem estruturada
2. **Suporte a "sem competência"** (null)
3. **Filtro de busca textual** funcional

#### ⚠️ **PROBLEMAS:**

**PROBLEMA #1: Filtragem em Memória**
- Todos os dados carregados do banco são mantidos em memória
- Filtragem acontece no JavaScript (não no SQL)
- **Ineficiente para grandes volumes**

**PROBLEMA #2: Dados Duplicados**
- Mesmos dados podem ser carregados múltiplas vezes
- Não há cache inteligente
- Recarregamento completo ao mudar filtros

**PROBLEMA #3: Performance**
- Com 10.000+ AIHs, filtragem no frontend pode ser lenta
- Re-renderização completa ao mudar filtros

---

## 📊 6. RENDERIZAÇÃO DOS DADOS

### 6.1 Tabela de Mudança de Competência

**Localização:** Linha 2582-2670

```typescript
<table className="w-full text-sm">
  <thead>
    <tr>
      <th><Checkbox /> {/* Seleção múltipla */}</th>
      <th>Paciente</th>
      <th>Nº AIH</th>
      <th>Data Admissão</th>
      <th>Data Alta</th>
      <th>Competência Atual</th>
      <th>Nova Competência</th>
    </tr>
  </thead>
  <tbody>
    {paginatedData.map((item) => {
      const proximaCompetencia = calcularProximaCompetencia(item.competencia);
      const isSelected = selectedAIHsForBatch.has(item.id);
      
      return (
        <tr key={item.id} className={isSelected ? 'bg-blue-50' : ''}>
          <td><Checkbox checked={isSelected} /></td>
          <td>{(item.patient || item.patients)?.name}</td>
          <td>{item.aih_number}</td>
          <td>{formatDate(item.admission_date)}</td>
          <td>{formatDate(item.discharge_date)}</td>
          <td>{formatCompetencia(item.competencia)}</td>
          <td>{formatCompetencia(proximaCompetencia)}</td>
        </tr>
      );
    })}
  </tbody>
</table>
```

**Análise:**

#### ✅ **PONTOS POSITIVOS:**
1. **Renderização eficiente** com `paginatedData` (apenas 10 itens por vez)
2. **Cálculo de próxima competência** em tempo real
3. **Feedback visual** para itens selecionados
4. **Formatação adequada** de datas e competências

#### ⚠️ **PROBLEMAS:**

**PROBLEMA #1: Cálculo Repetido**
```typescript
const proximaCompetencia = calcularProximaCompetencia(item.competencia);
```
- Função chamada para cada item em cada render
- Poderia ser memoizada ou calculada uma vez

**PROBLEMA #2: Acesso a Dados Aninhados**
```typescript
{(item.patient || item.patients)?.name}
```
- Verificação dupla (`patient` ou `patients`)
- Indica inconsistência na estrutura de dados

---

## 🔄 7. ATUALIZAÇÃO EM LOTE

### 7.1 Função: `handleBatchUpdateCompetencia()`

**Localização:** Linha 1186-1279

```typescript
const handleBatchUpdateCompetencia = async () => {
  if (selectedAIHsForBatch.size === 0) return;
  
  setIsUpdatingBatch(true);
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];
  
  try {
    const aihsToUpdate = Array.from(selectedAIHsForBatch);
    
    // ⚠️ LOOP SEQUENCIAL (ineficiente)
    for (const aihId of aihsToUpdate) {
      const aih = aihs.find(a => a.id === aihId);
      if (!aih) continue;
      
      const proximaCompetencia = calcularProximaCompetencia(aih.competencia);
      if (!proximaCompetencia) continue;
      
      // Atualização individual no banco
      const { error } = await supabase
        .from('aihs')
        .update({
          competencia: proximaCompetencia,
          updated_at: new Date().toISOString()
        })
        .eq('id', aihId);
      
      if (error) {
        errorCount++;
        errors.push(`AIH ${aih.aih_number}: ${error.message}`);
      } else {
        successCount++;
        // Atualização otimista no estado
        setAIHs(prev => prev.map(a => 
          a.id === aihId 
            ? { ...a, competencia: proximaCompetencia, updated_at: new Date().toISOString() }
            : a
        ));
      }
    }
    
    // Recarregar dados após atualização
    await loadAIHs();
    await loadAllData();
  } finally {
    setIsUpdatingBatch(false);
  }
};
```

**Análise:**

#### ✅ **PONTOS POSITIVOS:**
1. **Validação** antes de atualizar
2. **Tratamento de erros** individual
3. **Feedback ao usuário** (toast)
4. **Recarregamento** após atualização

#### ⚠️ **PROBLEMAS CRÍTICOS:**

**PROBLEMA #1: Loop Sequencial**
- Atualizações feitas uma por uma (`for...of` com `await`)
- **Muito lento** para grandes volumes
- Deveria usar `Promise.all()` ou batch update

**PROBLEMA #2: Múltiplas Queries**
- Uma query SQL por AIH
- **N+1 problem** clássico
- Deveria usar batch update ou stored procedure

**PROBLEMA #3: Recarregamento Duplo**
```typescript
await loadAIHs();
await loadAllData();
```
- `loadAllData()` já chama `loadAIHs()` (linha 623)
- Recarregamento redundante

**PROBLEMA #4: Atualização Otimista Inconsistente**
- Atualiza estado local antes de confirmar no banco
- Se houver erro, estado pode ficar inconsistente

---

## 📈 8. PERFORMANCE E OTIMIZAÇÕES

### 8.1 Problemas de Performance Identificados

1. **Carregamento de Dados:**
   - ⚠️ Dados carregados sem filtro específico da aba
   - ⚠️ Filtragem no frontend (ineficiente)

2. **Atualização em Lote:**
   - ⚠️ Loop sequencial (muito lento)
   - ⚠️ Múltiplas queries SQL

3. **Renderização:**
   - ✅ Paginação no frontend (eficiente)
   - ⚠️ Cálculo repetido de próxima competência

### 8.2 Recomendações de Otimização

#### **RECOMENDAÇÃO #1: Aplicar Filtro no SQL**
```typescript
// Modificar loadAIHs() para considerar activeTab
const loadAIHs = async () => {
  const competenciaFilter = activeTab === 'mudanca-competencia'
    ? (selectedCompetenciaForBatch !== 'all' ? selectedCompetenciaForBatch : undefined)
    : (selectedCompetencia !== 'all' ? selectedCompetencia : undefined);
  
  const batch = await persistenceService.getAIHs(hospitalIdToLoad, {
    competencia: competenciaFilter
  });
};
```

#### **RECOMENDAÇÃO #2: Batch Update**
```typescript
// Usar batch update do Supabase
const updates = Array.from(selectedAIHsForBatch).map(aihId => {
  const aih = aihs.find(a => a.id === aihId);
  const proximaCompetencia = calcularProximaCompetencia(aih?.competencia);
  return {
    id: aihId,
    competencia: proximaCompetencia,
    updated_at: new Date().toISOString()
  };
});

// Executar em batch (se Supabase suportar)
await supabase.from('aihs').upsert(updates);
```

#### **RECOMENDAÇÃO #3: Memoização**
```typescript
// Memoizar cálculo de próxima competência
const proximaCompetencias = useMemo(() => {
  const map = new Map();
  filteredData.forEach(item => {
    map.set(item.id, calcularProximaCompetencia(item.competencia));
  });
  return map;
}, [filteredData]);
```

---

## 🐛 9. BUGS E PROBLEMAS IDENTIFICADOS

### 9.1 Bugs Críticos

**BUG #1: Filtro Não Funciona Corretamente**
- **Localização:** Linha 591-596 (useEffect)
- **Problema:** `selectedCompetenciaForBatch` não está nas dependências
- **Impacto:** Ao mudar filtro, dados não são recarregados
- **Severidade:** 🔴 ALTA

**BUG #2: Dados Inconsistentes Entre Abas**
- **Localização:** Linha 666-675 (loadAIHs)
- **Problema:** Filtro aplicado apenas para aba "Pacientes"
- **Impacto:** Aba "Mudança de Competência" mostra dados incorretos
- **Severidade:** 🔴 ALTA

**BUG #3: Performance Degradada**
- **Localização:** Linha 1186-1279 (handleBatchUpdateCompetencia)
- **Problema:** Loop sequencial para atualizações
- **Impacto:** Muito lento para grandes volumes
- **Severidade:** 🟡 MÉDIA

### 9.2 Problemas de Design

**PROBLEMA #1: Duplicação de Lógica**
- Filtro de competência implementado em dois lugares
- Backend (SQL) e Frontend (JavaScript)
- Dificulta manutenção

**PROBLEMA #2: Falta de Validação**
- Não valida se próxima competência é válida
- Não verifica se AIH já tem a competência desejada
- Pode causar atualizações desnecessárias

---

## 📝 10. CONCLUSÕES E RECOMENDAÇÕES

### 10.1 Resumo dos Problemas

1. **Filtro não aplicado no SQL** para aba "Mudança de Competência"
2. **Dados carregados sem filtro específico** da aba
3. **Atualização em lote ineficiente** (loop sequencial)
4. **Falta de recarregamento** ao mudar filtros
5. **Duplicação de lógica** de filtragem

### 10.2 Recomendações Prioritárias

#### **PRIORIDADE ALTA:**
1. ✅ Aplicar filtro `selectedCompetenciaForBatch` no SQL
2. ✅ Adicionar `selectedCompetenciaForBatch` nas dependências do useEffect
3. ✅ Implementar batch update para atualizações em lote

#### **PRIORIDADE MÉDIA:**
4. ✅ Memoizar cálculo de próxima competência
5. ✅ Remover recarregamento duplo
6. ✅ Adicionar validações antes de atualizar

#### **PRIORIDADE BAIXA:**
7. ✅ Unificar lógica de filtragem
8. ✅ Adicionar cache de dados
9. ✅ Melhorar feedback visual durante atualização

---

## 🔧 11. PLANO DE CORREÇÃO

### 11.1 Correções Imediatas

**CORREÇÃO #1: Aplicar Filtro no SQL**
```typescript
// Modificar loadAIHs() linha 651
const loadAIHs = async () => {
  // Determinar qual filtro usar baseado na aba ativa
  const competenciaFilter = activeTab === 'mudanca-competencia'
    ? (selectedCompetenciaForBatch !== 'all' ? selectedCompetenciaForBatch : undefined)
    : (selectedCompetencia !== 'all' ? selectedCompetencia : undefined);
  
  const batch = await persistenceService.getAIHs(hospitalIdToLoad, {
    competencia: competenciaFilter
  });
};
```

**CORREÇÃO #2: Adicionar Dependências**
```typescript
// Modificar useEffect linha 591
useEffect(() => {
  loadAIHs();
}, [currentHospitalId, selectedHospitalFilter, selectedCompetencia, activeTab, selectedCompetenciaForBatch]);
```

**CORREÇÃO #3: Batch Update**
```typescript
// Modificar handleBatchUpdateCompetencia() linha 1186
const handleBatchUpdateCompetencia = async () => {
  // Preparar updates
  const updates = Array.from(selectedAIHsForBatch)
    .map(aihId => {
      const aih = aihs.find(a => a.id === aihId);
      const proxima = calcularProximaCompetencia(aih?.competencia);
      return proxima ? { id: aihId, competencia: proxima } : null;
    })
    .filter(Boolean);
  
  // Executar em paralelo
  await Promise.all(
    updates.map(update => 
      supabase.from('aihs').update({ competencia: update.competencia }).eq('id', update.id)
    )
  );
};
```

---

**© 2025 SIGTAP Sync - Análise Técnica Detalhada**  
*Versão 1.0 - Análise Completa da Aba "Mudança de Competência"*

