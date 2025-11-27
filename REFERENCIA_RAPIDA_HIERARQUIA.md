# ⚡ **REFERÊNCIA RÁPIDA - HIERARQUIA MÉDICOS → PACIENTES → PROCEDIMENTOS**

## 🎯 **GUIA ULTRA-RÁPIDO**

---

## 📊 **NÍVEL 1: CARD DO MÉDICO**

| Campo Exibido | Origem | Cálculo | Exemplo |
|---------------|--------|---------|---------|
| **Nome** | `doctors.name` | Direto | "HUMBERTO MOREIRA DA SILVA" |
| **CNS** | `doctors.cns` | Direto | "707000845390335" |
| **CRM** | `doctors.crm` | Direto | "PR-12345" |
| **Especialidade** | `doctors.specialty` | Direto | "Cirurgião Cardiovascular" |
| **Pacientes** | `patients.length` | Count | 45 |
| **Procedimentos** | `Σ procedures` | Soma filtrada | 234 (sem anestesia 04.xxx) |
| **Aprovação %** | `approved / total` | % | 95% |
| **Ticket Médio** | `totalValue / totalAIHs` | Divisão | R$ 5.200,00 |
| **Valor Total** | `Σ patient.total_value_reais` | Soma | R$ 234.000,00 |
| **Incremento OP** | `computeIncrementForProcedures()` | Função | R$ 187.200,00 (+80%) |
| **Pagamento Médico** | `calculateDoctorPayment()` | Função | R$ 29.250,00 |
| **⚠️ Sem Repasse** | `countPatientsWithoutPayment()` | Validação | 3 pacientes |

### **Fonte de Dados:**
```sql
FROM: aihs
JOIN: patients (via patient_id)
JOIN: procedure_records (via aih_id)
JOIN: doctors (via cns_responsavel)
```

---

## 👥 **NÍVEL 2: CARD DO PACIENTE**

| Campo Exibido | Origem | Cálculo | Exemplo |
|---------------|--------|---------|---------|
| **Nome** | `patients.name` | Direto | "CLEUZA APARECIDA DOS SANTOS" |
| **CNS** | `patients.cns` | Direto | "898001234567890" |
| **Prontuário** | `patients.medical_record` | Direto | "PRO123456" |
| **AIH** | `aihs.aih_number` | Direto | "3524100001234567" |
| **Admissão** | `aihs.admission_date` | Direto | "15/11/2024" |
| **Alta** | `aihs.discharge_date` | Direto | "20/11/2024" |
| **Competência** | `aihs.competencia` | Direto | "2024-11" |
| **Caráter** | `aihs.care_character` | Mapeado | "01 - ELETIVO" ou "02 - URGÊNCIA" |
| **Pgt. Adm** | `aihs.pgt_adm` | Direto | "sim" ou "não" |
| **Nome Comum** | `common_name` | Derivado | "A+A", "C+H", etc. |
| **AIH Seca** | `Σ procedures.value_reais` | Soma | R$ 15.234,50 |
| **Incremento OP** | `computeIncrementForProcedures()` | Função | R$ 12.187,60 (+80%) |
| **C/ Opera Paraná** | `aihSeca + incremento` | Soma | R$ 27.422,10 |
| **Repasse Médico** | `calculateDoctorPayment()` | Função | R$ 900,00 |
| **Procedimentos** | `procedures.length` | Count | 5 procedimentos |

### **Fonte de Dados:**
```sql
FROM: procedure_records
WHERE: aih_id = patient.aih_id
```

---

## 🩺 **NÍVEL 3: CARD DO PROCEDIMENTO**

