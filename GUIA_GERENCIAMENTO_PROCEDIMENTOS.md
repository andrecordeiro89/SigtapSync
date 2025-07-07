# 🩺 **GUIA DE GERENCIAMENTO DE PROCEDIMENTOS - SIGTAP Sync**
## Funcionalidades de Remoção e Exclusão de Procedimentos

---

## 📋 **RESUMO EXECUTIVO**

✅ **IMPLEMENTAÇÃO CONCLUÍDA**: Sistema completo de gerenciamento de procedimentos  
🎯 **OBJETIVO**: Permitir remoção e exclusão de procedimentos individuais das AIHs  
⚙️ **FUNCIONALIDADES**: Remoção temporária, exclusão permanente e restauração  
🔐 **CONTROLE DE ACESSO**: Baseado em roles de usuário  

---

## 🚀 **COMO ACESSAR**

### **1. Navegue para a Tela de Pacientes**
- Menu lateral → **"Gestão de AIHs e Pacientes"**
- Visualize a lista de AIHs processadas

### **2. Expanda uma AIH**
- Clique no botão **⬇️** ao lado da AIH desejada
- Visualize os detalhes expandidos da AIH

### **3. Acesse o Gerenciador de Procedimentos**
- Na seção **"⚙️ Ações Avançadas"**
- Clique em **"🩺 Gerenciar Procedimentos"**
- Modal será aberto com a interface completa

---

## 🎯 **FUNCIONALIDADES DISPONÍVEIS**

### **📊 Visualização de Procedimentos**
- **Lista completa** de todos os procedimentos da AIH
- **Estatísticas em tempo real**: Total, Pendentes, Aprovados, Rejeitados, Removidos
- **Detalhes expandíveis** para cada procedimento
- **Informações SIGTAP** quando disponíveis

### **🔄 Ações de Procedimentos**

#### **1. ⚠️ REMOÇÃO TEMPORÁRIA**
- **O que faz**: Marca procedimento como "removido" 
- **Reversível**: ✅ Pode ser restaurado posteriormente
- **Impacto**: Procedimento não conta nas estatísticas
- **Uso**: Para procedimentos que não devem ser faturados temporariamente

#### **2. 🗑️ EXCLUSÃO PERMANENTE**
- **O que faz**: Remove permanentemente o procedimento
- **Reversível**: ❌ NÃO pode ser desfeita
- **Impacto**: Procedimento é completamente removido
- **Uso**: Para procedimentos incorretos ou duplicados

#### **3. ♻️ RESTAURAÇÃO**
- **O que faz**: Restaura procedimento removido
- **Status**: Volta para "Pendente"
- **Impacto**: Procedimento volta a contar nas estatísticas
- **Uso**: Para reverter remoções temporárias

---

## 🔐 **CONTROLE DE ACESSO**

### **Permissões por Role:**

| Ação | Operador | Auditor | Coordenador | Admin | Diretor |
|------|----------|---------|-------------|-------|---------|
| **Visualizar** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Remover** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Excluir** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Restaurar** | ❌ | ✅ | ✅ | ✅ | ✅ |

**Nota**: Operadores têm acesso **somente leitura** ao gerenciador.

---

## 📱 **INTERFACE DO USUÁRIO**

### **Estatísticas no Topo**
```
┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│  Total  │Pendentes│Aprovados│Rejeitados│Removidos│ Valor   │
│    12   │    3    │    7    │    1    │    1    │R$ 1.250 │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
```

### **Tabela de Procedimentos**
- **Seq**: Sequência do procedimento
- **Código**: Código do procedimento
- **Descrição**: Nome/descrição do procedimento
- **Data**: Data de realização
- **Valor**: Valor calculado
- **Status**: Badge colorido do status atual
- **Ações**: Botões de ação disponíveis
- **Detalhes**: Botão para expandir informações

### **Badges de Status**
- 🟡 **Pendente**: Aguardando processamento
- 🟢 **Aprovado**: Procedimento validado
- 🔴 **Rejeitado**: Procedimento rejeitado
- ⚪ **Removido**: Procedimento removido temporariamente

---

## ⚡ **PASSO A PASSO DE USO**

### **Para Remover um Procedimento:**

1. **Acesse** o gerenciador de procedimentos
2. **Localize** o procedimento na tabela
3. **Clique** no botão **⚠️** (Remover)
4. **Confirme** na janela de diálogo
5. **Aguarde** a confirmação de sucesso

> ℹ️ **Resultado**: Procedimento marcado como "Removido" e estatísticas atualizadas

### **Para Excluir Permanentemente:**

1. **Acesse** o gerenciador de procedimentos
2. **Localize** o procedimento na tabela
3. **Clique** no botão **🗑️** (Excluir)
4. **Leia atentamente** os avisos na janela
5. **Confirme** "Excluir Permanentemente"
6. **Aguarde** a confirmação de sucesso

