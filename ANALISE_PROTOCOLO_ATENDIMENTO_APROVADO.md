# 📋 Análise Detalhada: Protocolo de Atendimento Aprovado

## 📍 Localização do Botão

**Arquivo:** `src/components/MedicalProductionDashboard.tsx`  
**Linhas:** 2846-3153  
**Contexto:** Botão localizado no card de cada médico na tela **Analytics → Produção Médica - Pagamentos Médicos**

---

## 🔄 Fluxo de Dados

### **1. Origem dos Dados:**

```typescript
// Linha 1081-1086
const doctorsWithPatients = await DoctorPatientService.getDoctorsWithPatientsFromProceduresView({
  hospitalIds: selectedHospitalIds,
  competencia: competenciaFilter
});
```

**Serviço Utilizado:** `DoctorPatientService.getDoctorsWithPatientsFromProceduresView()`  
**Arquivo:** `src/services/doctorPatientService.ts` (linhas 112-325)

---

## 🗄️ Tabelas do Banco de Dados Consultadas

### **1. Tabela Principal: `aihs`**

**Query SQL:**
```typescript
// doctorPatientService.ts - Linhas 122-144
supabase
  .from('aihs')
  .select(`
    id,
    aih_number,
    hospital_id,
    patient_id,
    admission_date,
    discharge_date,
    care_character,
    calculated_total_value,
    cns_responsavel,
    competencia,
    pgt_adm,
    patients (
      id,
      name,
      cns,
      birth_date,
      gender,
      medical_record
    )
  `)
```

**Colunas Utilizadas:**
- ✅ `id` - ID único da AIH
- ✅ `aih_number` - Número da AIH (não usado no protocolo)
- ✅ `hospital_id` - Filtro de hospital
- ✅ `patient_id` - Relação com tabela patients
- ✅ `admission_date` - Data de admissão (não usado no protocolo)
- ✅ `discharge_date` - **USADO: Data de Alta no PDF**
- ✅ `care_character` - Caráter de atendimento (não usado no protocolo)
- ✅ `calculated_total_value` - Valor total da AIH (não usado no protocolo)
- ✅ `cns_responsavel` - CNS do médico responsável (chave de agrupamento)
- ✅ `competencia` - **FILTRO: Competência SUS**
- ❌ `pgt_adm` - Pagamento Administrativo (não usado no protocolo)

**Filtros Aplicados:**
```sql
WHERE hospital_id IN (selectedHospitalIds) -- Se não for 'all'
  AND competencia = selectedCompetencia     -- Se não for 'all'
ORDER BY admission_date DESC
```

---

### **2. Tabela Relacionada (JOIN): `patients`**

**Colunas Utilizadas:**
- ✅ `id` - ID único do paciente
- ✅ `name` - **USADO: Nome do Paciente no PDF**
- ✅ `cns` - CNS do paciente (não usado no protocolo)
- ✅ `birth_date` - Data de nascimento (não usado no protocolo)
- ✅ `gender` - Gênero (não usado no protocolo)
- ✅ `medical_record` - **USADO: Prontuário no PDF**

---

### **3. Tabela: `procedure_records`**

**Query SQL:**
```typescript
// simplifiedProcedureService.ts - Buscado via ProcedureRecordsService
supabase
  .from('procedure_records')
  .select(`
    id,
    aih_id,
    patient_id,
    procedure_code,
    procedure_description,
    procedure_date,
    value_cents,
    professional_name,
    professional_cbo,
    registration_instrument,
    sequence,
    sigtap_description
  `)
  .in('aih_id', aihIds)
```

**Colunas Utilizadas no Protocolo:**
- ✅ `aih_id` - Relacionamento com AIH
- ✅ `patient_id` - Relacionamento com paciente
- ✅ `procedure_code` - **USADO: Código do Procedimento no PDF**
- ✅ `procedure_description` - **USADO: Descrição do Procedimento no PDF**
- ✅ `sigtap_description` - Fallback para descrição
- ✅ `professional_cbo` - **FILTRO: Usado para excluir anestesistas (CBO 225151)**
- ✅ `registration_instrument` - **FILTRO CRÍTICO: Identifica procedimento principal (contém "03")**
- ❌ `procedure_date` - Data do procedimento (não usado no protocolo)
- ❌ `value_cents` - Valor do procedimento (não usado no protocolo)
- ❌ `professional_name` - Nome do profissional (não usado no protocolo)
- ❌ `sequence` - Sequência do procedimento (não usado no protocolo)

---

### **4. Tabela: `doctors`**

