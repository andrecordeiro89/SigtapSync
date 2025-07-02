-- ================================================================
-- CRIAR TABELA AUDIT_LOGS SE NÃO EXISTIR
-- ================================================================
-- Baseado na estrutura definida nos tipos TypeScript

-- 1. VERIFICAR SE TABELA EXISTE
SELECT 
  'VERIFICAÇÃO AUDIT_LOGS' as categoria,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') 
    THEN '✅ Tabela audit_logs EXISTE'
    ELSE '❌ Tabela audit_logs NÃO EXISTE - será criada'
  END as status;

-- 2. CRIAR TABELA AUDIT_LOGS SE NÃO EXISTIR
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', etc.
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[] DEFAULT '{}',
  user_id UUID,
  hospital_id UUID,
  ip_address INET,
  user_agent TEXT,
  operation_type VARCHAR(100),
  session_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CRIAR ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_hospital_id ON audit_logs(hospital_id);

-- 4. GARANTIR PERMISSÕES
GRANT ALL ON TABLE audit_logs TO anon;
GRANT ALL ON TABLE audit_logs TO authenticated;
GRANT ALL ON TABLE audit_logs TO service_role;

-- 5. DESABILITAR RLS TEMPORARIAMENTE
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- 6. VERIFICAR ESTRUTURA CRIADA
SELECT 
  'ESTRUTURA AUDIT_LOGS' as categoria,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'audit_logs' 
ORDER BY ordinal_position;

-- 7. TESTE DE INSERÇÃO
DO $$
BEGIN
    BEGIN
        -- Teste de inserção
        INSERT INTO audit_logs (
            table_name,
            record_id,
            action,
            new_values,
            changed_fields,
            user_id,
            hospital_id,
            ip_address,
            user_agent,
            operation_type,
            session_id
        ) VALUES (
            'test_table',
            'test-id',
            'TEST',
            '{"test": "value"}'::jsonb,
            ARRAY['test_field'],
            null,
            null,
            '127.0.0.1',
            'Test User Agent',
            'TEST_OPERATION',
            'test-session-' || extract(epoch from now())
        );
        
        RAISE NOTICE '✅ TESTE DE INSERÇÃO: SUCESSO';
        
        -- Remover registro de teste
        DELETE FROM audit_logs WHERE table_name = 'test_table';
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ TESTE DE INSERÇÃO: FALHOU - %', SQLERRM;
    END;
END $$;

-- 8. STATUS FINAL
SELECT 
  'STATUS FINAL' as categoria,
  'Tabela audit_logs pronta para uso' as resultado; 