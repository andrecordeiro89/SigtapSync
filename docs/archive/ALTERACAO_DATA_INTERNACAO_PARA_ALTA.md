# 📅 ALTERAÇÃO: DATA DE INTERNAÇÃO → DATA DE ALTA

## 📋 **RESUMO**

**Data:** 2025-01-20  
**Arquivo:** `src/components/SyncPage.tsx`  
**Status:** ✅ **IMPLEMENTADO E TESTADO**

---

## 🎯 **MUDANÇA SOLICITADA**

Alterar a coluna "Data Intern." para "Data de Alta" em **todos os PDFs e tabelas** da tela Sync, referenciando pela data de alta em vez da data de internação.

---

## ✅ **ALTERAÇÕES REALIZADAS**

### **1. PDFs**

#### **PDF de AIHs Sincronizadas:**
- ❌ ANTES: `head: [['#', 'Número AIH', 'Paciente', 'Data Int.', 'Qtd', 'Procedimento', 'Valor']]`
- ✅ DEPOIS: `head: [['#', 'Número AIH', 'Paciente', 'Data de Alta', 'Qtd', 'Procedimento', 'Valor']]`

#### **PDF de Reapresentação:**
- ❌ ANTES: `head: [['#', 'Número AIH', 'Paciente', 'Data Intern.', 'Procedimento', 'Valor']]`
- ✅ DEPOIS: `head: [['#', 'Número AIH', 'Paciente', 'Data de Alta', 'Procedimento', 'Valor']]`

---

### **2. Interface Web (3 Tabelas)**

#### **Tabela de AIHs Sincronizadas:**
- ❌ ANTES: `<TableHead>Data Intern.</TableHead>`
- ✅ DEPOIS: `<TableHead>Data de Alta</TableHead>`

#### **Tabela de AIHs Pendentes:**
- ❌ ANTES: `<TableHead>Data Intern.</TableHead>`
- ✅ DEPOIS: `<TableHead>Data de Alta</TableHead>`

#### **Tabela de AIHs Não Processadas:**
- ❌ ANTES: `<TableHead>Data Intern.</TableHead>`
- ✅ DEPOIS: `<TableHead>Data de Alta</TableHead>`

---

### **3. Dados Utilizados**

#### **ANTES (Data de Internação):**
```typescript
// AIH Avançado
admission_date

// SISAIH01
data_internacao
```

#### **DEPOIS (Data de Alta):**
```typescript
// AIH Avançado
discharge_date

// SISAIH01
data_saida
```

---

## 📊 **QUERIES SQL ATUALIZADAS**

### **Busca de AIHs (AIH Avançado):**

**ANTES:**
```typescript
.select('aih_number, patient_id, admission_date, competencia, ...')
```

**DEPOIS:**
```typescript
.select('aih_number, patient_id, admission_date, discharge_date, competencia, ...')
```

---

### **Busca de SISAIH01:**

**ANTES:**
```typescript
.select('numero_aih, nome_paciente, data_internacao, competencia, ...')
```

**DEPOIS:**
```typescript
.select('numero_aih, nome_paciente, data_internacao, data_saida, competencia, ...')
```

---

## 🔧 **MUDANÇAS NO CÓDIGO**

### **1. PDF de Sincronizadas**

**ANTES:**
```typescript
const dataInternacao = d.sisaih01?.data_internacao
  ? new Date(d.sisaih01.data_internacao).toLocaleDateString('pt-BR')
  : (d.aih_avancado?.admission_date 
      ? new Date(d.aih_avancado.admission_date).toLocaleDateString('pt-BR')
      : '-');
```

**DEPOIS:**
```typescript
const dataAlta = d.sisaih01?.data_saida
  ? new Date(d.sisaih01.data_saida).toLocaleDateString('pt-BR')
  : (d.aih_avancado?.discharge_date 
      ? new Date(d.aih_avancado.discharge_date).toLocaleDateString('pt-BR')
      : '-');
```

---

### **2. PDF de Reapresentação**

**ANTES:**
```typescript
const dataInternacao = d.aih_avancado?.admission_date
  ? new Date(d.aih_avancado.admission_date).toLocaleDateString('pt-BR')
  : '-';
```

**DEPOIS:**
```typescript
const dataAlta = d.aih_avancado?.discharge_date
  ? new Date(d.aih_avancado.discharge_date).toLocaleDateString('pt-BR')
  : '-';
```

---

### **3. Tabelas da Interface**

**ANTES:**
```typescript
{detalhe.sisaih01?.data_internacao 
  ? new Date(detalhe.sisaih01.data_internacao).toLocaleDateString('pt-BR')
  : '-'}
```

**DEPOIS:**
```typescript
{detalhe.sisaih01?.data_saida 
  ? new Date(detalhe.sisaih01.data_saida).toLocaleDateString('pt-BR')
  : (detalhe.aih_avancado?.discharge_date 
      ? new Date(detalhe.aih_avancado.discharge_date).toLocaleDateString('pt-BR')
      : '-')}
```

---

## 📐 **LÓGICA DE PRIORIZAÇÃO**

### **AIHs Sincronizadas:**
```
1º → data_saida (SISAIH01)
2º → discharge_date (AIH Avançado)  
3º → '-' (não disponível)
```

### **AIHs Pendentes:**
```
1º → discharge_date (AIH Avançado)
2º → '-' (não disponível)
```

### **AIHs Não Processadas:**
```
1º → data_saida (SISAIH01)
2º → discharge_date (AIH Avançado) [fallback]
3º → '-' (não disponível)
```

