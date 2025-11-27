# 🗺️ **MAPEAMENTO FTP DATASUS → BANCO DE DADOS**

## 📋 **GUIA RÁPIDO DE MAPEAMENTO**

**Objetivo:** Mapear campos dos arquivos DATASUS (RD, SP) para as tabelas do banco de dados  
**Data:** 27 de Novembro de 2025  
**Status:** ✅ Pronto para Implementação

---

## 📊 **TABELA 1: `patients` (Pacientes)**

### **Total de Colunas:** 27

| Campo Origem (AIH/PDF) | Coluna Banco | Tipo | Obrigatório | Exemplo |
|------------------------|--------------|------|-------------|---------|
| `nomePaciente` | `name` | VARCHAR(255) | ✅ Sim | "MARIA DA SILVA" |
| `cns` | `cns` | VARCHAR(15) | ✅ Sim | "898001234567890" |
| `nascimento` | `birth_date` | DATE | ✅ Sim | "1980-05-15" |
| `sexo` | `gender` | VARCHAR(1) | ✅ Sim | "M" ou "F" |
| `prontuario` | `medical_record` | VARCHAR(50) | ❌ Não | "123456" |
| `nomeMae` | `mother_name` | VARCHAR(255) | ❌ Não | "ANA SANTOS" |
| `endereco` | `address` | TEXT | ❌ Não | "RUA DAS FLORES" |
| `numero` | `numero` | VARCHAR(20) | ❌ Não | "123" |
| `complemento` | `complemento` | VARCHAR(100) | ❌ Não | "APTO 45" |
| `bairro` | `bairro` | VARCHAR(100) | ❌ Não | "CENTRO" |
| `municipio` | `city` | VARCHAR(100) | ❌ Não | "CURITIBA" |
| `uf` | `state` | VARCHAR(2) | ❌ Não | "PR" |
| `cep` | `zip_code` | VARCHAR(10) | ❌ Não | "80000000" |
| `telefone` | `phone` | VARCHAR(20) | ❌ Não | "41999887766" |
| `nacionalidade` | `nationality` | VARCHAR(50) | ❌ Não | "BRASIL" |
| `racaCor` | `race_color` | VARCHAR(30) | ❌ Não | "BRANCA" |
| `tipoDocumento` | `tipo_documento` | VARCHAR(20) | ❌ Não | "RG" |
| `documento` | `documento` | VARCHAR(20) | ❌ Não | "12345678" |
| `nomeResponsavel` | `nome_responsavel` | VARCHAR(255) | ❌ Não | "JOÃO SILVA" |
| - (auto) | `hospital_id` | UUID | ✅ Sim | UUID do hospital |
| - (auto) | `is_active` | BOOLEAN | ✅ Sim | true |
| - (auto) | `created_at` | TIMESTAMP | ✅ Sim | NOW() |
| - (auto) | `updated_at` | TIMESTAMP | ✅ Sim | NOW() |

### **Arquivo DATASUS:** RD (Reduzida da AIH)

| Campo RD | Posição | → | Coluna Banco |
|----------|---------|---|--------------|
| `NASC` | 29-36 (AAAAMMDD) | → | `birth_date` |
| `SEXO` | 37 (1=M, 3=F) | → | `gender` |
| `CEP` | 15-22 | → | `zip_code` |
| `MUNIC_RES` | 23-28 | → | `city` (código IBGE) |
| `RACA_COR` | 158-159 | → | `race_color` |
| `NACIONAL` | 135-137 | → | `nationality` |
| - | - | → | `cns` (vem de CAD_PACIENTE) |

---

## 📊 **TABELA 2: `aihs` (Internações)**

### **Total de Colunas:** 35

