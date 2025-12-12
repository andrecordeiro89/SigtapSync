# 🔄 ANÁLISE COMPLETA E SISTEMÁTICA DA TELA SYNC

## 📋 **SUMÁRIO EXECUTIVO**

A tela **Sync** possui **DUAS VERSÕES DISTINTAS** implementadas no sistema, cada uma com propósitos e fontes de dados específicas:

1. **SyncPage.tsx** (Versão Nova) - Reconciliação **AIH Avançado vs SISAIH01**
2. **SyncDashboard.tsx** (Versão Antiga) - Reconciliação **Tabwin (GSUS) vs Sistema**

Ambas estão ativas e acessíveis no menu de navegação através de diferentes IDs:
- `aih-sync` → **SyncPage** (Nova versão)
- `sync` → **SyncDashboard** (Versão antiga)

---

## 🎯 **VERSÃO 1: SYNCPAGE - AIH AVANÇADO VS SISAIH01**

### **📊 PROPÓSITO**
Reconciliar dados processados internamente no sistema (via AIH Avançado) com dados confirmados oficialmente pelo SUS (via SISAIH01), identificando:
- AIHs sincronizadas (presentes em ambas as bases)
- AIHs pendentes de confirmação SUS (apenas no sistema)
- AIHs não processadas no sistema (apenas no SISAIH01)

---

### **🗄️ TABELAS E COLUNAS CONSUMIDAS**

#### **1. Tabela: `hospitals`**
**Propósito:** Carregar lista de hospitais disponíveis

**Colunas utilizadas:**
```sql
SELECT id, name
FROM hospitals
ORDER BY name
```

**Quando é usada:**
- Ao montar o componente (`useEffect` inicial)
- No botão "Atualizar" (função `carregarOpcoes`)

**Filtros aplicados:**
- Nenhum filtro na query (RLS controla o acesso)

---

#### **2. Tabela: `aihs` (AIH Avançado - Etapa 1)**
**Propósito:** Buscar AIHs processadas no sistema interno

**Colunas utilizadas:**
```sql
SELECT 
  aih_number,
  patient_id,
  admission_date,
  competencia,
  created_at,
  total_procedures,
  procedure_requested,
  calculated_total_value
FROM aihs
WHERE hospital_id = ?
```

**Processamento adicional:**
- Filtragem por competência no **cliente** (suporta formatos: `YYYY-MM-DD` e `AAAAMM`)
- Normalização de competência: `2025-10-01` → `202510`

**Filtros aplicados:**
```javascript
// Filtro servidor (Supabase)
.eq('hospital_id', hospitalAIHSelecionado)

// Filtro cliente (JavaScript)
aihsFiltradas = aihsData.filter(aih => {
  let compAih = aih.competencia;
  if (compAih.includes('-') && compAih.length === 10) {
    compAih = compAih.substring(0, 7).replace('-', ''); // "2025-10" -> "202510"
  }
  return compAih === competenciaAIHSelecionada;
});
```

---

#### **3. Tabela: `aih_registros` (SISAIH01 - Etapa 2)**
**Propósito:** Buscar registros confirmados oficialmente pelo SUS

**Colunas utilizadas:**
```sql
SELECT 
  numero_aih,
  nome_paciente,
  data_internacao,
  competencia,
  hospital_id,
  created_at
FROM aih_registros
WHERE hospital_id = ?
```

**Estrutura da tabela `aih_registros`:**
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Chave primária |
| `numero_aih` | VARCHAR(13) | Número único da AIH |
| `tipo_aih` | VARCHAR(2) | 01=Principal, 03=Continuação |
| `cnes_hospital` | VARCHAR(7) | CNES do hospital |
| `competencia` | VARCHAR(6) | Competência (formato AAAAMM) |
| `data_internacao` | DATE | Data de admissão |
| `data_saida` | DATE | Data de alta |
| `nome_paciente` | VARCHAR(70) | Nome do paciente |
| `cns` | VARCHAR(15) | Cartão Nacional de Saúde |
| `medico_responsavel` | VARCHAR(15) | CPF/CNS do médico |
| `hospital_id` | UUID | FK para hospitals |

**Processamento adicional:**
- Filtragem por competência no **cliente** (suporta múltiplos formatos)
- Normalização de competência:
  - `2025-10-01` → `202510`
  - `10/2025` → `202510`

