# 🔄 FEATURE: Sinalização de Pacientes com Múltiplas AIHs

## 📋 **DESCRIÇÃO**

Nova funcionalidade que identifica e sinaliza visualmente pacientes que possuem mais de uma AIH (Autorização de Internação Hospitalar) na mesma competência ou período filtrado.

**Contexto:** É perfeitamente normal um paciente ter múltiplas AIHs, pois pode ter múltiplas internações no mesmo período. Esta feature ajuda a identificar esses casos rapidamente.

---

## ✨ **FUNCIONALIDADES IMPLEMENTADAS**

### **1. Detecção Automática**

O sistema conta automaticamente quantas AIHs cada paciente possui:

```typescript
// Contador de AIHs por paciente
const patientAIHCount = new Map<string, number>();

filteredData.forEach(item => {
  if (item.patient_id) {
    const currentCount = patientAIHCount.get(item.patient_id) || 0;
    patientAIHCount.set(item.patient_id, currentCount + 1);
  }
});

// Identificar pacientes com múltiplas AIHs (mais de 1)
const multipleAIHs = new Map<string, number>();
patientAIHCount.forEach((count, patientId) => {
  if (count > 1) {
    multipleAIHs.set(patientId, count);
  }
});
```

---

### **2. Indicador no Cabeçalho**

Exibe um resumo no topo da lista:

```
ℹ️ 5 paciente(s) com múltiplas AIHs (total: 12 AIHs)
```

**Detalhes do indicador:**
- 🔵 **Cor azul** (informativo, não é erro)
- ℹ️ **Ícone de informação**
- **Quantidade de pacientes** com múltiplas AIHs
- **Total de AIHs** desses pacientes

---

### **3. Badge Individual por Paciente**

Cada linha da lista mostra um badge quando o paciente tem múltiplas AIHs:

```
┌────────────────────────────────────────────────┐
│ 👤 João Silva  [🔄 3× AIHs]                   │
│    Competência: 01/2024                       │
│    AIH: 1234567890                            │
└────────────────────────────────────────────────┘
```

**Características do badge:**
- 🔄 **Ícone de recorrência**
- 🔵 **Fundo azul claro**
- **Número de AIHs** do paciente
- **Tooltip informativo** ao passar o mouse

---

## 📊 **EXEMPLOS VISUAIS**

### **Exemplo 1: Cabeçalho Completo**

**Quando há órfãs E múltiplas AIHs:**
```
┌─────────────────────────────────────────────────────────────┐
│ 📄 AIHs Processadas (38 pacientes)                         │
│    • Competência: 01/2024                                  │
│                                                             │
│ ⚠️ 2 AIH(s) órfã(s) sem paciente associado                 │
│ ℹ️ 5 paciente(s) com múltiplas AIHs (total: 12 AIHs)      │
└─────────────────────────────────────────────────────────────┘
```

---

### **Exemplo 2: Lista de Pacientes**

```
┌────────────────────────────────────────────────┐
│ 👤 Maria Santos                                │  ← Paciente sem múltiplas AIHs
│    AIH: 1111111111                             │
│    Competência: 01/2024                        │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ 👤 João Silva  [🔄 3× AIHs] ← Badge visível   │  ← Paciente com 3 AIHs
│    AIH: 2222222222                             │
│    Competência: 01/2024                        │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ 👤 João Silva  [🔄 3× AIHs] ← Badge visível   │  ← Mesma pessoa, 2ª AIH
│    AIH: 3333333333                             │
│    Competência: 01/2024                        │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ 👤 João Silva  [🔄 3× AIHs] ← Badge visível   │  ← Mesma pessoa, 3ª AIH
│    AIH: 4444444444                             │
│    Competência: 01/2024                        │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ 👤 Ana Costa  [🔄 2× AIHs] ← Badge visível    │  ← Paciente com 2 AIHs
│    AIH: 5555555555                             │
│    Competência: 01/2024                        │
└────────────────────────────────────────────────┘
```

---

## 🎯 **CASOS DE USO**

### **Caso 1: Paciente com Reinternações**

**Cenário:**
- João é internado em 05/01/2024 (AIH: 111)
- Recebe alta em 10/01/2024
- Retorna com complicação em 15/01/2024 (AIH: 222)

**Resultado:**
```
João Silva [🔄 2× AIHs]
```
✅ Sistema identifica e sinaliza as 2 internações

