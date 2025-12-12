# 📊 ANÁLISE COMPLETA - TELA "ANÁLISE DE PERFORMANCE"

**Data da Análise**: 04 de outubro de 2025  
**Analista**: Sistema de IA especializado  
**Escopo**: Análise detalhada e sistemática da tela "Análise de Performance" (aba "procedures" do ExecutiveDashboard)

---

## 🎯 **1. LOCALIZAÇÃO E CONTEXTO**

### **1.1. Localização na Aplicação**
```
ExecutiveDashboard (Analytics)
└── Tabs
    ├── Profissionais (value="professionals")
    ├── ⭐ Análise de Performance (value="procedures") ⬅️ ESTA TELA
    └── Corpo Médico (value="medical-staff")
```

### **1.2. Componente Principal**
- **Arquivo**: `src/components/ProcedureHierarchyDashboard.tsx`
- **Renderizado por**: `ExecutiveDashboard.tsx` (linha 1355)
- **Props recebidas**:
  ```typescript
  <ProcedureHierarchyDashboard 
    dateRange={selectedDateRange} 
    selectedHospitals={selectedHospitals} 
    selectedCareCharacter={selectedCareCharacter} 
    selectedSpecialty={selectedSpecialty} 
    searchTerm={searchTerm} 
  />
  ```

### **1.3. Objetivo da Tela**
Análise avançada de procedimentos médicos com múltiplas perspectivas:
- **Análise por Médico**: Performance individual e procedimentos mais realizados
- **Análise por Especialidade**: Agregação de dados por especialidade médica
- **Análise por Hospital**: Métricas consolidadas por instituição
- **Comparativos**: Comparação entre médicos e especialidades
- **Nomes Comuns**: Agrupamento de procedimentos por nomenclatura comum
- **Gráficos**: Visualizações interativas de dados

---

## 🏗️ **2. ARQUITETURA DE COMPONENTES**

### **2.1. Componentes Principais**

#### **A) ProcedureHierarchyDashboard**
- **Responsabilidade**: Orquestração das 6 abas de análise
- **Arquivo**: `src/components/ProcedureHierarchyDashboard.tsx` (1.318 linhas)
- **Dependências**:
  - `DoctorsHierarchyV2Service`: Carregamento de dados médicos
  - `resolveCommonProcedureName`: Lógica de nomes comuns
  - `COMMON_PROCEDURE_NAME_RULES` e `CUSTOM_COMMON_PROCEDURE_NAME_RULES`: Regras de nomenclatura

#### **B) DoctorsSpecialtyComparison**
- **Responsabilidade**: Análise comparativa entre médicos e especialidades
- **Arquivo**: `src/components/DoctorsSpecialtyComparison.tsx`
- **Funcionalidades**:
  - Comparação A vs B (médicos ou especialidades)
  - Análise temporal (dia/semana)
  - Ranking e share de mercado

#### **C) AnalyticsCharts**
- **Responsabilidade**: Gráficos interativos (ECharts)
- **Arquivo**: `src/components/AnalyticsCharts.tsx`
- **Tipos de gráficos**:
  - Ranking por ticket médio
  - Share de faturamento
  - Receita por hospital
  - Receita semanal
  - Top procedimentos

---

## 🔄 **3. FLUXO DE DADOS**

### **3.1. Carregamento Inicial**