**Filtros aplicados:**
```javascript
// Filtro servidor (Supabase)
.eq('hospital_id', hospitalSISAIH01Selecionado)

// Filtro cliente (JavaScript)
sisaih01Filtrados = sisaih01Data.filter(aih => {
  let compAih = aih.competencia;
  
  // Converter YYYY-MM-DD para AAAAMM
  if (compAih.includes('-') && compAih.length === 10) {
    compAih = compAih.substring(0, 7).replace('-', '');
  }
  
  // Converter MM/YYYY para AAAAMM
  if (compAih.includes('/') && compAih.length === 7) {
    const [mes, ano] = compAih.split('/');
    compAih = `${ano}${mes}`;
  }
  
  return compAih === competenciaSISAIH01Selecionada;
});
```

---

#### **4. Tabela: `sigtap_procedures` (Enriquecimento - Etapa 3)**
**Propósito:** Buscar descrições dos procedimentos para exibição na tabela de resultados

**Colunas utilizadas:**
```sql
SELECT code, description
FROM sigtap_procedures
WHERE code IN (lista_de_códigos)
```

**Quando é usada:**
- Após a sincronização (Etapa 3)
- Apenas para procedimentos que tiveram match

**Processamento adicional:**
- Tentativa de match com código original
- Fallback para código sem formatação (apenas números)
- Criação de mapa: `código → descrição`

---

### **⚙️ LÓGICA DE SINCRONIZAÇÃO (ETAPA 3)**

#### **Algoritmo de Matching:**

```javascript
// 1. Normalizar números AIH (remover todos os não-dígitos)
const normalizarNumeroAIH = (numero: string): string => {
  return numero.replace(/\D/g, '');
};

// 2. Criar mapas para busca rápida
const mapAIHAvancado = new Map<string, any>();
aihsEncontradas.forEach(aih => {
  const numeroNormalizado = normalizarNumeroAIH(aih.aih_number);
  if (numeroNormalizado.length >= 10) {
    mapAIHAvancado.set(numeroNormalizado, aih);
  }
});

const mapSISAIH01 = new Map<string, any>();
sisaih01Encontrados.forEach(aih => {
  const numeroNormalizado = normalizarNumeroAIH(aih.numero_aih);
  if (numeroNormalizado.length >= 10) {
    mapSISAIH01.set(numeroNormalizado, aih);
  }
});

// 3. Comparação e classificação
numerosUnicos.forEach(numeroNormalizado => {
  const aihAvancado = mapAIHAvancado.get(numeroNormalizado);
  const sisaih01 = mapSISAIH01.get(numeroNormalizado);

  let status: 'sincronizado' | 'pendente' | 'nao_processado';

  if (aihAvancado && sisaih01) {
    // Existe em ambas as bases → SINCRONIZADO ✅
    status = 'sincronizado';
    sincronizados++;
  } else if (aihAvancado && !sisaih01) {
    // Existe apenas no AIH Avançado → PENDENTE ⏳
    status = 'pendente';
    pendentes++;
  } else {
    // Existe apenas no SISAIH01 → NÃO PROCESSADO ❌
    status = 'nao_processado';
    naoProcessados++;
  }
});
```

#### **Validações e Filtros:**

1. **Validação de número AIH:**
   - Deve ter no mínimo 10 dígitos após normalização
   - AIHs inválidas são contabilizadas e ignoradas

2. **Normalização de datas:**
   - Suporta múltiplos formatos de competência
   - Conversão padronizada para `AAAAMM`

3. **Tolerância de matching:**
   - Match exato por número AIH normalizado
   - Sem validação de valor ou quantidade

---

### **📊 RESULTADO DA SINCRONIZAÇÃO**

#### **KPIs Exibidos:**

| Métrica | Descrição | Fonte |
|---------|-----------|-------|
| **AIH Avançado** | Total de AIHs processadas no sistema | `aihsEncontradas.length` |
| **Sincronizados** | AIHs encontradas em ambas as bases | `resultadoSync.sincronizados` |
| **Pendentes SUS** | AIHs aguardando confirmação | `resultadoSync.pendentes` |
| **Não Processados** | AIHs não cadastradas no sistema | `resultadoSync.naoProcessados` |

#### **Taxa de Sincronização:**
```javascript
const taxa = (sincronizados / sisaih01Encontrados.length) * 100;
// Exemplo: (150 / 200) * 100 = 75%
```

#### **Tabela de AIHs Sincronizadas:**

