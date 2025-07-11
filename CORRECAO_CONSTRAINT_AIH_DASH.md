# 🔧 CORREÇÃO: CONSTRAINT PARA AIHs COM NÚMERO "-"

## 🎯 **STATUS**: ⚠️ **CORREÇÃO PENDENTE - EXECUTAR SCRIPT SQL**

### 📋 **PROBLEMA IDENTIFICADO**
```
Error 409 (Conflict): UNIQUE constraint violation
UNIQUE constraint "aihs_hospital_id_aih_number_key" violated
```

**Causa Raiz:**
- A tabela `aihs` possui constraint `UNIQUE(hospital_id, aih_number)`
- Múltiplas AIHs com número "-" violam essa constraint
- Sistema não consegue inserir segunda AIH com "-" para o mesmo hospital

### 🔧 **SOLUÇÃO IMPLEMENTADA**

#### **Arquivo Criado:** `database/fix_aih_dash_constraint.sql`

**O que o script faz:**
1. ✅ **Remove** a constraint `UNIQUE(hospital_id, aih_number)` existente
2. ✅ **Cria** constraint parcial que só se aplica a números reais
3. ✅ **Permite** múltiplas AIHs com "-" no mesmo hospital
4. ✅ **Mantém** unicidade para números AIH oficiais

### 📊 **COMPARAÇÃO: ANTES vs DEPOIS**

#### **❌ ANTES (Problemático)**
```sql
-- Constraint absoluta
UNIQUE(hospital_id, aih_number)

-- Resultado:
✅ AIH "123456-7" → Permitida
✅ AIH "789012-3" → Permitida  
❌ AIH "-" → Primeira permitida
❌ AIH "-" → Segunda BLOQUEADA (erro 409)
```

#### **✅ DEPOIS (Corrigido)**
```sql
-- Constraint parcial inteligente
CREATE UNIQUE INDEX idx_aihs_unique_number_hospital 
ON aihs (hospital_id, aih_number) 
WHERE aih_number != '-';

-- Resultado:
✅ AIH "123456-7" → Permitida (única)
✅ AIH "789012-3" → Permitida (única)
✅ AIH "-" → Primeira permitida
✅ AIH "-" → Segunda permitida
✅ AIH "-" → Terceira permitida
✅ AIH "-" → Quantas precisar...
```

### 🎯 **DETALHES TÉCNICOS**

#### **1. Constraint Parcial**
- **Sintaxe**: `WHERE aih_number != '-'`
- **Função**: Só aplica unicidade quando NOT é "-"
- **Resultado**: AIHs com "-" ficam livres da constraint

#### **2. Índice Otimizado**
```sql
CREATE INDEX idx_aihs_dash_number 
ON aihs (hospital_id, patient_id, admission_date) 
WHERE aih_number = '-';
```
- **Função**: Busca rápida de AIHs sem número
- **Uso**: Para verificação de duplicatas inteligente

### 🚨 **AÇÃO NECESSÁRIA**

#### **Para Resolver Completamente:**

1. **Execute o script SQL no Supabase:**
   ```sql
   -- Copie e execute o conteúdo completo de:
   database/fix_aih_dash_constraint.sql
   ```

2. **Verificação Pós-Execução:**
   - ✅ Múltiplas AIHs com "-" devem ser aceitas
   - ✅ Números AIH reais mantêm unicidade
   - ✅ Sistema funciona normalmente

### 📋 **TESTE DE VALIDAÇÃO**

#### **Antes da Correção:**
```javascript
// Console do navegador mostrará:
❌ Error 409: UNIQUE constraint violation
❌ Erro ao criar AIH: Erro desconhecido
```

#### **Depois da Correção:**
```javascript
// Console do navegador mostrará:
✅ AIH sem número detectada - verificação inteligente opcional
✅ Permitindo inserção de nova AIH com "-" (sem bloqueio)
✅ AIH criada com schema expandido!
```

### 🎛️ **IMPACTO DO SISTEMA**

#### **✅ Mantido (Funcionalidades Preservadas)**
- 🔒 Unicidade de números AIH oficiais
- 🔍 Busca por número AIH
- 📊 Relatórios e estatísticas
- 🔐 Segurança e integridade

#### **🆕 Novo (Funcionalidades Adicionadas)**
- ✅ Múltiplas AIHs sem número
- 🔍 Verificação inteligente de duplicatas
- 📋 Controle por paciente + data + procedimento
- 🚀 Workflow sem bloqueios

### 📈 **CENÁRIOS DE USO**

#### **1. Hospital com Múltiplos Documentos Sem Número**
```
Hospital A:
- AIH "-": Paciente Maria, Procedimento Cirurgia
- AIH "-": Paciente João, Procedimento Consulta  
- AIH "-": Paciente Ana, Procedimento Exame
✅ TODAS ACEITAS
```

#### **2. Mesmo Paciente, Internações Diferentes**
```
Hospital A:
- AIH "-": Maria Silva, 15/01/2024, Cirurgia
- AIH "-": Maria Silva, 20/02/2024, Consulta
✅ TODAS ACEITAS (datas diferentes)
```

#### **3. Documentos com Problemas de Qualidade**
```
- PDF ilegível → numeroAIH = "-"
- PDF corrompido → numeroAIH = "-" 
- Documento interno → numeroAIH = "-"
✅ TODOS ACEITOS sem bloquear workflow
```

### 🔄 **BACKWARD COMPATIBILITY**

#### **✅ Totalmente Compatível**
- Código existente continua funcionando
- AIHs com números reais mantêm comportamento
- Nenhuma alteração necessária no frontend
- Dados existentes preservados

### 📋 **CHECKLIST DE EXECUÇÃO**

```
□ 1. Fazer backup do banco (opcional, mas recomendado)
□ 2. Executar script: database/fix_aih_dash_constraint.sql
□ 3. Verificar execução sem erros
□ 4. Testar inserção de AIH com "-"
□ 5. Confirmar que números reais ainda são únicos
□ 6. Documentar execução (data/hora/responsável)
```

### 🎉 **RESULTADO ESPERADO**

**Após executar o script:**
- 🚀 Sistema aceita quantas AIHs "-" precisar
- 🔒 Números oficiais mantêm proteção de unicidade  
- 🎯 Workflow funciona sem bloqueios
- 📊 Controle inteligente de duplicatas ativo

## ⚡ **EXECUTE O SCRIPT AGORA PARA RESOLVER O PROBLEMA!** 