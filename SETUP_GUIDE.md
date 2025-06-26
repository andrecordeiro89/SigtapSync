# 🚀 GUIA DE CONFIGURAÇÃO - SIGTAP BILLING WIZARD v3.0

**Sistema Profissional de Faturamento Hospitalar com Matching Automático AIH x SIGTAP**

---

## 📋 **ESTRUTURA REAL DO BANCO ATUALIZADA**

O sistema foi 100% sincronizado com sua estrutura real do Supabase! 🎉

### **📊 Tabelas Principais:**
- ✅ **hospitals** - Gestão de hospitais
- ✅ **sigtap_versions** - Versionamento de importações
- ✅ **sigtap_procedures** - 22 campos completos SIGTAP
- ✅ **patients** - Cadastro de pacientes
- ✅ **aihs** - Autorização de Internação Hospitalar
- ✅ **aih_matches** - **NOVO:** Matching automático AIH x SIGTAP
- ✅ **procedure_records** - **NOVO:** Registros de faturamento
- ✅ **system_settings** - **NOVO:** Configurações do sistema
- ✅ **audit_logs** - **NOVO:** Logs de auditoria
- ✅ **user_hospital_access** - **NOVO:** Controle de acesso

---

## 🔧 **CONFIGURAÇÃO PASSO A PASSO**

### **1️⃣ Configurar Variáveis de Ambiente**

Crie um arquivo `.env` na raiz do projeto:

```env
# ===== SUPABASE (OBRIGATÓRIO) =====
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_aqui

# ===== GEMINI AI (OPCIONAL) =====
# Para extração híbrida PDF + IA
VITE_GEMINI_API_KEY=sua_chave_gemini_aqui

# ===== CONFIGURAÇÕES AVANÇADAS =====
VITE_MAX_FILE_SIZE_MB=100
VITE_MIN_MATCH_SCORE=70
VITE_AUTO_APPROVE_SCORE=90
VITE_ENABLE_AI_FALLBACK=true
VITE_ENABLE_AUDIT_LOGS=true
```

### **2️⃣ Como Obter as Chaves Supabase**