---

### **Caso 2: Cirurgias Múltiplas**

**Cenário:**
- Maria faz cirurgia de catarata OD (AIH: 333)
- Após 15 dias, faz cirurgia de catarata OE (AIH: 444)

**Resultado:**
```
Maria Santos [🔄 2× AIHs]
```
✅ Fácil identificar procedimentos sequenciais

---

### **Caso 3: Tratamento Prolongado**

**Cenário:**
- Carlos tem tratamento oncológico com 4 internações

**Resultado:**
```
Carlos Oliveira [🔄 4× AIHs]
```
✅ Destaca casos de acompanhamento intensivo

---

## 🔍 **LÓGICA DE DETECÇÃO**

### **Critérios:**

1. **Agrupa por `patient_id`** (UUID único do paciente)
2. **Conta AIHs** associadas ao mesmo `patient_id`
3. **Sinaliza se count > 1** (2 ou mais AIHs)

### **Comportamento:**

| Quantidade de AIHs | Badge Exibido | Indicador Cabeçalho |
|-------------------|---------------|---------------------|
| **1 AIH** | ❌ Nenhum | ❌ Não conta |
| **2 AIHs** | ✅ `🔄 2× AIHs` | ✅ Conta |
| **3 AIHs** | ✅ `🔄 3× AIHs` | ✅ Conta |
| **N AIHs** | ✅ `🔄 N× AIHs` | ✅ Conta |

---

## 📊 **DADOS CALCULADOS**

### **No Cabeçalho:**

```typescript
// Exemplo de cálculo
const patientsWithMultipleAIHs = new Map([
  ['patient-id-1', 3],  // João: 3 AIHs
  ['patient-id-2', 2],  // Maria: 2 AIHs
  ['patient-id-3', 2]   // Ana: 2 AIHs
]);

// Resultado exibido:
// ℹ️ 3 paciente(s) com múltiplas AIHs (total: 7 AIHs)
//    ^                                      ^
//    |                                      |
//    Quantidade de pacientes                3 + 2 + 2 = 7
```

---

## 🎨 **ESTILO VISUAL**

### **Cores e Classes:**

```typescript
<Badge 
  variant="outline" 
  className="bg-blue-50 border-blue-200 text-blue-700 text-[10px] h-5 px-1.5 font-semibold"
  title="Este paciente possui 3 AIHs (internações múltiplas)"
>
  🔄 3× AIHs
</Badge>
```

**Características:**
- 🔵 **Azul claro** - cor informativa, não alarmante
- **Compacto** - altura 5 (20px) para não ocupar muito espaço
- **Tooltip** - informação adicional ao hover
- **Emoji 🔄** - símbolo visual de recorrência

---

## 🧪 **CENÁRIOS DE TESTE**

### **Teste 1: Paciente Único (Sem Badge)**

**Dados:**
- 1 paciente: João Silva
- 1 AIH: 111111111

**Resultado Esperado:**
```
Cabeçalho: (1 pacientes)
SEM indicador de múltiplas AIHs
Lista: João Silva (SEM badge)
```
✅ Não mostra badge para paciente com apenas 1 AIH

---

### **Teste 2: Paciente com 2 AIHs**

**Dados:**
- 1 paciente: Maria Santos
- 2 AIHs: 222222222, 333333333

**Resultado Esperado:**
```
Cabeçalho: (1 pacientes)
ℹ️ 1 paciente(s) com múltiplas AIHs (total: 2 AIHs)

Lista: 
Maria Santos [🔄 2× AIHs]  ← AIH 222222222
Maria Santos [🔄 2× AIHs]  ← AIH 333333333
```
✅ Badge visível em TODAS as linhas do mesmo paciente

---

### **Teste 3: Múltiplos Pacientes Recorrentes**

**Dados:**
- João: 3 AIHs
- Maria: 2 AIHs
- Ana: 1 AIH (não conta)
- Carlos: 4 AIHs

**Resultado Esperado:**
```
Cabeçalho: (4 pacientes)
ℹ️ 3 paciente(s) com múltiplas AIHs (total: 9 AIHs)

Lista:
João [🔄 3× AIHs]    ← 3 linhas
Maria [🔄 2× AIHs]   ← 2 linhas
Ana (sem badge)      ← 1 linha
Carlos [🔄 4× AIHs]  ← 4 linhas
```
✅ Identifica 3 pacientes (João, Maria, Carlos) com 9 AIHs no total

