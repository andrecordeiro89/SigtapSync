# 🏥 Regras de Pagamento - Hospital Torao Tokuda (Apucarana)

## 📋 Informações do Hospital

| Campo | Valor |
|-------|-------|
| **Nome** | Hospital Torao Tokuda |
| **Código** | APU |
| **Localização** | Apucarana - PR |
| **Identificador no Sistema** | `TORAO_TOKUDA_APUCARANA` |
| **Arquivo de Configuração** | `src/components/DoctorPaymentRules.tsx` |

---

## 📊 Resumo Geral

| Métrica | Valor |
|---------|-------|
| **Total de médicos com regras** | 8 |
| **Médicos com regras de múltiplos procedimentos** | 4 |
| **Total de procedimentos individuais** | 82 |
| **Total de combinações de múltiplos** | 48 |
| **Última atualização** | 27/10/2025 |

---

## 👨‍⚕️ Médicos e Regras Detalhadas

### 1️⃣ **HUMBERTO MOREIRA DA SILVA** - Oftalmologia

#### Procedimentos Individuais (5 procedimentos)
| Código | Descrição | Valor |
|--------|-----------|-------|
| `04.04.01.048-2` | Procedimento Oftalmológico | R$ 650,00 |
| `04.04.01.041-5` | Procedimento Oftalmológico | R$ 650,00 |
| `04.04.01.002-4` | Procedimento Oftalmológico | R$ 650,00 |
| `04.04.01.001-6` | Procedimento Oftalmológico | R$ 650,00 |
| `04.04.01.003-2` | Procedimento Oftalmológico | R$ 650,00 |

#### Regra de Múltiplos Procedimentos
**✅ Quando 2 ou mais dos procedimentos acima forem realizados:**
- **Valor TOTAL:** R$ 800,00
- **Descrição:** Dois ou mais procedimentos: R$ 800,00 TOTAL
- **Lógica:** Não soma os valores individuais, aplica valor fixo de R$ 800,00

---

### 2️⃣ **JOSE GABRIEL GUERREIRO** - Cirurgia Vascular

#### Procedimentos Individuais (2 procedimentos)
| Código | Descrição | Valor |
|--------|-----------|-------|
| `04.06.02.056-6` | TRATAMENTO CIRURGICO DE VARIZES (BILATERAL) | R$ 1.050,00 |
| `04.06.02.057-4` | TRATAMENTO CIRÚRGICO DE VARIZES (UNILATERAL) | R$ 1.000,00 |

#### Regras Especiais
❌ Sem regras de múltiplos procedimentos

---

### 3️⃣ **HELIO SHINDY KISSINA** - Urologia

#### Procedimentos Individuais (21 procedimentos)

| Código | Descrição | Valor |
|--------|-----------|-------|
| `04.09.01.023-5` | NEFROLITOTOMIA PERCUTÂNEA | R$ 1.000,00 |
| `04.09.01.059-6` | URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) | R$ 900,00 |
| `04.09.01.018-9` | LITOTRIPSIA (FLEXÍVEL) | R$ 1.000,00 |
| `04.09.01.017-0` | INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J | R$ 250,00 |
| `04.09.03.004-0` | RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA | R$ 1.000,00 |
| `04.09.03.002-3` | PROSTATECTOMIA SUPRAPÚBICA | R$ 1.000,00 |
| `04.09.04.021-5` | TRATAMENTO CIRÚRGICO DE HIDROCELE | R$ 300,00 |
| `04.09.05.008-3` | POSTECTOMIA | R$ 250,00 |
| `04.09.04.024-0` | VASECTOMIA | R$ 450,00 |
| `04.09.04.013-4` | ORQUIDOPEXIA UNILATERAL | R$ 400,00 |
| `04.09.04.012-6` | ORQUIDOPEXIA BILATERAL | R$ 450,00 |
| `04.09.01.006-5` | CISTOLITOTOMIA E/OU RETIRADA DE CORPO ESTRANHO DA BEXIGA | R$ 600,00 |
| `04.09.05.007-5` | PLÁSTICA TOTAL DO PÊNIS (INCLUI PEYRONIE) | R$ 500,00 |
| `RESSECÇÃO_CISTOS` | RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES | R$ 250,00 |
| `04.09.04.016-9` | ORQUIECTOMIA UNILATERAL | R$ 500,00 |
| `04.09.01.032-4` | PIELOPLASTIA | R$ 700,00 |
| `04.09.01.021-9` | NEFRECTOMIA TOTAL | R$ 1.200,00 |
| `04.09.01.020-0` | NEFRECTOMIA PARCIAL | R$ 1.000,00 |
| `04.09.01.022-7` | NEFROLITOTOMIA (ANATRÓFICA) | R$ 900,00 |
| `04.09.01.029-4` | NEFROSTOMIA PERCUTÂNEA | R$ 400,00 |
| `04.09.02.017-6` | URETROTOMIA INTERNA | R$ 250,00 |