**Colunas exibidas:**
1. **#** - Número sequencial
2. **Número AIH** - Número normalizado (font-mono)
3. **Paciente** - Nome do paciente (do SISAIH01)
4. **Data Intern.** - Data de internação formatada (DD/MM/YYYY)
5. **Qtd.** - Total de procedimentos (badge azul)
6. **Procedimento Principal** - Código + Descrição (do SIGTAP)
7. **Valor Total** - Valor calculado em reais (convertido de centavos)

**Dados exibidos:**
```javascript
{
  numero_aih: detalhe.numero_aih,
  paciente: detalhe.sisaih01?.nome_paciente,
  data_internacao: detalhe.sisaih01?.data_internacao,
  quantidade: detalhe.aih_avancado?.total_procedures,
  codigo_procedimento: detalhe.aih_avancado?.procedure_requested,
  descricao_procedimento: detalhe.procedure_description,
  valor_total: (detalhe.aih_avancado?.calculated_total_value / 100)
}
```

**Cálculo do valor total:**
```javascript
const valorTotalReais = resultadoSync.detalhes
  .filter(d => d.status === 'sincronizado')
  .reduce((acc, d) => acc + (d.aih_avancado?.calculated_total_value || 0), 0) / 100;

// Formatação em moeda brasileira
new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
}).format(valorTotalReais);
```

---

### **🔐 CONTROLE DE ACESSO**

#### **Modo Administrador:**
```javascript
const isAdminMode = canAccessAllHospitals() || user.full_access || user.hospital_id === 'ALL';
```

**Comportamento:**
- ✅ **Admin/Diretoria:** Pode selecionar qualquer hospital
- 🔒 **Operador:** Hospital fixo (pré-selecionado)

#### **Pré-seleção de hospital:**
```javascript
if (!canAccessAllHospitals() && userHospitalId && userHospitalId !== 'ALL') {
  setHospitalAIHSelecionado(userHospitalId);
  setHospitalSISAIH01Selecionado(userHospitalId);
  console.log('🏥 Hospital pré-selecionado (modo operador)');
}
```

---

### **🎨 INTERFACE E UX**

#### **Fluxo em 3 Etapas:**

```
┌─────────────────────────────────────────────────────────────┐
│ ETAPA 1: AIH Avançado (Azul)                               │
│ ─────────────────────────────────────────────────────────  │
│ [Dropdown Hospital] [Dropdown Competência]                 │
│ [Botão: Buscar AIHs] → Verde quando concluído ✓           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ ETAPA 2: SISAIH01 (Roxo)                                   │
│ ─────────────────────────────────────────────────────────  │
│ [Dropdown Hospital] [Dropdown Competência]                 │
│ [Botão: Buscar SISAIH01] → Verde quando concluído ✓       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ ETAPA 3: Executar Sincronização (Gradiente)                │
│ ─────────────────────────────────────────────────────────  │
│ [Botão Grande: Executar Sincronização]                     │
│ Gradiente: purple → pink → indigo                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ RESULTADO: KPIs e Tabela de Sincronizados                  │
│ ─────────────────────────────────────────────────────────  │
│ [4 Cards KPI] [Tabela Detalhada] [Botão: Nova Sinc.]      │
└─────────────────────────────────────────────────────────────┘
```

#### **Estados Visuais:**

1. **Etapa Não Iniciada:**
   - Border: `border-blue-200` (Etapa 1) ou `border-purple-200` (Etapa 2)
   - Background: `from-blue-50 to-indigo-50`

2. **Etapa Concluída:**
   - Border: `border-green-300 bg-green-50/30`
   - Badge: `✓ X AIHs` ou `✓ X Registros`
   - Botão: Verde + texto "✓ Etapa X Concluída"

3. **Etapa Bloqueada:**
   - Opacity: `opacity-50 cursor-not-allowed`
   - Mensagem: "Complete a Etapa 1 primeiro"

#### **Formatação de Dados:**

**Competência (AAAAMM → MM/YYYY):**
```javascript
const formatarCompetencia = (comp: string) => {
  if (!comp || comp.length !== 6) return comp;
  return `${comp.substring(4, 6)}/${comp.substring(0, 4)}`;
  // "202510" → "10/2025"
};
```

**Data (ISO → DD/MM/YYYY):**
```javascript
new Date(dateString).toLocaleDateString('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});
```

**Valor (centavos → R$):**
```javascript
new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
}).format(valueCents / 100);
```

---

### **🔍 LOGS E DEBUG**

#### **Logs Principais:**

