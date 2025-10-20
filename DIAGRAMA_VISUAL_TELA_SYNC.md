# 🎨 DIAGRAMA VISUAL - TELA SYNC

## 📊 **VISÃO GERAL DO SISTEMA**

```
╔══════════════════════════════════════════════════════════════════════════╗
║                         TELA SYNC - DUAS VERSÕES                         ║
╚══════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────┬──────────────────────────────────────┐
│     VERSION 1: SyncPage          │   VERSION 2: SyncDashboard           │
│   (AIH Avançado vs SISAIH01)     │     (Tabwin vs Sistema)              │
├──────────────────────────────────┼──────────────────────────────────────┤
│ Rota: /aih-sync                  │ Rota: /sync                          │
│ Acesso: Todos usuários           │ Acesso: Admin/Diretoria apenas       │
│ Fonte: Banco de dados            │ Fonte: Upload XLSX + Banco           │
│ Objetivo: Confirmar com SUS      │ Objetivo: Identificar glosas         │
└──────────────────────────────────┴──────────────────────────────────────┘
```

---

## 🔄 **SYNCPAGE - FLUXO DE DADOS DETALHADO**

### **Arquitetura de Dados:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       BANCO DE DADOS SUPABASE                           │
└─────────────────────────────────────────────────────────────────────────┘
            │                                    │
            │                                    │
┌───────────▼──────────┐              ┌─────────▼────────────┐
│   TABLE: hospitals   │              │  TABLE: sigtap_      │
│   ────────────────   │              │       procedures     │
│   • id (UUID)        │              │  ──────────────────  │
│   • name (VARCHAR)   │              │  • code (VARCHAR)    │
└──────────┬───────────┘              │  • description       │
           │                          └──────────────────────┘
           │                                    ▲
┌──────────▼───────────────────────────────────┼───────────────┐
│                  TABLE: aihs                 │               │
│                  ────────────                │               │
│  • id (UUID)                                 │               │
│  • aih_number (VARCHAR) ◄────────────────────┼───────┐       │
│  • hospital_id (UUID FK) ────────────────────┘       │       │
│  • patient_id (UUID FK)                              │       │
│  • competencia (VARCHAR)  ◄──────────────────────┐   │       │
│  • admission_date (DATE)                         │   │       │
│  • calculated_total_value (BIGINT)               │   │       │
│  • total_procedures (INT)                        │   │       │
│  • procedure_requested (VARCHAR) ────────────────┼───┼───────┘
│  • created_at (TIMESTAMP)                        │   │
└──────────────────────────────────────────────────┼───┼─────────┐
                                                   │   │         │
                                    ┌──────────────▼───▼─────────▼────┐
                                    │  TABLE: aih_registros (SISAIH01)│
                                    │  ──────────────────────────────  │
                                    │  • id (UUID)                     │
                                    │  • numero_aih (VARCHAR) ◄────────┤ MATCHING
                                    │  • hospital_id (UUID FK)         │ KEY
                                    │  • competencia (VARCHAR)         │
                                    │  • nome_paciente (VARCHAR)       │
                                    │  • data_internacao (DATE)        │
                                    │  • cnes_hospital (VARCHAR)       │
                                    │  • medico_responsavel (VARCHAR)  │
                                    └──────────────────────────────────┘
```

### **Fluxo de Execução (3 Etapas):**

```
╔═══════════════════════════════════════════════════════════════════════╗
║                        ETAPA 1: AIH AVANÇADO                          ║
╚═══════════════════════════════════════════════════════════════════════╝

   ┌─────────────┐       ┌──────────────┐       ┌───────────────┐
   │   SELECT    │───────│   FILTER     │───────│   NORMALIZE   │
   │  hospitals  │       │ competencia  │       │   AAAAMM      │
   └──────┬──────┘       └──────┬───────┘       └───────┬───────┘
          │                     │                       │
          ▼                     ▼                       ▼
   [Dropdown Hospital]   [Dropdown Competência]   [Array AIHs]
          │                     │                       │
          └─────────────────────┴───────────────────────┘
                                │
                          [Botão: Buscar AIHs]
                                │
                                ▼
                     ✅ Etapa 1 Concluída
                     (aihsEncontradas: 150 registros)

═══════════════════════════════════════════════════════════════════════

