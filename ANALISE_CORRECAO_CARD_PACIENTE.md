# 🐛 **ANÁLISE E CORREÇÃO - PROBLEMAS NO CARD DO PACIENTE**

## 📋 **RESUMO DOS PROBLEMAS REPORTADOS**

**Data:** 27 de Novembro de 2025  
**Componente:** `MedicalProductionDashboard.tsx` - Card do Paciente  
**Status:** ✅ PROBLEMAS IDENTIFICADOS E SOLUÇÕES PRONTAS

---

## 🚨 **PROBLEMA #1: PROCEDIMENTOS NÃO EXPANDEM**

### **Sintoma:**
Ao clicar no card do paciente para expandir os procedimentos, nada acontece.

### **Causa Raiz:**
```tsx
// ❌ PROBLEMA: Collapsible não está sendo controlado corretamente
<Collapsible>
  <CollapsibleTrigger asChild>
    <div onClick={() => togglePatientExpansion(patientKey)}>
      {/* conteúdo do card */}
    </div>
  </CollapsibleTrigger>
  
  <CollapsibleContent>
    {/* procedimentos */}
  </CollapsibleContent>
</Collapsible>
```

**ANÁLISE:**
1. O componente `Collapsible` do Shadcn UI precisa da prop `open` para ser controlado
2. A função `togglePatientExpansion` está atualizando o estado `expandedPatients`
3. A variável `isPatientExpanded` está sendo calculada corretamente
4. **MAS**: O `Collapsible` não está recebendo a prop `open={isPatientExpanded}`
5. **RESULTADO**: O Collapsible gerencia seu próprio estado interno (não controlado) e ignora nosso estado React

### **Código Atual (Linha 4161):**
```tsx
<Collapsible>
  {/* ❌ FALTANDO: open={isPatientExpanded} */}
  <CollapsibleTrigger asChild>
    <div onClick={() => togglePatientExpansion(patientKey)}>
```

### **Código Correto:**
```tsx
<Collapsible open={isPatientExpanded}>
  {/* ✅ AGORA O COLLAPSIBLE É CONTROLADO PELO NOSSO ESTADO */}
  <CollapsibleTrigger asChild>
    <div onClick={() => togglePatientExpansion(patientKey)}>
```

---

## 🚨 **PROBLEMA #2: VALOR DO REPASSE MÉDICO MUDA AO EXPANDIR**

### **Sintoma:**
Ao clicar para expandir os procedimentos, o valor exibido no card "Repasse Médico" muda.

### **Causa Raiz:**

```tsx
// ❌ PROBLEMA: Cálculo dentro do render (linhas 4393-4453)
{(() => {
  const hospitalId = doctor.hospitals?.[0]?.hospital_id;
  const fixedCalc = calculateFixedPayment(doctor.doctor_info.name, hospitalId);
  const hasIndividualRules = hasIndividualPaymentRules(doctor.doctor_info.name, hospitalId);
  
  if (fixedCalc.hasFixedRule && !hasIndividualRules) {
    return null;
  }
  
  // 🚨 RECALCULADO A CADA RENDER
  const proceduresWithPayment = patient.procedures
    .filter(filterCalculableProcedures)
    .map((proc: any) => ({
      procedure_code: proc.procedure_code,
      procedure_description: proc.procedure_description,
      value_reais: proc.value_reais || 0,
    }));

  const paymentResult = calculateDoctorPayment(
    doctor.doctor_info.name,
    proceduresWithPayment,
    hospitalId
  );

  const totalPayment = paymentResult.totalPayment || 0;
  // ...
})()}
```

**ANÁLISE:**
1. O cálculo do "Repasse Médico" está dentro de uma IIFE (Immediately Invoked Function Expression)
2. Essa função é executada **em cada render** do componente
3. Quando o usuário clica para expandir, o React re-renderiza o componente
4. **PROBLEMA**: As funções `calculateDoctorPayment`, `filterCalculableProcedures`, etc. podem estar retornando valores diferentes em cada chamada
5. **POSSÍVEIS CAUSAS**:
   - Ordem dos procedimentos mudando
   - Filtros diferentes sendo aplicados
   - Estado interno das funções mudando
   - Procedimentos sendo mutados

### **Diagrama do Fluxo:**