---

## 🗂️ **ESTRUTURA DOS DADOS**

### **Tabela `aihs` (AIH Avançado):**
```sql
admission_date TIMESTAMP WITH TIME ZONE NOT NULL,
discharge_date TIMESTAMP WITH TIME ZONE,        ← Usado agora!
estimated_discharge_date TIMESTAMP WITH TIME ZONE,
```

### **Tabela `aih_registros` (SISAIH01):**
```sql
data_emissao DATE,
data_internacao DATE NOT NULL,
data_saida DATE,                                 ← Usado agora!
```

---

## ✅ **CHECKLIST DE IMPLEMENTAÇÃO**

### **PDFs:**
- [x] PDF Sincronizadas: cabeçalho alterado
- [x] PDF Sincronizadas: dados alterados (discharge_date/data_saida)
- [x] PDF Reapresentação: cabeçalho alterado
- [x] PDF Reapresentação: dados alterados (discharge_date)
- [x] Queries SQL: campos adicionados

### **Interface Web:**
- [x] Tabela Sincronizadas: cabeçalho alterado
- [x] Tabela Sincronizadas: dados alterados
- [x] Tabela Pendentes: cabeçalho alterado
- [x] Tabela Pendentes: dados alterados
- [x] Tabela Não Processadas: cabeçalho alterado
- [x] Tabela Não Processadas: dados alterados

### **Qualidade:**
- [x] Linting OK (sem erros)
- [x] Fallbacks implementados (quando data_saida/discharge_date não existir)
- [x] Priorização correta (SISAIH01 > AIH Avançado > vazio)

**Status:** ✅ **100% CONCLUÍDO**

---

## 📊 **RESULTADO VISUAL**

### **PDFs:**

**ANTES:**
```
╔═══╦════════╦══════════╦═══════════╦═══╦═════════╦══════╗
║ # ║ Nº AIH ║ Paciente ║ Data Int. ║Qtd║Procedim.║ Vlr  ║
╠═══╬════════╬══════════╬═══════════╬═══╬═════════╬══════╣
║ 1 ║ 41251..║ João S.  ║ 01/10/25  ║ 4 ║03.01.06.║R$ 1K ║
```

**DEPOIS:**
```
╔═══╦════════╦══════════╦══════════════╦═══╦═════════╦══════╗
║ # ║ Nº AIH ║ Paciente ║ Data de Alta ║Qtd║Procedim.║ Vlr  ║
╠═══╬════════╬══════════╬══════════════╬═══╬═════════╬══════╣
║ 1 ║ 41251..║ João S.  ║ 05/10/25     ║ 4 ║03.01.06.║R$ 1K ║
```

---

### **Interface Web:**

**ANTES:**
```
┌───┬────────┬──────────┬────────────┬────┬──────────┬──────┐
│ # │ Nº AIH │ Paciente │ Data Int.  │ Qtd│ Proced.  │ Valor│
├───┼────────┼──────────┼────────────┼────┼──────────┼──────┤
│ 1 │ 41251..│ João S.  │ 01/10/2025 │  4 │03.01.06..│ R$ 1K│
```

**DEPOIS:**
```
┌───┬────────┬──────────┬──────────────┬────┬──────────┬──────┐
│ # │ Nº AIH │ Paciente │ Data de Alta │ Qtd│ Proced.  │ Valor│
├───┼────────┼──────────┼──────────────┼────┼──────────┼──────┤
│ 1 │ 41251..│ João S.  │ 05/10/2025   │  4 │03.01.06..│ R$ 1K│
```

---

## 💡 **OBSERVAÇÕES IMPORTANTES**

### **1. Campo `discharge_date` pode ser NULL:**
- Quando a AIH ainda está em andamento
- Implementado fallback para mostrar `-` nesses casos

### **2. Priorização SISAIH01 > AIH Avançado:**
- Para sincronizadas: prioriza `data_saida` do SISAIH01 (dado confirmado)
- Se não houver, usa `discharge_date` do AIH Avançado
- Garante que sempre mostre o dado mais confiável

### **3. Compatibilidade:**
- ✅ Mantém `admission_date` e `data_internacao` nas queries (usados em outros lugares)
- ✅ Adiciona novos campos sem quebrar funcionalidades existentes

---

## 📞 **REFERÊNCIA**

**Arquivo Modificado:**
- `src/components/SyncPage.tsx`
  - Função `gerarRelatorioPDFSincronizadas` (linhas 344-381)
  - Função `gerarRelatorioPDFReapresentacao` (linhas 619-651)
  - Função `buscarAIHs` (linha 884)
  - Função `buscarSISAIH01` (linha 954)
  - Tabelas da interface (linhas 1855, 1998, 2108)
  - Células de dados (linhas 1877-1881, 2039-2043, 2134-2139)

**Campos de Banco:**
- `aihs.discharge_date` (TIMESTAMP)
- `aih_registros.data_saida` (DATE)

---

**Implementação realizada em:** 2025-01-20  
**Versão:** 2.6 (Data de Alta)  
**Status:** ✅ Pronto para produção  
**Locais afetados:** 2 PDFs + 3 Tabelas Web  
**Linting:** ✅ OK

---

<div align="center">

## 🎉 **DATA ALTERADA PARA DATA DE ALTA!**

**📅 Antes: Data de Internação | ✅ Depois: Data de Alta**

**Todos os relatórios e tabelas agora referenciam a data de alta!** 🎯

**PDFs: ✅ | Interface: ✅ | Queries: ✅ | Fallbacks: ✅**

</div>

