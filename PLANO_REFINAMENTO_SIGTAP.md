# 🏥 PLANO DE REFINAMENTO SIGTAP - 6 CATEGORIAS

## 📊 **AS 6 CATEGORIAS PRINCIPAIS**

### **1. 🏷️ IDENTIFICAÇÃO**
**Campos Atuais:**
- ✅ `code` - Código do procedimento
- ✅ `description` - Nome/descrição
- ❌ `origem` - Precisa ser refinado

**Problemas:**
- Origem sempre "Dados Oficiais DATASUS" (genérico)
- Falta grupo/subgrupo do procedimento

**Refinamentos Necessários:**
- Extrair grupo e subgrupo do código
- Classificar origem real (ambulatorial/hospitalar)
- Adicionar competência/versão da tabela

---

### **2. 🔖 CLASSIFICAÇÃO**  
**Campos Atuais:**
- ✅ `complexity` - Complexidade (funciona)
- ❌ `modality` - Sempre "Não informado"
- ❌ `registrationInstrument` - Sempre "Tabela Oficial"
- ❌ `financing` - Parcialmente funciona
- ❌ `serviceClassification` - Sempre "Não informado"
- ❌ `especialidadeLeito` - Sempre "Não informado"

**Problemas:**
- Modalidade não está sendo buscada da tabela auxiliar
- Classificações não estão sendo mapeadas

**Refinamentos Necessários:**
- Buscar modalidade real da `sigtap_modalidade`
- Mapear especialidades e leitos
- Classificar por grupo/subgrupo corretamente

---

### **3. 💰 VALORES AMBULATORIAIS**
**Campos Atuais:**
- ✅ `valueAmb` - Valor SA (Serviço Ambulatorial)  
- ❌ `valueAmbTotal` - Duplicando valueAmb (incorreto)

**Problemas:**
- valueAmbTotal deveria incluir outros componentes
- Conversão de centavos incorreta

**Refinamentos Necessários:**
- Corrigir fórmula: `valueAmbTotal = valueAmb + outrosComponentesAmb`
- Verificar se valores estão em reais ou centavos na origem
- Adicionar detalhamento de componentes

---

### **4. 🏥 VALORES HOSPITALARES**
**Campos Atuais:**
- ✅ `valueHosp` - Valor SH (Serviço Hospitalar)
- ✅ `valueProf` - Valor SP (Serviço Profissional)  
- ❌ `valueHospTotal` - Soma incorreta

**Problemas:**
- valueHospTotal = SH + SP (correto)
- Mas VALOR TOTAL final está somando tudo incorretamente

**Refinamentos Necessários:**
- Manter valueHospTotal = SH + SP
- Corrigir VALOR TOTAL = SA + SH + SP (não duplicar)

---

### **5. ✅ CRITÉRIOS DE ELEGIBILIDADE**
**Campos Atuais:**
- ✅ `gender` - Sexo (funciona)
- ✅ `minAge`/`maxAge` - Idades (funciona)
- ❌ `cbo` - Array vazio
- ❌ `cid` - Array vazio
- ❌ `habilitation` - Sempre "Não informado"

**Problemas:**
- CBOs e CIDs não estão sendo buscados das tabelas relacionadas
- Habilitações não estão sendo mapeadas

**Refinamentos Necessários:**
- Buscar CBOs de `sigtap_procedimento_ocupacao`
- Buscar CIDs de `sigtap_procedimento_cid`
- Mapear habilitações reais

---

### **6. 📏 LIMITES OPERACIONAIS**
**Campos Atuais:**
- ✅ `maxQuantity` - Quantidade máxima (funciona)
- ✅ `averageStay` - Permanência média (funciona)  
- ✅ `points` - Pontos (funciona)
- ❌ `habilitationGroup` - Array vazio

**Problemas:**
- Grupos de habilitação não estão sendo carregados

**Refinamentos Necessários:**
- Carregar grupos de habilitação reais
- Validar limites operacionais

---

## 🔧 **CORREÇÕES PRIORITÁRIAS**

### **🥇 PRIORIDADE 1: Valores Financeiros**
```typescript
// PROBLEMA ATUAL:
VALOR TOTAL = valueAmb + valueAmbTotal + valueHosp + valueProf + valueHospTotal
// = SA + SA + SH + SP + (SH+SP) = 2*SA + 2*SH + 2*SP (DUPLICADO!)

// CORREÇÃO:
VALOR TOTAL = valueAmb + valueHosp + valueProf  
// = SA + SH + SP (CORRETO!)
```

### **🥈 PRIORIDADE 2: Dados Relacionados**
- Buscar CBOs da tabela `sigtap_procedimento_ocupacao`
- Buscar CIDs da tabela `sigtap_procedimento_cid`  
- Buscar modalidades da tabela `sigtap_modalidade`

### **🥉 PRIORIDADE 3: Classificações**
- Extrair grupo/subgrupo do código do procedimento
- Mapear especialidades e habilitações
- Classificar origem real (não genérica)

---

## 📋 **PRÓXIMOS PASSOS SUGERIDOS**

1. **Corrigir Valores Financeiros** (mais crítico)
2. **Implementar Busca de Dados Relacionados** 
3. **Refinar Interface das 6 Categorias**
4. **Melhorar Conversões e Mapeamentos**
5. **Validar Integridade dos Dados**

---

## 🎯 **RESULTADO ESPERADO**

Após refinamento:
- ✅ **Valores corretos** em todas as categorias
- ✅ **CBOs e CIDs reais** carregados das tabelas auxiliares
- ✅ **Modalidades e classificações** precisas
- ✅ **Interface organizada** pelas 6 categorias
- ✅ **Dados completos** para faturamento hospitalar

---

**QUER COMEÇAR POR QUAL PRIORIDADE?**
1. 💰 Valores Financeiros (mais crítico)
2. 🔗 Dados Relacionados (CBO/CID/Modalidade)  
3. 🎨 Interface das 6 Categorias 