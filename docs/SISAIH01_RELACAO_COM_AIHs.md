# 🔗 SISAIH01 - Relacionamento com Tabela AIHs

## 📋 Visão Geral

Este documento explica como os dados da tabela `aih_registros` (SISAIH01) podem ser relacionados com a tabela `aihs` existente no sistema para criar um fluxo completo de gestão de internações hospitalares.

---

## 🗄️ Estrutura das Tabelas

### Tabela `aih_registros` (SISAIH01 - Origem DATASUS)

```sql
CREATE TABLE aih_registros (
  id UUID PRIMARY KEY,
  numero_aih VARCHAR(13) UNIQUE NOT NULL,  -- 🔑 Chave de relacionamento
  tipo_aih VARCHAR(2),
  
  -- Dados do paciente
  nome_paciente VARCHAR(70) NOT NULL,
  data_nascimento DATE NOT NULL,
  sexo CHAR(1) NOT NULL,
  cns VARCHAR(15),
  cpf VARCHAR(11),
  nome_mae VARCHAR(70),
  
  -- Dados da internação
  data_internacao DATE NOT NULL,
  data_saida DATE,
  cnes_hospital VARCHAR(7),
  
  -- Diagnósticos e procedimentos
  diagnostico_principal VARCHAR(4),
  procedimento_realizado VARCHAR(10),
  
  -- ... outros 25+ campos
);
```

### Tabela `aihs` (Sistema Interno)

```sql
CREATE TABLE aihs (
  id UUID PRIMARY KEY,
  hospital_id UUID REFERENCES hospitals(id),     -- 🔑 Relacionamento
  patient_id UUID REFERENCES patients(id),       -- 🔑 Relacionamento
  
  aih_number VARCHAR(50) NOT NULL,               -- 🔑 Chave de relacionamento
  procedure_code VARCHAR(20) NOT NULL,
  
  admission_date TIMESTAMP WITH TIME ZONE NOT NULL,
  discharge_date TIMESTAMP WITH TIME ZONE,
  
  main_cid VARCHAR(10) NOT NULL,
  secondary_cid TEXT[],
  
  -- Dados financeiros
  total_value DECIMAL(10,2),
  hospital_value DECIMAL(10,2),
  professional_value DECIMAL(10,2),
  
  -- ... outros campos
);
```

---

## 🔗 Estratégia de Relacionamento

### Campo Chave: `numero_aih` / `aih_number`

O relacionamento entre as tabelas é feito pelo **número da AIH**, que é único e imutável.

```
aih_registros.numero_aih = aihs.aih_number
```

---

## 🚀 Implementação - Fase 1: Adicionar Coluna de Relacionamento

### 1.1 Adicionar coluna na tabela `aih_registros`

```sql
-- Adicionar coluna para armazenar referência
ALTER TABLE aih_registros
ADD COLUMN aih_id UUID REFERENCES aihs(id);

-- Criar índice para performance
CREATE INDEX idx_aih_registros_aih_id 
  ON aih_registros(aih_id);
```

### 1.2 Adicionar coluna na tabela `aihs`

```sql
-- Adicionar coluna para armazenar referência reversa (opcional)
ALTER TABLE aihs
ADD COLUMN aih_registro_id UUID REFERENCES aih_registros(id);

-- Criar índice para performance
CREATE INDEX idx_aihs_aih_registro_id 
  ON aihs(aih_registro_id);
```

---

## 🔧 Implementação - Fase 2: Função de Sincronização

### 2.1 Função para Criar/Atualizar AIH a partir de SISAIH01

