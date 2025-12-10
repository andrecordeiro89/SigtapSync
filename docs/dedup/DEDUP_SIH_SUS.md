Deduplicação inteligente SIH/SUS (AIH)

Resumo prático
- AIH principal como fato; tabelas filhas agregadas (procedimentos, profissionais, diagnósticos).
- Evitar JOIN direto que multiplica linhas (ex.: 5 procedimentos × 3 profissionais = 15 linhas por AIH).
- Usar CTEs/aggregates deduplicadas e cruzamentos controlados.

Mapeamento para o nosso ambiente
- Local: `aihs` (fato), `procedure_records` (SP), `patients` (paciente), `aih_matches` (match SIGTAP opcional).
- Remoto (SIH): `sih_rd` (AIH/base), `sih_sp` (procedimentos), `sih_prof`/derivadas (profissionais), quando disponíveis via adapters.
- Identificadores: `aihs.aih_number`, `procedure_records.aih_id`/`aih_number`, profissional por `professional_cns`/`professional_cbo`.

Padrões de consulta seguros
1) Resumo por AIH (uma linha por AIH)
```sql
SELECT
  a.id,
  a.hospital_id,
  a.aih_number,
  a.calculated_total_value AS valor_total,
  COALESCE(proc.qtd_proc, 0) AS total_procedimentos,
  COALESCE(prof.qtd_profissionais, 0) AS total_profissionais
FROM public.aihs a
LEFT JOIN (
  SELECT aih_id, COUNT(*) AS qtd_proc
  FROM public.procedure_records
  GROUP BY aih_id
) proc ON proc.aih_id = a.id
LEFT JOIN (
  SELECT aih_id, COUNT(DISTINCT professional_cns) AS qtd_profissionais
  FROM public.procedure_records
  GROUP BY aih_id
) prof ON prof.aih_id = a.id;
```

2) Lista de procedimentos deduplicada (sem multiplicar com profissionais)
```sql
SELECT DISTINCT
  pr.aih_id,
  pr.procedure_code,
  pr.quantity,
  pr.total_value
FROM public.procedure_records pr
WHERE pr.hospital_id = $1;
```

3) Cruzar procedimento × profissional com controle de duplicação
```sql
WITH proc_dedup AS (
  SELECT DISTINCT aih_id, procedure_code, quantity
  FROM public.procedure_records
  WHERE hospital_id = $1
), prof_dedup AS (
  SELECT DISTINCT aih_id, professional_cbo, professional_cns
  FROM public.procedure_records
  WHERE hospital_id = $1
)
SELECT
  p.aih_id,
  p.procedure_code,
  pr.professional_cbo,
  pr.professional_cns
FROM proc_dedup p
LEFT JOIN prof_dedup pr USING (aih_id);
```

Camadas recomendadas (BI-friendly)
- Camada fato: `fato_aih` (1 linha por AIH com totais, contagens).
- Dimensões: `dim_procedimentos` (catálogo por código), `dim_profissionais` (CNS/CBO por hospital).
- Fatos agregados: `fato_proc` (procedimentos por AIH), `fato_prof` (profissionais por AIH).

Regras operacionais
- Especialidade/CBO: validar compatibilidade (alertas quando incompatível com procedimento).
- Profissional sem CNS: sinalizar e permitir conferência.
- AIH com procedimento mas sem profissional: marcador de auditoria.
- Anestesia 04.xxx: deduplicar e tratar como caso especial (não somar valores indevidos em 04 quando não aplicável).

Uso nos dashboards
- Tela principal (AIH): usar `fato_aih` para valor, total de procedimentos e profissionais, tempo de permanência, especialidade.
- Drill-down: AIH → procedimentos deduplicados → profissionais vinculados deduplicados.
- Heatmap CBO × Procedimento: cruzamento com dimensões deduplicadas para auditoria.

Benefícios
- Evita KPIs inflados e duplicados artificiais.
- Facilita auditoria automática (incompatibilidades, ausências de CNS/profissional).
- Entrega visão limpa da conta hospitalar e reduz tempo de conferência.

Observações
- Em cargas locais, preservar `aihs.aih_number` como chave de união; em procedimentos, garantir referência consistente via `aih_id`/`aih_number`.
- Para consolidação de paciente, priorizar `patients.cns` quando disponível; usar `patient_key` somente como apoio de resolução.
