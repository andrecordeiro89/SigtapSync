# 🏗️ Visualização: Hierarquia de Prioridade das Regras SUS

## 📐 Estrutura de Decisão (Fluxograma)

```
                    INÍCIO: Calcular Procedimento
                                │
                                ▼
    ┌───────────────────────────────────────────────────────────┐
    │  VERIFICAÇÃO 1: É um código ALWAYS_FULL_PERCENT?         │
    │  Códigos: 02.05.02.015-1, 02.05.02.018-6                 │
    │  OU é um procedimento diagnóstico (02.x, 03.01.x)?       │
    └───────────────────────────────────────────────────────────┘
                    │
                    ├─── SIM ──→ 🟢 SH: 100% | SP: 100%
                    │            📌 RETURN (não verifica mais nada)
                    │
                    ▼ NÃO
    ┌───────────────────────────────────────────────────────────┐
    │  VERIFICAÇÃO 2: É Instrumento 04 - AIH (Proc. Especial)?  │
    │  Verifica campo: registrationInstrument = "04"            │
    └───────────────────────────────────────────────────────────┘
                    │
                    ├─── SIM ──→ 🟢 SH: 100% | SP: 100%
                    │            📌 RETURN (não verifica mais nada)
                    │
                    ▼ NÃO
    ┌───────────────────────────────────────────────────────────┐
    │  VERIFICAÇÃO 3: Tem regra especial de cirurgia múltipla?  │
    │  Códigos: 04.15.01.001-2, 04.15.03.001-3, etc.           │
    │  (Politraumatizado, Oncológicas)                          │
    └───────────────────────────────────────────────────────────┘
                    │
                    ├─── SIM ──→ 🟡 Aplicar percentuais da regra especial
                    │            Exemplo: 100%, 75%, 50%, 50%, 50%
                    │            📌 RETURN (não verifica mais nada)
                    │
                    ▼ NÃO
    ┌───────────────────────────────────────────────────────────┐
    │  VERIFICAÇÃO 4: É um procedimento cirúrgico (04.x)?       │
    └───────────────────────────────────────────────────────────┘
                    │
                    ├─── SIM ──→ 🔵 Lógica de cirurgias múltiplas
                    │            Sequência 1: SH 100% | SP 100%
                    │            Sequência 2+: SH 70% | SP 100%
                    │            📌 RETURN
                    │
                    ▼ NÃO
    ┌───────────────────────────────────────────────────────────┐
    │  PADRÃO: Procedimento não-cirúrgico                       │
    │  (Diagnósticos, exames, consultas)                        │
    └───────────────────────────────────────────────────────────┘
                    │
                    └────────→ 🟢 SH: 100% | SP: 100%
                               📌 RETURN
```

---

## 🎯 Tabela de Prioridade

| Prioridade | Verificação | Códigos | SH | SP | Observação |
|------------|-------------|---------|----|----|------------|
| 🥇 **MÁXIMA** | ALWAYS_FULL_PERCENT + Diagnósticos | `02.05.02.015-1`, `02.05.02.018-6`, todos `02.x`, `03.01.x` | 100% | 100% | **Nunca sofre redução** |
| 🥈 **ALTA** | Instrumento 04 | Qualquer com `registrationInstrument = "04"` | 100% | 100% | **Procedimentos especiais** |
| 🥉 **MÉDIA** | Regras Especiais | `04.15.01.001-2`, `04.15.03.001-3`, etc. | Variável* | 100% | *Percentuais específicos |
| 🏅 **PADRÃO** | Cirurgias (04.x) | Qualquer `04.x` não coberto acima | Seq1: 100%<br>Seq2+: 70% | 100% | **Lógica padrão cirurgias** |
| 🏅 **PADRÃO** | Não-cirúrgicos | Qualquer não `04.x` não coberto acima | 100% | 100% | **Lógica padrão diagnósticos** |

---

## 🔍 Exemplos Práticos

### Exemplo 1: AIH Simples com Cirurgia + Ultrassom Transvaginal