```sql
CREATE OR REPLACE FUNCTION sync_aih_from_sisaih01(
  p_aih_registro_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_registro RECORD;
  v_patient_id UUID;
  v_hospital_id UUID;
  v_aih_id UUID;
BEGIN
  -- Buscar dados do registro SISAIH01
  SELECT * INTO v_registro
  FROM aih_registros
  WHERE id = p_aih_registro_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro SISAIH01 não encontrado: %', p_aih_registro_id;
  END IF;
  
  -- 1. BUSCAR OU CRIAR HOSPITAL
  SELECT id INTO v_hospital_id
  FROM hospitals
  WHERE cnes = v_registro.cnes_hospital;
  
  IF v_hospital_id IS NULL THEN
    -- Criar hospital se não existir
    INSERT INTO hospitals (cnes, name, created_at)
    VALUES (
      v_registro.cnes_hospital,
      'Hospital CNES ' || v_registro.cnes_hospital,
      NOW()
    )
    RETURNING id INTO v_hospital_id;
  END IF;
  
  -- 2. BUSCAR OU CRIAR PACIENTE
  -- Primeiro tenta por CNS, depois por CPF + nome + data nascimento
  SELECT id INTO v_patient_id
  FROM patients
  WHERE (cns = v_registro.cns AND v_registro.cns IS NOT NULL)
     OR (cpf = v_registro.cpf AND v_registro.cpf IS NOT NULL 
         AND name = v_registro.nome_paciente);
  
  IF v_patient_id IS NULL THEN
    -- Criar paciente se não existir
    INSERT INTO patients (
      name,
      birth_date,
      gender,
      cpf,
      cns,
      mother_name,
      created_at
    )
    VALUES (
      v_registro.nome_paciente,
      v_registro.data_nascimento,
      v_registro.sexo,
      v_registro.cpf,
      v_registro.cns,
      v_registro.nome_mae,
      NOW()
    )
    RETURNING id INTO v_patient_id;
  END IF;
  
  -- 3. BUSCAR OU CRIAR AIH
  SELECT id INTO v_aih_id
  FROM aihs
  WHERE aih_number = v_registro.numero_aih;
  
  IF v_aih_id IS NULL THEN
    -- Criar nova AIH
    INSERT INTO aihs (
      hospital_id,
      patient_id,
      aih_number,
      procedure_code,
      admission_date,
      discharge_date,
      main_cid,
      created_at,
      aih_registro_id
    )
    VALUES (
      v_hospital_id,
      v_patient_id,
      v_registro.numero_aih,
      v_registro.procedimento_realizado,
      v_registro.data_internacao::TIMESTAMP WITH TIME ZONE,
      v_registro.data_saida::TIMESTAMP WITH TIME ZONE,
      v_registro.diagnostico_principal,
      NOW(),
      p_aih_registro_id
    )
    RETURNING id INTO v_aih_id;
  ELSE
    -- Atualizar AIH existente
    UPDATE aihs
    SET
      hospital_id = v_hospital_id,
      patient_id = v_patient_id,
      procedure_code = v_registro.procedimento_realizado,
      admission_date = v_registro.data_internacao::TIMESTAMP WITH TIME ZONE,
      discharge_date = v_registro.data_saida::TIMESTAMP WITH TIME ZONE,
      main_cid = v_registro.diagnostico_principal,
      updated_at = NOW(),
      aih_registro_id = p_aih_registro_id
    WHERE id = v_aih_id;
  END IF;
  
  -- 4. ATUALIZAR REGISTRO SISAIH01 COM REFERÊNCIA
  UPDATE aih_registros
  SET aih_id = v_aih_id
  WHERE id = p_aih_registro_id;
  
  RETURN v_aih_id;
END;
$$ LANGUAGE plpgsql;
```

### 2.2 Função em Lote

```sql
CREATE OR REPLACE FUNCTION sync_all_aih_from_sisaih01()
RETURNS TABLE (
  total_processados INT,
  total_criados INT,
  total_atualizados INT,
  total_erros INT
) AS $$
DECLARE
  v_registro RECORD;
  v_total_processados INT := 0;
  v_total_criados INT := 0;
  v_total_atualizados INT := 0;
  v_total_erros INT := 0;
  v_aih_id UUID;
BEGIN
  FOR v_registro IN 
    SELECT id 
    FROM aih_registros 
    WHERE aih_id IS NULL  -- Apenas registros não sincronizados
    ORDER BY created_at DESC
  LOOP
    BEGIN
      -- Verificar se AIH já existe
      SELECT id INTO v_aih_id
      FROM aihs
      WHERE aih_number = (
        SELECT numero_aih FROM aih_registros WHERE id = v_registro.id
      );
      
      -- Sincronizar
      PERFORM sync_aih_from_sisaih01(v_registro.id);
      
      v_total_processados := v_total_processados + 1;
      
      IF v_aih_id IS NULL THEN
        v_total_criados := v_total_criados + 1;
      ELSE
        v_total_atualizados := v_total_atualizados + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_total_erros := v_total_erros + 1;
      RAISE NOTICE 'Erro ao processar registro %: %', v_registro.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_total_processados, v_total_criados, v_total_atualizados, v_total_erros;
END;
$$ LANGUAGE plpgsql;
```

---

## 💻 Implementação Frontend - TypeScript

### 3.1 Service de Sincronização

