# 🔄 Implementação: Tela Sync - Sincronização de AIHs

## 📋 Resumo da Implementação

Foi criada a tela **Sync** para fazer a reconciliação e sincronização entre as diferentes etapas do processo de AIH no sistema, permitindo identificar discrepâncias entre os dados processados internamente e os confirmados pelo SUS para pagamento.

---

## 🎯 Objetivo

Criar um sistema de reconciliação que permita:
1. Comparar AIHs processadas no **AIH Avançado** (tabela `aihs`)
2. Verificar AIHs confirmadas pelo SUS no **SISAIH01** (tabela `aih_registros`)
3. Identificar AIHs sincronizadas, pendentes e não processadas
4. Fornecer métricas de efetividade do processo

---

## 🔄 Fluxo do Processo

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DE SINCRONIZAÇÃO                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1️⃣ AIH Avançado (Processamento Interno)                        │
│     ↓                                                           │
│     Tabela: aihs                                                │
│     Coluna: aih_number (com hífen, ex: "1234567-890123")       │
│     Status: Processado internamente                             │
│                                                                 │
│  2️⃣ Altas Hospitalares (Verificação)                           │
│     ↓                                                           │
│     [Em desenvolvimento]                                         │
│     Status: Paciente recebeu alta                               │
│                                                                 │
│  3️⃣ SISAIH01 (Confirmados SUS) ⭐ FONTE DE VERDADE              │
│     ↓                                                           │
│     Tabela: aih_registros                                       │
│     Coluna: numero_aih (sem hífen, ex: "1234567890123")        │
│     Status: Confirmado para pagamento pelo SUS                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Relacionamento entre Tabelas

### **Problema Identificado:**
- `aihs.aih_number` → Formato: **"1234567-890123"** (com hífen)
- `aih_registros.numero_aih` → Formato: **"1234567890123"** (sem hífen)

### **Solução Implementada:**
Função de normalização que remove hífens e espaços:

```typescript
const normalizeAIHNumber = (aihNumber: string): string => {
  return aihNumber.replace(/[-\s]/g, '');
};

// Exemplo:
normalizeAIHNumber("1234567-890123") // → "1234567890123"
```

### **Relacionamento Final:**
```
aihs.aih_number (normalizado)  ←→  aih_registros.numero_aih
      ↓                                      ↓
  "1234567890123"            =          "1234567890123"
```

---

## 📊 Tipos de Status de Sincronização

A tela identifica 3 tipos de status para cada AIH:

### **1. ✅ Sincronizado**
- **Condição:** AIH existe tanto em `aihs` quanto em `aih_registros`
- **Significado:** Processada internamente E confirmada pelo SUS
- **Cor:** Verde (Emerald)
- **Ação:** Nenhuma, processo completo

### **2. ⏳ Pendente Confirmação**
- **Condição:** AIH existe em `aihs` mas NÃO em `aih_registros`
- **Significado:** Processada internamente mas ainda não confirmada pelo SUS
- **Cor:** Laranja (Orange)
- **Ação:** Aguardar confirmação do SUS ou investigar

### **3. ❌ Não Processado**
- **Condição:** AIH existe em `aih_registros` mas NÃO em `aihs`
- **Significado:** Confirmada pelo SUS mas não foi processada internamente
- **Cor:** Vermelho (Red)
- **Ação:** Processar no AIH Avançado

---

## 📈 KPIs e Métricas

A tela exibe 5 KPIs principais:

### **1. 📦 Total AIH Avançado**
- **Descrição:** Total de AIHs processadas internamente
- **Fonte:** Tabela `aihs`
- **Cor:** Azul

### **2. ✅ Total SISAIH01**
- **Descrição:** Total de AIHs confirmadas pelo SUS
- **Fonte:** Tabela `aih_registros`
- **Cor:** Verde
- **Nota:** Esta é a **FONTE DE VERDADE**

### **3. 🔄 Total Sincronizados**
- **Descrição:** AIHs em ambas as bases
- **Cálculo:** Interseção entre `aihs` e `aih_registros`
- **Cor:** Emerald

### **4. ⏳ Total Pendentes**
- **Descrição:** AIHs processadas mas não confirmadas
- **Cálculo:** Em `aihs` mas não em `aih_registros`
- **Cor:** Laranja

### **5. 📊 Taxa de Sincronização**
- **Descrição:** Percentual de efetividade
- **Cálculo:** `(Total Sincronizados / Total SISAIH01) × 100`
- **Cor:** Roxo
- **Meta:** ≥ 95%