```
┌─────────────────────────────────────────────────────────┐
│ ExecutiveDashboard                                      │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Filtros Globais:                                    │ │
│ │ - dateRange (start/end)                             │ │
│ │ - selectedHospitals (array de IDs)                  │ │
│ │ - selectedCareCharacter ('1'/'2'/'3'/'4'/'all')     │ │
│ │ - selectedSpecialty (string)                        │ │
│ │ - searchTerm (busca global)                         │ │
│ └─────────────────────────────────────────────────────┘ │
│                         ↓                               │
│         [Props para ProcedureHierarchyDashboard]        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ ProcedureHierarchyDashboard                             │
│                                                          │
│ useEffect() → load()                                    │
│ ├── Converte dateRange para ISO (startDate, endDate)   │
│ ├── Prepara hospitalIds (undefined se 'all')           │
│ └── Chama DoctorsHierarchyV2Service.getDoctorsHierarchyV2() │
│                                                          │
│     ↓                                                    │
│ setDoctors(data) // Array<DoctorWithPatients>          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ DoctorsHierarchyV2Service                               │
│                                                          │
│ getDoctorsHierarchyV2(filters)                          │
│ ├── Busca AIHs da tabela aihs (com filtros SQL):       │
│ │   - admission_date >= dateFromISO                    │
│ │   - discharge_date <= dateToISO                      │
│ │   - hospital_id IN hospitalIds                       │
│ │   - care_character = selectedCareCharacter           │
│ │   - ORDER BY updated_at DESC                         │
│ │                                                        │
│ ├── Agrupa AIHs por médico (CNS)                       │
│ ├── Pré-carrega procedimentos (prefetch batch)         │
│ └── Retorna estrutura hierárquica:                      │
│     [                                                    │
│       {                                                  │
│         doctor_info: { name, cns, crm, specialty },    │
│         patients: [                                     │
│           {                                             │
│             patient_info: { name, cns },               │
│             aih_info: { aih_number, admission_date },  │
│             procedures: [ ... ],                        │
│             total_value_reais: number                   │
│           }                                             │
│         ],                                              │
│         hospitals: [ { hospital_id, hospital_name } ]  │
│       }                                                  │
│     ]                                                    │
└─────────────────────────────────────────────────────────┘
```

### **3.2. Filtragem Local (Frontend)**

```typescript
const filteredDoctors = useMemo(() => {
  return (doctors || []).filter(d => {
    // 1. Filtro por nome/CNS/CRM do médico
    const matchesDoctor = 
      name.includes(searchTerm) || 
      cns.includes(searchTerm) || 
      crm.includes(searchTerm);
    
    // 2. Filtro por código/descrição de procedimento
    const matchesProc = patient.procedures.some(proc => 
      proc.procedure_code.includes(searchTerm) || 
      proc.procedure_description.includes(searchTerm)
    );
    
    // 3. Filtro por especialidade
    if (selectedSpecialty !== 'all') {
      return d.doctor_info.specialty === selectedSpecialty;
    }
    
    return matchesDoctor || matchesProc;
  });
}, [doctors, searchTerm, selectedSpecialty]);
```

### **3.3. Exclusão de Procedimentos Anestésicos**

**Lógica aplicada em todas as agregações:**
```typescript
const isAnesthetistProcedure = (proc: any): boolean => {
  const cbo = String(proc?.cbo || '');
  const code = String(proc?.procedure_code || '');
  
  // CBO 225151 = Anestesista
  // Procedimentos 04.xxx (exceto cesariana 04.17.01.001-0)
  return cbo === '225151' && 
         code.startsWith('04') && 
         code !== '04.17.01.001-0';
};
```

**Impacto:** Procedimentos anestésicos não cirúrgicos são **excluídos** de todas as contagens e valores.

---

## 📋 **4. ABAS E FUNCIONALIDADES**

### **4.1. Aba "MÉDICOS" (value="analytics")**

