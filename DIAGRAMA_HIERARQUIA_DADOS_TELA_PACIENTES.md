# 🗺️ DIAGRAMA DE HIERARQUIA E FLUXO DE DADOS - TELA PACIENTES

## 📊 DIAGRAMA DE RELACIONAMENTOS (Modelo de Dados)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ESTRUTURA DE DADOS NA TELA                          │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │   HOSPITALS      │
                              │ ──────────────── │
                              │ • id (PK)        │
                              │ • name           │
                              │ • cnpj           │
                              │ • is_active      │
                              └────────┬─────────┘
                                       │
                           ┌───────────┴──────────────┐
                           │                          │
                           │ 1:N                      │ 1:N
                           │                          │
                  ┌────────▼────────┐       ┌────────▼─────────┐
                  │   PATIENTS      │       │   SIGTAP_        │
                  │ ─────────────── │       │   PROCEDURES     │
                  │ • id (PK)       │       │ ──────────────── │
                  │ • hospital_id   │◄──┐   │ • id (PK)        │
                  │ • name          │   │   │ • code           │
                  │ • cns           │   │   │ • description    │
                  │ • birth_date    │   │   │ • value_hosp     │
                  │ • gender        │   │   │ • complexity     │
                  │ • medical_rec   │   │   └──────────────────┘
                  └────────┬────────┘   │
                           │            │
                           │ 1:N        │
                           │            │
              ┌────────────▼────────────┴───────────────┐
              │           AIHS (TABELA CENTRAL)         │
              │ ─────────────────────────────────────── │
              │ • id (PK)                               │
              │ • hospital_id (FK) ────────────────┐    │
              │ • patient_id (FK)                  │    │
              │ • aih_number                       │    │
              │ • procedure_code                   │    │
              │ • admission_date                   │    │
              │ • discharge_date                   │    │
              │ • main_cid                         │    │
              │ • care_character ('1' ou '2')      │    │
              │ • specialty                        │    │
              │ • processing_status                │    │
              │ • calculated_total_value           │    │
              │ • updated_at                       │    │
              └────────┬─────────────────┬─────────┘    │
                       │                 │              │
              ┌────────┴────┐    ┌──────┴──────┐       │
              │             │    │             │       │
              │ 1:N         │    │ 1:N         │       │
              │             │    │             │       │
   ┌──────────▼──────────┐ │    │ ┌───────────▼───────▼────┐
   │ PROCEDURE_RECORDS   │ │    │ │   AIH_MATCHES          │
   │ ──────────────────  │ │    │ │ ─────────────────────  │
   │ • id (PK)           │ │    │ │ • id (PK)              │
   │ • aih_id (FK) ──────┴─┘    │ │ • aih_id (FK) ─────────┘
   │ • procedure_code    │      │ │ • procedure_id (FK)    │
   │ • sequencia         │      │ │ • overall_score        │
   │ • quantity          │      │ │ • calculated_total     │
   │ • professional_name │      │ │ • match_confidence     │
   │ • professional_cbo  │      │ │ • validation_details   │
   │ • match_status      │      │ │ • status               │
   │ • value_charged     │      │ └────────────────────────┘
   │ • total_value       │      │
   └─────────────────────┘      │
                                │
                   ┌────────────┴────────────┐
                   │ N:1                     │
                   │                         │
          ┌────────▼─────────┐               │
          │ SIGTAP_          │               │
          │ PROCEDURES       │               │
          │ ──────────────── │◄──────────────┘
          │ • id (PK)        │
          │ • code           │
          │ • description    │
          │ • value_hosp     │
          └──────────────────┘
