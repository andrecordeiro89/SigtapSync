# 🦴 Regras de Pagamento - Dr. RENE SERPA ROUEDE

## 📋 Informações do Médico

| Campo | Valor |
|-------|-------|
| **Nome Completo** | RENE SERPA ROUEDE |
| **Hospital** | Torao Tokuda (APU - Apucarana) |
| **Especialidade** | Ortopedia - Procedimentos Artroscópicos |
| **Identificador no Sistema** | `TORAO_TOKUDA_APUCARANA` → `RENE SERPA ROUEDE` |
| **Última Atualização** | 06/11/2025 |

---

## 💰 Modelo de Pagamento

### 🎯 **Tipo de Regra: MÚLTIPLOS PROCEDIMENTOS**

O Dr. RENE SERPA ROUEDE utiliza um modelo de **valores fixos para combinações específicas de procedimentos ortopédicos**.

---

## 📊 Procedimentos Cadastrados

### **Procedimentos Individuais (3)**

| Código | Descrição | Observação |
|--------|-----------|------------|
| `04.08.01.021-5` | TRATAMENTO CIRÚRGICO DE LUXAÇÃO RECIDIVANTE / HABITUAL DE ARTICULAÇÃO ESCAPULO-UMERAL | Usado em combinação |
| `04.08.01.014-2` | REPARO DE ROTURA DO MANGUITO ROTADOR (INCLUI PROCEDIMENTOS DESCOMPRESSIVOS) | Usado em combinação |
| `04.08.06.071-9` | VIDEOARTROSCOPIA | Procedimento complementar |

⚠️ **IMPORTANTE:** Estes procedimentos **NÃO têm valor individual**. O valor é aplicado apenas quando realizados em combinação conforme as regras abaixo.

---

## 🔧 Regras de Múltiplos Procedimentos

### **Combinação 1: Luxação Recidivante + Videoartroscopia**

| Componente | Código | Descrição |
|------------|--------|-----------|
| **Procedimento Principal** | `04.08.01.021-5` | TRATAMENTO CIRÚRGICO DE LUXAÇÃO RECIDIVANTE / HABITUAL DE ARTICULAÇÃO ESCAPULO-UMERAL |
| **Procedimento Complementar** | `04.08.06.071-9` | VIDEOARTROSCOPIA |
| **Valor Total** | **R$ 500,00** | Valor fixo para a combinação |

```typescript
{
  codes: ['04.08.01.021-5', '04.08.06.071-9'],
  totalValue: 500.00,
  description: 'TRATAMENTO CIRÚRGICO DE LUXAÇÃO RECIDIVANTE + VIDEOARTROSCOPIA - R$ 500,00'
}
```

---

### **Combinação 2: Manguito Rotador + Videoartroscopia**

| Componente | Código | Descrição |
|------------|--------|-----------|
| **Procedimento Principal** | `04.08.01.014-2` | REPARO DE ROTURA DO MANGUITO ROTADOR (INCLUI PROCEDIMENTOS DESCOMPRESSIVOS) |
| **Procedimento Complementar** | `04.08.06.071-9` | VIDEOARTROSCOPIA |
| **Valor Total** | **R$ 900,00** | Valor fixo para a combinação |

```typescript
{
  codes: ['04.08.01.014-2', '04.08.06.071-9'],
  totalValue: 900.00,
  description: 'REPARO DE ROTURA DO MANGUITO ROTADOR + VIDEOARTROSCOPIA - R$ 900,00'
}
```

---

## 📐 Como Funciona o Cálculo

### **Cenário 1: Luxação Recidivante com Videoartroscopia**

```
Procedimentos Realizados:
├─ 04.08.01.021-5 (Luxação Recidivante)
└─ 04.08.06.071-9 (Videoartroscopia)

✅ Sistema identifica a combinação
✅ Aplica valor fixo: R$ 500,00
💰 Valor a Pagar: R$ 500,00
```

---

### **Cenário 2: Manguito Rotador com Videoartroscopia**

```
Procedimentos Realizados:
├─ 04.08.01.014-2 (Manguito Rotador)
└─ 04.08.06.071-9 (Videoartroscopia)

✅ Sistema identifica a combinação
✅ Aplica valor fixo: R$ 900,00
💰 Valor a Pagar: R$ 900,00
```

---

### **Cenário 3: Múltiplas Cirurgias no Mesmo Período**

```
Cirurgia 1: Luxação + Videoartroscopia = R$ 500,00
Cirurgia 2: Manguito Rotador + Videoartroscopia = R$ 900,00

💰 Total a Pagar: R$ 1.400,00
```

---

## ⚙️ Lógica de Aplicação no Sistema

