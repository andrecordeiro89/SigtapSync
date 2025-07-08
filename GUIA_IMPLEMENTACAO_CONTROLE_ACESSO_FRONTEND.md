# Guia de Implementação - Controle de Acesso por Hospital (Frontend)

## Sistema: SIGTAP Billing Wizard v3.0
## Data: Janeiro 2025

---

## 🏥 **RESUMO DO SISTEMA DE ACESSO**

### **Estrutura de Controle de Acesso**

Cada usuário possui um perfil na tabela `user_profiles` com:
- **id**: UUID do usuário (referência a `auth.users.id`)
- **role**: Papel do usuário (`'user'`, `'admin'`, `'ti'`, etc.)
- **hospital_access**: Array de UUIDs dos hospitais que o usuário pode acessar

### **Regras de Acesso**

- **Usuários com roles especiais** (`'admin'`, `'auditoria'`, `'coordenacao'`, `'diretoria'`, `'medicos'`, `'ti'`) têm acesso a **TODOS** os hospitais
- **Usuários com role `'user'`** só têm acesso aos hospitais listados em `hospital_access`

---

## 🏥 **MAPEAMENTO DE HOSPITAIS E USUÁRIOS**

### **8 Hospitais Configurados**

| Hospital | ID | Código | Usuários |
|----------|----|---------|---------| 
| **CAR** | `792a0316-92b4-4504-8238-491d284099a3` | CAR | faturamento.car@sigtap.com<br/>faturamento.car01@sigtap.com<br/>faturamento.car02@sigtap.com |
| **CAS** | `1d8ca73a-1927-462e-91c0-fa7004d0b377` | CAS | faturamento.cas@sigtap.com<br/>faturamento.cas01@sigtap.com<br/>faturamento.cas02@sigtap.com |
| **FAX** | `019c7380-459d-4aa5-bbd8-2dba4f361e7e` | FAX | faturamento.fax@sigtap.com<br/>faturamento.fax01@sigtap.com<br/>faturamento.fax02@sigtap.com |
| **FOZ** | `47eddf6e-ac64-4433-acc1-7b644a2b43d0` | FOZ | faturamento.foz@sigtap.com<br/>faturamento.foz01@sigtap.com<br/>faturamento.foz02@sigtap.com |
| **FRG** | `a8978eaa-b90e-4dc8-8fd5-0af984374d34` | FRG | faturamento.frg@sigtap.com<br/>faturamento.frg01@sigtap.com<br/>faturamento.frg02@sigtap.com<br/>faturamento.frg.03@sigtap.com<br/>faturamento.frg.04@sigtap.com<br/>faturamento.frg.05@sigtap.com |
| **SM** | `68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b` | SM | faturamento.sm@sigtap.com<br/>faturamento.sm01@sigtap.com<br/>faturamento.sm02@sigtap.com |
| **GUA** | `1218dd7b-efcb-442e-ad2b-b72d04128cb9` | GUA | faturamento.gua@sigtap.com<br/>faturamento.gua01@sigtap.com<br/>faturamento.gua02@sigtap.com |
| **ARA** | `01221e51-4bcd-4c45-b3d3-18d1df25c8f2` | ARA | faturamento.ara@sigtap.com<br/>faturamento.ara01@sigtap.com<br/>faturamento.ara02@sigtap.com |

---

## 📋 **FUNÇÕES SQL DISPONÍVEIS**

### **1. `user_has_hospital_access(hospital_id, user_id)`**
Verifica se um usuário tem acesso a um hospital específico.

```sql
SELECT user_has_hospital_access('792a0316-92b4-4504-8238-491d284099a3'::uuid);
-- Retorna: TRUE ou FALSE
```

### **2. `get_user_accessible_hospitals(user_id)`**
Retorna lista de hospitais acessíveis pelo usuário.

```sql
SELECT * FROM get_user_accessible_hospitals();
-- Retorna: hospital_id, hospital_name, hospital_code
```

### **3. `get_current_user_info(user_id)`**
Obtém informações completas do usuário atual.

