-- ============================================================================
-- CONFIGURAÇÃO DE ROLES ELEVADOS - SIGTAP BILLING WIZARD
-- Sistema: SIGTAP Billing Wizard v3.0
-- ============================================================================

-- EXECUTE ESTE SCRIPT APÓS RECEBER A LISTA DOS OUTROS USUÁRIOS
-- (coordinator, admin, director, auditor, ti)

-- Função para configurar usuário com role elevado
CREATE OR REPLACE FUNCTION configure_elevated_user(
    p_email TEXT,
    p_role TEXT,
    p_full_name TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    user_permissions TEXT[];
    user_hospital_access TEXT[];
BEGIN
    -- Validar role
    IF p_role NOT IN ('admin', 'coordinator', 'director', 'auditor', 'ti', 'developer') THEN
        RAISE EXCEPTION 'Role inválido: %. Use: admin, coordinator, director, auditor, ti, developer', p_role;
    END IF;
    
    -- Definir permissões baseadas no role
    CASE p_role
        WHEN 'admin' THEN
            user_permissions := ARRAY['all', 'admin_access', 'user_management', 'system_config'];
            user_hospital_access := ARRAY['ALL'];
            
        WHEN 'coordinator' THEN
            user_permissions := ARRAY['coordination_access', 'manage_procedures', 'generate_reports', 'team_management'];
            user_hospital_access := ARRAY['ALL'];
            
        WHEN 'director' THEN
            user_permissions := ARRAY['executive_access', 'generate_reports', 'financial_overview', 'strategic_analysis'];
            user_hospital_access := ARRAY['ALL'];
            
        WHEN 'auditor' THEN
            user_permissions := ARRAY['audit_access', 'view_all_data', 'compliance_check', 'audit_reports'];
            user_hospital_access := ARRAY['ALL'];
            
        WHEN 'ti' THEN
            user_permissions := ARRAY['technical_access', 'system_config', 'database_access', 'backup_restore'];
            user_hospital_access := ARRAY['ALL'];
            
        WHEN 'developer' THEN
            user_permissions := ARRAY['all', 'developer_access', 'code_access', 'debug_mode'];
            user_hospital_access := ARRAY['ALL'];
    END CASE;
    
    -- Gerar nome automático se não fornecido
    IF p_full_name IS NULL THEN
        p_full_name := CASE p_role
            WHEN 'admin' THEN 'Administrador'
            WHEN 'coordinator' THEN 'Coordenador'
            WHEN 'director' THEN 'Diretor'
            WHEN 'auditor' THEN 'Auditor'
            WHEN 'ti' THEN 'Suporte TI'
            WHEN 'developer' THEN 'Desenvolvedor'
        END || ' - ' || SPLIT_PART(p_email, '@', 1);
    END IF;
    
    -- Atualizar usuário existente ou inserir novo
    UPDATE user_profiles SET
        role = p_role,
        full_name = p_full_name,
        hospital_access = user_hospital_access,
        permissions = user_permissions,
        is_active = true,
        updated_at = NOW()
    WHERE email = p_email;
    
    -- Se não encontrou usuário existente, inserir novo
    IF NOT FOUND THEN
        INSERT INTO user_profiles (
            id, email, role, full_name, hospital_access, permissions, is_active
        ) VALUES (
            gen_random_uuid(),
            p_email,
            p_role,
            p_full_name,
            user_hospital_access,
            user_permissions,
            true
        );
        
        RAISE NOTICE '✅ NOVO usuário criado: % como %', p_email, p_role;
    ELSE
        RAISE NOTICE '✅ ATUALIZADO usuário: % para %', p_email, p_role;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Exemplo de uso (descomente e ajuste conforme necessário):
-- Quando você receber a lista dos outros usuários, use assim:

/*
-- EXEMPLOS DE CONFIGURAÇÃO:

-- Admins
SELECT configure_elevated_user('admin1@sigtap.com', 'admin', 'João Silva - Administrador');
SELECT configure_elevated_user('admin2@sigtap.com', 'admin', 'Maria Santos - Administradora');

-- Coordinators  
SELECT configure_elevated_user('coord1@sigtap.com', 'coordinator', 'Pedro Costa - Coordenador');
SELECT configure_elevated_user('coord2@sigtap.com', 'coordinator', 'Ana Lima - Coordenadora');

-- Directors
SELECT configure_elevated_user('director1@sigtap.com', 'director', 'Carlos Diretor');
SELECT configure_elevated_user('director2@sigtap.com', 'director', 'Lucia Diretora');

-- Auditors
SELECT configure_elevated_user('auditor1@sigtap.com', 'auditor', 'Felipe Auditor');
SELECT configure_elevated_user('auditor2@sigtap.com', 'auditor', 'Patricia Auditora');

-- TI
SELECT configure_elevated_user('ti1@sigtap.com', 'ti', 'Roberto TI');
SELECT configure_elevated_user('ti2@sigtap.com', 'ti', 'Sandra TI');

-- Developers (se houver)
SELECT configure_elevated_user('dev1@sigtap.com', 'developer', 'Bruno Desenvolvedor');
*/

-- Verificar configuração atual
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📊 FUNÇÃO configure_elevated_user() CRIADA COM SUCESSO!';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 COMO USAR:';
    RAISE NOTICE '1. Receba a lista dos usuários com roles elevados';
    RAISE NOTICE '2. Execute: SELECT configure_elevated_user(''email@sigtap.com'', ''role'', ''Nome Completo'');';
    RAISE NOTICE '3. Ou execute múltiplos comandos em lote';
    RAISE NOTICE '';
    RAISE NOTICE '📋 ROLES DISPONÍVEIS:';
    RAISE NOTICE '   • admin - Administrador do sistema';
    RAISE NOTICE '   • coordinator - Coordenador geral';
    RAISE NOTICE '   • director - Diretor executivo';
    RAISE NOTICE '   • auditor - Auditor do sistema';
    RAISE NOTICE '   • ti - Suporte técnico';
    RAISE NOTICE '   • developer - Desenvolvedor';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Pronto para receber a próxima lista de usuários!';
    RAISE NOTICE '';
END $$; 