| Campo Exibido | Origem | Cálculo | Exemplo |
|---------------|--------|---------|---------|
| **Sequência** | `procedure_records.sequencia` | Direto | 1, 2, 3... |
| **Código** | `procedure_records.procedure_code` | Direto | "04.05.01.001-0" |
| **Descrição** | `procedure_records.procedure_description` | Direto | "REVASCULARIZAÇÃO DO MIOCÁRDIO" |
| **Descrição SIGTAP** | `sigtap_procedures.description` | Join | Descrição completa |
| **Data** | `procedure_records.procedure_date` | Direto | "16/11/2024" |
| **Valor** | `procedure_records.total_value / 100` | Conversão | R$ 12.450,50 |
| **Profissional** | `procedure_records.professional_name` | Direto | "DR. HUMBERTO MOREIRA" |
| **CBO** | `procedure_records.professional_cbo` | Direto | "225125" |
| **Participação** | `procedure_records.participation` | Mapeado | "12 - Responsável" |
| **Instrumento** | `sigtap_procedures.registration_instrument` | Join | "04 - AIH" |
| **Complexidade** | `sigtap_procedures.complexity` | Join | "Alta complexidade" |
| **Incremento OP** | `value × 0.80` (se elegível) | Cálculo | +R$ 9.960,40 (+80%) |
| **Match %** | `procedure_records.match_confidence × 100` | Conversão | 95% |
| **Status** | `procedure_records.approved` | Mapeado | ✅ Aprovado |

### **Fonte de Dados:**
```sql
FROM: procedure_records
LEFT JOIN: sigtap_procedures (via procedure_code)
WHERE: aih_id = patient.aih_id
ORDER BY: sequencia ASC
```

---

## 🔍 **FILTROS DISPONÍVEIS**

| Filtro | Aplicação | SQL/Memória | Impacto |
|--------|-----------|-------------|---------|
| **Competência** | `aihs.competencia = ?` | SQL | Recarrega dados |
| **Hospital** | `aihs.hospital_id IN (?)` | SQL | Recarrega dados |
| **Pgt. Adm** | `aihs.pgt_adm = ?` | SQL | Recarrega dados |
| **Busca Médico** | `name LIKE %?%` | Memória | Filtra lista |
| **Busca Paciente** | `name LIKE %?%` | Memória | Filtra pacientes |

---

## 💰 **CÁLCULOS PRINCIPAIS**

### **1. AIH Seca (Base)**
```javascript
aihSeca = Σ procedures.value_reais
```

### **2. Incremento Opera Paraná**
```javascript
IF isDoctorCovered(doctorName) AND 
   !hasExcludedProcedures(procedures) THEN:
   
   IF careCharacter === '1': // Eletivo
      increment = aihSeca × 0.80 (+80%)
   
   IF careCharacter === '2': // Urgência
      increment = aihSeca × 0.60 (+60%)
ELSE:
   increment = 0
```

### **3. Total c/ Opera Paraná**
```javascript
totalOP = aihSeca + increment
```

### **4. Repasse Médico**
```javascript
// TIPO 1: Fixo Mensal (não multiplica)
IF hasFixedRule AND isMonthlyFixed:
   repasse = R$ 47.000 (uma vez)

// TIPO 2: Fixo Por Paciente (multiplica)
ELSE IF hasFixedRule AND !isMonthlyFixed:
   repasse = R$ 450 × numberOfPatients

// TIPO 3: Percentual
ELSE IF hasPercentageRule:
   repasse = totalValue × (percentage / 100)

// TIPO 4: Regras Individuais
ELSE:
   repasse = Σ (procedureValue por regra específica)
```

---

## 🎨 **CÓDIGOS DE CORES**

| Elemento | Cor | Significado |
|----------|-----|-------------|
| **Procedimento Principal** | 🟢 Verde | Primeiro procedimento da AIH |
| **Procedimento Secundário** | ⚪ Cinza | 2º, 3º, etc. |
| **Caráter Eletivo** | 🔵 Azul | "01 - ELETIVO" |
| **Caráter Urgência** | 🔴 Vermelho | "02 - URGÊNCIA" |
| **Com Incremento OP** | 💙 Azul/Anel | Destaque com ring |
| **Pgt. Administrativo** | 🟢 Verde | Badge verde |
| **Sem Repasse** | 🟡 Amarelo | Alerta amarelo |
| **Anestesista 04.xxx** | ⚫ Cinza Escuro | Valor zerado |

---

## 📋 **TABELAS UTILIZADAS (4)**

| Tabela | Campos Usados | Join | Propósito |
|--------|---------------|------|-----------|
| `aihs` | aih_number, patient_id, cns_responsavel, competencia, care_character, pgt_adm | - | Base da hierarquia |
| `patients` | name, cns, birth_date, gender, medical_record | `aihs.patient_id` | Dados do paciente |
| `procedure_records` | procedure_code, sequencia, quantity, value, professional_cbo, participation | `aihs.id` | Lista de procedimentos |
| `doctors` | name, cns, crm, specialty | `aihs.cns_responsavel` | Dados do médico |