#### **Estrutura Visual:**
```
┌──────────────────────────────────────────────────────────┐
│ HOSPITAL A                                     [Análises]│
├──────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Dr. João Silva                     [Excel] [Exportar]│ │
│ │ Especialidade: Cardiologia                           │ │
│ │                                                       │ │
│ │ ┌──────────┬──────────────┬──────────────┬─────────┐ │ │
│ │ │ AIHs: 25 │ Valor médio  │ Procedimentos│ Total   │ │ │
│ │ │          │ AIH: R$ 5.2k │ 87           │ R$ 42k  │ │ │
│ │ └──────────┴──────────────┴──────────────┴─────────┘ │ │
│ │                                                       │ │
│ │ Procedimentos:                                        │ │
│ │ ┌────────────────────────────────────────────────────┐│ │
│ │ │ Procedimento           │ Qtde │ Valor  │ Total    ││ │
│ │ ├────────────────────────────────────────────────────┤│ │
│ │ │ 04.08.01.033-7 ...     │  15  │ R$ 1.2k│ R$ 18k  ││ │
│ │ │ 04.08.01.045-0 ...     │  10  │ R$ 980 │ R$ 9.8k ││ │
│ │ └────────────────────────────────────────────────────┘│ │
│ │                                    [Ver mais] ↓       │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

#### **Métricas Calculadas:**
```typescript
const doctorAnalytics = {
  metrics: {
    totalAihs: patients.length,
    totalAihValue: Σ patient.total_value_reais,
    avgAihValue: totalAihValue / totalAihs,
    totalProcedures: Σ procedures.count (exceto anestesista),
    totalProceduresValue: Σ procedures.total,
    patternRate: (top3Count / totalProcedures) * 100,
    hasStrongPattern: patternRate >= 60
  },
  topProcedures: top 5 (ordenado por count, prioriza 04.xxx),
  procedures: todos (completo para expansão)
};
```

#### **Exportação (Excel CSV):**
- **Botão**: "Excel" (verde)
- **Formato**: CSV com separador `;` e decimal `,` (padrão brasileiro)
- **Conteúdo**:
  ```
  Hospital;Hospital A
  Médico;Dr. João Silva
  CNS;123456789012345
  Especialidade;Cardiologia
  
  AIHs;25
  Valor médio AIH (BRL);5.200,00
  Procedimentos;87
  Total Procedimentos (BRL);42.000,00
  
  Procedimento (código);Descrição;Qtde;Valor total (BRL)
  04.08.01.033-7;...;15;18.000,00
  ...
  ```
- **Arquivo**: `{nome_medico}_{data}.csv`

---

### **4.2. Aba "ESPECIALIDADES" (value="specialties")**

#### **Agregação:**
```typescript
const specialtyAnalytics = {
  specialty: "Cardiologia",
  doctorsCount: 8, // Médicos únicos
  metrics: {
    totalAihs: Σ allAIHs.length,
    avgAihValue: Σ totalAihValue / totalAihs,
    totalProcedures: Σ procedures.count,
    totalProceduresValue: Σ procedures.total,
    patternRate: (top3Count / totalProcedures) * 100
  },
  topProcedures: top 10 (ordenado por count)
};
```

#### **Ordenação:**
- **Critério**: `totalProceduresValue` (DESC)
- **Lógica**: Especialidades com maior faturamento aparecem primeiro

#### **Visualização:**
```
┌──────────────────────────────────────────────────────────┐
│ HOSPITAL A                              [Especialidades] │
├──────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Cardiologia                   [8 médico(s)] [Excel]  │ │
│ │                                                       │ │
│ │ AIHs: 145 │ Valor médio: R$ 4.8k │ Proc: 487 │ ...  │ │
│ │                                                       │ │
│ │ Top procedimentos da especialidade:                  │ │
│ │ ┌────────────────────────────────────────────────────┐│ │
│ │ │ 04.08.01.033-7 ...     │  85  │ R$ 102k           ││ │
│ │ └────────────────────────────────────────────────────┘│ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

#### **Exportação (Excel CSV):**
- Similar ao médico, mas com "Especialidade" e "Médicos: X"

---

### **4.3. Aba "HOSPITAIS" (value="hospitals")**

#### **Agregação Multi-Nível:**
```typescript
const hospitalAnalytics = {
  metrics: {
    totalAihs: Σ allDoctors.patients.length,
    avgAihValue: totalAihValue / totalAihs,
    totalProcedures: Σ procedures.count,
    totalProceduresValue: Σ procedures.total
  },
  topSpecialties: top 10 (ordenado por total),
  topProcedures: top 10 (ordenado por total),
  topDoctors: top 10 (ordenado por totalAihValue)
};
```

