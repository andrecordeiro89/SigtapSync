# 🔧 CORREÇÃO: Porcentagem de Procedimentos Diagnósticos

## 📋 **PROBLEMA IDENTIFICADO**

O procedimento **02.05.02.018-6 ULTRASSONOGRAFIA TRANSVAGINAL** estava incorretamente recebendo **70%** de porcentagem quando deveria ser calculado com **100%** (valor normal).

### **Causa Raiz**
A lógica anterior aplicava **70% para TODOS os procedimentos em posição secundária**, independentemente do tipo de procedimento. Isso estava incorreto porque:

1. ❌ Procedimentos **diagnósticos** (exames, imagens) não são cirurgias múltiplas
2. ❌ A regra de 70% só deveria aplicar para **cirurgias realizadas no mesmo ato cirúrgico**
3. ❌ Ultrassonografias, consultas e exames devem sempre ser **100%**

---

## ✅ **SOLUÇÃO IMPLEMENTADA**

### **1. Identificação Automática de Procedimentos Diagnósticos**

Criada nova função `isDiagnosticProcedure()` que identifica automaticamente:

```typescript
// ✅ Procedimentos diagnósticos (códigos 02.xx)
// ✅ Consultas e atendimentos (códigos 03.01.xx)
export function isDiagnosticProcedure(procedureCode: string): boolean {
  const cleanCode = procedureCode.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || procedureCode;
  
  return cleanCode.startsWith('02.') ||   // Procedimentos diagnósticos
         cleanCode.startsWith('03.01.');  // Consultas e atendimentos
}
```

### **2. Identificação de Procedimentos Cirúrgicos**

Criada nova função `isSurgicalProcedure()` para diferenciar cirurgias:

```typescript
// ✅ Procedimentos cirúrgicos (códigos 04.xx)
export function isSurgicalProcedure(procedureCode: string): boolean {
  const cleanCode = procedureCode.match(/^([\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d])/)?.[1] || procedureCode;
  
  return cleanCode.startsWith('04'); // Procedimentos cirúrgicos
}
```

### **3. Lógica Corrigida de Cálculo**

```typescript
// ANTES (INCORRETO):
const defaultHospPercentage = proc.sequenceOrder === 1 ? 100 : 70;
// ❌ Aplicava 70% para TODOS os procedimentos secundários

// DEPOIS (CORRETO):
let defaultHospPercentage: number;

if (isSurgicalProcedure(proc.procedureCode)) {
  // Cirurgias múltiplas: aplicar redução de porcentagem por posição
  defaultHospPercentage = proc.sequenceOrder === 1 ? 100 : 70;
} else {
  // Procedimentos diagnósticos, exames, consultas: sempre 100%
  defaultHospPercentage = 100;
}
```

### **4. Atualização da Lista de Códigos Explícitos**

Adicionado o código específico à lista de procedimentos sempre 100%:

```typescript
const ALWAYS_FULL_PERCENT_CODES: string[] = [
  '02.05.02.015-1',
  '02.05.02.018-6'  // 🆕 ULTRASSONOGRAFIA TRANSVAGINAL - sempre 100%
];
```

### **5. Atualização da Função `isAlwaysFullPercentProcedure()`**

```typescript
export function isAlwaysFullPercentProcedure(codeOrFull: string): boolean {
  const code = codeOrFull.match(/^[\d]{2}\.[\d]{2}\.[\d]{2}\.[\d]{3}-[\d]/)?.[0] || codeOrFull;
  
  // 1. Verificar lista explícita
  if (ALWAYS_FULL_PERCENT_CODES.includes(code)) return true;
  
  // 2. Procedimentos diagnósticos SEMPRE são 100%
  if (isDiagnosticProcedure(code)) return true;
  
  return false;
}
```

---

## 🎯 **NOVA LÓGICA DE PORCENTAGENS**

### **SEMPRE 100%:**
1. ✅ **Instrumento 04 - AIH (Proc. Especial)** - Prioridade máxima
2. ✅ **Procedimentos diagnósticos (02.xx)** - Exames, imagens, diagnósticos
3. ✅ **Consultas e atendimentos (03.01.xx)** - Consultas médicas
4. ✅ **Lista explícita** - Códigos específicos (02.05.02.015-1, 02.05.02.018-6)

### **CIRURGIAS MÚLTIPLAS (códigos 04.xx):**
- 1º procedimento: **100%**
- 2º procedimento: **70%**
- Demais: **70%**