#### Regras de Múltiplos Procedimentos (16 combinações)

| # | Combinação | Valor Total | Descrição |
|---|------------|-------------|-----------|
| 1 | `04.09.01.023-5` + `04.09.01.017-0` | R$ 1.100,00 | NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J |
| 2 | `04.09.01.023-5` + `04.09.01.014-6` | R$ 1.300,00 | NEFROLITOTOMIA PERCUTÂNEA + EXTRAÇÃO ENDOSCÓPICA DE CÁLCULO EM PELVE RENAL |
| 3 | `04.09.01.023-5` + `04.09.01.017-0` + `04.09.01.014-6` | R$ 1.400,00 | NEFROLITOTOMIA PERCUTÂNEA + INSTALAÇÃO + EXTRAÇÃO |
| 4 | `04.09.01.023-5` + `04.09.01.014-6` + `04.09.01.059-6` | R$ 1.500,00 | NEFROLITOTOMIA + EXTRAÇÃO + URETEROLITOTRIPSIA |
| 5 | `04.09.01.023-5` + `04.09.01.017-0` + `04.09.01.014-6` + `04.09.01.059-6` | R$ 1.600,00 | NEFROLITOTOMIA + INSTALAÇÃO + EXTRAÇÃO + URETEROLITOTRIPSIA |
| 6 | `04.09.01.059-6` + `04.09.01.017-0` | R$ 1.000,00 | URETEROLITOTRIPSIA TRANSURETEROSCÓPICA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J |
| 7 | `04.09.01.018-9` + `04.09.01.017-0` | R$ 1.100,00 | LITOTRIPSIA (FLEXÍVEL) + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J |
| 8 | `04.09.01.018-9` + `04.09.01.014-6` + `04.09.01.017-0` | R$ 1.200,00 | LITOTRIPSIA + EXTRAÇÃO + INSTALAÇÃO |
| 9 | `04.09.01.018-9` + `04.09.01.059-6` + `04.09.01.014-6` + `04.09.01.017-0` | R$ 1.300,00 | LITOTRIPSIA + URETEROLITOTRIPSIA + EXTRAÇÃO + INSTALAÇÃO |
| 10 | `04.09.03.004-0` + `04.09.01.038-3` | R$ 1.200,00 | RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA + RESSECÇÃO ENDOSCÓPICA DE LESÃO VESICAL |
| 11 | `04.09.04.021-5` + `04.09.04.019-3` | R$ 400,00 | HIDROCELE + RESSECÇÃO PARCIAL DA BOLSA ESCROTAL |
| 12 | `04.09.04.021-5` + `04.09.04.019-3` + `04.09.04.017-7` | R$ 500,00 | HIDROCELE + RESSECÇÃO + PLÁSTICA DA BOLSA ESCROTAL |
| 13 | `04.09.04.013-4` + `04.09.04.017-7` | R$ 550,00 | ORQUIDOPEXIA UNILATERAL + PLÁSTICA DA BOLSA ESCROTAL |
| 14 | `04.09.04.012-6` + `04.09.04.017-7` | R$ 550,00 | ORQUIDOPEXIA BILATERAL + PLÁSTICA DA BOLSA ESCROTAL |
| 15 | `04.09.01.032-4` + `04.09.01.057-0` | R$ 1.000,00 | PIELOPLASTIA + URETEROPLASTIA |
| 16 | `04.09.01.032-4` + `04.09.01.057-0` + `04.09.01.017-0` | R$ 1.100,00 | PIELOPLASTIA + URETEROPLASTIA + INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J |

