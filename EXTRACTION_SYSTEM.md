# Sistema de Extração SIGTAP - Sequencial/Posicional

## Visão Geral

O SIGTAP Billing Wizard v3.0 implementa um sistema híbrido de extração de dados que combina métodos **sequenciais** e **posicionais** para extrair informações de procedimentos SIGTAP de diferentes formatos de arquivo.

## Arquitetura do Sistema

### 1. Processadores por Tipo de Arquivo

| Formato | Processador | Performance | Precisão | Custo |
|---------|-------------|-------------|----------|-------|
| **Excel** (.xlsx/.xls) | `ExcelProcessor` | ⚡ Ultra (5-30s) | 🎯 100% | 💰 Gratuito |
| **ZIP** | `ZipProcessor` | 🚀 Rápido (1-3min) | 🎯 95% | 💰 Gratuito |
| **PDF** | `HybridExtractor` | 🐌 Lento (5-15min) | 🎯 90-95% | 💰 ~$0.01-0.05 |

### 2. Sistema de Extração Híbrida (PDF)

```
┌─────────────────────────────────────────────────────────────┐
│                    HYBRID EXTRACTOR                        │
├─────────────────────────────────────────────────────────────┤
│  1. FastExtractor (Sequencial/Posicional)                  │
│     ├── Extração Tradicional (RegEx + Posição)             │
│     ├── Fallback para Gemini AI (páginas complexas)        │
│     └── Merge de Resultados                                │
│                                                             │
│  2. GeminiExtractor (IA Backup)                            │
│     ├── Google Gemini 1.5 Flash                           │
│     ├── Máximo 5 páginas por PDF                          │
│     └── Custo otimizado                                    │
└─────────────────────────────────────────────────────────────┘
```

## Lógica de Extração: Sequencial vs Posicional

### Campos SEQUENCIAIS
> Extraídos na ordem que aparecem no texto

- **Procedimento** - Nome/descrição do procedimento
- **Complexidade** - Nível de complexidade (Atenção Básica, Baixa, Média, Alta)
- **Tipo de Financiamento** - Código e descrição do financiamento
- **Valores** - Ambulatorial S.A., Total, Hospitalar S.P., S.H., Total
- **Sexo** - Masculino (M), Feminino (F), Ambos (A)
- **Idade Mínima/Máxima** - Com unidades (Anos, Meses, Dias)
- **Quantidade Máxima** - Limite de procedimentos
- **Média Permanência** - Tempo médio de internação
- **Pontos** - Pontuação do procedimento

### Campos POSICIONAIS
> Extraídos baseado na posição específica no layout

- **Origem** - Origem do procedimento
- **Modalidade** - Modalidade de atendimento
- **Instrumento de Registro** - Tipo de registro
- **CBO** - Classificação Brasileira de Ocupações
- **CID** - Classificação Internacional de Doenças

## Implementação Técnica

### FastExtractor - Método Principal

```typescript
// Construção de mapas
const positionMap = this.buildPositionMap(textItems);
const sequentialText = this.buildSequentialText(textItems);

// Extração sequencial
const complexity = this.extractSequentialField(blockText, 'Complexidade');
const financing = this.extractSequentialField(blockText, 'Tipo de Financiamento');
const values = this.extractSequentialValue(blockText, 'Valor Ambulatorial S.A.');

// Extração posicional
const origin = this.extractPositionalField(blockText, positionMap, 'Origem');
const modality = this.extractPositionalField(blockText, positionMap, 'Modalidade');
const cbo = this.extractPositionalField(blockText, positionMap, 'CBO');
```

### Padrões de Extração

#### Sequencial - Regex Patterns
```typescript
// Campo simples
new RegExp(`${fieldName}:\\s*([^\\n\\r]*?)(?=\\s*[A-Z][a-z]+:|$)`, 'i')

// Valores monetários
new RegExp(`${fieldName}:\\s*R\\$\\s*([\\d,]+\\.?\\d*)`, 'i')

// Idades com unidades
new RegExp(`${fieldName}:\\s*(\\d+)\\s*(\\w+)`, 'i')
```

#### Posicional - Coordenadas
```typescript
// Mapa de posições X,Y
const positionMap = new Map();
textItems.forEach((item, index) => {
  const x = Math.round(item.transform[4]);
  const y = Math.round(item.transform[5]);
  positionMap.set(`${index}`, { x, y, text: item.str });
});
```

## Normalização de Dados

