# ✋ Regras de Pagamento - Dr. RENAN RODRIGUES DE LIMA GONCALVES

## 📋 Informações do Médico

| Campo | Valor |
|-------|-------|
| **Nome Completo** | RENAN RODRIGUES DE LIMA GONCALVES |
| **Hospital** | Torao Tokuda (APU - Apucarana) |
| **Especialidade** | Ortopedia - Cirurgia da Mão e Punho |
| **Identificador no Sistema** | `TORAO_TOKUDA_APUCARANA` → `RENAN RODRIGUES DE LIMA GONCALVES` |
| **Última Atualização** | 06/11/2025 |

---

## 🎯 **REGRA ESPECIAL: APENAS PROCEDIMENTO PRINCIPAL**

### ⚠️ **ATENÇÃO: REGRA DIFERENCIADA**

Este médico possui uma **regra especial** de pagamento que **NÃO soma** os valores quando múltiplos procedimentos são realizados na mesma cirurgia.

```typescript
onlyMainProcedureRule: {
  enabled: true,
  description: 'Múltiplos procedimentos: paga apenas o procedimento principal (maior valor)',
  logic: 'Quando 2+ procedimentos forem realizados juntos, aplica-se apenas o valor do procedimento de maior valor, ignorando os demais.'
}
```

### 📐 **Como Funciona:**

1. ✅ **Um procedimento isolado** → Paga o valor normal
2. ⚠️ **Múltiplos procedimentos juntos** → Paga **APENAS o de maior valor**
3. ❌ **NÃO soma** os valores dos demais procedimentos

---

## 💰 Procedimentos Cadastrados (4 procedimentos)

| # | Código | Descrição | Valor Individual |
|---|--------|-----------|------------------|
| 1 | `04.03.02.012-3` | TRATAMENTO CIRURGICO DE SINDROME COMPRESSIVA EM TUNEL OSTEO-FIBROSO AO NIVEL DO CARPO | R$ 400,00 |
| 2 | `04.08.06.044-1` | TENÓLISE | R$ 400,00 |
| 3 | `04.08.02.032-6` | TRATAMENTO CIRÚRGICO DE DEDO EM GATILHO | R$ 450,00 |
| 4 | `04.08.06.047-6` | TENOPLASTIA OU ENXERTO DE TENDÃO UNICO | R$ 400,00 |

---

## 📊 Exemplos Práticos de Cálculo

### **Cenário 1: Procedimento Isolado ✅**

```
Procedimentos Realizados:
└─ 04.08.02.032-6 (Dedo em Gatilho) - R$ 450,00

✅ Apenas 1 procedimento
💰 Valor a Pagar: R$ 450,00
```

**Resultado:** Paga o valor normal do procedimento.

---

### **Cenário 2: Dois Procedimentos de Mesmo Valor ⚠️**

```
Procedimentos Realizados:
├─ 04.03.02.012-3 (Síndrome Compressiva) - R$ 400,00
└─ 04.08.06.044-1 (Tenólise) - R$ 400,00

⚠️ Múltiplos procedimentos detectados
🔍 Aplica regra especial: APENAS O PRINCIPAL
💰 Valor a Pagar: R$ 400,00 (NÃO R$ 800,00)
```

**Resultado:** ❌ **NÃO soma** os valores. Paga apenas R$ 400,00.

---

### **Cenário 3: Dois Procedimentos de Valores Diferentes ⚠️**

```
Procedimentos Realizados:
├─ 04.08.02.032-6 (Dedo em Gatilho) - R$ 450,00
└─ 04.08.06.047-6 (Tenoplastia) - R$ 400,00

⚠️ Múltiplos procedimentos detectados
🔍 Sistema identifica procedimento de MAIOR valor
✅ Procedimento Principal: Dedo em Gatilho (R$ 450,00)
💰 Valor a Pagar: R$ 450,00 (NÃO R$ 850,00)
```

**Resultado:** Paga apenas o procedimento de **maior valor** (R$ 450,00).

---

### **Cenário 4: Três Procedimentos ⚠️**

