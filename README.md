# Sistema de Repasses Médicos — SigtapSync

## Visão Geral

- Plataforma para gestão de produção médica, cálculo de incrementos (Opera Paraná), pagamentos e validação entre base local e fonte remota SIH.
- Visualização hierárquica completa: Médicos → Pacientes → Procedimentos, com filtros executivos e geração de relatórios.

## Arquitetura

- Front-end React: componentes principais em `src/components` (ExecutiveDashboard, MedicalProductionDashboard, DoctorPatientsDropdown, etc.).
- Serviços de dados:
  - Local (Supabase): AIHs, pacientes, procedimentos, médicos e hospitais em `src/services/doctorPatientService.ts`.
  - Remoto (Supabase SIH): RD (AIHs) e SP (procedimentos) em `src/services/sihApiAdapter.ts`.
- Regras e utilitários:
  - Incremento Opera Paraná em `src/config/operaParana.ts`.
  - Pagamentos médicos e regras por hospital em `src/config/doctorPaymentRules/*`.
  - Deduplicação e helpers em `src/utils/dedupTest.ts`, `src/utils/valueHelpers.ts`.

## Fontes de Dados

- Local (Supabase):
  - Tabelas: `aihs`, `patients`, `procedure_records`, `doctors`, `hospitals`.
  - Campos chave: `aihs.aih_number`, `aihs.cns_responsavel`, `aihs.competencia`, `procedure_records.procedure_code`.
- Remoto (SIH):
  - Tabelas: `sih_rd` (AIHs), `sih_sp` (procedimentos), `sigtap_procedimentos` (catálogo).
  - Filtros: por `cnes` (hospital), competência (`ano_cmpt`/`mes_cmpt`), caráter (`car_int`: '01' Eletivo, '02' Urgência), período de alta.

## Matching e Enriquecimento

- Normalização de AIH: remove não dígitos e zeros à esquerda para chave forte (`normalizeAih`).
- Join remoto → local:
  - Busca AIHs locais por `hospital_id` e `competencia`, mapeia por AIH normalizada para obter nome e prontuário do paciente.
  - Se não houver nome local, exibe “Nome não disponível” (sinal de não processado local).
- Atribuição do responsável:
  - Preferência para `cns_responsavel` quando presente; fallback para profissionais do SP quando ausente (podendo aparecer em múltiplos médicos).

## Filtros (Aba Profissionais)

- Hospital (por `id`, mapeado para `cnes` no SIH).
- Competência (YYYYMM ou YYYY-MM[-DD]).
- Caráter de Atendimento: `Todos | Eletivo (01) | Urgência (02)`.
- Período de alta (from/to).
- Busca por médico (nome/CNS/CRM) e por paciente (nome).

## KPIs

- Valor Total (Remoto/SIGTAP): soma dos valores RD (remoto) ou AIH local deduplicada.
- Total AIHs (SIH Remoto): quantidade em RD para o recorte atual.
- Incrementos (total): soma deduplicada por AIH dos incrementos (Eletivo + Urgência) quando SIH ativo.
- Valor Total (Base + Incremento): soma dos dois anteriores.
- Pagamento Médico Total: agregado dos valores calculados conforme regras por hospital/médico.
- Novos KPIs:
  - Incremento Eletivo: soma dos incrementos das AIHs com `car_int = '01'` (deduplicado por AIH).
  - Incremento Urgência: soma dos incrementos das AIHs com `car_int = '02'` (deduplicado por AIH).

## Incremento Opera Paraná

- Eletivo: incremento = soma dos procedimentos elegíveis × 1.5 (150%).
- Urgência/Emergência: incremento = soma dos procedimentos não excluídos × 0.2 (20%).
- Exclusões: lista de códigos SIGTAP que não recebem incremento (joelho/quadril/otorrino); não há bloqueio global por AIH.
- Cobertura médica: negações por nome (caixa alta) excluem incremento.
- Deduplicação: agregações de incremento usam chave AIH para evitar dupla contagem quando a mesma AIH aparece sob múltiplos médicos no SIH.