#### **Visualização:**
```
┌──────────────────────────────────────────────────────────┐
│ HOSPITAL A                    [Hospitais] [Excel] [PDF] │
├──────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Indicadores:                                          │ │
│ │ AIHs: 425 │ Valor médio: R$ 4.2k │ Proc: 1.458 │ ... │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Top especialidades por faturamento                    │ │
│ │ Cardiologia        │  487 │ R$ 2.1M                  │ │
│ │ Ortopedia          │  312 │ R$ 1.8M                  │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Top procedimentos por faturamento                     │ │
│ │ 04.08.01.033-7 ... │  85  │ R$ 102k                  │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Médicos mais performáticos                            │ │
│ │ Dr. João Silva     │ 25   │ 87   │ R$ 130k │ R$ 5.2k │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

#### **Exportação:**
- **CSV**: Arquivo consolidado com todas as seções
- **PDF**: Relatório formatado com logo, tabelas e múltiplas páginas
  - Logo: `/CIS Sem fundo.jpg`
  - Biblioteca: `jspdf` + `jspdf-autotable`
  - Formato: Landscape A4
  - Seções: Indicadores, Especialidades, Procedimentos, Médicos
  - Rodapé: Numeração de páginas + timestamp

---

### **4.4. Aba "COMPARATIVOS" (value="comparisons")**

#### **Componente:** `DoctorsSpecialtyComparison`

#### **Funcionalidades:**

**A) Comparação Direta:**
- Selecionar **Médico A** vs **Médico B**
- Selecionar **Especialidade A** vs **Especialidade B**
- Métricas comparadas:
  - Total de AIHs
  - Faturamento total
  - Ticket médio
  - Procedimentos realizados

**B) Análise Temporal:**
- **Granularidade**: Dia ou Semana
- **Gráfico de linha**: Evolução de faturamento ao longo do período
- **Comparação lado a lado**: Performance relativa

**C) Ranking:**
- **Por Ticket Médio**: Top 10 médicos/especialidades
- **Por Share de Faturamento**: Participação percentual no total

**D) Toggle "Todos os Hospitais":**
- **Desativado**: Usa filtro de hospital ativo
- **Ativado**: Carrega dados de **TODOS** os hospitais para comparação global

#### **Fluxo de Dados (Todos os Hospitais):**
```typescript
useEffect(() => {
  if (!useAllHospitals) return;
  
  const loadAllHospitals = async () => {
    const data = await DoctorsHierarchyV2Service.getDoctorsHierarchyV2({
      dateFromISO,
      dateToISO,
      hospitalIds: undefined, // ⬅️ TODOS os hospitais
      careCharacter: selectedCareCharacter
    });
    setAllHospDoctors(data);
  };
  
  loadAllHospitals();
}, [useAllHospitals, dateRange, selectedCareCharacter]);
```

---

### **4.5. Aba "NOMES COMUNS" (value="common")**

#### **Conceito:**
Agrupa procedimentos relacionados sob um **nome comum** (ex: "Cesárea", "Parto Normal", "Revascularização do Miocárdio") baseado em **regras** configuradas.

#### **Configurações:**
- **Arquivo 1**: `src/config/commonProcedureNames.ts` (COMMON_PROCEDURE_NAME_RULES)
- **Arquivo 2**: `src/config/commonProcedureNames.custom.ts` (CUSTOM_COMMON_PROCEDURE_NAME_RULES)
- **Lógica**: `src/utils/commonProcedureName.ts` → `resolveCommonProcedureName()`

#### **Estrutura de Regra:**
```typescript
{
  label: 'Cesárea',
  codes: ['04.17.01.001-0', '04.17.01.005-2'],
  priority: 1
}
```

#### **Agregação:**
```typescript
const commonNameDoctorRows = {
  doctor: "Dr. João Silva",
  cns: "123456789012345",
  aihCount: 15, // AIHs com este nome comum
  totalValue: 75000,
  avgValue: 5000, // totalValue / aihCount
  hospitalLabel: "Hospital A" | "Múltiplos"
};
```

#### **Ordenação:**
- **Critério**: `avgValue` (DESC)
- **Lógica**: Médicos com maior valor médio de AIH aparecem primeiro

#### **Toggle "Todos os Hospitais":**
- Similar ao "Comparativos", carrega dados de todos os hospitais quando ativado

#### **Visualização:**
```
┌──────────────────────────────────────────────────────────┐
│ Nome Comum × Médico × Média da AIH                       │
├──────────────────────────────────────────────────────────┤
│ Nome Comum: [Cesárea ▼]        [✕]                      │
│ Todos os Hospitais: [Ativado ✓]                         │
│                                                          │
│ ┌────────────────────────────────────────────────────────┐│
│ │ Médico         │ CNS         │ Hospital │ AIHs │ Média││
│ ├────────────────────────────────────────────────────────┤│
│ │ Dr. João Silva │ 12345...    │ Hosp A   │  15  │ R$ 5k││
│ │ Dra. Maria ... │ 98765...    │ Múltiplos│  23  │ R$ 4.8k││
│ └────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

---

### **4.6. Aba "GRÁFICOS" (value="charts")**

#### **Componente:** `AnalyticsCharts`

#### **Gráficos Disponíveis:**

**A) Ranking por Ticket Médio**
- **Tipo**: Barra horizontal
- **Biblioteca**: ECharts
- **Dados**: Top 10 médicos por `avgAihValue`
- **Cores**: Gradiente azul

**B) Share de Faturamento**
- **Tipo**: Pizza (donut)
- **Dados**: Participação percentual de cada médico no faturamento total
- **Labels**: Nome + percentual

**C) Receita por Hospital**
- **Tipo**: Barra vertical
- **Dados**: Soma de `total_value_reais` por hospital
- **Ordenação**: DESC

