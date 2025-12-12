# 🔍 **ANÁLISE DE GAPS - DADOS AIH x ESQUEMA SUPABASE**

## 📊 **RESUMO EXECUTIVO**

Esta análise compara os **dados extraídos na tela AIH MultiPageTester** com o **esquema do banco Supabase** para identificar o que falta para popular todos os dados sem conflitos.

---

## 🗂️ **ESTRUTURAS COMPARADAS**

### **📋 Dados Extraídos (AIHMultiPageTester)**
A tela extrai os seguintes dados da AIH:

#### **🆔 Dados da AIH**
```typescript
numeroAIH: string
situacao: string
tipo: string
dataAutorizacao: string
dataInicio: string
dataFim: string
motivoEncerramento: string
cnsAutorizador: string
cnsSolicitante: string
cnsResponsavel: string
aihAnterior: string
aihPosterior: string
```

#### **👤 Identificação do Paciente**
```typescript
prontuario: string
nomePaciente: string
cns: string
nascimento: string
sexo: string
nacionalidade: string
racaCor: string
tipoDocumento: string
documento: string
nomeResponsavel: string
nomeMae: string
endereco: string
numero: string
complemento: string
bairro: string
municipio: string
uf: string
cep: string
telefone: string
```

#### **🏥 Dados da Internação**
```typescript
procedimentoSolicitado: string
mudancaProc: boolean
procedimentoPrincipal: string
cidPrincipal: string
especialidade: string
modalidade: string
caracterAtendimento: string
```

#### **💊 Procedimentos Realizados**
```typescript
procedimentosRealizados: Array<{
  sequencia: number
  procedimento: string
  documentoProfissional: string
  cbo: string
  participacao: string
  cnes: string
  data: string
  descricao?: string
  valorCalculado?: number
  valorOriginal?: number
  // ... outros campos de matching
}>
```

### **🗄️ Esquema Banco Supabase**

#### **Tabela `aihs`**
```sql
id UUID PRIMARY KEY
hospital_id UUID NOT NULL
patient_id UUID NOT NULL
aih_number VARCHAR(50) NOT NULL
procedure_code VARCHAR(20) NOT NULL
admission_date TIMESTAMP WITH TIME ZONE NOT NULL
discharge_date TIMESTAMP WITH TIME ZONE
estimated_discharge_date TIMESTAMP WITH TIME ZONE
main_cid VARCHAR(10) NOT NULL
secondary_cid TEXT[]
professional_cbo VARCHAR(10)
requesting_physician VARCHAR(255)
original_value INTEGER
processing_status VARCHAR(20)
match_found BOOLEAN
rejection_reason TEXT
requires_manual_review BOOLEAN
source_file VARCHAR(255)
import_batch_id UUID
created_at TIMESTAMP WITH TIME ZONE
processed_at TIMESTAMP WITH TIME ZONE
created_by UUID
```

#### **Tabela `patients`**
```sql
id UUID PRIMARY KEY
hospital_id UUID NOT NULL
name VARCHAR(255) NOT NULL
cns VARCHAR(15) NOT NULL
cpf VARCHAR(11)
birth_date DATE NOT NULL
gender VARCHAR(1) NOT NULL
address TEXT
city VARCHAR(100)
state VARCHAR(2)
zip_code VARCHAR(10)
phone VARCHAR(20)
email VARCHAR(255)
blood_type VARCHAR(3)
allergies TEXT
medical_notes TEXT
is_active BOOLEAN
created_at TIMESTAMP WITH TIME ZONE
updated_at TIMESTAMP WITH TIME ZONE
created_by UUID
```

---

## ❌ **GAPS IDENTIFICADOS**

### **🔴 CAMPOS DA AIH SEM MAPEAMENTO NO BANCO**

#### **1. Dados da AIH (Faltam na tabela `aihs`)**
```sql
-- CAMPOS FALTANTES:
situacao VARCHAR(50),                    -- Situação da AIH
tipo VARCHAR(20),                        -- Tipo da AIH
data_autorizacao TIMESTAMP,              -- Data de autorização
motivo_encerramento VARCHAR(100),        -- Motivo do encerramento
cns_autorizador VARCHAR(15),             -- CNS do médico autorizador
cns_solicitante VARCHAR(15),             -- CNS do médico solicitante  
cns_responsavel VARCHAR(15),             -- CNS do médico responsável
aih_anterior VARCHAR(50),                -- AIH anterior
aih_posterior VARCHAR(50),               -- AIH posterior
procedimento_solicitado VARCHAR(20),     -- Procedimento solicitado
mudanca_procedimento BOOLEAN,            -- Se houve mudança
especialidade VARCHAR(100),              -- Especialidade médica
modalidade VARCHAR(100),                 -- Modalidade de atendimento
caracter_atendimento VARCHAR(50),        -- Caráter do atendimento
```

#### **2. Dados do Paciente (Faltam na tabela `patients`)**
```sql
-- CAMPOS FALTANTES:
prontuario VARCHAR(50),                  -- Número do prontuário
nacionalidade VARCHAR(50),               -- Nacionalidade
raca_cor VARCHAR(30),                    -- Raça/cor
tipo_documento VARCHAR(20),              -- Tipo do documento
documento VARCHAR(20),                   -- Número do documento
nome_responsavel VARCHAR(255),           -- Nome do responsável
nome_mae VARCHAR(255),                   -- Nome da mãe
numero_endereco VARCHAR(20),             -- Número do endereço
complemento_endereco VARCHAR(100),       -- Complemento do endereço
bairro VARCHAR(100),                     -- Bairro
```

