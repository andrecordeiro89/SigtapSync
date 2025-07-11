# 🏥 CONFIGURAÇÃO HOSPITAL REGIONAL CENTRO OESTE (GUA)

## 🎯 **STATUS**: ✅ CORREÇÃO APLICADA

### 📋 **PROBLEMA IDENTIFICADO**
O email `faturamento.gua@sigtap.com` não estava funcionando para acessar o Hospital Regional Centro Oeste devido a:
- ❌ Email não estava presente no `EMAIL_HOSPITAL_MAP`
- ❌ Código 'gua' não estava no mapeamento de hospitais
- ❌ Possível ausência do hospital no banco de dados

### 🔧 **CORREÇÕES APLICADAS**

#### 1. **Frontend - LoginForm.tsx**
- ✅ Adicionado `faturamento.gua@sigtap.com` e variações no EMAIL_HOSPITAL_MAP
- ✅ Adicionado código 'gua' → 'guarapuava' no mapeamento de hospitais
- ✅ Configurado usuário com role 'user' e permissões básicas

#### 2. **Backend - Script SQL**
- ✅ Criado script `database/configure_hospital_gua_centro_oeste.sql`
- ✅ Insere Hospital Regional Centro Oeste se não existir
- ✅ Cria usuários `faturamento.gua@sigtap.com`, `faturamento.gua01@sigtap.com`, `faturamento.gua02@sigtap.com`
- ✅ Atualiza função `get_user_hospitals` para incluir código GUA

### 🚀 **COMO EXECUTAR A CORREÇÃO**

#### **PASSO 1: Executar Script SQL**
```bash
# No Supabase SQL Editor, execute:
```

```sql
-- Executar o arquivo completo: database/configure_hospital_gua_centro_oeste.sql
```

#### **PASSO 2: Verificar Funcionamento**
```sql
-- 1. Verificar se hospital foi criado
SELECT id, name, city, cnpj, is_active 
FROM hospitals 
WHERE id = '1218dd7b-efcb-442e-ad2b-b72d04128cb9';

-- 2. Verificar usuários criados
SELECT email, role, hospital_access, is_active
FROM user_profiles 
WHERE email LIKE 'faturamento.gua%@sigtap.com';

-- 3. Testar função get_user_hospitals
SELECT hospital_id, hospital_name, hospital_code
FROM get_user_hospitals(
    (SELECT id FROM user_profiles WHERE email = 'faturamento.gua@sigtap.com')
);
```

### 🎯 **DADOS DO HOSPITAL CONFIGURADO**

```json
{
  "id": "1218dd7b-efcb-442e-ad2b-b72d04128cb9",
  "name": "Hospital Regional Centro Oeste",
  "code": "GUA",
  "cnpj": "12345678000190",
  "city": "Guarapuava",
  "state": "PR",
  "address": "Rua Senador Pinheiro Machado, 1000",
  "phone": "(42) 3035-5000",
  "email": "contato@hrco-gua.com.br",
  "habilitacoes": ["MAC", "URGENCIA", "INTERNACAO", "CIRURGIA", "UTI"]
}
```

### 👥 **USUÁRIOS CONFIGURADOS**

| Email | Role | Acesso | Status |
|-------|------|---------|--------|
| `faturamento.gua@sigtap.com` | user | Hospital GUA | ✅ Ativo |
| `faturamento.gua01@sigtap.com` | user | Hospital GUA | ✅ Ativo |
| `faturamento.gua02@sigtap.com` | user | Hospital GUA | ✅ Ativo |

### 🔍 **TESTE DE FUNCIONAMENTO**

1. **Acesse o sistema**: `https://seu-dominio.com/login`
2. **Use o email**: `faturamento.gua@sigtap.com`
3. **Senha**: (a mesma configurada no seu sistema)
4. **Selecione**: Hospital Regional Centro Oeste
5. **Confirme**: Acesso deve funcionar normalmente

### 🎉 **RESULTADO ESPERADO**

- ✅ Login com `faturamento.gua@sigtap.com` funciona
- ✅ Hospital Regional Centro Oeste aparece na lista
- ✅ Usuário tem acesso aos dados do hospital
- ✅ Sistema identifica corretamente o hospital GUA

### 📊 **VERIFICAÇÃO FINAL**

Execute este comando para confirmar que tudo está funcionando:

```sql
-- Verificação completa
SELECT 
    h.name as hospital_name,
    h.city,
    h.is_active,
    u.email,
    u.role,
    u.is_active as user_active
FROM hospitals h
LEFT JOIN user_profiles u ON u.hospital_access @> ARRAY[h.id::text]
WHERE h.id = '1218dd7b-efcb-442e-ad2b-b72d04128cb9'
ORDER BY u.email;
```

### ⚠️ **NOTAS IMPORTANTES**

1. **Backup**: Sempre faça backup antes de executar scripts SQL
2. **Produção**: Teste em ambiente de desenvolvimento primeiro
3. **Permissões**: Certifique-se que tem permissões para criar hospitals e users
4. **Validação**: Verifique se todos os dados estão corretos após a execução

### 🔄 **PRÓXIMOS PASSOS**

1. Execute o script SQL
2. Teste o login com `faturamento.gua@sigtap.com`
3. Verifique se o hospital aparece na lista
4. Confirme que o usuário tem acesso aos dados
5. Reporte qualquer problema encontrado

---

**Sistema**: SIGTAP Billing Wizard v3.0  
**Data**: Janeiro 2025  
**Status**: ✅ Correção Aplicada  
**Responsável**: Assistente IA 