```
Procedimentos Realizados:
├─ 04.08.02.032-6 (Dedo em Gatilho) - R$ 450,00
├─ 04.03.02.012-3 (Síndrome Compressiva) - R$ 400,00
└─ 04.08.06.047-6 (Tenoplastia) - R$ 400,00

⚠️ Múltiplos procedimentos detectados
🔍 Sistema identifica procedimento de MAIOR valor
✅ Procedimento Principal: Dedo em Gatilho (R$ 450,00)
💰 Valor a Pagar: R$ 450,00 (NÃO R$ 1.250,00)
```

**Resultado:** Mesmo com 3 procedimentos, paga apenas o de **maior valor**.

---

## 📐 Lógica de Aplicação no Sistema

### **Algoritmo de Cálculo:**

```javascript
function calcularValorRenanRodrigues(procedimentos) {
  // 1. Verificar quantidade de procedimentos
  if (procedimentos.length === 1) {
    // Se apenas 1 procedimento, paga valor normal
    return procedimentos[0].valor;
  }
  
  // 2. Se múltiplos procedimentos, aplicar regra especial
  if (procedimentos.length > 1) {
    // Encontrar o procedimento de MAIOR valor
    const procedimentoPrincipal = procedimentos.reduce((max, proc) => 
      proc.valor > max.valor ? proc : max
    );
    
    // Retornar APENAS o valor do procedimento principal
    return procedimentoPrincipal.valor;
  }
}
```

### **Passo a Passo:**

1. **Sistema detecta** que o médico é RENAN RODRIGUES DE LIMA GONCALVES
2. **Verifica** se há flag `onlyMainProcedureRule.enabled = true`
3. **Conta** quantos procedimentos foram realizados na mesma cirurgia
4. **Se 1 procedimento:** Paga valor normal
5. **Se 2+ procedimentos:** 
   - Identifica procedimento de **maior valor**
   - Paga **APENAS esse valor**
   - **Ignora** os demais procedimentos

---

## ⚖️ Comparação: Médico Normal vs. Dr. Renan

### **Médico Sem Regra Especial (Normal):**

```
Procedimento A: R$ 400,00
Procedimento B: R$ 400,00
───────────────────────────
Total: R$ 800,00 (SOMA)
```

### **Dr. Renan (Com Regra Especial):**

```
Procedimento A: R$ 400,00
Procedimento B: R$ 400,00
───────────────────────────
Total: R$ 400,00 (APENAS O PRINCIPAL)
```

**Diferença:** ❌ **NÃO soma** os valores!

---

## 💡 Justificativa da Regra

### **Por que essa regra existe?**

Esta regra especial pode ser aplicada quando:

1. **Procedimentos complementares:** Alguns procedimentos da mão são considerados complementares/auxiliares
2. **Complexidade única:** Mesmo fazendo múltiplos procedimentos, a complexidade é considerada unitária
3. **Acordo específico:** Negociação particular com o médico
4. **Evitar pagamento excessivo:** Para procedimentos menores que são parte de uma cirurgia maior

---

## 🔍 Validação da Regra

### **Situações Cobertas:**

| Situação | Comportamento | Status |
|----------|---------------|--------|
| 1 procedimento | Paga valor normal | ✅ |
| 2 procedimentos iguais | Paga apenas 1x | ✅ |
| 2 procedimentos diferentes | Paga o maior | ✅ |
| 3+ procedimentos | Paga apenas o maior | ✅ |
| Procedimentos em cirurgias diferentes | Cada um paga individual | ✅ |

---

## 📊 Tabela Comparativa de Cenários

| Procedimentos | Sem Regra Especial | Com Regra Especial | Economia |
|---------------|--------------------|--------------------|----------|
| 1x R$ 400 | R$ 400,00 | R$ 400,00 | R$ 0,00 (0%) |
| 2x R$ 400 | R$ 800,00 | R$ 400,00 | R$ 400,00 (50%) |
| 3x R$ 400 | R$ 1.200,00 | R$ 400,00 | R$ 800,00 (67%) |
| R$ 450 + R$ 400 | R$ 850,00 | R$ 450,00 | R$ 400,00 (47%) |
| R$ 450 + R$ 400 + R$ 400 | R$ 1.250,00 | R$ 450,00 | R$ 800,00 (64%) |

---

## ⚠️ Observações Importantes