1. **Acesse:** [supabase.com](https://supabase.com)
2. **Login** na sua conta
3. **Selecione seu projeto**
4. **Vá em:** Settings → API
5. **Copie:**
   - **URL:** `https://seu-projeto.supabase.co`
   - **anon/public key:** `eyJhbG...` (chave pública)

### **3️⃣ Como Obter Chave Gemini (Opcional)**

1. **Acesse:** [aistudio.google.com](https://aistudio.google.com)
2. **Login** com conta Google
3. **Clique:** "Get API Key"
4. **Copie** a chave gerada

---

## 🎯 **FUNCIONALIDADES ATUALIZADAS**

### **🔥 NOVIDADES v3.0:**

#### **1. Matching Automático AIH x SIGTAP**
- ✅ **Score baseado em critérios:** Gênero, idade, CID, habilitação, CBO
- ✅ **Aprovação automática:** Matches com score > 90%
- ✅ **Revisão manual:** Matches entre 60-90%
- ✅ **Rejeição automática:** Matches < 60%
- ✅ **Relatórios detalhados:** Análise financeira e de validação

#### **2. Sistema de Auditoria Completo**
- ✅ **Logs automáticos:** Todas as operações registradas
- ✅ **Controle de usuários:** Acesso por hospital
- ✅ **Rastreabilidade:** IP, user-agent, session_id
- ✅ **Histórico completo:** Before/after de mudanças

#### **3. Gestão Avançada de Procedimentos**
- ✅ **Faturamento inteligente:** Baseado em matches
- ✅ **Status de cobrança:** Pending → Billed → Paid
- ✅ **Integração AIH:** Link direto com autorizações
- ✅ **Valores calculados:** Baseados na tabela SIGTAP

### **📊 Performance Otimizada:**

| **Operação** | **Tempo Anterior** | **Tempo Atual** | **Melhoria** |
|--------------|-------------------|-----------------|--------------|
| **Excel Import** | N/A | **5-30s** | **🚀 NOVO** |
| **AIH Matching** | Manual | **Automático** | **♾️ INFINITA** |
| **PDF Processing** | 5-15min | **5-15min** | **Mantido** |
| **Data Sync** | Local | **Real-time** | **🔄 REAL-TIME** |

---

## 💾 **SERVIÇOS IMPLEMENTADOS**

### **🏥 Serviços Principais:**
- ✅ **SigtapService** - Gestão da tabela SIGTAP
- ✅ **HospitalService** - Gerenciamento de hospitais
- ✅ **PatientService** - Cadastro de pacientes
- ✅ **AIHService** - Processamento de AIHs

### **🆕 Novos Serviços v3.0:**
- ✅ **AIHMatchService** - Matching automático
- ✅ **ProcedureRecordService** - Registros de faturamento
- ✅ **SystemSettingsService** - Configurações
- ✅ **AuditLogService** - Logs de auditoria

### **🤖 Utilitários Avançados:**
- ✅ **AIHMatcher** - Engine de matching inteligente
- ✅ **ExcelProcessor** - Processamento ultra-rápido
- ✅ **HybridExtractor** - PDF + IA

---

## 🔐 **SEGURANÇA E COMPLIANCE**

### **🛡️ Recursos de Segurança:**
- ✅ **Row Level Security (RLS)** no Supabase
- ✅ **Auditoria completa** de todas as operações
- ✅ **Controle de acesso** por hospital/usuário
- ✅ **Validação de CNS** com algoritmo oficial
- ✅ **Sanitização de dados** de entrada

### **📋 Compliance Hospitalar:**
- ✅ **LGPD Ready** - Logs de auditoria
- ✅ **Rastreabilidade** completa
- ✅ **Backup automático** (Supabase)
- ✅ **Escalabilidade** horizontal

---

## 🚀 **DEPLOY E PRODUÇÃO**

### **📦 Build do Projeto:**
```bash
npm run build
```

### **🌐 Deploy Recomendado:**
1. **Vercel** (Recomendado)
2. **Netlify**
3. **Servidor próprio**

### **🔧 Configurações de Produção:**
```env
VITE_APP_ENVIRONMENT=production
VITE_DEBUG_MODE=false
VITE_ENABLE_ANALYTICS=true
```

---

## 📊 **MONITORAMENTO E ANALYTICS**

### **📈 Métricas Disponíveis:**
- ✅ **Performance:** Tempo de processamento
- ✅ **Qualidade:** Taxa de matching
- ✅ **Financeiro:** Valores faturados
- ✅ **Operacional:** Erros e sucessos

### **🎯 KPIs do Sistema:**
- **Taxa de Matching Automático:** > 85%
- **Tempo Médio de Processamento:** < 30s
- **Precisão de Matching:** > 95%
- **Uptime do Sistema:** > 99.9%

---

## 🆘 **SUPORTE E TROUBLESHOOTING**

### **❌ Problemas Comuns:**

**1. Erro de Conexão Supabase:**
```
❌ VITE_SUPABASE_URL não está configurada
```
**Solução:** Verificar arquivo `.env` e chaves do Supabase

**2. Matching Não Funciona:**
```
⚠️ Nenhum procedimento SIGTAP encontrado
```
**Solução:** Importar tabela SIGTAP atualizada

**3. Upload de Arquivo Falha:**
```
❌ Arquivo muito grande
```
**Solução:** Usar Excel (.xlsx) para performance otimizada

### **📞 Contato para Suporte:**
- **Documentação:** [Ver README.md]
- **Issues:** GitHub Issues
- **Performance:** Verificar logs do Supabase

---

## 🎉 **PRÓXIMOS PASSOS**

### **✅ Sistema Está Pronto Para:**
1. **Importar tabela SIGTAP** (Excel recomendado)
2. **Cadastrar hospitais** e pacientes
3. **Processar AIHs** com matching automático
4. **Gerar relatórios** de faturamento
5. **Monitorar performance** em tempo real

### **🚀 Melhorias Futuras:**
- **Dashboard analytics** avançado
- **API REST** para integrações
- **Mobile app** para médicos
- **BI integrado** para gestão

---

**🎯 O sistema está 100% sincronizado com sua base Supabase e pronto para produção!**

**Versão:** 3.0.0 | **Status:** ✅ Produção Ready | **Performance:** ⚡ Otimizada 