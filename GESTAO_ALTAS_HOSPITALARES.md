# 🏥 GESTÃO DE ALTAS HOSPITALARES

## 📋 RESUMO EXECUTIVO

Sistema completo para importação e visualização de altas hospitalares do sistema hospitalar para o SIGTAP Sync.

---

## ✅ IMPLEMENTAÇÃO CONCLUÍDA

### **1. ESTRUTURA DE BANCO DE DADOS** ✅
- **Tabela**: `hospital_discharges`
- **Campos**:
  - `leito`: Número do leito
  - `paciente`: Nome completo do paciente
  - `data_entrada`: Data/hora de internação
  - `data_saida`: Data/hora da alta
  - `duracao`: Duração total da internação
  - `responsavel`: Profissional responsável
  - `usuario_finalizacao`: Usuário que finalizou
  - `status`: Status da alta
  - `justificativa_observacao`: Motivo/observação
- **Isolamento**: Por `hospital_id` com RLS
- **Segurança**: Row Level Security (RLS) completo

### **2. SERVIÇO DE PROCESSAMENTO** ✅
- **Arquivo**: `src/services/hospitalDischargeService.ts`
- **Funcionalidades**:
  - ✅ Processar arquivo Excel
  - ✅ Validar estrutura (cabeçalho linha 4)
  - ✅ Converter datas para ISO
  - ✅ Salvar no banco com batch_id
  - ✅ Buscar altas por hospital
  - ✅ Deletar registros
  - ✅ Calcular estatísticas

### **3. INTERFACE DE USUÁRIO** ✅
- **Arquivo**: `src/components/HospitalDischargesManager.tsx`
- **Recursos**:
  - ✅ Upload de arquivo Excel
  - ✅ Validação de formato (.xlsx, .xls)
  - ✅ Processamento em tempo real
  - ✅ Tabela paginada de registros
  - ✅ Cards de estatísticas
  - ✅ Botão de atualizar
  - ✅ Botão de deletar
  - ✅ Feedback visual (toasts)

### **4. NAVEGAÇÃO INTEGRADA** ✅
- **Nova aba**: "Altas Hospitalares"
- **Posição**: Entre "AIH Avançado" e "Pacientes"
- **Ícone**: FileText
- **Acesso**: Todos os usuários (com isolamento por hospital)

---

## 🚀 COMO USAR

### **1. EXECUTAR SCRIPT SQL**
```bash
# No Supabase SQL Editor, execute:
database/create_hospital_discharges_table.sql
```

### **2. ACESSAR A TELA**
1. Faça login no sistema
2. Clique na aba **"Altas Hospitalares"**
3. Você verá a interface de importação

### **3. IMPORTAR ARQUIVO EXCEL**

#### **Formato do Arquivo Excel:**
- **Linhas 1-3**: Informações do relatório (ignoradas)
- **Linha 4**: Cabeçalho das colunas
- **Linha 5+**: Dados das altas

#### **Cabeçalho Esperado (Linha 4):**
```
LEITO | PACIENTE | DATA ENTRADA | DATA SAÍDA | DURAÇÃO | RESPONSÁVEL | USUÁRIO FINALIZAÇÃO | STATUS | JUSTIFICATIVA/OBSERVAÇÃO
```

#### **Exemplo de Dados:**
```
102 | ADENIR DOS SANTOS CORDEIRO | 15/10/2025 05:59 | 15/10/2025 17:46 | 11h 46min 38s | - | Camila Stadler (CRM: 931354) | Alta | Alta hospitalar qualificada...
```

#### **Passos:**
1. Clique em **"Escolher arquivo"**
2. Selecione o arquivo Excel (.xlsx ou .xls)
3. Clique em **"Importar"**
4. Aguarde o processamento
5. Veja os registros na tabela abaixo

### **4. VISUALIZAR REGISTROS**
- Tabela mostrando todas as altas importadas
- Paginação automática (20 registros por página)
- Dados isolados por hospital (você só vê seus dados)

### **5. DELETAR REGISTRO**
- Clique no ícone de lixeira na linha desejada
- Confirme a exclusão
- Registro será removido permanentemente