```

## 🔄 FLUXO DE CONSULTA SQL (Query Principal)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      QUERY: getAIHs(hospitalId, filters)                     │
└─────────────────────────────────────────────────────────────────────────────┘

  SELECT
  ┌─────┐
  │aihs.*│                         ← Todos os campos da AIH (tabela principal)
  └─────┘
    │
    ├── LEFT JOIN patients          ← RELACIONAMENTO 1:N (1 AIH → 1 Paciente)
    │   └─→ patients.id
    │   └─→ patients.name
    │   └─→ patients.cns
    │   └─→ patients.birth_date
    │   └─→ patients.gender
    │   └─→ patients.medical_record
    │
    ├── LEFT JOIN hospitals         ← RELACIONAMENTO N:1 (N AIHs → 1 Hospital)
    │   └─→ hospitals.id
    │   └─→ hospitals.name
    │
    └── LEFT JOIN aih_matches       ← RELACIONAMENTO 1:N (1 AIH → N Matches)
        └─→ aih_matches.id
        └─→ aih_matches.overall_score
        └─→ aih_matches.calculated_total
        └─→ aih_matches.status
        └─→ aih_matches.match_confidence
        └─→ aih_matches.validation_details

  FROM aihs
  WHERE
    aihs.hospital_id = $1                    ← Filtro por hospital
    AND aihs.admission_date >= $2            ← Filtro: Data de Admissão
    AND aihs.discharge_date <= $3            ← Filtro: Data de Alta
    AND aihs.care_character = $4             ← Filtro: Caráter (1=Eletivo, 2=Urgência)
  ORDER BY
    aihs.updated_at DESC                     ← Ordenação: Mais recentes primeiro
  LIMIT 1000                                 ← Paginação por chunks

  ↓ RESULTADO (JSON)

  [
    {
      id: "uuid",
      aih_number: "123456789",
      procedure_code: "0310010039",
      admission_date: "2024-01-15T00:00:00",
      discharge_date: "2024-01-20T00:00:00",
      care_character: "1",
      // ... outros campos da AIH

      patients: {                            ← ✅ Dados aninhados (JOIN)
        id: "uuid",
        name: "João Silva",
        cns: "123456789012345",
        birth_date: "1980-05-20",
        gender: "M",
        medical_record: "12345"
      },

      hospitals: {                           ← ✅ Dados aninhados (JOIN)
        id: "uuid",
        name: "Hospital Municipal"
      },

      aih_matches: [                         ← ✅ Array de matches (JOIN 1:N)
        {
          id: "uuid",
          overall_score: 95,
          calculated_total: 125000,
          status: "approved",
          match_confidence: 90
        }
      ]
    },
    // ... mais AIHs
  ]
```

## 🔍 FLUXO DE CARREGAMENTO DE PROCEDIMENTOS (Lazy Loading)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                QUERY: getAIHProcedures(aihId) - LAZY LOADING                │
└─────────────────────────────────────────────────────────────────────────────┘

  TRIGGER:
  ┌──────────────────────────────────────┐
  │ Usuário clica no chevron da AIH      │
  │ (Expandir para ver procedimentos)    │
  └──────────────┬───────────────────────┘
                 │
                 ▼
  handleExpandAIH(aihId)
                 │
                 ▼
  ┌─────────────────────────────────────┐
  │ Verificar cache:                     │
  │ proceduresData[aihId] existe?        │
  └───────┬─────────────────┬────────────┘
          │                 │
      SIM │                 │ NÃO
          │                 │
          ▼                 ▼
  ┌──────────────┐   ┌──────────────────────┐
  │ Usar cache   │   │ Carregar do banco    │
  │ (instantâneo)│   │ loadAIHProcedures()  │
  └──────────────┘   └──────────┬───────────┘
                                 │
                                 ▼
                     SELECT
                     ┌──────────────────┐
                     │procedure_records.*│
                     └──────────────────┘
                       │
                       FROM procedure_records
                       WHERE aih_id = $1
                       ORDER BY sequencia ASC
                       │
                       ▼
                     [
                       {
                         id: "uuid",
                         procedure_code: "0310010039",
                         procedure_description: "Tratamento clínico",
                         sequencia: 1,
                         quantity: 1,
                         professional_name: "Dr. João",
                         professional_cbo: "225125",
                         match_status: "matched",
                         value_charged: 50000,  // 500,00 em centavos
                         total_value: 50000
                       },
                       // ... mais procedimentos
                     ]
                       │
                       ▼
                  setProceduresData({ [aihId]: data })
                       │
                       ▼
                  recalculateAIHTotal(aihId, procedures)
                       │
                       ▼
               ┌─────────────────────────────────┐
               │ Filtrar procedimentos ATIVOS:   │
               │ • match_status = 'matched' OU   │
               │ • match_status = 'manual'       │
               │ E                               │
               │ • Não é anestesista OU          │
               │ • Anestesista com valor > 0     │
               └────────────┬────────────────────┘
                            │
                            ▼
               ┌─────────────────────────────────┐
               │ Somar valores:                  │
               │ total = Σ (value_charged        │
               │          ou sigtap_value * qty) │
               └────────────┬────────────────────┘
                            │
                            ▼
                  setAihTotalValues({ [aihId]: total })
                            │
                            ▼
                   ┌─────────────────┐
                   │ RE-RENDER       │
                   │ Exibir lista de │
                   │ procedimentos   │
                   └─────────────────┘