| Campo Origem (AIH/PDF) | Coluna Banco | Tipo | Obrigatório | Exemplo |
|------------------------|--------------|------|-------------|---------|
| `numeroAIH` | `aih_number` | VARCHAR(50) | ✅ Sim | "2324000123456" |
| `procedimentoPrincipal` (código) | `procedure_code` | VARCHAR(20) | ✅ Sim | "04.07.01.012-9" |
| `dataInicio` | `admission_date` | TIMESTAMP | ✅ Sim | "2024-11-10" |
| `dataFim` | `discharge_date` | TIMESTAMP | ❌ Não | "2024-11-15" |
| `cidPrincipal` | `main_cid` | VARCHAR(10) | ✅ Sim | "K80.2" |
| `cidSecundario` | `secondary_cid` | TEXT[] | ❌ Não | ["I10", "E11"] |
| `situacao` | `situacao` | VARCHAR(50) | ❌ Não | "Aprovada" |
| `tipo` | `tipo` | VARCHAR(20) | ❌ Não | "Normal" |
| `dataAutorizacao` | `authorization_date` | TIMESTAMP | ❌ Não | "2024-11-08" |
| `cnsAutorizador` | `cns_authorizer` | VARCHAR(15) | ❌ Não | "898000111222333" |
| `cnsSolicitante` | `cns_requester` | VARCHAR(15) | ❌ Não | "898000444555666" |
| `cnsResponsavel` | `cns_responsible` | VARCHAR(15) | ❌ Não | "898000777888999" |
| `aihAnterior` | `aih_anterior` | VARCHAR(50) | ❌ Não | "2323000999888" |
| `aihPosterior` | `aih_posterior` | VARCHAR(50) | ❌ Não | "2324001111222" |
| `procedimentoSolicitado` (código) | `procedure_requested` | VARCHAR(20) | ❌ Não | "03.01.01.007-0" |
| `mudancaProc` | `procedure_changed` | BOOLEAN | ❌ Não | true/false |
| `especialidade` | `specialty` | VARCHAR(100) | ✅ Sim | "01 - Cirúrgico" |
| `modalidade` | `care_modality` | VARCHAR(100) | ❌ Não | "Hospitalar" |
| `caracterAtendimento` | `care_character` | VARCHAR(1) | ✅ Sim | "1" ou "2" |
| `motivoEncerramento` | `discharge_reason` | VARCHAR(100) | ❌ Não | "ALTA MELHORADO" |
| `diasPermanencia` | `stay_days` | INTEGER | ❌ Não | 5 |
| `competencia` | `competencia` | VARCHAR(7) | ✅ Sim | "2024-11" |
| `valorEstimado` | `estimated_original_value` | INTEGER | ❌ Não | 125050 (centavos) |
| `valorTotal` | `calculated_total_value` | INTEGER | ❌ Não | 120080 (centavos) |
| `diaria` | `daily_value` | INTEGER | ❌ Não | 20000 (centavos) |
| `observacoesFaturamento` | `billing_notes` | TEXT | ❌ Não | "Procedimento c/ OPM" |
| - (auto) | `hospital_id` | UUID | ✅ Sim | UUID do hospital |
| - (auto) | `patient_id` | UUID | ✅ Sim | UUID do paciente |
| - (auto) | `processing_status` | VARCHAR(20) | ✅ Sim | "completed" |
| - (auto) | `match_found` | BOOLEAN | ✅ Sim | true/false |
| - (auto) | `requires_manual_review` | BOOLEAN | ✅ Sim | false |
| - (auto) | `total_procedures` | INTEGER | ✅ Sim | 5 |
| - (auto) | `approved_procedures` | INTEGER | ✅ Sim | 5 |
| - (auto) | `rejected_procedures` | INTEGER | ✅ Sim | 0 |
| - (auto) | `source_file` | VARCHAR(255) | ❌ Não | "RD2411.dbc" |
| - (auto) | `created_at` | TIMESTAMP | ✅ Sim | NOW() |
| - (auto) | `updated_at` | TIMESTAMP | ✅ Sim | NOW() |

### **Arquivo DATASUS:** RD (Reduzida da AIH)

