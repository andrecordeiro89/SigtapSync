# Plan: Relatório Aprovados/Competência - Tabelas por Hospital

## Objetivo
Modificar o relatório "Aprovados/Competência" para gerar uma tabela separada para cada hospital, mostrando os detalhes mensais daquele hospital.

## Estrutura Atual
- **PDF**: Uma única tabela de resumo com colunas: Mês, Hospital, Qtd AIHs, Valor Total
- **Excel**: Uma planilha "Resumo por Mês" com todos os hospitais misturados

## Nova Estrutura Proposta

### PDF
1. Página de título com metadados (já existe)
2. Para **cada hospital** distinto nos dados:
   - Subtítulo com nome do hospital
   - Tabela com colunas: Mês, Qtd AIHs, Valor Total
   - Linha de totalização do hospital (soma de todos os meses)
3. Manter planilha de metadados (opcional, pode ser mantida como está)

### Excel
1. Planilha "Resumo por Mês" atual (pode ser mantida ou removida - decisão a tomar)
2. **Nova planilha separada para cada hospital**:
   - Nome da planilha: Nome do hospital (truncado para 31 caracteres, máximo Excel)
   - Tabela com colunas: Mês, Qtd AIHs, Valor Total
   - Linha de totalização
3. Planilha "Metadados" (manter como está)

## Passos de Implementação

### 1. Modificar `savePdfReportDirect`
- Receber `summaryData` (já agrupado por hospital e mês)
- Agrupar `summaryData` por hospital
- Para cada hospital:
  - Adicionar seção com título do hospital
  - Criar tabela apenas com os meses daquele hospital
  - Adicionar linha de total (soma de AIHs e valores)
- Ajustar `startY` para cada seção
- Garantir que as tabelas não ultrapassem o limite da página (usar múltiplas páginas se necessário)

### 2. Modificar `saveExcelReportDirect`
- Manter planilha "Resumo por Mês" atual (opcional: pode ser removida se o usuário quiser apenas planilhas separadas)
- Para cada hospital único em `summaryData`:
  - Criar nova planilha com nome do hospital
  - Adicionar tabela com meses, quantidade e valor
  - Adicionar linha de totalização
- Manter planilha "Metadados" como está

### 3. Ajustar ordenação
- Atualmente: ordenado por nome do hospital, depois mês
- Manter essa ordenação para garantir que as tabelas apareçam em ordem alfabética de hospital

### 4. Testar com dados reais
- Verificar se nomes de hospitais muito longos são truncados corretamente
- Verificar se a formatação numérica (moeda) está correta
- Testar com múltiplos hospitais e múltiplos meses

## Considerações Técnicas

### jsPDF
- Usar `doc.text()` para títulos de hospital
- Usar `autoTable()` para cada tabela de hospital
- Ajustar `startY` após cada seção
- Considerar usar `doc.splitTextToSize` se nomes de hospitais forem muito longos
- Verificar se `doc.lastAutoTable.finalY` está disponível para posicionar próxima seção

### Excel (xlsx)
- Nome de planilha máximo 31 caracteres
- Se nome do hospital > 31 chars, truncar e adicionar "..."
- Usar `XLSX.utils.book_append_sheet` para cada hospital
- sheetName deve ser único - se houver homônimos, adicionar sufixo numérico

### Dados
- `summaryData` já contém: `hospitalId`, `hospitalName`, `month`, `aihCount`, `totalValue`
- Agrupar por `hospitalId` (ou `hospitalName`) usando Map ou reduce

## Decisões Pendentes

1. **Manter planilha "Resumo por Mês" no Excel?**
   - Opção A: Manter (mostra visão consolidada de todos os hospitais)
   - Opção B: Remover (apenas planilhas individuais)
   - Sugestão: Manter por enquanto, pode ser removido depois se solicitado

2. **Ordem dos hospitais:**
   - Ordenar alfabeticamente por nome do hospital (já está assim)

3. **Formato da tabela PDF:**
   - Colunas: Mês | Qtd AIHs | Valor Total (3 colunas)
   - Cabeçalho: ['Mês', 'Qtd AIHs', 'Valor Total']
   - Manter formatação existente (cores, fontes)

## Estimativa
- Complexidade: Baixa-Média
- Tempo estimado: 1-2 horas

## Riscos
- Nomes de hospitais muito longos podem causar problemas no Excel (limite de 31 chars)
- Muitos hospitais podem gerar PDF com muitas páginas
- Performance: se houver muitos hospitais, pode demorar para gerar todas as planilhas

## Critérios de Aceitação
- PDF: Cada hospital tem sua própria seção com tabela de meses
- Excel: Cada hospital tem sua própria planilha
- Totais por hospital são exibidos corretamente
- Formatação mantém padrão visual existente
- Nenhum erro de compilação ou runtime
