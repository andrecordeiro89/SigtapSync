# 📋 MAPEAMENTO DE FUNCIONALIDADES E REGRAS DE NEGÓCIO
## SIGTAP Sync - Documentação Técnica Completa

**Data:** 04 de Outubro de 2025  
**Versão:** 1.0

---

## 📑 ÍNDICE

1. [Funcionalidades Principais](#1-funcionalidades-principais)
2. [Funcionalidades Secundárias](#2-funcionalidades-secundárias)
3. [Regras de Negócio SUS](#3-regras-de-negócio-sus)
4. [Validações e Restrições](#4-validações-e-restrições)
5. [Cálculos e Valores](#5-cálculos-e-valores)
6. [Fluxos de Trabalho](#6-fluxos-de-trabalho)

---

## 1. FUNCIONALIDADES PRINCIPAIS

### 1.1 GESTÃO DE AUTENTICAÇÃO E USUÁRIOS

#### **F1.1.1 - Login de Usuário**

**Objetivo:**  
Autenticar usuário no sistema e estabelecer sessão segura.

**Fluxo de Uso:**
1. Usuário acessa URL do sistema
2. Sistema verifica sessão existente
3. Se não autenticado, exibe tela de login
4. Usuário insere email e senha
5. Sistema valida credenciais
6. Se válido, cria sessão JWT e redireciona para Dashboard

**Pré-requisitos:**
- Conta de usuário ativa (`is_active = true`)
- Credenciais válidas no Supabase Auth
- Conexão com internet

**Resultados Esperados:**
- **Sucesso:** Token JWT válido, perfil carregado, redirecionamento para Dashboard
- **Falha:** Mensagem de erro específica (credenciais inválidas, conta inativa, etc.)

**Validações:**
- Email: formato válido (regex padrão)
- Senha: mínimo 8 caracteres
- Rate limiting: máximo 5 tentativas por 15 minutos

**Comportamento em Erros:**
- **Credenciais Inválidas:** "Email ou senha incorretos" + contador de tentativas
- **Conta Inativa:** "Sua conta está desativada. Contate o administrador."
- **Erro de Conexão:** "Erro de conexão. Verifique sua internet e tente novamente."

**Regras de Negócio:**
- RN-AUTH-001: Apenas usuários com `is_active = true` podem fazer login
- RN-AUTH-002: Sessão expira após 24 horas de inatividade
- RN-AUTH-003: Multi-login permitido (múltiplas sessões simultâneas)

---

#### **F1.1.2 - Controle de Acesso Baseado em Roles (RBAC)**

**Roles Disponíveis:**

| Role | Nível de Acesso | Descrição |
|------|-----------------|-----------|
| **developer** | 10 - Total | Acesso completo + ferramentas de debug |
| **admin** | 9 - Administrativo | Gestão completa do sistema |
| **director** | 8 - Executivo | Todos os hospitais + analytics |
| **coordinator** | 7 - Supervisão | Supervisão e coordenação |
| **auditor** | 6 - Auditoria | Monitoramento e logs |
| **ti** | 5 - Técnico | Suporte técnico e configuração |
| **operator** | 1 - Operacional | Hospital específico |

**Matriz de Permissões:**

| Funcionalidade | developer | admin | director | coordinator | auditor | ti | operator |
|----------------|-----------|-------|----------|-------------|---------|----|----|
| Ver Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Importar SIGTAP | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Consultar SIGTAP | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Processar AIH | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dashboard Executivo | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Corpo Médico | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Auditoria AIH | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Cadastrar Pacientes | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Gestão de Usuários | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Ver Todos Hospitais | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Debug/Logs | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

**Regras de Negócio:**
- RN-RBAC-001: Operadores só veem dados dos hospitais em `hospital_access` array
- RN-RBAC-002: Diretores veem TODOS os hospitais automaticamente
- RN-RBAC-003: Auditores têm acesso read-only a todos os dados
- RN-RBAC-004: TI tem acesso técnico mas não pode modificar dados médicos
- RN-RBAC-005: Mudança de role requer logout/login para tomar efeito

---

### 1.2 GESTÃO DE TABELA SIGTAP

#### **F1.2.1 - Importação de Tabela SIGTAP**

**Objetivo:**  
Importar e atualizar a tabela oficial SIGTAP com procedimentos do SUS.

**Formatos Suportados:**

##### **A) Excel (.xlsx, .xls) - RECOMENDADO**
**Método:** Análise estrutural com SheetJS  
**Precisão:** 100% (se estrutura correta)  
**Tempo:** 5-30 segundos  
**Custo:** Gratuito

**Estrutura Esperada:**
```
Colunas obrigatórias:
- CO_PROCEDIMENTO (código)
- NO_PROCEDIMENTO (descrição)
- TP_COMPLEXIDADE (complexidade)
- TP_FINANCIAMENTO (financiamento)
- TP_MODALIDADE (modalidade)
- VL_IDADE_MINIMA / VL_IDADE_MAXIMA
- TP_SEXO
- VL_SH / VL_SP / VL_SA (valores)
- etc. (22 campos no total)
```

**Validações:**
- ✅ Verificar presença de colunas obrigatórias
- ✅ Validar formato de códigos (8 dígitos)
- ✅ Valores numéricos para campos financeiros
- ✅ Códigos CID/CBO em formato válido

---

##### **B) ZIP Oficial (.zip) - DATASUS**
**Método:** Descompactação + análise de arquivos internos  
**Precisão:** 95-98%  
**Tempo:** 30-120 segundos  
**Custo:** Gratuito

**Estrutura ZIP Oficial:**
```
sigtap_[competência].zip
├── TB_PROCEDIMENTO.TXT
├── TB_HABILITACAO.TXT
├── TB_GRUPO.TXT
├── RL_PROCEDIMENTO_CID.TXT
├── RL_PROCEDIMENTO_CBO.TXT
└── ...outros arquivos relacionais
```

**Processo:**
1. Descompactar ZIP em memória
2. Ler arquivo principal (TB_PROCEDIMENTO.TXT)
3. Fazer join com arquivos relacionais (CID, CBO, etc.)
4. Normalizar dados para schema do sistema
5. Inserir em batch no banco

**Regras de Parsing:**
- Encoding: ISO-8859-1 (Latin-1)
- Delimitador: Pipe (|) ou Tab (\t)
- Tratamento de aspas duplas
- Trim de espaços em branco

---

##### **C) PDF (.pdf) - Com IA Gemini**
**Método:** OCR + IA Gemini + Parsing estrutural  
**Precisão:** 85-95% (depende da qualidade do PDF)  
**Tempo:** 5-15 minutos (por documento grande)  
**Custo:** Baixo (API Gemini)

**Fluxo:**
1. Converter PDF para imagens (pdf.js)
2. Extrair texto com OCR
3. Enviar para Gemini AI com prompt estruturado
4. Parser JSON retornado pela IA
5. Validar e corrigir dados
6. Inserir no banco

**Prompt para Gemini:**
```
Você é um extrator de dados especializado em tabelas SIGTAP do SUS.
Analise o texto extraído do PDF e retorne um JSON estruturado com os procedimentos.

Estrutura esperada:
{
  "procedures": [
    {
      "code": "0301010013",
      "description": "CONSULTA MÉDICA EM ATENÇÃO BÁSICA",
      "complexity": "Atenção Básica",
      "modality": "01 - Ambulatorial",
      ...
    }
  ]
}

Instruções:
- Extraia TODOS os procedimentos encontrados
- Mantenha códigos exatamente como aparecem
- Valores monetários em centavos (inteiros)
- Arrays para campos múltiplos (CID, CBO)
```

**Fallbacks:**
- Se IA falhar: tentar extração tradicional (regex patterns)
- Se extração parcial: salvar com flag `extraction_confidence < 100`
- Se erro completo: notificar usuário e sugerir formato alternativo

---

**Fluxo Geral de Importação:**

```
┌─────────────────────────────────────────────────┐
│ 1. UPLOAD                                       │
│    ├── Validar arquivo (tipo, tamanho)         │
│    ├── Upload para Supabase Storage            │
│    └── Criar registro sigtap_versions          │
├─────────────────────────────────────────────────┤
│ 2. EXTRAÇÃO                                     │
│    ├── Detectar formato                         │
│    ├── Aplicar método apropriado               │
│    └── Extrair dados estruturados              │
├─────────────────────────────────────────────────┤
│ 3. VALIDAÇÃO                                    │
│    ├── Validar estrutura de dados              │
│    ├── Verificar códigos duplicados            │
│    ├── Validar ranges (idade, valores)         │
│    └── Flaggar inconsistências                 │
├─────────────────────────────────────────────────┤
│ 4. PERSISTÊNCIA (TRANSAÇÃO ATÔMICA)            │
│    ├── Iniciar transação                       │
│    ├── Inserir versão SIGTAP                   │
│    ├── Batch insert procedimentos (chunks)     │
│    ├── Atualizar estatísticas                  │
│    ├── Marcar versão como ativa               │
│    └── Commit ou Rollback                      │
├─────────────────────────────────────────────────┤
│ 5. PÓS-PROCESSAMENTO                           │
│    ├── Reindexar tabelas                       │
│    ├── Atualizar cache                         │
│    ├── Gerar relatório de importação          │
│    └── Notificar usuário (sucesso/erros)      │
└─────────────────────────────────────────────────┘
```

**Regras de Negócio:**
- RN-SIGTAP-001: Apenas uma versão pode estar ativa por vez
- RN-SIGTAP-002: Importação nova desativa versão anterior automaticamente
- RN-SIGTAP-003: Versões antigas mantidas para rollback (histórico)
- RN-SIGTAP-004: Procedimentos duplicados (mesmo código) são atualizados
- RN-SIGTAP-005: Importação é transacional (tudo ou nada)
- RN-SIGTAP-006: Log completo de importação salvo em audit_logs

**Validações Críticas:**
```typescript
// Validação de código de procedimento
const isValidProcedureCode = (code: string): boolean => {
  return /^\d{10}$/.test(code); // Exatamente 10 dígitos
};

// Validação de valores monetários
const isValidMonetaryValue = (value: any): boolean => {
  return Number.isInteger(value) && value >= 0 && value <= 999999999;
};

// Validação de gênero
const isValidGender = (gender: string): boolean => {
  return ['M', 'F', 'AMBOS', null].includes(gender);
};

// Validação de faixa etária
const isValidAgeRange = (min: number, max: number, minUnit: string, maxUnit: string): boolean => {
  if (!min || !max) return true; // Pode não ter restrição
  const minDays = convertToDays(min, minUnit);
  const maxDays = convertToDays(max, maxUnit);
  return minDays <= maxDays;
};
```

---

#### **F1.2.2 - Consulta de Procedimentos SIGTAP**

**Objetivo:**  
Buscar e visualizar procedimentos da tabela SIGTAP ativa.

**Tipos de Busca:**

##### **1. Busca Livre (Full-Text Search)**
```sql
-- Query otimizada com GIN index
SELECT * FROM sigtap_procedures
WHERE version_id = $activeVersionId
AND (
  code ILIKE '%' || $searchTerm || '%'
  OR description ILIKE '%' || $searchTerm || '%'
  OR to_tsvector('portuguese', description) @@ plainto_tsquery('portuguese', $searchTerm)
)
ORDER BY 
  CASE WHEN code = $searchTerm THEN 1 ELSE 2 END,
  description
LIMIT 50;
```

**Exemplos:**
- Busca por código: `"0301010013"` → Encontra procedimento exato
- Busca por texto: `"consulta médica"` → Lista todos procedimentos com esses termos
- Busca parcial: `"030101"` → Todos procedimentos do grupo 030101

##### **2. Filtros Avançados**

| Filtro | Tipo | Valores | Query |
|--------|------|---------|-------|
| **Modalidade** | Select | 01-Amb, 02-Hosp, etc. | `modality = $value` |
| **Complexidade** | Select | Atenção Básica, Média, Alta | `complexity = $value` |
| **Financiamento** | Select | MAC, FAEC, etc. | `financing = $value` |
| **Gênero** | Select | M, F, AMBOS | `gender = $value OR gender IS NULL` |
| **Habilitação** | Text | Código de habilitação | `habilitation LIKE '%' || $value || '%'` |
| **Valor Mínimo** | Number | R$ X | `value_hosp >= $valueInCents` |
| **Valor Máximo** | Number | R$ Y | `value_hosp <= $valueInCents` |

**Filtros Combinados (AND):**
```typescript
// Exemplo: Procedimentos hospitalares de alta complexidade para mulheres
const filters = {
  modality: '02',
  complexity: 'Alta Complexidade',
  gender: 'F',
  minValue: 50000 // R$ 500,00 em centavos
};

// Query gerada:
SELECT * FROM sigtap_procedures
WHERE version_id = $activeVersion
  AND modality = '02'
  AND complexity = 'Alta Complexidade'
  AND (gender = 'F' OR gender = 'AMBOS')
  AND value_hosp >= 50000
ORDER BY description
LIMIT 50 OFFSET $pageOffset;
```

**Paginação:**
- **Padrão:** 10 resultados por página
- **Opções:** 10, 25, 50, 100
- **Server-side:** Query com LIMIT/OFFSET
- **Total Count:** Query separada para total

**Exportação:**
- **Formato:** Excel (.xlsx)
- **Conteúdo:** Resultados filtrados (máximo 10.000 registros)
- **Colunas:** Todas as colunas da tabela
- **Nome arquivo:** `sigtap_export_[data]_[hora].xlsx`

---

### 1.3 PROCESSAMENTO DE AIHs

#### **F1.3.1 - Upload e Extração de AIHs**

**Objetivo:**  
Extrair dados de AIHs de documentos em múltiplos formatos.

**Formatos Aceitos:**

##### **A) Excel (.xlsx, .xls)**

**Estrutura Esperada:**
```
Planilha: AIHs ou Sheet1
Colunas (flexível, detecção automática):
- Nome / Paciente / Nome do Paciente
- CNS / Cartão SUS / CNS Paciente
- Data Nascimento / Nascimento / Data Nasc
- Sexo / Gênero / M/F
- Número AIH / AIH / Número
- Procedimento / Código Procedimento / Cód Proc
- Data Internação / Admissão / Data Entrada
- Data Alta / Saída / Data Saída
- CID Principal / CID / Diagnóstico
- CID Secundário / CIDs Secundários
- Profissional / Médico / CBO
```

**Detecção de Colunas:**
```typescript
const detectColumns = (headers: string[]): ColumnMapping => {
  const mapping: ColumnMapping = {};
  
  headers.forEach((header, index) => {
    const normalized = header.toLowerCase().trim();
    
    // Nome do paciente
    if (/(nome|paciente)/.test(normalized)) {
      mapping.patient_name = index;
    }
    // CNS
    if (/cns|cartão/.test(normalized)) {
      mapping.cns = index;
    }
    // Data de nascimento
    if (/(nascimento|nasc|data.*nasc)/.test(normalized)) {
      mapping.birth_date = index;
    }
    // Sexo/Gênero
    if (/(sexo|gênero|genero)/.test(normalized)) {
      mapping.gender = index;
    }
    // Número da AIH
    if (/(aih|número|numero)/.test(normalized)) {
      mapping.aih_number = index;
    }
    // Procedimento
    if (/(procedimento|proc|código)/.test(normalized)) {
      mapping.procedure_code = index;
    }
    // Etc...
  });
  
  return mapping;
};
```

**Validação de Dados Extraídos:**
```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  confidence: number; // 0-100
}

const validateExtractedAIH = (aih: ExtractedAIH): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validações obrigatórias (erros)
  if (!aih.patient_name || aih.patient_name.length < 3) {
    errors.push('Nome do paciente inválido ou ausente');
  }
  
  if (!isValidCNS(aih.cns)) {
    errors.push('CNS inválido ou ausente');
  }
  
  if (!aih.birth_date || !isValidDate(aih.birth_date)) {
    errors.push('Data de nascimento inválida');
  }
  
  if (!['M', 'F'].includes(aih.gender)) {
    errors.push('Gênero inválido (deve ser M ou F)');
  }
  
  if (!aih.procedure_code || !isValidProcedureCode(aih.procedure_code)) {
    errors.push('Código de procedimento inválido');
  }
  
  // Validações opcionais (warnings)
  if (!aih.aih_number) {
    warnings.push('Número da AIH ausente');
  }
  
  if (!aih.admission_date) {
    warnings.push('Data de internação ausente');
  }
  
  if (!aih.main_cid) {
    warnings.push('CID principal ausente');
  }
  
  // Calcular confiança
  const totalFields = 12;
  const filledFields = Object.values(aih).filter(v => v !== null && v !== '').length;
  const confidence = Math.round((filledFields / totalFields) * 100);
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    confidence
  };
};
```

---

##### **B) PDF (.pdf) - Com IA**

**Estratégia Híbrida:**
1. **PDF Estruturado (com texto):**
   - Extração de texto com pdf.js
   - Parsing com regex patterns
   - Fallback para IA se regex falhar

2. **PDF Escaneado (imagem):**
   - OCR com pdf.js
   - Envio para Gemini AI
   - Parsing do JSON retornado

**Prompt Otimizado para Gemini:**
```
Você é um extrator de dados médicos especializado em AIHs (Autorizações de Internação Hospitalar) do SUS.

TAREFA: Extraia os dados de todas as AIHs presentes neste documento.

FORMATO DE SAÍDA (JSON):
{
  "aihs": [
    {
      "patient": {
        "name": "NOME COMPLETO",
        "cns": "123456789012345",
        "birth_date": "YYYY-MM-DD",
        "gender": "M" ou "F",
        "mother_name": "NOME DA MÃE (se disponível)"
      },
      "aih": {
        "number": "1234567890123",
        "procedure_code": "0301010013",
        "admission_date": "YYYY-MM-DD",
        "discharge_date": "YYYY-MM-DD",
        "main_cid": "A00",
        "secondary_cid": ["A01", "A02"],
        "professional_cbo": "225125",
        "requesting_physician": "Nome do médico"
      }
    }
  ],
  "metadata": {
    "total_aihs": 26,
    "confidence": 95,
    "extraction_notes": "Observações gerais"
  }
}

REGRAS:
1. Extraia TODAS as AIHs encontradas no documento
2. Use formato ISO 8601 para datas (YYYY-MM-DD)
3. CNS: exatamente 15 dígitos numéricos
4. Gênero: apenas "M" ou "F"
5. Códigos de procedimento: exatamente 10 dígitos
6. CIDs: formato padrão (letra + 2 dígitos + opcional ponto + dígito)
7. Se um campo não estiver presente, use null
8. Indique sua confiança (0-100) na extração de cada AIH

IMPORTANTE:
- Seja preciso e completo
- Se houver dúvida, indique no campo de confiança
- Mantenha a ordem das AIHs como aparecem no documento
```

**Tratamento de Resposta da IA:**
```typescript
const parseGeminiResponse = async (response: string): Promise<ExtractedAIHBatch> => {
  try {
    // Limpar markdown se presente
    const cleanedResponse = response.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    
    // Parser JSON
    const data = JSON.parse(cleanedResponse);
    
    // Validar estrutura
    if (!data.aihs || !Array.isArray(data.aihs)) {
      throw new Error('Resposta da IA em formato inválido');
    }
    
    // Validar cada AIH
    const validatedAIHs = data.aihs.map((aih: any) => {
      return {
        ...aih,
        validation: validateExtractedAIH({
          patient_name: aih.patient.name,
          cns: aih.patient.cns,
          birth_date: aih.patient.birth_date,
          gender: aih.patient.gender,
          aih_number: aih.aih.number,
          procedure_code: aih.aih.procedure_code,
          // ... outros campos
        })
      };
    });
    
    return {
      aihs: validatedAIHs,
      metadata: data.metadata,
      extraction_method: 'gemini',
      extraction_timestamp: new Date()
    };
    
  } catch (error) {
    console.error('Erro ao parser resposta Gemini:', error);
    throw new Error('Falha ao processar resposta da IA');
  }
};
```

---

##### **C) ZIP Oficial DATASUS**

**Estrutura ZIP AIH:**
```
aih_[competência].zip
├── AIH_[mes]_[ano].txt       (Dados principais das AIHs)
├── PAC_[mes]_[ano].txt       (Dados dos pacientes)
├── PROC_[mes]_[ano].txt      (Procedimentos realizados)
└── ... (outros arquivos complementares)
```

**Processo de Extração:**
1. Descompactar ZIP
2. Identificar arquivos por padrão de nome
3. Ler arquivo principal (AIH_*.txt)
4. Fazer join com arquivo de pacientes (PAC_*.txt)
5. Fazer join com procedimentos (PROC_*.txt)
6. Normalizar dados para schema do sistema

**Especificações do Formato:**
- **Encoding:** ISO-8859-1
- **Delimitador:** Posição fixa ou delimitado por pipe (|)
- **Registros:** Um por linha
- **Campos:** Conforme layout oficial DATASUS

**Mapeamento de Campos (Layout DATASUS → Schema Sistema):**
```typescript
const mapDATASUStoSchema = (dataSUSRecord: any): ExtractedAIH => {
  return {
    patient_name: dataSUSRecord.NM_PACIENTE?.trim(),
    cns: dataSUSRecord.CNS_PACIENTE?.trim(),
    birth_date: parseDateDATASUS(dataSUSRecord.DT_NASCIMENTO),
    gender: dataSUSRecord.SEXO === '1' ? 'M' : 'F',
    aih_number: dataSUSRecord.NR_AIH?.trim(),
    procedure_code: dataSUSRecord.CD_PROCEDIMENTO?.trim(),
    admission_date: parseDateDATASUS(dataSUSRecord.DT_INTERNACAO),
    discharge_date: parseDateDATASUS(dataSUSRecord.DT_ALTA),
    main_cid: dataSUSRecord.CD_CID_PRINCIPAL?.trim(),
    secondary_cid: [
      dataSUSRecord.CD_CID_SECUNDARIO_1,
      dataSUSRecord.CD_CID_SECUNDARIO_2,
      // ...
    ].filter(Boolean),
    professional_cbo: dataSUSRecord.CD_CBO?.trim(),
    // ... outros campos
  };
};
```

---

#### **F1.3.2 - Matching Inteligente de Procedimentos**

**Objetivo:**  
Encontrar o procedimento SIGTAP correspondente para cada AIH extraída, aplicando validações e cálculo de score.

**Algoritmo de Matching:**

```typescript
interface MatchingCriteria {
  procedure_code: string;        // Código extraído da AIH
  patient_gender: 'M' | 'F';    // Gênero do paciente
  patient_age_days: number;      // Idade em dias
  main_cid: string;              // CID principal
  hospital_habilitacoes: string[]; // Habilitações do hospital
  professional_cbo?: string;     // CBO do profissional
}

interface MatchResult {
  procedure_id: string;
  confidence_score: number;      // 0-100
  validations: {
    code_match: boolean;         // Código exato
    gender_valid: boolean;       // Gênero compatível
    age_valid: boolean;          // Idade na faixa
    cid_valid: boolean;          // CID permitido
    habilitation_valid: boolean; // Hospital habilitado
    cbo_valid: boolean;          // CBO permitido
  };
  calculated_values: {
    value_amb: number;
    value_hosp: number;
    value_prof: number;
    value_total: number;
  };
  status: 'approved' | 'manual_review' | 'rejected';
  rejection_reasons?: string[];
}

const performMatching = async (
  criteria: MatchingCriteria
): Promise<MatchResult[]> => {
  // 1. Buscar procedimento por código exato
  const exactMatch = await supabase
    .from('sigtap_procedures')
    .select('*')
    .eq('code', criteria.procedure_code)
    .eq('version_id', activeVersionId)
    .single();
  
  if (!exactMatch.data) {
    // Se não encontrar código exato, buscar similares
    const similarMatches = await findSimilarProcedures(criteria.procedure_code);
    return similarMatches.map(proc => calculateMatch(proc, criteria));
  }
  
  // 2. Calcular score do match exato
  return [calculateMatch(exactMatch.data, criteria)];
};

const calculateMatch = (
  procedure: SigtapProcedure,
  criteria: MatchingCriteria
): MatchResult => {
  const validations = {
    code_match: procedure.code === criteria.procedure_code,
    gender_valid: validateGender(procedure, criteria),
    age_valid: validateAge(procedure, criteria),
    cid_valid: validateCID(procedure, criteria),
    habilitation_valid: validateHabilitation(procedure, criteria),
    cbo_valid: validateCBO(procedure, criteria)
  };
  
  // Cálculo do score ponderado
  const weights = {
    code_match: 100,        // Match exato = 100 pontos
    gender_valid: 20,
    age_valid: 25,
    cid_valid: 30,
    habilitation_valid: 15,
    cbo_valid: 10
  };
  
  let score = 0;
  let maxScore = 100; // Começa com 100 do code_match
  
  if (validations.code_match) {
    score += weights.code_match;
    
    // Validações adicionais
    if (validations.gender_valid) score += weights.gender_valid;
    else maxScore += weights.gender_valid; // Adiciona ao max só se falhou
    
    if (validations.age_valid) score += weights.age_valid;
    else maxScore += weights.age_valid;
    
    if (validations.cid_valid) score += weights.cid_valid;
    else maxScore += weights.cid_valid;
    
    if (validations.habilitation_valid) score += weights.habilitation_valid;
    else maxScore += weights.habilitation_valid;
    
    if (validations.cbo_valid) score += weights.cbo_valid;
    else maxScore += weights.cbo_valid;
  }
  
  // Normalizar score para 0-100
  const confidence_score = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  
  // Determinar status baseado no score
  let status: 'approved' | 'manual_review' | 'rejected';
  let rejection_reasons: string[] = [];
  
  if (confidence_score >= 80) {
    status = 'approved';
  } else if (confidence_score >= 50) {
    status = 'manual_review';
  } else {
    status = 'rejected';
    // Coletar razões de rejeição
    if (!validations.gender_valid) {
      rejection_reasons.push('Gênero incompatível com procedimento');
    }
    if (!validations.age_valid) {
      rejection_reasons.push('Idade fora da faixa permitida');
    }
    if (!validations.cid_valid) {
      rejection_reasons.push('CID não permitido para este procedimento');
    }
    if (!validations.habilitation_valid) {
      rejection_reasons.push('Hospital não habilitado para este procedimento');
    }
    if (!validations.cbo_valid) {
      rejection_reasons.push('CBO do profissional incompatível');
    }
  }
  
  return {
    procedure_id: procedure.id,
    confidence_score,
    validations,
    calculated_values: calculateProcedureValues(procedure, criteria),
    status,
    rejection_reasons: status === 'rejected' ? rejection_reasons : undefined
  };
};
```

**Validações Específicas:**

##### **1. Validação de Gênero**
```typescript
const validateGender = (
  procedure: SigtapProcedure,
  criteria: MatchingCriteria
): boolean => {
  // Se procedimento não tem restrição de gênero, sempre válido
  if (!procedure.gender || procedure.gender === 'AMBOS') {
    return true;
  }
  
  // Verificar compatibilidade
  return procedure.gender === criteria.patient_gender;
};
```

##### **2. Validação de Idade**
```typescript
const convertAgeToDays = (value: number, unit: string): number => {
  switch (unit.toUpperCase()) {
    case 'DIAS': return value;
    case 'MESES': return value * 30;
    case 'ANOS': return value * 365;
    default: return value;
  }
};

const validateAge = (
  procedure: SigtapProcedure,
  criteria: MatchingCriteria
): boolean => {
  const patientAgeDays = criteria.patient_age_days;
  
  // Se não há restrição de idade, sempre válido
  if (!procedure.min_age && !procedure.max_age) {
    return true;
  }
  
  // Converter idades do procedimento para dias
  const minAgeDays = procedure.min_age 
    ? convertAgeToDays(procedure.min_age, procedure.min_age_unit)
    : 0;
  
  const maxAgeDays = procedure.max_age
    ? convertAgeToDays(procedure.max_age, procedure.max_age_unit)
    : Infinity;
  
  // Verificar se idade do paciente está no range
  return patientAgeDays >= minAgeDays && patientAgeDays <= maxAgeDays;
};
```

##### **3. Validação de CID**
```typescript
const validateCID = (
  procedure: SigtapProcedure,
  criteria: MatchingCriteria
): boolean => {
  // Se procedimento não tem lista de CIDs permitidos, sempre válido
  if (!procedure.cid || procedure.cid.length === 0) {
    return true;
  }
  
  // Verificar se CID principal está na lista
  const mainCidAllowed = procedure.cid.some(allowedCid => {
    // Pode ser código exato ou range (ex: A00-A09)
    if (allowedCid.includes('-')) {
      const [start, end] = allowedCid.split('-');
      return criteria.main_cid >= start && criteria.main_cid <= end;
    }
    return allowedCid === criteria.main_cid;
  });
  
  return mainCidAllowed;
};
```

##### **4. Validação de Habilitação**
```typescript
const validateHabilitation = (
  procedure: SigtapProcedure,
  criteria: MatchingCriteria
): boolean => {
  // Se procedimento não requer habilitação, sempre válido
  if (!procedure.habilitation && (!procedure.habilitation_group || procedure.habilitation_group.length === 0)) {
    return true;
  }
  
  // Verificar se hospital tem habilitação necessária
  const hasRequiredHabilitation = criteria.hospital_habilitacoes.some(hab => {
    // Verificar habilitação específica
    if (procedure.habilitation && hab === procedure.habilitation) {
      return true;
    }
    
    // Verificar grupo de habilitações
    if (procedure.habilitation_group && procedure.habilitation_group.includes(hab)) {
      return true;
    }
    
    return false;
  });
  
  return hasRequiredHabilitation;
};
```

##### **5. Validação de CBO**
```typescript
const validateCBO = (
  procedure: SigtapProcedure,
  criteria: MatchingCriteria
): boolean => {
  // Se procedimento não tem lista de CBOs, sempre válido
  if (!procedure.cbo || procedure.cbo.length === 0) {
    return true;
  }
  
  // Se AIH não tem CBO, considerar warning mas não inválido
  if (!criteria.professional_cbo) {
    return true; // Neutro
  }
  
  // Verificar se CBO está na lista permitida
  return procedure.cbo.includes(criteria.professional_cbo);
};
```

---

#### **F1.3.3 - Cálculo de Valores (Regras SUS)**

**Objetivo:**  
Calcular valores corretos conforme regras SUS (SH, SP, SA).

**Componentes do Valor:**
- **SH (Serviço Hospitalar):** Custos hospitalares (diárias, materiais, etc.)
- **SP (Serviço Profissional):** Honorários médicos
- **SA (Serviço Ambulatorial):** Procedimentos ambulatoriais
- **Anestesia:** Valor separado para procedimentos anestésicos

**Regra Geral:**
```
Valor Total AIH = SH + SP + (SA se aplicável) + (Anestesia se aplicável)
```

**Implementação:**

```typescript
interface ProcedureValues {
  value_sh: number;    // Serviço Hospitalar
  value_sp: number;    // Serviço Profissional
  value_sa: number;    // Serviço Ambulatorial
  value_total: number; // Total calculado
}

const calculateProcedureValues = (
  procedure: SigtapProcedure,
  criteria: MatchingCriteria
): ProcedureValues => {
  let value_sh = procedure.value_hosp || 0;
  let value_sp = procedure.value_prof || 0;
  let value_sa = procedure.value_amb || 0;
  
  // Regra: Procedimento ambulatorial não tem SH
  if (procedure.modality?.includes('Ambulatorial') || procedure.modality === '01') {
    value_sh = 0;
    value_sp = value_sa; // Em ambulatorial, SP = SA
  }
  
  // Regra: Procedimento hospitalar tem SH + SP
  if (procedure.modality?.includes('Hospitalar') || procedure.modality === '02') {
    value_sa = 0;
  }
  
  // Calcular total
  const value_total = value_sh + value_sp + value_sa;
  
  return {
    value_sh,
    value_sp,
    value_sa,
    value_total
  };
};
```

**Regras Especiais:**

##### **Cirurgias Múltiplas**
```typescript
// RN-SUS-001: Cirurgias no mesmo ato cirúrgico têm valor reduzido
const calculateMultipleSurgeries = (procedures: SigtapProcedure[]): number => {
  if (procedures.length <= 1) {
    return procedures[0]?.value_hosp || 0;
  }
  
  // Ordenar por valor (maior para menor)
  const sorted = [...procedures].sort((a, b) => b.value_hosp - a.value_hosp);
  
  // Primeira cirurgia: 100% do valor
  let total = sorted[0].value_hosp;
  
  // Segunda cirurgia: 70% do valor
  if (sorted[1]) {
    total += sorted[1].value_hosp * 0.70;
  }
  
  // Demais cirurgias: 50% do valor
  for (let i = 2; i < sorted.length; i++) {
    total += sorted[i].value_hosp * 0.50;
  }
  
  return Math.round(total);
};
```

##### **Procedimentos com Permanência (Diárias)**
```typescript
// RN-SUS-002: Algumas cirurgias têm valor adicional por permanência
const calculateStayValue = (
  procedure: SigtapProcedure,
  stayDays: number
): number => {
  // Usar média de permanência como referência
  const expectedStay = procedure.average_stay || 0;
  
  if (stayDays <= expectedStay) {
    // Dentro do esperado: valor padrão
    return procedure.value_hosp;
  }
  
  // Permanência acima do esperado: acréscimo proporcional
  const extraDays = stayDays - expectedStay;
  const dailyValue = procedure.value_hosp / expectedStay;
  const extraValue = dailyValue * extraDays * 0.5; // 50% do valor diário
  
  return Math.round(procedure.value_hosp + extraValue);
};
```

##### **Anestesia**
```typescript
// RN-SUS-003: Procedimentos cirúrgicos incluem anestesia
const calculateAnesthesiaValue = (
  mainProcedure: SigtapProcedure,
  anesthesiaType: 'local' | 'regional' | 'geral'
): number => {
  // Código de anestesia conforme tipo
  const anesthesiaCodes = {
    local: '0407010017',     // Anestesia local
    regional: '0407010025',  // Anestesia regional
    geral: '0407010033'      // Anestesia geral
  };
  
  // Buscar procedimento de anestesia
  const anesthesiaProcedure = findProcedure(anesthesiaCodes[anesthesiaType]);
  
  if (!anesthesiaProcedure) return 0;
  
  // Valor da anestesia = SP do procedimento anestésico
  return anesthesiaProcedure.value_prof || 0;
};
```

---

## 2. FUNCIONALIDADES SECUNDÁRIAS

### 2.1 GESTÃO DE PACIENTES

#### **F2.1.1 - Cadastro de Paciente**

**Campos:**
```typescript
interface Patient {
  // Dados pessoais obrigatórios
  name: string;                  // Nome completo
  cns: string;                   // CNS (15 dígitos)
  birth_date: Date;              // Data de nascimento
  gender: 'M' | 'F';            // Gênero
  
  // Dados pessoais opcionais
  cpf?: string;                  // CPF (11 dígitos)
  mother_name?: string;          // Nome da mãe
  medical_record?: string;       // Prontuário interno
  
  // Contato
  phone?: string;
  email?: string;
  
  // Endereço
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  
  // Dados clínicos
  blood_type?: string;           // A+, A-, B+, B-, AB+, AB-, O+, O-
  allergies?: string;            // Texto livre
  medical_notes?: string;        // Observações clínicas
  
  // Metadados
  hospital_id: string;           // Hospital do cadastro
  is_active: boolean;            // Status
  created_at: Date;
  updated_at: Date;
}
```

**Validações:**
```typescript
// Validação de CNS (Cartão Nacional de Saúde)
const isValidCNS = (cns: string): boolean => {
  // Remove caracteres não numéricos
  const cleanCNS = cns.replace(/\D/g, '');
  
  // Deve ter exatamente 15 dígitos
  if (cleanCNS.length !== 15) return false;
  
  // CNS definitivo começa com 1 ou 2
  // CNS provisório começa com 7, 8 ou 9
  const firstDigit = parseInt(cleanCNS[0]);
  if (![1, 2, 7, 8, 9].includes(firstDigit)) return false;
  
  // Validação do dígito verificador (algoritmo oficial)
  if (firstDigit === 1 || firstDigit === 2) {
    return validateDefinitiveCNS(cleanCNS);
  } else {
    return validateProvisionalCNS(cleanCNS);
  }
};

// Algoritmo de validação de CNS definitivo
const validateDefinitiveCNS = (cns: string): boolean => {
  const pis = cns.substring(0, 11);
  const sum = pis.split('').reduce((acc, digit, index) => {
    return acc + parseInt(digit) * (15 - index);
  }, 0);
  
  let dv = 11 - (sum % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) {
    // Recalcular com nova soma
    const newSum = sum + 2;
    dv = 11 - (newSum % 11);
  }
  
  const calculatedCNS = pis + dv.toString().padStart(4, '0');
  return calculatedCNS === cns;
};
```

**Regras de Negócio:**
- RN-PAC-001: CNS deve ser único por hospital
- RN-PAC-002: Nome deve ter pelo menos 3 caracteres
- RN-PAC-003: Data de nascimento não pode ser futura
- RN-PAC-004: Gênero obrigatório (M ou F)
- RN-PAC-005: Paciente inativo não pode ter novas AIHs

---

### 2.2 RELATÓRIOS E EXPORTS

#### **F2.2.1 - Exportação Excel**

**Funcionalidade:**
Exportar dados visíveis em Excel para análise offline.

**Implementação:**
```typescript
import * as XLSX from 'xlsx';

const exportToExcel = (data: any[], filename: string) => {
  // Criar workbook
  const wb = XLSX.utils.book_new();
  
  // Converter dados para worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  
  // Adicionar worksheet ao workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  
  // Gerar buffer
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  
  // Criar blob e download
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
};
```

---

## 3. REGRAS DE NEGÓCIO SUS

### 3.1 REGRAS DE FATURAMENTO

**RN-SUS-001:** Cirurgias múltiplas no mesmo ato cirúrgico  
**RN-SUS-002:** Valor adicional por permanência acima da média  
**RN-SUS-003:** Inclusão de anestesia em procedimentos cirúrgicos  
**RN-SUS-004:** Limite de quantidade por competência  
**RN-SUS-005:** Procedimentos ambulatoriais não têm SH  

### 3.2 REGRAS DE COMPATIBILIDADE

**RN-COMP-001:** Gênero do paciente × restrição do procedimento  
**RN-COMP-002:** Idade do paciente × faixa etária permitida  
**RN-COMP-003:** CID principal × CIDs permitidos no procedimento  
**RN-COMP-004:** Hospital × habilitações necessárias  
**RN-COMP-005:** Profissional × CBOs compatíveis  

---

**© 2025 SIGTAP Sync - Mapeamento de Funcionalidades e Regras de Negócio**  
*Versão 1.0 - Completo e Validado*

