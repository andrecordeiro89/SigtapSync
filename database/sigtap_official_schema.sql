-- ================================================
-- SIGTAP OFICIAL - SCHEMA AUXILIAR
-- Tabelas para dados estruturados oficiais do DATASUS
-- ================================================

-- ================================================
-- TABELAS DE REFERÊNCIA OFICIAL
-- ================================================

-- Tipos de Financiamento Oficial
CREATE TABLE sigtap_financiamento (
  codigo VARCHAR(2) PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  competencia VARCHAR(6) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Modalidades Oficial
CREATE TABLE sigtap_modalidade (
  codigo VARCHAR(2) PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  competencia VARCHAR(6) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grupos Oficial
CREATE TABLE sigtap_grupos (
  codigo VARCHAR(2) PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  competencia VARCHAR(6) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subgrupos Oficial
CREATE TABLE sigtap_subgrupos (
  codigo_grupo VARCHAR(2) NOT NULL,
  codigo_subgrupo VARCHAR(2) NOT NULL,
  nome VARCHAR(100) NOT NULL,
  competencia VARCHAR(6) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (codigo_grupo, codigo_subgrupo),
  FOREIGN KEY (codigo_grupo) REFERENCES sigtap_grupos(codigo)
);

-- CIDs Oficial
CREATE TABLE sigtap_cids (
  codigo VARCHAR(10) PRIMARY KEY,
  nome VARCHAR(500) NOT NULL,
  competencia VARCHAR(6) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CBOs/Ocupações Oficial
CREATE TABLE sigtap_ocupacoes (
  codigo VARCHAR(10) PRIMARY KEY,
  nome VARCHAR(500) NOT NULL,
  competencia VARCHAR(6) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- TABELA PRINCIPAL OFICIAL (PARA REFERÊNCIA)
-- ================================================
CREATE TABLE sigtap_procedimentos_oficial (
  codigo VARCHAR(10) PRIMARY KEY,
  nome VARCHAR(250) NOT NULL,
  complexidade CHAR(1) NOT NULL, -- 1=Básica, 2=Média, 3=Alta
  sexo CHAR(1), -- A=Ambos, M=Masculino, F=Feminino
  quantidade_maxima INTEGER,
  dias_permanencia INTEGER,
  pontos INTEGER,
  idade_minima INTEGER,
  idade_maxima INTEGER,
  valor_sh DECIMAL(10,2),
  valor_sa DECIMAL(10,2),
  valor_sp DECIMAL(10,2),
  codigo_financiamento VARCHAR(2),
  codigo_rubrica VARCHAR(6),
  tempo_permanencia INTEGER,
  competencia VARCHAR(6) NOT NULL,
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign Keys
  FOREIGN KEY (codigo_financiamento) REFERENCES sigtap_financiamento(codigo)
);

-- ================================================
-- TABELAS DE RELACIONAMENTO OFICIAL
-- ================================================

-- Procedimentos x CID
CREATE TABLE sigtap_procedimento_cid (
  codigo_procedimento VARCHAR(10) NOT NULL,
  codigo_cid VARCHAR(10) NOT NULL,
  competencia VARCHAR(6) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (codigo_procedimento, codigo_cid),
  FOREIGN KEY (codigo_procedimento) REFERENCES sigtap_procedimentos_oficial(codigo),
  FOREIGN KEY (codigo_cid) REFERENCES sigtap_cids(codigo)
);

-- Procedimentos x CBO/Ocupação
CREATE TABLE sigtap_procedimento_ocupacao (
  codigo_procedimento VARCHAR(10) NOT NULL,
  codigo_ocupacao VARCHAR(10) NOT NULL,
  competencia VARCHAR(6) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (codigo_procedimento, codigo_ocupacao),
  FOREIGN KEY (codigo_procedimento) REFERENCES sigtap_procedimentos_oficial(codigo),
  FOREIGN KEY (codigo_ocupacao) REFERENCES sigtap_ocupacoes(codigo)
);

-- Procedimentos x Modalidade
CREATE TABLE sigtap_procedimento_modalidade (
  codigo_procedimento VARCHAR(10) NOT NULL,
  codigo_modalidade VARCHAR(2) NOT NULL,
  competencia VARCHAR(6) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (codigo_procedimento, codigo_modalidade),
  FOREIGN KEY (codigo_procedimento) REFERENCES sigtap_procedimentos_oficial(codigo),
  FOREIGN KEY (codigo_modalidade) REFERENCES sigtap_modalidade(codigo)
);

-- ================================================
-- FUNÇÃO DE CONVERSÃO DE DADOS
-- ================================================

-- Converte código de complexidade para nome
CREATE OR REPLACE FUNCTION convert_complexidade(codigo CHAR(1)) 
RETURNS VARCHAR(50) AS $$
BEGIN
  CASE codigo
    WHEN '1' THEN RETURN 'ATENÇÃO BÁSICA';
    WHEN '2' THEN RETURN 'MÉDIA COMPLEXIDADE';
    WHEN '3' THEN RETURN 'ALTA COMPLEXIDADE';
    ELSE RETURN 'NÃO INFORMADO';
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Converte código de sexo para formato padrão
CREATE OR REPLACE FUNCTION convert_sexo(codigo CHAR(1)) 
RETURNS VARCHAR(10) AS $$
BEGIN
  CASE codigo
    WHEN 'A' THEN RETURN 'AMBOS';
    WHEN 'M' THEN RETURN 'M';
    WHEN 'F' THEN RETURN 'F';
    ELSE RETURN NULL;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- VIEW PARA CONVERSÃO AUTOMÁTICA
-- ================================================
CREATE OR REPLACE VIEW v_sigtap_procedimentos_convertidos AS
SELECT 
  p.codigo,
  p.nome as description,
  convert_complexidade(p.complexidade) as complexity,
  convert_sexo(p.sexo) as gender,
  m.nome as modality,
  f.nome as financing,
  p.quantidade_maxima as max_quantity,
  p.dias_permanencia as average_stay,
  p.pontos,
  p.idade_minima as min_age,
  p.idade_maxima as max_age,
  (p.valor_sa * 100)::INTEGER as value_amb, -- converter para centavos
  (p.valor_sh * 100)::INTEGER as value_hosp, -- converter para centavos
  (p.valor_sp * 100)::INTEGER as value_prof, -- converter para centavos
  p.competencia,
  
  -- Arrays de CIDs e CBOs relacionados
  ARRAY(
    SELECT pc.codigo_cid 
    FROM sigtap_procedimento_cid pc 
    WHERE pc.codigo_procedimento = p.codigo
  ) as cid_array,
  
  ARRAY(
    SELECT po.codigo_ocupacao 
    FROM sigtap_procedimento_ocupacao po 
    WHERE po.codigo_procedimento = p.codigo
  ) as cbo_array
  
FROM sigtap_procedimentos_oficial p
LEFT JOIN sigtap_financiamento f ON p.codigo_financiamento = f.codigo
LEFT JOIN sigtap_procedimento_modalidade pm ON p.codigo = pm.codigo_procedimento
LEFT JOIN sigtap_modalidade m ON pm.codigo_modalidade = m.codigo;

-- ================================================
-- ÍNDICES PARA PERFORMANCE
-- ================================================
CREATE INDEX idx_sigtap_procedimentos_oficial_codigo ON sigtap_procedimentos_oficial(codigo);
CREATE INDEX idx_sigtap_procedimentos_oficial_complexidade ON sigtap_procedimentos_oficial(complexidade);
CREATE INDEX idx_sigtap_procedimentos_oficial_competencia ON sigtap_procedimentos_oficial(competencia);

CREATE INDEX idx_sigtap_procedimento_cid_procedimento ON sigtap_procedimento_cid(codigo_procedimento);
CREATE INDEX idx_sigtap_procedimento_cid_cid ON sigtap_procedimento_cid(codigo_cid);

CREATE INDEX idx_sigtap_procedimento_ocupacao_procedimento ON sigtap_procedimento_ocupacao(codigo_procedimento);
CREATE INDEX idx_sigtap_procedimento_ocupacao_ocupacao ON sigtap_procedimento_ocupacao(codigo_ocupacao);

-- ================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ================================================
COMMENT ON TABLE sigtap_procedimentos_oficial IS 'Tabela oficial de procedimentos SIGTAP importada do ZIP DATASUS';
COMMENT ON TABLE sigtap_financiamento IS 'Códigos oficiais de financiamento SIGTAP';
COMMENT ON TABLE sigtap_modalidade IS 'Códigos oficiais de modalidade SIGTAP';
COMMENT ON VIEW v_sigtap_procedimentos_convertidos IS 'View que converte dados oficiais para formato compatível com schema atual'; 