---

## 💡 **BENEFÍCIOS**

### **Para Operadores:**
- ✅ **Identificação rápida** de pacientes recorrentes
- ✅ **Evita confusão** ao ver o mesmo nome múltiplas vezes
- ✅ **Facilita auditoria** de casos complexos

### **Para Gestores:**
- ✅ **Métricas claras** de reinternações
- ✅ **Análise de qualidade** (muitas reinternações podem indicar problemas)
- ✅ **Rastreamento** de tratamentos prolongados

### **Para o Sistema:**
- ✅ **Transparência total** dos dados
- ✅ **Sem duplicação artificial** na contagem de pacientes únicos
- ✅ **Consistência** entre telas (Pacientes e Analytics)

---

## 🔗 **INTEGRAÇÃO COM OUTRAS FEATURES**

Esta feature trabalha em conjunto com:

1. **Filtro de Competência** → Conta AIHs do período filtrado
2. **Contagem de Pacientes Únicos** → Deduplica mas sinaliza múltiplas
3. **Detecção de Órfãs** → Ignora AIHs sem paciente válido

**Exemplo integrado:**
```
┌────────────────────────────────────────────────────────┐
│ 📄 AIHs Processadas (38 pacientes)                    │
│    • Competência: 01/2024                             │
│                                                        │
│ ⚠️ 2 AIH(s) órfã(s) sem paciente associado            │
│ ℹ️ 5 paciente(s) com múltiplas AIHs (total: 12 AIHs) │
└────────────────────────────────────────────────────────┘
```
✅ **Visão completa** do estado dos dados

---

## 📝 **ARQUIVOS MODIFICADOS**

1. ✅ `src/components/PatientManagement.tsx`
   - Detecção de múltiplas AIHs (linha 918-947)
   - Indicador no cabeçalho (linha 1501-1508)
   - Badge individual por paciente (linha 1567-1580)

**Status**: ✅ Sem erros de linter

---

## 🚀 **COMO USAR**

### **Visualizar Indicador:**
1. Abra a tela **Pacientes**
2. Selecione uma competência
3. Veja o indicador no cabeçalho:
   ```
   ℹ️ X paciente(s) com múltiplas AIHs
   ```

### **Identificar Paciente Recorrente:**
1. Procure por badges **[🔄 N× AIHs]** ao lado dos nomes
2. Passe o mouse sobre o badge para ver o tooltip
3. Todas as AIHs do mesmo paciente terão o badge

---

## ⚠️ **OBSERVAÇÕES IMPORTANTES**

### **1. É Normal Ter Múltiplas AIHs**
```
✅ Reinternações são comuns e esperadas
✅ Tratamentos longos podem ter múltiplas AIHs
✅ Cirurgias bilaterais podem ter 2 AIHs
```
**Este badge NÃO indica erro ou problema!**

### **2. Badge Aparece em Todas as Linhas**
```
João [🔄 3× AIHs]  ← Linha 1
João [🔄 3× AIHs]  ← Linha 2
João [🔄 3× AIHs]  ← Linha 3
```
✅ **Todas as 3 linhas** do João mostram o badge

### **3. Conta Apenas no Período Filtrado**
- Se filtrar por **Janeiro/2024**: conta AIHs de janeiro
- Se mudar para **Fevereiro/2024**: conta AIHs de fevereiro
- **AIHs de meses diferentes NÃO são somadas**

---

## 📊 **RELATÓRIOS**

O indicador de múltiplas AIHs **NÃO aparece** nos relatórios Excel, mas:

✅ **Relatório lista TODAS as AIHs** do paciente
✅ **Fácil identificar** pelo nome repetido
✅ **Contagem de pacientes únicos permanece correta**

---

## ✅ **STATUS**

| Item | Status |
|------|--------|
| **Detecção Automática** | ✅ Implementado |
| **Indicador Cabeçalho** | ✅ Implementado |
| **Badge Individual** | ✅ Implementado |
| **Tooltip Informativo** | ✅ Implementado |
| **Linter** | ✅ Sem erros |
| **Documentação** | ✅ Completa |

---

**Data de Implementação**: 2025-10-10  
**Arquivos Impactados**: 1  
**Status**: ✅ **FEATURE COMPLETA E FUNCIONAL**