```javascript
// Carregamento inicial
console.log('📋 Carregando hospitais e competências da tabela aihs...');
console.log(`✅ ${hospitais.length} hospitais carregados`);
console.log(`✅ ${competenciasUnicas.length} competências únicas encontradas`);

// Etapa 1
console.log('🔍 ETAPA 1 - Buscando AIHs do AIH Avançado...');
console.log(`🏥 Hospital: ${hospitalAIHSelecionado}`);
console.log(`📅 Competência: ${competenciaAIHSelecionada}`);
console.log(`✅ ${aihsFiltradas.length} AIHs encontradas`);

// Etapa 2
console.log('🔍 ETAPA 2 - Buscando registros do SISAIH01...');
console.log(`✅ ${sisaih01Filtrados.length} registros SISAIH01 encontrados`);

// Etapa 3 (Sincronização)
console.log('🔄 ETAPA 3 - Executando sincronização...');
console.log(`📋 Mapa AIH Avançado: ${mapAIHAvancado.size} registros válidos`);
console.log(`📋 Mapa SISAIH01: ${mapSISAIH01.size} registros válidos`);
console.log(`🔍 Total de números AIH únicos: ${numerosUnicos.size}`);

// Resultado
console.log('📊 RESULTADO DA SINCRONIZAÇÃO:');
console.log(`   ✅ Sincronizados: ${sincronizados}`);
console.log(`   ⏳ Pendentes Confirmação: ${pendentes}`);
console.log(`   ❌ Não Processados: ${naoProcessados}`);
console.log(`   📈 Taxa: ${((sincronizados / mapSISAIH01.size) * 100).toFixed(2)}%`);
```

---

## 🎯 **VERSÃO 2: SYNCDASHBOARD - TABWIN VS SISTEMA**

### **📊 PROPÓSITO**
Reconciliar relatórios XLSX do Tabwin (GSUS) com dados do sistema, identificando:
- Matches (registros encontrados em ambas as bases)
- Glosas possíveis (no Tabwin mas não no sistema)
- Rejeições possíveis (no sistema mas não no Tabwin)
- Diferenças de valor e quantidade

---

### **🗄️ TABELAS E COLUNAS CONSUMIDAS**

#### **1. Tabela: `hospitals`**
**Propósito:** Carregar lista de hospitais

**Colunas utilizadas:**
```sql
SELECT id, name, cnes
FROM hospitals
WHERE is_active = true
ORDER BY name
```

**Filtros aplicados:**
- `is_active = true`
- RLS automático por usuário

---

#### **2. Tabela: `aihs` (Para Competências)**
**Propósito:** Listar competências disponíveis

**Colunas utilizadas:**
```sql
SELECT competencia
FROM aihs
WHERE hospital_id = ?
  AND competencia IS NOT NULL
ORDER BY competencia DESC
```

---

#### **3. Service: `DoctorPatientService`**
**Propósito:** Buscar dados do sistema para reconciliação

**Função chamada:**
```javascript
DoctorPatientService.getDoctorsWithPatientsFromProceduresView({
  hospitalIds: [hospitalId],
  competencia: competencia
})
```

**Dados retornados:**
```javascript
{
  doctor_info: { name, cns, crm, specialty },
  hospitals: [{ hospital_id, hospital_name }],
  patients: [{
    patient_info: { name, cns },
    aih_info: { aih_number, admission_date, discharge_date },
    procedures: [{
      procedure_code,
      procedure_description,
      procedure_date,
      value_reais,
      quantity
    }]
  }]
}
```

**Tabelas envolvidas indiretamente:**
- `aihs` (via service)
- `patients` (via join)
- `procedure_records` (via view)
- `doctors` (via join)
- `hospitals` (via join)

---

### **📁 ARQUIVO TABWIN (XLSX)**

#### **Colunas Obrigatórias:**

| Coluna | Descrição | Tipo |
|--------|-----------|------|
| `SP_NAIH` | Número da AIH | String |
| `SP_ATOPROF` | Código do Procedimento | String |
| `SP_VALATO` | Valor do Ato | Number (R$) |

#### **Colunas Opcionais:**

| Coluna | Descrição | Tipo |
|--------|-----------|------|
| `SP_DTINTER` | Data de Internação | String/Date |
| `SP_DTSAIDA` | Data de Saída | String/Date |
| `SP_QTD_ATO` | Quantidade do Ato | Number |
| `SP_PF_DOC` | Documento do Profissional | String |

#### **Processamento do Arquivo:**

