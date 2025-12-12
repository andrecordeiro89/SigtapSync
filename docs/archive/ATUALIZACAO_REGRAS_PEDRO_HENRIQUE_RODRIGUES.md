# 🩺 **ATUALIZAÇÃO DE REGRAS - DR. PEDRO HENRIQUE RODRIGUES**

## 📋 **RESUMO DA ATUALIZAÇÃO**

**Data:** 27 de Novembro de 2025  
**Tipo:** Adição de novas regras de cirurgia vascular  
**Médico:** DR. PEDRO HENRIQUE RODRIGUES  
**Hospitais Afetados:** 2 hospitais  
**Procedimentos Adicionados:** 2 novos (1 individual + 1 múltiplo)

---

## 🏥 **HOSPITAIS ATUALIZADOS**

### **1. Hospital Municipal 18 de Dezembro (Arapoti)**
- ✅ Regras individuais atualizadas
- ✅ Regras múltiplas adicionadas

### **2. Hospital Municipal São José (Carlópolis)**
- ✅ Regras individuais atualizadas
- ✅ Regras múltiplas adicionadas

---

## 📋 **REGRAS ADICIONADAS**

### **ANTES DA ATUALIZAÇÃO:**

```typescript
'PEDRO HENRIQUE RODRIGUES': {
  doctorName: 'PEDRO HENRIQUE RODRIGUES',
  rules: [
    {
      procedureCode: '04.06.02.057-4',
      standardValue: 900.00,
      description: 'TRATAMENTO CIRÚRGICO DE VARIZES (UNILATERAL) - R$ 900,00'
    },
    {
      procedureCode: '04.06.02.059-0',
      standardValue: 0,
      description: 'TROMBECTOMIA DO SISTEMA VENOSO'
    }
  ],
  multipleRules: [
    {
      codes: ['04.06.02.057-4', '04.06.02.059-0'],
      totalValue: 1100.00,
      description: 'VARIZES UNILATERAL + TROMBECTOMIA - R$ 1.100,00'
    }
  ]
}
```

### **DEPOIS DA ATUALIZAÇÃO:**

```typescript
'PEDRO HENRIQUE RODRIGUES': {
  doctorName: 'PEDRO HENRIQUE RODRIGUES',
  rules: [
    {
      procedureCode: '04.06.02.057-4',
      standardValue: 900.00,
      description: 'TRATAMENTO CIRÚRGICO DE VARIZES (UNILATERAL) - R$ 900,00'
    },
    {
      procedureCode: '04.06.02.056-6',  // 🆕 NOVO!
      standardValue: 900.00,
      description: 'TRATAMENTO CIRÚRGICO DE VARIZES (BILATERAL) - R$ 900,00'
    },
    {
      procedureCode: '04.06.02.059-0',
      standardValue: 0,
      description: 'TROMBECTOMIA DO SISTEMA VENOSO'
    }
  ],
  multipleRules: [
    {
      codes: ['04.06.02.057-4', '04.06.02.059-0'],
      totalValue: 1100.00,
      description: 'VARIZES UNILATERAL + TROMBECTOMIA - R$ 1.100,00'
    },
    {
      codes: ['04.06.02.056-6', '04.06.02.059-0'],  // 🆕 NOVO!
      totalValue: 1100.00,
      description: 'VARIZES BILATERAL + TROMBECTOMIA - R$ 1.100,00'
    }
  ]
}
```

---

## 🆕 **PROCEDIMENTOS NOVOS**

### **1. TRATAMENTO CIRÚRGICO DE VARIZES (BILATERAL)**

**Código:** 04.06.02.056-6  
**Valor Individual:** R$ 900,00  
**Descrição:** TRATAMENTO CIRÚRGICO DE VARIZES (BILATERAL)

**Quando aplicado:**
- Paciente com cirurgia de varizes bilateral isolada

---

### **2. VARIZES BILATERAL + TROMBECTOMIA (Regra Múltipla)**

**Códigos:** 04.06.02.056-6 + 04.06.02.059-0  
**Valor Total:** R$ 1.100,00  
**Descrição:** TRATAMENTO CIRÚRGICO DE VARIZES (BILATERAL) + TROMBECTOMIA DO SISTEMA VENOSO

**Quando aplicado:**
- Paciente com cirurgia de varizes bilateral + trombectomia na mesma AIH

---

## 💡 **EXEMPLOS DE CÁLCULO**

### **Exemplo 1: Varizes Bilateral (Isolada)**

```
Procedimento: 04.06.02.056-6 (VARIZES BILATERAL)
Valor: R$ 900,00
TOTAL: R$ 900,00 ✅
```

---

### **Exemplo 2: Varizes Bilateral + Trombectomia**

```
Procedimento 1: 04.06.02.056-6 (VARIZES BILATERAL)
Procedimento 2: 04.06.02.059-0 (TROMBECTOMIA)

SEM regra múltipla: R$ 900 + R$ 0 = R$ 900 ❌
COM regra múltipla: R$ 1.100,00 TOTAL ✅

A regra múltipla se aplica automaticamente.
```

---

### **Exemplo 3: Varizes Unilateral + Trombectomia (Já existia)**

```
Procedimento 1: 04.06.02.057-4 (VARIZES UNILATERAL)
Procedimento 2: 04.06.02.059-0 (TROMBECTOMIA)

COM regra múltipla: R$ 1.100,00 TOTAL ✅
```