---

## 🖥️ Estrutura da Interface

### **Seção 1: Header**
```
┌────────────────────────────────────────────────────────┐
│  🔄 Sync - Sincronização de AIHs                       │
│  Reconciliação entre AIH Avançado e SISAIH01          │
│                                                        │
│                              [🔄 Atualizar Sync]      │
└────────────────────────────────────────────────────────┘
```

### **Seção 2: Fluxo Visual**
```
┌────────────────────────────────────────────────────────┐
│  ℹ️ Fluxo de Sincronização:                            │
│                                                        │
│  [1. AIH Avançado] → [2. Altas Hospitalares] →       │
│              → [3. SISAIH01 (Confirmados SUS)]        │
│                                                        │
│  Fonte de Verdade: SISAIH01 (aih_registros)          │
└────────────────────────────────────────────────────────┘
```

### **Seção 3: KPIs (5 cards)**
```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ AIH      │ SISAIH01 │ Sincro   │ Pendente │ Taxa     │
│ Avançado │          │ nizados  │ s        │ Sync     │
├──────────┼──────────┼──────────┼──────────┼──────────┤
│   150    │   140    │   130    │    20    │  92.8%   │
│ Azul     │ Verde    │ Emerald  │ Laranja  │ Roxo     │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

### **Seção 4: Filtros**
```
┌────────────────────────────────────────────────────────┐
│  Filtros:                                              │
│  [Todos (150)] [Sincronizados (130)]                  │
│  [Pendentes (20)] [Não Processados (0)]               │
└────────────────────────────────────────────────────────┘
```

### **Seção 5: Tabela de Comparações**
```
┌────────┬─────────────┬───────────┬──────────┬──────────┬────────────┬────────────┐
│ Status │ Número AIH  │ AIH Avanç │ SISAIH01 │ Paciente │ Competência│ Internação │
├────────┼─────────────┼───────────┼──────────┼──────────┼────────────┼────────────┤
│ ✅ Sync│ 1234567...  │     ✅    │    ✅    │ João...  │  10/2025   │ 01/10/2025 │
│ ⏳ Pend│ 9876543...  │     ✅    │    ❌    │    -     │     -      │     -      │
│ ❌ Não │ 5555555...  │     ❌    │    ✅    │ Maria... │  10/2025   │ 05/10/2025 │
└────────┴─────────────┴───────────┴──────────┴──────────┴────────────┴────────────┘
```

---

## 🔍 Lógica de Sincronização

### **Pseudocódigo:**

```typescript
// 1. Buscar dados
const aihsAvancado = buscarDe('aihs');
const sisaih01 = buscarDe('aih_registros');

// 2. Normalizar e criar mapas
const mapAvancado = new Map();
aihsAvancado.forEach(aih => {
  const numeroNormalizado = removerHifens(aih.aih_number);
  mapAvancado.set(numeroNormalizado, aih);
});

const mapSISAIH01 = new Map();
sisaih01.forEach(aih => {
  const numeroNormalizado = removerHifens(aih.numero_aih);
  mapSISAIH01.set(numeroNormalizado, aih);
});

// 3. Comparar
const numerosUnicos = unirConjuntos(mapAvancado.keys(), mapSISAIH01.keys());

numerosUnicos.forEach(numero => {
  const temAvancado = mapAvancado.has(numero);
  const temSISAIH01 = mapSISAIH01.has(numero);
  
  if (temAvancado && temSISAIH01) {
    status = 'sincronizado'; // ✅
  } else if (temAvancado && !temSISAIH01) {
    status = 'pendente_confirmacao'; // ⏳
  } else {
    status = 'nao_processado'; // ❌
  }
});

// 4. Calcular métricas
taxaSincronizacao = (sincronizados / totalSISAIH01) * 100;
```

---

## 📊 Query SQL Equivalente

Para referência, a lógica é equivalente a:

```sql
-- AIHs Sincronizadas (em ambas as tabelas)
SELECT 
  REPLACE(a.aih_number, '-', '') as numero_normalizado,
  'sincronizado' as status,
  a.aih_number,
  ar.numero_aih,
  ar.nome_paciente,
  ar.competencia,
  ar.data_internacao
FROM aihs a
INNER JOIN aih_registros ar 
  ON REPLACE(a.aih_number, '-', '') = ar.numero_aih