**Query SQL:**
```typescript
// doctorPatientService.ts - Linhas 183-186
supabase
  .from('doctors')
  .select('id, name, cns, crm, specialty, is_active')
  .in('cns', doctorCnsList)
```

**Colunas Utilizadas:**
- ✅ `name` - **USADO: Médico Responsável no PDF**
- ✅ `cns` - Chave de associação
- ✅ `crm` - CRM do médico (não usado no protocolo)
- ✅ `specialty` - Especialidade (não usado no protocolo)

---

### **5. Tabela: `hospitals`**

**Query SQL:**
```typescript
// doctorPatientService.ts - Linhas 188-196
supabase
  .from('hospitals')
  .select('id, name, cnes')
  .in('id', hospitalIds)
```

**Colunas Utilizadas:**
- ✅ `id` - ID do hospital
- ✅ `name` - **USADO: Instituição no PDF**
- ❌ `cnes` - Código CNES (não usado no protocolo)

---

## 📊 Estrutura do PDF Gerado

### **Cabeçalho:**
```
┌─────────────────────────────────────────────────────┐
│ [LOGO CIS]   PROTOCOLO DE ATENDIMENTO APROVADO      │
│              CIS - Centro Integrado em Saúde        │
├─────────────────────────────────────────────────────┤
│ Médico Responsável: [doctors.name]                  │
│ Instituição: [hospitals.name]                       │
│ Competência: [aihs.competencia formatada]           │
│ Data de Emissão: [Data atual]                       │
│ Total de Atendimentos: [Contagem]                   │
└─────────────────────────────────────────────────────┘
```

### **Tabela de Atendimentos:**
```
┌───┬───────────┬─────────────────┬────────────┬──────────────┬───────────┐
│ # │Prontuário │ Nome do Paciente│   Código   │  Descrição   │Data Alta  │
├───┼───────────┼─────────────────┼────────────┼──────────────┼───────────┤
│ 1 │ 4365125   │ MARIA JOSE...   │ 0401020015 │ MASTECTOMIA..│ 10/10/2025│
│ 2 │ 5557710   │ LUCAS MACHADO...│ 0403010036 │ COLECISTEC...│ 13/10/2025│
│...│    ...    │      ...        │    ...     │     ...      │    ...    │
└───┴───────────┴─────────────────┴────────────┴──────────────┴───────────┘
```

---

## 🔍 Lógica de Filtragem de Procedimentos

### **Regra para Seleção do Procedimento Principal:**

**Arquivo:** `MedicalProductionDashboard.tsx` (Linhas 2892-2933)

```typescript
// Para cada paciente, buscar o PRIMEIRO procedimento que atenda:

1. ✅ registration_instrument CONTÉM "03"
   Exemplos válidos:
   - "03 - AIH (Proc. Principal)"
   - "02 - BPA (Individualizado) / 03 - AIH (Proc. Principal)"
   - "03"
   - Qualquer string que contenha "03"

2. ✅ professional_cbo ≠ "225151"
   (Excluir procedimentos de anestesistas)

3. ✅ PEGAR APENAS O PRIMEIRO que passar nos filtros acima
```

**Código:**
```typescript
const isMainProcedure = regInstrument.includes('03');
const isNotAnesthetist = cbo !== '225151';

if (isMainProcedure && isNotAnesthetist) {
  mainProcedure = {
    code: procCode.replace(/[.\-]/g, ''),  // Remove pontos e traços
    description: procDesc.substring(0, 60)  // Limita a 60 caracteres
  };
  break; // Para no primeiro encontrado
}
```

### **Tratamento de AIHs sem Procedimento Principal:**

```typescript
// Se não encontrar procedimento principal:
protocolData.push([
  idx++,
  medicalRecord,
  patientName,
  '-',                        // ← Código vazio
  'Sem proc. principal',      // ← Mensagem clara
  dischargeLabel
]);
```

---

## 📋 Mapeamento de Dados (De → Para)

### **Do Banco → Para o PDF:**

| Origem (Tabela.Coluna) | Destino (PDF) | Transformação |
|------------------------|---------------|---------------|
| `patients.medical_record` | Prontuário | Nenhuma |
| `patients.name` | Nome do Paciente | Nenhuma |
| `procedure_records.procedure_code` | Código | Remove pontos e traços |
| `procedure_records.procedure_description` | Descrição do Procedimento | Limita a 60 caracteres |
| `aihs.discharge_date` | Data Alta | Formato: DD/MM/YYYY |
| `doctors.name` | Médico Responsável | Nenhuma |
| `hospitals.name` | Instituição | Nenhuma |
| `aihs.competencia` | Competência | Formato: MM/YYYY |