**D) Receita Semanal/Diária**
- **Tipo**: Linha temporal
- **Granularidade**: Selecionável (dia/semana)
- **Eixo X**: Período
- **Eixo Y**: Faturamento acumulado

**E) Top Procedimentos**
- **Tipo**: Barra horizontal
- **Dados**: Top 10 procedimentos por faturamento
- **Labels**: Código + Descrição (wrap automático)

#### **Filtro Local:**
```typescript
const [specialtyLocal, setSpecialtyLocal] = useState<string>('all');
```
- Permite filtrar gráficos por especialidade **dentro da aba**

#### **Interatividade:**
- **Hover**: Tooltip com valores detalhados
- **Click**: Expandir/recolher (dependendo do gráfico)
- **Zoom**: Arrastar para zoom (timeline)

---

## 🔧 **5. SERVIÇOS E LÓGICA DE NEGÓCIO**

### **5.1. DoctorsHierarchyV2Service**

**Arquivo**: `src/services/doctorsHierarchyV2.ts`

**Método Principal:**
```typescript
async getDoctorsHierarchyV2(filters: HierarchyFilters): Promise<DoctorWithPatients[]>
```

**Fluxo Interno:**
```
1. Aplicar filtros SQL (admission_date, discharge_date, hospital_id, care_character)
2. Buscar AIHs paginadas (ORDER BY updated_at DESC)
3. Agrupar AIHs por médico (CNS)
4. Pré-carregar procedimentos em batch (evitar N+1)
5. Estruturar hierarquia:
   - doctor_info
   - patients[] (cada AIH é um "paciente")
     - aih_info
     - procedures[]
   - hospitals[]
6. Retornar array de DoctorWithPatients
```

**Otimizações:**
- ✅ **Filtros no SQL**: Data e hospital filtrados direto no banco
- ✅ **Batch Prefetch**: Procedures carregados em lotes de 50
- ✅ **Paginação**: AIHs carregadas em páginas de 1.000 registros
- ✅ **Ordenação por updated_at**: Processados mais recentes primeiro

### **5.2. resolveCommonProcedureName()**

**Arquivo**: `src/utils/commonProcedureName.ts`

**Lógica:**
```typescript
function resolveCommonProcedureName(
  procedureCodes: string[],
  specialty?: string,
  procedures?: Array<{procedure_code, procedure_date, sequence}>
): string | null
```

**Algoritmo:**
1. Iterar sobre `CUSTOM_COMMON_PROCEDURE_NAME_RULES` (prioridade)
2. Para cada regra, verificar se **todos** os `codes` da regra estão presentes em `procedureCodes`
3. Aplicar filtros adicionais:
   - **Especialidade** (se especificada na regra)
   - **Sequência** (para diferenciar atos cirúrgicos)
   - **Data** (para agrupamento temporal)
4. Retornar o `label` da primeira regra que satisfizer todos os critérios
5. Se nenhuma regra corresponder, iterar sobre `COMMON_PROCEDURE_NAME_RULES`
6. Retornar `null` se nenhuma correspondência

**Exemplo de Regra:**
```typescript
{
  label: 'Revascularização do Miocárdio',
  codes: ['04.08.01.033-7', '04.08.01.045-0'],
  specialty: 'Cirurgia Cardiovascular',
  priority: 1
}
```

### **5.3. AnalyticsService**

**Arquivo**: `src/services/analyticsService.ts`

**Responsabilidade:**
- Agregações temporais (dia/semana/mês)
- Ranking e share de faturamento
- Análises comparativas

---

## 📊 **6. ESTRUTURA DE DADOS**

### **6.1. Tipo Principal: DoctorWithPatients**

```typescript
interface DoctorWithPatients {
  doctor_info: {
    name: string;
    cns: string;
    crm?: string;
    specialty?: string;
  };
  patients: Array<{
    patient_info: {
      name: string;
      cns: string;
      birth_date?: string;
    };
    aih_info: {
      aih_number: string;
      admission_date: string;
      discharge_date?: string;
      hospital_id: string;
      hospital_name?: string;
    };
    procedures: Array<{
      procedure_code: string;
      procedure_description: string;
      procedure_date: string;
      value_reais: number;
      cbo?: string;
      professional_name?: string;
      sequence?: number;
    }>;
    total_value_reais: number;
  }>;
  hospitals: Array<{
    hospital_id: string;
    hospital_name: string;
  }>;
}
```

