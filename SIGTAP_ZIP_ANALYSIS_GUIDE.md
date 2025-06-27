# 📊 GUIA DE ANÁLISE DO ARQUIVO ZIP SIGTAP

## 🎯 OBJETIVO
Descobrir a lógica e estrutura dos arquivos oficiais do SIGTAP em formato ZIP para implementar importação objetiva e sem margem de erros.

## 🔍 ESTRATÉGIA DE INVESTIGAÇÃO

### **ETAPA 1: INSPEÇÃO RÁPIDA**
```bash
# Análise inicial básica
python scripts/quick_zip_inspector.py caminho/para/sigtap.zip
```

**O que descobrimos:**
- ✅ Lista completa de arquivos
- ✅ Tamanhos e extensões
- ✅ Categorização (dados vs outros)
- ✅ Identificação dos maiores arquivos

### **ETAPA 2: ANÁLISE PROFUNDA**
```bash
# Análise detalhada com relacionamentos
python scripts/analyze_sigtap_zip.py caminho/para/sigtap.zip
```

**O que descobrimos:**
- ✅ Estrutura de colunas de cada arquivo
- ✅ Delimitadores e encoding
- ✅ Possíveis chaves primárias/estrangeiras
- ✅ Relacionamentos entre tabelas
- ✅ Estratégia de importação sugerida
- ✅ Relatório JSON completo

## 📋 INFORMAÇÕES ESPERADAS

### **ARQUIVOS TÍPICOS DO SIGTAP:**
```
📊 tb_procedimento.csv           # Tabela principal de procedimentos
📊 tb_grupo.csv                  # Grupos de procedimentos  
📊 tb_subgrupo.csv               # Subgrupos
📊 tb_forma_organizacao.csv      # Formas de organização
📊 tb_cid.csv                    # Códigos CID
📊 tb_cbo.csv                    # Códigos CBO
📊 tb_habilitacao.csv            # Habilitações
📊 tb_sigtap.csv                 # Tabela unificada (se existir)
```

### **ESTRUTURA ESPERADA:**
```
Procedimento (chave principal)
├── Código SIGTAP
├── Descrição
├── Complexidade  
├── Modalidade
├── Valores (SA, SH, SP)
├── Grupo (FK -> tb_grupo)
├── Subgrupo (FK -> tb_subgrupo)
├── CID (FK -> tb_cid)
├── CBO (FK -> tb_cbo)
└── Habilitação (FK -> tb_habilitacao)
```

## 🛠️ IMPLEMENTAÇÃO DA IMPORTAÇÃO

### **PASSO 1: PREPARAR AMBIENTE**
```bash
# Instalar dependências
pip install pandas chardet openpyxl
```

### **PASSO 2: EXECUTAR ANÁLISE**
```bash
# 1. Inspeção rápida
python scripts/quick_zip_inspector.py sigtap.zip

# 2. Análise completa  
python scripts/analyze_sigtap_zip.py sigtap.zip

# 3. Verificar relatório gerado
cat sigtap_analysis_report.json
```

### **PASSO 3: IMPLEMENTAR IMPORTADOR**

**Baseado nos resultados da análise, criar:**

```typescript
// src/services/sigtapZipImporter.ts
export class SigtapZipImporter {
  async importFromZip(zipFile: File) {
    // 1. Extrair arquivos baseado na estratégia descoberta
    // 2. Importar na ordem correta (referências primeiro)
    // 3. Validar integridade referencial
    // 4. Popular banco de dados
  }
}
```

## 📊 ANÁLISE DOS RELACIONAMENTOS

### **CHAVES ESPERADAS:**
```
🔑 Procedimento:
   - codigo_procedimento (PK)
   - codigo_grupo (FK)
   - codigo_subgrupo (FK)

🔑 Grupo:
   - codigo_grupo (PK)
   - descricao_grupo

🔑 Subgrupo:
   - codigo_subgrupo (PK)
   - codigo_grupo (FK)
   - descricao_subgrupo
```