| Campo RD | Posição | Formato | → | Coluna Banco |
|----------|---------|---------|---|--------------|
| `N_AIH` | 1-13 | 13 chars | → | `aih_number` |
| `IDENT` | 14 | 1 char | → | `tipo` |
| `DT_INTER` | 93-100 | AAAAMMDD | → | `admission_date` |
| `DT_SAIDA` | 101-108 | AAAAMMDD | → | `discharge_date` |
| `PROC_SOLIC` | 43-52 | 10 chars | → | `procedure_requested` |
| `PROC_REA` | 53-62 | 10 chars | → | `procedure_code` |
| `DIAG_PRINC` | 109-112 | 4 chars | → | `main_cid` |
| `DIAG_SECUN` | 113-116 | 4 chars | → | `secondary_cid[0]` |
| `VAL_TOT` | 83-92 | 10 digits | → | `calculated_total_value` |
| `VAL_SH` | 63-72 | 10 digits | → | (valor hospitalar) |
| `VAL_SP` | 73-82 | 10 digits | → | (valor profissional) |
| `DIAS_PERM` | 130-133 | 4 digits | → | `stay_days` |
| `CAR_INT` | 138 | 1 char | → | `care_character` |
| `UTI_MES_IN` | 38-39 | 2 digits | → | `uti_days` |
| `COMPLEX` | 150 | 1 char | → | `specific_complexity` |
| - | - | - | → | `competencia` (derivar de DT_SAIDA) |

---

## 📊 **TABELA 3: `procedure_records` (Procedimentos)**

### **Total de Colunas:** 32

| Campo Origem (AIH/PDF) | Coluna Banco | Tipo | Obrigatório | Exemplo |
|------------------------|--------------|------|-------------|---------|
| `sequencia` | `sequencia` | INTEGER | ✅ Sim | 1, 2, 3... |
| `procedimento` (código) | `procedure_code` | VARCHAR(20) | ✅ Sim | "04.07.01.012-9" |
| `descricao` | `procedure_description` | TEXT | ❌ Não | "COLECISTECTOMIA" |
| `data` | `procedure_date` | TIMESTAMP | ✅ Sim | "2024-11-12" |
| `quantity` | `quantity` | INTEGER | ✅ Sim | 1 |
| `documentoProfissional` | `professional_cns` | VARCHAR(15) | ❌ Não | "898000123456789" |
| `documentoProfissional` | `professional_document` | VARCHAR(15) | ❌ Não | "898000123456789" |
| `nomeProfissional` | `professional_name` | VARCHAR(255) | ❌ Não | "DR. JOSÉ SANTOS" |
| `cbo` | `professional_cbo` | VARCHAR(10) | ✅ Sim | "225125" |
| `participacao` | `participation` | VARCHAR(10) | ❌ Não | "12" |
| `cnes` | `cnes` | VARCHAR(10) | ❌ Não | "2082462" |
| `valorOriginal` | `original_value` | INTEGER | ❌ Não | 45050 (centavos) |
| `valorCalculado` | `calculated_value` | INTEGER | ❌ Não | 42080 (centavos) |
| `valorCalculado` | `total_value` | INTEGER | ❌ Não | 42080 (centavos) |
| `porcentagemSUS` | `sus_percentage` | INTEGER | ✅ Sim | 100 (0-100) |
| `matchStatus` | `match_status` | VARCHAR(20) | ✅ Sim | "matched" |
| `matchConfidence` | `match_confidence` | DECIMAL(3,2) | ❌ Não | 0.95 |
| `aprovado` | `approved` | BOOLEAN | ✅ Sim | true |
| `observacoes` | `notes` | TEXT | ❌ Não | "Sem intercorrências" |
| `numeroAIH` | `aih_number` | VARCHAR(50) | ✅ Sim | "2324000123456" |
| `modalidade` | `care_modality` | VARCHAR(100) | ❌ Não | "Hospitalar" |
| `caracterAtendimento` | `care_character` | VARCHAR(1) | ❌ Não | "1" ou "2" |
| - (auto) | `hospital_id` | UUID | ✅ Sim | UUID do hospital |
| - (auto) | `patient_id` | UUID | ✅ Sim | UUID do paciente |
| - (auto) | `aih_id` | UUID | ✅ Sim | UUID da AIH |
| - (auto) | `billing_status` | VARCHAR(20) | ✅ Sim | "pending" |
| - (auto) | `value_charged` | INTEGER | ❌ Não | 45050 (centavos) |
| - (auto) | `created_at` | TIMESTAMP | ✅ Sim | NOW() |
| - (auto) | `updated_at` | TIMESTAMP | ✅ Sim | NOW() |

