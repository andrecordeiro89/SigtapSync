# 📚 GUIA DE REFERÊNCIA RÁPIDA - SIGTAP SYNC
## Consulta Rápida para Usuários e Desenvolvedores

**Versão:** 1.0  
**Última Atualização:** 04/10/2025

---

## 🎯 VISÃO GERAL DO SISTEMA

| Item | Descrição |
|------|-----------|
| **Nome** | SIGTAP Sync |
| **Tipo** | Sistema de Gestão de Faturamento Hospitalar SUS |
| **Plataforma** | Web Application (React + TypeScript) |
| **Acesso** | https://[seu-dominio] |
| **Suporte** | [email/telefone de suporte] |

---

## 👥 PERFIS DE USUÁRIO

| Role | Acesso | Funcionalidades Principais |
|------|--------|---------------------------|
| **Developer** | Total | Tudo + Debug |
| **Admin** | Administrativo | Gestão completa |
| **Director** | Executivo | Todos hospitais + Dashboards |
| **Coordinator** | Supervisão | Monitoramento operacional |
| **Auditor** | Auditoria | Logs e compliance |
| **TI** | Técnico | Configuração e suporte |
| **Operator** | Operacional | Hospital específico |

---

## 🗂️ TELAS PRINCIPAIS

### 1. Dashboard
**Atalho:** `/` ou Tab "Dashboard"  
**Quem acessa:** Todos  
**O que faz:** Visão geral das AIHs processadas, métricas principais

### 2. SIGTAP (Importação)
**Atalho:** Tab "SIGTAP"  
**Quem acessa:** Admin/Diretor  
**O que faz:** Importar tabela oficial SIGTAP  
**Formatos:** Excel (rápido), ZIP (oficial), PDF (com IA)

### 3. Consulta SIGTAP
**Atalho:** Tab "Consulta SIGTAP"  
**Quem acessa:** Todos  
**O que faz:** Buscar procedimentos na tabela SIGTAP  
**Dica:** Use código ou descrição, combine filtros para refinar

### 4. AIH Avançado
**Atalho:** Tab "AIH Avançado"  
**Quem acessa:** Todos  
**O que faz:** Processar AIHs (Upload → Extração → Matching → Salvar)  
**Formatos:** Excel, PDF, ZIP  
**Fluxo:** Selecionar Hospital → Escolher Formato → Upload → Processar

### 5. Pacientes
**Atalho:** Tab "Pacientes"  
**Quem acessa:** Todos  
**O que faz:** Cadastrar e gerenciar pacientes  
**Campos obrigatórios:** Nome, CNS, Data Nascimento, Gênero

### 6. Dashboard Executivo
**Atalho:** Tab "Dashboard Executivo"  
**Quem acessa:** Executivos (Diretor/Coordenador/Admin)  
**O que faz:** KPIs, análises financeiras, performance por hospital

### 7. Corpo Médico
**Atalho:** Tab "Corpo Médico"  
**Quem acessa:** Executivos  
**O que faz:** Análise de produção médica, especialidades, performance

### 8. Auditoria AIH
**Atalho:** Tab "Auditoria AIH"  
**Quem acessa:** Auditores+ (Auditor/Admin/Diretor)  
**O que faz:** Rastreamento e logs de processamento de AIHs

---

## ⚡ AÇÕES RÁPIDAS

### Como processar AIHs rapidamente?
```
1. Clique em "AIH Avançado"
2. Selecione o Hospital no dropdown
3. Escolha o formato (recomendado: Excel)
4. Arraste o arquivo ou clique para selecionar
5. Clique em "🚀 Processar AIHs"
6. Acompanhe o progresso em tempo real
7. Revise manualmente AIHs marcadas com ⚠️
8. Aguarde conclusão
```

### Como buscar um procedimento SIGTAP?
```
1. Clique em "Consulta SIGTAP"
2. Digite código ou descrição na busca
3. (Opcional) Use filtros avançados
4. Clique em uma linha para ver detalhes completos
5. (Opcional) Exporte para Excel com botão "⬇️ Exportar"
```

### Como cadastrar um paciente?
```
1. Clique em "Pacientes"
2. Clique no botão "➕ Novo Paciente"
3. Preencha campos obrigatórios:
   - Nome completo
   - CNS (15 dígitos)
   - Data de nascimento
   - Gênero (M ou F)
4. (Opcional) Preencha outros campos
5. Clique em "💾 Salvar"
```