```javascript
// 1. Ler arquivo Excel
const workbook = XLSX.read(arrayBuffer);
const worksheet = workbook.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// 2. Encontrar linha de cabeçalho (buscar por SP_NAIH)
for (let i = 0; i < Math.min(20, rawData.length); i++) {
  if (row.some(cell => String(cell).toUpperCase().includes('SP_NAIH'))) {
    headerRowIndex = i;
    break;
  }
}

// 3. Mapear colunas
const headers = rawData[headerRowIndex].map(h => String(h).toUpperCase().trim());
const sp_naih_idx = headers.findIndex(h => h.includes('SP_NAIH'));
const sp_atoprof_idx = headers.findIndex(h => h.includes('SP_ATOPROF'));
const sp_valato_idx = headers.findIndex(h => h.includes('SP_VALATO'));

// 4. Extrair registros
records.push({
  sp_naih: aih,
  sp_atoprof: normalizedProc, // Código sem pontos e traços
  sp_qtd_ato: Number(row[sp_qtd_ato_idx]) || 1,
  sp_valato: Number(row[sp_valato_idx]) || 0
});
```

---

### **⚙️ LÓGICA DE RECONCILIAÇÃO**

#### **Algoritmo de Matching:**

```javascript
// 1. Criar mapa de registros do sistema
const systemMap = new Map<string, SystemRecord[]>();
for (const sysRec of systemRecords) {
  const key = `${sysRec.aih_number}_${sysRec.procedure_code}`;
  systemMap.set(key, [...]);
}

// 2. Processar registros do Tabwin
for (const tabwinRec of tabwinRecords) {
  const key = `${tabwinRec.sp_naih}_${tabwinRec.sp_atoprof}`;
  const systemMatches = systemMap.get(key);

  if (!systemMatches) {
    // Não encontrado no sistema → GLOSA POSSÍVEL
    tabwinLeftovers.push({
      aih_number: tabwinRec.sp_naih,
      procedure_code: tabwinRec.sp_atoprof,
      source: 'tabwin',
      reason: 'not_in_system'
    });
    continue;
  }

  // Match encontrado → Verificar diferenças
  const systemRec = systemMatches[0];
  const tabwinValueCents = Math.round(tabwinRec.sp_valato * 100);
  const systemValueCents = systemRec.total_value;
  const valueDiff = Math.abs(tabwinValueCents - systemValueCents);
  const quantityDiff = Math.abs(tabwinRec.sp_qtd_ato - systemRec.quantity);

  let status = 'matched';
  if (valueDiff > 50) { // Tolerância: R$ 0,50
    status = 'value_diff';
  } else if (quantityDiff > 0) {
    status = 'quantity_diff';
  }

  matches.push({ tabwin_data, system_data, status, value_difference, quantity_difference });
}

// 3. Identificar sobras no sistema (REJEIÇÕES POSSÍVEIS)
for (const [key, systemRecs] of systemMap.entries()) {
  if (!processedSystemKeys.has(key)) {
    systemLeftovers.push({
      aih_number: systemRec.aih_number,
      procedure_code: systemRec.procedure_code,
      source: 'system',
      reason: 'not_in_tabwin'
    });
  }
}
```

#### **Tolerâncias:**

1. **Valor:** Diferença de até **R$ 0,50** (50 centavos) é considerada match perfeito
2. **Quantidade:** Qualquer diferença é sinalizada

---

### **📊 RESULTADO DA RECONCILIAÇÃO**

#### **KPIs Exibidos:**

| Métrica | Descrição | Cor |
|---------|-----------|-----|
| **Matches Perfeitos** | Valor e quantidade iguais | Verde |
| **Diferenças de Valor** | Valores diferentes (>R$ 0,50) | Amarelo |
| **Diferenças de Qtd** | Quantidades diferentes | Laranja |
| **Possíveis Glosas** | No Tabwin mas não no sistema | Vermelho |
| **Possíveis Rejeições** | No sistema mas não no Tabwin | Azul |

#### **Abas de Resultados:**

**1. Aba Matches:**
```
Tabela com colunas:
- Nº AIH
- Procedimento (código)
- Paciente
- Médico
- Valor Tabwin (R$)
- Valor Sistema (R$)
- Status (Badge: OK / Δ Valor / Δ Qtd)
```

**2. Aba Glosas:**
```
Tabela com colunas:
- Nº AIH
- Procedimento
- Valor (R$)
- Quantidade
+ Alert: "Podem indicar glosas, rejeições ou procedimentos não cadastrados"
```