╔═══════════════════════════════════════════════════════════════════════╗
║                        ETAPA 2: SISAIH01                              ║
╚═══════════════════════════════════════════════════════════════════════╝

   ┌─────────────┐       ┌──────────────┐       ┌───────────────┐
   │   SELECT    │───────│   FILTER     │───────│   NORMALIZE   │
   │aih_registros│       │ competencia  │       │  numero_aih   │
   └──────┬──────┘       └──────┬───────┘       └───────┬───────┘
          │                     │                       │
          ▼                     ▼                       ▼
   [Dropdown Hospital]   [Dropdown Competência]   [Array SISAIH01]
          │                     │                       │
          └─────────────────────┴───────────────────────┘
                                │
                        [Botão: Buscar SISAIH01]
                                │
                                ▼
                     ✅ Etapa 2 Concluída
                     (sisaih01Encontrados: 200 registros)

═══════════════════════════════════════════════════════════════════════

╔═══════════════════════════════════════════════════════════════════════╗
║                      ETAPA 3: SINCRONIZAÇÃO                           ║
╚═══════════════════════════════════════════════════════════════════════╝

   aihsEncontradas          sisaih01Encontrados
   (150 registros)          (200 registros)
         │                         │
         ▼                         ▼
   ┌─────────────┐         ┌─────────────┐
   │ Normalizar  │         │ Normalizar  │
   │ Nº AIH      │         │ Nº AIH      │
   └──────┬──────┘         └──────┬──────┘
          │                       │
          ▼                       ▼
   ┌────────────────────────────────────┐
   │   Map<numeroNormalizado, dados>   │
   │   ────────────────────────────     │
   │   "4113020089616" → { ... }       │
   │   "4113020089617" → { ... }       │
   └────────────────┬───────────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │  COMPARAÇÃO     │
          │  ─────────────  │
          │  For each AIH:  │
          │                 │
          │  ✅ Em ambas?   │
          │     → Sinc.     │
          │                 │
          │  ⏳ Só no Sist? │
          │     → Pendente  │
          │                 │
          │  ❌ Só SISAIH01?│
          │     → Não Proc. │
          └────────┬────────┘
                   │
                   ▼
   ┌────────────────────────────────────┐
   │     BUSCAR DESCRIÇÕES SIGTAP      │
   │     ──────────────────────────     │
   │  SELECT code, description          │
   │  FROM sigtap_procedures            │
   │  WHERE code IN (códigos_únicos)    │
   └────────────┬───────────────────────┘
                │
                ▼
   ┌────────────────────────────────────┐
   │      RESULTADO FINAL               │
   │      ────────────────               │
   │  ✅ Sincronizados: 150             │
   │  ⏳ Pendentes: 0                   │
   │  ❌ Não Processados: 50            │
   │  📈 Taxa: 75%                      │
   └────────────────────────────────────┘
