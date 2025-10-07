# 🔍 ANÁLISE: Pacientes Faltando na Tela Analytics

## 📊 **Problema Identificado**

Pacientes **processados corretamente** na tela **Pacientes** não aparecem na tela **Analytics** (aba Profissionais).

**Exemplos de AIHs faltando:**
- 4125113482920 - DJAVAN BLUM
- 4125113483535 - ALANNA SILVA HUK FARIAS
- 4125113483580 - ALANNA SILVA HUK FARIAS
- 4125113484877 - RAFAEL FERNANDES
- 4125113484943 - RAFAEL FERNANDES
- E mais...

**Hospital:** Hospital Municipal Juarez Barreto de Macedo  
**Competência:** 07/2025  
**Total de AIHs faltando:** ~15 pacientes

---

## 🔎 **Causas Prováveis**

### **1️⃣ Campo `cns_responsavel` está NULL ou Vazio**

A tela Analytics usa o serviço `DoctorPatientService` que:
- **Arquivo:** `src/services/doctorPatientService.ts`
- **Linha 171:** Extrai `doctorCnsList` das AIHs usando `cns_responsavel`
- **Linha 209:** Agrupa médicos por `cns_responsavel` (ou 'NAO_IDENTIFICADO' se null)

**Problema:**
```typescript
const doctorCns = aih.cns_responsavel || 'NAO_IDENTIFICADO';
```

Se `cns_responsavel` for NULL:
- ✅ As AIHs aparecem na tela **Pacientes** (não depende de médico)
- ❌ As AIHs aparecem como "NAO_IDENTIFICADO" na **Analytics**, mas podem ser filtradas

---

### **2️⃣ Médicos Não Cadastrados na Tabela `doctors`**

A query carrega médicos da tabela `doctors`:
```typescript
// Linha 183-186
supabase
  .from('doctors')
  .select('id, name, cns, crm, specialty, is_active')
  .in('cns', doctorCnsList)
```

**Problema:**
- Se o médico não está na tabela `doctors`, seus dados aparecem como `"Dr(a). [CNS]"`
- Mas se `cns_responsavel` for NULL, nem entra na query

---

### **3️⃣ Campo `competencia` Incorreto ou NULL**

O filtro de competência remove médicos sem pacientes na competência selecionada:
```typescript
// MedicalProductionDashboard.tsx - Linha 1225-1233
if (selectedCompetencia && selectedCompetencia !== 'all') {
  filtered = filtered.map(doctor => {
    const patientsFiltered = doctor.patients.filter(p => {
      const comp = (p as any)?.aih_info?.competencia;
      return comp === selectedCompetencia;
    });
    return { ...doctor, patients: patientsFiltered };
  }).filter(d => d.patients.length > 0);
}
```

**Se `competencia` for NULL ou diferente de '2025-07-01', os pacientes são excluídos.**

---

## 🛠️ **Diagnóstico**

Execute o arquivo `database/diagnostico_pacientes_faltando.sql` no **Supabase SQL Editor**:

```bash
# Arquivo criado: database/diagnostico_pacientes_faltando.sql
```

Este script irá:
1. ✅ Verificar se os médicos estão na tabela `doctors`
2. ✅ Verificar AIHs por `requesting_physician`
3. ✅ Contar AIHs sem `cns_responsavel`
4. ✅ Verificar competências das AIHs de julho/2025
5. ✅ Analisar as AIHs específicas da imagem
6. ✅ Verificar se as AIHs têm procedimentos

---

## 💡 **Soluções**

### **Solução 1: Preencher `cns_responsavel` baseado em `requesting_physician`**

Se o problema for `cns_responsavel` NULL, podemos fazer um UPDATE para preenchê-lo:

```sql
-- ATUALIZAR cns_responsavel baseado no requesting_physician
UPDATE aihs
SET cns_responsavel = (
  SELECT cns 
  FROM doctors 
  WHERE UPPER(doctors.name) = UPPER(aihs.requesting_physician)
  LIMIT 1
)
WHERE cns_responsavel IS NULL 
  AND requesting_physician IS NOT NULL
  AND requesting_physician != ''
  AND EXISTS (
    SELECT 1 FROM doctors 
    WHERE UPPER(doctors.name) = UPPER(aihs.requesting_physician)
  );
```

**Antes de executar:** Rode a query #8 do diagnóstico para ver quantos registros seriam atualizados.

---

### **Solução 2: Cadastrar Médicos na Tabela `doctors`**

Se os médicos não existem na tabela `doctors`:

```sql
-- INSERIR MÉDICOS FALTANTES
INSERT INTO doctors (name, cns, is_active, created_at, updated_at)
SELECT DISTINCT 
  requesting_physician as name,
  'CNS_' || MD5(requesting_physician) as cns, -- CNS temporário
  true as is_active,
  NOW() as created_at,
  NOW() as updated_at
FROM aihs
WHERE requesting_physician IS NOT NULL
  AND requesting_physician != ''
  AND NOT EXISTS (
    SELECT 1 FROM doctors 
    WHERE UPPER(doctors.name) = UPPER(aihs.requesting_physician)
  );
```

**⚠️ ATENÇÃO:** Isso cria CNS temporários. O ideal é ter o CNS real dos médicos.

---

### **Solução 3: Corrigir Campo `competencia`**

Se o problema for competência incorreta, use o script `database/fix_missing_competencia.sql`:

```sql
-- BACKFILL DE COMPETÊNCIA
UPDATE aihs
SET competencia = TO_CHAR(discharge_date, 'YYYY-MM') || '-01'
WHERE competencia IS NULL
  AND discharge_date IS NOT NULL;
```

---

## 🎯 **Próximos Passos**

1. **Execute o diagnóstico:** `database/diagnostico_pacientes_faltando.sql`
2. **Analise os resultados** para identificar qual das 3 causas é o problema
3. **Aplique a solução correspondente:**
   - Se `cns_responsavel` NULL → **Solução 1**
   - Se médico não cadastrado → **Solução 2**
   - Se `competencia` NULL → **Solução 3**

4. **Recarregue a tela Analytics** e verifique se os pacientes aparecem

---

## 📈 **Resultado Esperado**

Após aplicar a solução:
- ✅ **Tela Pacientes:** 300 pacientes (mantém)
- ✅ **Tela Analytics:** 300 AIHs (corrigido de 285)
- ✅ Todos os médicos aparecem corretamente
- ✅ Competência 07/2025 funciona corretamente

---

## 🔗 **Arquivos Relacionados**

- `src/services/doctorPatientService.ts` - Serviço que carrega dados da Analytics
- `src/components/MedicalProductionDashboard.tsx` - Componente que exibe os dados
- `database/diagnostico_pacientes_faltando.sql` - Script de diagnóstico
- `database/fix_missing_competencia.sql` - Script para corrigir competências

