-- ================================================================
-- TABELA AIH_REGISTROS - SISAIH01
-- Sistema de Informações Hospitalares do SUS
-- ================================================================

CREATE TABLE IF NOT EXISTS aih_registros (
  -- Chave primária e controle
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Identificação da AIH
  numero_aih VARCHAR(13) NOT NULL UNIQUE,
  tipo_aih VARCHAR(2) NOT NULL,
  tipo_aih_descricao VARCHAR(50),
  cnes_hospital VARCHAR(7),
  municipio_hospital VARCHAR(6),
  competencia VARCHAR(6),
  
  -- Datas da internação
  data_emissao DATE,
  data_internacao DATE NOT NULL,
  data_saida DATE,
  
  -- Procedimentos
  procedimento_solicitado VARCHAR(10),
  procedimento_realizado VARCHAR(10),
  carater_internacao VARCHAR(2),
  motivo_saida VARCHAR(2),
  
  -- Diagnósticos (CID-10)
  diagnostico_principal VARCHAR(4),
  diagnostico_secundario VARCHAR(4),
  diagnostico_complementar VARCHAR(4),
  diagnostico_obito VARCHAR(4),
  
  -- Dados do Paciente
  nome_paciente VARCHAR(70) NOT NULL,
  data_nascimento DATE NOT NULL,
  sexo CHAR(1) NOT NULL,
  raca_cor VARCHAR(2),
  cns VARCHAR(15),
  cpf VARCHAR(11),
  nome_mae VARCHAR(70),
  nome_responsavel VARCHAR(70),
  
  -- Endereço do Paciente
  logradouro VARCHAR(50),
  numero_endereco VARCHAR(7),
  complemento VARCHAR(15),
  bairro VARCHAR(30),
  codigo_municipio VARCHAR(6),
  uf CHAR(2),
  cep VARCHAR(8),
  
  -- Dados Hospitalares
  prontuario VARCHAR(15),
  enfermaria VARCHAR(4),
  leito VARCHAR(4),
  
  -- Médicos
  medico_solicitante VARCHAR(15),
  medico_responsavel VARCHAR(15),
  
  -- Constraint de unicidade
  CONSTRAINT aih_registros_numero_aih_unique UNIQUE (numero_aih)
);

-- ================================================================
-- ÍNDICES PARA MELHORAR PERFORMANCE
-- ================================================================

-- Índice para busca por nome de paciente
CREATE INDEX IF NOT EXISTS idx_aih_nome_paciente 
  ON aih_registros(nome_paciente);

-- Índice para busca por CNS
CREATE INDEX IF NOT EXISTS idx_aih_cns 
  ON aih_registros(cns);

-- Índice para busca por CPF
CREATE INDEX IF NOT EXISTS idx_aih_cpf 
  ON aih_registros(cpf);

-- Índice para busca por data de internação (ordem decrescente)
CREATE INDEX IF NOT EXISTS idx_aih_data_internacao 
  ON aih_registros(data_internacao DESC);

-- Índice para filtro por CNES do hospital
CREATE INDEX IF NOT EXISTS idx_aih_cnes_hospital 
  ON aih_registros(cnes_hospital);

-- Índice para busca por nome da mãe
CREATE INDEX IF NOT EXISTS idx_aih_nome_mae 
  ON aih_registros(nome_mae);

-- Índice para ordenação por data de criação
CREATE INDEX IF NOT EXISTS idx_aih_created_at 
  ON aih_registros(created_at DESC);

-- Índice composto para busca por tipo e data
CREATE INDEX IF NOT EXISTS idx_aih_tipo_data 
  ON aih_registros(tipo_aih, data_internacao DESC);

-- ================================================================
-- TRIGGER PARA ATUALIZAR UPDATED_AT AUTOMATICAMENTE
-- ================================================================

-- Função para atualizar o campo updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger que chama a função antes de cada UPDATE
DROP TRIGGER IF EXISTS update_aih_registros_updated_at ON aih_registros;
CREATE TRIGGER update_aih_registros_updated_at 
  BEFORE UPDATE ON aih_registros 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ================================================================

COMMENT ON TABLE aih_registros IS 'Registros de AIH do sistema SISAIH01 do DATASUS - Layout posicional';
COMMENT ON COLUMN aih_registros.numero_aih IS 'Número único da AIH (13 dígitos)';
COMMENT ON COLUMN aih_registros.cns IS 'Cartão Nacional de Saúde (15 dígitos)';
COMMENT ON COLUMN aih_registros.tipo_aih IS '01=Principal, 03=Continuação, 05=Longa Permanência';
COMMENT ON COLUMN aih_registros.data_internacao IS 'Data de admissão do paciente';
COMMENT ON COLUMN aih_registros.data_saida IS 'Data de alta/saída do paciente';
COMMENT ON COLUMN aih_registros.diagnostico_principal IS 'Código CID-10 do diagnóstico principal';
COMMENT ON COLUMN aih_registros.procedimento_realizado IS 'Código do procedimento realizado conforme tabela SUS';

