# 👃 Regras de Pagamento - Dra. SUELLEN FERNANDA BAGATIM

## 📋 Informações da Médica

| Campo | Valor |
|-------|-------|
| **Nome Completo** | SUELLEN FERNANDA BAGATIM |
| **Hospital** | Hospital Municipal São José - Carlópolis |
| **Especialidade** | Otorrinolaringologia (ORL) |
| **Identificador no Sistema** | `HOSPITAL_MUNICIPAL_SAO_JOSE` → `SUELLEN FERNANDA BAGATIM` |
| **Hospital ID** | 792a0316-92b4-4504-8238-491d284099a3 |
| **Data de Cadastro** | 18/11/2025 |

---

## 📊 Resumo Executivo

### **Total de Regras Configuradas:**
- ✅ **5 procedimentos individuais** (todos R$ 700,00)
- ✅ **1 regra de múltiplos** (valor fixo total)
- ✅ **Sistema baseado em:** Valor fixo por procedimento

**Tipo de Regra:** Similar ao Dr. HUMBERTO MOREIRA DA SILVA (oftalmologia)

---

## 💰 PROCEDIMENTOS INDIVIDUAIS

### **Todos os Procedimentos: R$ 700,00**

| # | Código | Descrição | Valor |
|---|--------|-----------|-------|
| 1 | **04.04.01.048-2** | SEPTOPLASTIA | **R$ 700,00** |
| 2 | **04.04.01.041-5** | TURBINECTOMIA | **R$ 700,00** |
| 3 | **04.04.01.002-4** | AMIGDALECTOMIA | **R$ 700,00** |
| 4 | **04.04.01.001-6** | ADENOIDECTOMIA | **R$ 700,00** |
| 5 | **04.04.01.003-2** | ADENOAMIGDALECTOMIA | **R$ 700,00** |

### **Características:**
- ✅ Valor uniforme: R$ 700,00 para todos os procedimentos
- ✅ Especialidade: Otorrinolaringologia
- ✅ Foco: Cirurgias de nariz, septo, amígdalas e adenoides

---

## 🔗 REGRA DE MÚLTIPLOS PROCEDIMENTOS

### **⚠️ REGRA ESPECIAL: VALOR FIXO TOTAL**

**Combinação:** SEPTOPLASTIA + TURBINECTOMIA

| Componente | Código | Valor Individual | Valor em Combinação |
|------------|--------|------------------|---------------------|
| **Septoplastia** | 04.04.01.048-2 | R$ 700,00 | R$ 0,00 (incluído no total) |
| **Turbinectomia** | 04.04.01.041-5 | R$ 700,00 | R$ 0,00 (incluído no total) |
| **TOTAL** | - | ~~R$ 1.400,00~~ | **R$ 700,00** |

### **🔴 ATENÇÃO:**
Quando os procedimentos **Septoplastia** e **Turbinectomia** são realizados **juntos** na mesma cirurgia:
- ❌ **NÃO soma** os valores individuais (R$ 700 + R$ 700 = R$ 1.400)
- ✅ **Aplica valor fixo total:** R$ 700,00

---

## 📊 Exemplos Práticos de Cálculo

### **Cenário 1: Septoplastia Isolada ✅**

```
Procedimento Realizado:
└─ 04.04.01.048-2 (SEPTOPLASTIA) - R$ 700,00

✅ Apenas 1 procedimento
💰 Valor a Pagar: R$ 700,00
```

**Resultado:** Paga valor normal do procedimento.

---

### **Cenário 2: Turbinectomia Isolada ✅**

```
Procedimento Realizado:
└─ 04.04.01.041-5 (TURBINECTOMIA) - R$ 700,00

✅ Apenas 1 procedimento
💰 Valor a Pagar: R$ 700,00
```

**Resultado:** Paga valor normal do procedimento.

---

### **Cenário 3: Septoplastia + Turbinectomia ⚠️**

```
Procedimentos Realizados:
├─ 04.04.01.048-2 (SEPTOPLASTIA) - R$ 700,00
└─ 04.04.01.041-5 (TURBINECTOMIA) - R$ 700,00

⚠️ Múltiplos procedimentos detectados
🔍 Aplica regra especial: VALOR FIXO TOTAL
💰 Valor a Pagar: R$ 700,00 (NÃO R$ 1.400,00)
```

**Resultado:** ❌ **NÃO soma** os valores. Paga apenas R$ 700,00 total.

---

### **Cenário 4: Amigdalectomia Isolada ✅**

```
Procedimento Realizado:
└─ 04.04.01.002-4 (AMIGDALECTOMIA) - R$ 700,00

✅ Apenas 1 procedimento
💰 Valor a Pagar: R$ 700,00
```

**Resultado:** Paga valor normal do procedimento.

---

### **Cenário 5: Adenoamigdalectomia Isolada ✅**

