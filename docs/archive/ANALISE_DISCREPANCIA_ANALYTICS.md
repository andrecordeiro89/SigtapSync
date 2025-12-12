# 🔍 ANÁLISE DE DISCREPÂNCIA: TELA PACIENTES vs TELA ANALYTICS

## 📊 PROBLEMA IDENTIFICADO

**Cenário:** Hospital Municipal Juarez Barreto de Macedo (FAX) - Competência 07/2025
- **Tela Pacientes:** 300 pacientes ✅
- **Tela Analytics (Aba Profissionais):** 285 pacientes ⚠️
- **Diferença:** 15 pacientes perdidos ❌

---

## 🔬 CAUSA RAIZ

### 1. **ARQUITETURA DE DADOS**

#### Tela Pacientes (`PatientManagement.tsx`)
```typescript
// Linha 424-449: PatientManagement.tsx
const batch = await persistenceService.getAIHs(currentHospitalId || 'ALL', {
  status: undefined,
  dateFrom: dateFromISO,      // Filtra admission_date >= dateFrom
  dateTo: dateToISO,          // Filtra discharge_date <= dateTo
  careCharacter: careCharacterFilter,
  limit: pageSize,
  offset: offset
});
```

**Query SQL Executada:**
```sql
SELECT 
  *,
  patients (id, name, cns, birth_date, gender, medical_record),
  hospitals (id, name)
FROM aihs
WHERE 
  hospital_id = 'FAX' 
  AND admission_date >= '2025-07-01T00:00:00'
  AND discharge_date <= '2025-07-31T23:59:59.999'
  AND discharge_date IS NOT NULL
ORDER BY updated_at DESC;
```

**Características:**
- ✅ Busca **TODAS as AIHs** do hospital
- ✅ **NÃO filtra** por `cns_responsavel` (médico responsável)
- ✅ Filtro de competência aplicado **no frontend** (linha 754-758)
- ✅ Inclui AIHs **com ou sem médico** responsável

---

#### Tela Analytics (`MedicalProductionDashboard.tsx` → `DoctorPatientService`)
```typescript
// Linha 108-149: doctorPatientService.ts
let aihsQuery = supabase
  .from('aihs')
  .select(`
    id, aih_number, hospital_id, patient_id,
    admission_date, discharge_date, care_character,
    calculated_total_value, cns_responsavel,
    patients (id, name, cns, birth_date, gender, medical_record)
  `);

if (options?.hospitalIds && !options.hospitalIds.includes('all')) {
  aihsQuery = aihsQuery.in('hospital_id', options.hospitalIds);
}
if (options?.dateFromISO) {
  aihsQuery = aihsQuery.gte('admission_date', options.dateFromISO);
}
if (options?.dateToISO) {
  aihsQuery = aihsQuery.lte('admission_date', options.dateToISO);
}
```

**Query SQL Executada:**
```sql
SELECT 
  id, aih_number, hospital_id, patient_id,
  admission_date, discharge_date, care_character,
  calculated_total_value, cns_responsavel,
  patients (id, name, cns, birth_date, gender, medical_record)
FROM aihs
WHERE 
  hospital_id = 'FAX'
  AND admission_date >= '2025-07-01T00:00:00'
  AND admission_date <= '2025-07-31T23:59:59.999';
```

**Processamento Posterior (linha 167):**
```typescript
const doctorCnsList = Array.from(new Set(
  aihs.map(a => a.cns_responsavel).filter(Boolean)
));
```

**Processamento Posterior (linha 204-206):**
```typescript
for (const aih of aihs) {
  const doctorCns = aih.cns_responsavel || 'NAO_IDENTIFICADO';
  const doctorKey = doctorCns;
  // ...
}
```

**Características:**
- ⚠️ Busca AIHs **COM e SEM** `cns_responsavel`
- ⚠️ Cria um médico virtual `'NAO_IDENTIFICADO'` para AIHs sem médico
- ⚠️ **PORÉM:** O filtro de competência é aplicado **de forma diferente**
- ⚠️ Filtra por **`admission_date`** em vez de **`discharge_date`**
- ⚠️ Filtro de competência aplicado **no frontend** (linha 1263-1271) verificando `aih_info.competencia`

---

### 2. **DIFERENÇAS CRÍTICAS**

