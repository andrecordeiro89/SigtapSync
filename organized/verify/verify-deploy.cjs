#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 VERIFICAÇÃO PRÉ-DEPLOY - SIGTAP BILLING WIZARD');
console.log('================================================\n');

let hasErrors = false;

// 1. Verificar package.json
console.log('1. Verificando package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  if (packageJson.scripts['build:vercel']) {
    console.log('   ✅ Script build:vercel encontrado');
  } else {
    console.log('   ❌ Script build:vercel não encontrado');
    hasErrors = true;
  }
  
  if (packageJson.scripts['copy-pdf-worker-safe']) {
    console.log('   ✅ Script copy-pdf-worker-safe encontrado');
  } else {
    console.log('   ❌ Script copy-pdf-worker-safe não encontrado');
    hasErrors = true;
  }
} catch (error) {
  console.log('   ❌ Erro ao ler package.json:', error.message);
  hasErrors = true;
}

// 2. Verificar vercel.json
console.log('\n2. Verificando vercel.json...');
try {
  const vercelJson = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  
  if (vercelJson.buildCommand === 'npm run build:vercel') {
    console.log('   ✅ buildCommand configurado corretamente');
  } else {
    console.log('   ❌ buildCommand incorreto:', vercelJson.buildCommand);
    hasErrors = true;
  }
  
  if (vercelJson.outputDirectory === 'dist') {
    console.log('   ✅ outputDirectory configurado corretamente');
  } else {
    console.log('   ❌ outputDirectory incorreto:', vercelJson.outputDirectory);
    hasErrors = true;
  }
} catch (error) {
  console.log('   ❌ Erro ao ler vercel.json:', error.message);
  hasErrors = true;
}

// 3. Verificar dependências críticas
console.log('\n3. Verificando dependências críticas...');
const criticalDeps = ['vite', 'react', 'typescript', '@supabase/supabase-js'];

try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  criticalDeps.forEach(dep => {
    if (packageJson.dependencies[dep] || packageJson.devDependencies[dep]) {
      console.log(`   ✅ ${dep} encontrado`);
    } else {
      console.log(`   ❌ ${dep} não encontrado`);
      hasErrors = true;
    }
  });
} catch (error) {
  console.log('   ❌ Erro ao verificar dependências:', error.message);
  hasErrors = true;
}

// 4. Verificar arquivos de build
console.log('\n4. Verificando estrutura de arquivos...');

const requiredFiles = ['src/main.tsx', 'index.html', 'vite.config.ts'];

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file} encontrado`);
  } else {
    console.log(`   ❌ ${file} não encontrado`);
    hasErrors = true;
  }
});

// 5. Verificar pasta public
console.log('\n5. Verificando pasta public...');
if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
  console.log('   ✅ Pasta public criada');
} else {
  console.log('   ✅ Pasta public existe');
}

// Resultado final
console.log('\n================================================');
if (hasErrors) {
  console.log('❌ VERIFICAÇÃO FALHOU - Corrija os erros acima');
  process.exit(1);
} else {
  console.log('✅ VERIFICAÇÃO PASSOU - Pronto para deploy!');
  console.log('\nPróximos passos:');
  console.log('1. git add .');
  console.log('2. git commit -m "fix: configuração segura para deploy Vercel"');
  console.log('3. git push origin main');
  process.exit(0);
} 