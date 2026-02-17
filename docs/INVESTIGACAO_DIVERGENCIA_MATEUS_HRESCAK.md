# Investigação de Divergência de Dados - Mateus Hrescak (Hospital Torao Tokuda)

## Problema Relatado
- **Médico**: Mateus Hrescak
- **Hospital**: Hospital Torao Tokuda
- **Período**: Mês 11 (Novembro)
- **Sintoma**: O relatório "Conferência Tabwin" apresenta **60 pacientes**, enquanto o banco de dados local possui **74 registros**.
- **Diferença**: 14 pacientes faltantes no relatório.

## Análise da Causa Raiz

### 1. Fonte de Dados do Relatório
O serviço `SihTabwinReportService` (`src/services/sihTabwinReportService.ts`) foi analisado. A lógica de busca (`fetchReport`) segue o seguinte fluxo:
1.  **Busca Primária**: Consulta a tabela `sih_rd` (Dados do Tabwin Remoto).
    ```typescript
    // Linha 179
    let q = supabaseSih.from('sih_rd').select(selectCols)
    ```
2.  **Iteração**: O sistema itera sobre os registros retornados pelo `sih_rd`.
3.  **Enriquecimento Local**: Para cada registro do Tabwin, o sistema busca os dados correspondentes no banco local (`aihs`) para obter nomes de pacientes e médicos.

### 2. O Motivo da Discrepância
O relatório é construído **baseado no que existe no Tabwin (`sih_rd`)**.
- Se uma AIH existe no Banco Local mas **não existe no Tabwin**, ela **não aparece no relatório**.
- O fluxo atual é: `Tabwin -> Local`. Não existe uma etapa de `Local -> Tabwin` para identificar registros órfãos (que existem apenas localmente).

### 3. Conclusão
Os 14 pacientes "faltantes" estão presentes no banco de dados local, mas **não constam na base de dados do Tabwin (`sih_rd`)** importada para o sistema. Como o relatório de "Conferência Tabwin" lista os itens do Tabwin para conferência, esses registros locais são ignorados.

## Soluções Corretivas Propostas

### Solução 1: Implementar "Cruzamento Bidirecional" (Recomendada)
Alterar o serviço `SihTabwinReportService` para realizar uma busca dupla:
1.  Buscar registros no Tabwin (como já é feito).
2.  Buscar registros no Banco Local (`aihs`) com os mesmos filtros (Hospital, Data, Médico).
3.  **Mesclar as listas**: Adicionar ao relatório as AIHs que existem apenas no Local.
4.  **Sinalizar Status**: Criar uma nova coluna ou status "Somente Local" ou "Não Enviado ao Tabwin".

Isso transformará o relatório de uma simples "Lista Tabwin" para uma verdadeira "Ferramenta de Reconciliação", permitindo identificar pacientes que deveriam ter sido processados mas não foram.

### Solução 2: Relatório Separado de "Pendências de Exportação"
Criar um relatório específico ou uma aba separada que liste apenas "AIHs no Local não encontradas no Tabwin". Isso mantém o relatório atual focado no que *já foi processado*, mas oferece uma visão clara do que falta.

## Ações Imediatas (Layout)
As alterações de layout solicitadas para o modal foram implementadas para facilitar a visualização e uso dos filtros, preparando a interface para futuras evoluções de funcionalidade.