```
ESTADO INICIAL:
├─ Card do Paciente FECHADO
├─ Repasse Médico: R$ 200,00 (calculado)
└─ expandedPatients.has(patientKey) = false

USUÁRIO CLICA NO CARD:
├─ togglePatientExpansion(patientKey) chamado
├─ expandedPatients.add(patientKey)
├─ setExpandedPatients(newSet)
└─ COMPONENTE RE-RENDERIZA

RE-RENDER:
├─ expandedPatients.has(patientKey) = true
├─ isPatientExpanded = true
├─ CollapsibleTrigger re-renderiza
├─ ❌ IIFE DO REPASSE MÉDICO EXECUTA NOVAMENTE
├─ calculateDoctorPayment() chamado NOVAMENTE
├─ ⚠️ VALOR DIFERENTE: R$ 450,00 (por exemplo)
└─ Card mostra valor ALTERADO
```

---

## 🔍 **INVESTIGAÇÃO DETALHADA DO PROBLEMA #2**

### **Possíveis Causas da Variação de Valor:**

#### **1. Ordem dos Procedimentos**
```typescript
// Se calculateDoctorPayment depende da ordem:
const proceduresWithPayment = patient.procedures
  .filter(filterCalculableProcedures) // Pode retornar em ordem diferente
  .map(...);
```

#### **2. Filtro Instável**
```typescript
// Se filterCalculableProcedures não é estável:
function filterCalculableProcedures(proc) {
  // ⚠️ Lógica que pode variar entre chamadas
  const isMedical = isMedicalProcedure(proc.procedure_code);
  const shouldCalculate = shouldCalculateAnesthetistProcedure(proc.cbo, proc.procedure_code);
  return isMedical && shouldCalculate;
}
```

#### **3. Procedimentos Duplicados ou Ausentes**
```typescript
// patient.procedures pode estar mudando entre renders
// Exemplo: [proc1, proc2] → [proc1, proc2, proc2] (duplicado)
```

#### **4. Hospital ID Mudando**
```typescript
// Se o hospitalId muda entre renders:
const hospitalId = doctor.hospitals?.[0]?.hospital_id; // Pode ser diferente
```

#### **5. Regras de Pagamento Mudando**
```typescript
// Se calculateDoctorPayment tem lógica com estado interno:
const paymentResult = calculateDoctorPayment(...);
// Pode retornar valores diferentes em chamadas sucessivas
```

---

## ✅ **SOLUÇÃO PROPOSTA**

### **Estratégia:**
1. **Memoizar o cálculo do Repasse Médico** usando `useMemo`
2. **Pré-calcular valores antes do render** do card
3. **Garantir estabilidade** dos inputs das funções de cálculo
4. **Adicionar prop `open` ao Collapsible** para controle correto
5. **Adicionar logs de debug** para monitorar mudanças

### **Implementação:**