### **6.2. Fluxo de Transformação**

```
DATABASE (aihs table)
  ↓
DoctorsHierarchyV2Service
  ↓
DoctorWithPatients[]
  ↓
filteredDoctors (frontend filter)
  ↓
doctorAnalytics (aggregations)
  ↓
VISUALIZAÇÃO (6 abas)
```

---

## 🎨 **7. INTERFACE E UX**

### **7.1. Sistema de Abas**

```typescript
<Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
  <TabsList className="bg-slate-100">
    <TabsTrigger value="analytics">Médicos</TabsTrigger>
    <TabsTrigger value="specialties">Especialidades</TabsTrigger>
    <TabsTrigger value="hospitals">Hospitais</TabsTrigger>
    <TabsTrigger value="comparisons">Comparativos</TabsTrigger>
    <TabsTrigger value="common">Nomes Comuns</TabsTrigger>
    <TabsTrigger value="charts">Gráficos</TabsTrigger>
  </TabsList>
  {/* ... */}
</Tabs>
```

### **7.2. Componentes UI Utilizados**

| Componente | Biblioteca | Uso |
|------------|-----------|-----|
| `Card` | Shadcn/UI | Container principal de dados |
| `Badge` | Shadcn/UI | Tags e indicadores |
| `Button` | Shadcn/UI | Ações e exportação |
| `Switch` | Shadcn/UI | Toggle "Todos os Hospitais" |
| `Collapsible` | Shadcn/UI | Expandir/recolher listas |
| `Tabs` | Shadcn/UI | Sistema de abas |
| `Input` | Shadcn/UI | Filtros de busca |
| `Alert` | Shadcn/UI | Mensagens de estado vazio |
| `ReactECharts` | echarts-for-react | Gráficos interativos |

### **7.3. Estados de Expansão**

```typescript
// Expandir lista completa de procedimentos (médicos)
const [expandedDoctors, setExpandedDoctors] = useState<Record<string, boolean>>({});

// Expandir lista completa de procedimentos (especialidades)
const [expandedSpecialties, setExpandedSpecialties] = useState<Record<string, boolean>>({});
```

**Lógica:**
- Por padrão, mostrar **5 primeiros** procedimentos
- Botão "Ver mais" expande para **todos**
- Botão "Ver menos" recolhe para **5 primeiros**

### **7.4. Loading States**

```typescript
if (loading) {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="text-slate-500">Carregando procedimentos...</div>
    </div>
  );
}
```

---

## 🔐 **8. CONTROLE DE ACESSO**

### **8.1. Herança de Filtros do ExecutiveDashboard**

```typescript
// ExecutiveDashboard já controla:
// - Hospitais permitidos para o usuário
// - RLS (Row Level Security) no banco
// - Permissões por role (Director, Admin, Coordinator)

// ProcedureHierarchyDashboard recebe apenas dados já filtrados
```

### **8.2. Toggle "Todos os Hospitais"**

**Validação:**
```typescript
// Se o usuário não tem acesso global:
// - O toggle "Todos os Hospitais" deve ser bloqueado
// - Ou: carregar apenas hospitais permitidos mesmo com toggle ativo

// Atualmente: Sem validação explícita (assumindo RLS no backend)
```

---

## 📈 **9. PERFORMANCE E OTIMIZAÇÕES**

### **9.1. Otimizações Implementadas**

✅ **Filtros no SQL**
- `admission_date`, `discharge_date`, `hospital_id`, `care_character` filtrados no banco
- Reduz transferência de dados

✅ **Prefetch de Procedimentos**
- Batch loading em lotes de 50
- Evita N+1 query problem

✅ **Memoization**
- `useMemo()` para `filteredDoctors`, `doctorAnalytics`, `hospitalsList`, etc.
- Recomputa apenas quando dependências mudam

✅ **Ordenação Otimizada**
- Prioriza procedimentos `04.xxx` (cirúrgicos)
- Ordena por `count` DESC

✅ **Paginação**
- AIHs carregadas em páginas de 1.000
- Evita timeout em hospitais grandes

### **9.2. Possíveis Gargalos**

⚠️ **Carregamento Inicial**
- Se um hospital tem 10.000+ AIHs, o carregamento inicial pode demorar
- **Solução potencial**: Lazy loading por aba

