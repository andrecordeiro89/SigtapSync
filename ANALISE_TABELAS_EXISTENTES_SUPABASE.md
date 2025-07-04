# 🔍 **ANÁLISE TABELAS EXISTENTES - aih_matches & procedure_records**

## 📊 **RESUMO EXECUTIVO**

Analisando as tabelas **`aih_matches`** e **`procedure_records`** existentes no Supabase para verificar se atendem às necessidades dos dados extraídos da AIH MultiPageTester.

---

## 🗂️ **TABELAS ANALISADAS**

### **📋 Tabela `aih_matches` (EXISTENTE)**
```sql
id (uuid)                    -- PK
aih_id (uuid)               -- FK para aihs
procedure_id (uuid)         -- FK para sigtap_procedures  
gender_valid (bool)         -- Validação gênero
age_valid (bool)           -- Validação idade
cid_valid (bool)           -- Validação CID
habilitation_valid (bool)   -- Validação habilitação
cbo_valid (bool)           -- Validação CBO
overall_score (int4)       -- Score geral do match
calculated_value_amb (int8) -- Valor ambulatorial calculado
calculated_value_hosp (int8) -- Valor hospitalar calculado
calculated_value_prof (int8) -- Valor profissional calculado
calculated_total (int8)     -- Valor total calculado
validation_details (jsonb)  -- Detalhes das validações
match_confidence (int4)     -- Confiança do match
match_method (text)         -- Método usado no match
reviewed_by (uuid)         -- Quem revisou
reviewed_at (timestamptz)  -- Quando revisou
status (text)              -- Status (pending, approved, rejected)
approval_notes (text)      -- Notas da aprovação
created_at (timestamptz)   -- Data criação
```

### **📋 Tabela `procedure_records` (EXISTENTE)**
```sql
id (uuid)                  -- PK
hospital_id (uuid)         -- FK para hospitals
patient_id (uuid)          -- FK para patients
procedure_id (uuid)        -- FK para sigtap_procedures
aih_id (uuid)             -- FK para aihs
aih_match_id (uuid)       -- FK para aih_matches
procedure_date (timestamptz) -- Data do procedimento
value_charged (int8)       -- Valor cobrado
professional (text)        -- Nome do profissional
professional_cbo (text)    -- CBO do profissional
billing_status (text)      -- Status faturamento
billing_date (timestamptz) -- Data faturamento
payment_date (timestamptz) -- Data pagamento
notes (text)              -- Observações
created_at (timestamptz)  -- Data criação
created_by (uuid)         -- Quem criou
```

---

## ✅ **O QUE ATENDE PERFEITAMENTE**

### **🟢 Tabela `aih_matches` - EXCELENTE para Matching**
```typescript
✅ ATENDE COMPLETAMENTE o matching entre AIH e SIGTAP:
- ✅ Todas as validações necessárias
- ✅ Scores e confiança do match
- ✅ Valores calculados (SH, SP, SA)
- ✅ Status de aprovação/rejeição
- ✅ Auditoria completa (quem/quando revisou)
- ✅ Relacionamentos corretos (aih_id + procedure_id)
```

### **🟢 Tabela `procedure_records` - BOA para Procedimentos**
```typescript
✅ ATENDE PARCIALMENTE os procedimentos realizados:
- ✅ Relacionamentos (hospital, patient, aih, match)
- ✅ Data do procedimento
- ✅ Valor cobrado
- ✅ Profissional e CBO
- ✅ Status de faturamento
- ✅ Auditoria básica
```

---

## ❌ **GAPS IDENTIFICADOS**

### **🔴 Tabela `procedure_records` - CAMPOS FALTANTES**

Para mapear **100% dos dados dos procedimentos da AIH**, faltam estes campos importantes:

```sql
-- CAMPOS CRÍTICOS FALTANTES:
sequencia INTEGER,                    -- Ordem na AIH (1=principal, 2=secundário...)
codigo_procedimento_original VARCHAR(20), -- Código SIGTAP original da AIH
documento_profissional VARCHAR(15),   -- CNS do profissional (não é o nome!)
participacao VARCHAR(10),             -- Código participação profissional  
cnes VARCHAR(10),                     -- CNES onde foi realizado
valor_original INTEGER,               -- Valor antes do matching/cálculo
porcentagem_sus INTEGER,              -- % SUS aplicada (100%, 70%, etc.)
aprovado BOOLEAN,                     -- Se foi aprovado na revisão
descricao_original TEXT,              -- Descrição original da AIH
match_status VARCHAR(20)              -- Status matching específico
```

### **🔴 Tabelas `aihs` e `patients` - AINDA FALTAM CAMPOS**

Mesmo com `aih_matches` e `procedure_records`, ainda faltam campos nas tabelas principais:

#### **Tabela `aihs` (14 campos faltantes)**
```sql
situacao VARCHAR(50),
tipo VARCHAR(20),
data_autorizacao TIMESTAMP,
motivo_encerramento VARCHAR(100),
cns_autorizador VARCHAR(15),
cns_solicitante VARCHAR(15), 
cns_responsavel VARCHAR(15),
aih_anterior VARCHAR(50),
aih_posterior VARCHAR(50),
procedimento_solicitado VARCHAR(20),
mudanca_procedimento BOOLEAN,
especialidade VARCHAR(100),
modalidade VARCHAR(100),
caracter_atendimento VARCHAR(50)
```

#### **Tabela `patients` (10 campos faltantes)**
```sql
prontuario VARCHAR(50),
nacionalidade VARCHAR(50),
raca_cor VARCHAR(30),
tipo_documento VARCHAR(20),
documento VARCHAR(20),
nome_responsavel VARCHAR(255),
nome_mae VARCHAR(255),
numero_endereco VARCHAR(20),
complemento_endereco VARCHAR(100),
bairro VARCHAR(100)
```