```tsx
// ✅ SOLUÇÃO 1: Pré-calcular valores fora do JSX

// Antes do return do componente, calcular todos os valores:
const enrichedPatients = useMemo(() => {
  return doctor.patients.map(patient => {
    const patientKey = `${doctor.doctor_info.cns}-${patient.patient_info.cns}`;
    const hospitalId = doctor.hospitals?.[0]?.hospital_id;
    
    // Calcular AIH Seca (estável)
    const baseAih = typeof patient.total_value_reais === 'number'
      ? patient.total_value_reais
      : sumProceduresBaseReais(patient.procedures);
    
    // Calcular Incremento (estável)
    const careCharacter = patient.aih_info?.care_character;
    const doctorCovered = isDoctorCoveredForOperaParana(
      doctor.doctor_info.name,
      hospitalId
    );
    const increment = doctorCovered
      ? computeIncrementForProcedures(
          patient.procedures,
          careCharacter,
          doctor.doctor_info.name,
          hospitalId
        )
      : 0;
    
    // Calcular Repasse Médico (estável)
    const fixedCalc = calculateFixedPayment(doctor.doctor_info.name, hospitalId);
    const hasIndividualRules = hasIndividualPaymentRules(
      doctor.doctor_info.name,
      hospitalId
    );
    const isMonthlyFixed = isFixedMonthlyPayment(
      doctor.doctor_info.name,
      hospitalId
    );
    
    let totalPayment = 0;
    let showRepasseCard = false;
    
    if (fixedCalc.hasFixedRule && !hasIndividualRules) {
      // Fixo mensal: não mostra card
      showRepasseCard = false;
    } else if (isMonthlyFixed) {
      // Fixo mensal (outra verificação): não mostra card
      showRepasseCard = false;
    } else {
      // Calcular repasse com procedimentos filtrados
      const proceduresWithPayment = patient.procedures
        .filter(filterCalculableProcedures)
        .map((proc: any) => ({
          procedure_code: proc.procedure_code,
          procedure_description: proc.procedure_description,
          value_reais: proc.value_reais || 0,
        }));
      
      const paymentResult = calculateDoctorPayment(
        doctor.doctor_info.name,
        proceduresWithPayment,
        hospitalId
      );
      
      totalPayment = paymentResult.totalPayment || 0;
      showRepasseCard = totalPayment > 0;
    }
    
    return {
      ...patient,
      _enriched: {
        patientKey,
        baseAih,
        increment,
        hasIncrement: increment > 0,
        withIncrement: baseAih + increment,
        totalPayment,
        showRepasseCard
      }
    };
  });
}, [
  doctor.doctor_info.cns,
  doctor.doctor_info.name,
  doctor.patients,
  doctor.hospitals
]); // ✅ Dependências estáveis

// ✅ SOLUÇÃO 2: Usar valores pré-calculados no render

{enrichedPatients.map((patient) => {
  const patientKey = patient._enriched.patientKey;
  const isPatientExpanded = expandedPatients.has(patientKey);
  
  return (
    <div key={patientKey} className="...">
      <Collapsible open={isPatientExpanded}> {/* ✅ PROP OPEN ADICIONADA */}
        <CollapsibleTrigger asChild>
          <div onClick={() => togglePatientExpansion(patientKey)}>
            {/* ... conteúdo do card ... */}
            
            {/* ✅ USAR VALORES PRÉ-CALCULADOS */}
            <div className="space-y-2">
              {/* AIH SECA */}
              <div className="...">
                <span>{formatCurrency(patient._enriched.baseAih)}</span>
              </div>
              
              {/* INCREMENTO */}
              {patient._enriched.hasIncrement && (
                <div className="...">
                  <span>{formatCurrency(patient._enriched.increment)}</span>
                </div>
              )}
              
              {/* REPASSE MÉDICO */}
              {patient._enriched.showRepasseCard && (
                <div className="...">
                  <span>{formatCurrency(patient._enriched.totalPayment)}</span>
                </div>
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          {/* procedimentos */}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
})}
```

---

## 🛠️ **IMPLEMENTAÇÃO DAS CORREÇÕES**

### **Arquivo a Modificar:**
`src/components/MedicalProductionDashboard.tsx`

### **Mudanças Necessárias:**

#### **1. Adicionar `useMemo` para Pré-Cálculo**
```tsx
// Localização: Após a linha 4113, antes do map dos pacientes

const enrichedPatients = useMemo(() => {
  return doctor.patients.map(patient => {
    // ... cálculos aqui ...
  });
}, [doctor.doctor_info.cns, doctor.doctor_info.name, doctor.patients, doctor.hospitals]);
```

#### **2. Modificar Linha 4161 - Adicionar prop `open`**
```tsx
// DE:
<Collapsible>

// PARA:
<Collapsible open={isPatientExpanded}>
```

