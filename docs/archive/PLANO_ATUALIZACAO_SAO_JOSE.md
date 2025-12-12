# 📋 PLANO DE ATUALIZAÇÃO - HOSPITAL MUNICIPAL SÃO JOSÉ

## 🎯 **OBJETIVO**
Adicionar regras de pagamento para procedimentos urológicos com valores para procedimento principal e secundário/sequencial.

---

## 👨‍⚕️ **MÉDICO 1: THIAGO TIESSI SUZUKI** (Linha 2895)

### ✅ **ATUALIZAR** (adicionar `secondaryValue`)

1. **04.09.01.059-6** - URETEROLITOTRIPSIA
   - Linha atual: ~2913-2916
   - Adicionar: `secondaryValue: 200.00`
   - Atualizar description

2. **04.09.01.018-9** - LITOTRIPSIA
   - Linha atual: ~2918-2921
   - Adicionar: `secondaryValue: 200.00`
   - Atualizar description

3. **04.09.01.017-0** - CATETER DUPLO J
   - Linha atual: ~2923-2926
   - Adicionar: `secondaryValue: 100.00`
   - Atualizar description

4. **04.09.04.021-5** - HIDROCELE
   - Linha atual: ~2938-2941
   - Adicionar: `secondaryValue: 225.00`
   - Atualizar description

5. **04.09.01.006-5** - CISTOLITOTOMIA
   - Linha atual: ~2963-2966
   - Adicionar: `secondaryValue: 375.00`
   - Atualizar description

6. **04.09.01.032-4** - PIELOPLASTIA
   - Linha atual: ~2983-2986
   - Adicionar: `secondaryValue: 200.00`
   - Atualizar description

### ➕ **ADICIONAR NOVOS PROCEDIMENTOS**

Adicionar ANTES do fechamento de `rules: [...]`:

```typescript
{
  procedureCode: '04.09.07.025-4',
  standardValue: 800.00,
  secondaryValue: 400.00,
  description: 'TRATAMENTO CIRÚRGICO DE FÍSTULA VESICO-VAGINAL - Principal: R$ 800,00 | Secundário: R$ 400,00'
},
{
  procedureCode: '04.09.02.007-9',
  standardValue: 250.00,
  secondaryValue: 200.00,
  description: 'MEATOTOMIA SIMPLES - Principal: R$ 250,00 | Sequencial: R$ 200,00'
},
{
  procedureCode: '04.09.01.038-3',
  standardValue: 200.00,
  description: 'RESSECÇÃO ENDOSCÓPICA DE LESÃO VESICAL - R$ 200,00'
},
{
  procedureCode: '04.01.02.005-3',
  standardValue: 150.00,
  description: 'EXCISÃO E SUTURA DE LESÃO NA PELE C/ PLÁSTICA EM Z OU ROTAÇÃO DE RETALHO - R$ 150,00'
},
{
  procedureCode: '04.09.01.009-0',
  standardValue: 250.00,
  description: 'CISTOSTOMIA - R$ 250,00'
}
```

---

## 👨‍⚕️ **MÉDICO 2: VITOR BRANDANI GARBELINI** (Linha 3183)

### ✅ **ATUALIZAR** (adicionar `secondaryValue`)

1. **04.09.01.059-6** - URETEROLITOTRIPSIA
   - Linha atual: ~3198-3201
   - Adicionar: `secondaryValue: 200.00`
   - Atualizar description

2. **04.09.04.021-5** - HIDROCELE
   - Linha atual: ~3237-3240
   - Adicionar: `secondaryValue: 225.00`
   - Atualizar description

3. **04.09.01.006-5** - CISTOLITOTOMIA
   - Linha atual: ~3267-3270
   - Adicionar: `secondaryValue: 375.00`
   - Atualizar description

### ➕ **ADICIONAR NOVOS PROCEDIMENTOS**

Adicionar APÓS o procedimento 04.09.07.025-4 (que já existe na linha ~3329-3334):

```typescript
{
  procedureCode: '04.09.02.007-9',
  standardValue: 250.00,
  secondaryValue: 200.00,
  description: 'MEATOTOMIA SIMPLES - Principal: R$ 250,00 | Sequencial: R$ 200,00'
},
{
  procedureCode: '04.09.01.038-3',
  standardValue: 200.00,
  description: 'RESSECÇÃO ENDOSCÓPICA DE LESÃO VESICAL - R$ 200,00'
},
{
  procedureCode: '04.01.02.005-3',
  standardValue: 150.00,
  description: 'EXCISÃO E SUTURA DE LESÃO NA PELE C/ PLÁSTICA EM Z OU ROTAÇÃO DE RETALHO - R$ 150,00'
},
{
  procedureCode: '04.09.01.009-0',
  standardValue: 250.00,
  description: 'CISTOSTOMIA - R$ 250,00'
}
```

---

## ⚠️ **OBSERVAÇÃO IMPORTANTE**

**MEATOTOMIA (04.09.02.007-9)** aparece DUAS VEZES na lista do usuário com valores diferentes:
- 1ª ocorrência: R$ 150 secondary
- 2ª ocorrência: R$ 200 secondary

**DECISÃO**: Usar **R$ 200 secondary** (segunda ocorrência)

---

## ✅ **CHECKLIST DE EXECUÇÃO**

### THIAGO TIESSI SUZUKI:
- [ ] Atualizar 6 procedimentos com secondaryValue
- [ ] Adicionar 5 novos procedimentos
- [ ] Verificar sintaxe (vírgulas, chaves)
- [ ] Testar linter

### VITOR BRANDANI GARBELINI:
- [ ] Atualizar 3 procedimentos com secondaryValue
- [ ] Adicionar 4 novos procedimentos
- [ ] Verificar sintaxe (vírgulas, chaves)
- [ ] Testar linter

---

## 🎯 **RESULTADO ESPERADO**

**THIAGO**: 27 procedimentos totais (22 existentes + 5 novos)
**VITOR**: 26 procedimentos totais (22 existentes + 4 novos)

---

**Pronto para executar?** ✅

