# ✅ CHECKLIST RÁPIDO - TELA SYNC

## 🎯 **DECISÃO RÁPIDA: QUAL VERSÃO USAR?**

### **Responda estas perguntas:**

| Pergunta | SyncPage | SyncDashboard |
|----------|----------|---------------|
| Você é operador (não admin)? | ✅ | ❌ |
| Precisa de confirmação SUS? | ✅ | ❌ |
| Tem arquivo XLSX Tabwin? | ❌ | ✅ |
| Precisa analisar valores? | ❌ | ✅ |
| Precisa exportar Excel? | ❌ | ✅ |
| É uso diário/semanal? | ✅ | ❌ |
| É auditoria mensal? | ❌ | ✅ |

---

## 📋 **SYNCPAGE - CHECKLIST DE USO**

### **Pré-requisitos:**
- [ ] Ter acesso ao sistema (qualquer perfil)
- [ ] Hospital ter dados na tabela `aihs`
- [ ] Hospital ter dados na tabela `aih_registros`
- [ ] Competência estar cadastrada em ambas as tabelas

### **Passo a Passo:**

#### **ETAPA 1 - AIH Avançado:**
- [ ] Selecionar hospital (ou verificar se está pré-selecionado)
- [ ] Selecionar competência (formato: MM/YYYY)
- [ ] Clicar em "Buscar AIHs"
- [ ] Verificar mensagem: "✅ Etapa 1 concluída: X AIHs encontradas"
- [ ] Conferir se o número de AIHs está correto

#### **ETAPA 2 - SISAIH01:**
- [ ] Selecionar hospital (geralmente o mesmo da Etapa 1)
- [ ] Selecionar competência (geralmente a mesma da Etapa 1)
- [ ] Clicar em "Buscar SISAIH01"
- [ ] Verificar mensagem: "✅ Etapa 2 concluída: X registros encontrados"
- [ ] Conferir se o número de registros está correto

#### **ETAPA 3 - Sincronização:**
- [ ] Verificar resumo: "X AIHs serão comparadas com Y registros"
- [ ] Clicar em "Executar Sincronização"
- [ ] Aguardar processamento (pode levar alguns segundos)
- [ ] Verificar resultado nos KPIs:
  - [ ] Sincronizados: AIHs confirmadas pelo SUS
  - [ ] Pendentes: AIHs aguardando confirmação
  - [ ] Não Processados: AIHs que faltam no sistema

#### **Análise dos Resultados:**
- [ ] Taxa de sincronização está aceitável? (> 70%)
- [ ] Existem pendentes que precisam ser acompanhados?
- [ ] Existem não processados que precisam ser cadastrados?
- [ ] Valores na tabela estão corretos?

#### **Ações Pós-Sincronização:**
- [ ] Se necessário: Clicar em "Nova Sincronização" para outra competência
- [ ] Documentar os resultados (screenshot ou anotação)
- [ ] Encaminhar pendências para faturamento

---

## 📋 **SYNCDASHBOARD - CHECKLIST DE USO**

### **Pré-requisitos:**
- [ ] Ter perfil de Admin ou Diretoria
- [ ] Ter arquivo XLSX do Tabwin em mãos
- [ ] Arquivo Tabwin ter as colunas obrigatórias:
  - [ ] `SP_NAIH` (Número da AIH)
  - [ ] `SP_ATOPROF` (Código do Procedimento)
  - [ ] `SP_VALATO` (Valor do Ato)
- [ ] Hospital e competência terem dados no sistema

### **Passo a Passo:**

#### **Configuração:**
- [ ] Selecionar hospital
- [ ] Selecionar competência
- [ ] Fazer upload do arquivo XLSX Tabwin
- [ ] Verificar se o nome do arquivo apareceu
- [ ] Clicar em "Sincronizar e Comparar"

#### **Processamento:**
- [ ] Aguardar processamento (pode levar alguns minutos)
- [ ] Verificar se não houve erro de upload
- [ ] Conferir mensagem de conclusão

#### **Análise dos Resultados - KPIs:**
- [ ] **Matches Perfeitos:** Valores e quantidades iguais (🟢 Verde)
- [ ] **Diferenças de Valor:** Valores diferentes > R$ 0,50 (🟡 Amarelo)
- [ ] **Diferenças de Qtd:** Quantidades diferentes (🟠 Laranja)
- [ ] **Possíveis Glosas:** No Tabwin mas não no sistema (🔴 Vermelho)
- [ ] **Possíveis Rejeições:** No sistema mas não no Tabwin (🔵 Azul)

#### **Análise Detalhada - Aba Matches:**
- [ ] Clicar na aba "Matches"
- [ ] Verificar registros com status "OK" (verde)
- [ ] Verificar registros com "Δ Valor" (amarelo)
- [ ] Verificar registros com "Δ Qtd" (laranja)
- [ ] Exportar Excel se necessário: "Exportar Matches"