## Pagamentos Médicos

- Regras fixas, percentuais e individuais por hospital/médico.
- HON (planilha) para cenários específicos (cirurgia geral e hospital predefinido), com fallback para regras padrão.
- Cards individuais exibem detalhamento por procedimento com fator (2.5 eletivo, 1.2 urgência) quando aplicável.

## Tratamento de Anestesia

- CBO 225151 (04.xxx): valor zerado nos procedimentos para evitar dupla contagem no incremento e pagamentos.
- Visibilidade: inclui anestesistas atuantes por SP (match por `professional_name` e `professional_cbo`) quando necessário; pacientes associados com valor financeiro zerado.

## Relatórios

- Relatório Geral (Pacientes/Procedimentos): exporta dados detalhados por paciente e procedimento.
- Conferência (AIHs): lista AIHs, número, datas, valores e status.
- Simplificado:
  - Resolve “Médico” por `cns_responsavel` e faz dedup global por AIH.
  - “Comp. Aprovação” combina produção (AIH) e aprovação SIH (`sp_mm/sp_aa`).
  - PDF com alinhamento centralizado da coluna de aprovação.
- Validação Local vs Remoto (Excel):
  - Sem inserção local: AIHs no remoto produção que não têm nome local.
  - Pendentes SIH: AIHs locais não encontradas como homologadas no remoto (busca sem filtro de competência).

## Reconciliação Tabwin (GSUS)

- Processa XLSX (SP_NAIH, SP_ATOPROF, SP_VALATO, SP_QTD_ATO, SP_DTINTER/DTSAIDA, SP_PF_DOC).
- Matching por `AIH + procedimento` com tolerância de valor (R$ 0,50) e quantidade.
- Estatísticas: matches perfeitos, diferenças de valor/quantidade, possíveis glosas/rejeições.

## Comportamentos de UI Importantes

- Paciente remoto sem nome local aparece “Nome não disponível” (sinal de não processado local).
- Filtros ativos são aplicados globalmente (hospital, competência, caráter, alta, buscas).
- Fonte SIH: KPIs e listagens respeitam `car_int` ('01'/'02'), mapeamento por CNES e competência (`ano_cmpt/mes_cmpt`).

## Configuração

- Ambiente: variáveis em `src/config/env.ts` (flags de produção, uso SIH, avisos, logs).
- Integração SIH: `src/lib/sihSupabase` (chaves/URL configuradas no ambiente).

## Principais Caminhos de Código

- `src/components/ExecutiveDashboard.tsx`: shell da aba Profissionais, filtros, triggers de relatórios.
- `src/components/MedicalProductionDashboard.tsx`: KPIs, cards, geração de relatórios e cálculos agregados.
- `src/services/doctorPatientService.ts`: fonte local e lógica de montagem da hierarquia.
- `src/services/sihApiAdapter.ts`: fonte remota SIH e enriquecimento com dados locais.
- `src/config/operaParana.ts`: regras e exclusões do Opera Paraná.
- `src/services/syncService.ts`: reconciliação Tabwin.

## Boas Práticas e Limitações

- Sempre normalize `aih_number` para matching entre fontes.
- Ao usar SIH, deduplicar por AIH em agregações para evitar dupla contagem por múltiplos médicos.
- “Caráter de Atendimento” no SIH é `car_int`: use valores '01' (Eletivo) e '02' (Urgência).
- Pacientes podem aparecer sem nome quando ausência no local; use relatório de validação para acompanhar inserções pendentes.

## Como Validar

- KPIs: troque entre Eletivo e Urgência no dropdown e verifique os KPIs “Incremento Eletivo” e “Incremento Urgência”.
- Relatórios: gere o Simplificado para conferir “Comp. Aprovação” e dedup de AIH.
- Validação: use “Validação Local vs Remoto” para auditoria de inserções e homologações.