```typescript
// src/services/sisaih01SyncService.ts

import { supabase } from '../lib/supabase';

export interface SyncResult {
  success: boolean;
  aih_id?: string;
  message: string;
  error?: string;
}

export interface BatchSyncResult {
  total_processados: number;
  total_criados: number;
  total_atualizados: number;
  total_erros: number;
}

/**
 * Sincroniza um único registro SISAIH01 com a tabela AIHs
 */
export async function syncSingleAIH(aih_registro_id: string): Promise<SyncResult> {
  try {
    const { data, error } = await supabase
      .rpc('sync_aih_from_sisaih01', {
        p_aih_registro_id: aih_registro_id
      });

    if (error) {
      return {
        success: false,
        message: 'Erro ao sincronizar AIH',
        error: error.message
      };
    }

    return {
      success: true,
      aih_id: data,
      message: 'AIH sincronizada com sucesso'
    };
  } catch (error) {
    return {
      success: false,
      message: 'Erro inesperado',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Sincroniza todos os registros SISAIH01 não sincronizados
 */
export async function syncAllAIHs(): Promise<BatchSyncResult> {
  try {
    const { data, error } = await supabase
      .rpc('sync_all_aih_from_sisaih01');

    if (error) {
      throw error;
    }

    return data[0];
  } catch (error) {
    console.error('Erro ao sincronizar AIHs:', error);
    return {
      total_processados: 0,
      total_criados: 0,
      total_atualizados: 0,
      total_erros: 0
    };
  }
}

/**
 * Verifica se um registro SISAIH01 já está sincronizado
 */
export async function checkSyncStatus(numero_aih: string): Promise<{
  is_synced: boolean;
  aih_id?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('aih_registros')
      .select('aih_id')
      .eq('numero_aih', numero_aih)
      .single();

    if (error) {
      return { is_synced: false };
    }

    return {
      is_synced: data.aih_id !== null,
      aih_id: data.aih_id
    };
  } catch (error) {
    return { is_synced: false };
  }
}
```

### 3.2 Adicionar Botão de Sincronização no Componente

```typescript
// Adicionar no SISAIH01Page.tsx

import { syncAllAIHs, BatchSyncResult } from '../services/sisaih01SyncService';

// No componente:
const [isSyncing, setIsSyncing] = useState(false);
const [syncResult, setSyncResult] = useState<BatchSyncResult | null>(null);

const handleSyncWithAIHs = async () => {
  setIsSyncing(true);
  const loadingToast = toast.loading('Sincronizando com tabela AIHs...');

  try {
    const result = await syncAllAIHs();
    setSyncResult(result);

    toast.dismiss(loadingToast);
    
    if (result.total_erros === 0) {
      toast.success(
        `✅ Sincronização concluída!`,
        {
          description: `${result.total_criados} AIHs criadas, ${result.total_atualizados} atualizadas`,
          duration: 5000
        }
      );
    } else {
      toast.warning(
        `⚠️ Sincronização parcial`,
        {
          description: `${result.total_processados} processadas, ${result.total_erros} erros`,
          duration: 5000
        }
      );
    }
  } catch (error) {
    toast.dismiss(loadingToast);
    toast.error('Erro ao sincronizar com AIHs');
  } finally {
    setIsSyncing(false);
  }
};

// No JSX, adicionar botão:
<Button
  onClick={handleSyncWithAIHs}
  disabled={isSyncing || registros.length === 0 || !savedCount}
  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
>
  {isSyncing ? (
    <>
      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
      Sincronizando...
    </>
  ) : (
    <>
      <span className="mr-2">🔗</span>
      Sincronizar com AIHs
    </>
  )}
</Button>
```

---

## 📊 Views Úteis para Análise

### View: Dados Combinados

```sql
CREATE OR REPLACE VIEW aih_completa AS
SELECT 
  ar.id as sisaih01_id,
  ar.numero_aih,
  ar.tipo_aih,
  ar.nome_paciente,
  ar.cns,
  ar.data_internacao,
  ar.data_saida,
  ar.diagnostico_principal,
  ar.procedimento_realizado,
  
  -- Dados da tabela AIHs
  a.id as aih_id,
  a.total_value,
  a.hospital_value,
  a.professional_value,
  
  -- Dados do hospital
  h.name as hospital_name,
  h.cnes as hospital_cnes,
  
  -- Dados do paciente
  p.id as patient_id,
  p.name as patient_name,
  
  -- Status de sincronização
  CASE 
    WHEN ar.aih_id IS NOT NULL THEN 'Sincronizado'
    ELSE 'Não Sincronizado'
  END as sync_status

FROM aih_registros ar
LEFT JOIN aihs a ON ar.aih_id = a.id
LEFT JOIN hospitals h ON a.hospital_id = h.id
LEFT JOIN patients p ON a.patient_id = p.id;
```

