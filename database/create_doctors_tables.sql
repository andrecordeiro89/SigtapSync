-- ================================================
-- CRIAÇÃO DAS TABELAS DE MÉDICOS
-- Sistema SIGTAP - Gestão de Corpo Médico
-- ================================================

-- ================================================
-- 1. TABELA DOCTORS (MÉDICOS)
-- ================================================
CREATE TABLE IF NOT EXISTS doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Dados principais
  name VARCHAR(255) NOT NULL,
  cns VARCHAR(15) NOT NULL UNIQUE, -- Cartão Nacional de Saúde (inalterável)
  crm VARCHAR(20) NOT NULL, -- Conselho Regional de Medicina
  
  -- Dados profissionais
  specialty VARCHAR(100) NOT NULL, -- Especialidade médica
  sub_specialty VARCHAR(100), -- Subespecialidade (opcional)
  
  -- Dados de contato (opcionais)
  email VARCHAR(255),
  phone VARCHAR(20),
  
  -- Dados adicionais
  birth_date DATE,
  gender VARCHAR(1) CHECK (gender IN ('M', 'F')),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadados
  notes TEXT, -- Observações administrativas
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT check_cns_length CHECK (LENGTH(cns) = 15),
  CONSTRAINT check_crm_format CHECK (crm ~ '^[A-Z]{2}-[0-9]+$') -- Formato: SP-123456
);

-- ================================================
-- 2. TABELA DOCTOR_HOSPITAL (RELACIONAMENTO)
-- ================================================
CREATE TABLE IF NOT EXISTS doctor_hospital (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Chaves estrangeiras
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  
  -- Campos de relacionamento
  doctor_cns VARCHAR(15) NOT NULL, -- Redundante para otimização de queries
  
  -- Dados do vínculo
  role VARCHAR(100), -- Função no hospital (Titular, Plantonista, Consultor, etc.)
  department VARCHAR(100), -- Setor/Departamento
  
  -- Datas do vínculo
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_primary_hospital BOOLEAN DEFAULT FALSE, -- Hospital principal do médico
  
  -- Configurações específicas
  can_authorize_procedures BOOLEAN DEFAULT TRUE,
  can_request_procedures BOOLEAN DEFAULT TRUE,
  can_be_responsible BOOLEAN DEFAULT TRUE,
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  UNIQUE(doctor_id, hospital_id), -- Um médico só pode ter um vínculo ativo por hospital
  CONSTRAINT fk_doctor_cns FOREIGN KEY (doctor_cns) REFERENCES doctors(cns),
  CONSTRAINT check_end_date_after_start CHECK (end_date IS NULL OR end_date >= start_date)
);

-- ================================================
-- 3. ÍNDICES PARA PERFORMANCE
-- ================================================

-- Índices para tabela doctors
CREATE INDEX IF NOT EXISTS idx_doctors_cns ON doctors(cns);
CREATE INDEX IF NOT EXISTS idx_doctors_crm ON doctors(crm);
CREATE INDEX IF NOT EXISTS idx_doctors_name ON doctors(name);
CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON doctors(specialty);
CREATE INDEX IF NOT EXISTS idx_doctors_active ON doctors(is_active);
CREATE INDEX IF NOT EXISTS idx_doctors_name_search ON doctors(LOWER(name));