#### **Análise Detalhada - Aba Glosas:**
- [ ] Clicar na aba "Glosas"
- [ ] Ler o alerta: "Podem indicar glosas, rejeições ou procedimentos não cadastrados"
- [ ] Verificar cada registro:
  - [ ] AIH existe no Tabwin?
  - [ ] Por que não está no sistema?
  - [ ] É erro de cadastro?
  - [ ] É glosa real?
- [ ] Exportar Excel: "Exportar Glosas"

#### **Análise Detalhada - Aba Rejeições:**
- [ ] Clicar na aba "Rejeições"
- [ ] Ler o alerta: "Podem indicar rejeições, pendências ou erros de cadastro"
- [ ] Verificar cada registro:
  - [ ] AIH foi processada no sistema?
  - [ ] Por que não está no Tabwin?
  - [ ] É erro de faturamento?
  - [ ] É rejeição real?
- [ ] Exportar Excel: "Exportar Rejeições"

#### **Ações Pós-Reconciliação:**
- [ ] Gerar relatório consolidado (usando os 3 Excels)
- [ ] Encaminhar glosas para análise
- [ ] Encaminhar rejeições para correção
- [ ] Documentar diferenças de valores para ajustes
- [ ] Agendar nova reconciliação (próximo mês)

---

## 🚨 **TROUBLESHOOTING COMUM**

### **SyncPage:**

| Problema | Possível Causa | Solução |
|----------|----------------|---------|
| Nenhum hospital aparece | RLS ou permissões | Verificar acesso do usuário |
| Nenhuma competência aparece | Não há dados na tabela | Importar AIHs primeiro |
| Etapa 1: 0 AIHs encontradas | Filtro de competência sem dados | Selecionar outra competência |
| Etapa 2: 0 registros | Tabela `aih_registros` vazia | Importar SISAIH01 |
| Sincronização: 0% | Formato de AIH diferente | Verificar normalização |
| Descrições vazias | SIGTAP não carregado | Importar tabela SIGTAP |

### **SyncDashboard:**

| Problema | Possível Causa | Solução |
|----------|----------------|---------|
| "Acesso Restrito" | Perfil não autorizado | Pedir acesso a Admin |
| Erro ao ler arquivo | Formato incorreto | Verificar se é XLSX válido |
| "Colunas obrigatórias não encontradas" | Arquivo sem SP_NAIH/SP_ATOPROF | Verificar layout do Tabwin |
| 0 registros no sistema | Nenhum dado na competência | Verificar filtros |
| Muitas glosas | Sistema incompleto | Verificar importação de AIHs |
| Muitas rejeições | Tabwin incompleto | Verificar arquivo Tabwin |

---

## 📊 **INTERPRETAÇÃO DOS RESULTADOS**

### **SyncPage - O que significam os números:**

| Métrica | Valor Ideal | Valor Aceitável | Valor Preocupante | Ação |
|---------|-------------|-----------------|-------------------|------|
| Taxa Sinc. | > 90% | 70-90% | < 70% | Investigar não processados |
| Pendentes | 0-5% | 5-15% | > 15% | Acompanhar faturamento |
| Não Proc. | 0-5% | 5-15% | > 15% | Cadastrar AIHs faltantes |

**Exemplo de análise:**
```
✅ Sincronizados: 150 (75%)
⏳ Pendentes: 0 (0%)
❌ Não Processados: 50 (25%)

Interpretação:
→ Taxa de 75% está aceitável
→ Não há pendentes (bom sinal)
→ 50 AIHs faltam no sistema (AÇÃO: Cadastrar)
```

---

### **SyncDashboard - O que significam os números:**

| Métrica | Valor Ideal | Valor Aceitável | Valor Preocupante | Ação |
|---------|-------------|-----------------|-------------------|------|
| Matches % | > 80% | 60-80% | < 60% | Revisar processos |
| Dif. Valor | < 5% | 5-10% | > 10% | Conferir cálculos |
| Dif. Qtd | < 3% | 3-7% | > 7% | Revisar cadastros |
| Glosas | < 5% | 5-10% | > 10% | Auditoria urgente |
| Rejeições | < 5% | 5-10% | > 10% | Revisar faturamento |

**Exemplo de análise:**
```
✅ Matches Perfeitos: 120 (60%)
⚠️ Diferenças Valor: 15 (7.5%)
⚠️ Diferenças Qtd: 10 (5%)
❌ Possíveis Glosas: 30 (15%)
❌ Possíveis Rejeições: 25 (12.5%)

Interpretação:
→ Match de 60% está no limite aceitável
→ Diferenças são aceitáveis (< 10%)
→ Glosas de 15% são PREOCUPANTES (AUDITORIA)
→ Rejeições de 12.5% são PREOCUPANTES (REVISAR)
```

