# 🏥 GUIA: Relacionamento de Registros SISAIH01 com Hospitais

## 📋 **Visão Geral**

Este guia descreve como o sistema relaciona automaticamente os registros SISAIH01 com os hospitais cadastrados, usando o **CNES** como identificador único.

---

## 🔧 **Como Funciona**

### **Fluxo Automático:**

1. **Upload/Processamento do arquivo SISAIH01**
   - Sistema extrai o campo `cnes_hospital` de cada registro (coluna fixa posição 8-14)

2. **Ao clicar em "Salvar":**
   - Sistema busca todos os hospitais cadastrados na tabela `hospitals`
   - Cria um mapa: `CNES → hospital_id`
   - Para cada registro:
     - Busca o `hospital_id` correspondente ao `cnes_hospital`
     - Adiciona o `hospital_id` antes de salvar no banco
     - Se não encontrar, deixa `hospital_id = null` mas salva o registro

3. **Resultado:**
   - Registros relacionados automaticamente com hospitais
   - Isolamento de dados por hospital
   - Facilita filtros e relatórios futuros

---

## 🚀 **PASSO 1: Executar SQL para Adicionar Coluna**

Execute o seguinte SQL no Supabase:

```sql
-- Arquivo: database/add_hospital_id_to_aih_registros.sql
```

**O que este script faz:**
- ✅ Adiciona coluna `hospital_id` (UUID nullable)
- ✅ Cria Foreign Key para `hospitals(id)`
- ✅ Cria índice de performance
- ✅ Preenche `hospital_id` para registros existentes
- ✅ Atualiza views analíticas
- ✅ Mostra estatísticas de relacionamento

---

## 📊 **PASSO 2: Verificar Relacionamento**

Após executar o SQL, verifique quantos registros foram relacionados:

```sql
SELECT 
  COUNT(*) FILTER (WHERE hospital_id IS NOT NULL) as relacionados,
  COUNT(*) FILTER (WHERE hospital_id IS NULL) as sem_relacao,
  COUNT(*) as total,
  ROUND(COUNT(*) FILTER (WHERE hospital_id IS NOT NULL) * 100.0 / COUNT(*), 2) as percentual_relacionado
FROM aih_registros;
```

**Resultado esperado:**
```
relacionados | sem_relacao | total | percentual_relacionado
-------------|-------------|-------|----------------------
     1500    |     50      | 1550  |       96.77%
```

---

## 🔍 **PASSO 3: Verificar CNES Não Relacionados**

Se houver registros sem relacionamento, identifique os CNES faltantes:

```sql
SELECT DISTINCT 
  ar.cnes_hospital,
  COUNT(*) as quantidade_registros
FROM aih_registros ar
WHERE ar.hospital_id IS NULL
  AND ar.cnes_hospital IS NOT NULL
  AND ar.cnes_hospital != ''
GROUP BY ar.cnes_hospital
ORDER BY quantidade_registros DESC;
```

**Exemplo de resultado:**
```
cnes_hospital | quantidade_registros
--------------|--------------------
  2345678     |        25
  9876543     |        15
  1234567     |        10
```

---

## 🏥 **PASSO 4: Cadastrar Hospitais Faltantes**

Se encontrar CNES não cadastrados, adicione-os à tabela `hospitals`:

```sql
-- Exemplo: Adicionar hospital com CNES 2345678
INSERT INTO hospitals (name, cnpj, cnes, city, state, is_active)
VALUES (
  'Hospital XYZ',
  '12.345.678/0001-90',
  '2345678',
  'São Paulo',
  'SP',
  true
);
```

**Dica:** Consulte o CNES oficial para obter dados completos:
- Site: https://cnes.datasus.gov.br/

---

## 🔄 **PASSO 5: Atualizar Registros Existentes**

Após cadastrar novos hospitais, execute novamente o UPDATE para relacionar registros pendentes:

```sql
UPDATE aih_registros ar
SET hospital_id = h.id
FROM hospitals h
WHERE ar.cnes_hospital IS NOT NULL
  AND h.cnes IS NOT NULL
  AND TRIM(ar.cnes_hospital) = TRIM(h.cnes)
  AND ar.hospital_id IS NULL;

-- Verificar quantos foram atualizados
SELECT COUNT(*) as registros_atualizados
FROM aih_registros
WHERE hospital_id IS NOT NULL;
```

---

## 📈 **VIEWS ANALÍTICAS COM HOSPITAIS**

### **View: Registros por Hospital**

```sql
SELECT * FROM aih_registros_por_hospital
ORDER BY total_aihs DESC
LIMIT 10;
```

**Resultado:**
```
cnes_hospital | nome_hospital        | cidade         | total_aihs | pacientes_unicos
--------------|---------------------|----------------|------------|----------------
  0887854     | Hospital Apucarana  | Apucarana     |    1200    |      950
  1234567     | Hospital Guarapuava | Guarapuava    |     800    |      650
  2345678     | Hospital Ivaiporã   | Ivaiporã      |     500    |      400
```

### **Filtrar Registros por Hospital Específico**