WHERE a.hospital_id = :hospital_id;

-- AIHs Pendentes Confirmação (só em aihs)
SELECT 
  REPLACE(a.aih_number, '-', '') as numero_normalizado,
  'pendente_confirmacao' as status,
  a.aih_number
FROM aihs a
LEFT JOIN aih_registros ar 
  ON REPLACE(a.aih_number, '-', '') = ar.numero_aih
WHERE ar.numero_aih IS NULL
  AND a.hospital_id = :hospital_id;

-- AIHs Não Processadas (só em aih_registros)
SELECT 
  ar.numero_aih as numero_normalizado,
  'nao_processado' as status,
  ar.numero_aih,
  ar.nome_paciente,
  ar.competencia
FROM aih_registros ar
LEFT JOIN aihs a 
  ON ar.numero_aih = REPLACE(a.aih_number, '-', '')
WHERE a.aih_number IS NULL
  AND ar.hospital_id = :hospital_id;
```

---

## 🧪 Casos de Teste

### **Teste 1: AIH Sincronizada**
```typescript
// Entrada
aihs: [{ aih_number: "1234567-890123" }]
aih_registros: [{ numero_aih: "1234567890123" }]

// Resultado Esperado
Status: sincronizado ✅
Cor: Verde (Emerald)
AIH Avançado: ✅
SISAIH01: ✅
```

### **Teste 2: AIH Pendente Confirmação**
```typescript
// Entrada
aihs: [{ aih_number: "9876543-210987" }]
aih_registros: []

// Resultado Esperado
Status: pendente_confirmacao ⏳
Cor: Laranja (Orange)
AIH Avançado: ✅
SISAIH01: ❌
```

### **Teste 3: AIH Não Processada**
```typescript
// Entrada
aihs: []
aih_registros: [{ numero_aih: "5555555555555" }]

// Resultado Esperado
Status: nao_processado ❌
Cor: Vermelho (Red)
AIH Avançado: ❌
SISAIH01: ✅
```

### **Teste 4: Normalização de Número**
```typescript
// Testes de normalização
normalizeAIHNumber("1234567-890123") === "1234567890123" ✅
normalizeAIHNumber("1234567 890123") === "1234567890123" ✅
normalizeAIHNumber("1234567890123")  === "1234567890123" ✅
normalizeAIHNumber("12-345-67")      === "1234567" ✅
```

---

## 🔐 Controle de Acesso

### **Filtros por Hospital:**
```typescript
// Usuários regulares (não admins)
if (!canAccessAllHospitals()) {
  query = query.eq('hospital_id', hospitalIdUsuario);
}

// Administradores
// Veem todos os hospitais (sem filtro)
```

### **Permissões:**
- ✅ Todos os usuários autenticados podem acessar
- ✅ Filtro automático por hospital (exceto admins)
- ✅ Logs detalhados no console para debug

---

## 📝 Logs de Console

O sistema gera logs detalhados para debug:

```javascript
🔄 Iniciando processo de sincronização...
🏥 Hospital: hospital-abc-123
✅ 150 registros encontrados em AIH Avançado
✅ 140 registros encontrados em SISAIH01
🔍 Comparando 180 números AIH únicos...
📊 RESULTADO DA SINCRONIZAÇÃO:
   ✅ Sincronizados: 130
   ⏳ Pendentes Confirmação: 20
   ❌ Não Processados: 10
   📈 Taxa de Sincronização: 92.86%
```

---

## 🎨 Código de Cores

| Status | Cor Principal | Classe CSS | Uso |
|--------|--------------|------------|-----|
| **Sincronizado** | Verde Emerald | `emerald-600` | Badge, KPI |
| **Pendente** | Laranja | `orange-600` | Badge, KPI |
| **Não Processado** | Vermelho | `red-600` | Badge, KPI |
| **AIH Avançado** | Azul | `blue-600` | KPI |
| **SISAIH01** | Verde | `green-600` | KPI |
| **Taxa Sync** | Roxo | `purple-600` | KPI |

---

## 🚀 Como Usar

### **Passo 1: Acessar a Tela**
```
1. No menu lateral, clique em "Sync"
2. O ícone é GitCompare (setas entrelaçadas)
3. A tela carrega automaticamente
```

### **Passo 2: Visualizar KPIs**
```
1. Observe os 5 cards de métricas no topo
2. Taxa de Sincronização ideal: ≥ 95%
3. Pendentes indica AIHs aguardando confirmação SUS
```

### **Passo 3: Filtrar Resultados**
```
1. Use os botões de filtro acima da tabela:
   - "Todos" → Ver todas as comparações
   - "Sincronizados" → Apenas AIHs OK
   - "Pendentes" → Apenas aguardando SUS
   - "Não Processados" → Apenas falta processar