---

## 🎯 **FLUXO RECOMENDADO DE USO**

### **Rotina Diária (Operador):**
1. [ ] Abrir **SyncPage**
2. [ ] Verificar competência atual
3. [ ] Executar sincronização
4. [ ] Verificar se há pendentes novos
5. [ ] Reportar anomalias

### **Rotina Semanal (Coordenador):**
1. [ ] Abrir **SyncPage**
2. [ ] Verificar todas as competências ativas
3. [ ] Consolidar pendentes
4. [ ] Abrir **SyncDashboard** (se disponível)
5. [ ] Conferir com Tabwin semanal
6. [ ] Gerar relatório de divergências

### **Rotina Mensal (Diretor/Admin):**
1. [ ] Abrir **SyncDashboard**
2. [ ] Upload do Tabwin oficial do mês
3. [ ] Executar reconciliação completa
4. [ ] Exportar os 3 tipos de Excel (Matches/Glosas/Rejeições)
5. [ ] Analisar glosas com equipe de auditoria
6. [ ] Analisar rejeições com equipe de faturamento
7. [ ] Consolidar relatório executivo
8. [ ] Abrir **SyncPage** para conferência final
9. [ ] Documentar lições aprendidas

---

## 📚 **LINKS RÁPIDOS**

### **Documentação:**
- [ ] `ANALISE_COMPLETA_TELA_SYNC.md` - Análise técnica completa
- [ ] `DIAGRAMA_VISUAL_TELA_SYNC.md` - Fluxos e diagramas visuais
- [ ] `RESUMO_EXECUTIVO_TELA_SYNC.md` - Resumo executivo
- [ ] `CHECKLIST_TELA_SYNC.md` - Este documento

### **Código-fonte:**
- [ ] `src/components/SyncPage.tsx`
- [ ] `src/components/SyncDashboard.tsx`
- [ ] `src/services/syncService.ts`
- [ ] `src/services/doctorPatientService.ts`

### **Banco de dados:**
- [ ] `database/create_aih_registros_table.sql`
- [ ] `database/add_hospital_id_to_aih_registros.sql`
- [ ] `database/add_competencia_sisaih01.sql`

---

## ⏱️ **TEMPO ESTIMADO POR TAREFA**

| Tarefa | Tempo Estimado | Frequência |
|--------|----------------|------------|
| Sincronização simples (SyncPage) | 2-3 minutos | Diária |
| Análise de pendentes (SyncPage) | 5-10 minutos | Diária |
| Reconciliação completa (SyncDashboard) | 10-15 minutos | Mensal |
| Análise de glosas (SyncDashboard) | 20-30 minutos | Mensal |
| Relatório executivo | 30-60 minutos | Mensal |

---

## 🎓 **CAPACITAÇÃO - CHECKLIST DE TREINAMENTO**

### **Para Operadores:**
- [ ] Conhecer a diferença entre as duas versões
- [ ] Saber acessar SyncPage (`/aih-sync`)
- [ ] Entender o fluxo de 3 etapas
- [ ] Saber interpretar os KPIs básicos
- [ ] Saber quando reportar anomalias

### **Para Coordenadores:**
- [ ] Tudo do nível Operador +
- [ ] Saber usar SyncDashboard (se tiver acesso)
- [ ] Entender diferença entre glosas e rejeições
- [ ] Saber gerar relatórios semanais
- [ ] Conhecer fluxo de correção de pendências

### **Para Admin/Diretoria:**
- [ ] Tudo do nível Coordenador +
- [ ] Dominar SyncDashboard completamente
- [ ] Saber interpretar todas as métricas
- [ ] Conhecer tolerâncias e limites
- [ ] Saber exportar e consolidar relatórios
- [ ] Entender impacto financeiro das divergências

---

## ✅ **CHECKLIST FINAL DE ENTREGA**

### **Antes de usar em produção:**
- [ ] Todas as tabelas necessárias estão criadas
- [ ] RLS está configurado corretamente
- [ ] SIGTAP está importado
- [ ] Hospitais estão cadastrados
- [ ] Usuários têm as permissões corretas
- [ ] Pelo menos 1 competência tem dados
- [ ] Testes foram realizados com dados reais
- [ ] Equipe foi treinada
- [ ] Documentação foi lida

### **Após primeira utilização:**
- [ ] Resultados foram conferidos manualmente
- [ ] Anomalias foram investigadas
- [ ] Processos foram ajustados
- [ ] Frequência de uso foi definida
- [ ] Responsáveis foram designados

---

**Documento gerado em:** 2025-01-20  
**Versão:** 1.0  
**Status:** ✅ Checklist Completo  
**Tipo:** Documento de Referência Rápida