```sql
SELECT 
  numero_aih,
  nome_paciente,
  data_internacao,
  procedimento_realizado
FROM aih_registros
WHERE hospital_id = 'uuid-do-hospital'
ORDER BY data_internacao DESC
LIMIT 10;
```

---

## 🎯 **BENEFÍCIOS DO RELACIONAMENTO**

### **1. Isolamento de Dados**
- Cada hospital vê apenas seus registros
- RLS (Row Level Security) pode ser aplicado por `hospital_id`

### **2. Relatórios Segmentados**
- Análises por hospital
- Comparação entre unidades
- Rankings de performance

### **3. Gestão Multi-Hospital**
- Diretores veem todos os hospitais
- Operadores veem apenas seu hospital
- Auditoria por unidade

### **4. Performance**
- Índice otimizado em `hospital_id`
- Queries mais rápidas
- Menos dados trafegados

---

## 🚨 **TROUBLESHOOTING**

### **Problema: Registros não sendo relacionados**

**Causa 1: CNES com zeros à esquerda**
```sql
-- Normalizar CNES antes de comparar
UPDATE hospitals
SET cnes = TRIM(LEADING '0' FROM cnes)
WHERE cnes IS NOT NULL;
```

**Causa 2: CNES com espaços**
```sql
-- Remover espaços dos CNES
UPDATE hospitals
SET cnes = TRIM(cnes)
WHERE cnes IS NOT NULL;
```

**Causa 3: CNES não cadastrado**
```sql
-- Verificar se hospital existe
SELECT * FROM hospitals WHERE cnes = '2345678';
-- Se não existir, cadastrar conforme PASSO 4
```

### **Problema: Foreign Key Constraint Error**

Se encontrar erro de constraint ao tentar adicionar a FK:

```sql
-- Verificar se há hospital_id inválidos
SELECT DISTINCT ar.hospital_id
FROM aih_registros ar
LEFT JOIN hospitals h ON ar.hospital_id = h.id
WHERE ar.hospital_id IS NOT NULL
  AND h.id IS NULL;

-- Limpar hospital_id inválidos
UPDATE aih_registros
SET hospital_id = NULL
WHERE hospital_id NOT IN (SELECT id FROM hospitals);

-- Tentar adicionar FK novamente
ALTER TABLE aih_registros 
ADD CONSTRAINT fk_aih_registros_hospital 
FOREIGN KEY (hospital_id) 
REFERENCES hospitals(id)
ON DELETE SET NULL;
```

---

## 📝 **LOGS NO CONSOLE**

Ao salvar registros SISAIH01, o sistema mostra logs detalhados:

```
🏥 Buscando hospitais para relacionamento por CNES...
✅ 10 hospitais mapeados por CNES

✅ CNES 0887854 → Hospital: Hospital Apucarana
✅ CNES 1234567 → Hospital: Hospital Guarapuava
⚠️ CNES 2345678 não encontrado no cadastro de hospitais

📦 Lote 1/5 salvo (100/500)
📦 Lote 2/5 salvo (200/500)
...

📊 Resumo: 480 salvos, 0 erros de 500 total

🏥 RELATÓRIO DE RELACIONAMENTO COM HOSPITAIS:
   ✅ Registros relacionados com hospital: 450
   ⚠️ Registros sem hospital: 50

📋 CNES não encontrados no cadastro de hospitais:
   - CNES: 2345678 (25 registros)
   - CNES: 9876543 (15 registros)

💡 Dica: Cadastre estes hospitais no sistema para relacionamento automático
```

---

## ✅ **CHECKLIST DE IMPLEMENTAÇÃO**

- [ ] Executar SQL `add_hospital_id_to_aih_registros.sql`
- [ ] Verificar estatísticas de relacionamento
- [ ] Identificar CNES não relacionados
- [ ] Cadastrar hospitais faltantes
- [ ] Executar UPDATE para relacionar registros pendentes
- [ ] Verificar views analíticas
- [ ] Testar filtros por hospital na interface
- [ ] Configurar RLS por hospital (opcional)

---

## 🎓 **EXEMPLO PRÁTICO**

### **Cenário:**
Você importou 1000 registros SISAIH01 de 3 hospitais:
- Hospital A (CNES: 0887854) - já cadastrado
- Hospital B (CNES: 1234567) - já cadastrado
- Hospital C (CNES: 2345678) - NÃO cadastrado

### **Resultado Esperado:**
```
📊 RELATÓRIO:
   ✅ 700 registros → Hospital A
   ✅ 250 registros → Hospital B
   ⚠️ 50 registros → Sem hospital (CNES 2345678)
```

### **Solução:**
1. Cadastrar Hospital C com CNES 2345678
2. Executar UPDATE para relacionar os 50 registros pendentes
3. Verificar novamente: 100% relacionados ✅

---

## 📞 **Suporte**

Em caso de dúvidas:
1. Verifique os logs no console do navegador
2. Execute as queries de verificação acima
3. Consulte este guia para troubleshooting
4. Contate o suporte técnico se necessário

---

**Última Atualização:** 17/10/2025  
**Versão:** 1.0

