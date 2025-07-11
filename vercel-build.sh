#!/bin/bash

# Script de build otimizado para Vercel - Resolve problemas do Rollup
echo "🚀 === INICIANDO BUILD OTIMIZADO PARA VERCEL ==="

# Configurar variáveis de ambiente
export NODE_OPTIONS="--max-old-space-size=4096"
export NPM_CONFIG_PLATFORM="linux"
export NPM_CONFIG_ARCH="x64"
export NPM_CONFIG_OPTIONAL="true"
export NPM_CONFIG_FORCE="true"
export NPM_CONFIG_LEGACY_PEER_DEPS="true"

# Limpeza completa
echo "🧹 Limpando cache e dependências..."
rm -rf node_modules
rm -rf .npm
rm -rf package-lock.json
rm -rf dist

# Configurar npm para o ambiente Linux
echo "⚙️ Configurando npm para Linux..."
npm config set platform linux
npm config set arch x64
npm config set target-platform linux
npm config set target-arch x64
npm config set optional true
npm config set include-optional true
npm config set legacy-peer-deps true

# Instalar dependências com flags específicos
echo "📦 Instalando dependências com configuração otimizada..."
npm install --force --include=optional --legacy-peer-deps

# Verificar se o Rollup foi instalado corretamente
echo "🔍 Verificando instalação do Rollup..."
if [ ! -d "node_modules/@rollup/rollup-linux-x64-gnu" ]; then
    echo "⚠️ Módulo nativo do Rollup não encontrado, instalando manualmente..."
    npm install @rollup/rollup-linux-x64-gnu@latest --save-optional --force
fi

# Copiar worker do PDF.js
echo "📄 Copiando worker do PDF.js..."
npm run copy-pdf-worker

# Build da aplicação
echo "🏗️ Executando build da aplicação..."
npm run build

echo "✅ === BUILD CONCLUÍDO COM SUCESSO ===" 