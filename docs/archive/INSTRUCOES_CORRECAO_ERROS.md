# 🔧 Instruções para Correção dos Erros da Aba Analytics - Profissionais

## 📋 Problemas Identificados e Corrigidos

### 1. ✅ **Hospital GUA não mapeado** (CORRIGIDO NO CÓDIGO)
- **Problema**: Hospital ID `1218dd7b-efcb-442e-ad2b-b72d04128cb9` (GUA - Centro de Medicina Avançada) não estava mapeado em `DoctorPaymentRules.tsx`
- **Solução**: Adicionado mapeamento para hospitais GUA e SM no arquivo `src/components/DoctorPaymentRules.tsx`
- **Status**: ✅ Corrigido automaticamente

### 2. ⚠️ **Views do banco de dados não existem** (REQUER AÇÃO MANUAL)
- **Problema**: Views `v_doctors_aggregated` e `v_specialty_revenue_stats` retornando erro 500
- **Causa**: Views não foram criadas no banco de dados Supabase
- **Solução**: Execute o script de migração SQL (veja instruções abaixo)
- **Status**: ⚠️ Requer execução manual no Supabase

### 3. ✅ **Tratamento de erros melhorado** (CORRIGIDO NO CÓDIGO)
- **Problema**: Sistema não lidava bem com a ausência das views
- **Solução**: Adicionado tratamento de erros gracioso nos serviços e componentes
- **Status**: ✅ Corrigido automaticamente

---

## 🚀 Como Executar a Correção

### Passo 1: Acessar o Supabase SQL Editor

1. Acesse o painel do Supabase: https://supabase.com/dashboard
2. Selecione seu projeto **SigtapSync**
3. No menu lateral, clique em **SQL Editor**

### Passo 2: Executar o Script de Migração

1. Abra o arquivo `database/fix_missing_views_migration.sql` (criado automaticamente)
2. Copie **TODO** o conteúdo do arquivo
3. No SQL Editor do Supabase:
   - Cole o script completo
   - Clique no botão **"Run"** (▶️) no canto inferior direito
4. Aguarde a execução (pode levar alguns segundos)

### Passo 3: Verificar se as Views foram Criadas

Execute o seguinte script para verificar:

```sql
-- Verificar se as views foram criadas com sucesso
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('v_doctors_aggregated', 'v_specialty_revenue_stats')
ORDER BY table_name;
```

**Resultado esperado**: Deve retornar 2 linhas com `table_type = 'VIEW'`

### Passo 4: Testar as Views

Execute os seguintes scripts para testar:

```sql
-- Testar v_doctors_aggregated
SELECT COUNT(*) as total_doctors
FROM v_doctors_aggregated;

-- Testar v_specialty_revenue_stats  
SELECT COUNT(*) as total_specialties
FROM v_specialty_revenue_stats;
```

### Passo 5: Recarregar a Aplicação

1. Volte para a aplicação SigtapSync
2. Pressione **Ctrl + Shift + R** (ou **Cmd + Shift + R** no Mac) para forçar recarregar a página
3. Acesse **Analytics → Profissionais**
4. Verifique se os erros desapareceram

---

## 🔍 O que o Script de Migração Faz?

O script `fix_missing_views_migration.sql` realiza as seguintes ações:

1. **Remove views antigas** (se existirem)
2. **Cria a view `v_doctors_aggregated`**:
   - Agrega dados de médicos com faturamento dos últimos 12 meses
   - Exclui anestesistas (CBO 225151) dos procedimentos 04.xxx
   - Mantém procedimentos 03.xxx e cesariana para anestesistas
   - Calcula taxas de pagamento e aprovação
   - Define status de atividade dos médicos

3. **Cria a view `v_specialty_revenue_stats`**:
   - Agrega estatísticas de faturamento por especialidade médica
   - Conta médicos ativos e inativos
   - Calcula faturamento total e médio por especialidade

4. **Adiciona permissões**:
   - Garante que usuários autenticados podem acessar as views

5. **Cria índices para performance**:
   - Otimiza queries nas tabelas base (`procedure_records`, `doctors`, `doctor_hospital`)

---

## 🛡️ Melhorias Implementadas no Código