---

## 📊 **TABELA COMPLETA DE VALORES**

| Procedimento | Código | Individual | Com Trombectomia |
|--------------|--------|------------|------------------|
| **Varizes Unilateral** | 04.06.02.057-4 | R$ 900 | R$ 1.100 |
| **Varizes Bilateral** | 04.06.02.056-6 | R$ 900 | R$ 1.100 |
| **Trombectomia** | 04.06.02.059-0 | R$ 0* | - |

**Nota:** *Trombectomia isolada = R$ 0 (sempre aplicada em combinação com varizes)

---

## 🔧 **DETALHES TÉCNICOS**

### **Regras Individuais:**
```typescript
// Varizes Bilateral (NOVO)
{
  procedureCode: '04.06.02.056-6',
  standardValue: 900.00,
  description: 'TRATAMENTO CIRÚRGICO DE VARIZES (BILATERAL) - R$ 900,00'
}
```

### **Regras Múltiplas:**
```typescript
// Varizes Bilateral + Trombectomia (NOVO)
{
  codes: ['04.06.02.056-6', '04.06.02.059-0'],
  totalValue: 1100.00,
  description: 'TRATAMENTO CIRÚRGICO DE VARIZES (BILATERAL) + TROMBECTOMIA DO SISTEMA VENOSO - R$ 1.100,00'
}
```

---

## ✅ **VALIDAÇÃO E TESTES**

### **Testes Realizados:**
- ✅ Varizes Bilateral isolada = R$ 900
- ✅ Varizes Bilateral + Trombectomia = R$ 1.100
- ✅ Varizes Unilateral (existente) = R$ 900
- ✅ Varizes Unilateral + Trombectomia (existente) = R$ 1.100
- ✅ Zero erros de linter
- ✅ Regras existentes preservadas

### **Hospitais Testados:**
- ✅ Hospital 18 de Dezembro (Arapoti)
- ✅ Hospital Municipal São José (Carlópolis)

---

## 🔄 **COMPATIBILIDADE**

### **Regras Existentes Preservadas:**
✅ Varizes Unilateral (04.06.02.057-4) → R$ 900  
✅ Trombectomia (04.06.02.059-0) → R$ 0  
✅ Unilateral + Trombectomia → R$ 1.100  

### **Novas Regras Adicionadas:**
✅ Varizes Bilateral (04.06.02.056-6) → R$ 900  
✅ Bilateral + Trombectomia → R$ 1.100  

---

## 📈 **IMPACTO FINANCEIRO**

### **Cenário 1: Paciente com Varizes Bilateral Isolada**

**ANTES:**
```
Sem regra específica → R$ 0 ou valor padrão
```

**DEPOIS:**
```
Com regra específica → R$ 900,00 ✅
```

---

### **Cenário 2: Paciente com Varizes Bilateral + Trombectomia**

**ANTES:**
```
Sem regra múltipla → R$ 900 (varizes) + R$ 0 (trombectomia) = R$ 900
```

**DEPOIS:**
```
Com regra múltipla → R$ 1.100,00 (valor total combinado) ✅
Incremento: R$ 200,00
```

---

## 🎯 **LÓGICA DE APLICAÇÃO**

### **Prioridade das Regras:**

1. **Regra Múltipla** (prioridade máxima)
   - Se os 2 procedimentos estão presentes → aplica valor total

2. **Regra Individual**
   - Se apenas 1 procedimento está presente → aplica valor individual

### **Exemplo Prático:**

```
AIH com 2 procedimentos:
1. VARIZES BILATERAL (04.06.02.056-6)
2. TROMBECTOMIA (04.06.02.059-0)

Sistema identifica:
✅ Ambos os códigos presentes
✅ Existe regra múltipla ['04.06.02.056-6', '04.06.02.059-0']
✅ Aplica R$ 1.100,00 TOTAL (não R$ 900 + R$ 0)
```

---

## ✅ **STATUS FINAL**

```
✅ 2 hospitais atualizados
✅ 1 procedimento individual adicionado
✅ 1 regra múltipla adicionada
✅ Regras existentes preservadas
✅ Zero erros de linter
✅ Compatibilidade total
✅ Sistema pronto para uso
```

---

## 📝 **OBSERVAÇÕES IMPORTANTES**

1. **Varizes Bilateral vs Unilateral:** Ambos têm o mesmo valor individual (R$ 900), mas são procedimentos diferentes.

2. **Trombectomia:** Sempre tem valor R$ 0 quando isolada, pois só é calculada em combinação com varizes.

3. **Regras Múltiplas:** Têm prioridade sobre regras individuais quando ambos os procedimentos estão presentes.

4. **Mesmas Regras:** Os 2 hospitais têm regras idênticas para consistência.

---

**📌 ATUALIZAÇÃO COMPLETA E VALIDADA**  
**🩺 DR. PEDRO HENRIQUE RODRIGUES COM VARIZES BILATERAL ADICIONADA**  
**✅ PRONTO PARA PRODUÇÃO**

---

**Data:** 27 de Novembro de 2025  
**Autor:** Sistema Automatizado SigtapSync  
**Versão:** 1.0 - Atualização de Regras de Cirurgia Vascular

