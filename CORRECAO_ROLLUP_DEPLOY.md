# 🔧 CORREÇÃO PROBLEMA ROLLUP NO DEPLOY

## 🎯 **STATUS**: ✅ CORREÇÃO APLICADA

### 📋 **PROBLEMA IDENTIFICADO**
```
Error: Cannot find module @rollup/rollup-linux-x64-gnu
```

Este erro ocorre quando o Rollup não consegue encontrar o módulo nativo específico para a plataforma Linux x64 no ambiente de build do Vercel.

### 🔧 **CORREÇÕES APLICADAS**

#### 1. **package.json - Dependências Atualizadas**
```json
{
  "devDependencies": {
    "@rollup/rollup-linux-x64-gnu": "^4.24.4",
    "rollup": "^4.24.4",
    "vite": "^5.4.10",
    "only-allow": "^1.2.1"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  },
  "overrides": {
    "rollup": "^4.24.4"
  }
}
```

#### 2. **vite.config.ts - Configurações Otimizadas**
```typescript
// Configurações específicas para resolver problemas do Rollup
optimizeDeps: {
  include: ['pdfjs-dist'],
  exclude: ['@rollup/rollup-linux-x64-gnu']
},
rollupOptions: {
  treeshake: {
    moduleSideEffects: false
  }
}
```

#### 3. **vercel.json - Variáveis de Ambiente**
```json
{
  "build": {
    "env": {
      "NODE_OPTIONS": "--max-old-space-size=4096",
      "NPM_CONFIG_PLATFORM": "linux",
      "NPM_CONFIG_ARCH": "x64",
      "NPM_CONFIG_TARGET_PLATFORM": "linux",
      "NPM_CONFIG_TARGET_ARCH": "x64"
    }
  },
  "buildCommand": "npm ci && npm run build",
  "installCommand": "npm ci --prefer-offline --no-audit"
}
```

#### 4. **.npmrc - Configurações NPM**
```
platform=linux
arch=x64
target-platform=linux
target-arch=x64
prefer-offline=true
no-audit=true
```

### 🚀 **COMO RESOLVER LOCALMENTE**

#### **OPÇÃO 1: Script Automático**
```bash
# Dar permissão de execução
chmod +x build-fix.sh

# Executar script
./build-fix.sh
```

#### **OPÇÃO 2: Comandos Manuais**
```bash
# 1. Limpar completamente
rm -rf node_modules package-lock.json dist .npm

# 2. Limpar cache npm
npm cache clean --force

# 3. Configurar variáveis
export NODE_OPTIONS="--max-old-space-size=4096"
export NPM_CONFIG_PLATFORM="linux"
export NPM_CONFIG_ARCH="x64"

# 4. Reinstalar dependências
npm install --prefer-offline --no-audit

# 5. Verificar módulo
ls node_modules/@rollup/rollup-linux-x64-gnu

# 6. Se não existir, instalar manualmente
npm install @rollup/rollup-linux-x64-gnu --save-dev

# 7. Executar build
npm run build
```

### 🔄 **PARA DEPLOY NO VERCEL**

#### **PASSO 1: Verificar Configurações**
1. Confirme que as alterações estão commitadas
2. Verifique se o `.npmrc` está no repositório
3. Confirme as variáveis de ambiente no `vercel.json`

#### **PASSO 2: Forçar Novo Deploy**
```bash
# Commit as alterações
git add .
git commit -m "fix: resolve Rollup linux-x64-gnu dependency issue"
git push origin main

# Ou via Vercel CLI
vercel --prod
```

#### **PASSO 3: Verificar Build**
- Acesse o dashboard do Vercel
- Verifique os logs de build
- Confirme se o módulo é encontrado

### 🛠️ **ALTERNATIVAS SE AINDA FALHAR**

#### **OPÇÃO A: Vite Sem Rollup Nativo**
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['@rollup/rollup-linux-x64-gnu']
    }
  }
})
```

#### **OPÇÃO B: Usar esbuild**
```json
{
  "devDependencies": {
    "vite": "^5.4.10",
    "esbuild": "^0.20.0"
  }
}
```

#### **OPÇÃO C: Configurar Dockerfile**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --platform=linux --arch=x64
COPY . .
RUN npm run build
```

### 📊 **VERIFICAÇÃO DE FUNCIONAMENTO**

#### **1. Verificar Módulo Instalado**
```bash
ls -la node_modules/@rollup/rollup-linux-x64-gnu
```

#### **2. Testar Build Local**
```bash
npm run build
```

#### **3. Verificar Logs Vercel**
- Procure por "rollup-linux-x64-gnu" nos logs
- Confirme se está sendo instalado corretamente

### ⚠️ **CAUSAS COMUNS DO ERRO**

1. **npm vs yarn**: Conflitos entre gerenciadores
2. **Cache corrompido**: Cache npm/vercel antigo
3. **Arquitetura**: Problemas com ARM vs x64
4. **Versões**: Incompatibilidade entre Vite/Rollup
5. **Dependências opcionais**: Bug conhecido do npm

### 💡 **DICAS ADICIONAIS**

#### **Performance**
- Use `npm ci` no lugar de `npm install`
- Configure cache adequadamente
- Use `--prefer-offline` para builds mais rápidos

#### **Debugging**
```bash
# Verificar arquitetura
node -e "console.log(process.arch, process.platform)"

# Listar dependências do Rollup
npm ls rollup

# Verificar cache npm
npm cache ls
```

### 🎉 **RESULTADO ESPERADO**

- ✅ Build bem-sucedido no Vercel
- ✅ Módulo @rollup/rollup-linux-x64-gnu encontrado
- ✅ Deploy funcionando normalmente
- ✅ Sem erros de dependências nativas

### 🔄 **PRÓXIMOS PASSOS**

1. **Commitar alterações**: `git add . && git commit -m "fix: rollup build issues"`
2. **Fazer push**: `git push origin main`
3. **Verificar deploy**: Acompanhar logs do Vercel
4. **Testar aplicação**: Confirmar funcionamento

---

**Sistema**: SIGTAP Billing Wizard v3.0  
**Problema**: Rollup linux-x64-gnu dependency  
**Status**: ✅ Correção Aplicada  
**Data**: Janeiro 2025 