```

---

## 🔄 **SYNCDASHBOARD - FLUXO DE DADOS DETALHADO**

### **Arquitetura de Dados:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ARQUIVO TABWIN (XLSX)                               │
│                     ─────────────────────                               │
│  SP_NAIH | SP_ATOPROF | SP_VALATO | SP_QTD_ATO | SP_DTINTER           │
│  ───────────────────────────────────────────────────────────────       │
│  411302.. | 0301060096 |  1500.00  |     1      | 2025-10-01          │
│  411302.. | 0403010018 |   800.50  |     2      | 2025-10-02          │
└────────────────────────┬────────────────────────────────────────────────┘
                         │
                         │ 1. Upload & Parse
                         ▼
              ┌──────────────────────┐
              │  TabwinRecord[]      │
              │  ─────────────────   │
              │  { sp_naih,          │
              │    sp_atoprof,       │
              │    sp_valato,        │
              │    sp_qtd_ato }      │
              └──────────┬───────────┘
                         │
                         │ 2. Fetch System Data
                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    DoctorPatientService                                │
│                    ───────────────────────                             │
│  getDoctorsWithPatientsFromProceduresView()                           │
│                                                                         │
│  Combina dados de:                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  ┌──────────┐        │
│  │  aihs    │──│ patients │──│procedure_     │──│ doctors  │        │
│  │          │  │          │  │records        │  │          │        │
│  └──────────┘  └──────────┘  └───────────────┘  └──────────┘        │
│       │                               │                                │
│       └───────────────┬───────────────┘                               │
│                       ▼                                                │
│            ┌──────────────────────┐                                   │
│            │  SystemRecord[]      │                                   │
│            │  ─────────────────   │                                   │
│            │  { aih_number,       │                                   │
│            │    procedure_code,   │                                   │
│            │    total_value,      │                                   │
│            │    patient_name,     │                                   │
│            │    doctor_name }     │                                   │
│            └──────────┬───────────┘                                   │
└───────────────────────┼────────────────────────────────────────────────┘
                        │
                        │ 3. Reconciliation
                        ▼
              ┌─────────────────────┐
              │  SyncService        │
              │  ─────────────────  │
              │  reconcile()        │
              └──────────┬──────────┘
                         │
            ┌────────────┴────────────┐
            │                         │
            ▼                         ▼
   ┌────────────────┐       ┌────────────────┐
   │ TabwinRecord[] │       │ SystemRecord[] │
   └────────┬───────┘       └────────┬───────┘
            │                        │
            │   CREATE MAPS          │
            │   Key: aih_procedure   │
            │                        │
            ▼                        ▼
   Map<"411..._0301..", TabwinData>
   Map<"411..._0301..", SystemData>
            │                        │
            └────────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   COMPARAÇÃO         │
              │   ──────────────     │
              │   For each key:      │
              │                      │
              │   ✅ Match perfeito  │
              │   (valor = valor)    │
              │                      │
              │   ⚠️ Diferença valor │
              │   (|diff| > 0.50)    │
              │                      │
              │   ⚠️ Diferença qtd   │
              │   (qtd != qtd)       │
              │                      │
              │   ❌ Só Tabwin       │
              │   → Glosa possível   │
              │                      │
              │   ❌ Só Sistema      │
              │   → Rejeição possível│
              └──────────┬───────────┘
                         │
                         ▼
   ┌─────────────────────────────────────────┐
   │      RESULTADO FINAL                    │
   │      ────────────────                    │
   │  ✅ Matches Perfeitos: 120              │
   │  ⚠️ Diferenças Valor: 15                │
   │  ⚠️ Diferenças Qtd: 10                  │
   │  ❌ Possíveis Glosas: 30                │
   │  ❌ Possíveis Rejeições: 25             │
   └─────────────────────────────────────────┘
```

---

## 🔑 **CHAVES DE MATCHING (COMPARAÇÃO)**

### **SyncPage - Matching Simples:**

```
┌─────────────────────────────────────────────────────────────┐
│                   MATCHING POR AIH NUMBER                   │
└─────────────────────────────────────────────────────────────┘

AIH Avançado                          SISAIH01
────────────                          ────────
aih_number: "4113020089616"    ═══►   numero_aih: "41130200-89616"
                                              │
                                              │ Normalização
                                              ▼
                              "4113020089616" (só dígitos)
                                              │
                                              │ Match!
                                              ▼
                              ✅ SINCRONIZADO


┌───────────────────────────────────────────────────────────────┐
│              FUNÇÃO DE NORMALIZAÇÃO                           │
└───────────────────────────────────────────────────────────────┘

const normalizarNumeroAIH = (numero: string): string => {
  return numero.replace(/\D/g, ''); // Remove tudo que não é dígito
};

Exemplos:
  "4113020089616"        → "4113020089616"
  "41130200-89616"       → "4113020089616"
  "4113.0200.896.16"     → "4113020089616"
  "  4113020089616  "    → "4113020089616"
```

---

### **SyncDashboard - Matching Composto:**

```
┌─────────────────────────────────────────────────────────────┐
│         MATCHING POR AIH NUMBER + PROCEDURE CODE            │
└─────────────────────────────────────────────────────────────┘

Tabwin                                Sistema
──────                                ───────
sp_naih: "4113020089616"              aih_number: "4113020089616"
sp_atoprof: "03.01.06.009-6"          procedure_code: "0301060096"
                │                                  │
                │ Normalização                     │ Normalização
                ▼                                  ▼
       "0301060096"                       "0301060096"
                │                                  │
                └──────────────┬───────────────────┘
                               │
                               │ Criar chave composta
                               ▼
                  "4113020089616_0301060096"
                               │
                               │ Match!
                               ▼
                  ┌────────────────────────┐
                  │  Verificar Valores:    │
                  │  ──────────────────    │
                  │  Tabwin:  R$ 1.500,00  │
                  │  Sistema: R$ 1.500,50  │
                  │  Diferença: R$ 0,50    │
                  │                        │
                  │  ≤ Tolerância (0,50)?  │
                  │  ✅ SIM → Match OK     │
                  └────────────────────────┘


┌───────────────────────────────────────────────────────────────┐
│           FUNÇÃO DE CRIAÇÃO DE CHAVE                          │
└───────────────────────────────────────────────────────────────┘

const criarChave = (aih: string, proc: string): string => {
  const aihNorm = aih.replace(/\D/g, '');
  const procNorm = proc.replace(/[.\-\s]/g, '');
  return `${aihNorm}_${procNorm}`;
};

Exemplos:
  ("4113020089616", "03.01.06.009-6") 
    → "4113020089616_0301060096"
  
  ("411.3020.0896.16", "0301060096")
    → "4113020089616_0301060096"
```