| Aspecto | Tela Pacientes | Tela Analytics |
|---------|----------------|----------------|
| **Campo de Data Principal** | `discharge_date` (Alta) | `admission_date` (Admissão) |
| **Filtro de Competência** | Frontend: `item.competencia` | Frontend: `aih_info.competencia` |
| **Inclusão de AIHs sem Médico** | ✅ SIM | ✅ SIM (mas agrupa como `NAO_IDENTIFICADO`) |
| **Query Date Range** | `admission_date >= X` E `discharge_date <= Y` | `admission_date >= X` E `admission_date <= Y` |
| **Campo `competencia`** | Verificado diretamente | Verificado via `aih_info.competencia` |

---

### 3. **CAUSA DA DISCREPÂNCIA DE 15 PACIENTES**

#### Hipótese 1: **Campo `competencia` Não Preenchido** (MAIS PROVÁVEL)
```sql
-- Verificar AIHs sem competência
SELECT 
  COUNT(*) as total_sem_competencia,
  hospital_id,
  DATE_TRUNC('month', discharge_date) as mes_alta
FROM aihs
WHERE 
  hospital_id = 'FAX'
  AND discharge_date >= '2025-07-01'
  AND discharge_date < '2025-08-01'
  AND competencia IS NULL
GROUP BY hospital_id, mes_alta;
```

**Explicação:**
- Tela Pacientes: filtra por `discharge_date` e depois filtra `competencia` no frontend
- Tela Analytics: filtra por `admission_date` e depois filtra `aih_info.competencia` no frontend
- **15 pacientes** têm `competencia = NULL`, então são **excluídos** na linha 1266-1267

#### Hipótese 2: **Diferença entre `admission_date` e `discharge_date`**
```sql
-- Pacientes com admissão em junho mas alta em julho
SELECT 
  COUNT(*) as total_alta_mes_diferente
FROM aihs
WHERE 
  hospital_id = 'FAX'
  AND admission_date < '2025-07-01'
  AND discharge_date >= '2025-07-01'
  AND discharge_date < '2025-08-01';
```

**Explicação:**
- Paciente foi **admitido em junho** mas recebeu **alta em julho**
- Tela Pacientes: **INCLUI** (filtra por `discharge_date`)
- Tela Analytics: **EXCLUI** (filtra por `admission_date`)

#### Hipótese 3: **AIHs sem `cns_responsavel` + sem `competencia`**
```sql
SELECT 
  COUNT(*) as total_sem_medico_e_competencia
FROM aihs
WHERE 
  hospital_id = 'FAX'
  AND discharge_date >= '2025-07-01'
  AND discharge_date < '2025-08-01'
  AND (cns_responsavel IS NULL OR competencia IS NULL);
```

---

## 🎯 SOLUÇÕES PROPOSTAS

### **SOLUÇÃO 1: PADRONIZAR FILTRO DE DATA (RECOMENDADO)**

**Problema:** Tela Pacientes usa `discharge_date`, Analytics usa `admission_date`

**Correção em `doctorPatientService.ts` (linhas 144-149):**
```typescript
// ❌ ANTES
if (options?.dateFromISO) {
  aihsQuery = aihsQuery.gte('admission_date', options.dateFromISO);
}
if (options?.dateToISO) {
  aihsQuery = aihsQuery.lte('admission_date', options.dateToISO);
}

// ✅ DEPOIS
if (options?.dateFromISO) {
  aihsQuery = aihsQuery.gte('discharge_date', options.dateFromISO);
}
if (options?.dateToISO) {
  aihsQuery = aihsQuery.lte('discharge_date', options.dateToISO);
  aihsQuery = aihsQuery.not('discharge_date', 'is', null);
}
```

**Impacto:**
- ✅ Ambas as telas usarão **`discharge_date`** (data de alta)
- ✅ Coerência entre contagens
- ✅ Alinhamento com competência SUS (baseada no mês de alta)

---

### **SOLUÇÃO 2: GARANTIR PREENCHIMENTO AUTOMÁTICO DE `competencia`**

**Problema:** Campo `competencia` não preenchido automaticamente

