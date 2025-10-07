# 🚀 INSTRUÇÕES PARA APLICAR AS CORREÇÕES

## ⚡ CORREÇÃO RÁPIDA (5 minutos)

### 1️⃣ **Executar Script SQL no Supabase**

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Abra o arquivo `database/fix_missing_competencia.sql`
4. Copie TODO o conteúdo
5. Cole no editor SQL
6. Clique em **RUN**

**Resultado esperado:**
```
✅ Atualizadas com discharge_date: 15 linhas
✅ Função check_aih_quality criada
✅ Trigger auto_fill_competencia criado
✅ Percentual preenchido: 100%
```

---

### 2️⃣ **Reiniciar a Aplicação**

```bash
# Pressione Ctrl+C no terminal onde está rodando
# Execute novamente:
npm run dev
```

---

### 3️⃣ **Verificar no Sistema**

#### **Tela Pacientes:**
1. Faça login como **Operador** ou **Administrador**
2. Vá em **Pacientes**
3. Selecione:
   - **Hospital:** Juarez Barreto (FAX)
   - **Competência:** 07/2025
4. **Confirme:** Mostra **300 pacientes** ✅

#### **Tela Analytics:**
1. Faça login como **Administrador**
2. Vá em **Analytics**
3. Clique na aba **Profissionais**
4. Selecione:
   - **Hospital:** Juarez Barreto (FAX)
   - **Competência:** 07/2025
5. **Confirme:** Badge mostra **300 pacientes** ✅

---

## 🔍 VERIFICAR SE FUNCIONOU

### Teste Rápido no Console (F12)

```javascript
// Cole no console do navegador (F12):
const quality = await supabase.rpc('check_aih_quality', { p_hospital_id: 'ALL' });
console.log('Qualidade dos Dados:', quality.data);
```

**Resultado esperado:**
```json
{
  "total_aihs": 300,
  "missing_competencia": 0,
  "missing_doctor": 0,
  "percentual_sem_competencia": 0,
  "percentual_sem_medico": 0
}
```

---

## 🛠️ SE AINDA HOUVER DISCREPÂNCIA

### Opção 1: Verificar Logs

```bash
# Abrir console do navegador (F12 → Console)
# Procurar por:
"📥 [TABELAS - OTIMIZADO] Carregando dados em paralelo..."
"✅ X AIHs carregadas em Xms"
```

### Opção 2: Forçar Recarga Completa

```bash
# 1. Limpar cache do navegador
Ctrl + Shift + Delete

# 2. Recarregar aplicação
Ctrl + F5

# 3. Fazer logout e login novamente
```

### Opção 3: Verificar Trigger

```sql
-- Executar no SQL Editor do Supabase:
SELECT 
  trigger_name, 
  event_manipulation, 
  action_statement 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_auto_fill_competencia';
```

**Resultado esperado:**
```
trigger_auto_fill_competencia | INSERT | EXECUTE FUNCTION auto_fill_competencia()
trigger_auto_fill_competencia | UPDATE | EXECUTE FUNCTION auto_fill_competencia()
```

---

## 📊 MONITORAMENTO CONTÍNUO

### Verificar Qualidade de Dados Regularmente

```sql
-- Hospital específico (FAX):
SELECT * FROM check_aih_quality('FAX_HOSPITAL_ID');

-- Todos os hospitais:
SELECT * FROM check_aih_quality('ALL');
```

### Criar Alerta no Dashboard (Futuro)

```typescript
// Exemplo de código para adicionar no Dashboard:
useEffect(() => {
  const checkQuality = async () => {
    const quality = await AIHPersistenceService.checkAIHDataQuality('ALL');
    
    if (quality.percentual_sem_competencia > 5) {
      toast.warning(`⚠️ ${quality.missing_competencia} AIHs sem competência!`);
    }
    
    if (quality.percentual_sem_medico > 10) {
      toast.warning(`⚠️ ${quality.missing_doctor} AIHs sem médico responsável!`);
    }
  };
  
  checkQuality();
}, []);
```

---

## ❓ FAQ

### P: O que é o campo `competencia`?
**R:** É o mês de referência SUS, sempre baseado no **mês de alta do paciente**. Formato: `YYYY-MM-01` (ex: `2025-07-01`)

### P: Por que estava perdendo pacientes?
**R:** Dois problemas:
1. 15 AIHs estavam sem campo `competencia` preenchido
2. Analytics filtrava por `admission_date`, Pacientes por `discharge_date`

### P: O trigger vai funcionar para novas AIHs?
**R:** Sim! Toda AIH inserida/atualizada terá `competencia` preenchida automaticamente.

### P: Posso desativar o trigger?
**R:** Não recomendado. Ele previne futuros problemas de dados.

### P: Como ver todas as competências disponíveis?
**R:**
```sql
SELECT DISTINCT 
  TO_CHAR(discharge_date, 'MM/YYYY') as competencia,
  COUNT(*) as total_pacientes
FROM aihs
WHERE discharge_date IS NOT NULL
GROUP BY TO_CHAR(discharge_date, 'MM/YYYY')
ORDER BY competencia DESC;
```

---

## 📞 CONTATO

Se precisar de ajuda:
1. Verifique os logs do console (F12)
2. Execute `check_aih_quality()` no SQL
3. Consulte `ANALISE_DISCREPANCIA_ANALYTICS.md` para detalhes técnicos

---

**✅ Após aplicar, ambas as telas exibirão 300 pacientes!**