```

## 📈 ESTRUTURA DE ESTADOS REACT (Hierarquia de Dados no Frontend)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ESTADOS REACT (useState)                              │
└─────────────────────────────────────────────────────────────────────────────┘

CAMADA 1: DADOS BRUTOS (do Backend)
├─ [aihs] (Array<AIH>)
│   ├─ aih[0]
│   │   ├─ id: "uuid-1"
│   │   ├─ aih_number: "123456789"
│   │   ├─ patients: { name: "João", cns: "123..." }  ← JOIN
│   │   ├─ hospitals: { name: "Hospital X" }          ← JOIN
│   │   └─ aih_matches: [...]                         ← JOIN
│   ├─ aih[1]
│   └─ aih[N]
│
├─ [proceduresData] (Object: { [aihId]: Array<Procedure> })
│   ├─ "uuid-1": [proc1, proc2, proc3]  ← Lazy loaded
│   ├─ "uuid-2": [proc4, proc5]
│   └─ ...
│
└─ [aihTotalValues] (Object: { [aihId]: number })
    ├─ "uuid-1": 150000  (R$ 1.500,00 em centavos)
    ├─ "uuid-2": 75000   (R$ 750,00 em centavos)
    └─ ...

CAMADA 2: DADOS PROCESSADOS (Computed)
├─ [unifiedData] (Array)
│   └─ aihs.map(aih => ({
│       ...aih,
│       patient: aih.patients,    ← Normalização
│       matches: aih.aih_matches  ← Normalização
│     }))
│
├─ [filteredData] (Array)
│   └─ unifiedData.filter(item => {
│       // Filtro de busca textual (frontend)
│       return item.aih_number.includes(globalSearch) ||
│              item.patient?.name.includes(globalSearch)
│     })
│
└─ [paginatedData] (Array)
    └─ filteredData.slice(
         currentPage * itemsPerPage,
         (currentPage + 1) * itemsPerPage
       )

CAMADA 3: ESTADOS DE UI
├─ [expandedItems] (Set<string>)
│   └─ Set(["uuid-1", "uuid-5"])  ← AIHs expandidas
│
├─ [currentPage] (number)
│   └─ 0 (primeira página, 10 itens)
│
├─ [globalSearch] (string)
│   └─ "João"  ← Filtro de busca
│
└─ [selectedCareCharacter] (string)
    └─ "1"  ← Filtro de caráter (1=Eletivo, 2=Urgência)

CAMADA 4: ESTADOS DE CONTROLE
├─ [isLoading] (boolean)
│   └─ false  ← Indica se está carregando dados
│
└─ [loadingProcedures] (Object: { [aihId]: boolean })
    └─ { "uuid-1": true }  ← Indica qual AIH está carregando procedimentos
```

