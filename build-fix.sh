#!/bin/bash

# Script para resolver problemas de build com Rollup
# Funciona tanto no Windows quanto no Linux
# Uso: ./build-fix.sh

echo "🔧 Iniciando correção de build do Rollup..."

# Detectar sistema operacional
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]] || [[ "$OS" == "Windows_NT" ]]; then
    echo "🪟 Sistema detectado: Windows"
    IS_WINDOWS=true
else
    echo "🐧 Sistema detectado: Linux/Unix"
    IS_WINDOWS=false
fi

# Passo 1: Limpar completamente
echo "🧹 Limpando arquivos anteriores..."
if [ "$IS_WINDOWS" = true ]; then
    rm -rf node_modules 2>/dev/null || true
    rm -rf package-lock.json 2>/dev/null || true
    rm -rf dist 2>/dev/null || true
    rm -rf .npm 2>/dev/null || true
else
    rm -rf node_modules package-lock.json dist .npm
fi

# Passo 2: Limpar cache do npm
echo "🗑️ Limpando cache do npm..."
npm cache clean --force

# Passo 3: Configurar variáveis de ambiente (apenas para Linux)
if [ "$IS_WINDOWS" = false ]; then
    echo "⚙️ Configurando variáveis de ambiente para Linux..."
    export NODE_OPTIONS="--max-old-space-size=4096"
    export NPM_CONFIG_PLATFORM="linux"
    export NPM_CONFIG_ARCH="x64"
    export NPM_CONFIG_TARGET_PLATFORM="linux"
    export NPM_CONFIG_TARGET_ARCH="x64"
    export NPM_CONFIG_CACHE=".npm"
    export NPM_CONFIG_OPTIONAL="true"
    export SKIP_INSTALL_SIMPLE_GIT_HOOKS="1"
    
    # Usar .npmrc específico do Vercel
    if [ -f ".npmrc.vercel" ]; then
        echo "📋 Usando configurações do Vercel..."
        cp .npmrc.vercel .npmrc
    fi
else
    echo "⚙️ Usando configurações locais do Windows..."
fi

# Passo 4: Reinstalar dependências
echo "📦 Reinstalando dependências..."
if [ "$IS_WINDOWS" = true ]; then
    npm install --prefer-offline --include=optional
else
    npm ci --prefer-offline --include=optional
fi

# Passo 5: Verificar se o módulo problemático existe (apenas no Linux)
if [ "$IS_WINDOWS" = false ]; then
    echo "🔍 Verificando dependências do Rollup..."
    if [ -d "node_modules/@rollup/rollup-linux-x64-gnu" ]; then
        echo "✅ Módulo @rollup/rollup-linux-x64-gnu encontrado"
    else
        echo "❌ Módulo @rollup/rollup-linux-x64-gnu não encontrado"
        echo "🔄 Tentando instalação manual..."
        npm install @rollup/rollup-linux-x64-gnu --save-optional
    fi
else
    echo "ℹ️ No Windows, o módulo linux-x64-gnu é opcional e pode não estar presente"
fi

# Passo 6: Executar build
echo "🏗️ Executando build..."
npm run build

# Passo 7: Verificar resultado
if [ $? -eq 0 ]; then
    echo "✅ Build concluído com sucesso!"
    echo "📁 Arquivos gerados em: dist/"
    if [ -d "dist" ]; then
        ls -la dist/ 2>/dev/null || dir dist\ 2>/dev/null || echo "Pasta dist criada"
    fi
else
    echo "❌ Build falhou!"
    echo "💡 Informações de debug:"
    echo "   - Sistema: $OSTYPE"
    echo "   - Node: $(node --version)"
    echo "   - NPM: $(npm --version)"
    if [ "$IS_WINDOWS" = false ]; then
        echo "   - Rollup module: $(ls node_modules/@rollup/ 2>/dev/null | grep linux || echo 'não encontrado')"
    fi
    exit 1
fi

echo "🎉 Processo concluído!" 