---

## 📊 **INTERFACE VISUAL - SYNCPAGE**

```
╔══════════════════════════════════════════════════════════════════════════╗
║  🔄 Sync - Sincronização de AIHs                           [🔄 Atualizar]║
║  Reconciliação entre AIH Avançado e SISAIH01 (Confirmados SUS)          ║
╚══════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────┐
│ ℹ️ Etapa 1: Selecionar AIH Avançado → Etapa 2: SISAIH01 → Etapa 3: Sync │
└──────────────────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════════╗
║ 💾 Etapa 1: AIH Avançado (Processamento Interno)        ✓ 150 AIHs      ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  Hospital:                                                                ║
║  ┌────────────────────────────────────────────────────┐                 ║
║  │ Hospital Municipal João Silva              ▼       │                 ║
║  └────────────────────────────────────────────────────┘                 ║
║  🔓 Modo Administrador: você pode selecionar qualquer hospital          ║
║                                                                           ║
║  Competência:                                                             ║
║  ┌────────────────────────────────────────────────────┐                 ║
║  │ 10/2025                                    ▼       │                 ║
║  └────────────────────────────────────────────────────┘                 ║
║                                                                           ║
║  [           ✓ Etapa 1 Concluída            ]  [ Refazer ]              ║
║                                                                           ║
╚══════════════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════════════╗
║ 💜 Etapa 2: SISAIH01 (Confirmados SUS)                  ✓ 200 Registros ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  Hospital:                                                                ║
║  ┌────────────────────────────────────────────────────┐                 ║
║  │ Hospital Municipal João Silva              ▼       │                 ║
║  └────────────────────────────────────────────────────┘                 ║
║  🔓 Modo Administrador: você pode selecionar qualquer hospital          ║
║                                                                           ║
║  Competência:                                                             ║
║  ┌────────────────────────────────────────────────────┐                 ║
║  │ 10/2025                                    ▼       │                 ║
║  └────────────────────────────────────────────────────┘                 ║
║                                                                           ║
║  [           ✓ Etapa 2 Concluída            ]  [ Refazer ]              ║
║                                                                           ║
╚══════════════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════════════╗
║               🎯 Pronto para Sincronizar!                                ║
║                                                                           ║
║      150 AIHs do AIH Avançado serão comparadas com 200 registros        ║
║                        do SISAIH01                                        ║
║                                                                           ║
║      [  🔄  Executar Sincronização  ]                                   ║
║      (Gradiente: purple → pink → indigo)                                 ║
╚══════════════════════════════════════════════════════════════════════════╝

══════════════════════════ APÓS SINCRONIZAÇÃO ═════════════════════════════

┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 💾 AIH Avanç.│ ✅ Sincroni. │ ⏳ Pendentes │ ❌ Não Proc. │
│              │              │              │              │
│     150      │     150      │      0       │      50      │
│              │    75.0%     │ Ag. confirm. │ Faltam sist. │
└──────────────┴──────────────┴──────────────┴──────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ ✓ Sincronização Concluída!                                               │
│ De 200 registros confirmados pelo SUS, 150 foram encontrados no AIH      │
│ Avançado (75.0% de sincronização).                                       │
└──────────────────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════════╗
║ ✅ AIHs Sincronizadas (150 registros)                                    ║
╠═══╦═══════════════╦════════════╦═══════════╦═══╦════════════╦═══════════╣
║ # ║ Número AIH    ║ Paciente   ║ Data Int. ║Qt.║ Proced.Pr. ║Valor Total║
╠═══╬═══════════════╬════════════╬═══════════╬═══╬════════════╬═══════════╣
║ 1 ║4113020089616  ║João Silva  ║01/10/2025 ║ 3 ║0301060096  ║R$1.500,00 ║
║   ║               ║            ║           ║   ║Consulta... ║           ║
╠───╬───────────────╬────────────╬───────────╬───╬────────────╬───────────╣
║ 2 ║4113020089617  ║Maria Costa ║02/10/2025 ║ 5 ║0403010018  ║R$2.800,50 ║
║   ║               ║            ║           ║   ║Cirurgia... ║           ║
╠───╬───────────────╬────────────╬───────────╬───╬────────────╬───────────╣
║...║               ║            ║           ║   ║            ║           ║
╚═══╩═══════════════╩════════════╩═══════════╩═══╩════════════╩═══════════╝

┌──────────────────────────────────────────────────────────────────────────┐
│ Total de Registros: 150                   Valor Total: R$ 225.075,50     │
└──────────────────────────────────────────────────────────────────────────┘

                     [  🔄  Nova Sincronização  ]
```

