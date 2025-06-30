# 🚨 SOLUÇÃO RATE LIMIT GEMINI API (Erro 429)

## ❗ PROBLEMA IDENTIFICADO
O sistema está fazendo muitas requisições para a **Google Gemini API** e sendo bloqueado por **Rate Limiting** (429 = Too Many Requests).

### Origem do Problema:
- `FastExtractor` usa Gemini como backup quando extração tradicional falha
- PDFs grandes (4998+ páginas) geram muitas chamadas sequenciais
- API Gemini tem limite de ~15 requests/minuto (conta gratuita)

## 🔧 SOLUÇÕES RÁPIDAS

### **OPÇÃO 1: DESABILITAR GEMINI TEMPORARIAMENTE (RECOMENDADO)**

1. **Criar arquivo `.env.local`** na raiz do projeto:
```env
# Desabilitar Gemini temporariamente
VITE_GEMINI_API_KEY=
VITE_ENABLE_AI_FALLBACK=false
```

2. **Ou editar o arquivo `.env` existente:**
```env
# Comentar ou remover a chave
# VITE_GEMINI_API_KEY=sua_chave_aqui
VITE_ENABLE_AI_FALLBACK=false
```

3. **Reiniciar o sistema:**
```bash
npm run dev
```

### **OPÇÃO 2: CONFIGURAR RATE LIMITING ADEQUADO**

Editar `src/utils/fastExtractor.ts` para reduzir uso do Gemini:

```typescript
constructor(geminiApiKey?: string) {
  this.config = {
    useGemini: Boolean(geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here'),
    confidenceThreshold: 80, // ⬆️ Aumentar threshold
    maxGeminiPages: 2        // ⬇️ Reduzir máximo para 2 páginas
  };
}
```

### **OPÇÃO 3: IMPLEMENTAR COOLDOWN ENTRE REQUESTS**

Adicionar delay no `geminiExtractor.ts`:

```typescript
private async executeWithRetry(model: any, prompt: string, attempt = 1): Promise<any> {
  try {
    // ⏱️ COOLDOWN: 3 segundos entre requests
    if (attempt === 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    if (error.status === 429) {
      // ⏱️ Rate limit: aguardar 60 segundos
      console.log('🚨 Rate limit detectado - aguardando 60s...');
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
    
    if (attempt < this.config.retryAttempts) {
      const backoff = attempt === 1 ? 5000 : 10000 * attempt;
      await new Promise(resolve => setTimeout(resolve, backoff));
      return this.executeWithRetry(model, prompt, attempt + 1);
    }
    throw error;
  }
}
```

## ✅ **VERIFICAÇÃO PÓS-IMPLEMENTAÇÃO**

1. **Console deve mostrar:**
```
🚀 FastExtractor: Modo tradicional
```

2. **Não deve mais aparecer:**
```
🤖 Gemini backup - Página X
```

3. **Erros 429 devem parar de aparecer**

## 📊 **IMPACTO NA PERFORMANCE**

- **Extração tradicional:** 90-95% de precisão
- **Velocidade:** Mantém ~50-80ms por página
- **Sem dependência de internet:** Sistema totalmente offline
- **Sem custos de API:** Economia de tokens Gemini

## 🔄 **REATIVAR GEMINI FUTURAMENTE**

1. **Configurar conta paga do Google AI:**
   - Maior limite de requests (300+ por minuto)
   - Melhor estabilidade

2. **Implementar queue system:**
   - Processar páginas em batch
   - Controle de concorrência

3. **Usar apenas para casos críticos:**
   - PDFs com formatação não-padrão
   - Validação de qualidade

## 🚀 **EXECUTAR AGORA**

Escolha uma das opções acima e reinicie o sistema com:
```bash
npm run dev
```

O sistema continuará funcionando normalmente, apenas sem o backup do Gemini. 