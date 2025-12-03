# 🏥 SIGTAP Sync — Sistema de Repasses Médicos
Plataforma dedicada exclusivamente ao cálculo, análise e gestão de repasses médicos, com visão 360º por médico, paciente (AIH) e procedimento. Unifica SIGTAP e DATASUS (SIH/SIA) via pipeline ETL, fornecendo dados tratados e normalizados para decisões precisas.

## 🎯 Propósito
- Calcular repasses médicos com regras claras e auditáveis.
- Analisar produção por médico/especialidade/hospital com competência mensal.
- Descomplicar dados legados do DATASUS (SIH/SIA) por padronização e joins consistentes.

## 👥 Usuários-alvo
- Diretoria e administração (visão executiva de repasses).
- Coordenação/faturamento (operação e conferência).
- TI (integrações e observabilidade).

## � Pipeline ETL (Banco Remoto DATASUS)
- ETL contínuo para SIH/SIA: ingestão, limpeza e normalização.
- Competência mensal: RD `mes_cmpt (YYYYMM)` e SP `sp_mm (YYYYMM)`.
- Normalização de códigos: SIGTAP `XX.XX.XX.XXX-X`, CIDs e CBOs.
- Join de descrições: `sigtap_procedimentos (code, description)` por código formatado.
- Dados fidedignos para TODOS os arquivos DATASUS (SIH, SIA e afins).

## 🧠 Modelagem de Repasses
- Hierarquia: Médico → Paciente (AIH) → Procedimentos.
- AIH Seca: total por internação `val_tot` (SIH_RD).
- Procedimentos: código, CBO, complexidade, quantidade (`sp_qtd_ato`), valor (`sp_valato`).
- Descrição de procedimento: join remoto por `code` (fallback CSV local).

## 📐 Lógicas de Cálculo
- Base SIGTAP por procedimento/AIH.
- Regras específicas (exemplos):
  - Incremento Opera Paraná (+150%) quando elegível.
  - Pagamentos fixos (mensal/por paciente) por médico/hospital.
  - Percentual sobre total quando previsto.
  - CBO 225151 (anestesia): valor exibido na UI “apenas visualização”; cálculo segue regras de exclusão (ex.: 04.xxx não calculáveis, exceções como cesariana).

## � Filtros e Navegação
- Hospital (CNES): filtro em RD e reflexo em SP via `sp_naih`.
- Competência: `YYYYMM` (SP `sp_mm`) com suporte a `YYYY-MM` em RD; normalizado.
- Profissionais: visão hierárquica com agrupamento por médico×hospital, busca e paginação.

## 📊 Funcionalidades
- Visão Executiva de Repasses: KPIs por médico/especialidade/hospital.
- Hierarquia de Produção: AIH Seca (val_tot) + procedimentos detalhados.
- Descrição Consolidada: join remoto confiável de SIGTAP.
- Exportação/Relatórios: séries e ranking via serviço de analytics.

## 🧩 Tecnologias
- Frontend: React 18, TypeScript, Vite, Tailwind, shadcn/Radix.
- Dados: Supabase (Postgres, views/RPCs), alternância segura para SIH remoto.
- Analytics: FastAPI (Python) para ranking/séries por médico.
- ETL: pipeline DATASUS com padronização de competência e códigos.

## 🔒 Segurança e Conformidade
- Perfis e acessos por hospital; auditoria de ações.
- LGPD: minimização de PII (nome do paciente omitido no SIH remoto), tráfego seguro.

## 🚀 Como Usar
- Ativar fonte remota (SIH): `VITE_SIH_SUPABASE_URL`, `VITE_SIH_SUPABASE_ANON_KEY`, `VITE_USE_SIH_SOURCE=true`.
- Selecionar hospital (CNES) e competência (YYYYMM).
- Abrir “Profissionais”: verificar AIH Seca (val_tot) + procedimentos com descrições.
- Exportar análises executivas quando necessário.

## 🗺️ Roadmap
- Regras de repasses parametrizáveis por hospital/especialidade.
- Séries temporais por competência/esp. para decisão executiva.
- Ampliação de ETL para mais arquivos DATASUS e reconciliações cruzadas.

---
Foco total em repasses médicos: dados confiáveis, regras claras e visão 360º para acelerar a gestão hospitalar.
- Decisões baseadas em dados
- Identificação de oportunidades
- Monitoramento em tempo real

### 2) 🤖 Automação Inteligente
Processamento híbrido com IA e parsers tradicionais

| **Formato** | **Performance** | **Precisão** | **Custo** |
|-------------|-----------------|--------------|-----------|
| **📊 Excel** | **Excelente** | **Máxima** | **Gratuito** |
| **📦 ZIP Oficial** | **Ótima** | **Alta** | **Gratuito** |
| **📄 PDF** | **Boa** | **Boa** | **Baixo** |

**Tecnologias:**
- **Extração Tradicional:** Algoritmos proprietários
- **IA Gemini:** Processamento de casos complexos
- **Merge Inteligente:** Combinação dos melhores resultados