---

## 📊 **INTERFACE VISUAL - SYNCDASHBOARD**

```
╔══════════════════════════════════════════════════════════════════════════╗
║  🔄 Sync - Reconciliação Tabwin                                          ║
║  Compare dados do relatório Tabwin (GSUS) com os dados do sistema       ║
╚══════════════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════════════╗
║ 📋 Configuração da Reconciliação                                         ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  Hospital:                        Competência:                           ║
║  ┌─────────────────────────┐      ┌─────────────────────────┐          ║
║  │ Hospital João Silva  ▼  │      │ 10/2025              ▼  │          ║
║  └─────────────────────────┘      └─────────────────────────┘          ║
║                                                                           ║
║  Arquivo Tabwin (XLSX):                                                  ║
║  ┌────────────────────────────────────────────────┬────────┐           ║
║  │ 📄 relatorio_tabwin_10_2025.xlsx               │   ✖    │           ║
║  └────────────────────────────────────────────────┴────────┘           ║
║  Colunas obrigatórias: SP_NAIH, SP_ATOPROF, SP_VALATO                   ║
║                                                                           ║
║  [          🔄  Sincronizar e Comparar          ]                       ║
║                                                                           ║
╚══════════════════════════════════════════════════════════════════════════╝

══════════════════════════ APÓS RECONCILIAÇÃO ═════════════════════════════

┌──────────────┬──────────────┬──────────────┬──────────────┬─────────────┐
│✅ Matches    │⚠️ Dif. Valor │⚠️ Dif. Qtd   │❌ Poss.Glosas│❌ Poss.Rejeic│
│   Perfeitos  │              │              │              │             │
│     120      │      15      │      10      │      30      │      25     │
└──────────────┴──────────────┴──────────────┴──────────────┴─────────────┘

╔══════════════════════════════════════════════════════════════════════════╗
║ Detalhamento da Reconciliação                                            ║
║ Total Tabwin: 165 | Total Sistema: 145 | Tempo: 1.23s                   ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  ┌─────────────┬─────────────┬────────────────┐                         ║
║  │ Matches(120)│ Glosas (30) │ Rejeições (25) │                         ║
║  └─────────────┴─────────────┴────────────────┘                         ║
║                                                                           ║
║  ╔═══════════════════════════════════════════════════════════════════╗  ║
║  ║ Matches (120 registros)                      [📥 Exportar Matches]║  ║
║  ╠═══╦═══════════════╦═════════════╦════════════╦═══════════╦═══════╣  ║
║  ║AIH║ Procedimento  ║ Paciente    ║ Médico     ║Val.Tabwin ║Status ║  ║
║  ╠═══╬═══════════════╬═════════════╬════════════╬═══════════╬═══════╣  ║
║  ║411║ 0301060096    ║João Silva   ║Dr. Santos  ║R$ 1500.00 ║ ✅ OK ║  ║
║  ╠───╬───────────────╬─────────────╬────────────╬───────────╬───────╣  ║
║  ║411║ 0403010018    ║Maria Costa  ║Dra. Lima   ║R$ 2800.50 ║⚠️ΔVal║  ║
║  ╠───╬───────────────╬─────────────╬────────────╬───────────╬───────╣  ║
║  ║...║               ║             ║            ║           ║       ║  ║
║  ╚═══╩═══════════════╩═════════════╩════════════╩═══════════╩═══════╝  ║
║                                                                           ║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

## 🔍 **DECISÃO: QUAL VERSÃO USAR?**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MATRIZ DE DECISÃO                                    │
└─────────────────────────────────────────────────────────────────────────┘

Cenário                              SyncPage        SyncDashboard
───────────────────────────────────  ──────────      ─────────────
Conferência diária de AIHs           ✅ SIM          ❌ NÃO
Verificar confirmação SUS            ✅ SIM          ❌ NÃO
Identificar glosas                   ⚠️ PARCIAL      ✅ SIM
Analisar diferenças de valores       ❌ NÃO          ✅ SIM
Reconciliar com Tabwin oficial       ❌ NÃO          ✅ SIM
Acesso para operadores               ✅ SIM          ❌ NÃO
Exportar relatórios Excel            ❌ NÃO          ✅ SIM
Auditoria mensal                     ⚠️ PARCIAL      ✅ SIM
Processamento interno                ✅ SIM          ⚠️ PARCIAL


┌─────────────────────────────────────────────────────────────────────────┐
│                    RECOMENDAÇÃO POR PERFIL                              │
└─────────────────────────────────────────────────────────────────────────┘

Perfil              Versão Principal    Versão Secundária    Frequência
──────────────────  ──────────────────  ───────────────────  ───────────
Operador            SyncPage            -                    Diária
Coordenador         SyncPage            SyncDashboard        Semanal
Auditor             SyncDashboard       SyncPage             Semanal
Diretor/Admin       SyncDashboard       SyncPage             Mensal
Desenvolvedor       Ambas               -                    Debug


┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUXO RECOMENDADO                                    │
└─────────────────────────────────────────────────────────────────────────┘

   DIÁRIO:
   └─► SyncPage: Verificar AIHs processadas vs confirmadas SUS

   SEMANAL:
   └─► SyncPage: Revisar pendentes de confirmação
   └─► SyncDashboard: Conferir com relatório Tabwin (se disponível)

   MENSAL:
   └─► SyncDashboard: Análise completa de glosas e rejeições
   └─► SyncDashboard: Exportar relatórios para diretoria
   └─► SyncPage: Consolidação final do mês
```

