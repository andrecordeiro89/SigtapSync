#!/bin/bash

# Script para resolver problemas de build com Rollup
# Uso: ./build-fix.sh

echo "🔧 Iniciando correção de build do Rollup..."

# Passo 1: Limpar completamente
echo "🧹 Limpando arquivos anteriores..."
rm -rf node_modules
rm -rf package-lock.json
rm -rf dist
rm -rf .npm

# Passo 2: Limpar cache do npm
echo "🗑️ Limpando cache do npm..."
npm cache clean --force

# Passo 3: Configurar variáveis de ambiente
echo "⚙️ Configurando variáveis de ambiente..."
export NODE_OPTIONS="--max-old-space-size=4096"
export NPM_CONFIG_PLATFORM="linux"
export NPM_CONFIG_ARCH="x64"
export NPM_CONFIG_TARGET_PLATFORM="linux"
export NPM_CONFIG_TARGET_ARCH="x64"
export NPM_CONFIG_CACHE=".npm"
export SKIP_INSTALL_SIMPLE_GIT_HOOKS="1"

# Passo 4: Reinstalar dependências
echo "📦 Reinstalando dependências..."
npm install --prefer-offline --no-audit

# Passo 5: Verificar se o módulo problemático existe
echo "🔍 Verificando dependências do Rollup..."
if [ -d "node_modules/@rollup/rollup-linux-x64-gnu" ]; then
    echo "✅ Módulo @rollup/rollup-linux-x64-gnu encontrado"
else
    echo "❌ Módulo @rollup/rollup-linux-x64-gnu não encontrado"
    echo "🔄 Tentando instalação manual..."
    npm install @rollup/rollup-linux-x64-gnu --save-dev
fi

# Passo 6: Executar build
echo "🏗️ Executando build..."
npm run build

# Passo 7: Verificar resultado
if [ $? -eq 0 ]; then
    echo "✅ Build concluído com sucesso!"
    echo "📁 Arquivos gerados em: dist/"
    ls -la dist/
else
    echo "❌ Build falhou!"
    echo "💡 Tente executar novamente ou verifique os logs acima"
    exit 1
fi

echo "🎉 Processo concluído!" 