### **1. Detecção de Combinação**
```javascript
// Sistema verifica se os códigos da combinação estão presentes
const temLuxacao = procedimentos.includes('04.08.01.021-5');
const temVideoartroscopia = procedimentos.includes('04.08.06.071-9');

if (temLuxacao && temVideoartroscopia) {
  valorFinal = 500.00; // Aplica regra da combinação 1
}
```

### **2. Prioridade de Aplicação**
1. ✅ **Primeiro:** Verifica se há combinação de múltiplos procedimentos
2. ✅ **Segundo:** Aplica o valor fixo da combinação
3. ❌ **NÃO aplica:** Valores individuais (são zero)

### **3. Regras de Validação**
- ✅ Ambos os procedimentos devem estar presentes
- ✅ Procedimentos devem ser da mesma AIH/internação
- ✅ Aplica valor total da combinação (não soma individuais)

---

## 🆚 Comparação: Antes vs. Depois

### **❌ Regra ANTIGA (Removida)**

```typescript
percentageRule: {
  percentage: 65,
  description: 'Produção Médica: 65% sobre valor total do médico'
}
```

**Problema:** Não tinha controle específico por procedimento ortopédico.

---

### **✅ Regra NOVA (Atual)**

```typescript
multipleRules: [
  {
    codes: ['04.08.01.021-5', '04.08.06.071-9'],
    totalValue: 500.00
  },
  {
    codes: ['04.08.01.014-2', '04.08.06.071-9'],
    totalValue: 900.00
  }
]
```

**Vantagem:** Controle total sobre procedimentos artroscópicos específicos.

---

## 📍 Localização no Código

**Arquivo:** `src/components/DoctorPaymentRules.tsx`  
**Seção:** `TORAO_TOKUDA_APUCARANA`  
**Linhas:** 1665-1701  

```typescript
'TORAO_TOKUDA_APUCARANA': {
  'RENE SERPA ROUEDE': {
    doctorName: 'RENE SERPA ROUEDE',
    rules: [
      // 3 procedimentos ortopédicos
    ],
    multipleRules: [
      // 2 combinações com valores fixos
    ]
  }
}
```

---

## ✅ Checklist de Validação

- [x] Regra antiga de percentual **removida**
- [x] Procedimentos ortopédicos **cadastrados**
- [x] Combinações de múltiplos **configuradas**
- [x] Valores fixos **definidos** (R$ 500,00 e R$ 900,00)
- [x] Descrições **detalhadas**
- [x] Documentação **criada**
- [x] Data de atualização **registrada** (06/11/2025)

---

## 🎯 Resumo Executivo

| Métrica | Valor |
|---------|-------|
| **Total de Procedimentos Individuais** | 3 |
| **Total de Combinações** | 2 |
| **Valor Mínimo** | R$ 500,00 |
| **Valor Máximo** | R$ 900,00 |
| **Tipo de Regra** | Múltiplos Procedimentos com Valores Fixos |
| **Especialidade** | Ortopedia - Artroscopia |

---

## 📞 Observações Importantes

### ⚠️ **ATENÇÃO:**

1. **Procedimentos DEVEM ser realizados em conjunto** para aplicar o valor
2. **Videoartroscopia (04.08.06.071-9)** é obrigatória em ambas as combinações
3. **Não há valor individual** para os procedimentos isolados
4. **Valores são fixos**, não percentuais

### 💡 **Sugestões de Expansão:**

Se no futuro o médico realizar outros procedimentos ortopédicos, podem ser adicionadas:
- Novas combinações de procedimentos
- Valores individuais para procedimentos isolados
- Regras especiais para casos complexos

---

## 📊 Estatísticas

| Categoria | Quantidade |
|-----------|------------|
| **Procedimentos Cadastrados** | 3 |
| **Combinações Definidas** | 2 |
| **Valor Total Máximo por Cirurgia** | R$ 900,00 |
| **Valor Total Mínimo por Cirurgia** | R$ 500,00 |
| **Diferença entre Valores** | R$ 400,00 (80% mais caro o Manguito Rotador) |

---

**✅ Status:** Regras Configuradas e Ativas  
**📅 Data de Criação:** 06/11/2025  
**🔄 Última Atualização:** 06/11/2025  
**👨‍⚕️ Médico:** Dr. RENE SERPA ROUEDE  
**🏥 Hospital:** Torao Tokuda (Apucarana - APU)

---

## 🔄 Histórico de Alterações

| Data | Tipo de Alteração | Descrição |
|------|-------------------|-----------|
| 06/11/2025 | **Reconfiguração Total** | Removida regra de percentual 65%, adicionadas regras de múltiplos procedimentos ortopédicos |
| *Anterior* | Percentual | Regra de 65% sobre valor total (removida) |

---

**© 2025 SIGTAP Sync - Sistema de Gestão de Faturamento Hospitalar**