---

## 🔧 **SOLUÇÃO OTIMIZADA**

### **✅ USAR TABELAS EXISTENTES + EXPANDIR**

Em vez de criar `aih_procedures`, posso **expandir `procedure_records`** e usar `aih_matches`:

```sql
-- EXPANDIR procedure_records (adicionar campos faltantes):
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS sequencia INTEGER;
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS codigo_procedimento_original VARCHAR(20);
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS documento_profissional VARCHAR(15);
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS participacao VARCHAR(10);
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS cnes VARCHAR(10);
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS valor_original INTEGER DEFAULT 0;
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS porcentagem_sus INTEGER DEFAULT 100;
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS aprovado BOOLEAN DEFAULT FALSE;
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS descricao_original TEXT;
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS match_status VARCHAR(20) DEFAULT 'pending';

-- Adicionar constraints
ALTER TABLE procedure_records ADD CONSTRAINT unique_aih_sequencia UNIQUE(aih_id, sequencia);
ALTER TABLE procedure_records ADD CONSTRAINT check_porcentagem_sus CHECK (porcentagem_sus >= 0 AND porcentagem_sus <= 100);
```

---

## 📊 **FLUXO DE DADOS OTIMIZADO**

### **🔄 Como Ficaria o Mapeamento:**

```typescript
// 1. AIH básica → tabela `aihs` (expandida)
const aihData = {
  aih_number: aihCompleta.numeroAIH,
  admission_date: aihCompleta.dataInicio,
  // ... campos existentes +
  situacao: aihCompleta.situacao,           // NOVO
  cns_solicitante: aihCompleta.cnsSolicitante, // NOVO
  // ... outros 12 campos novos
}

// 2. Paciente → tabela `patients` (expandida)  
const patientData = {
  name: aihCompleta.nomePaciente,
  cns: aihCompleta.cns,
  // ... campos existentes +
  prontuario: aihCompleta.prontuario,       // NOVO
  nacionalidade: aihCompleta.nacionalidade, // NOVO
  // ... outros 8 campos novos
}

// 3. Procedimentos → tabela `procedure_records` (expandida)
aihCompleta.procedimentosRealizados.map(proc => ({
  // Campos existentes
  aih_id: aihId,
  procedure_date: proc.data,
  professional: proc.nomeDoMedico,          // Usando nova funcionalidade!
  
  // Campos novos necessários
  sequencia: proc.sequencia,                // NOVO
  codigo_procedimento_original: proc.procedimento, // NOVO
  documento_profissional: proc.documentoProfissional, // NOVO
  participacao: proc.participacao,          // NOVO
  cnes: proc.cnes,                         // NOVO
  valor_original: proc.valorOriginal,      // NOVO
  porcentagem_sus: proc.porcentagemSUS,    // NOVO
  aprovado: proc.aprovado                  // NOVO
}))

// 4. Matching → tabela `aih_matches` (já existe - perfeita!)
const matchData = {
  aih_id: aihId,
  procedure_id: sigtapProcedureId,
  gender_valid: validacoes.genero,
  age_valid: validacoes.idade,
  // ... todos os campos já existem!
}
```

---

## 📋 **SCRIPT SQL OTIMIZADO**

### **🔧 Migração Mínima Necessária:**

```sql
-- 1. Expandir aihs (14 campos)
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS situacao VARCHAR(50);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS tipo VARCHAR(20);
-- ... (outros 12 campos da análise anterior)

-- 2. Expandir patients (10 campos)  
ALTER TABLE patients ADD COLUMN IF NOT EXISTS prontuario VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nacionalidade VARCHAR(50);
-- ... (outros 8 campos da análise anterior)

-- 3. Expandir procedure_records (10 campos)
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS sequencia INTEGER;
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS codigo_procedimento_original VARCHAR(20);
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS documento_profissional VARCHAR(15);
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS participacao VARCHAR(10);
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS cnes VARCHAR(10);
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS valor_original INTEGER DEFAULT 0;
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS porcentagem_sus INTEGER DEFAULT 100;
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS aprovado BOOLEAN DEFAULT FALSE;
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS descricao_original TEXT;
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS match_status VARCHAR(20) DEFAULT 'pending';

-- 4. aih_matches → JÁ PERFEITA! (0 alterações)
```

---

## 🎯 **RESUMO FINAL**

### **✅ O QUE AS TABELAS EXISTENTES ATENDEM:**
- ✅ **`aih_matches`**: **100% perfeita** para matching e validações
- ✅ **`procedure_records`**: **70% adequada** para procedimentos

### **❌ O QUE AINDA FALTA:**
- ❌ **10 campos** na `procedure_records` 
- ❌ **14 campos** na `aihs`
- ❌ **10 campos** na `patients`

### **🎉 BENEFÍCIOS DA SOLUÇÃO:**
- ✅ **Reutiliza tabelas existentes** (melhor arquitetura)
- ✅ **Menos alterações** no banco
- ✅ **Mantém relacionamentos** existentes
- ✅ **100% dos dados** serão persistidos
- ✅ **Zero perda** de informações

---

## 📊 **CONCLUSÃO**

**SIM, as tabelas existentes atendem MUITO BEM nossas necessidades!**

**Com apenas 34 campos adicionados nas 3 tabelas, teremos:**
- ✅ Persistência **100%** dos dados da AIH
- ✅ **Aproveitamento** das tabelas existentes
- ✅ **Matching completo** (já funciona)
- ✅ **Relacionamentos preservados**

**A solução fica muito mais limpa e eficiente!** 🚀 