### Complexidade
```typescript
'ATENÇÃO BÁSICA' | 'BAIXA COMPLEXIDADE' | 'MÉDIA COMPLEXIDADE' | 'ALTA COMPLEXIDADE'
```

### Sexo
```typescript
'M' (Masculino) | 'F' (Feminino) | 'A' (Ambos)
```

### Unidades de Idade
```typescript
'Ano(s)' | 'Mês(es)' | 'Dia(s)'
```

## Performance e Otimizações

### Batch Processing
- **PDFs pequenos** (<1000 páginas): 10 páginas por batch
- **PDFs grandes** (>1000 páginas): 20 páginas por batch
- **Delay entre batches**: 100ms para evitar bloqueio da UI

### Logging Inteligente
- **Páginas 1-3**: Log completo
- **Páginas 4+**: Log a cada 100 páginas
- **Última página**: Log final com estatísticas

### Gemini AI - Uso Otimizado
- **Limite**: Máximo 5 páginas por PDF
- **Trigger**: Apenas quando extração tradicional falha
- **Modelo**: Gemini 1.5 Flash (mais rápido e barato)
- **Tentativas**: 1 tentativa por página (sem retry)

## Estatísticas de Extração

### Complexidade por Categoria
```
🔴 ATENÇÃO BÁSICA: X procedimentos
🟡 BAIXA COMPLEXIDADE: X procedimentos  
🟠 MÉDIA COMPLEXIDADE: X procedimentos
🔴 ALTA COMPLEXIDADE: X procedimentos
⚪ OUTRAS: X procedimentos
❌ FALHAS: X procedimentos
```

### Métricas de Performance
```
⚡ Extração Tradicional: X páginas
🤖 Gemini Backup: X páginas (máx 5)
📊 Taxa de Sucesso: XX%
⏱️ Tempo Total: X minutos
💰 Custo Estimado: $X.XX
```

## Validação e Qualidade

### Códigos SIGTAP
- **Formato**: `XX.XX.XX.XXX-X` (regex validation)
- **Duplicatas**: Removidas automaticamente
- **Integridade**: Validação de campos obrigatórios

### Fallbacks Inteligentes
1. **Extração Tradicional** → Regex + Posição
2. **Gemini AI** → IA para páginas complexas
3. **Valores Padrão** → Campos não encontrados

## Configuração e Uso

### Variáveis de Ambiente
```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

### Interface de Usuário
- **Upload**: Drag & drop ou seleção de arquivo
- **Progress**: Barra de progresso em tempo real
- **Logs**: Informações detalhadas do processamento
- **Estatísticas**: Métricas finais de extração

## Casos de Uso Recomendados

### ✅ Excel (Recomendado)
- **Quando**: Dados estruturados disponíveis
- **Vantagens**: Ultra rápido, 100% precisão, gratuito
- **Tempo**: 5-30 segundos para 4886+ procedimentos

### ✅ ZIP
- **Quando**: Múltiplos arquivos ou compactação necessária
- **Vantagens**: Rápido, boa precisão, gratuito
- **Tempo**: 1-3 minutos

### ⚠️ PDF
- **Quando**: Apenas PDF disponível
- **Limitações**: Lento, pode ter custos de IA
- **Tempo**: 5-15 minutos para PDFs grandes
- **Custo**: ~$0.01-0.05 para PDF de 5000 páginas

## Troubleshooting

### Problemas Comuns

#### PDF não processa
- Verificar se o arquivo não está corrompido
- Validar formato do PDF (deve conter texto, não apenas imagens)
- Verificar tamanho do arquivo (<100MB)

#### Extração incompleta
- Verificar logs para identificar páginas problemáticas
- Considerar ativar Gemini AI para melhor precisão
- Validar estrutura do documento SIGTAP

#### Performance lenta
- Preferir Excel quando possível
- Para PDFs: usar versão ZIP compactada
- Verificar conexão de internet (para Gemini AI)

### Logs de Debug
```
🚀 FastExtractor: Gemini ativado/desativado
⚡ Página X/Y: Z procedimentos (Total total)
🤖 Gemini backup - Página X
📊 Estatísticas finais...
```

## Roadmap

### Próximas Melhorias
- [ ] Cache inteligente para PDFs processados
- [ ] Processamento paralelo de páginas
- [ ] Suporte a OCR para PDFs escaneados
- [ ] API de validação cruzada com DATASUS
- [ ] Exportação de relatórios de qualidade

---

**Desenvolvido para SIGTAP Billing Wizard v3.0**  
Sistema híbrido de extração sequencial/posicional com IA integrada. 