### 3) 🎯 Matching Automático (AIH ↔ SIGTAP)
Sistema de pontuação e validações clínicas/administrativas
- **Validação de Gênero:** Compatibilidade de sexo
- **Validação de Idade:** Faixas etárias permitidas
- **Compatibilidade CID:** Códigos de diagnóstico válidos
- **Habilitação Hospital:** Procedimentos habilitados
- **CBO Profissional:** Códigos de ocupação válidos

**Decisão Automática:**
- **Score Alto:** Aprovação automática
- **Score Médio:** Revisão manual
- **Score Baixo:** Rejeição automática

### 4) 🩺 Corpo Médico
Analytics avançados por médico/especialidade/hospital

### 5) 🔄 Pipeline ETL — Banco Remoto DATASUS
- Banco remoto operando como pipeline ETL, recebendo dados limpos e tratados (SIH, SIA, etc.)
- Padronização de colunas e formatos (competência mensal, códigos SIGTAP normalizados)
- Consistência entre RD (AIH) e SP (procedimentos), com joins confiáveis para descrições
- Dados fidedignos para análises e repasses em todos os arquivos do DATASUS

### 6) 🔍 Descomplicando Dados Legados
- Normalização de códigos (procedimentos, CIDs, CBOs) e versões SIGTAP ativas
- Extração e reconciliação de registros de difícil manipulação com parsers robustos
- Alternância segura entre fonte local e remota com filtros consistentes (hospital, competência)
- **Performance individual** por especialidade
- **Produtividade** e qualidade por médico
- **Distribuição** por hospital e departamento
- **Tendências** e benchmarks

**Relatórios Executivos:**
- Ranking de produtividade
- Análise de especialidades
- Oportunidades de melhoria
- Compliance profissional

---

## 🏗️ Arquitetura

### 🔒 Segurança e Compliance
- **🛡️ Row Level Security (RLS):** Proteção a nível de linha
- **🔐 Criptografia:** Dados sensíveis protegidos
- **📋 LGPD Compliant:** Conformidade total
- **🔍 Auditoria 360°:** Rastreabilidade completa
- **🚨 Alertas de Segurança:** Monitoramento contínuo

### 📈 Performance
- **⚡ Consultas Otimizadas:** Banco de dados eficiente
- **🔄 Alta Disponibilidade:** Sistema estável
- **📊 Processamento em Lote:** Grandes volumes
- **🌐 Multi-tenant:** Isolamento por hospital
- **📱 Responsivo:** Desktop, tablet, mobile

### 🔧 Tecnologias
```
Frontend Moderno          Backend Robusto           IA & Analytics
├── React 18 + TypeScript  ├── Supabase PostgreSQL   ├── Google Gemini AI
├── Shadcn/UI Premium      ├── APIs RESTful          ├── Algoritmos Proprietários
├── TailwindCSS            ├── 10 Tabelas Otimizadas ├── Scoring Inteligente
└── React Query            └── Triggers Automáticos  └── Relatórios Avançados
```

### Integrações
- Supabase principal (hospitais, pacientes, AIHs, procedimentos, audit logs, views/RPCs)
- Supabase SIH remoto (sih_rd, sih_sp, sigtap_procedimentos)
- FastAPI (analytics por médico/especialidade/séries)

---

## 🎯 Casos de Uso

### **🏥 HOSPITAL REGIONAL**
**Desafios Anteriores:**
- Múltiplos analistas para faturamento manual
- Erros frequentes nas AIHs
- Processo de faturamento demorado
- Perdas operacionais

**Resultados com SIGTAP Sync:**
- Redução significativa de equipe necessária
- Diminuição substancial de erros
- Aceleração do processo de faturamento
- Economia operacional considerável

### **🏥 REDE HOSPITALAR**
**Desafios Anteriores:**
- Processos descentralizados
- Falta de visibilidade corporativa
- Auditoria manual demorada
- Compliance inconsistente

**Resultados com SIGTAP Sync:**
- Dashboard corporativo unificado
- Visibilidade total em tempo real
- Auditoria automatizada
- Compliance garantido

---

## 📊 Indicadores de Performance

### **📈 OPERACIONAIS**
- **Volume Processado:** Processamento em grande escala
- **Tempo de Processamento:** Otimizado por AIH
- **Taxa de Sucesso:** Alta automatização
- **Disponibilidade:** Sistema estável

### **💰 FINANCEIROS**
- **Otimização de Receita:** Melhoria no faturamento
- **Redução de Custos:** Economia operacional
- **Eficiência:** Processos otimizados

### **🎯 QUALIDADE**
- **Taxa de Aprovação:** Alta precisão
- **Matching Inteligente:** Sistema confiável
- **Tempo de Resposta:** Interface ágil
- **Satisfação:** Usuários satisfeitos

---

## 🛠️ Implementação e Suporte

### **🚀 IMPLANTAÇÃO RÁPIDA**
- **Semana 1:** Configuração e treinamento
- **Semana 2:** Migração de dados
- **Semana 3:** Homologação e ajustes
- **Semana 4:** Go-live e suporte

### **📚 TREINAMENTO COMPLETO**
- **Diretores:** Dashboard executivo e KPIs
- **Gerentes:** Operação e monitoramento
- **Analistas:** Uso diário e casos especiais
- **TI:** Configuração e manutenção