### **1. Aplicação da Regra:**
- ✅ Regra se aplica **apenas** quando múltiplos procedimentos são da **mesma cirurgia/AIH**
- ✅ Procedimentos em cirurgias **separadas** pagam valores **individuais**
- ✅ Sistema identifica automaticamente quando aplicar

### **2. Identificação do Procedimento Principal:**
- 🔍 Sistema ordena por **valor** (maior para menor)
- ✅ Procedimento de **maior valor** é considerado principal
- ⚠️ Se valores iguais, considera o **primeiro** da lista

### **3. Exceções:**
- ❌ **Não há exceções** para esta regra
- ✅ Aplica-se a **TODOS** os procedimentos do médico
- ⚠️ Mesmo procedimentos futuros seguirão esta regra

---

## 📍 Localização no Código

**Arquivo:** `src/components/DoctorPaymentRules.tsx`  
**Seção:** `TORAO_TOKUDA_APUCARANA`  
**Linhas:** 1634-1674

```typescript
'TORAO_TOKUDA_APUCARANA': {
  'RENAN RODRIGUES DE LIMA GONCALVES': {
    doctorName: 'RENAN RODRIGUES DE LIMA GONCALVES',
    onlyMainProcedureRule: {
      enabled: true,
      description: 'Múltiplos procedimentos: paga apenas o procedimento principal',
      logic: 'Quando 2+ procedimentos, aplica-se apenas o maior valor'
    },
    rules: [
      // 4 procedimentos de mão e punho
    ]
  }
}
```

---

## ✅ Checklist de Implementação

- [x] Flag `onlyMainProcedureRule` **adicionada**
- [x] Lógica de aplicação **documentada**
- [x] 4 procedimentos **cadastrados**
- [x] Regra especial **ativa**
- [x] Descrição clara **incluída**
- [x] Exemplos práticos **criados**
- [x] Data de atualização **registrada** (06/11/2025)
- [x] Documentação completa **gerada**

---

## 🎯 Resumo Executivo

| Métrica | Valor |
|---------|-------|
| **Nome do Médico** | RENAN RODRIGUES DE LIMA GONCALVES |
| **Hospital** | Torao Tokuda (APU) |
| **Especialidade** | Ortopedia - Mão e Punho |
| **Total de Procedimentos** | 4 |
| **Tipo de Regra** | **APENAS PROCEDIMENTO PRINCIPAL** |
| **Valor Mínimo** | R$ 400,00 |
| **Valor Máximo** | R$ 450,00 |
| **Economia Potencial** | Até 67% em múltiplos procedimentos |

---

## 🔄 Histórico de Alterações

| Data | Tipo de Alteração | Descrição |
|------|-------------------|-----------|
| 06/11/2025 | **Regra Especial Adicionada** | Implementada regra `onlyMainProcedureRule` - múltiplos procedimentos pagam apenas o principal |
| 03/11/2025 | Cadastro Inicial | 4 procedimentos de mão e punho cadastrados |

---

## 💬 Observações Finais

Esta regra é **ÚNICA** e **ESPECIAL** para o Dr. RENAN RODRIGUES DE LIMA GONCALVES. 

**Diferencia-se completamente** das regras de outros médicos do hospital, que normalmente:
- ✅ Somam valores de múltiplos procedimentos
- ✅ Aplicam percentuais sobre valores
- ✅ Têm regras de combinações específicas

**⚠️ ATENÇÃO ESPECIAL:**
- Quando calcular pagamento deste médico, **sempre verificar** se há múltiplos procedimentos
- **Não somar** valores automaticamente
- **Aplicar apenas** o valor do procedimento principal

---

**✅ Status:** Regra Especial Configurada e Ativa  
**📅 Data de Criação:** 06/11/2025  
**🔄 Última Atualização:** 06/11/2025  
**👨‍⚕️ Médico:** Dr. RENAN RODRIGUES DE LIMA GONCALVES  
**🏥 Hospital:** Torao Tokuda (Apucarana - APU)  
**🎯 Tipo:** Regra Especial - Apenas Procedimento Principal

---

**© 2025 SIGTAP Sync - Sistema de Gestão de Faturamento Hospitalar**