---

## 🎯 **CONCLUSÃO VISUAL**

```
╔══════════════════════════════════════════════════════════════════════════╗
║                        RESUMO EXECUTIVO                                  ║
╚══════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────┐
│ 🟢 SYNCPAGE                                                              │
│ ────────────────────────────────────────────────────────────────────    │
│                                                                           │
│ ✅ Vantagens:                                                            │
│    • Interface simples e guiada (3 etapas)                              │
│    • Dados diretos do banco (sem arquivo externo)                       │
│    • Acesso liberado para todos usuários                                │
│    • Ideal para conferência diária                                      │
│    • Mostra AIHs pendentes de confirmação SUS                           │
│                                                                           │
│ ⚠️ Limitações:                                                           │
│    • Não analisa diferenças de valores/quantidades                      │
│    • Sem exportação Excel                                                │
│    • Filtro de competência no cliente (performance)                     │
│                                                                           │
│ 🎯 Ideal para: Operação diária, acompanhamento de sincronização        │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ 🔵 SYNCDASHBOARD                                                         │
│ ────────────────────────────────────────────────────────────────────    │
│                                                                           │
│ ✅ Vantagens:                                                            │
│    • Análise detalhada de diferenças (valor/quantidade)                 │
│    • Identifica glosas e rejeições possíveis                            │
│    • Exportação Excel completa (3 tipos)                                │
│    • Reconciliação com relatório oficial Tabwin                         │
│    • Tolerância configurável de valores                                 │
│                                                                           │
│ ⚠️ Limitações:                                                           │
│    • Acesso restrito (Admin/Diretoria)                                  │
│    • Depende de arquivo externo (Tabwin XLSX)                           │
│    • Service complexo (múltiplos joins)                                 │
│    • Não mostra pendentes SUS                                            │
│                                                                           │
│ 🎯 Ideal para: Auditoria, análise mensal, relatórios executivos        │
└──────────────────────────────────────────────────────────────────────────┘


╔══════════════════════════════════════════════════════════════════════════╗
║               AMBAS AS VERSÕES SÃO COMPLEMENTARES                        ║
║                                                                           ║
║   Use SyncPage para operação diária e confirmação de sincronização     ║
║   Use SyncDashboard para auditoria e análise aprofundada de glosas     ║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

**Documento gerado em:** 2025-01-20  
**Versão:** 1.0  
**Status:** ✅ Diagrama Visual Completo