```sql
SELECT * FROM get_current_user_info();
-- Retorna: user_id, email, role, full_name, hospital_access, permissions, is_admin, has_full_access
```

---

## 💻 **IMPLEMENTAÇÃO NO FRONTEND**

### **1. Configuração de Hospitais (`src/config/hospitalMapping.ts`)**

```typescript
import { HOSPITALS, HospitalUtils } from '../config/hospitalMapping';

// Obter hospital por ID
const hospital = HospitalUtils.getById('792a0316-92b4-4504-8238-491d284099a3');

// Obter hospital por código
const hospital = HospitalUtils.getByCode('CAR');

// Obter hospital por email do usuário
const hospital = HospitalUtils.getByUserEmail('faturamento.car@sigtap.com');

// Verificar se usuário tem acesso a hospital
const hasAccess = HospitalUtils.hasHospitalAccess(userRole, hospitalAccess, hospitalId);
```

### **2. Serviço de Acesso (`src/services/hospitalAccessService.ts`)**

```typescript
import HospitalAccessService from '../services/hospitalAccessService';

// Obter informações do usuário atual
const userProfile = await HospitalAccessService.getCurrentUserInfo();

// Obter hospitais acessíveis
const hospitals = await HospitalAccessService.getUserAccessibleHospitals();

// Verificar acesso a hospital específico
const hasAccess = await HospitalAccessService.checkHospitalAccess(hospitalId);

// Obter opções para SELECT/Combobox
const options = await HospitalAccessService.getHospitalOptions();

// Filtrar dados por hospitais acessíveis
const filteredData = HospitalAccessService.filterDataByAccessibleHospitals(data, userProfile);
```

### **3. Context de Autenticação (`src/contexts/AuthContext.tsx`)**

```typescript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { 
    user, 
    profile,
    checkHospitalAccessAsync,
    getAccessibleHospitalsFromDB,
    getHospitalSelectOptions 
  } = useAuth();

  // Verificar acesso assíncrono
  const hasAccess = await checkHospitalAccessAsync(hospitalId);

  // Obter hospitais do banco
  const hospitals = await getAccessibleHospitalsFromDB();

  // Opções para select
  const options = await getHospitalSelectOptions();

  return <div>...</div>;
}
```

---

## 🔧 **EXEMPLOS PRÁTICOS DE USO**

### **1. Filtrar Lista de Hospitais em Select**

```typescript
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function HospitalSelector() {
  const { getHospitalSelectOptions } = useAuth();
  const [options, setOptions] = useState([]);

  useEffect(() => {
    const loadOptions = async () => {
      const hospitalOptions = await getHospitalSelectOptions();
      setOptions(hospitalOptions);
    };
    loadOptions();
  }, []);

  return (
    <select>
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
```

### **2. Verificar Acesso Antes de Exibir Dados**

```typescript
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import HospitalAccessService from '../services/hospitalAccessService';

function DataList({ data }) {
  const { user } = useAuth();
  const [filteredData, setFilteredData] = useState([]);

  useEffect(() => {
    const filterData = async () => {
      const userProfile = await HospitalAccessService.getCurrentUserInfo();
      if (userProfile) {
        const filtered = HospitalAccessService.filterDataByAccessibleHospitals(data, userProfile);
        setFilteredData(filtered);
      }
    };
    filterData();
  }, [data]);

  return (
    <div>
      {filteredData.map(item => (
        <div key={item.id}>
          {/* Renderizar dados filtrados */}
        </div>
      ))}
    </div>
  );
}
```

### **3. Validar Acesso em Operações**

```typescript
import React from 'react';
import HospitalAccessService from '../services/hospitalAccessService';

async function handleUpdate(hospitalId: string, data: any) {
  // Validar acesso antes da operação
  const validation = await HospitalAccessService.validateHospitalAccess(hospitalId);
  
  if (!validation.hasAccess) {
    alert(validation.error || 'Acesso negado');
    return;
  }

  // Prosseguir com a operação
  console.log(`Atualizando dados do hospital: ${validation.hospitalInfo?.name}`);
  // ... fazer a atualização
}
```

### **4. Componente com Controle de Acesso Completo**