#### **3. Remover IIFE do Cálculo (Linhas 4323-4456)**
```tsx
// DE (linha 4323):
{(() => {
  const baseAih = typeof (patient as any).total_value_reais === 'number'
    ? (patient as any).total_value_reais
    : sumProceduresBaseReais(patient.procedures as any);
  // ... muitas linhas de cálculo ...
})()}

// PARA:
{/* ✅ USAR VALORES PRÉ-CALCULADOS */}
<div className="mt-3 pt-3 border-t-2 border-gray-200 space-y-2">
  {/* AIH SECA */}
  <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg p-3 border-2 border-emerald-200">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-emerald-600" />
        <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">AIH Seca</span>
      </div>
      <span className="text-lg font-black text-emerald-700">
        {formatCurrency(patient._enriched.baseAih)}
      </span>
    </div>
  </div>

  {/* INCREMENTO */}
  {patient._enriched.hasIncrement && (
    <>
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border-2 border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📈</span>
            <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">Incremento</span>
          </div>
          <span className="text-lg font-black text-blue-700">
            {formatCurrency(patient._enriched.increment)}
          </span>
        </div>
      </div>

      {/* AIH C/ INCREMENTO */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3 border-2 border-purple-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-purple-600" />
            <span className="text-xs font-bold text-purple-900 uppercase tracking-wide">AIH c/ Incremento</span>
          </div>
          <span className="text-lg font-black text-purple-700">
            {formatCurrency(patient._enriched.withIncrement)}
          </span>
        </div>
      </div>
    </>
  )}

  {/* REPASSE MÉDICO */}
  {patient._enriched.showRepasseCard && (
    <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg p-3 border-2 border-teal-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-teal-600" />
          <span className="text-xs font-bold text-teal-900 uppercase tracking-wide">Repasse Médico</span>
        </div>
        <span className="text-lg font-black text-teal-700">
          {formatCurrency(patient._enriched.totalPayment)}
        </span>
      </div>
    </div>
  )}
</div>
```

---

## 🔒 **GARANTIAS DE ESTABILIDADE**

### **1. Valores Imutáveis**
```tsx
// ✅ Calcular uma vez, usar muitas vezes
const enrichedPatients = useMemo(() => { ... }, [deps]);
```

### **2. Dependências Estáveis**
```tsx
// ✅ Apenas deps que realmente mudam
[
  doctor.doctor_info.cns,      // CNS do médico (não muda)
  doctor.doctor_info.name,     // Nome do médico (não muda)
  doctor.patients,              // Array de pacientes (muda com filtros)
  doctor.hospitals              // Array de hospitais (não muda)
]
```

### **3. Ordem Garantida**
```tsx
// ✅ Ordenar antes de mapear
const proceduresWithPayment = [...patient.procedures]
  .sort((a, b) => a.sequence - b.sequence) // Garantir ordem
  .filter(filterCalculableProcedures)
  .map(...);
```

### **4. Logs de Debug**
```tsx
// ✅ Adicionar logs para monitorar
console.log(`🔍 [${patientKey}] Cálculos:`, {
  baseAih,
  increment,
  totalPayment,
  proceduresCount: patient.procedures.length,
  timestamp: new Date().toISOString()
});
```

---

## ✅ **BENEFÍCIOS DA SOLUÇÃO**

### **Performance:**
- ✅ Cálculos executados **1 vez por paciente** (memoizados)
- ✅ Re-renders não recalculam valores
- ✅ Expansão/recolhimento instantâneo

### **Estabilidade:**
- ✅ Valores **nunca mudam** após cálculo inicial
- ✅ Expansão não afeta valores exibidos
- ✅ Comportamento previsível

### **Manutenibilidade:**
- ✅ Lógica de cálculo **separada** da renderização
- ✅ Fácil adicionar novos campos calculados
- ✅ Fácil debugar problemas

### **UX:**
- ✅ Usuário vê valores **consistentes**
- ✅ Expansão funciona **corretamente**
- ✅ Sem "pulos" ou mudanças inesperadas

---

## 🧪 **TESTES RECOMENDADOS**

### **Teste 1: Expansão Básica**
```
1. Abrir Analytics → Profissionais
2. Expandir um médico
3. Clicar no card de um paciente
4. ✅ Verificar: Procedimentos aparecem
5. ✅ Verificar: Valores não mudam
```

### **Teste 2: Expansão Múltipla**
```
1. Expandir paciente A
2. Expandir paciente B
3. Recolher paciente A
4. Recolher paciente B
5. ✅ Verificar: Valores permanecem iguais
```

### **Teste 3: Filtros**
```
1. Aplicar filtro de competência
2. Expandir médico
3. Expandir paciente
4. Mudar filtro de competência
5. ✅ Verificar: Novos valores calculados corretamente
```

### **Teste 4: Valores Específicos**
```
Paciente: LUIZ ANTONIO CORREIA
Esperado:
  - AIH SECA: R$ 770,50
  - INCREMENTO: R$ 1.155,75
  - AIH C/ INCREMENTO: R$ 1.926,25
  - REPASSE MÉDICO: R$ 200,00

1. Abrir paciente
2. ✅ Verificar: Valores exatos
3. Expandir procedimentos
4. ✅ Verificar: Valores NÃO mudaram
5. Recolher procedimentos
6. ✅ Verificar: Valores AINDA NÃO mudaram
```