### View: Status de Sincronização

```sql
CREATE OR REPLACE VIEW sisaih01_sync_status AS
SELECT 
  COUNT(*) as total_registros,
  COUNT(aih_id) as total_sincronizados,
  COUNT(*) - COUNT(aih_id) as total_pendentes,
  ROUND(COUNT(aih_id) * 100.0 / COUNT(*), 2) as percentual_sincronizado
FROM aih_registros;
```

---

## 🎯 Fluxo Completo de Uso

### Passo 1: Importar SISAIH01
```
1. Upload do arquivo DATASUS
2. Processamento e validação
3. Exibição de estatísticas
```

### Passo 2: Salvar no Banco
```
1. Clicar em "💾 Salvar no Banco de Dados"
2. Confirmar no modal
3. Aguardar progresso (lotes de 500)
4. Dados salvos em aih_registros
```

### Passo 3: Sincronizar com AIHs (Futuro)
```
1. Clicar em "🔗 Sincronizar com AIHs"
2. Sistema cria/atualiza:
   - Hospitais (via CNES)
   - Pacientes (via CNS/CPF)
   - AIHs (via numero_aih)
3. Registros ficam linkados
```

### Passo 4: Usar Dados Integrados
```
- Dashboard executivo mostra dados combinados
- Relatórios financeiros usam valores da tabela aihs
- Gestão de pacientes tem histórico completo
- Auditoria rastreia origem DATASUS
```

---

## 📈 Benefícios do Relacionamento

### 1. Rastreabilidade Completa
- **Origem:** Dados originais do DATASUS (aih_registros)
- **Gestão:** Dados processados no sistema (aihs)
- **Auditoria:** Comparação entre oficial vs. interno

### 2. Enriquecimento de Dados
- SISAIH01 fornece: dados cadastrais completos
- Sistema interno adiciona: valores, status, workflow

### 3. Validação Cruzada
- Comparar procedimentos realizados vs. faturados
- Verificar consistência de diagnósticos
- Identificar discrepâncias para auditoria

### 4. Eliminação de Duplicatas
- Busca inteligente por CNS/CPF antes de criar paciente
- Busca por CNES antes de criar hospital
- Upsert em AIHs evita duplicação

---

## 🔐 Considerações de Segurança

### RLS (Row Level Security)

```sql
-- Garantir que usuário só vê dados do seu hospital
CREATE POLICY "users_hospital_aihs"
  ON aihs
  FOR ALL
  TO authenticated
  USING (
    hospital_id IN (
      SELECT hospital_id 
      FROM user_hospital_access 
      WHERE user_id = auth.uid()
    )
  );

-- Mesma política para aih_registros
CREATE POLICY "users_hospital_aih_registros"
  ON aih_registros
  FOR ALL
  TO authenticated
  USING (
    cnes_hospital IN (
      SELECT h.cnes
      FROM hospitals h
      JOIN user_hospital_access uha ON uha.hospital_id = h.id
      WHERE uha.user_id = auth.uid()
    )
  );
```

---

## 📝 Checklist de Implementação

- [ ] Executar SQL de adicionar colunas de relacionamento
- [ ] Criar função `sync_aih_from_sisaih01`
- [ ] Criar função `sync_all_aih_from_sisaih01`
- [ ] Criar views combinadas
- [ ] Implementar service TypeScript
- [ ] Adicionar botão de sincronização na interface
- [ ] Testar sincronização com dados reais
- [ ] Configurar RLS para segurança
- [ ] Criar dashboard de status de sincronização
- [ ] Documentar processo para equipe

---

## 🎓 Próximos Passos

1. **Curto Prazo:**
   - Implementar sincronização manual (botão)
   - Criar dashboard de status de sync

2. **Médio Prazo:**
   - Sincronização automática após salvar
   - Notificações de conflitos/erros
   - Relatórios comparativos

3. **Longo Prazo:**
   - Integração bi-direcional
   - Exportação para DATASUS
   - Machine Learning para validação

---

**Desenvolvido para SigtapSync v7**  
**Data:** 17 de Outubro de 2024  
**Versão:** 1.0