---

## 📊 ESTATÍSTICAS EXIBIDAS

### **Cards de Métricas:**
- **Total de Altas**: Quantidade total importada
- **Altas Hoje**: Altas registradas hoje
- **Permanência Média**: Tempo médio de internação

---

## 🔒 SEGURANÇA E ISOLAMENTO

### **Row Level Security (RLS):**
- ✅ Usuários veem **apenas** dados do seu hospital
- ✅ Roles administrativos veem todos os hospitais
- ✅ Logs de auditoria completos
- ✅ Restrições de INSERT/UPDATE/DELETE

### **Permissões por Role:**
| Role | Ver Dados | Inserir | Deletar |
|------|-----------|---------|---------|
| **Operator** | ✅ Seu hospital | ✅ Seu hospital | ❌ |
| **Admin/Director** | ✅ Todos | ✅ Todos | ✅ |
| **Developer/TI** | ✅ Todos | ✅ Todos | ✅ |

---

## 🔧 REGRAS DE PROCESSAMENTO

### **1. Validação de Arquivo:**
- Extensão: `.xlsx` ou `.xls`
- Tamanho máximo: 100MB (configurável)
- Estrutura: Cabeçalho na linha 4

### **2. Conversão de Datas:**
- Formatos aceitos:
  - `DD/MM/YYYY HH:MM`
  - `YYYY-MM-DD HH:MM`
- Conversão para ISO: `YYYY-MM-DDTHH:MM:SS`

### **3. Tratamento de Valores:**
- Células vazias → `null`
- Hífen "-" → `null`
- Espaços extras → removidos automaticamente

### **4. Metadados de Importação:**
- `source_file`: Nome do arquivo original
- `import_batch_id`: UUID do lote de importação
- `created_by`: Usuário que importou
- `hospital_id`: Hospital isolado

---

## 📁 ARQUIVOS CRIADOS

```
database/
└── create_hospital_discharges_table.sql  # Script SQL

src/
├── services/
│   └── hospitalDischargeService.ts       # Serviço de processamento
└── components/
    └── HospitalDischargesManager.tsx     # Interface de usuário
```

---

## 🎯 EXEMPLO DE JSON GERADO

```json
[
  {
    "id": "uuid-gerado",
    "hospital_id": "uuid-do-hospital",
    "leito": "102",
    "paciente": "ADENIR DOS SANTOS CORDEIRO",
    "data_entrada": "2025-10-15T05:59:00",
    "data_saida": "2025-10-15T17:46:00",
    "duracao": "11h 46min 38s",
    "responsavel": "-",
    "usuario_finalizacao": "Camila Stadler Rodrigues da Cunha (CRM: 931354)",
    "status": "Alta",
    "justificativa_observacao": "Alta hospitalar qualificada após procedimento ...",
    "source_file": "altas_outubro_2025.xlsx",
    "import_batch_id": "uuid-do-lote",
    "created_at": "2025-10-16T10:30:00Z"
  }
]
```

---

## ⚠️ TROUBLESHOOTING

### **Problema: "Arquivo inválido"**
**Solução**: Verifique se o cabeçalho está na linha 4 e se as colunas estão corretas

### **Problema: "Datas inválidas"**
**Solução**: Certifique-se que as datas estão no formato `DD/MM/YYYY HH:MM`

### **Problema: "Erro ao salvar no banco"**
**Solução**: Verifique se o script SQL foi executado corretamente no Supabase

### **Problema: "Nenhum registro encontrado"**
**Solução**: Verifique se há dados após a linha 4 do Excel

---

## ✅ STATUS FINAL

- ✅ **Banco de Dados**: Criado com RLS
- ✅ **Serviço**: Completo e funcional
- ✅ **Interface**: Prática e objetiva
- ✅ **Navegação**: Integrada
- ✅ **Isolamento**: Por hospital_id
- ✅ **Documentação**: Completa

**Sistema pronto para uso em produção!** 🚀

---

**© 2025 SIGTAP Sync - Gestão de Altas Hospitalares**  
*Implementado em: 16 de outubro de 2025*