```

### **Passo 4: Analisar Discrepâncias**
```
1. AIHs Pendentes (⏳):
   - Processadas internamente
   - Aguardando confirmação do SUS
   - Ação: Aguardar ou investigar

2. AIHs Não Processadas (❌):
   - Confirmadas pelo SUS
   - Não processadas internamente
   - Ação: Processar no AIH Avançado
```

### **Passo 5: Atualizar Dados**
```
1. Clique em "Atualizar Sync" (botão no header)
2. Aguarde o processamento
3. Verifique novos resultados
```

---

## 📁 Arquivos Criados/Modificados

| Arquivo | Status | Descrição |
|---------|--------|-----------|
| `src/components/SyncPage.tsx` | ✅ **CRIADO** | Componente principal da tela Sync |
| `src/pages/Index.tsx` | ✅ **ATUALIZADO** | Adicionada rota 'aih-sync' |
| `src/components/SidebarNavigation.tsx` | ✅ **ATUALIZADO** | Adicionado item de menu "Sync" |
| `IMPLEMENTACAO_TELA_SYNC.md` | ✅ **CRIADO** | Esta documentação |

---

## 🔄 Próximas Etapas (Roadmap)

### **Fase 2: Integração com Altas Hospitalares**
- [ ] Adicionar tabela de altas hospitalares
- [ ] Criar relacionamento entre altas e AIHs
- [ ] Verificar se pacientes com alta foram processados
- [ ] Nova métrica: "Taxa de Alta vs Processamento"

### **Fase 3: Análise Temporal**
- [ ] Gráfico de sincronização por mês
- [ ] Tempo médio entre processamento e confirmação
- [ ] Tendências de pendências

### **Fase 4: Ações Automatizadas**
- [ ] Botão "Sincronizar Pendentes"
- [ ] Alerta automático para discrepâncias
- [ ] Exportação de relatório de reconciliação

---

## 🐛 Tratamento de Erros

### **Erro ao Buscar AIHs:**
```javascript
❌ Erro ao buscar AIHs Avançado: [detalhe]
Toast: "Erro ao buscar dados de AIH Avançado"
```

### **Erro ao Buscar SISAIH01:**
```javascript
❌ Erro ao buscar SISAIH01: [detalhe]
Toast: "Erro ao buscar dados de SISAIH01"
```

### **Erro Geral:**
```javascript
❌ Erro durante sincronização: [detalhe]
Toast: "Erro ao executar sincronização"
```

---

## ✅ Status Final

| Item | Status |
|------|--------|
| ✅ Componente SyncPage criado | **COMPLETO** |
| ✅ Normalização de números AIH | **COMPLETO** |
| ✅ Comparação entre tabelas | **COMPLETO** |
| ✅ 3 tipos de status identificados | **COMPLETO** |
| ✅ 5 KPIs implementados | **COMPLETO** |
| ✅ Tabela de comparações | **COMPLETO** |
| ✅ Filtros por status | **COMPLETO** |
| ✅ Rota e menu adicionados | **COMPLETO** |
| ✅ Controle de acesso por hospital | **COMPLETO** |
| ✅ Logs detalhados | **COMPLETO** |
| ✅ Documentação completa | **COMPLETO** |
| ✅ Sem erros de linting | **VERIFICADO** |

---

## 🎉 Conclusão

A tela **Sync** foi implementada com sucesso, fornecendo uma ferramenta poderosa para reconciliação entre os dados processados internamente (AIH Avançado) e os confirmados pelo SUS (SISAIH01). 

**Destaques:**
- ✨ Interface intuitiva com visualização clara dos status
- ✨ Normalização automática de números AIH
- ✨ Métricas de efetividade em tempo real
- ✨ Filtros para análise detalhada
- ✨ Fonte de verdade bem definida (SISAIH01)

**A tela está pronta para uso e pronta para expansão com as Altas Hospitalares!** 🚀

---

**Data de Implementação:** 17 de janeiro de 2025  
**Versão:** 1.0  
**Sistema:** SigtapSync-9