### **Arquivo DATASUS:** SP (Serviços Profissionais)

| Campo SP | Posição | Formato | → | Coluna Banco |
|----------|---------|---------|---|--------------|
| `N_AIH` | 1-13 | 13 chars | → | `aih_number` |
| `SEQUENCIA` | 14-20 | 7 digits | → | `sequencia` |
| `PROC_REA` | 21-30 | 10 chars | → | `procedure_code` |
| `QTDE` | 31-34 | 4 digits | → | `quantity` |
| `DT_ATEND` | 35-42 | AAAAMMDD | → | `procedure_date` |
| `CBO` | 43-48 | 6 chars | → | `professional_cbo` |
| `CNPJ_EXEC` | 49-62 | 14 chars | → | (CNPJ executante) |
| `IDENT_EXEC` | 63 | 1 char | → | (identificação) |
| - | - | - | → | `professional_cns` (buscar em doctors) |
| - | - | - | → | `professional_name` (buscar em doctors) |

---

## 📊 **TABELA 4: `aih_matches` (Matching SIGTAP)**

### **Total de Colunas:** 20

| Campo Origem (Sistema) | Coluna Banco | Tipo | Obrigatório | Exemplo |
|------------------------|--------------|------|-------------|---------|
| `procedimento` (código) | `procedure_code` | VARCHAR(20) | ✅ Sim | "04.07.01.012-9" |
| `validations.gender` | `gender_valid` | BOOLEAN | ✅ Sim | true |
| `validations.age` | `age_valid` | BOOLEAN | ✅ Sim | true |
| `validations.cid` | `cid_valid` | BOOLEAN | ✅ Sim | true |
| `validations.habilitation` | `habilitation_valid` | BOOLEAN | ✅ Sim | true |
| `validations.cbo` | `cbo_valid` | BOOLEAN | ✅ Sim | true |
| `matchConfidence * 100` | `overall_score` | INTEGER | ✅ Sim | 95 (0-100) |
| `matchConfidence` | `match_confidence` | DECIMAL(3,2) | ✅ Sim | 0.95 |
| `sigtapProcedure.valor_ambulatorial` | `calculated_value_amb` | INTEGER | ✅ Sim | 1000 (centavos) |
| `sigtapProcedure.valor_hospitalar` | `calculated_value_hosp` | INTEGER | ✅ Sim | 35080 (centavos) |
| `sigtapProcedure.valor_profissional` | `calculated_value_prof` | INTEGER | ✅ Sim | 6000 (centavos) |
| `valorCalculado` | `calculated_total` | INTEGER | ✅ Sim | 42080 (centavos) |
| `validations + sigtapProcedure` | `validation_details` | JSONB | ❌ Não | {...} |
| - (fixo) | `match_method` | VARCHAR(50) | ✅ Sim | "exact_code_match" |
| `matchStatus` | `status` | VARCHAR(20) | ✅ Sim | "approved" |
| - (auto) | `aih_id` | UUID | ✅ Sim | UUID da AIH |
| - (auto) | `procedure_id` | UUID | ❌ Não | UUID SIGTAP |
| - (auto) | `created_at` | TIMESTAMP | ✅ Sim | NOW() |
| - (auto) | `updated_at` | TIMESTAMP | ✅ Sim | NOW() |

### **Fonte:** Matching automático com tabela `sigtap_procedures`

**Não vem do DATASUS**, é gerado pelo sistema ao fazer matching do código do procedimento com a tabela SIGTAP local.

---

## 🔄 **RESUMO POR ARQUIVO DATASUS**

### **📁 Arquivo RD (Reduzida da AIH)**

**Formato:** DBF compactado (.dbc)  
**Conteúdo:** 1 linha = 1 AIH (dados gerais)  
**Popula:** `patients` + `aihs`

