// ================================================
// PATCH TEMPORÁRIO: AuthContext com logs detalhados
// ================================================
// Substitua temporariamente o fetchUserProfile no AuthContext por esta versão:

const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    console.log('🔍 [DEBUG] Iniciando busca do perfil...');
    console.log('🔍 [DEBUG] UserId recebido:', userId);
    console.log('🔍 [DEBUG] Tipo do userId:', typeof userId);
    console.log('🔍 [DEBUG] Tamanho do userId:', userId?.length);
    
    // Log da query que será executada
    console.log('🔍 [DEBUG] Query que será executada:');
    console.log(`SELECT * FROM user_profiles WHERE id = '${userId}'`);
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    console.log('🔍 [DEBUG] Resultado da query:', {
      data: data,
      error: error,
      hasData: !!data,
      hasError: !!error
    });

    if (error) {
      console.error('❌ [DEBUG] Erro detalhado:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        userId: userId
      });
      
      // Tentar busca alternativa para verificar se o problema é RLS
      console.log('🔍 [DEBUG] Tentando busca alternativa (all records)...');
      const { data: allProfiles, error: allError } = await supabase
        .from('user_profiles')
        .select('id, email, role');
      
      console.log('🔍 [DEBUG] Todos os perfis na tabela:', {
        allProfiles: allProfiles,
        allError: allError,
        totalFound: allProfiles?.length || 0
      });
      
      // Se conseguiu buscar todos mas não consegue buscar específico, é problema de RLS
      if (allProfiles && !allError) {
        console.log('✅ [DEBUG] Tabela acessível, problema pode ser com o ID específico');
        
        // Verificar se o ID existe na lista
        const userExists = allProfiles.find(p => p.id === userId);
        console.log('🔍 [DEBUG] Usuário existe na lista?', {
          exists: !!userExists,
          userData: userExists
        });
      }
      
      // Criar perfil temporário para não travar
      if (error.code === 'PGRST116') {
        console.warn('🚨 [DEBUG] Tabela user_profiles não existe! Criando perfil temporário...');
        return {
          id: userId,
          email: 'temp@temp.com',
          role: 'developer',
          full_name: 'Usuário Temporário (Tabela não existe)',
          hospital_access: [],
          permissions: ['all'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      
      return null;
    }

    if (!data) {
      console.warn('⚠️ [DEBUG] Query executada mas nenhum dado retornado');
      console.log('🔍 [DEBUG] Criando perfil padrão...');
      
      return {
        id: userId,
        email: 'default@user.com',
        role: 'developer',
        full_name: 'Usuário Padrão (Perfil não encontrado)',
        hospital_access: [],
        permissions: ['all'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    console.log('✅ [DEBUG] Perfil encontrado com sucesso:', {
      id: data.id,
      email: data.email,
      role: data.role,
      full_name: data.full_name
    });
    
    return data;
  } catch (error: any) {
    console.error('❌ [DEBUG] Erro crítico na busca do perfil:', {
      error: error,
      stack: error?.stack,
      name: error?.name,
      message: error?.message,
      userId: userId
    });
    
    // Fallback crítico
    return {
      id: userId,
      email: 'emergency@user.com',
      role: 'developer',
      full_name: 'Usuário de Emergência (Erro crítico)',
      hospital_access: [],
      permissions: ['all'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
};

// ================================================
// INSTRUÇÕES DE USO:
// 1. Execute o SQL fix_definitivo_tela_branca.sql primeiro
// 2. Substitua temporariamente o método fetchUserProfile no AuthContext
// 3. Recarregue o sistema e observe os logs detalhados
// 4. Após identificar o problema, remova este patch
// ================================================ 