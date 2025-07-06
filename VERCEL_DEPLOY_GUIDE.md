# 🚀 GUIA COMPLETO DE DEPLOY NO VERCEL

## 📋 **PRÉ-REQUISITOS**

### 1. **Variáveis de Ambiente Necessárias**
Configure as seguintes variáveis no dashboard do Vercel:

```bash
# Supabase (OBRIGATÓRIO)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Gemini API (OBRIGATÓRIO)
VITE_GEMINI_API_KEY=your_gemini_api_key

# Configurações da Aplicação
VITE_APP_NAME=SIGTAP Billing Wizard
VITE_APP_VERSION=3.0.0
VITE_APP_ENVIRONMENT=production
VITE_PDF_WORKER_SRC=/pdf.worker.min.mjs
VITE_MAX_REQUESTS_PER_MINUTE=60
VITE_DEBUG_MODE=false
```

### 2. **Configuração do Supabase**
Certifique-se de que:
- ✅ RLS (Row Level Security) está configurado
- ✅ Políticas de acesso estão definidas
- ✅ Tabelas estão criadas com os schemas corretos
- ✅ URL e chave anônima estão corretas

## 🔧 **ETAPAS DE DEPLOY**

### **Método 1: Deploy Direto via GitHub**

1. **Conecte o repositório ao Vercel:**
   ```bash
   # No dashboard do Vercel
   1. Clique em "New Project"
   2. Selecione seu repositório GitHub
   3. Configure as variáveis de ambiente
   4. Clique em "Deploy"
   ```

2. **Configurações automáticas:**
   - ✅ Build Command: `npm run build`
   - ✅ Output Directory: `dist`
   - ✅ Install Command: `npm install`
   - ✅ Node.js Version: 18.x

### **Método 2: Deploy via CLI**

1. **Instale o Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Faça login:**
   ```bash
   vercel login
   ```

3. **Deploy inicial:**
   ```bash
   vercel --prod
   ```

4. **Configuração automática:**
   - Selecione escopo/equipe
   - Confirme configurações do projeto
   - Aguarde o build e deploy

## 🛠️ **CONFIGURAÇÕES ESPECÍFICAS**

### **1. Configuração de Build**
```json
{
  "build": {
    "env": {
      "NODE_OPTIONS": "--max-old-space-size=4096"
    }
  }
}
```

### **2. Configuração de Roteamento**
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### **3. Headers de Segurança**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        }
      ]
    }
  ]
}
```

## 🔍 **SOLUÇÃO DE PROBLEMAS**

### **Erro: "copy: command not found"**
✅ **RESOLVIDO** - Script atualizado para usar `copyfiles`

### **Erro: "Module not found pdfjs-dist"**
```bash
# Verificar se o arquivo foi copiado
ls -la public/pdf.worker.min.mjs

# Se não existir, executar manualmente
npm run copy-pdf-worker
```

### **Erro: "Environment variables not defined"**
```bash
# Verificar variáveis no dashboard do Vercel
vercel env ls

# Adicionar variável
vercel env add VITE_SUPABASE_URL
```

### **Erro: "Build timeout"**
```bash
# Aumentar limite de memória
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

## 📊 **MONITORAMENTO PÓS-DEPLOY**

### **1. Verificações Essenciais**
- ✅ Aplicação carrega corretamente
- ✅ Autenticação Supabase funciona
- ✅ Upload de PDFs funciona
- ✅ Processamento de AIH funciona
- ✅ Dashboards carregam dados

### **2. Logs e Debugging**
```bash
# Ver logs de build
vercel logs <deployment-url>

# Ver logs de função
vercel logs <deployment-url> --follow
```

### **3. Performance**
- ✅ Lighthouse Score > 90
- ✅ First Contentful Paint < 2s
- ✅ Time to Interactive < 3s

## 🌐 **CONFIGURAÇÃO DE DOMÍNIO**

### **1. Domínio Personalizado**
```bash
# Adicionar domínio
vercel domains add your-domain.com

# Configurar DNS
# A Record: 76.76.19.61
# CNAME: cname.vercel-dns.com
```

### **2. Certificado SSL**
- ✅ Automático via Let's Encrypt
- ✅ Renovação automática

## 🚀 **DEPLOY CONTÍNUO**

### **1. Configuração Automática**
```bash
# Toda mudança na branch main = deploy automático
git push origin main
```

### **2. Preview Deploys**
```bash
# Branches de feature = preview deploy
git push origin feature/nova-funcionalidade
```

## 📝 **CHECKLIST FINAL**

### **Antes do Deploy:**
- [ ] Todas as variáveis de ambiente configuradas
- [ ] Testes locais passando
- [ ] Build local funciona
- [ ] Supabase configurado
- [ ] Certificados SSL válidos

### **Após o Deploy:**
- [ ] Aplicação carrega sem erros
- [ ] Autenticação funciona
- [ ] Upload de arquivos funciona
- [ ] Dashboards carregam
- [ ] Performance satisfatória
- [ ] Logs sem erros críticos

## 🆘 **SUPORTE**

### **Contatos de Emergência:**
- **Vercel Support**: support@vercel.com
- **Supabase Support**: support@supabase.com
- **Documentação**: [docs.vercel.com](https://docs.vercel.com)

### **Comandos Úteis:**
```bash
# Verificar status
vercel ls

# Ver logs
vercel logs

# Rollback
vercel rollback

# Remover deploy
vercel remove
```

---

## 🎯 **RESULTADO ESPERADO**

✅ **Aplicação 100% funcional em produção**
✅ **Performance otimizada**
✅ **Segurança configurada**
✅ **Monitoramento ativo**
✅ **Deploy contínuo funcionando**

**URL de Produção**: `https://your-app.vercel.app`
**Status**: 🟢 **ONLINE** 