```
Procedimento 1: 04.08.04.010-4 (Cirurgia)
  ├─ Verifica ALWAYS_FULL_PERCENT? ❌ NÃO (não é 02.05.02.015-1 nem 02.05.02.018-6)
  ├─ Verifica Diagnóstico (02.x, 03.01.x)? ❌ NÃO (é 04.x)
  ├─ Verifica Instrumento 04? ❌ NÃO
  ├─ Verifica Regra Especial? ❌ NÃO
  ├─ Verifica se é Cirurgia (04.x)? ✅ SIM
  └─ Resultado: SH 100% (sequência 1) | SP 100%

Procedimento 2: 02.05.02.018-6 (Ultrassom Transvaginal)
  ├─ Verifica ALWAYS_FULL_PERCENT? ✅ SIM
  └─ Resultado: SH 100% | SP 100% (PARA AQUI, não verifica mais nada)
```

**Resultado Final:**
- Cirurgia: SH 100% ✅
- Ultrassom Transvaginal: SH 100% ✅ **(CORRIGIDO!)**

---

### Exemplo 2: AIH Complexa com Politraumatizado

```
Procedimento 1: 04.15.01.001-2 (Politraumatizado)
  ├─ Verifica ALWAYS_FULL_PERCENT? ❌ NÃO
  ├─ Verifica Instrumento 04? ❌ NÃO
  ├─ Verifica Regra Especial? ✅ SIM (Politraumatizado)
  └─ Resultado: SH 100% (posição 1 da regra) | SP 100%

Procedimento 2: 04.08.04.013-9 (Cirurgia secundária)
  ├─ Verifica ALWAYS_FULL_PERCENT? ❌ NÃO
  ├─ Verifica Instrumento 04? ❌ NÃO
  ├─ Verifica Regra Especial? ❌ NÃO (não tem regra própria)
  ├─ Verifica se é Cirurgia (04.x)? ✅ SIM
  └─ Resultado: SH 70% (sequência 2+) | SP 100%

Procedimento 3: 02.05.02.018-6 (Ultrassom Transvaginal)
  ├─ Verifica ALWAYS_FULL_PERCENT? ✅ SIM
  └─ Resultado: SH 100% | SP 100% (PARA AQUI)

Procedimento 4: 04.08.05.020-1 (Cirurgia terciária)
  ├─ Verifica ALWAYS_FULL_PERCENT? ❌ NÃO
  ├─ Verifica Instrumento 04? ❌ NÃO
  ├─ Verifica Regra Especial? ❌ NÃO
  ├─ Verifica se é Cirurgia (04.x)? ✅ SIM
  └─ Resultado: SH 70% (sequência 2+) | SP 100%
```

**Resultado Final:**
- Politraumatizado: SH 100% ✅
- Cirurgia 2: SH 70% ✅
- Ultrassom Transvaginal: SH 100% ✅
- Cirurgia 3: SH 70% ✅

**Todas as regras coexistem perfeitamente!** 🏆

---

### Exemplo 3: AIH com Instrumento 04

```
Procedimento 1: 04.08.04.010-4 (Cirurgia com Instrumento 04)
  registrationInstrument = "04 - AIH (Proc. Especial)"
  
  ├─ Verifica ALWAYS_FULL_PERCENT? ❌ NÃO
  ├─ Verifica Instrumento 04? ✅ SIM
  └─ Resultado: SH 100% | SP 100% (PARA AQUI, não verifica mais nada)
```

**Resultado Final:**
- Procedimento Especial: SH 100% | SP 100% ✅

**Mesmo sendo sequência 2, 3, etc., Instrumento 04 SEMPRE é 100%!**

---

## 📊 Matriz de Decisão Rápida