### 1. `DoctorPaymentRules.tsx`
- ✅ Adicionado mapeamento para Hospital GUA (`1218dd7b-efcb-442e-ad2b-b72d04128cb9`)
- ✅ Adicionado mapeamento para Hospital SM (`68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b`)
- ✅ Criados stubs vazios para esses hospitais (usam regras padrão)

### 2. `doctorsRevenueService.ts`
- ✅ `getDoctorsAggregated()` agora retorna array vazio em vez de lançar erro
- ✅ `getSpecialtyStats()` agora retorna array vazio em vez de lançar erro
- ✅ `getHospitalStats()` agora retorna array vazio em vez de lançar erro
- ✅ Logs informativos com instruções de correção

### 3. `ExecutiveDashboard.tsx`
- ✅ Detecta quando todas as views retornam vazias (erro 500)
- ✅ Exibe banner de aviso amarelo com instruções
- ✅ Continua funcionando com dados de fallback
- ✅ Estado `showViewsWarning` para controlar visibilidade do aviso

---

## 📊 Comportamento Esperado Após Correção

### Antes da Correção:
- ❌ Erro 500 nas requisições para `v_doctors_aggregated`
- ❌ Erro 500 nas requisições para `v_specialty_revenue_stats`
- ⚠️ Console cheio de mensagens de erro
- ⚠️ Banner amarelo de aviso exibido na tela

### Depois da Correção:
- ✅ Dados de médicos carregados corretamente
- ✅ Estatísticas por especialidade funcionando
- ✅ KPIs do cabeçalho precisos
- ✅ Tabela de profissionais populada
- ✅ Sem erros no console
- ✅ Banner de aviso oculto

---

## 🧪 Como Testar

1. **Antes da migração**:
   - Abra o console do navegador (F12)
   - Acesse Analytics → Profissionais
   - Observe os erros 500 e alertas de hospital não reconhecido

2. **Depois da migração**:
   - Recarregue a página (Ctrl + Shift + R)
   - Acesse Analytics → Profissionais
   - Verifique:
     - ✅ Nenhum erro 500 no console
     - ✅ KPIs exibindo valores corretos
     - ✅ Tabela de médicos populada
     - ✅ Filtros funcionando
     - ✅ Nenhum alerta de "Hospital ID não reconhecido"

---

## 🆘 Troubleshooting

### Problema: Erro ao executar o script SQL

**Possível causa**: Permissões insuficientes
**Solução**: 
1. Certifique-se de estar logado como admin no Supabase
2. Verifique se está no projeto correto
3. Tente executar o script em partes menores

### Problema: Views criadas mas ainda retornando erro 500

**Possível causa**: Dados ausentes nas tabelas base
**Solução**:
1. Verifique se as tabelas `doctors`, `procedure_records`, `doctor_hospital` têm dados:
```sql
SELECT 'doctors' as table_name, COUNT(*) as total FROM doctors
UNION ALL
SELECT 'procedure_records', COUNT(*) FROM procedure_records
UNION ALL
SELECT 'doctor_hospital', COUNT(*) FROM doctor_hospital;
```

### Problema: Banner de aviso ainda aparece

**Possível causa**: Cache do navegador
**Solução**:
1. Limpe o cache do navegador (Ctrl + Shift + Delete)
2. Faça logout e login novamente
3. Verifique se as views estão retornando dados (Passo 4 acima)

---

## 📞 Suporte

Se após seguir todos os passos os erros persistirem:

1. Verifique os logs do console do navegador (F12)
2. Verifique os logs do Supabase (seção "Logs" no painel)
3. Documente os erros exatos e entre em contato com o suporte

---

## 📅 Manutenção Futura

### Para adicionar novos hospitais:

1. Adicione o hospital em `src/config/hospitalMapping.ts`:
```typescript
NOVO_HOSPITAL: {
  id: 'uuid-do-hospital',
  name: 'Nome do Hospital',
  code: 'COD',
  displayName: 'COD - Nome Completo',
  users: ['email@hospital.com']
}
```

2. Adicione o mapeamento em `src/components/DoctorPaymentRules.tsx`:
```typescript
if (hospitalId === 'uuid-do-hospital') {
  return 'HOSPITAL_CODIGO_INTERNO';
}
```

3. (Opcional) Adicione regras de pagamento específicas no mesmo arquivo.

---

**Última atualização**: 2024-11-24
**Versão do sistema**: SigtapSync v4.0