| Campo RD | Tamanho | → Tabela | → Coluna |
|----------|---------|----------|----------|
| `N_AIH` | 13 | `aihs` | `aih_number` |
| `NASC` | 8 | `patients` | `birth_date` |
| `SEXO` | 1 | `patients` | `gender` |
| `CEP` | 8 | `patients` | `zip_code` |
| `MUNIC_RES` | 6 | `patients` | `city` |
| `RACA_COR` | 2 | `patients` | `race_color` |
| `DT_INTER` | 8 | `aihs` | `admission_date` |
| `DT_SAIDA` | 8 | `aihs` | `discharge_date` |
| `PROC_SOLIC` | 10 | `aihs` | `procedure_requested` |
| `PROC_REA` | 10 | `aihs` | `procedure_code` |
| `DIAG_PRINC` | 4 | `aihs` | `main_cid` |
| `DIAG_SECUN` | 4 | `aihs` | `secondary_cid` |
| `VAL_TOT` | 10 | `aihs` | `calculated_total_value` |
| `DIAS_PERM` | 4 | `aihs` | `stay_days` |
| `CAR_INT` | 1 | `aihs` | `care_character` |
| `UTI_MES_IN` | 2 | `aihs` | `uti_days` |

---

### **📁 Arquivo SP (Serviços Profissionais)**

**Formato:** DBF compactado (.dbc)  
**Conteúdo:** 1 linha = 1 procedimento  
**Popula:** `procedure_records`

| Campo SP | Tamanho | → Tabela | → Coluna |
|----------|---------|----------|----------|
| `N_AIH` | 13 | `procedure_records` | `aih_number` |
| `SEQUENCIA` | 7 | `procedure_records` | `sequencia` |
| `PROC_REA` | 10 | `procedure_records` | `procedure_code` |
| `QTDE` | 4 | `procedure_records` | `quantity` |
| `DT_ATEND` | 8 | `procedure_records` | `procedure_date` |
| `CBO` | 6 | `procedure_records` | `professional_cbo` |

---

## 🔢 **CONVERSÕES NECESSÁRIAS**

### **1. Datas (AAAAMMDD → YYYY-MM-DD)**

```javascript
function convertDateFromDATASUS(dateStr) {
  // "20241115" → "2024-11-15"
  if (dateStr.length === 8) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  return null;
}
```

### **2. Sexo (1/3 → M/F)**

```javascript
function convertGender(sexo) {
  // 1 = Masculino, 3 = Feminino
  return sexo === '1' ? 'M' : sexo === '3' ? 'F' : null;
}
```

### **3. Valores (string → integer em centavos)**

```javascript
function convertValue(valueStr) {
  // "0000125050" → 125050 (já está em centavos)
  return parseInt(valueStr, 10) || 0;
}
```

### **4. CID (4 chars → formato completo)**

```javascript
function convertCID(cidStr) {
  // "K802" → "K80.2"
  if (cidStr.length === 4) {
    return `${cidStr.substring(0, 3)}.${cidStr.substring(3)}`;
  }
  return cidStr;
}
```

### **5. Procedimento (10 chars → formato SIGTAP)**

```javascript
function convertProcedureCode(procStr) {
  // "0407010129" → "04.07.01.012-9"
  if (procStr.length === 10) {
    return `${procStr.substring(0, 2)}.${procStr.substring(2, 4)}.${procStr.substring(4, 6)}.${procStr.substring(6, 9)}-${procStr.substring(9)}`;
  }
  return procStr;
}
```

### **6. Caráter de Atendimento (diversos → 1 ou 2)**

```javascript
function convertCareCharacter(carInt) {
  // Mapeamento específico do DATASUS
  // 1 = Eletivo, 2 = Urgência, etc.
  return carInt === '1' ? '1' : '2';
}
```

---

## 📋 **ORDEM DE INSERÇÃO NO BANCO**

### **Sequência Correta:**