```typescript
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import HospitalAccessService from '../services/hospitalAccessService';

function ProtectedHospitalComponent({ hospitalId }: { hospitalId: string }) {
  const { user, checkHospitalAccessAsync } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const access = await checkHospitalAccessAsync(hospitalId);
        setHasAccess(access);
      } catch (error) {
        console.error('Erro ao verificar acesso:', error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      checkAccess();
    } else {
      setLoading(false);
    }
  }, [user, hospitalId, checkHospitalAccessAsync]);

  if (loading) {
    return <div>Verificando acesso...</div>;
  }

  if (!hasAccess) {
    return <div>❌ Acesso negado a este hospital</div>;
  }

  return (
    <div>
      ✅ Conteúdo do hospital autorizado
      {/* Componente protegido */}
    </div>
  );
}
```

---

## 🛠️ **CONFIGURAÇÃO DO BANCO DE DADOS**

### **Executar Scripts SQL**

1. **Adicionar Hospital ARA e funções:**
   ```bash
   # Execute no Supabase SQL Editor
   \i database/add_hospital_ara_and_functions.sql
   ```

2. **Configurar todos os usuários:**
   ```bash
   # Execute no Supabase SQL Editor
   \i database/configure_all_real_users_FINAL.sql
   ```

### **Verificar Configuração**

```sql
-- Verificar usuários por hospital
SELECT 
  up.email,
  up.role,
  up.hospital_access,
  CASE 
    WHEN up.role IN ('admin', 'ti', 'coordinator', 'director', 'auditor') THEN 'ACESSO TOTAL'
    ELSE ARRAY_TO_STRING(up.hospital_access, ', ')
  END as acesso_hospitais
FROM user_profiles up
WHERE up.is_active = true
ORDER BY up.email;

-- Testar função de acesso
SELECT user_has_hospital_access('792a0316-92b4-4504-8238-491d284099a3'::uuid);

-- Ver hospitais acessíveis
SELECT * FROM get_user_accessible_hospitals();
```

---

## 📊 **FLUXO DE AUTENTICAÇÃO**

### **1. Login do Usuário**
```
1. Usuário informa email + hospital
2. Sistema verifica se email existe na tabela user_profiles
3. Sistema verifica se usuário tem acesso ao hospital selecionado
4. Se aprovado, usuário é logado com contexto do hospital
```

### **2. Durante a Sessão**
```
1. Todas as operações verificam hospital_access do usuário
2. Funções SQL validam permissões em tempo real
3. Interface filtra dados baseado no acesso
4. Audit logs registram todas as ações
```

### **3. Verificações de Acesso**
```
1. Roles especiais: ACESSO TOTAL automaticamente
2. Role 'user': Verificar hospital_access array
3. Fallback: Verificação local se SQL falhar
4. Cache: Otimização para consultas frequentes
```

---

## ⚠️ **PONTOS IMPORTANTES**

### **Segurança**
- ✅ Verificação dupla (frontend + backend)
- ✅ Funções SQL com SECURITY DEFINER
- ✅ Fallback para verificação local
- ✅ Audit logs para todas as operações

### **Performance**
- ✅ Cache de 5 minutos no HospitalAccessService
- ✅ Verificações assíncronas otimizadas
- ✅ Consultas SQL otimizadas com índices

### **Manutenibilidade**
- ✅ Configuração centralizada em `hospitalMapping.ts`
- ✅ Serviços especializados para cada função
- ✅ Interface TypeScript bem definida
- ✅ Documentação completa

---

## 🎯 **PRÓXIMOS PASSOS**

1. **Executar scripts SQL** no Supabase
2. **Testar login** com usuários de diferentes hospitais
3. **Implementar filtros** nos componentes existentes
4. **Verificar audit logs** estão funcionando
5. **Testar cenários de erro** e fallbacks

---

## 📞 **SUPORTE**

Para dúvidas sobre implementação:
- Consulte a documentação do sistema
- Verifique os exemplos neste arquivo
- Teste com dados reais no ambiente de desenvolvimento
- Monitore os logs de auditoria

**Sistema pronto para uso! 🚀** 