**3. Aba Rejeições:**
```
Tabela com colunas:
- Nº AIH
- Procedimento
- Paciente
- Médico
- Valor (R$)
+ Alert: "Podem indicar rejeições, pendências ou erros de cadastro"
```

---

### **📤 EXPORTAÇÃO EXCEL**

#### **Função de Exportação:**

```javascript
const exportToExcel = (type: 'matches' | 'glosas' | 'rejeicoes') => {
  const wb = XLSX.utils.book_new();
  
  if (type === 'matches') {
    const data = result.matches.map(m => ({
      'Nº AIH': m.aih_number,
      'Código Procedimento': m.procedure_code,
      'Paciente': m.system_data.patient_name,
      'Médico': m.system_data.doctor_name || '',
      'Status': m.status === 'matched' ? 'OK' : 'Diferença',
      'Valor Tabwin (R$)': m.tabwin_data.sp_valato.toFixed(2),
      'Valor Sistema (R$)': (m.system_data.total_value / 100).toFixed(2),
      'Diferença (R$)': (m.value_difference / 100).toFixed(2)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Matches');
  }
  
  const fileName = `Sync_${type}_${hospitalName}_${competencia}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
```

---

### **🔐 CONTROLE DE ACESSO**

**Acesso Restrito:**
```javascript
const hasAccess = isAdmin() || isDirector();

if (!hasAccess) {
  return (
    <Card>
      <XCircle /> Acesso Restrito
      <p>Esta tela é exclusiva para Administradores e Diretoria</p>
    </Card>
  );
}
```

**Roles com acesso:**
- ✅ `admin`
- ✅ `director`
- ✅ `developer` (herda de admin)
- ❌ Outros roles (bloqueados)

---

## 📊 **COMPARAÇÃO DAS DUAS VERSÕES**

| Aspecto | SyncPage (Nova) | SyncDashboard (Antiga) |
|---------|-----------------|------------------------|
| **Fonte 1** | `aihs` (sistema interno) | Arquivo XLSX Tabwin |
| **Fonte 2** | `aih_registros` (SISAIH01) | Service (sistema interno) |
| **Propósito** | Confirmar AIHs com SUS | Identificar glosas/rejeições |
| **Matching** | Número AIH normalizado | AIH + Procedimento |
| **Filtros** | Hospital + Competência | Hospital + Competência |
| **Acesso** | Todos usuários | Admin/Diretoria apenas |
| **Exportação** | Não implementada | Excel (3 tipos) |
| **Enriquecimento** | SIGTAP (descrições) | Nenhum |
| **Tolerâncias** | Nenhuma | Valor: R$ 0,50 |
| **KPIs** | 4 (Sinc/Pend/NãoProc) | 5 (Match/Valor/Qtd/Glosa/Rej) |

---

## 🔗 **RELACIONAMENTO DE TABELAS**

### **Diagrama de Relacionamento (SyncPage):**

```
┌─────────────┐         ┌──────────────┐         ┌───────────────────┐
│  hospitals  │◄────────│    aihs      │◄────────│ aih_registros     │
│             │         │              │         │  (SISAIH01)       │
│ • id        │         │ • id         │         │ • numero_aih      │
│ • name      │         │ • aih_number │         │ • hospital_id (FK)│
└─────────────┘         │ • hospital_id│         │ • nome_paciente   │
                        │ • competencia│         │ • data_internacao │
                        │ • patient_id │         │ • competencia     │
                        └──────────────┘         └───────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │ sigtap_procedures│
                        │ • code           │
                        │ • description    │
                        └──────────────────┘
```

### **Fluxo de Dados (SyncPage):**

```
1. Carregar hospitais → SELECT FROM hospitals
2. Carregar competências → SELECT competencia FROM aihs
3. Buscar AIHs → SELECT FROM aihs WHERE hospital_id AND competencia
4. Buscar SISAIH01 → SELECT FROM aih_registros WHERE hospital_id AND competencia
5. Executar matching → Comparação em memória (Map)
6. Enriquecer → SELECT FROM sigtap_procedures WHERE code IN (...)
7. Exibir resultado → Renderizar tabela com dados combinados
```

---

### **Diagrama de Relacionamento (SyncDashboard):**

```
┌─────────────┐         ┌──────────────────────┐
│  hospitals  │         │   Arquivo Tabwin     │
│             │         │   (XLSX Upload)      │
│ • id        │         │ • SP_NAIH           │
│ • name      │         │ • SP_ATOPROF        │
│ • cnes      │         │ • SP_VALATO         │
└─────────────┘         └──────────────────────┘
       │                            │
       ▼                            ▼
