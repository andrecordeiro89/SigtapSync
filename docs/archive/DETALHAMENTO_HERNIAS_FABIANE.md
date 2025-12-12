# 🎯 Detalhamento Individual de Hérnias - Dra. FABIANE GREGORIO BATISTELA

## 📋 Nova Funcionalidade Implementada

**Data:** 27/10/2025  
**Objetivo:** Exibir valores individuais de cada hérnia no card de regras

---

## 🆕 O que mudou?

### **Antes:**
```
INGUINAL UNILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00
├─ Procedimento 1: R$ 1.000,00
└─ Procedimento 2: R$ 0,00
```

### **Agora:**
```
INGUINAL UNILATERAL (1ª) + EPIGÁSTRICA (2ª) - R$ 1.000,00
├─ INGUINAL UNILATERAL (1ª) - R$ 700,00
└─ EPIGÁSTRICA (2ª) - R$ 300,00
TOTAL: R$ 1.000,00
```

---

## 🎯 Como Funciona?

### **1. Ordem de Procedimentos**

**✅ A primeira hérnia é sempre o procedimento principal (contornado em verde)**

O sistema **respeita a ordem** em que os procedimentos aparecem no banco de dados:
- **1º procedimento listado** = 1ª Hérnia → Mantém valor original
- **2º procedimento listado** = 2ª Hérnia → R$ 300,00
- **3º procedimento listado** = 3ª Hérnia → R$ 300,00
- **4º procedimento listado** = 4ª Hérnia → R$ 300,00

### **2. Detalhamento Individual**

Cada hérnia agora mostra:
- **Nome da hérnia** (INGUINAL, EPIGÁSTRICA, etc.)
- **Posição** (1ª, 2ª, 3ª, 4ª)
- **Valor individual** aplicado

---

## 📊 Exemplos Visuais

### **Exemplo 1: EPIGÁSTRICA + INGUINAL (ordem do exemplo)**

```yaml
Procedimento Principal (Verde): EPIGÁSTRICA
Procedimento Secundário: INGUINAL UNILATERAL

Detalhamento no Card de Regras:
┌─────────────────────────────────────────────┐
│ Regras de Pagamento Específicas            │
├─────────────────────────────────────────────┤
│ EPIGÁSTRICA (1ª) - R$ 800,00              │
│ INGUINAL UNILATERAL (2ª) - R$ 300,00      │
├─────────────────────────────────────────────┤
│ TOTAL REPASSE: R$ 1.100,00                │
└─────────────────────────────────────────────┘
```

### **Exemplo 2: INGUINAL + EPIGÁSTRICA (ordem invertida)**

```yaml
Procedimento Principal (Verde): INGUINAL UNILATERAL
Procedimento Secundário: EPIGÁSTRICA

Detalhamento no Card de Regras:
┌─────────────────────────────────────────────┐
│ Regras de Pagamento Específicas            │
├─────────────────────────────────────────────┤
│ INGUINAL UNILATERAL (1ª) - R$ 700,00      │
│ EPIGÁSTRICA (2ª) - R$ 300,00              │
├─────────────────────────────────────────────┤
│ TOTAL REPASSE: R$ 1.000,00                │
└─────────────────────────────────────────────┘
```

**Diferença:** R$ 100,00 a mais quando EPIGÁSTRICA é a 1ª ✅

---

## 🖥️ Onde Ver no Sistema?

### **Localização:**
**Analytics → Profissionais → Card da Dra. Fabiane → Paciente com múltiplas hérnias**

### **Interface:**

```
╔════════════════════════════════════════════════╗
║ 👤 PACIENTE: João Silva                       ║
║ ──────────────────────────────────────────── ║
║                                                ║
║ 📋 Regras de Pagamento Específicas            ║
║ ─────────────────────────────────────────────║
║                                                ║
║ Procedimento Principal (Regra Especial)       ║
║ • EPIGÁSTRICA (1ª) - R$ 800,00                ║
║                                                ║
║ Procedimentos Adicionais                      ║
║ • INGUINAL UNILATERAL (2ª) - R$ 300,00        ║
║                                                ║
║ ┌──────────────────────────────────────────┐  ║
║ │ 🩺 REPASSE MÉDICO    R$ 1.100,00        │  ║
║ └──────────────────────────────────────────┘  ║
╚════════════════════════════════════════════════╝
```

---

## 💡 Lógica de Cálculo Detalhada

### **Passo 1: Identificar Procedimentos**
```typescript
Procedimentos do Paciente:
1. 04.07.04.006-4 (EPIGÁSTRICA) ← Procedimento Principal
2. 04.07.04.010-2 (INGUINAL UNILATERAL)
```

### **Passo 2: Verificar Regra de Múltiplas Hérnias**
```typescript
Sistema encontra regra:
"EPIGÁSTRICA (1ª) + INGUINAL UNILATERAL (2ª) - R$ 1.100,00"
```

### **Passo 3: Calcular Valores Individuais**
```typescript
1ª Hérnia (EPIGÁSTRICA):
  - Posição: 1ª
  - Valor Original: R$ 800,00
  - Valor Aplicado: R$ 800,00 ✅

2ª Hérnia (INGUINAL):
  - Posição: 2ª
  - Valor Original: R$ 700,00
  - Valor Aplicado: R$ 300,00 ✅ (regra de 2ª hérnia)

Total: R$ 800 + R$ 300 = R$ 1.100,00
```

