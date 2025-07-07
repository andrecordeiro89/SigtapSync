-- 🧪 CRIAÇÃO URGENTE DE DADOS DE TESTE - PROCEDURE_RECORDS
-- Execute este script no Supabase SQL Editor

-- Verificar se a AIH existe
SELECT 
    'Verificando AIH...' as status,
    id,
    aih_number,
    patient_id,
    hospital_id
FROM aihs 
WHERE id = 'b9fc1770-aa93-4430-a34c-d2f6b39e0a78';

-- Inserir procedimentos de teste
INSERT INTO procedure_records (
    id,
    hospital_id,
    aih_id,
    patient_id,
    procedure_sequence,
    procedure_code,
    procedure_description,
    match_status,
    match_confidence,
    value_charged,
    professional,
    professional_cbo,
    procedure_date,
    created_at,
    created_by
) VALUES 
-- Procedimento 1
(
    gen_random_uuid(),
    'a8978eaa-b90e-4dc8-8fd5-0af984374d34',
    'b9fc1770-aa93-4430-a34c-d2f6b39e0a78',
    (SELECT patient_id FROM aihs WHERE id = 'b9fc1770-aa93-4430-a34c-d2f6b39e0a78'),
    1,
    '0301010019',
    'Consulta médica em atenção primária',
    'pending',
    0.95,
    2200, -- R$ 22,00 em centavos
    'Dr. João Silva',
    '225125',
    CURRENT_DATE,
    NOW(),
    'test-system'
),
-- Procedimento 2
(
    gen_random_uuid(),
    'a8978eaa-b90e-4dc8-8fd5-0af984374d34',
    'b9fc1770-aa93-4430-a34c-d2f6b39e0a78',
    (SELECT patient_id FROM aihs WHERE id = 'b9fc1770-aa93-4430-a34c-d2f6b39e0a78'),
    2,
    '0301010027',
    'Consulta médica em atenção especializada',
    'approved',
    0.89,
    3500, -- R$ 35,00 em centavos
    'Dr. Maria Santos',
    '225130',
    CURRENT_DATE,
    NOW(),
    'test-system'
),
-- Procedimento 3
(
    gen_random_uuid(),
    'a8978eaa-b90e-4dc8-8fd5-0af984374d34',
    'b9fc1770-aa93-4430-a34c-d2f6b39e0a78',
    (SELECT patient_id FROM aihs WHERE id = 'b9fc1770-aa93-4430-a34c-d2f6b39e0a78'),
    3,
    '0301010035',
    'Consulta/atendimento domiciliar',
    'rejected',
    0.67,
    2800,
    'Dr. Pedro Oliveira',
    '225140',
    CURRENT_DATE,
    NOW(),
    'test-system'
),
-- Procedimento 4 (removido)
(
    gen_random_uuid(),
    'a8978eaa-b90e-4dc8-8fd5-0af984374d34',
    'b9fc1770-aa93-4430-a34c-d2f6b39e0a78',
    (SELECT patient_id FROM aihs WHERE id = 'b9fc1770-aa93-4430-a34c-d2f6b39e0a78'),
    4,
    '0301010043',
    'Consulta médica em urgência',
    'removed',
    0.78,
    4200,
    'Dr. Ana Costa',
    '225150',
    CURRENT_DATE,
    NOW(),
    'test-system'
);

-- Verificar inserção
SELECT 
    'Dados inseridos com sucesso!' as status,
    COUNT(*) as total_procedures,
    aih_id
FROM procedure_records 
WHERE aih_id = 'b9fc1770-aa93-4430-a34c-d2f6b39e0a78'
GROUP BY aih_id;

-- Exibir dados criados
SELECT 
    procedure_sequence,
    procedure_code,
    procedure_description,
    match_status,
    professional,
    value_charged
FROM procedure_records 
WHERE aih_id = 'b9fc1770-aa93-4430-a34c-d2f6b39e0a78'
ORDER BY procedure_sequence; 