### **VALIDAÇÕES NECESSÁRIAS:**
```sql
-- Integridade referencial
SELECT COUNT(*) FROM procedimentos p 
LEFT JOIN grupos g ON p.codigo_grupo = g.codigo_grupo 
WHERE g.codigo_grupo IS NULL;

-- Consistência de dados
SELECT COUNT(DISTINCT codigo_procedimento) FROM procedimentos;
```

## 🎯 ESTRATÉGIA DE IMPORTAÇÃO

### **ORDEM RECOMENDADA:**
1. **Tabelas de referência** (menores, sem dependências)
   - tb_grupo.csv
   - tb_cid.csv  
   - tb_cbo.csv
   - tb_habilitacao.csv

2. **Tabelas intermediárias**
   - tb_subgrupo.csv (depende de grupo)
   - tb_forma_organizacao.csv

3. **Tabela principal**
   - tb_procedimento.csv (depende de todas as anteriores)
   - tb_sigtap.csv (tabela unificada, se existir)

### **SCHEMA SUGERIDO:**
```sql
-- Adaptar schema atual para suportar dados estruturados
ALTER TABLE sigtap_procedures ADD COLUMN grupo_codigo VARCHAR(10);
ALTER TABLE sigtap_procedures ADD COLUMN subgrupo_codigo VARCHAR(10);
ALTER TABLE sigtap_procedures ADD COLUMN cid_codigo VARCHAR(10);
ALTER TABLE sigtap_procedures ADD COLUMN cbo_codigo VARCHAR(10);

-- Criar tabelas de referência
CREATE TABLE sigtap_grupos (...);
CREATE TABLE sigtap_subgrupos (...);
CREATE TABLE sigtap_cids (...);
CREATE TABLE sigtap_cbos (...);
```

## 📈 VANTAGENS DA IMPORTAÇÃO ESTRUTURADA

### **VS EXTRAÇÃO DE PDF:**
```
❌ PDF:
   - Dependente de layout
   - Prone a erros de OCR
   - Dados limitados por página
   - Inconsistências de formatação

✅ ZIP Estruturado:
   - Dados oficiais estruturados
   - 100% dos dados disponíveis
   - Relacionamentos preservados
   - Atualizações automatizáveis
   - Performance superior
```

### **BENEFÍCIOS:**
- 🎯 **Precisão:** 100% dos dados oficiais
- ⚡ **Performance:** Importação em lote
- 🔄 **Atualizável:** Processo automatizado
- 🧩 **Completo:** Todos os relacionamentos
- 📊 **Confiável:** Fonte oficial direta

## 🚀 PRÓXIMOS PASSOS

1. **Forneça o arquivo ZIP** para análise
2. **Execute os scripts** de investigação
3. **Analise o relatório** gerado
4. **Implemente o importador** baseado nos resultados
5. **Teste e valide** a importação
6. **Configure atualizações** automáticas

## 💡 EXEMPLO DE USO

```bash
# Cenário: Você tem sigtap_202412.zip
cd /c/Sigtap/sigtap-billing-wizard-4

# 1. Inspeção rápida
python scripts/quick_zip_inspector.py sigtap_202412.zip

# 2. Análise completa
python scripts/analyze_sigtap_zip.py sigtap_202412.zip

# 3. Revisar resultados
notepad sigtap_analysis_report.json

# 4. Implementar importador baseado nos achados
```

## 🔧 FERRAMENTAS CRIADAS

- ✅ `quick_zip_inspector.py` - Inspeção rápida
- ✅ `analyze_sigtap_zip.py` - Análise detalhada  
- ⏳ `sigtap_zip_importer.py` - Importador (a implementar)
- ⏳ `validate_integrity.py` - Validador (a implementar)

**📧 Execute a análise e compartilhe os resultados para implementarmos a importação completa!** 