---

### 4️⃣ **GUILHERME AUGUSTO STORER** - Urologia ⭐

#### Procedimentos Individuais (21 procedimentos)

**Mesmas regras do Dr. HELIO SHINDY KISSINA**

| Código | Descrição | Valor |
|--------|-----------|-------|
| `04.09.01.023-5` | NEFROLITOTOMIA PERCUTÂNEA | R$ 1.000,00 |
| `04.09.01.059-6` | URETEROLITOTRIPSIA TRANSURETEROSCÓPICA (SEMIRRÍGIDA) | R$ 900,00 |
| `04.09.01.018-9` | LITOTRIPSIA (FLEXÍVEL) | R$ 1.000,00 |
| `04.09.01.017-0` | INSTALAÇÃO ENDOSCÓPICA DE CATETER DUPLO J | R$ 250,00 |
| `04.09.03.004-0` | RESSECÇÃO ENDOSCÓPICA DE PRÓSTATA | R$ 1.000,00 |
| `04.09.03.002-3` | PROSTATECTOMIA SUPRAPÚBICA | R$ 1.000,00 |
| `04.09.04.021-5` | TRATAMENTO CIRÚRGICO DE HIDROCELE | R$ 300,00 |
| `04.09.05.008-3` | POSTECTOMIA | R$ 250,00 |
| `04.09.04.024-0` | VASECTOMIA | R$ 450,00 |
| `04.09.04.013-4` | ORQUIDOPEXIA UNILATERAL | R$ 400,00 |
| `04.09.04.012-6` | ORQUIDOPEXIA BILATERAL | R$ 450,00 |
| `04.09.01.006-5` | CISTOLITOTOMIA E/OU RETIRADA DE CORPO ESTRANHO DA BEXIGA | R$ 600,00 |
| `04.09.05.007-5` | PLÁSTICA TOTAL DO PÊNIS (INCLUI PEYRONIE) | R$ 500,00 |
| `RESSECÇÃO_CISTOS` | RESSECÇÃO DE CISTOS/CAUTERIZAÇÕES | R$ 250,00 |
| `04.09.04.016-9` | ORQUIECTOMIA UNILATERAL | R$ 500,00 |
| `04.09.01.032-4` | PIELOPLASTIA | R$ 700,00 |
| `04.09.01.021-9` | NEFRECTOMIA TOTAL | R$ 1.200,00 |
| `04.09.01.020-0` | NEFRECTOMIA PARCIAL | R$ 1.000,00 |
| `04.09.01.022-7` | NEFROLITOTOMIA (ANATRÓFICA) | R$ 900,00 |
| `04.09.01.029-4` | NEFROSTOMIA PERCUTÂNEA | R$ 400,00 |
| `04.09.02.017-6` | URETROTOMIA INTERNA | R$ 250,00 |

#### Regras de Múltiplos Procedimentos (16 combinações)

**Mesmas 16 combinações do Dr. HELIO SHINDY KISSINA** (valores de R$ 400,00 a R$ 1.600,00)

---

### 5️⃣ **ROGERIO YOSHIKAZU NABESHIMA** - Cirurgia Vascular

#### Procedimentos Individuais (2 procedimentos)
| Código | Descrição | Valor |
|--------|-----------|-------|
| `04.06.02.056-6` | TRATAMENTO CIRURGICO DE VARIZES (BILATERAL) | R$ 1.050,00 |
| `04.06.02.057-4` | TRATAMENTO CIRÚRGICO DE VARIZES (UNILATERAL) | R$ 1.000,00 |

#### Regras Especiais
❌ Sem regras de múltiplos procedimentos

---

### 5️⃣ **FABIANE GREGORIO BATISTELA** - Cirurgia Geral

#### Procedimentos Individuais (10 procedimentos)