> ⚠️ **ATENÇÃO**: Esta ação não pode ser desfeita!

### **Para Restaurar um Procedimento:**

1. **Localize** procedimento com status "Removido"
2. **Clique** no botão **♻️** (Restaurar)
3. **Aguarde** a confirmação de sucesso

> ✅ **Resultado**: Procedimento volta ao status "Pendente"

---

## 🔄 **RECÁLCULO AUTOMÁTICO**

### **O que é Recalculado:**
- ✅ **Total de procedimentos** ativos
- ✅ **Procedimentos aprovados** 
- ✅ **Procedimentos rejeitados**
- ✅ **Valor total** da AIH
- ✅ **Status de processamento** da AIH
- ✅ **Necessidade de revisão manual**

### **Quando Ocorre:**
- 🔄 Após **remoção** de procedimento
- 🔄 Após **exclusão** de procedimento
- 🔄 Após **restauração** de procedimento
- 🔄 **Automaticamente** em tempo real

---

## 📊 **DETALHES EXPANDIDOS**

Clique no botão **▶️/▼** para ver:

### **Informações Básicas**
- ID único do procedimento
- Sequência na AIH
- Código do procedimento
- Data de realização
- Histórico de criação/atualização

### **Dados SIGTAP** (quando disponível)
- Código SIGTAP correspondente
- Descrição oficial
- Complexidade do procedimento
- Valores detalhados (ambulatorial, hospitalar, profissional)

### **Histórico de Matches**
- Score de correspondência
- Nível de confiança
- Status do match
- Detalhes da validação

---

## 🎯 **CASOS DE USO PRÁTICOS**

### **Cenário 1: Procedimento Duplicado**
- **Situação**: Mesmo procedimento registrado 2x
- **Ação**: Excluir permanentemente a duplicata
- **Resultado**: AIH limpa, valor correto

### **Cenário 2: Procedimento Incorreto**
- **Situação**: Código errado digitado
- **Ação**: Excluir permanentemente
- **Resultado**: Apenas procedimentos válidos

### **Cenário 3: Revisão Temporária**
- **Situação**: Dúvida sobre procedimento
- **Ação**: Remover temporariamente
- **Resultado**: Estatísticas sem o item para análise

### **Cenário 4: Revalidação**
- **Situação**: Procedimento removido foi validado
- **Ação**: Restaurar procedimento
- **Resultado**: Volta a contar normalmente

---

## 📋 **AUDITORIA E LOGS**

### **Rastreamento Completo**
- ✅ **Quem** fez a alteração
- ✅ **Quando** foi feita
- ✅ **Que** procedimento foi afetado
- ✅ **Qual** ação foi executada

### **Logs Gerados**
- `REMOVE_PROCEDURE`: Remoção temporária
- `DELETE_PROCEDURE`: Exclusão permanente  
- `RESTORE_PROCEDURE`: Restauração

### **Acesso aos Logs**
- Dashboard de auditoria
- Relatórios executivos
- Análises de performance

---

## 🚨 **ALERTAS E CUIDADOS**

### **⚠️ ATENÇÃO - Exclusão Permanente**
- **NÃO É REVERSÍVEL** 
- Remove **TODOS** os dados relacionados
- Afeta **estatísticas** da AIH
- Impacta **relatórios** financeiros

### **💡 DICAS DE USO**
- ✅ Use **remoção** para revisões temporárias
- ✅ Use **exclusão** apenas para erros graves
- ✅ **Documente** o motivo das alterações
- ✅ **Comunique** a equipe sobre mudanças

### **🔒 RESPONSABILIDADES**
- **Coordenadores**: Podem remover e restaurar
- **Administradores**: Acesso completo
- **Diretores**: Supervisão e aprovação final

---

## 📞 **SUPORTE E TREINAMENTO**

### **Em Caso de Dúvidas**
1. **Consulte** este guia primeiro
2. **Teste** em AIH de desenvolvimento  
3. **Contate** o administrador do sistema
4. **Documente** problemas encontrados

### **Treinamento Recomendado**
- **30 min**: Apresentação das funcionalidades
- **15 min**: Demonstração prática
- **15 min**: Exercícios práticos supervisionados

---

## ✅ **CHECKLIST DE IMPLEMENTAÇÃO**

- [x] ✅ **Serviços de backend** implementados
- [x] ✅ **Interface de usuário** criada
- [x] ✅ **Controle de acesso** configurado
- [x] ✅ **Recálculo automático** funcionando
- [x] ✅ **Auditoria e logs** implementados
- [x] ✅ **Testes de funcionalidade** realizados
- [x] ✅ **Documentação** completa

**🎉 SISTEMA PRONTO PARA USO EM PRODUÇÃO! 🚀** 