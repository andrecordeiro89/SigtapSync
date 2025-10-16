-- ================================================================
-- FIX: Remover constraint de FK para created_by
-- Problema: created_by tentava referenciar auth.users que não existe
-- Solução: Tornar created_by simples UUID sem FK
-- ================================================================

-- 1. Dropar tabela existente (se houver)
DROP TABLE IF EXISTS hospital_discharges CASCADE;

-- 2. Recriar tabela SEM constraint de FK em created_by
CREATE TABLE hospital_discharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  
  -- Dados da Alta (conforme Excel)
  leito VARCHAR(50),
  paciente VARCHAR(255) NOT NULL,
  data_entrada TIMESTAMP WITH TIME ZONE NOT NULL,
  data_saida TIMESTAMP WITH TIME ZONE NOT NULL,
  duracao VARCHAR(100),
  responsavel VARCHAR(255),
  usuario_finalizacao VARCHAR(255),
  status VARCHAR(50) DEFAULT 'Alta',
  justificativa_observacao TEXT,
  
  -- Metadados de importação
  source_file VARCHAR(255),
  import_batch_id UUID,
  
  -- Auditoria (created_by SEM FK para flexibilidade)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,  -- ID do usuário (opcional, sem FK)
  
  -- Constraints
  CONSTRAINT valid_dates CHECK (data_saida >= data_entrada)
);

-- 3. ÍNDICES PARA PERFORMANCE
CREATE INDEX idx_discharges_hospital_id ON hospital_discharges(hospital_id);
CREATE INDEX idx_discharges_data_saida ON hospital_discharges(data_saida);
CREATE INDEX idx_discharges_paciente ON hospital_discharges(paciente);
CREATE INDEX idx_discharges_created_at ON hospital_discharges(created_at DESC);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE hospital_discharges ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS DE ACESSO

-- 5.1. SELECT: Usuários veem apenas dados do seu hospital
DROP POLICY IF EXISTS "Users can view discharges from their hospital" ON hospital_discharges;
CREATE POLICY "Users can view discharges from their hospital" 
ON hospital_discharges FOR SELECT
USING (
  -- Roles administrativos veem tudo
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND role IN ('developer', 'admin', 'director', 'coordinator', 'auditor', 'ti')
    AND is_active = true
  )
  OR
  -- Usuários normais veem apenas seu hospital
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND (
      hospital_access @> ARRAY[hospital_id::text]
      OR hospital_access @> ARRAY['ALL']
    )
    AND is_active = true
  )
);

-- 5.2. INSERT: Usuários podem inserir no seu hospital
DROP POLICY IF EXISTS "Users can insert discharges to their hospital" ON hospital_discharges;
CREATE POLICY "Users can insert discharges to their hospital" 
ON hospital_discharges FOR INSERT
WITH CHECK (
  -- Roles administrativos podem inserir em qualquer hospital
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND role IN ('developer', 'admin', 'director', 'coordinator', 'ti')
    AND is_active = true
  )
  OR
  -- Usuários normais só podem inserir no seu hospital
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND (
      hospital_access @> ARRAY[hospital_id::text]
      OR hospital_access @> ARRAY['ALL']
    )
    AND is_active = true
  )
);

-- 5.3. UPDATE: Apenas admins e criadores podem atualizar
DROP POLICY IF EXISTS "Users can update their own discharges" ON hospital_discharges;
CREATE POLICY "Users can update their own discharges" 
ON hospital_discharges FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND (
      role IN ('developer', 'admin', 'director', 'ti')
      OR id::text = created_by::text
    )
    AND is_active = true
  )
);

-- 5.4. DELETE: Apenas admins podem deletar
DROP POLICY IF EXISTS "Only admins can delete discharges" ON hospital_discharges;
CREATE POLICY "Only admins can delete discharges" 
ON hospital_discharges FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND role IN ('developer', 'admin', 'ti')
    AND is_active = true
  )
);

-- 6. TRIGGER PARA updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_discharges_updated_at ON hospital_discharges;
CREATE TRIGGER update_discharges_updated_at
  BEFORE UPDATE ON hospital_discharges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. COMENTÁRIOS
COMMENT ON TABLE hospital_discharges IS 'Registro de altas hospitalares importadas do sistema hospitalar';
COMMENT ON COLUMN hospital_discharges.leito IS 'Número ou identificação do leito';
COMMENT ON COLUMN hospital_discharges.paciente IS 'Nome completo do paciente';
COMMENT ON COLUMN hospital_discharges.data_entrada IS 'Data e hora de internação';
COMMENT ON COLUMN hospital_discharges.data_saida IS 'Data e hora da alta';
COMMENT ON COLUMN hospital_discharges.duracao IS 'Duração total da internação (formato texto)';
COMMENT ON COLUMN hospital_discharges.responsavel IS 'Profissional responsável pela alta';
COMMENT ON COLUMN hospital_discharges.usuario_finalizacao IS 'Usuário que finalizou a alta no sistema';
COMMENT ON COLUMN hospital_discharges.status IS 'Status da alta (geralmente "Alta")';
COMMENT ON COLUMN hospital_discharges.justificativa_observacao IS 'Motivo ou observação da alta';
COMMENT ON COLUMN hospital_discharges.created_by IS 'UUID do usuário que importou (referência a user_profiles.id)';

-- ✅ FINALIZADO
SELECT 'Tabela hospital_discharges recriada com sucesso (sem constraint FK em created_by)!' as status;