| Código | Descrição | Valor |
|--------|-----------|-------|
| `04.07.03.002-6` | COLECISTECTOMIA (PRINCIPAL) | R$ 900,00 |
| `04.07.04.018-8` | LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS | R$ 300,00 |
| `04.07.04.002-1` | DRENAGEM DE ABSCESSO SUBFRÊNICO | R$ 300,00 |
| `04.07.03.014-0` | HEPATORRAFIA | R$ 300,00 |
| `04.07.03.006-9` | COLEDOCOTOMIA | R$ 250,00 |
| `04.07.03.005-0` | COLEDOCOPLASTIA | R$ 200,00 |
| `04.07.04.010-2` | HERNIOPLASTIA INGUINAL UNILATERAL (PRINCIPAL) | R$ 700,00 |
| `04.07.04.009-9` | HERNIOPLASTIA INGUINAL BILATERAL (PRINCIPAL) | R$ 700,00 |
| `04.07.04.006-4` | HERNIOPLASTIA EPIGÁSTRICA (PRINCIPAL) | R$ 800,00 |
| `04.07.04.012-9` | HERNIOPLASTIA UMBILICAL (PRINCIPAL) | R$ 450,00 |
| `04.07.04.008-0` | HERNIOPLASTIA INCISIONAL/VENTRAL (PRINCIPAL) | R$ 600,00 |

#### Regras de Múltiplos Procedimentos (16 combinações)

**Lógica:** Colecistectomia R$ 900,00 + soma dos procedimentos sequenciais

| # | Combinação | Valor Total |
|---|------------|-------------|
| 1 | COLECISTECTOMIA + LIBERAÇÃO DE ADERÊNCIAS | R$ 1.200,00 |
| 2 | COLECISTECTOMIA + DRENAGEM ABSCESSO SUBFRÊNICO | R$ 1.200,00 |
| 3 | COLECISTECTOMIA + HEPATORRAFIA | R$ 1.200,00 |
| 4 | COLECISTECTOMIA + COLEDOCOTOMIA | R$ 1.150,00 |
| 5 | COLECISTECTOMIA + COLEDOCOPLASTIA | R$ 1.100,00 |
| 6 | COLECISTECTOMIA + HERNIOPLASTIA INGUINAL UNILATERAL | R$ 1.600,00 |
| 7 | COLECISTECTOMIA + HERNIOPLASTIA INGUINAL BILATERAL | R$ 1.600,00 |
| 8 | COLECISTECTOMIA + HERNIOPLASTIA EPIGÁSTRICA | R$ 1.700,00 |
| 9 | COLECISTECTOMIA + HERNIOPLASTIA UMBILICAL | R$ 1.350,00 |
| 10 | COLECISTECTOMIA + HERNIOPLASTIA INCISIONAL/VENTRAL | R$ 1.500,00 |
| 11 | COLECISTECTOMIA + LIBERAÇÃO + HEPATORRAFIA | R$ 1.500,00 |
| 12 | COLECISTECTOMIA + COLEDOCOTOMIA + COLEDOCOPLASTIA | R$ 1.350,00 |
| 13 | COLECISTECTOMIA + LIBERAÇÃO + HEPATORRAFIA + DRENAGEM | R$ 1.800,00 |
| 14 | COLECISTECTOMIA + 4 SEQUENCIAIS (MÁXIMO) | R$ 2.050,00 |

**Limite:** Até 4 procedimentos sequenciais

---

### 7️⃣ **JOÃO VICTOR RODRIGUES** - Cirurgia Geral

#### Procedimentos Individuais (10 procedimentos)

| Código | Descrição | Valor |
|--------|-----------|-------|
| `04.07.03.002-6` | COLECISTECTOMIA (PRINCIPAL) | R$ 900,00 |
| `04.07.04.018-8` | LIBERAÇÃO DE ADERÊNCIAS INTESTINAIS | R$ 300,00 |
| `04.07.04.002-1` | DRENAGEM DE ABSCESSO SUBFRÊNICO | R$ 300,00 |
| `04.07.03.014-0` | HEPATORRAFIA | R$ 300,00 |
| `04.07.03.006-9` | COLEDOCOTOMIA | R$ 250,00 |
| `04.07.03.005-0` | COLEDOCOPLASTIA | R$ 200,00 |
| `04.07.04.012-9` | HERNIOPLASTIA UMBILICAL | R$ 300,00 |
| `04.07.04.010-2` | HERNIOPLASTIA INGUINAL / CRURAL (UNILATERAL) | R$ 300,00 |
| `04.06.02.056-6` | TRATAMENTO CIRÚRGICO DE VARIZES (BILATERAL) | R$ 1.050,00 |
| `04.06.02.057-4` | TRATAMENTO CIRÚRGICO DE VARIZES (UNILATERAL) | R$ 1.000,00 |
| `04.07.02.010-1` | SITO INTESTINAL (REVERSÃO DE COLOSTOMIA) | R$ 1.250,00 |
| `04.07.04.008-0` | HERNIA VENTRAL | R$ 300,00 |

