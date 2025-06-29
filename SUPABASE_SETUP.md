# 🚀 **GUIA DE CONFIGURAÇÃO SUPABASE - SIGTAP SYNC**

## 📋 **ETAPA 1: CRIAÇÃO DO PROJETO SUPABASE**

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Clique em "New Project"
3. Escolha um nome para o projeto (ex: "sigtap-sync")
4. Defina uma senha forte para o banco
5. Escolha a região mais próxima (South America - Brazil)

## 📋 **ETAPA 2: OBTER CREDENCIAIS**

1. No painel do Supabase, vá em **Settings > API**
2. Copie:
   - **Project URL** (VITE_SUPABASE_URL)
   - **anon public** key (VITE_SUPABASE_ANON_KEY)

## 📋 **ETAPA 3: CRIAR ARQUIVO .env**

Crie um arquivo `.env` na raiz do projeto com:

```bash
# ===== SUPABASE (OBRIGATÓRIO) =====
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_aqui

# ===== API KEYS (OPCIONAL) =====
VITE_GEMINI_API_KEY=sua_chave_gemini_aqui

# ===== APLICAÇÃO =====
VITE_APP_NAME="SIGTAP Sync"
VITE_APP_VERSION="3.0.0"
VITE_APP_ENVIRONMENT="development"

# ===== DESENVOLVIMENTO =====
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL=info

# ===== CONFIGURAÇÕES DE PERFORMANCE =====
VITE_PDF_BATCH_SIZE=10
VITE_EXCEL_BATCH_SIZE=1000
VITE_MAX_FILE_SIZE_MB=100

# ===== MATCHING E SCORING =====
VITE_MIN_MATCH_SCORE=70
VITE_AUTO_APPROVE_SCORE=90
VITE_MANUAL_REVIEW_SCORE=60
VITE_ENABLE_BATCH_PROCESSING=true

# ===== RECURSOS OPCIONAIS =====
VITE_ENABLE_AI_FALLBACK=true
VITE_ENABLE_AUDIT_LOGS=true
VITE_ENABLE_ANALYTICS=false
```

## 📋 **ETAPA 4: EXECUTAR SCHEMA DO BANCO**

No **SQL Editor** do Supabase, execute o arquivo `database/schema.sql` completo.

## ✅ **VERIFICAÇÃO**

Após configurar tudo, execute:
```bash
npm run dev
```

Se aparecer no console:
- ✅ "Supabase habilitado - carregando dados..."
- ✅ Dados de login funcionando

Então está tudo configurado corretamente!

## 🆘 **TROUBLESHOOTING**

### Erro "Invalid API key"
- Verifique se copiou a chave `anon public` (não a `service_role`)
- Confirme se a URL está correta

### Erro "relation does not exist"
- Execute o schema completo no SQL Editor
- Verifique se todas as tabelas foram criadas

### Erro de conexão
- Confirme se o projeto Supabase está ativo
- Verifique se não há firewall bloqueando

## 🔧 **VERIFICAÇÃO AUTOMÁTICA** (Opcional, mas recomendado)

**IMPORTANTE**: Se você encontrou erros de sintaxe como `"syntax error at or near NOT"`, use o script simplificado:

### Opção 1: Setup Simplificado (RECOMENDADO)
No **SQL Editor** do Supabase, execute:

```sql
-- Cole o conteúdo completo de: database/setup_simples_SEM_RLS.sql
```

### Opção 2: Setup Completo (PostgreSQL 12+)
Se sua versão suporta, execute:

```sql
-- Cole o conteúdo completo de: database/setup_verificacao_completa_CORRIGIDO.sql
```

**O que os scripts fazem**:
- ✅ Verificam se todas as tabelas existem
- ✅ Criam hospital demo para desenvolvimento
- ✅ Inserem configurações básicas do sistema
- ✅ Fornecem relatório de saúde do sistema
- ✅ Configuram sistema para funcionamento básico

**Para verificar se funcionou**:
```sql
SELECT * FROM check_system_health();
```

## 🔥 **RESET COMPLETO** (Se houver problemas)

**Se você encontrar erros de constraints ou dados inconsistentes**, use o reset completo:

```sql
-- Cole TODO o conteúdo de: database/reset_completo_CLEAN_START.sql
```

**Este script:**
- 🧹 Apaga TODOS os dados
- ⚖️ Remove constraints problemáticas  
- 🏥 Cria 2 hospitais demo funcionais
- ⚙️ Insere configurações básicas
- ✅ Sistema 100% limpo e operacional

📋 **Guia detalhado**: `RESET_SUPABASE_GUIDE.md`

## 📞 **PRÓXIMOS PASSOS**

Depois de configurar o Supabase:
1. **Executar script de verificação** (acima) OU **reset completo** (se houver problemas)
2. Testar autenticação (`npm run dev`)
3. Importar dados SIGTAP
4. Testar upload de AIH
5. Verificar persistência de pacientes 