⚠️ **Agregações Frontend**
- Todas as agregações (médico, especialidade, hospital) são feitas no frontend
- **Solução potencial**: Mover para backend (materialized views)

⚠️ **Gráficos ECharts**
- Renderizar 6 gráficos simultaneamente pode impactar performance
- **Solução potencial**: Lazy render (carregar apenas quando aba ativada)

---

## 📤 **10. EXPORTAÇÃO DE DADOS**

### **10.1. Formato CSV (Excel)**

**Características:**
- Separador: `;` (padrão brasileiro)
- Decimal: `,` (não `.`)
- Encoding: UTF-8 com BOM (`\uFEFF`)
- MIME Type: `text/csv;charset=utf-8;`

**Estrutura:**
```csv
Hospital;Hospital A
Médico;Dr. João Silva
CNS;123456789012345
Especialidade;Cardiologia

AIHs;25
Valor médio AIH (BRL);5.200,00
Procedimentos;87
Total Procedimentos (BRL);42.000,00

Procedimento (código);Descrição;Qtde;Valor total (BRL)
04.08.01.033-7;Revascularização...;15;18.000,00
```

### **10.2. Formato PDF**

**Biblioteca:** `jspdf` + `jspdf-autotable`

**Estrutura:**
```
┌─────────────────────────────────────────┐
│ [Logo CIS]                              │
│                                          │
│ Relatório — Hospital                    │
│ Hospital: Hospital A  •  Período: ...   │
├─────────────────────────────────────────┤
│ INDICADORES                             │
│ ┌───────────────────────────────────────┐│
│ │ AIHs │ Valor médio │ Proc │ Total    ││
│ └───────────────────────────────────────┘│
│                                          │
│ TOP ESPECIALIDADES POR FATURAMENTO      │
│ ┌───────────────────────────────────────┐│
│ │ Especialidade │ Qtde │ Valor         ││
│ └───────────────────────────────────────┘│
│                                          │
│ TOP PROCEDIMENTOS POR VALOR             │
│ ...                                      │
│                                          │
│ MÉDICOS MAIS PERFORMÁTICOS              │
│ ...                                      │
├─────────────────────────────────────────┤
│ Página 1 de 2        Gerado em 04/10...│
└─────────────────────────────────────────┘
```