---

## 🔢 **REGRAS DE ANESTESIA**

| CBO | Código | Cesariana | Contabilizar? | Motivo |
|-----|--------|-----------|---------------|--------|
| **225151** | 04.xxx | ❌ Não | ❌ Não | Anestesia já está no valor cirúrgico |
| **225151** | 04.17.01.001-0 | ✅ Sim | ✅ Sim | Cesariana é calculada separadamente |
| **Outros** | 04.xxx | - | ✅ Sim | Procedimento médico normal |

### **Contagem de Anestesia:**
```javascript
// ✅ UMA ANESTESIA POR PACIENTE (não soma múltiplos procedimentos)
IF paciente tem procedimento com CBO=225151 E código iniciado com '04':
   anesthesiaCount = 1
ELSE:
   anesthesiaCount = 0
```

---

## ⚡ **OTIMIZAÇÕES**

| Otimização | Técnica | Ganho |
|------------|---------|-------|
| **Carregamento Inicial** | Limit 500 AIHs | 80% mais rápido |
| **Queries Paralelas** | Promise.all() | 60% mais rápido |
| **Cache de Médicos** | Map<cns, doctor> | 95% mais rápido |
| **Expansão Lazy** | Carregar só ao expandir | UX instantânea |
| **Chunks de 1000** | Pagination | Evita timeout |
| **Filtros em SQL** | WHERE no banco | 90% mais rápido |

---

## 🚨 **ALERTAS E VALIDAÇÕES**

| Alerta | Condição | Ação |
|--------|----------|------|
| **Pacientes Sem Repasse** | `calculateDoctorPayment() = 0` | Badge amarelo |
| **Procedimentos Órfãos** | Sem regra de pagamento | Log warning |
| **Anestesista 04.xxx** | CBO 225151 + 04.xxx | Zerar valor |
| **Especialidade Clínica** | specialty = '03 - Clínico' | Excluir da lista |
| **AIH Duplicada** | Mesmo número já salvo | Bloquear save |
| **Médico Não Cadastrado** | CNS não encontrado | Bloquear save |

---

## 📈 **EXEMPLOS DE VALORES**

### **Exemplo 1: Dr. Humberto - Cirurgia Eletiva**

```
MÉDICO: HUMBERTO MOREIRA DA SILVA
├─ 45 pacientes
├─ 234 procedimentos
├─ R$ 234.000 (total)
├─ R$ 187.200 (incremento +80%)
└─ R$ 29.250 (pagamento médico)

   PACIENTE: CLEUZA APARECIDA
   ├─ AIH: 3524100001234567
   ├─ Caráter: 01 - ELETIVO
   ├─ AIH Seca: R$ 15.234,50
   ├─ Incremento: R$ 12.187,60 (+80%)
   ├─ C/ OP: R$ 27.422,10
   └─ Repasse: R$ 650,00
   
      PROCEDIMENTO 1: 04.05.01.001-0 (Principal)
      ├─ Revascularização do Miocárdio
      ├─ Valor: R$ 12.450,50
      ├─ Incremento: +R$ 9.960,40 (+80%)
      └─ CBO: 225125 (Cirurgião)
      
      PROCEDIMENTO 2: 04.07.01.012-9 (Secundário)
      ├─ Colecistectomia
      ├─ Valor: R$ 2.784,00
      ├─ Incremento: +R$ 2.227,20 (+80%)
      └─ CBO: 225125 (Cirurgião)
```

### **Exemplo 2: Dr. Rafael - Valor Fixo Por Paciente**

```
MÉDICO: RAFAEL LUCENA BASTOS
├─ 31 pacientes
├─ 36 procedimentos
├─ R$ 9.124 (total)
├─ R$ 0 (sem incremento OP)
└─ R$ 13.950 (R$ 450 × 31 pacientes)

   PACIENTE: MARIA SILVA
   ├─ AIH: 2324000888777
   ├─ AIH Seca: R$ 294,20
   ├─ Incremento: R$ 0
   ├─ C/ OP: R$ 294,20
   └─ Repasse: R$ 450,00 (fixo)
   
      PROCEDIMENTO 1: 04.03.02.012-3
      ├─ Síndrome Túnel Carpo
      ├─ Valor: R$ 294,20
      ├─ Repasse: R$ 450,00 (fixo)
      └─ CBO: 225142 (Ortopedista)
```