-- ================================================================
-- VIEWS ÚTEIS PARA ANÁLISE
-- ================================================================

-- View para estatísticas gerais
CREATE OR REPLACE VIEW aih_registros_stats AS
SELECT 
  COUNT(*) as total_registros,
  COUNT(DISTINCT cns) as pacientes_unicos,
  COUNT(CASE WHEN sexo = 'M' THEN 1 END) as total_masculino,
  COUNT(CASE WHEN sexo = 'F' THEN 1 END) as total_feminino,
  COUNT(CASE WHEN tipo_aih = '01' THEN 1 END) as tipo_principal,
  COUNT(CASE WHEN tipo_aih = '03' THEN 1 END) as tipo_continuacao,
  COUNT(CASE WHEN tipo_aih = '05' THEN 1 END) as tipo_longa_permanencia,
  MIN(data_internacao) as primeira_internacao,
  MAX(data_internacao) as ultima_internacao
FROM aih_registros;

-- View para análise por hospital
CREATE OR REPLACE VIEW aih_registros_por_hospital AS
SELECT 
  cnes_hospital,
  COUNT(*) as total_aihs,
  COUNT(DISTINCT cns) as pacientes_unicos,
  COUNT(CASE WHEN sexo = 'M' THEN 1 END) as masculino,
  COUNT(CASE WHEN sexo = 'F' THEN 1 END) as feminino,
  MIN(data_internacao) as primeira_internacao,
  MAX(data_internacao) as ultima_internacao
FROM aih_registros
WHERE cnes_hospital IS NOT NULL
GROUP BY cnes_hospital
ORDER BY total_aihs DESC;

-- View para análise por diagnóstico (Top 10)
CREATE OR REPLACE VIEW aih_registros_top_diagnosticos AS
SELECT 
  diagnostico_principal,
  COUNT(*) as quantidade,
  COUNT(DISTINCT cns) as pacientes_diferentes,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM aih_registros), 2) as percentual
FROM aih_registros
WHERE diagnostico_principal IS NOT NULL AND diagnostico_principal != ''
GROUP BY diagnostico_principal
ORDER BY quantidade DESC
LIMIT 10;

-- ================================================================
-- PERMISSÕES (RLS - Row Level Security)
-- ================================================================

-- Habilitar RLS na tabela
ALTER TABLE aih_registros ENABLE ROW LEVEL SECURITY;

-- Política para leitura: todos os usuários autenticados podem ler
CREATE POLICY "Usuários autenticados podem ler aih_registros"
  ON aih_registros
  FOR SELECT
  TO authenticated
  USING (true);

-- Política para inserção: apenas usuários autenticados podem inserir
CREATE POLICY "Usuários autenticados podem inserir aih_registros"
  ON aih_registros
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política para atualização: apenas usuários autenticados podem atualizar
CREATE POLICY "Usuários autenticados podem atualizar aih_registros"
  ON aih_registros
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política para deleção: apenas usuários autenticados podem deletar
CREATE POLICY "Usuários autenticados podem deletar aih_registros"
  ON aih_registros
  FOR DELETE
  TO authenticated
  USING (true);

-- ================================================================
-- VERIFICAÇÕES FINAIS
-- ================================================================

-- Verificar se a tabela foi criada corretamente
SELECT 
  table_name,
  column_name,
  data_type,
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'aih_registros'
ORDER BY ordinal_position;

-- Verificar índices criados
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'aih_registros';

-- ================================================================
-- FIM DO SCRIPT
-- ================================================================

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Tabela aih_registros criada com sucesso!';
  RAISE NOTICE '✅ Índices criados para otimização de buscas';
  RAISE NOTICE '✅ Trigger de updated_at configurado';
  RAISE NOTICE '✅ Views analíticas criadas';
  RAISE NOTICE '✅ RLS (Row Level Security) habilitado';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Execute SELECT * FROM aih_registros_stats para ver estatísticas';
  RAISE NOTICE '🏥 Execute SELECT * FROM aih_registros_por_hospital para análise por hospital';
  RAISE NOTICE '🩺 Execute SELECT * FROM aih_registros_top_diagnosticos para top diagnósticos';
END $$;

