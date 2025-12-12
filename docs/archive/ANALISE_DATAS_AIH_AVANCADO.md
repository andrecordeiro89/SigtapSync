# 📅 Análise: Extração e Manipulação de Datas - AIH Avançado

## 🔍 Visão Geral

Análise completa do fluxo de extração, armazenamento e exibição de datas (admissão e alta) na tela **AIH Avançado**.

---

## 📊 Fluxo de Dados: Do PDF ao Banco

### 1️⃣ **Extração do PDF** (`src/utils/aihPdfProcessor.ts`)

#### Método `convertDate` (Linhas 731-741)
```typescript
private convertDate(dateStr: string): string {
  if (!dateStr) return '';
  
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  
  return dateStr;
}
```

**✅ Status: CORRETO**
- Extrai datas em formato brasileiro DD/MM/YYYY
- Converte para ISO 8601: YYYY-MM-DD
- NÃO usa `new Date()`, evitando problemas de timezone
- Faz parsing de string pura

#### Uso no Processamento (Linhas 644-645)
```typescript
dataInicio: this.convertDate(data.dataInicio),
dataFim: this.convertDate(data.dataFim),
```

**✅ Status: CORRETO**
- Datas extraídas do PDF são convertidas para ISO
- Formato adequado para armazenamento no banco

---

### 2️⃣ **Armazenamento no Banco** (`src/services/aihPersistenceService.ts`)

#### Salvamento (Linhas 950-951)
```typescript
admission_date: aih.dataInicio,
discharge_date: aih.dataFim || undefined,
```

**✅ Status: CORRETO**
- Datas salvas como string ISO (YYYY-MM-DD)
- Formato padrão PostgreSQL/Supabase
- `discharge_date` pode ser `null` se não houver

---

### 3️⃣ **Exibição na Tela** (`src/components/AIHMultiPageTester.tsx`)

#### Exibição Direta (Linhas 965-972)
```typescript
<div>
  <label className="text-xs font-medium text-gray-600">Data Início</label>
  <p className="text-gray-900 text-sm font-mono">{aihCompleta.dataInicio}</p>
</div>
<div>
  <label className="text-xs font-medium text-gray-600">Data Fim</label>
  <p className="text-gray-900 text-sm font-mono">{aihCompleta.dataFim}</p>
</div>
```

**⚠️ Status: PODE MELHORAR**
- **Problema**: Datas exibidas no formato ISO (2025-01-15)
- **Impacto**: Não é o formato padrão brasileiro (15/01/2025)
- **Severidade**: Baixa (visual apenas, não afeta cálculos)

---

### 4️⃣ **Cálculo de Competência** (`src/components/AIHMultiPageTester.tsx`)

#### Derivação da Competência (Linhas 141-156)
```typescript
const [competenciaMode, setCompetenciaMode] = useState<'alta' | 'manual'>(() => {
  try {
    const ref = (aihCompleta as any)?.dataFim || (aihCompleta as any)?.dataInicio;
    let altaYM = '';
    if (ref) {
      const d = new Date(ref);  // ⚠️ PROBLEMA DE TIMEZONE
      if (!isNaN(d.getTime())) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        altaYM = `${y}-${m}`;
      }
    }
    // ...
  } catch { return 'alta'; }
});
```

**❌ Status: PROBLEMA DE TIMEZONE**
- **Problema**: `new Date('2025-01-15')` pode resultar em 14/01/2025 23:00 (UTC-3)
- **Impacto**: Competência pode ser calculada com mês errado
- **Severidade**: Alta (afeta faturamento)

#### Outros Usos Similares:
- **Linha 162**: `const d = new Date(ref);`
- **Linha 1422**: `const d = ref ? new Date(ref) : null;`
- **Linha 2707**: `const d = ref ? new Date(ref) : null;`
- **Linha 2800**: `const d = ref ? new Date(ref) : null;`

---

## 🔥 Problemas Identificados