### **Passo 4: Exibir no Card**
```typescript
Card de Regras mostra:
✓ EPIGÁSTRICA (1ª) - R$ 800,00
✓ INGUINAL UNILATERAL (2ª) - R$ 300,00
───────────────────────────────
TOTAL: R$ 1.100,00
```

---

## 🔄 Tabela de Valores por Posição

| Tipo de Hérnia | Valor Individual | Como 1ª | Como 2ª+ |
|----------------|------------------|---------|----------|
| **INGUINAL UNILATERAL** | R$ 700,00 | R$ 700,00 | R$ 300,00 |
| **INGUINAL BILATERAL** | R$ 700,00 | R$ 700,00 | R$ 300,00 |
| **EPIGÁSTRICA** | R$ 800,00 | R$ 800,00 | R$ 300,00 |
| **UMBILICAL** | R$ 450,00 | R$ 450,00 | R$ 300,00 |
| **INCISIONAL/VENTRAL** | R$ 600,00 | R$ 600,00 | R$ 300,00 |

---

## 🧪 Casos de Teste

### **Teste 1: 2 Hérnias**
```
Input:
1. EPIGÁSTRICA (principal)
2. INGUINAL UNILATERAL

Output no Card:
• EPIGÁSTRICA (1ª) - R$ 800,00
• INGUINAL UNILATERAL (2ª) - R$ 300,00
Total: R$ 1.100,00 ✅
```

### **Teste 2: 3 Hérnias**
```
Input:
1. EPIGÁSTRICA (principal)
2. INGUINAL UNILATERAL
3. UMBILICAL

Output no Card:
• EPIGÁSTRICA (1ª) - R$ 800,00
• INGUINAL UNILATERAL (2ª) - R$ 300,00
• UMBILICAL (3ª) - R$ 300,00
Total: R$ 1.400,00 ✅
```

### **Teste 3: 4 Hérnias**
```
Input:
1. EPIGÁSTRICA (principal)
2. INGUINAL UNILATERAL
3. UMBILICAL
4. INCISIONAL

Output no Card:
• EPIGÁSTRICA (1ª) - R$ 800,00
• INGUINAL UNILATERAL (2ª) - R$ 300,00
• UMBILICAL (3ª) - R$ 300,00
• INCISIONAL (4ª) - R$ 300,00
Total: R$ 1.700,00 ✅
```

---

## ⚙️ Implementação Técnica

### **Arquivo Modificado:**
`src/components/DoctorPaymentRules.tsx`

### **Função:**
`calculateDoctorPayment()`

### **Linhas:**
2694-2741

### **Lógica Implementada:**

```typescript
// Detectar se é regra de hérnias da Dra. Fabiane
if (isHerniaRule && doctorName.includes('FABIANE')) {
  
  // Mapear valores originais e nomes
  const herniaValues = { ... };
  const herniaNames = { ... };
  
  // Calcular valores individuais
  const calculatedProcedures = filteredProcedures.map((proc, index) => {
    const isFirstHernia = index === 0;
    const individualValue = isFirstHernia 
      ? herniaValues[proc.procedure_code]  // Valor original
      : 300.00;                             // R$ 300 fixo
    
    return {
      ...proc,
      calculatedPayment: individualValue,
      paymentRule: `${herniaName} (${position}) - R$ ${individualValue}`,
      isSpecialRule: true
    };
  });
  
  return { procedures: calculatedProcedures, totalPayment, appliedRule };
}
```

---

## ✅ Benefícios

1. **📊 Transparência Total**
   - Vê exatamente quanto vale cada hérnia
   - Entende o cálculo completo

2. **🎯 Clareza Visual**
   - Não precisa adivinhar valores
   - Tudo explicado no card

3. **✅ Conformidade**
   - Respeita ordem do procedimento principal
   - Aplica regra corretamente

4. **🔍 Auditoria Fácil**
   - Fácil verificar se valores estão corretos
   - Rastreabilidade completa

---

## 🚨 Importante

### **Ordem dos Procedimentos**
A ordem **importa**! O procedimento listado **primeiro** no banco de dados (marcado como principal/verde) é sempre a 1ª hérnia e mantém seu valor original.

### **Procedimento Principal**
- ✅ É definido pelo sistema ao cadastrar a AIH
- ✅ Aparece contornado em **verde** na interface
- ✅ Sempre é considerado como **1ª hérnia**
- ✅ Mantém seu **valor original**

### **Procedimentos Secundários**
- Todos os demais procedimentos de hérnias
- Recebem valor fixo de **R$ 300,00**
- Independente do tipo de hérnia

---

## 📌 Resumo

| Item | Descrição |
|------|-----------|
| **Funcionalidade** | Detalhamento individual de hérnias |
| **Médica** | FABIANE GREGORIO BATISTELA |
| **Hospital** | Torao Tokuda (APU) |
| **Implementado** | 27/10/2025 |
| **Status** | ✅ Ativo e Funcionando |
| **Validações** | ✅ Sem erros de linter |

---

**Resultado:** Agora é possível ver **exatamente** quanto cada hérnia vale no card de regras! 🎉