## 🧮 FLUXO DE CÁLCULO FINANCEIRO (Regras de Negócio)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              CÁLCULO: recalculateAIHTotal(aihId, procedures)                │
└─────────────────────────────────────────────────────────────────────────────┘

  ENTRADA: procedures[] (Array de procedimentos da AIH)

  PASSO 1: Filtrar procedimentos ATIVOS
  ─────────────────────────────────────
  const activeProcedures = procedures.filter(proc => {
    // ✅ Critério 1: Status aprovado
    const isApproved = (
      proc.match_status === 'matched' ||  // Aprovado automaticamente
      proc.match_status === 'manual'       // Aprovado manualmente
    );

    // ✅ Critério 2: Não é anestesista OU anestesista com valor
    const isCalculable = filterCalculableProcedures({
      cbo: proc.professional_cbo,
      procedure_code: proc.procedure_code
    });
    // filterCalculableProcedures() verifica:
    // - Se CBO começa com '2231' (anestesista)
    //   → Incluir APENAS se value_charged > 0
    // - Caso contrário, incluir sempre

    return isApproved && isCalculable;
  });

  PASSO 2: Somar valores em REAIS
  ────────────────────────────────
  const totalReais = activeProcedures.reduce((sum, proc) => {
    const quantity = proc.quantity ?? 1;

    // 🎯 PRIORIDADE 1: Valor cobrado (se existir)
    if (proc.value_charged && proc.value_charged > 0) {
      // value_charged já está em CENTAVOS
      return sum + (proc.value_charged / 100);  // Converter para REAIS
    }

    // 🎯 PRIORIDADE 2: Valor SIGTAP (tabela de referência)
    const unitValue = proc.sigtap_procedures?.value_hosp_total || 0;
    return sum + (unitValue * quantity);  // REAIS
  }, 0);

  PASSO 3: Converter para CENTAVOS
  ─────────────────────────────────
  const totalCentavos = Math.round(totalReais * 100);

  PASSO 4: Atualizar estado
  ──────────────────────────
  setAihTotalValues(prev => ({
    ...prev,
    [aihId]: totalCentavos
  }));

  SAÍDA:
  ─────
  totalCentavos (number)
  Exemplo: 150000 = R$ 1.500,00
```

## 🔀 FLUXO DE FILTROS (Backend vs Frontend)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ESTRATÉGIA DE FILTROS                               │
└─────────────────────────────────────────────────────────────────────────────┘

FILTROS BACKEND (SQL) ⚡ Performance ALTA
═════════════════════════════════════════
├─ Filtro 1: Hospital
│   WHERE hospital_id = $1
│   Motivo: Segurança (RLS) + Performance
│
├─ Filtro 2: Data de Admissão (startDate)
│   WHERE admission_date >= $2
│   Motivo: Reduzir volume de dados transferidos
│
├─ Filtro 3: Data de Alta (endDate)
│   WHERE discharge_date <= $3
│   AND discharge_date IS NOT NULL
│   Motivo: Filtrar por competência (mês de fechamento)
│
└─ Filtro 4: Caráter de Atendimento (careCharacter)
    WHERE care_character = $4
    Motivo: Segmentação (Eletivo vs Urgência)

  ↓ Resultado: ~500 AIHs (em vez de 10.000)
  ↓ Ganho: 95% menos dados transferidos

FILTROS FRONTEND (JavaScript) 🔍 Performance MÉDIA
══════════════════════════════════════════════════
├─ Filtro 5: Busca Textual (globalSearch)
│   filteredData = unifiedData.filter(item => {
│     return (
│       item.aih_number.includes(searchLower) ||
│       item.patient?.name.includes(searchLower) ||
│       item.patient?.cns.includes(globalSearch)
│     );
│   });
│   Motivo: Busca livre, impossível indexar todas as combinações
│
└─ Filtro 6: Paginação (currentPage)
    paginatedData = filteredData.slice(
      currentPage * 10,
      (currentPage + 1) * 10
    );
    Motivo: Renderização otimizada (10 itens por vez)

  ↓ Resultado: 10 AIHs renderizadas
  ↓ Ganho: UI fluida, sem lag
```