### Como importar tabela SIGTAP?
```
⚠️ ATENÇÃO: Apenas Admin/Diretor

1. Clique em "SIGTAP"
2. Escolha o formato:
   - Excel: mais rápido (5-30s)
   - ZIP Oficial: mais preciso (30-120s)
   - PDF: com IA (5-15min)
3. Arraste arquivo ou clique para selecionar
4. Aguarde processamento
5. Verifique histórico de importações
```

---

## 🔍 BUSCA E FILTROS

### Busca de Procedimentos SIGTAP

**Busca Simples:**
- Digite código: `0301010013`
- Digite descrição: `consulta médica`
- Digite parcial: `030101`

**Filtros Avançados:**
- **Modalidade:** Ambulatorial, Hospitalar, etc.
- **Complexidade:** Atenção Básica, Média, Alta
- **Financiamento:** MAC, FAEC, etc.
- **Gênero:** M, F, Ambos
- **Valor:** Mínimo e Máximo

**Combinar Filtros:**
Todos os filtros aplicam-se simultaneamente (AND lógico)

### Busca de Pacientes

**Por CNS:**
```
Digite CNS completo ou parcial
Exemplo: 123456789012345
```

**Por Nome:**
```
Digite nome ou parte do nome
Exemplo: João Silva
```

**Por Prontuário:**
```
Digite número do prontuário interno
```

---

## 🎨 INTERFACE

### Cores de Status

| Cor | Significado | Onde aparece |
|-----|-------------|--------------|
| 🟢 Verde | Sucesso, Aprovado | AIHs aprovadas, notificações sucesso |
| 🟡 Amarelo | Atenção, Revisão Manual | AIHs que precisam revisão |
| 🔴 Vermelho | Erro, Rejeitado | AIHs rejeitadas, erros |
| 🔵 Azul | Informação, Neutro | Badges informativos |
| 🟣 Roxo | Admin/Diretor | Badges de acesso elevado |

### Badges Comuns

| Badge | Significado |
|-------|-------------|
| `✅ Aprovada` | AIH aprovada automaticamente |
| `⚠️ Revisão Manual` | Requer revisão humana (score 50-80%) |
| `❌ Rejeitada` | AIH rejeitada (score <50%) |
| `⏳ Pendente` | Em processamento |
| `🟢 OFICIAL` | Sistema/formato oficial |
| `👑 DIRETOR` | Usuário com acesso executivo |
| `🛡️ ADMIN` | Usuário administrador |

### Ícones de Ação

| Ícone | Ação |
|-------|------|
| 👁️ | Visualizar detalhes |
| ✏️ | Editar |
| 🗑️ | Excluir |
| ⬇️ | Download/Exportar |
| ⬆️ | Upload/Importar |
| 🔄 | Atualizar/Recarregar |
| ➕ | Adicionar novo |
| ✅ | Aprovar/Confirmar |
| ❌ | Rejeitar/Cancelar |

---

## 📊 INTERPRETAÇÃO DE SCORES

### Score de Matching (AIH → Procedimento SIGTAP)

| Score | Status | Significado | Ação Automática |
|-------|--------|-------------|-----------------|
| **80-100%** | ✅ Aprovado | Match excelente, todas validações OK | Aprovação automática |
| **50-79%** | ⚠️ Revisão | Match parcial, algumas validações falharam | Marcado para revisão manual |
| **0-49%** | ❌ Rejeitado | Match ruim, muitas validações falharam | Rejeição automática |

### Componentes do Score

| Validação | Peso | O que verifica |
|-----------|------|----------------|
| **Código Match** | 100% | Código procedimento encontrado na SIGTAP |
| **Gênero** | 20% | Gênero paciente × restrição procedimento |
| **Idade** | 25% | Idade paciente × faixa etária permitida |
| **CID** | 30% | CID principal × CIDs permitidos |
| **Habilitação** | 15% | Hospital habilitado para procedimento |
| **CBO** | 10% | CBO profissional × CBOs permitidos |

---

## 💰 VALORES E CÁLCULOS

### Componentes do Valor de uma AIH