*(Exceto se houver regra especial específica como politraumatizado, ortopedia, etc.)*

---

## 📊 **EXEMPLOS PRÁTICOS**

### **Exemplo 1: Ultrassonografia (CORRETO AGORA)**
```
Procedimentos:
1. 04.08.01.001-0 - CIRURGIA DE MÃO          (1º) → 100% ✅
2. 02.05.02.018-6 - ULTRASSONOGRAFIA         (2º) → 100% ✅ (diagnóstico)
3. 04.08.01.002-8 - TENÓLISE                 (3º) → 70% ✅ (cirurgia secundária)
```

### **Exemplo 2: Múltiplas Cirurgias**
```
Procedimentos:
1. 04.08.01.001-0 - CIRURGIA DE MÃO          (1º) → 100% ✅
2. 04.08.01.005-2 - LIBERAÇÃO DE ADERÊNCIAS  (2º) → 70% ✅ (cirurgia secundária)
3. 04.08.06.021-2 - RESSECÇÃO DE CISTO       (3º) → 70% ✅ (cirurgia secundária)
```

### **Exemplo 3: Consulta + Exames**
```
Procedimentos:
1. 03.01.01.007-2 - CONSULTA MÉDICA          (1º) → 100% ✅ (consulta)
2. 02.05.02.018-6 - ULTRASSONOGRAFIA         (2º) → 100% ✅ (diagnóstico)
3. 02.02.03.005-0 - HEMOGRAMA                (3º) → 100% ✅ (diagnóstico)
```

---

## 🧪 **VALIDAÇÃO**

### **Códigos que SEMPRE devem ser 100%:**
- ✅ `02.05.02.018-6` - ULTRASSONOGRAFIA TRANSVAGINAL
- ✅ `02.05.02.015-1` - ULTRASSONOGRAFIA OBSTÉTRICA
- ✅ `02.01.01.xxx` - Qualquer exame de anatomia patológica
- ✅ `02.02.xx.xxx` - Qualquer exame laboratorial
- ✅ `02.05.xx.xxx` - Qualquer procedimento de imagem
- ✅ `03.01.xx.xxx` - Qualquer consulta médica

### **Códigos com redução de porcentagem (somente se secundários):**
- ⚠️ `04.xx.xx.xxx` - Procedimentos cirúrgicos múltiplos

---

## 📝 **ARQUIVOS MODIFICADOS**

1. **src/config/susCalculationRules.ts** - Lógica principal de cálculo

### **Funções Adicionadas:**
- `isSurgicalProcedure()` - Identifica cirurgias (04.xx)
- `isDiagnosticProcedure()` - Identifica diagnósticos (02.xx, 03.01.xx)

### **Funções Modificadas:**
- `isAlwaysFullPercentProcedure()` - Agora verifica categorias automaticamente
- `applySpecialCalculation()` - Lógica corrigida para diferenciar cirurgias de diagnósticos
- `logSpecialRules()` - Documentação atualizada

---

## ✅ **STATUS**

**CORREÇÃO IMPLEMENTADA E TESTADA**

- ✅ Procedimento `02.05.02.018-6` agora recebe 100%
- ✅ TODOS os procedimentos diagnósticos (02.xx) sempre 100%
- ✅ TODAS as consultas (03.01.xx) sempre 100%
- ✅ Cirurgias múltiplas mantêm regra de 70% para secundários
- ✅ Regras especiais (politraumatizado, etc.) mantidas
- ✅ Instrumento 04 mantém prioridade máxima (100%)

---

## 📚 **REFERÊNCIAS SUS**

**Tabela SIGTAP - Grupos de Procedimentos:**
- **02.xx** - Procedimentos Diagnósticos e Terapêuticos
  - 02.01 - Coleta de material
  - 02.02 - Diagnóstico em laboratório clínico
  - 02.05 - Diagnóstico por imagem
  - etc.
- **03.01** - Consultas/Atendimentos
- **04.xx** - Procedimentos Cirúrgicos

**Regra SUS para Cirurgias Múltiplas:**
- Primeira cirurgia: 100% do valor da tabela
- Cirurgias adicionais no mesmo ato: Percentual reduzido (70%, 50%, etc.)
- **NÃO se aplica** a procedimentos diagnósticos ou consultas

---

**Data da correção:** 13/10/2025  
**Versão:** 1.0  
**Status:** ✅ Implementado e validado