┌─────────────────────────────────────────┐
│     DoctorPatientService                │
│  (Combina múltiplas tabelas)            │
│                                          │
│  aihs ──┬── patients                    │
│         ├── doctors                     │
│         ├── procedure_records           │
│         └── hospitals                   │
└─────────────────────────────────────────┘
              │
              ▼
       ┌──────────────┐
       │ Reconciliação│
       │  (SyncService)│
       └──────────────┘
```

---

## 🎯 **CAMPOS CHAVE PARA MATCHING**

### **SyncPage (AIH Avançado vs SISAIH01):**

**Chave primária de matching:**
```javascript
const chavePrimaria = normalizarNumeroAIH(aih_number);
// Exemplo: "4113020089616" (13 dígitos sem formatação)
```

**Campos secundários (não usados no match, mas exibidos):**
- `nome_paciente` (SISAIH01)
- `data_internacao` (SISAIH01)
- `total_procedures` (AIH Avançado)
- `procedure_requested` (AIH Avançado)
- `calculated_total_value` (AIH Avançado)

---

### **SyncDashboard (Tabwin vs Sistema):**

**Chave composta de matching:**
```javascript
const chaveComposta = `${aih_number}_${procedure_code}`;
// Exemplo: "4113020089616_0301060096" (AIH + Procedimento)
```

**Campos de validação:**
- `sp_valato` (Tabwin) vs `total_value` (Sistema) → Diferença < R$ 0,50
- `sp_qtd_ato` (Tabwin) vs `quantity` (Sistema) → Deve ser igual

---

## 🚨 **PONTOS DE ATENÇÃO E LIMITAÇÕES**

### **SyncPage:**

1. **⚠️ Normalização de Competência:**
   - Suporta múltiplos formatos (`YYYY-MM-DD`, `MM/YYYY`, `AAAAMM`)
   - Conversão manual no cliente (pode haver inconsistências)

2. **⚠️ Filtro no Cliente:**
   - Competência filtrada no JavaScript (não no SQL)
   - Performance pode degradar com muitos registros

3. **⚠️ Campo hospital_id em aih_registros:**
   - Foi adicionado posteriormente (`add_hospital_id_to_aih_registros.sql`)
   - Pode ter registros antigos sem hospital_id

4. **⚠️ Validação de Número AIH:**
   - Apenas verifica se tem >= 10 dígitos
   - Não valida checksum ou formato oficial

5. **⚠️ Enriquecimento SIGTAP:**
   - Nem todos os códigos encontram descrição
   - Tentativa com código original + fallback sem formatação

---

### **SyncDashboard:**

1. **⚠️ Dependência do Arquivo Tabwin:**
   - Formato específico esperado (colunas obrigatórias)
   - Linha de cabeçalho deve conter "SP_NAIH"

2. **⚠️ Conversão de Valores:**
   - Tabwin em reais, sistema em centavos
   - Conversão manual: `Math.round(valor * 100)`

3. **⚠️ Tolerância de Valor:**
   - Fixada em R$ 0,50 (não configurável)
   - Pode gerar falsos positivos/negativos

4. **⚠️ Service Complexo:**
   - `DoctorPatientService` faz múltiplos joins
   - Performance pode ser afetada com grandes volumes

5. **⚠️ Acesso Restrito:**
   - Apenas Admin/Diretoria
   - Operadores não conseguem usar

---

## 🔧 **SUGESTÕES DE MELHORIAS**

### **Para SyncPage:**

1. **✅ Filtrar Competência no SQL:**
```sql
-- Criar índice na competência
CREATE INDEX idx_aihs_competencia ON aihs(competencia);
CREATE INDEX idx_aih_registros_competencia ON aih_registros(competencia);

-- Filtrar no servidor
SELECT * FROM aihs 
WHERE hospital_id = ? 
  AND competencia = ? -- Filtro no SQL