```
Valor Total = SH + SP + (SA se aplicável) + (Anestesia se aplicável)

SH = Serviço Hospitalar (diárias, materiais)
SP = Serviço Profissional (honorários médicos)
SA = Serviço Ambulatorial (procedimentos ambulatoriais)
```

### Regras de Valor

**Ambulatorial:**
- SH = R$ 0,00 (não há internação)
- SP = Valor do procedimento
- Total = SP

**Hospitalar:**
- SH = Valor hospitalar
- SP = Valor profissional
- Total = SH + SP

**Cirurgias Múltiplas (mesmo ato):**
- 1ª cirurgia: 100% do valor
- 2ª cirurgia: 70% do valor
- Demais: 50% do valor cada

---

## 🔐 SEGURANÇA E PRIVACIDADE

### Dados Sensíveis (LGPD)

**Dados de Pacientes:**
- Nome completo
- CNS (Cartão Nacional de Saúde)
- CPF
- Data de nascimento
- Dados clínicos

**Proteções:**
- Acesso controlado por role
- RLS (Row Level Security) no banco
- Criptografia de dados sensíveis
- Logs de auditoria completos
- Anonimização em relatórios públicos

### Boas Práticas

✅ **Faça:**
- Faça logout ao sair
- Use senhas fortes
- Revise AIHs manualmente quando marcadas
- Exporte dados apenas quando necessário
- Reporte erros ao suporte

❌ **Não Faça:**
- Compartilhe sua senha
- Deixe sessão aberta em computador público
- Exporte dados para dispositivos pessoais
- Aprove AIHs sem revisar quando marcadas
- Ignore erros de processamento

---

## 🐛 TROUBLESHOOTING (Solução de Problemas)

### Sistema não carrega / Tela branca

**Possíveis causas:**
1. Sessão expirada
2. Cache corrompido
3. Erro de conexão

**Solução:**
```
1. Aguarde 10 segundos
2. Se não resolver, clique em "🔄 Resetar Sessão"
3. Se ainda não resolver, pressione Ctrl+Shift+R (Windows) ou Cmd+Shift+R (Mac)
4. Como último recurso, limpe cache do navegador
```

### Erro ao processar AIH

**Mensagem:** "Erro ao processar AIH"

**Possíveis causas:**
1. Arquivo corrompido
2. Formato não suportado
3. Dados obrigatórios ausentes
4. Erro de conexão com banco

**Solução:**
```
1. Verifique se arquivo está correto
2. Tente formato alternativo (se possível)
3. Verifique se todos campos obrigatórios estão presentes
4. Tente novamente após alguns minutos
5. Se persistir, entre em contato com suporte
```

### Procedimento não encontrado na SIGTAP

**Mensagem:** "Procedimento [código] não encontrado"

**Possíveis causas:**
1. Código incorreto no arquivo fonte
2. Tabela SIGTAP desatualizada
3. Código descontinuado

**Solução:**
```
1. Verifique código no arquivo fonte
2. Busque código na "Consulta SIGTAP" para confirmar existência
3. Se código não existir, verifique com fonte oficial (DATASUS)
4. Pode ser necessário importar versão mais recente da SIGTAP
5. Entre em contato com Admin para atualização
```

### AIH marcada para revisão manual

**Mensagem:** ⚠️ Score 50-79% - Revisão Manual necessária

**O que significa:**
Match parcial. Algumas validações falharam mas procedimento foi encontrado.

**O que fazer:**
```
1. Clique na AIH marcada para ver detalhes
2. Revise quais validações falharam:
   - ❌ Gênero incompatível?
   - ❌ Idade fora da faixa?
   - ❌ CID não permitido?
   - ❌ Hospital sem habilitação?
3. Decida:
   - ✅ Aprovar: se erros são aceitáveis/justificáveis
   - ❌ Rejeitar: se incompatibilidade é real
   - 🔍 Buscar alternativa: procedimento similar
```

---

## 📞 CONTATOS E SUPORTE

### Suporte Técnico
- **Email:** [suporte@sigtapsync.com]
- **Telefone:** [(XX) XXXX-XXXX]
- **Horário:** Segunda a Sexta, 8h às 18h

### Suporte por Tipo de Problema