---

## 🔗 Relacionamentos Entre Tabelas

```
┌─────────────┐
│   doctors   │
│ ├─ name     │ → Médico Responsável
│ ├─ cns      │
└──────┬──────┘
       │
       │ (cns_responsavel)
       ↓
┌─────────────┐
│    aihs     │
│ ├─ id       │
│ ├─ patient_id├───────────┐
│ ├─ hospital_id├──────┐    │
│ ├─ discharge_date │→ Data Alta
│ ├─ competencia│ → Competência
│ ├─ cns_responsavel│
└─────────────┘    │    │
                    │    │
          ┌─────────┘    │
          ↓              │
    ┌────────────┐       │
    │ hospitals  │       │
    │ ├─ name    │→ Instituição
    └────────────┘       │
                         │
                ┌────────┘
                ↓
        ┌───────────────┐
        │   patients    │
        │ ├─ name       │→ Nome do Paciente
        │ ├─ medical_record│→ Prontuário
        └───────┬───────┘
                │
                │ (patient_id ou aih_id)
                ↓
        ┌───────────────────┐
        │ procedure_records │
        │ ├─ procedure_code │→ Código
        │ ├─ procedure_description│→ Descrição
        │ ├─ registration_instrument│→ FILTRO (contém "03")
        │ └─ professional_cbo│→ FILTRO (≠ 225151)
        └───────────────────┘
```

---

## 📊 Estatísticas e Logs

### **Logs do Console:**

```javascript
// Linha 2871-2955
console.log(`📋 [PROTOCOLO] Gerando protocolo de atendimento aprovado para ${doctorName}`);
console.log(`📋 [PROTOCOLO] Competência: ${competenciaLabel}`);
console.log(`📋 [PROTOCOLO] Total de procedimentos encontrados: ${totalProcsFound}`);
console.log(`📋 [PROTOCOLO] Total após filtro (contém "03" + CBO ≠ 225151): ${totalProcsFiltered}`);
console.log(`📋 [PROTOCOLO] Total de AIHs no relatório: ${protocolData.length}`);
console.log(`📋 [PROTOCOLO] AIHs sem procedimento principal: ${aihsWithoutMainProcedure}`);
```

---

## 🎨 Formatação e Ordenação

### **Ordenação:**
```typescript
// Linha 2957-2983
// Ordena por data de alta: MAIS ANTIGA PRIMEIRO (ascendente)
protocolData.sort((a, b) => {
  const parsedDateA = parseDate(a[5]); // Data Alta na posição 5
  const parsedDateB = parseDate(b[5]);
  return parsedDateA.getTime() - parsedDateB.getTime();
});
```

### **Formato de Datas:**
```typescript
// aihs.discharge_date: "2025-10-10" (ISO)
// Transformado para: "10/10/2025" (DD/MM/YYYY)

const parseISODateToLocal = (isoString: string): string => {
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
};
```