```
Procedimento Realizado:
└─ 04.04.01.003-2 (ADENOAMIGDALECTOMIA) - R$ 700,00

✅ Apenas 1 procedimento
💰 Valor a Pagar: R$ 700,00
```

**Resultado:** Paga valor normal do procedimento (já inclui adenoides + amígdalas).

---

## 📐 Lógica de Aplicação no Sistema

### **Algoritmo de Cálculo:**

```javascript
function calcularValorSuellenBagatim(procedimentos) {
  // 1. Verificar se há combinação SEPTOPLASTIA + TURBINECTOMIA
  const temSeptoplastia = procedimentos.some(p => p.code === '04.04.01.048-2');
  const temTurbinectomia = procedimentos.some(p => p.code === '04.04.01.041-5');
  
  if (temSeptoplastia && temTurbinectomia) {
    // REGRA ESPECIAL: Valor fixo total
    return {
      value: 700.00,
      description: 'SEPTOPLASTIA + TURBINECTOMIA - R$ 700,00 TOTAL'
    };
  }
  
  // 2. Se não for a combinação especial, paga valores individuais
  let total = 0;
  procedimentos.forEach(proc => {
    total += 700.00; // Todos os procedimentos valem R$ 700
  });
  
  return {
    value: total,
    description: 'Soma de procedimentos individuais'
  };
}
```

### **Passo a Passo:**

1. **Sistema detecta** que a médica é SUELLEN FERNANDA BAGATIM
2. **Verifica** hospital: HOSPITAL_MUNICIPAL_SAO_JOSE
3. **Conta** quantos procedimentos foram realizados
4. **Verifica** se há combinação SEPTOPLASTIA + TURBINECTOMIA:
   - **Se SIM:** Aplica valor fixo R$ 700,00 total
   - **Se NÃO:** Soma valores individuais (R$ 700 cada)

---

## ⚖️ Comparação: Com e Sem Regra Especial

### **Sem Regra Especial (Soma Normal):**

```
Septoplastia:   R$ 700,00
Turbinectomia:  R$ 700,00
───────────────────────────
Total:          R$ 1.400,00 (SOMA)
```

### **Com Regra Especial (Dra. Suellen):**

```
Septoplastia:   R$ 700,00 ✗ (não soma)
Turbinectomia:  R$ 700,00 ✗ (não soma)
───────────────────────────
Total:          R$ 700,00 (VALOR FIXO TOTAL)
```

**Diferença:** ❌ Economia de R$ 700,00 (50%) quando procedimentos são realizados juntos.

---

## 💡 Justificativa da Regra

### **Por que essa regra existe?**

Esta regra especial é aplicada porque:

1. **Procedimentos Complementares:** Septoplastia e Turbinectomia são frequentemente realizados em conjunto para correção de desvio de septo e hipertrofia de cornetos
2. **Mesmo Campo Cirúrgico:** Ambos são realizados na mesma região (nariz/septo)
3. **Tempo Cirúrgico Similar:** Realizar os dois juntos não dobra o tempo ou complexidade
4. **Acordo Específico:** Negociação particular com a médica
5. **Evitar Pagamento Duplicado:** Para procedimentos que são parte de uma mesma correção anatômica

---

## 🔍 Validação da Regra

### **Situações Cobertas:**

| Situação | Comportamento | Valor | Status |
|----------|---------------|-------|--------|
| 1 Septoplastia | Paga valor normal | R$ 700 | ✅ |
| 1 Turbinectomia | Paga valor normal | R$ 700 | ✅ |
| Septoplastia + Turbinectomia | Valor fixo total | R$ 700 | ✅ |
| 1 Amigdalectomia | Paga valor normal | R$ 700 | ✅ |
| 1 Adenoidectomia | Paga valor normal | R$ 700 | ✅ |
| 1 Adenoamigdalectomia | Paga valor normal | R$ 700 | ✅ |
| 2 procedimentos diferentes (não Septo+Turb) | Soma individual | R$ 1.400 | ✅ |

---

## 📊 Tabela Comparativa de Cenários

| Procedimentos | Sem Regra Especial | Com Regra Especial | Economia |
|---------------|--------------------|--------------------|----------|
| 1x Septoplastia | R$ 700,00 | R$ 700,00 | R$ 0,00 (0%) |
| 1x Turbinectomia | R$ 700,00 | R$ 700,00 | R$ 0,00 (0%) |
| Septo + Turbinectomia | R$ 1.400,00 | R$ 700,00 | R$ 700,00 (50%) |
| 1x Amigdalectomia | R$ 700,00 | R$ 700,00 | R$ 0,00 (0%) |
| 2x Amigdalectomia* | R$ 1.400,00 | R$ 1.400,00 | R$ 0,00 (0%) |

*Exemplo teórico - regra especial só se aplica a Septo + Turbinectomia

---

## ⚠️ Observações Importantes