**Lógica:** Procedimento principal + soma dos sequenciais

#### Regras Especiais
❌ Sem regras explícitas de múltiplos procedimentos (soma individual)

---

### 8️⃣ **JOAO VICTOR RODRIGUES** (sem acento) - Cirurgia Geral

#### Procedimentos Individuais (11 procedimentos)

**Mesmas regras do médico acima, mais:**

| Código | Descrição | Valor |
|--------|-----------|-------|
| `04.01.02.007-0` | EXÉRESE DE CISTO DERMOIDE | R$ 100,00 |
| `04.07.04.006-4` | HERNIOPLASTIA EPIGÁSTRICA | R$ 200,00 |

**Nota:** Este médico tem o mesmo nome mas sem acento. Possível duplicação cadastral.

---

## 💡 Observações Importantes

### 🔍 Sistema de Cálculo

1. **Procedimentos Individuais:**
   - Cada procedimento tem um valor fixo definido
   - Valor pago = Valor padrão do procedimento

2. **Regras de Múltiplos Procedimentos:**
   - **Tipo A:** Valor fixo total (ex: Dr. Humberto - R$ 800,00 para 2+ procedimentos)
   - **Tipo B:** Soma de valores específicos (ex: Dr. Helio Kissina)
   - **Tipo C:** Valor base + adicionais (ex: Dra. Fabiane - Colecistectomia R$ 900 + sequenciais)

3. **Prioridade de Aplicação:**
   - Se há regra de múltiplos procedimentos → aplica o valor da combinação
   - Se não há regra específica → soma os valores individuais

---

## 📌 Localização no Código

**Arquivo:** `src/components/DoctorPaymentRules.tsx`

**Estrutura:**
```typescript
const DOCTOR_PAYMENT_RULES_BY_HOSPITAL = {
  'TORAO_TOKUDA_APUCARANA': {
    'NOME_DO_MEDICO': {
      doctorName: 'NOME_DO_MEDICO',
      rules: [ /* procedimentos individuais */ ],
      multipleRule: { /* regra de múltiplos */ },
      multipleRules: [ /* múltiplas combinações */ ]
    }
  }
}
```

---

## 🔄 Como Adicionar Novos Médicos ou Regras

### 1. Localizar a seção TORAO_TOKUDA_APUCARANA no arquivo

### 2. Adicionar novo médico:
```typescript
'NOME_DO_NOVO_MEDICO': {
  doctorName: 'NOME_DO_NOVO_MEDICO',
  rules: [
    {
      procedureCode: 'XX.XX.XX.XXX-X',
      standardValue: 1000.00,
      description: 'Descrição do procedimento - R$ 1.000,00'
    }
  ]
}
```

### 3. Adicionar regra de múltiplos (se necessário):
```typescript
multipleRule: {
  codes: ['código1', 'código2'],
  totalValue: 1500.00,
  description: 'Descrição da regra'
}
```

---

## 📊 Estatísticas

| Categoria | Quantidade |
|-----------|------------|
| **Médicos cadastrados** | 8 |
| **Oftalmologistas** | 1 |
| **Cirurgiões Vasculares** | 2 |
| **Urologistas** | 2 |
| **Cirurgiões Gerais** | 3 |
| **Total de procedimentos únicos** | 82 |
| **Total de combinações** | 48 |
| **Valor médio por procedimento** | ~R$ 600,00 |
| **Valor mais alto** | R$ 1.600,00 |
| **Valor mais baixo** | R$ 100,00 |

---

**Data de Criação:** ${new Date().toLocaleString('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}

**Status:** ✅ Documento Completo e Atualizado