```
1. BUSCAR/CRIAR PACIENTE (patients)
   └─ Retorna: patient_id

2. CRIAR AIH (aihs)
   └─ Precisa: patient_id
   └─ Retorna: aih_id

3. CRIAR PROCEDIMENTOS (procedure_records)
   └─ Precisa: aih_id, patient_id
   └─ Para cada linha do arquivo SP

4. CRIAR MATCHES (aih_matches)
   └─ Precisa: aih_id
   └─ Matching automático com SIGTAP
```

---

## ⚠️ **CAMPOS QUE NÃO VÊM DO DATASUS**

### **Devem ser preenchidos pelo sistema:**

| Tabela | Coluna | Como preencher |
|--------|--------|----------------|
| `patients` | `cns` | Buscar em arquivo CAD_PACIENTE ou deixar vazio |
| `patients` | `name` | Buscar em arquivo CAD_PACIENTE ou usar "PACIENTE SEM NOME" |
| `patients` | `address`, `numero`, `complemento` | Não vem do DATASUS, deixar NULL |
| `patients` | `phone` | Não vem do DATASUS, deixar NULL |
| `patients` | `mother_name` | Não vem do DATASUS, deixar NULL |
| `aihs` | `cns_responsible`, `cns_requester`, `cns_authorizer` | Buscar em arquivo ST (Serviços Terceiros) ou deixar NULL |
| `aihs` | `specialty` | Derivar de `care_character` + `procedure_code` |
| `aihs` | `competencia` | Derivar de `discharge_date` (YYYY-MM) |
| `procedure_records` | `professional_name` | Buscar em tabela `doctors` por `professional_cns` |
| `procedure_records` | `professional_cns` | Buscar em arquivo ST (Serviços Terceiros) |
| `aih_matches` | Todos | Gerado automaticamente pelo matching SIGTAP |

---

## 📊 **RESUMO GERAL**

### **Total de Colunas por Tabela:**

| Tabela | Total Colunas | Do DATASUS | Do Sistema | Do SIGTAP |
|--------|---------------|------------|------------|-----------|
| `patients` | 27 | 6 campos | 21 campos | - |
| `aihs` | 35 | 16 campos | 19 campos | - |
| `procedure_records` | 32 | 6 campos | 26 campos | - |
| `aih_matches` | 20 | - | 5 campos | 15 campos |
| **TOTAL** | **114** | **28** | **71** | **15** |

### **Cobertura DATASUS:**

```
✅ Campos populados do DATASUS: 28 (25%)
✅ Campos gerados pelo sistema: 71 (62%)
✅ Campos do matching SIGTAP: 15 (13%)
```

---

## 🎯 **CHECKLIST DE IMPLEMENTAÇÃO**

### **Pré-requisitos:**

- [ ] Biblioteca para ler DBF instalada (`node-dbf`)
- [ ] Biblioteca para descompactar DBC instalada (`decompress`)
- [ ] Biblioteca para FTP instalada (`ftp`)
- [ ] Biblioteca para encoding instalada (`iconv-lite`)
- [ ] Tabela `sigtap_procedures` populada e atualizada

### **Desenvolvimento:**

- [ ] Criar função `downloadFromFTP()`
- [ ] Criar função `decompressDBC()`
- [ ] Criar função `parseDBF()`
- [ ] Criar função `convertDateFromDATASUS()`
- [ ] Criar função `convertGender()`
- [ ] Criar função `convertProcedureCode()`
- [ ] Criar função `upsertPatient()`
- [ ] Criar função `createAIH()`
- [ ] Criar função `createProcedureRecord()`
- [ ] Criar função `createAIHMatch()`
- [ ] Criar função `matchSIGTAP()`

### **Testes:**

- [ ] Testar conversão de datas
- [ ] Testar conversão de procedimentos
- [ ] Testar matching SIGTAP
- [ ] Testar inserção em lote
- [ ] Validar integridade referencial
- [ ] Medir performance

---

**📌 DOCUMENTO PRONTO PARA IMPLEMENTAÇÃO**  
**🗺️ MAPEAMENTO COMPLETO DATASUS → BANCO**  
**✅ TODOS OS CAMPOS DOCUMENTADOS**

Data: 27 de Novembro de 2025