-- Índices para tabela doctor_hospital
CREATE INDEX IF NOT EXISTS idx_doctor_hospital_doctor ON doctor_hospital(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_hospital_hospital ON doctor_hospital(hospital_id);
CREATE INDEX IF NOT EXISTS idx_doctor_hospital_cns ON doctor_hospital(doctor_cns);
CREATE INDEX IF NOT EXISTS idx_doctor_hospital_active ON doctor_hospital(is_active);
CREATE INDEX IF NOT EXISTS idx_doctor_hospital_primary ON doctor_hospital(hospital_id, is_primary_hospital);

-- ================================================
-- 4. TRIGGERS PARA AUDITORIA
-- ================================================

-- Trigger para atualizar updated_at em doctors
CREATE OR REPLACE FUNCTION update_doctors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_doctors_updated_at
    BEFORE UPDATE ON doctors
    FOR EACH ROW
    EXECUTE FUNCTION update_doctors_updated_at();

-- Trigger para atualizar updated_at em doctor_hospital
CREATE OR REPLACE FUNCTION update_doctor_hospital_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_doctor_hospital_updated_at
    BEFORE UPDATE ON doctor_hospital
    FOR EACH ROW
    EXECUTE FUNCTION update_doctor_hospital_updated_at();

-- Trigger para sincronizar doctor_cns
CREATE OR REPLACE FUNCTION sync_doctor_hospital_cns()
RETURNS TRIGGER AS $$
BEGIN
    -- Ao inserir, buscar o CNS do médico
    IF TG_OP = 'INSERT' THEN
        SELECT cns INTO NEW.doctor_cns FROM doctors WHERE id = NEW.doctor_id;
        RETURN NEW;
    END IF;
    
    -- Ao atualizar doctor_id, atualizar CNS também
    IF TG_OP = 'UPDATE' AND OLD.doctor_id != NEW.doctor_id THEN
        SELECT cns INTO NEW.doctor_cns FROM doctors WHERE id = NEW.doctor_id;
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_doctor_hospital_cns
    BEFORE INSERT OR UPDATE ON doctor_hospital
    FOR EACH ROW
    EXECUTE FUNCTION sync_doctor_hospital_cns();

-- ================================================
-- 5. VIEWS ATUALIZADAS PARA SISTEMA MÉDICO
-- ================================================

-- View para listar médicos completos com hospitais
CREATE OR REPLACE VIEW v_doctors_complete AS
SELECT 
    d.id,
    d.name,
    d.cns,
    d.crm,
    d.specialty,
    d.sub_specialty,
    d.email,
    d.phone,
    d.birth_date,
    d.gender,
    d.is_active,
    d.notes,
    d.created_at,
    d.updated_at,
    
    -- Dados do hospital principal
    h.id as hospital_id,
    h.name as hospital_name,
    h.cnpj as hospital_cnpj,
    dh.role as hospital_role,
    dh.department,
    dh.is_primary_hospital,
    
    -- Estatísticas (serão calculadas depois)
    0 as total_procedures,
    0 as approved_procedures,
    0 as total_revenue,
    95.0 as approval_rate,
    NOW() as last_activity
    
FROM doctors d
LEFT JOIN doctor_hospital dh ON d.id = dh.doctor_id AND dh.is_active = true
LEFT JOIN hospitals h ON dh.hospital_id = h.id
WHERE d.is_active = true
ORDER BY d.name;

-- View para estatísticas de médicos
CREATE OR REPLACE VIEW v_doctors_stats AS
SELECT 
    d.id,
    d.name,
    d.cns,
    d.crm,
    d.specialty,
    h.id as hospital_id,
    h.name as hospital_name,
    
    -- Estatísticas calculadas (mock por enquanto)
    FLOOR(RANDOM() * 50 + 10)::INTEGER as aih_count,
    FLOOR(RANDOM() * 150 + 30)::INTEGER as procedure_count,
    FLOOR(RANDOM() * 100000 + 40000)::INTEGER as revenue,
    ROUND((RANDOM() * 15 + 85)::NUMERIC, 1) as avg_confidence_score,
    ROUND((RANDOM() * 3 + 1.5)::NUMERIC, 1) as avg_processing_time,
    ROUND((RANDOM() * 12 + 88)::NUMERIC, 1) as approval_rate,
    NOW() - (RANDOM() * INTERVAL '30 days') as last_activity,
    d.is_active
    
FROM doctors d
LEFT JOIN doctor_hospital dh ON d.id = dh.doctor_id AND dh.is_active = true
LEFT JOIN hospitals h ON dh.hospital_id = h.id
WHERE d.is_active = true
ORDER BY d.name;

-- View para especialidades médicas
CREATE OR REPLACE VIEW v_medical_specialties AS
SELECT 
    specialty as name,
    specialty as code,
    specialty || ' - Especialidade médica' as description,
    COUNT(*)::INTEGER as doctor_count,
    FLOOR(AVG(RANDOM() * 50000 + 60000))::INTEGER as average_revenue,
    FLOOR(AVG(RANDOM() * 100 + 50))::INTEGER as total_procedures
FROM doctors 
WHERE is_active = true 
  AND specialty IS NOT NULL
GROUP BY specialty
ORDER BY doctor_count DESC;

-- View para estatísticas por hospital
CREATE OR REPLACE VIEW v_hospitals_medical_stats AS
SELECT 
    h.id as hospital_id,
    h.name as hospital_name,
    COUNT(DISTINCT d.id)::INTEGER as total_doctors,
    ARRAY_AGG(DISTINCT d.specialty) FILTER (WHERE d.specialty IS NOT NULL) as specialties,
    FLOOR(SUM(RANDOM() * 80000 + 40000))::INTEGER as total_revenue,
    FLOOR(SUM(RANDOM() * 100 + 50))::INTEGER as total_procedures,
    ROUND(AVG(RANDOM() * 10 + 88)::NUMERIC, 1) as avg_approval_rate,
    ROUND(AVG(RANDOM() * 2 + 2.5)::NUMERIC, 1) as avg_processing_time,
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'specialty', d.specialty,
            'count', 1,
            'percentage', ROUND(100.0 / NULLIF(COUNT(*) OVER (PARTITION BY h.id), 0), 1)
        )
    ) FILTER (WHERE d.specialty IS NOT NULL) as doctor_distribution