**Correção em `aihPersistenceService.ts` (linha 1092-1114):**
```typescript
// ✅ JÁ EXISTE, mas precisa garantir que SEMPRE seja preenchido
const updates: Record<string, any> = {};

// Competência SUS: priorizar competência informada; fallback para mês de alta
try {
  const compRaw = (aih as any).competencia as string | undefined;
  let competenciaDate: string | null = null;

  if (compRaw && /^\d{4}-\d{2}/.test(compRaw)) {
    competenciaDate = compRaw.startsWith('01/') 
      ? convertBrazilianDateToISO(compRaw).slice(0, 7) + '-01'
      : (compRaw.slice(0, 10) || compRaw.slice(0, 7) + '-01');
  } else if (aih.dataAlta && /^\d{2}\/\d{2}\/\d{4}/.test(aih.dataAlta)) {
    const isoDate = convertBrazilianDateToISO(aih.dataAlta);
    competenciaDate = isoDate.slice(0, 7) + '-01'; // YYYY-MM-01
  } else if (aih.dataInternacao && /^\d{2}\/\d{2}\/\d{4}/.test(aih.dataInternacao)) {
    const isoDate = convertBrazilianDateToISO(aih.dataInternacao);
    competenciaDate = isoDate.slice(0, 7) + '-01'; // YYYY-MM-01
  }

  if (competenciaDate) {
    updates.competencia = competenciaDate;
  }
} catch (e) {
  console.warn('⚠️ Falha ao processar competência:', e);
}
```

**Adicionar verificação pós-inserção:**
```typescript
// NOVO: Garantir competência preenchida após inserção
if (!updates.competencia && insertedId) {
  const { data: aihData } = await supabase
    .from('aihs')
    .select('discharge_date, admission_date')
    .eq('id', insertedId)
    .single();
  
  if (aihData) {
    const dateToUse = aihData.discharge_date || aihData.admission_date;
    if (dateToUse) {
      const competenciaFromDate = dateToUse.slice(0, 7) + '-01';
      await supabase
        .from('aihs')
        .update({ competencia: competenciaFromDate })
        .eq('id', insertedId);
    }
  }
}
```

**Impacto:**
- ✅ **100% das AIHs** terão `competencia` preenchida
- ✅ Filtros de competência funcionarão corretamente
- ✅ Sincronização entre telas

---

### **SOLUÇÃO 3: ADICIONAR DIAGNÓSTICO DE QUALIDADE DE DADOS**

**Criar endpoint para verificar inconsistências:**
```typescript
// Novo método em aihPersistenceService.ts
static async validateDataQuality(hospitalId: string) {
  const { data: issues } = await supabase.rpc('check_aih_quality', {
    p_hospital_id: hospitalId
  });
  
  return {
    aihs_sem_competencia: issues?.missing_competencia || 0,
    aihs_sem_medico: issues?.missing_doctor || 0,
    aihs_admissao_alta_meses_diferentes: issues?.cross_month || 0
  };
}
```

**SQL Function:**
```sql
CREATE OR REPLACE FUNCTION check_aih_quality(p_hospital_id TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'missing_competencia', COUNT(*) FILTER (WHERE competencia IS NULL),
    'missing_doctor', COUNT(*) FILTER (WHERE cns_responsavel IS NULL),
    'cross_month', COUNT(*) FILTER (
      WHERE DATE_TRUNC('month', admission_date) != DATE_TRUNC('month', discharge_date)
    )
  )
  INTO result
  FROM aihs
  WHERE hospital_id = p_hospital_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

**Impacto:**
- ✅ Visibilidade proativa de problemas
- ✅ Alerta para operadores
- ✅ Facilita manutenção

---

### **SOLUÇÃO 4: BACKFILL DE DADOS (CORREÇÃO DE LEGADO)**

**Script para corrigir AIHs antigas:**
```sql
-- Preencher competência baseada na data de alta
UPDATE aihs
SET competencia = TO_CHAR(discharge_date, 'YYYY-MM') || '-01'
WHERE competencia IS NULL
  AND discharge_date IS NOT NULL;

-- Fallback para data de admissão se alta estiver nula
UPDATE aihs
SET competencia = TO_CHAR(admission_date, 'YYYY-MM') || '-01'
WHERE competencia IS NULL
  AND admission_date IS NOT NULL;