### 🚨 Problema 1: Formato de Exibição
**Local**: `AIHMultiPageTester.tsx` (linhas 967, 971)
- **Descrição**: Datas exibidas no formato ISO (YYYY-MM-DD)
- **Impacto**: Experiência do usuário (não é o padrão brasileiro)
- **Solução**: Formatar para DD/MM/YYYY na exibição

### 🚨 Problema 2: Timezone na Competência
**Local**: `AIHMultiPageTester.tsx` (múltiplas ocorrências)
- **Descrição**: Uso de `new Date(isoString)` para calcular competência
- **Impacto**: Mês pode ser calculado incorretamente (dia anterior)
- **Solução**: Usar parsing direto da string ISO sem `new Date()`

---

## ✅ Soluções Propostas

### 1. Criar Função Utilitária para Formatação
```typescript
/**
 * Formata data ISO (YYYY-MM-DD) para formato brasileiro (DD/MM/YYYY)
 * Sem usar new Date() para evitar problemas de timezone
 */
const formatDateBR = (isoDate: string | undefined | null): string => {
  if (!isoDate) return 'N/A';
  
  const match = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  
  return String(isoDate);
};
```

### 2. Criar Função para Extrair Ano-Mês Sem Timezone
```typescript
/**
 * Extrai ano e mês (YYYY-MM) de data ISO sem timezone
 */
const extractYearMonth = (isoDate: string | undefined | null): string => {
  if (!isoDate) return '';
  
  const match = String(isoDate).match(/^(\d{4})-(\d{2})-\d{2}/);
  if (match) {
    const [, year, month] = match;
    return `${year}-${month}`;
  }
  
  return '';
};
```

### 3. Aplicar Correções

#### a) Exibição de Datas
```typescript
// Antes:
<p className="text-gray-900 text-sm font-mono">{aihCompleta.dataInicio}</p>

// Depois:
<p className="text-gray-900 text-sm font-mono">{formatDateBR(aihCompleta.dataInicio)}</p>
```

#### b) Cálculo de Competência
```typescript
// Antes:
const ref = (aihCompleta as any)?.dataFim || (aihCompleta as any)?.dataInicio;
const d = new Date(ref);
const y = d.getUTCFullYear();
const m = String(d.getUTCMonth() + 1).padStart(2, '0');
const altaYM = `${y}-${m}`;

// Depois:
const ref = (aihCompleta as any)?.dataFim || (aihCompleta as any)?.dataInicio;
const altaYM = extractYearMonth(ref);
```

---

## 📈 Impacto das Correções

### ✅ Melhorias Esperadas:
1. **Exibição**: Datas no formato brasileiro (DD/MM/YYYY)
2. **Competência**: Cálculo 100% correto, sem influência de timezone
3. **Consistência**: Alinhamento com correções já feitas em Analytics

### 🔄 Componentes Afetados:
- `src/components/AIHMultiPageTester.tsx`
- Exibição de `Data Início` e `Data Fim`
- Cálculo de competência SUS
- Validações de data

---

## 🎯 Recomendações

### ✅ Manter Como Está:
- `aihPdfProcessor.ts`: Extração e conversão de datas
- `aihPersistenceService.ts`: Armazenamento no banco

### 🔧 Corrigir:
1. Adicionar funções utilitárias (`formatDateBR`, `extractYearMonth`)
2. Substituir exibição direta por `formatDateBR()`
3. Substituir `new Date()` por `extractYearMonth()` em cálculos de competência

---

## 🏁 Conclusão

O fluxo de extração e armazenamento de datas está **correto**. Os problemas estão na:
1. **Exibição** (formato não amigável)
2. **Manipulação para cálculos** (timezone pode causar off-by-one)

As correções são **simples e cirúrgicas**, seguindo o mesmo padrão aplicado em `MedicalProductionDashboard.tsx`.

---

**Data da Análise**: 10/10/2025  
**Componente**: AIH Avançado (AIHMultiPageTester)  
**Status**: Problemas identificados ✅  
**Ação Requerida**: Implementar correções ⚙️