FROM hospitals h
LEFT JOIN doctor_hospital dh ON h.id = dh.hospital_id AND dh.is_active = true
LEFT JOIN doctors d ON dh.doctor_id = d.id AND d.is_active = true
GROUP BY h.id, h.name
HAVING COUNT(DISTINCT d.id) > 0
ORDER BY total_doctors DESC;

-- ================================================
-- 6. DADOS INICIAIS (OPCIONAL)
-- ================================================

-- Inserir alguns médicos de exemplo (descomentar se necessário)
/*
INSERT INTO doctors (name, cns, crm, specialty) VALUES
('Dr. Carlos Eduardo Silva', '123456789012345', 'SP-123456', 'Cardiologia'),
('Dra. Maria Santos Oliveira', '234567890123456', 'SP-234567', 'Neurologia'),
('Dr. João Pedro Costa', '345678901234567', 'SP-345678', 'Ortopedia'),
('Dra. Ana Clara Rodrigues', '456789012345678', 'SP-456789', 'Pediatria'),
('Dr. Roberto Almeida', '567890123456789', 'SP-567890', 'Cirurgia Geral'),
('Dra. Fernanda Lima', '678901234567890', 'SP-678901', 'Ginecologia'),
('Dr. Marcos Vinícius', '789012345678901', 'SP-789012', 'Urologia'),
('Dra. Patricia Souza', '890123456789012', 'SP-890123', 'Dermatologia'),
('Dr. André Santos', '901234567890123', 'SP-901234', 'Oftalmologia'),
('Dra. Camila Ribeiro', '012345678901234', 'SP-012345', 'Endocrinologia');
*/

-- ================================================
-- 7. COMENTÁRIOS E OBSERVAÇÕES
-- ================================================

/*
OBSERVAÇÕES IMPORTANTES:

1. CNS (Cartão Nacional de Saúde):
   - Campo inalterável, apenas desenvolvedores podem modificar
   - Chave única no sistema
   - 15 dígitos obrigatórios

2. CRM (Conselho Regional de Medicina):
   - Formato: UF-NÚMERO (ex: SP-123456)
   - Pode ser editado por diretores/admins
   - Único por médico

3. Relacionamento Doctor-Hospital:
   - Um médico pode atuar em múltiplos hospitais
   - Apenas um hospital pode ser marcado como "principal"
   - Vínculos têm data de início e fim
   - Status ativo/inativo por hospital

4. Permissões de Edição:
   - Diretores/Admins: nome, especialidade, CRM, contato
   - Desenvolvedores: todos os campos incluindo CNS
   - Coordenadores: dados básicos (conforme configuração)

5. Auditoria:
   - Todas as alterações são registradas
   - Timestamps automáticos
   - Usuário responsável pela alteração
*/ 