| Problema | Contato |
|----------|---------|
| Erro técnico no sistema | Suporte Técnico |
| Dúvida sobre funcionalidade | Suporte Técnico |
| Solicitação de acesso/permissão | Administrador do Sistema |
| Dúvida sobre regras SUS | Coordenação de Faturamento |
| Atualização de SIGTAP | Administrador do Sistema |

---

## 📋 CHECKLIST DE PROCESSOS

### ✅ Processar Lote de AIHs

- [ ] Tenho arquivo em formato suportado (Excel/PDF/ZIP)
- [ ] Sei qual hospital selecionar
- [ ] Arquivo está correto e validado
- [ ] Tenho tempo para acompanhar processamento (5-30 min)
- [ ] Estou preparado para revisar AIHs marcadas
- [ ] Vou verificar relatório final antes de sair

### ✅ Cadastrar Novo Paciente

- [ ] Tenho nome completo do paciente
- [ ] Tenho CNS válido (15 dígitos)
- [ ] Tenho data de nascimento
- [ ] Sei o gênero (M ou F)
- [ ] Tenho dados adicionais (opcional: CPF, endereço, contato)
- [ ] Verifiquei se paciente já não está cadastrado

### ✅ Importar Nova Tabela SIGTAP

- [ ] Sou Admin ou Diretor
- [ ] Tenho arquivo oficial do DATASUS
- [ ] Arquivo é da competência correta
- [ ] Tenho tempo para aguardar importação (5-30 min)
- [ ] Vou verificar histórico após importação
- [ ] Avisei equipe sobre atualização

---

## 🎓 GLOSSÁRIO

| Termo | Significado |
|-------|-------------|
| **AIH** | Autorização de Internação Hospitalar - documento que autoriza internação no SUS |
| **SIGTAP** | Sistema de Gerenciamento da Tabela de Procedimentos, Medicamentos e OPM do SUS |
| **CNS** | Cartão Nacional de Saúde - número único de identificação do paciente no SUS |
| **CID** | Classificação Internacional de Doenças - código de diagnóstico |
| **CBO** | Classificação Brasileira de Ocupações - código da profissão do profissional |
| **SH** | Serviço Hospitalar - componente do valor da AIH (custos hospitalares) |
| **SP** | Serviço Profissional - componente do valor da AIH (honorários médicos) |
| **SA** | Serviço Ambulatorial - valor de procedimentos ambulatoriais |
| **RLS** | Row Level Security - segurança a nível de linha no banco de dados |
| **RBAC** | Role-Based Access Control - controle de acesso baseado em perfis |
| **Matching** | Processo de encontrar procedimento SIGTAP correspondente à AIH |
| **Score** | Pontuação de compatibilidade (0-100%) entre AIH e procedimento |
| **Competência** | Mês/Ano de referência para faturamento (ex: 10/2025) |
| **Habilitação** | Autorização do hospital para realizar determinados procedimentos |

---

## 🔗 LINKS ÚTEIS

### Documentação Completa
- [RELATORIO_ANALISE_SISTEMA_COMPLETO.md](./RELATORIO_ANALISE_SISTEMA_COMPLETO.md)
- [CATALOGO_COMPONENTES_INTERATIVOS.md](./CATALOGO_COMPONENTES_INTERATIVOS.md)
- [MAPEAMENTO_FUNCIONALIDADES_REGRAS_NEGOCIO.md](./MAPEAMENTO_FUNCIONALIDADES_REGRAS_NEGOCIO.md)

### Recursos Externos
- **DATASUS:** http://datasus.saude.gov.br/
- **SIGTAP Oficial:** http://sigtap.datasus.gov.br/
- **Manuais SUS:** http://portalarquivos.saude.gov.br/

---

## 📈 ATALHOS DE TECLADO

| Atalho | Ação |
|--------|------|
| `Ctrl + K` ou `Cmd + K` | Abrir busca rápida (se implementado) |
| `Ctrl + /` ou `Cmd + /` | Abrir ajuda (se implementado) |
| `Esc` | Fechar modal aberto |
| `F5` | Recarregar página |
| `Ctrl + Shift + R` | Recarregar sem cache |

---

**© 2025 SIGTAP Sync - Guia de Referência Rápida**  
*Versão 1.0 - Para impressão e consulta diária*