### **Exemplo 3: Dr. Thadeu - Valor Fixo Mensal**

```
MÉDICO: THADEU TIESSI SUZUKI
├─ 40 pacientes
├─ 156 procedimentos
├─ R$ 280.000 (total)
├─ R$ 224.000 (incremento +80%)
└─ R$ 47.000 (fixo mensal)

   PACIENTE: JOÃO SANTOS
   ├─ AIH: 2324000555444
   ├─ AIH Seca: R$ 7.000,00
   ├─ Incremento: R$ 5.600,00 (+80%)
   ├─ C/ OP: R$ 12.600,00
   └─ Repasse: ❌ Não mostra (fixo mensal)
```

---

## 🎯 **QUERIES SQL RESUMIDAS**

### **Query Principal (Carregar Médicos)**

```sql
-- ETAPA 1: Buscar AIHs
SELECT 
  id, aih_number, hospital_id, patient_id,
  admission_date, discharge_date, care_character,
  calculated_total_value, cns_responsavel,
  competencia, pgt_adm
FROM aihs
WHERE competencia = '2024-11' -- Filtro aplicado
  AND pgt_adm = 'sim'          -- Filtro aplicado
LIMIT 500; -- Só no carregamento inicial

-- ETAPA 2: Buscar Pacientes (embedded)
SELECT id, name, cns, birth_date, gender, medical_record
FROM patients
WHERE id IN (aih.patient_ids);

-- ETAPA 3: Buscar Procedimentos
SELECT *
FROM procedure_records
WHERE aih_id IN (aih_ids)
ORDER BY sequencia ASC;

-- ETAPA 4: Buscar Médicos
SELECT id, name, cns, crm, specialty
FROM doctors
WHERE cns IN (cns_responsavel_list)
  AND specialty != '03 - Clínico'; -- Excluir clínicos
```

---

## 📊 **RESUMO ESTATÍSTICO**

```
HIERARQUIA COMPLETA:
├─ NÍVEL 1 (Médicos): ~45 médicos
│  ├─ Campos exibidos: 11 campos
│  ├─ Cálculos: 7 cálculos
│  └─ Fonte: 4 tabelas
│
├─ NÍVEL 2 (Pacientes): ~1.234 pacientes (AIHs)
│  ├─ Campos exibidos: 15 campos
│  ├─ Cálculos: 4 cálculos
│  └─ Fonte: 2 tabelas
│
└─ NÍVEL 3 (Procedimentos): ~8.567 procedimentos
   ├─ Campos exibidos: 13 campos
   ├─ Cálculos: 1 cálculo
   └─ Fonte: 2 tabelas

TOTAL:
├─ 39 campos exibidos
├─ 12 cálculos diferentes
└─ 4 tabelas consultadas
```

---

## ✅ **CHECKLIST DE VALIDAÇÃO**

### **Antes de Exibir Médico:**
- [ ] Médico tem `cns_responsavel` válido
- [ ] Médico existe na tabela `doctors`
- [ ] Especialidade ≠ "03 - Clínico"
- [ ] Tem pelo menos 1 paciente
- [ ] Tem pelo menos 1 procedimento calculável

### **Antes de Exibir Paciente:**
- [ ] AIH tem `aih_id` único
- [ ] Paciente tem nome válido
- [ ] CNS tem 15 dígitos
- [ ] Data de admissão válida
- [ ] Tem pelo menos 1 procedimento

### **Antes de Exibir Procedimento:**
- [ ] Código SIGTAP válido (XX.XX.XX.XXX-X)
- [ ] Valor > 0 (exceto anestesia)
- [ ] Data de realização válida
- [ ] Sequência definida (ordem na AIH)

---

**📌 REFERÊNCIA RÁPIDA COMPLETA**  
**⚡ CONSULTA INSTANTÂNEA PARA QUALQUER CAMPO**  
**✅ PRONTO PARA IMPLEMENTAÇÃO E MANUTENÇÃO**

---

**Última Atualização:** 27/11/2025  
**Versão:** 2.0 - Compacta e Otimizada