## 🚀 FLUXO DE OTIMIZAÇÃO: Prefetch Inteligente

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PREFETCH DE PROCEDIMENTOS                             │
└─────────────────────────────────────────────────────────────────────────────┘

  TRIGGER: useEffect() quando muda a página

  ┌───────────────────────────────────┐
  │ paginatedData = 10 AIHs visíveis  │
  └────────────┬──────────────────────┘
               │
               ▼
  ┌───────────────────────────────────┐
  │ Pegar os 5 primeiros itens        │
  │ visibleAIHIds = [id1, id2, ..., id5] │
  └────────────┬──────────────────────┘
               │
               ▼
  ┌───────────────────────────────────┐
  │ Filtrar apenas os que NÃO         │
  │ têm procedimentos carregados:     │
  │ idsToLoad = visibleAIHIds.filter( │
  │   id => !proceduresData[id]       │
  │ )                                 │
  └────────────┬──────────────────────┘
               │
               ▼
  ┌───────────────────────────────────┐
  │ Carregar em PARALELO (Promise.all)│
  │ batch = idsToLoad.slice(0, 5)     │
  │ results = await Promise.all(      │
  │   batch.map(id =>                 │
  │     getAIHProcedures(id)          │
  │   )                               │
  │ )                                 │
  └────────────┬──────────────────────┘
               │
               ▼
  ┌───────────────────────────────────┐
  │ Atualizar estado (cache)          │
  │ setProceduresData(prev => ({      │
  │   ...prev,                        │
  │   [id1]: results[0],              │
  │   [id2]: results[1],              │
  │   ...                             │
  │ }))                               │
  └────────────┬──────────────────────┘
               │
               ▼
  ┌───────────────────────────────────┐
  │ Recalcular totais                 │
  │ recalculateAIHTotal(id, procs)    │
  └────────────┬──────────────────────┘
               │
               ▼
  ┌───────────────────────────────────┐
  │ RESULTADO:                        │
  │ Expansão INSTANTÂNEA para os      │
  │ primeiros 5 itens da página       │
  │ (latência ≈ 0ms)                  │
  └───────────────────────────────────┘

  BENEFÍCIOS:
  ✅ Reduz latência percebida de 300ms → 0ms
  ✅ Evita problema N+1 de queries
  ✅ Não sobrecarrega o banco (máximo 5 queries paralelas)
  ✅ Cache automático (não recarrega se já tem)
```

---

## 📋 LEGENDA DE SÍMBOLOS

```
┌──┐  ┌───┐  └──┘  └───┘      Caixas (containers)
│  │  │   │                   Linhas verticais (conexão)
├──┤  ├───┤                   Junções laterais
▲  ▼  ►  ◄                    Setas direcionais
═══════════                   Linhas duplas (destaque)
─────────────                 Linhas simples (separação)

(PK)                          Primary Key (chave primária)
(FK)                          Foreign Key (chave estrangeira)
1:N                           Relacionamento um-para-muitos
N:1                           Relacionamento muitos-para-um
←  →  ↑  ↓                    Fluxo de dados
✅                            Item implementado/correto
⚠️                            Ponto de atenção
⚡                            Alta performance
🔍                            Busca/filtro
🔄                            Processo/loop
💾                            Persistência/banco de dados
```

---

**Documento complementar de:** `ANALISE_DETALHADA_TELA_PACIENTES.md`  
**Versão:** 1.0  
**Status:** ✅ Completo