**Configuração:**
- Orientação: Landscape (horizontal)
- Formato: A4
- Margens: 40pt
- Cores: Azul (#1E40AF) + Cinza claro (tabelas)
- Logo: `/CIS Sem fundo.jpg` (proporção 624x339)

---

## 🐛 **11. BUGS E LIMITAÇÕES IDENTIFICADAS**

### **11.1. Toggle "Todos os Hospitais" sem Validação**

**Problema:**
- Qualquer usuário pode ativar "Todos os Hospitais" nos comparativos e nomes comuns
- Não há validação de permissão

**Impacto:**
- Usuário com acesso restrito pode ver dados de outros hospitais

**Solução Sugerida:**
```typescript
const canAccessAllHospitals = useAuth().canAccessAllHospitals;

<Switch 
  checked={includeAllHospitalsCommon} 
  onCheckedChange={setIncludeAllHospitalsCommon}
  disabled={!canAccessAllHospitals} // ⬅️ Adicionar
/>
```

### **11.2. Procedimentos Anestésicos**

**Problema:**
- A exclusão de procedimentos anestésicos (`isAnesthetistProcedure()`) é aplicada de forma inconsistente
- Alguns cálculos podem incluir indevidamente

**Impacto:**
- Valores financeiros podem estar levemente inflados

**Solução Sugerida:**
- Centralizar a lógica de exclusão em um helper único
- Aplicar consistentemente em TODAS as agregações

### **11.3. Nomes Comuns: Resolução Complexa**

**Problema:**
- A lógica de `resolveCommonProcedureName()` é complexa e pode falhar silenciosamente
- Sem logs de debug, difícil rastrear por que um procedimento não foi agrupado

**Solução Sugerida:**
- Adicionar logs detalhados no console (development only)
- Interface de "Procedimentos Não Agrupados" para revisão

### **11.4. Performance com Muitos Dados**

**Problema:**
- Hospitais com 10.000+ AIHs podem causar timeout ou travamento

**Solução Sugerida:**
- Paginação no frontend (virtual scrolling)
- Lazy loading por aba

---

## 🔍 **12. INTEGRAÇÃO COM FILTROS GLOBAIS**

### **12.1. Filtros Herdados do ExecutiveDashboard**

```typescript
interface ProcedureHierarchyDashboardProps {
  dateRange?: DateRange;           // ✅ Aplicado no SQL
  selectedHospitals?: string[];    // ✅ Aplicado no SQL
  selectedCareCharacter?: string;  // ✅ Aplicado no SQL
  selectedSpecialty?: string;      // ✅ Aplicado no frontend
  searchTerm?: string;             // ✅ Aplicado no frontend
}
```

### **12.2. Sincronização de Estado**

```typescript
// Quando filtros globais mudam, dispara re-load:
useEffect(() => {
  load();
}, [
  dateRange?.startDate?.toISOString(), 
  dateRange?.endDate?.toISOString(), 
  JSON.stringify(selectedHospitals), 
  selectedCareCharacter
]);
```

### **12.3. Filtros Locais Adicionais**

**Aba "Nomes Comuns":**
```typescript
const [selectedCommonName, setSelectedCommonName] = useState<string>('all');
const [includeAllHospitalsCommon, setIncludeAllHospitalsCommon] = useState<boolean>(false);
```

**Aba "Gráficos":**
```typescript
const [specialtyLocal, setSpecialtyLocal] = useState<string>('all');
const [granularity, setGranularity] = useState<'week' | 'day'>('week');
```

**Aba "Comparativos":**
```typescript
const [compareA, setCompareA] = useState<string>('');
const [compareB, setCompareB] = useState<string>('');
const [sortBy, setSortBy] = useState<'doctor' | 'specialty'>('doctor');
```

---

## 📝 **13. RESUMO EXECUTIVO**

### **13.1. Pontos Fortes**

✅ **Múltiplas Perspectivas de Análise**
- 6 abas com visões complementares
- Granularidade ajustável (médico → especialidade → hospital)

✅ **Exportação Profissional**
- CSV compatível com Excel brasileiro
- PDF formatado com logo e tabelas

✅ **Performance Otimizada**
- Filtros no SQL
- Prefetch de procedimentos
- Memoization

✅ **UX Intuitiva**
- Expandir/recolher listas
- Filtros locais por aba
- Loading states claros

✅ **Lógica de Negócio Avançada**
- Nomes comuns para agrupamento
- Exclusão inteligente de anestesistas
- Priorização de procedimentos cirúrgicos

### **13.2. Áreas de Melhoria**

⚠️ **Validação de Permissões**
- Toggle "Todos os Hospitais" sem validação

⚠️ **Performance em Larga Escala**
- Agregações frontend podem ser lentas com 10.000+ AIHs

⚠️ **Logs de Debug**
- Difícil rastrear por que nomes comuns não resolvem

⚠️ **Testes**
- Sem testes automatizados para agregações complexas

### **13.3. Impacto no Sistema**

- **Usuários Alvo**: Diretores, Administradores, Coordenadores
- **Frequência de Uso**: Diária (análise de performance médica)
- **Criticidade**: **ALTA** (decisões financeiras e operacionais)
- **Complexidade**: **MUITO ALTA** (código mais complexo do sistema)

---

## ✅ **14. CONCLUSÃO**

A tela **"Análise de Performance"** é um componente **crítico e altamente sofisticado** do sistema, oferecendo **6 perspectivas complementares** de análise de procedimentos médicos.

**Principais Características:**
1. **Arquitetura Hierárquica**: Médico → Paciente (AIH) → Procedimentos
2. **Múltiplas Visualizações**: Analytics, Especialidades, Hospitais, Comparativos, Nomes Comuns, Gráficos
3. **Otimizações Avançadas**: SQL filters, batch prefetch, memoization
4. **Exportação Profissional**: CSV (Excel) e PDF formatado
5. **Lógica de Negócio Complexa**: Nomes comuns, exclusão de anestesistas, priorização cirúrgica

**Recomendações:**
- ✅ Adicionar validação de permissões no toggle "Todos os Hospitais"
- ✅ Implementar paginação frontend para hospitais grandes
- ✅ Adicionar logs de debug para nomes comuns (development)
- ✅ Considerar mover agregações para backend (materialized views)
- ✅ Implementar testes automatizados para cálculos críticos

**Status**: ✅ **FUNCIONAL E PRONTO PARA PRODUÇÃO** (com melhorias sugeridas)

---

**Documento gerado em**: 04 de outubro de 2025  
**Versão**: 1.0  
**Próxima revisão**: Após implementação de melhorias
