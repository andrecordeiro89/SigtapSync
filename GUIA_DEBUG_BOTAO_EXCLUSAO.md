# 🔍 Guia de Debug - Botão de Exclusão AIH

## 📍 Localização
O botão deveria aparecer na **seção "AIHs Processadas"**, posicionado **abaixo do badge verde (valor R$)** em cada AIH listada.

## 🚀 Passo a Passo para Debug

### 1. Acessar a Tela
1. Faça login no sistema
2. Navegue para **Pacientes** (seção onde estão as AIHs processadas)
3. Certifique-se que há AIHs listadas na tela

### 2. Debug Automático via Console
1. Pressione **F12** para abrir DevTools
2. Vá para a aba **Console**
3. Cole o conteúdo do arquivo `debug_button_visibility.js`
4. Pressione **Enter**

O script irá automaticamente:
- ✅ Verificar autenticação
- ✅ Procurar elementos na página
- ✅ Testar condições de permissão
- ✅ Criar um botão de teste

### 3. Verificar Logs de Debug
No console, procure por mensagens com **"🔍 DEBUG BOTÃO EXCLUSÃO"**.

Se aparecerem, você verá informações como:
```javascript
🔍 DEBUG BOTÃO EXCLUSÃO: {
  userId: "uuid-do-usuario",
  userRole: "operator",  // ← SEU ROLE ATUAL
  hasPermission: true,   // ← SE DEVERIA VER O BOTÃO
  aihId: "uuid-da-aih",
  aihNumber: "4125112458918-8"
}
```

## 🔎 Possíveis Problemas e Soluções

### ❌ Problema 1: Role Insuficiente
**Sintoma:** `hasPermission: false` no log
**Causa:** Seu usuário não tem role `operator`, `coordinator`, `director` ou `admin`
**Solução:** 
```sql
-- Execute no Supabase SQL Editor:
UPDATE user_profiles 
SET role = 'operator' 
WHERE email = 'seu_email@aqui.com';
```

### ❌ Problema 2: Usuário Não Logado
**Sintoma:** `userId: null` ou logs não aparecem
**Causa:** Problema de autenticação
**Solução:**
1. Fazer logout
2. Limpar cache: `localStorage.clear()`
3. Fazer login novamente

### ❌ Problema 3: Dados Vazios
**Sintoma:** Console mostra "AIHs encontradas na página: 0"
**Causa:** Não há AIHs para mostrar
**Solução:**
1. Verificar filtros aplicados
2. Carregar dados de teste
3. Verificar permissões do hospital

### ❌ Problema 4: Erro JavaScript
**Sintoma:** Erros em vermelho no console
**Causa:** Erro bloqueando renderização
**Solução:**
1. Recarregar página (F5)
2. Verificar se há erros de importação
3. Verificar se components estão carregados

## 🎯 Localização Exata do Botão

O botão está implementado no arquivo: `src/components/PatientManagement.tsx`

**Linha:** 698-717 (aproximadamente)

**Estrutura visual esperada:**
```
┌─ AIH: 4125112458918-8 ─────────────────────────┐
│ 👤 PACIENTE NOME           👤 Operador          │
│                            📅 07/07/2025       │
│                            💰 R$ 423,51        │
│                            🗑️ Excluir    ← AQUI│
└─────────────────────────────────────────────────┘
```

## ⚡ Debug Rápido (1 linha)

Cole no console para verificação rápida:
```javascript
console.log('User:', JSON.parse(localStorage.getItem('sb-njzqpjkkjdnmdumwlecz-auth-token') || '{}')?.user); document.querySelectorAll('button').forEach(b => b.textContent?.includes('Excluir') && console.log('Botão encontrado:', b));
```

## 🛠️ Se o Botão Não Aparecer

### Teste Manual de Criação:
1. Execute o script `debug_button_visibility.js`
2. O script criará um **botão de teste** automaticamente
3. Se esse botão aparecer → problema é com permissões
4. Se não aparecer → problema é com estrutura DOM/dados

### Forçar Visibilidade (Temporário):
```javascript
// Cole no console para forçar o botão aparecer:
document.querySelectorAll('[class*="border rounded-lg p-4"]').forEach(aih => {
  const badgeArea = aih.querySelector('[class*="flex flex-col items-end space-y-2"]');
  if (badgeArea && !aih.querySelector('.force-button')) {
    const btn = document.createElement('button');
    btn.innerHTML = '🗑️ Excluir (FORÇADO)';
    btn.className = 'force-button flex items-center space-x-1 text-red-600 border-red-200 bg-red-50 text-xs px-2 py-1 border rounded';
    btn.onclick = () => alert('Botão funcionando!');
    badgeArea.appendChild(btn);
  }
});
```

## 📞 Relatório de Problema

Se o problema persistir, forneça:

1. **Role do usuário:** (resultado do debug)
2. **Número de AIHs na tela:** (resultado do debug)
3. **Logs de debug:** (copie os logs do console)
4. **Botão de teste apareceu?** (sim/não)
5. **Erros no console:** (se houver)

## ✅ Status Atual

- ✅ Botão implementado na posição correta
- ✅ Permissões configuradas para `operator`
- ✅ Debug logs adicionados
- ✅ Script de teste criado
- 🔍 **Aguardando verificação do usuário** 