# Plan: Melhorias no Relatório Aprovados/Competência

## Objetivos
1. Incluir o ano na coluna "Mês" (ex: "Janeiro/2026", "Dezembro/2025")
2. Ordenar os meses do mais recente para o mais antigo
3. Tornar o PDF mais criativo, conciso, detalhado e visualmente atraente

## Análise da Situação Atual

### Estrutura de Dados Atual
```typescript
interface SummaryRow {
  hospitalId: string;
  hospitalName: string;
  month: number; // 1-12 (apenas mês, sem ano)
  aihCount: number;
  totalValue: number;
}
```

**Problema**: A estrutura atual não armazena o ano, apenas o mês (1-12). Para mostrar "Janeiro/2026" e ordenar corretamente (misturando anos), precisamos armazenar tanto o ano quanto o mês.

### Solução
Modificar a construção do `summaryMap` para extrair tanto o ano quanto o mês da data de alta (`dt_saida`):

```typescript
interface SummaryRow {
  hospitalId: string;
  hospitalName: string;
  month: number; // 1-12
  year: number; // 2025, 2026, etc.
  aihCount: number;
  totalValue: number;
}
```

Ou criar uma chave composta: `${hospitalId}::${year}::${month}`

## Passos de Implementação

### 1. Modificar Estrutura de Dados
- Adicionar campo `year` à interface `SummaryRow`
- Atualizar a criação de `summaryMap` para extrair o ano de `dt_saida`
- Ajustar a lógica de agrupamento para incluir o ano na chave

### 2. Atualizar Ordenação
- Ordenar por hospital (alfabético)
- Dentro de cada hospital, ordenar por `(year, month)` em ordem decrescente (mais recente primeiro)
- Isso garantirá que meses apareçam como "Dezembro/2025", "Novembro/2025", "Janeiro/2026" na ordem correta (baseada na data)

### 3. Atualizar Formatação de Mês
- Modificar `getMonthName` para aceitar opcionalmente um ano e retornar `"Janeiro/2026"`
- Ou criar uma nova função `getMonthYearLabel(month, year)`
- Atualizar todas as ocorrências onde o mês é exibido:
  - PDF: `savePdfReportDirect` (linha 331)
  - Excel: `saveExcelReportDirect` (linha 413)

### 4. Melhorar Design do PDF (Visualmente Atraente)

#### Elementos Sugeridos:
- **Cabeçalho com gradiente ou cor de fundo**
- **Linhas divisórias elegantes** entre seções de hospitais
- **Melhor tipografia**: usar fontes diferentes para títulos e dados
- **Cores mais modernas**: 
  - Título principal: azul escuro (#003366) ou verde (#0a5c36)
  - Cabeçalhos de tabela: gradiente ou cor sólida mais vibrante
  - Linhas alternadas: cinza muito claro (#f9f9f9)
  - Texto: cinza escuro (#333) em vez de preto puro
- **Espaçamento melhorado**: mais breathing room
- **Ícones** (se possível com jsPDF): talvez um ícone simples de hospital ou relatório
- **Números formatados**: separador de milhar, alinhamento à direita
- **Bordas arredondadas** (se suportado)
- **Sombras** (se suportado)
- **Página de capa** mais elaborada (opcional)

#### Implementação:
- Ajustar cores no `autoTable` (headStyles, bodyStyles, alternateRowStyles)
- Adicionar retângulos ou linhas decorativas com `doc.setDrawColor()` e `doc.rect()`
- Usar `doc.setFontSize()` variado para hierarquia
- Adicionar logotipo ou título estilizado
- Melhorar metadados: caixa com borda, fundo colorido

### 5. Tornar Mais Concisa
- Remover informações redundantes
- Usar abreviações inteligentes (ex: "Qtd" em vez de "Quantidade")
- Otimizar layout: menos espaço em branco, mas mantendo legibilidade
- Consolidar totais de forma mais clara

### 6. Manter Detalhada
- Garantir que todas as informações importantes estejam presentes
- Manter totais por hospital e geral
- Incluir metadados completos (filtros aplicados, data de geração)

### 7. Atualizar Excel
- Modificar coluna "Mês" para incluir ano: "Janeiro/2026"
- Garantir ordenação correta (mais recente primeiro)
- Manter formatação consistente com PDF

### 8. Testar
- Compilar sem erros TypeScript
- Testar com dados que tenham múltiplos anos
- Verificar ordenação (Dezembro/2025 deve aparecer antes de Janeiro/2026 se for mais recente)
- Verificar formatação de PDF

## Decisões de Design

### Cores Propostas
- Primária: #0a5c36 (verde escuro institucional)
- Secundária: #003366 (azul marinho)
- Destaque: #ffc107 (amarelo para totais)
- Fundo alternado: #f5f7fa (cinza muito claro)
- Texto: #2d3748 (cinza escuro)
- Bordas: #e2e8f0 (cinza claro)

### Layout do PDF
1. **Cabeçalho**: Título centralizado com fundo colorido
2. **Metadados**: Caixa com borda arredondada (simulada) contendo:
   - Hospital
   - Competências
   - Mês(es)
   - Data de geração
3. **Totais gerais**: Box destacado com valor total e quantidade total
4. **Seções por hospital**:
   - Nome do hospital em negrito, com linha decorativa abaixo
   - Tabela com 3 colunas: Mês, Qtd AIHs, Valor Total
   - Linha de total com fundo diferente
   - Espaço entre hospitais

### Ordenação dos Meses
- Ordenar por (year DESC, month DESC)
- Exemplo de ordem correta:
  - Janeiro/2026
  - Dezembro/2025
  - Novembro/2025
  - Outubro/2025

## Estimativa
- Complexidade: Média
- Tempo: 2-3 horas

## Riscos
- jsPDF pode ter limitações de design (sem bordas arredondadas nativas)
- Performance com muitos hospitais pode degradar
- Nomes de hospitais longos podem quebrar layout

## Critérios de Aceitação
- Coluna "Mês" mostra "Nome do Mês/Ano" (ex: "Janeiro/2026")
- Meses ordenados do mais recente para o mais antigo
- PDF com aparência moderna e profissional
- Excel com mesma formatação de mês/ano
- Nenhum erro de compilação ou runtime
- Dados corretos e totais batem