```

2. **✅ Adicionar Exportação Excel:**
```javascript
const exportarSincronizacao = () => {
  const data = resultadoSync.detalhes
    .filter(d => d.status === 'sincronizado')
    .map(d => ({
      'Nº AIH': d.numero_aih,
      'Paciente': d.sisaih01?.nome_paciente,
      'Procedimento': d.procedure_description,
      'Valor': formatCurrency(d.aih_avancado?.calculated_total_value)
    }));
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sincronizados');
  XLSX.writeFile(wb, `Sync_${hospital}_${competencia}.xlsx`);
};
```

3. **✅ Validar Formato de Competência:**
```javascript
const validarCompetencia = (comp: string): boolean => {
  // Aceitar apenas YYYY-MM ou AAAAMM
  return /^\d{4}-\d{2}$/.test(comp) || /^\d{6}$/.test(comp);
};
```

4. **✅ Adicionar Indicador de Carga:**
```jsx
{isLoading && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <Card className="p-8">
      <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4" />
      <p>Processando {aihsEncontradas.length} AIHs...</p>
      <Progress value={progress} className="mt-4" />
    </Card>
  </div>
)}
```

---

### **Para SyncDashboard:**

1. **✅ Tornar Tolerância Configurável:**
```jsx
<Input 
  type="number" 
  label="Tolerância de Valor (R$)"
  value={tolerance}
  onChange={(e) => setTolerance(Number(e.target.value))}
  defaultValue={0.50}
/>
```

2. **✅ Adicionar Filtros Adicionais:**
```jsx
<Select label="Filtrar por Status">
  <option value="all">Todos</option>
  <option value="matched">Apenas Matches</option>
  <option value="value_diff">Diferenças de Valor</option>
  <option value="quantity_diff">Diferenças de Quantidade</option>
</Select>
```

3. **✅ Melhorar Performance do Service:**
```javascript
// Usar view otimizada em vez de joins complexos
const { data } = await supabase
  .from('v_reconciliation_data')
  .select('*')
  .eq('hospital_id', hospitalId)
  .eq('competencia', competencia);
```

4. **✅ Adicionar Gráficos de Análise:**
```jsx
import { PieChart, BarChart } from 'recharts';

<PieChart data={[
  { name: 'Matches', value: result.summary.perfect_matches },
  { name: 'Diferenças', value: result.summary.value_differences },
  { name: 'Glosas', value: result.summary.glosas_possiveis }
]} />
```

---

## 📚 **DOCUMENTAÇÃO DE REFERÊNCIA**

### **Arquivos Relacionados:**

1. **Componentes:**
   - `src/components/SyncPage.tsx` (1060 linhas)
   - `src/components/SyncDashboard.tsx` (700 linhas)

2. **Serviços:**
   - `src/services/syncService.ts` (454 linhas)
   - `src/services/doctorPatientService.ts` (2334 linhas)

3. **Banco de Dados:**
   - `database/create_aih_registros_table.sql`
   - `database/add_hospital_id_to_aih_registros.sql`
   - `database/add_competencia_sisaih01.sql`

4. **Rotas:**
   - `src/pages/Index.tsx` - Linha 41: `aih-sync` → SyncPage
   - `src/pages/Index.tsx` - Linha 49: `sync` → SyncDashboard

---

## 🎯 **CONCLUSÃO**

### **SyncPage (Recomendada para uso diário):**

✅ **Vantagens:**
- Acesso liberado para todos usuários
- Interface clara com fluxo em 3 etapas
- Dados diretos do banco (sem processamento externo)
- Ideal para verificar confirmação SUS

❌ **Desvantagens:**
- Sem exportação Excel
- Filtro de competência no cliente
- Sem análise de valores/quantidades

### **SyncDashboard (Uso administrativo):**

✅ **Vantagens:**
- Análise detalhada de diferenças
- Exportação Excel completa
- Identificação de glosas/rejeições
- Tolerância de valores

❌ **Desvantagens:**
- Acesso restrito (Admin/Diretoria)
- Depende de arquivo externo (Tabwin)
- Service complexo e pesado

---

## 📊 **MÉTRICAS DE USO RECOMENDADAS**

### **Quando usar SyncPage:**
- ✅ Verificar se AIHs processadas foram confirmadas pelo SUS
- ✅ Identificar AIHs pendentes de faturamento
- ✅ Conferência diária/semanal de sincronização
- ✅ Acompanhamento por competência

### **Quando usar SyncDashboard:**
- ✅ Análise mensal de glosas
- ✅ Conferência com relatório oficial Tabwin
- ✅ Auditoria de valores e quantidades
- ✅ Exportação de relatórios para diretoria

---

**Documento gerado em:** 2025-01-20  
**Versão:** 1.0  
**Status:** ✅ Análise Completa e Sistemática Concluída