---

## 📊 **EXEMPLO DE LOG DE DEBUG**

```typescript
// Adicionar no useMemo para debug:
console.log(`
🔍 CÁLCULOS DO PACIENTE
═══════════════════════════════════════
📋 Paciente: ${patient.patient_info.name}
🔑 Key: ${patientKey}
📅 Timestamp: ${new Date().toISOString()}

💰 VALORES CALCULADOS:
├─ AIH Seca: R$ ${baseAih.toFixed(2)}
├─ Incremento: R$ ${increment.toFixed(2)}
├─ C/ Incremento: R$ ${(baseAih + increment).toFixed(2)}
└─ Repasse Médico: R$ ${totalPayment.toFixed(2)}

📊 PROCEDIMENTOS:
├─ Total: ${patient.procedures.length}
├─ Calculáveis: ${proceduresWithPayment.length}
└─ Médicos 04: ${patient.procedures.filter(p => p.procedure_code.startsWith('04')).length}

🏥 CONTEXTO:
├─ Médico: ${doctor.doctor_info.name}
├─ Hospital ID: ${hospitalId}
├─ Fixo Mensal: ${isMonthlyFixed ? 'SIM' : 'NÃO'}
└─ Mostra Card Repasse: ${showRepasseCard ? 'SIM' : 'NÃO'}
═══════════════════════════════════════
`);
```

---

## 📝 **CHECKLIST DE IMPLEMENTAÇÃO**

- [ ] 1. Adicionar `import { useMemo } from 'react'` (se não existe)
- [ ] 2. Criar função `enrichedPatients` com `useMemo`
- [ ] 3. Mover todos os cálculos para dentro do `useMemo`
- [ ] 4. Adicionar prop `open={isPatientExpanded}` ao `Collapsible`
- [ ] 5. Remover IIFE dos cálculos no JSX
- [ ] 6. Usar `patient._enriched.*` para exibir valores
- [ ] 7. Adicionar logs de debug temporários
- [ ] 8. Testar expansão de pacientes
- [ ] 9. Verificar valores estáveis
- [ ] 10. Testar com diferentes médicos
- [ ] 11. Testar com diferentes filtros
- [ ] 12. Remover logs de debug
- [ ] 13. Commit das mudanças

---

## 🎯 **RESULTADO ESPERADO**

### **Antes (Bugado):**
```
USUÁRIO CLICA NO CARD DO PACIENTE
├─ ❌ Procedimentos NÃO aparecem
├─ ❌ Repasse Médico muda de R$ 200,00 para R$ 450,00
└─ ❌ Valores "pulam" na tela
```

### **Depois (Corrigido):**
```
USUÁRIO CLICA NO CARD DO PACIENTE
├─ ✅ Procedimentos aparecem instantaneamente
├─ ✅ Repasse Médico permanece R$ 200,00
├─ ✅ AIH Seca permanece R$ 770,50
├─ ✅ Incremento permanece R$ 1.155,75
└─ ✅ Todos os valores estáveis e corretos
```

---

## 🔄 **ALTERNATIVA SIMPLES (SE PREFERIR)**

Se a solução com `useMemo` parecer muito complexa, há uma alternativa mais simples:

### **Solução Alternativa: Apenas Adicionar `open`**

```tsx
// Mudança mínima: Apenas adicionar a prop open
<Collapsible open={isPatientExpanded}>
```

**Resultado:**
- ✅ Corrige o problema da expansão
- ⚠️ Pode ainda ter recálculos (menos crítico se funções forem estáveis)
- ⚠️ Performance um pouco pior (recalcula a cada render)

**Quando usar:**
- Se as funções de cálculo já forem estáveis
- Se o número de pacientes for pequeno (<50)
- Se a performance não for crítica

---

**📌 DOCUMENTO DE ANÁLISE E CORREÇÃO COMPLETO**  
**🐛 TODOS OS PROBLEMAS IDENTIFICADOS E DOCUMENTADOS**  
**✅ SOLUÇÕES PRONTAS PARA IMPLEMENTAÇÃO**

---

**Última Atualização:** 27/11/2025  
**Autor:** Análise Automatizada SigtapSync  
**Prioridade:** 🔴 ALTA (Bug crítico de UX)