### **Formato de Competência:**
```typescript
// aihs.competencia: "2025-10-01" (YYYY-MM-DD)
// Transformado para: "10/2025" (MM/YYYY)

const formatCompetencia = (comp: string): string => {
  const m = comp.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[2]}/${m[1]}`;
  return comp;
};
```

---

## 📄 Estrutura do Arquivo PDF

### **Configurações:**
- **Orientação:** Landscape (paisagem)
- **Formato:** A4
- **Margens:** 15mm (esquerda/direita)
- **Fonte:** Helvetica

### **Larguras das Colunas:**
```typescript
// Linha 3083-3090
columnStyles: {
  0: { cellWidth: 10, halign: 'center' },     // #
  1: { cellWidth: 22, halign: 'center' },     // Prontuário
  2: { cellWidth: 65, halign: 'left' },       // Nome do Paciente
  3: { cellWidth: 28, halign: 'center' },     // Código
  4: { cellWidth: 115, halign: 'left' },      // Descrição do Procedimento
  5: { cellWidth: 24, halign: 'center' }      // Data Alta
}
```

---

## 🎯 Resumo das Colunas Usadas

### **✅ Dados Exibidos no PDF:**

| Coluna do Banco | Tabela | Usado no PDF | Coluna do PDF |
|-----------------|--------|--------------|---------------|
| `patients.medical_record` | patients | ✅ Sim | Prontuário |
| `patients.name` | patients | ✅ Sim | Nome do Paciente |
| `procedure_records.procedure_code` | procedure_records | ✅ Sim | Código |
| `procedure_records.procedure_description` | procedure_records | ✅ Sim | Descrição do Procedimento |
| `aihs.discharge_date` | aihs | ✅ Sim | Data Alta |
| `doctors.name` | doctors | ✅ Sim | Médico Responsável (cabeçalho) |
| `hospitals.name` | hospitals | ✅ Sim | Instituição (cabeçalho) |
| `aihs.competencia` | aihs | ✅ Sim | Competência (cabeçalho) |

### **❌ Dados Consultados mas NÃO Exibidos:**

| Coluna do Banco | Tabela | Motivo |
|-----------------|--------|--------|
| `aihs.id` | aihs | Chave técnica |
| `aihs.aih_number` | aihs | Não usado no protocolo |
| `aihs.patient_id` | aihs | Chave de relacionamento |
| `aihs.hospital_id` | aihs | Usado apenas para filtro |
| `aihs.admission_date` | aihs | Não usado no protocolo |
| `aihs.care_character` | aihs | Não usado no protocolo |
| `aihs.calculated_total_value` | aihs | Não usado no protocolo |
| `aihs.cns_responsavel` | aihs | Usado para agrupar por médico |
| `aihs.pgt_adm` | aihs | Não usado no protocolo |
| `patients.id` | patients | Chave técnica |
| `patients.cns` | patients | Não usado no protocolo |
| `patients.birth_date` | patients | Não usado no protocolo |
| `patients.gender` | patients | Não usado no protocolo |
| `procedure_records.aih_id` | procedure_records | Chave de relacionamento |
| `procedure_records.patient_id` | procedure_records | Chave de relacionamento |
| `procedure_records.procedure_date` | procedure_records | Não usado no protocolo |
| `procedure_records.value_cents` | procedure_records | Não usado no protocolo |
| `procedure_records.professional_name` | procedure_records | Não usado no protocolo |
| `procedure_records.sequence` | procedure_records | Não usado no protocolo |
| `procedure_records.sigtap_description` | procedure_records | Fallback apenas |
| `doctors.cns` | doctors | Chave de associação |
| `doctors.crm` | doctors | Não usado no protocolo |
| `doctors.specialty` | doctors | Não usado no protocolo |
| `hospitals.id` | hospitals | Chave técnica |
| `hospitals.cnes` | hospitals | Não usado no protocolo |

---

## 🔍 Campos Utilizados para FILTROS:

| Campo | Tabela | Uso no Filtro |
|-------|--------|---------------|
| `aihs.hospital_id` | aihs | Filtrar por hospital selecionado |
| `aihs.competencia` | aihs | Filtrar por competência SUS |
| `aihs.cns_responsavel` | aihs | Agrupar por médico |
| `procedure_records.registration_instrument` | procedure_records | Identificar procedimento principal (contém "03") |
| `procedure_records.professional_cbo` | procedure_records | Excluir anestesistas (CBO = 225151) |

---

## 📌 Observações Importantes

### **1. Filtro de Procedimento Principal:**
- ✅ **Critério:** `registration_instrument` CONTÉM "03"
- ✅ **Exclusão:** CBO ≠ 225151 (anestesistas)
- ✅ **Prioridade:** PRIMEIRO procedimento que atende aos critérios
- ⚠️ **Fallback:** Se não encontrar, exibe "-" e "Sem proc. principal"

### **2. Ordenação:**
- ✅ Por **data de alta** (mais antiga primeiro)
- ✅ Renumeração após ordenação

### **3. Tratamento de Dados:**
- ✅ Código do procedimento: Remove pontos e traços
- ✅ Descrição: Limita a 60 caracteres
- ✅ Datas: Formato brasileiro (DD/MM/YYYY)

### **4. AIHs sem Procedimento Principal:**
- ✅ **Incluídas** no relatório
- ✅ Mostram "-" no código
- ✅ Mostram "Sem proc. principal" na descrição
- ✅ Contador específico: `aihsWithoutMainProcedure`

---

## 🎉 Conclusão

O **Protocolo de Atendimento Aprovado** consome dados de **5 tabelas principais**:

1. **`aihs`** - Base principal (AIHs processadas)
2. **`patients`** - Dados dos pacientes (JOIN com aihs)
3. **`procedure_records`** - Procedimentos realizados
4. **`doctors`** - Informações dos médicos
5. **`hospitals`** - Informações dos hospitais

**Total de colunas consultadas:** 33  
**Colunas exibidas no PDF:** 8 (5 na tabela + 3 no cabeçalho)  
**Colunas usadas para filtros:** 5

---

**📄 Documento Gerado:** `Protocolo_Atendimento_Aprovado_[MEDICO]_[DATA].pdf`  
**📅 Data de Análise:** 14/10/2025  
**✅ Status:** Análise Completa