### **1. Aplicação da Regra:**
- ✅ Regra especial se aplica **apenas** para: SEPTOPLASTIA + TURBINECTOMIA
- ✅ Outros procedimentos **sempre** pagam valor individual (R$ 700 cada)
- ✅ Sistema identifica automaticamente quando aplicar

### **2. Procedimento Adenoamigdalectomia:**
- 🔍 Já é um procedimento combinado (adenoides + amígdalas)
- ✅ Valor único: R$ 700,00
- ⚠️ Não confundir com Adenoidectomia (R$ 700) + Amigdalectomia (R$ 700)

### **3. Exceções:**
- ❌ **Não há exceções** para a regra Septoplastia + Turbinectomia
- ✅ Se os dois códigos estão presentes → Sempre aplica R$ 700 total
- ⚠️ Mesmo que haja outros procedimentos ORL na mesma cirurgia

---

## 📍 Localização no Código

**Arquivo:** `src/components/DoctorPaymentRules.tsx`  
**Seção:** `HOSPITAL_MUNICIPAL_SAO_JOSE`  
**Linhas:** 2727-2771

```typescript
'HOSPITAL_MUNICIPAL_SAO_JOSE': {
  'SUELLEN FERNANDA BAGATIM': {
    doctorName: 'SUELLEN FERNANDA BAGATIM',
    rules: [
      // 5 procedimentos ORL
    ],
    multipleRule: {
      codes: ['04.04.01.048-2', '04.04.01.041-5'],
      totalValue: 700.00,
      description: 'SEPTOPLASTIA + TURBINECTOMIA - R$ 700,00 TOTAL'
    }
  }
}
```

---

## ✅ Checklist de Implementação

- [x] Médica **cadastrada** no hospital correto
- [x] 5 procedimentos ORL **adicionados**
- [x] Regra especial **configurada** (Septo + Turbinectomia)
- [x] Descrição clara **incluída**
- [x] Valor uniforme **R$ 700,00** aplicado
- [x] Exemplos práticos **criados**
- [x] Data de cadastro **registrada** (18/11/2025)
- [x] Documentação completa **gerada**
- [x] **Sem erros de linter** ✅

---

## 🎯 Resumo Executivo

| Métrica | Valor |
|---------|-------|
| **Nome da Médica** | SUELLEN FERNANDA BAGATIM |
| **Hospital** | Municipal São José (Carlópolis) |
| **Especialidade** | Otorrinolaringologia (ORL) |
| **Total de Procedimentos** | 5 |
| **Tipo de Regra** | Valor Fixo Individual + Regra de Múltiplos |
| **Valor Padrão** | R$ 700,00 |
| **Regra Especial** | Septo + Turbinectomia = R$ 700,00 total |
| **Economia Potencial** | 50% em cirurgias combinadas |

---

## 🔄 Histórico de Alterações

| Data | Tipo de Alteração | Descrição |
|------|-------------------|-----------|
| 18/11/2025 | **Cadastro Inicial** | Médica adicionada ao sistema com 5 procedimentos ORL |
| 18/11/2025 | **Regra Especial** | Implementada regra Septoplastia + Turbinectomia = R$ 700 total |
| 18/11/2025 | **Documentação** | Documentação completa criada |

---

## 💬 Observações Finais

Esta médica tem regras **simples e diretas**:
- ✅ Todos os procedimentos valem R$ 700,00
- ✅ Regra especial para Septoplastia + Turbinectomia (valor fixo total)
- ✅ Sistema baseado no Dr. HUMBERTO MOREIRA DA SILVA (oftalmologia)

**Facilidade de Manutenção:** ⭐⭐⭐⭐⭐ (5/5) - Regras muito simples

---

## 🏥 Contexto do Hospital

**Hospital Municipal São José - Carlópolis**
- 📍 Localização: Carlópolis - PR
- 🆔 ID no Sistema: 792a0316-92b4-4504-8238-491d284099a3
- 👨‍⚕️ Médicos cadastrados: 2 (THIAGO TIESSI SUZUKI + SUELLEN FERNANDA BAGATIM)
- 🎯 Especialidades: Urologia + Otorrinolaringologia

---

## 📞 Contato Técnico

**Dúvidas sobre estas regras:**
1. Verificar este documento
2. Consultar `ANALISE_SISTEMATICA_REGRAS_MEDICOS.md`
3. Ver código fonte: `src/components/DoctorPaymentRules.tsx` (linhas 2727-2771)

---

**✅ Status:** Regras Configuradas e Ativas  
**📅 Data de Criação:** 18/11/2025  
**🔄 Última Atualização:** 18/11/2025  
**👩‍⚕️ Médica:** Dra. SUELLEN FERNANDA BAGATIM  
**🏥 Hospital:** Municipal São José (Carlópolis)  
**🎯 Especialidade:** Otorrinolaringologia

---

**© 2025 SIGTAP Sync - Sistema de Gestão de Faturamento Hospitalar**