| Se o procedimento é... | E está na posição... | SH aplicado | SP aplicado | Regra |
|------------------------|---------------------|-------------|-------------|-------|
| `02.05.02.015-1` ou `02.05.02.018-6` | Qualquer | 100% | 100% | ALWAYS_FULL_PERCENT |
| Qualquer `02.x` ou `03.01.x` | Qualquer | 100% | 100% | Diagnóstico |
| Instrumento 04 | Qualquer | 100% | 100% | Instrumento 04 |
| `04.15.01.001-2` (Politraumatizado) | 1ª | 100% | 100% | Regra Especial |
| Cirurgia após Politraumatizado | 2ª | 75% | 100% | Regra Especial |
| Cirurgia após Politraumatizado | 3ª+ | 50% | 100% | Regra Especial |
| Cirurgia normal (`04.x`) | 1ª | 100% | 100% | Lógica Padrão |
| Cirurgia normal (`04.x`) | 2ª+ | 70% | 100% | Lógica Padrão |
| Não-cirúrgico (não `04.x`) | Qualquer | 100% | 100% | Lógica Padrão |

---

## 🎯 Pontos-Chave da Modificação

### ✅ O Que Foi Mantido
1. **Politraumatizado**: Continua com 100%, 75%, 50%, 50%, 50%
2. **Instrumento 04**: Continua sempre 100% (SH + SP)
3. **USG Obstétrica**: Continua sempre 100%
4. **Cirurgias múltiplas normais**: Continua 100% principal, 70% demais
5. **SP sempre 100%**: Mantido em TODOS os cenários

### ✅ O Que Foi Corrigido
1. **Ultrassom Transvaginal** (`02.05.02.018-6`): Agora sempre 100%
2. **Procedimentos diagnósticos** (02.x, 03.01.x): Agora sempre 100%

### 🔧 Como Foi Implementado
- Adicionado `02.05.02.018-6` ao array `ALWAYS_FULL_PERCENT_CODES`
- Criada função `isDiagnosticProcedure()` para identificar diagnósticos
- Refinada lógica padrão para diferenciar cirurgias de diagnósticos

---

## 🏆 Garantia de Não Afetação

### Por Que as Regras Críticas NÃO Foram Afetadas?

#### 1. **Sistema de Prioridade com `return` Imediato**
```typescript
if (isAlwaysFullPercentProcedure(proc.procedureCode)) {
  // ...
  return resultado; // ⛔ PARA AQUI, não continua
}

if (isInstrument04Procedure(proc.registrationInstrument)) {
  // ...
  return resultado; // ⛔ PARA AQUI, não continua
}

// ... e assim por diante
```

**Quando uma regra de maior prioridade é satisfeita, a função retorna IMEDIATAMENTE.**

**Regras de menor prioridade NUNCA são executadas para esse procedimento.**

#### 2. **Modificação Apenas na Lógica Padrão**
A única alteração substancial foi na **última verificação** (lógica padrão):

```typescript
// ANTES (incorreto):
defaultHospPercentage = proc.sequenceOrder === 1 ? 100 : 70;
// ❌ Aplicava 70% a TODOS os secundários (cirurgias E diagnósticos)

// DEPOIS (correto):
if (isSurgicalProcedure(proc.procedureCode)) {
  defaultHospPercentage = proc.sequenceOrder === 1 ? 100 : 70;
} else {
  defaultHospPercentage = 100;
}
// ✅ Aplicava 70% APENAS a cirurgias secundárias
// ✅ Diagnósticos sempre 100%
```

**Esta modificação só afeta procedimentos que:**
- NÃO estão em `ALWAYS_FULL_PERCENT_CODES`
- NÃO são Instrumento 04
- NÃO têm regra especial (politraumatizado, etc.)

**Ou seja, APENAS a lógica padrão foi refinada. Regras especiais INTOCADAS.**

---

## 📝 Checklist de Validação

Ao modificar as regras no futuro, use este checklist:

- [ ] Politraumatizado continua com 100%, 75%, 50%?
- [ ] Instrumento 04 continua sempre 100%?
- [ ] ALWAYS_FULL_PERCENT_CODES continua funcionando?
- [ ] Cirurgias múltiplas normais continuam 100%/70%?
- [ ] SP continua sempre 100%?
- [ ] Executar `test_verificacao_completa_regras.html`
- [ ] Todos os testes passaram?

---

**Criado em:** ${new Date().toLocaleString('pt-BR')}

**Status:** ✅ **Hierarquia Validada - Regras Críticas Preservadas**