### **🔴 NOVA TABELA NECESSÁRIA: `aih_procedures`**

Os **procedimentos realizados** na AIH precisam de uma tabela própria:

```sql
CREATE TABLE aih_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aih_id UUID NOT NULL REFERENCES aihs(id) ON DELETE CASCADE,
  sequencia INTEGER NOT NULL,
  codigo_procedimento VARCHAR(20) NOT NULL,
  documento_profissional VARCHAR(15),
  cbo VARCHAR(10),
  participacao VARCHAR(10),
  cnes VARCHAR(10),
  data_realizacao DATE,
  descricao TEXT,
  valor_original INTEGER, -- em centavos
  valor_calculado INTEGER, -- em centavos
  match_status VARCHAR(20) DEFAULT 'pending',
  sigtap_procedure_id UUID REFERENCES sigtap_procedures(id),
  porcentagem_sus INTEGER DEFAULT 100,
  aprovado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(aih_id, sequencia)
);
```

---

## ✅ **CAMPOS JÁ MAPEADOS CORRETAMENTE**

### **🟢 Dados da AIH**
- ✅ `numeroAIH` → `aih_number`
- ✅ `dataInicio` → `admission_date`
- ✅ `dataFim` → `discharge_date`
- ✅ `cidPrincipal` → `main_cid`
- ✅ `procedimentoPrincipal` → `procedure_code`

### **🟢 Dados do Paciente**
- ✅ `nomePaciente` → `name`
- ✅ `cns` → `cns`
- ✅ `nascimento` → `birth_date`
- ✅ `sexo` → `gender`
- ✅ `endereco` → `address`
- ✅ `municipio` → `city`
- ✅ `uf` → `state`
- ✅ `cep` → `zip_code`
- ✅ `telefone` → `phone`

---

## 🔧 **SOLUÇÃO: SCHEMA MIGRATION**

### **1. Expandir Tabela `aihs`**
```sql
-- Adicionar campos faltantes na tabela aihs
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS situacao VARCHAR(50);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS tipo VARCHAR(20);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS data_autorizacao TIMESTAMP WITH TIME ZONE;
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS motivo_encerramento VARCHAR(100);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS cns_autorizador VARCHAR(15);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS cns_solicitante VARCHAR(15);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS cns_responsavel VARCHAR(15);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS aih_anterior VARCHAR(50);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS aih_posterior VARCHAR(50);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS procedimento_solicitado VARCHAR(20);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS mudanca_procedimento BOOLEAN DEFAULT FALSE;
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS especialidade VARCHAR(100);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS modalidade VARCHAR(100);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS caracter_atendimento VARCHAR(50);
```

### **2. Expandir Tabela `patients`**
```sql
-- Adicionar campos faltantes na tabela patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS prontuario VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nacionalidade VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS raca_cor VARCHAR(30);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS documento VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nome_responsavel VARCHAR(255);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nome_mae VARCHAR(255);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS numero_endereco VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS complemento_endereco VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);
```

### **3. Criar Tabela `aih_procedures`**
```sql
-- Nova tabela para procedimentos da AIH
CREATE TABLE aih_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aih_id UUID NOT NULL REFERENCES aihs(id) ON DELETE CASCADE,
  sequencia INTEGER NOT NULL,
  codigo_procedimento VARCHAR(20) NOT NULL,
  documento_profissional VARCHAR(15),
  cbo VARCHAR(10),
  participacao VARCHAR(10),
  cnes VARCHAR(10),
  data_realizacao DATE,
  descricao TEXT,
  valor_original INTEGER DEFAULT 0,
  valor_calculado INTEGER DEFAULT 0,
  match_status VARCHAR(20) DEFAULT 'pending',
  sigtap_procedure_id UUID REFERENCES sigtap_procedures(id),
  porcentagem_sus INTEGER DEFAULT 100,
  aprovado BOOLEAN DEFAULT FALSE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(aih_id, sequencia),
  CHECK (porcentagem_sus >= 0 AND porcentagem_sus <= 100),
  CHECK (match_status IN ('pending', 'matched', 'manual', 'rejected'))
);

-- Índices para performance
CREATE INDEX idx_aih_procedures_aih ON aih_procedures(aih_id);
CREATE INDEX idx_aih_procedures_codigo ON aih_procedures(codigo_procedimento);
CREATE INDEX idx_aih_procedures_status ON aih_procedures(match_status);
```

---

## 📋 **RESUMO DOS GAPS**

### **🔴 Campos Faltantes:**
- **14 campos** na tabela `aihs`
- **10 campos** na tabela `patients`  
- **1 tabela nova** `aih_procedures` (completa)

### **🟢 Impacto da Solução:**
- ✅ **100% dos dados** da AIH serão persistidos
- ✅ **Zero perda** de informações
- ✅ **Integridade total** dos dados
- ✅ **Relacionamentos preservados**

---

**A análise está concluída! Com essas alterações, será possível popular 100% dos dados extraídos da AIH no banco Supabase sem conflitos.** 🎉 