### 🔧 SUPORTE TÉCNICO
- **24/7 Monitoramento:** Disponibilidade garantida
 - **Atualizações contínuas:** Evolução de regras de repasse e filtros
 - **Observabilidade:** Logs, métricas e saúde de serviços
- **Suporte Técnico:** Especialistas dedicados
- **Atualizações:** Melhorias contínuas
- **Documentação:** Guias completos

---

## 📋 **CONTROLE DE ACESSO E ROLES**

### **🔐 NÍVEIS DE ACESSO**
| **Role** | **Descrição** | **Acesso** |
|----------|---------------|------------|
| **👑 Director** | Diretoria Geral | Todos hospitais + Analytics |
| **🛡️ Admin** | Administrador | Configuração total |
| **📊 Coordinator** | Coordenação | Supervisão geral |
| **🔍 Auditor** | Auditoria | Monitoramento completo |
| **⚙️ TI** | Suporte Técnico | Configuração e logs |
| **👤 Operator** | Operador | Hospital específico |

### **🏥 CONTROLE POR HOSPITAL**
- **Acesso Específico:** Usuários por unidade
- **Visão Corporativa:** Diretores veem tudo
- **Auditoria Cruzada:** Controle entre unidades
- **Relatórios Consolidados:** Visão executiva

---

## 🌟 **DIFERENCIAIS COMPETITIVOS**

### **🚀 INOVAÇÃO TECNOLÓGICA**
- **Primeira solução** com IA híbrida no mercado
- **Scoring proprietário** para matching
- **Extração multi-formato** otimizada
- **Dashboard executivo** específico para hospitais

### **🎯 ESPECIALIZAÇÃO SUS**
- **Regras SUS** 100% implementadas
- **Compliance total** com DATASUS
- **Auditoria específica** para SUS
- **Relacionamento** com órgãos reguladores

### **🏆 RESULTADOS COMPROVADOS**
- **Múltiplos hospitais** utilizando o sistema
- **Alta satisfação** dos usuários
- **Economia significativa** gerada
- **Alta precisão** nos cálculos

---

## 📈 **ROADMAP EXECUTIVO**

### **🚀 PRÓXIMOS 3 MESES**
- **📱 Mobile App** para auditores
- **🔔 Notificações** em tempo real
- **📊 Analytics** avançados com ML
- **🔗 APIs** para integrações

### **🎯 PRÓXIMOS 6 MESES**
- **🤖 IA Preditiva** para otimização
- **📈 Forecasting** financeiro
- **🔄 Workflow** automatizado
- **🌐 Multi-idioma** (inglês/espanhol)

### **🏆 PRÓXIMOS 12 MESES**
- **☁️ Cloud Multi-região**
- **🔐 Certificação ISO 27001**
- **📊 Business Intelligence** avançado
- **🌍 Expansão Internacional**

---

## 💼 **RETORNO SOBRE INVESTIMENTO**

### **📊 ANÁLISE DE BENEFÍCIOS**
- **Investimento**: Custo-benefício atrativo
- **Economia**: Redução de custos operacionais
- **Payback**: Retorno em curto prazo
- **ROI**: Retorno positivo comprovado

### **💰 ECONOMIA OPERACIONAL**
- **Redução de Pessoal**: Otimização de equipe
- **Redução de Erros**: Menos retrabalho
- **Aumento de Receita**: Faturamento otimizado
- **Eficiência**: Processos automatizados

### **🎯 BENEFÍCIOS INTANGÍVEIS**
- **Melhoria na Qualidade** do serviço
- **Redução de Estresse** da equipe
- **Compliance Garantido** com auditorias
- **Imagem Corporativa** fortalecida

---



## 🔧 **ESPECIFICAÇÕES TÉCNICAS**

### **📋 REQUISITOS MÍNIMOS**
- **Navegador:** Chrome/Firefox/Safari (versões recentes)
- **Internet:** Conexão estável
- **Resolução:** 1366x768 (recomendado: 1920x1080)
- **Dispositivos:** Desktop, tablet, mobile

### **🔒 SEGURANÇA**
- **Criptografia:** AES-256 para dados sensíveis
- **Autenticação:** Multi-fator opcional
- **Backup:** Automático regular
- **Logs:** Auditoria completa

### **📊 CAPACIDADE**
- **Usuários Simultâneos:** Suporte a múltiplos usuários
- **Processamento:** Alto volume de AIHs
- **Armazenamento:** Escalável
- **Uptime:** Alta disponibilidade

---

## 📝 **LICENÇA E CONFORMIDADE**

- **Licença:** Proprietária - Uso Corporativo
- **LGPD:** Totalmente conforme
- **Auditoria:** Completa rastreabilidade
- **Certificações:** Padrões de segurança
- **Suporte:** Técnico especializado

---

**© 2025 SIGTAP Sync. Todos os direitos reservados.**  
*Sistema de Gestão e Sincronização de Faturamento Hospitalar SUS*

**Versão do Documento:** 4.0  
**Última Atualização:** Janeiro 2025  
**Status:** Produção Ativa