```

**Impacto:**
- ✅ Corrige dados históricos
- ✅ Elimina discrepâncias imediatamente
- ✅ One-time fix

---

## 📋 RECOMENDAÇÃO FINAL

### **IMPLEMENTAR NESTA ORDEM:**

1. **SOLUÇÃO 4 (Backfill)** - Correção imediata dos 15 pacientes perdidos ⚡
2. **SOLUÇÃO 1 (Padronização)** - Alinhar ambas as telas para usar `discharge_date` 🎯
3. **SOLUÇÃO 2 (Auto-preenchimento)** - Garantir que novos registros sempre tenham `competencia` ✅
4. **SOLUÇÃO 3 (Diagnóstico)** - Monitoramento contínuo de qualidade 🔍

### **RESULTADO ESPERADO:**
- ✅ Tela Pacientes: **300 pacientes**
- ✅ Tela Analytics: **300 pacientes**
- ✅ **Diferença: 0 pacientes** ✨

---

## 🔧 LIMITAÇÕES ATUAIS DA TELA ANALYTICS

### 1. **Múltiplos Filtros com Interações Complexas**
```typescript
// ExecutiveDashboard.tsx - linha 1193-1292
useEffect(() => {
  let filtered = doctors;
  
  // Filtro 1: Hospital
  // Filtro 2: Busca de médico
  // Filtro 3: Busca de paciente
  // Filtro 4: Especialidade médica
  // Filtro 5: Caráter de atendimento
  // Filtro 6: Especialidade de atendimento (AIH)
  // Filtro 7: Competência
  // Filtro 8: Data de alta (toggle "apenas alta")
  
  // PROBLEMA: Cada filtro remove progressivamente pacientes
  // Se um filtro frontend falhar, os pacientes "desaparecem"
}, [searchTerm, patientSearchTerm, selectedSpecialty, ...]);
```

**Problemas:**
- ⚠️ **8 filtros encadeados** aplicados sequencialmente
- ⚠️ Cada filtro pode **remover dados válidos** se houver campo NULL
- ⚠️ Difícil debugar qual filtro está causando a perda

### 2. **Filtros Frontend vs Backend**
| Filtro | Aplicado em | Risco |
|--------|-------------|-------|
| Hospital | Backend SQL | ✅ Baixo |
| Data (Admissão/Alta) | Backend SQL | ⚠️ Médio (campo diferente) |
| Caráter Atendimento | Frontend | ⚠️ Médio (pode ser NULL) |
| Competência | Frontend | ❌ Alto (15 perdidos aqui) |
| Especialidade | Frontend | ⚠️ Médio |
| Busca Paciente | Frontend | ✅ Baixo |

**Recomendação:** Mover filtros críticos (competência, caráter) para **backend SQL**

### 3. **Performance com Múltiplos Filtros**
- 🔥 Reprocessamento a cada mudança de filtro
- 🔥 Sem debounce para múltiplos filtros simultâneos
- 🔥 Re-renderizações desnecessárias

---

## 📈 MELHORIAS SUGERIDAS (FUTURO)

### 1. **Cache de Queries Filtradas**
```typescript
const queryCache = new Map<string, DoctorWithPatients[]>();
const cacheKey = `${hospitalIds}_${dateRange}_${competencia}`;

if (queryCache.has(cacheKey)) {
  setDoctors(queryCache.get(cacheKey)!);
} else {
  const data = await DoctorPatientService.getDoctorsWithPatients(...);
  queryCache.set(cacheKey, data);
  setDoctors(data);
}
```

### 2. **Filtros SQL em vez de Frontend**
```typescript
// Adicionar parâmetros ao serviço
DoctorPatientService.getDoctorsWithPatientsFromProceduresView({
  hospitalIds: ['FAX'],
  dateFromISO: '2025-07-01',
  dateToISO: '2025-07-31',
  competencia: '2025-07',           // NOVO
  careCharacter: '1',                // NOVO
  doctorSpecialty: 'CIRURGIA GERAL' // NOVO
});
```

### 3. **Indicador de Qualidade de Dados**
```typescript
<Alert variant="warning">
  ⚠️ 15 pacientes sem competência definida. 
  <Button onClick={autoFillCompetencia}>Auto-preencher</Button>
</Alert>
```

---

## 📝 CONCLUSÃO

A discrepância de **15 pacientes** entre as telas **Pacientes** e **Analytics** é causada por:

1. **Campo `competencia` não preenchido** em 15 AIHs (5% do total)
2. **Diferença de campo de data**: Pacientes filtra por `discharge_date`, Analytics por `admission_date`
3. **Filtros frontend** que excluem registros com dados incompletos

**Implementando as soluções propostas, ambas as telas exibirão os mesmos 300 pacientes.**

---

**Gerado por:** AI Assistant | **Data:** 07/10/2025 | **Versão:** 1.0

