// 🔍 DEBUG SCRIPT - Visibilidade do Botão de Exclusão
// Cole este script no console do navegador (F12) quando estiver na tela de PatientManagement

console.log('🚀 Iniciando debug do botão de exclusão...\n');

// 1. Verificar contexto de autenticação
function checkAuthContext() {
    console.log('1️⃣ VERIFICANDO CONTEXTO DE AUTENTICAÇÃO:');
    
    // Tentar acessar o contexto React
    try {
        const authData = window.localStorage.getItem('sb-njzqpjkkjdnmdumwlecz-auth-token');
        if (authData) {
            const parsed = JSON.parse(authData);
            console.log('✅ Token encontrado:', {
                user_id: parsed.user?.id,
                email: parsed.user?.email,
                expires_at: new Date(parsed.expires_at * 1000).toLocaleString()
            });
        } else {
            console.log('❌ Token não encontrado no localStorage');
        }
    } catch (error) {
        console.log('❌ Erro ao ler token:', error.message);
    }
    console.log('');
}

// 2. Verificar elementos DOM
function checkDOMElements() {
    console.log('2️⃣ VERIFICANDO ELEMENTOS DOM:');
    
    // Procurar por AIHs na página
    const aihElements = document.querySelectorAll('[class*="border rounded-lg p-4"]');
    console.log(`📊 AIHs encontradas na página: ${aihElements.length}`);
    
    // Procurar botões de exclusão
    const excluirButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
        btn.textContent?.includes('Excluir') || btn.textContent?.includes('🗑️')
    );
    console.log(`🗑️ Botões "Excluir" encontrados: ${excluirButtons.length}`);
    
    excluirButtons.forEach((btn, i) => {
        console.log(`   Botão ${i + 1}:`, {
            text: btn.textContent?.trim(),
            classes: btn.className,
            visible: btn.offsetParent !== null,
            style: btn.style.cssText
        });
    });
    
    // Procurar badges de valor (onde deveria estar o botão)
    const valueBadges = document.querySelectorAll('[class*="bg-green-50"][class*="border-green-200"]');
    console.log(`💰 Badges de valor encontrados: ${valueBadges.length}`);
    
    console.log('');
}

// 3. Simular condições do botão
function checkButtonConditions() {
    console.log('3️⃣ SIMULANDO CONDIÇÕES DO BOTÃO:');
    
    const testRoles = ['operator', 'coordinator', 'director', 'admin', 'auditor', 'developer'];
    
    testRoles.forEach(role => {
        const hasPermission = (role === 'operator' || role === 'coordinator' || role === 'director' || role === 'admin');
        console.log(`   Role "${role}": ${hasPermission ? '✅ Deveria ver botão' : '❌ Não deveria ver botão'}`);
    });
    
    console.log('');
}

// 4. Verificar logs do console
function checkConsoleLogs() {
    console.log('4️⃣ VERIFICANDO LOGS DE DEBUG:');
    console.log('Procure por logs com "🔍 DEBUG BOTÃO EXCLUSÃO" nas mensagens acima...');
    console.log('Se não houver logs, pode ser que:');
    console.log('  - Não há AIHs sendo renderizadas');
    console.log('  - O componente não está carregado');
    console.log('  - Há erro JavaScript bloqueando');
    console.log('');
}

// 5. Verificar dados do usuário na página
function checkPageUserData() {
    console.log('5️⃣ TENTANDO EXTRAIR DADOS DO USUÁRIO DA PÁGINA:');
    
    // Procurar por indicadores de role na página
    const roleElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent?.includes('Operador') || 
        el.textContent?.includes('Coordenador') || 
        el.textContent?.includes('Diretor') || 
        el.textContent?.includes('Admin') ||
        el.textContent?.includes('Auditor')
    );
    
    if (roleElements.length > 0) {
        console.log('🎭 Roles encontrados na página:');
        roleElements.forEach((el, i) => {
            console.log(`   ${i + 1}: "${el.textContent?.trim()}"`);
        });
    } else {
        console.log('❌ Nenhum indicador de role encontrado na página');
    }
    
    console.log('');
}

// 6. Forçar visibilidade do botão (teste)
function forceButtonVisibility() {
    console.log('6️⃣ TESTE: FORÇANDO CRIAÇÃO DE BOTÃO:');
    
    // Encontrar primeira AIH
    const firstAih = document.querySelector('[class*="border rounded-lg p-4"]');
    
    if (firstAih) {
        // Encontrar área de badges
        const badgeArea = firstAih.querySelector('[class*="flex flex-col items-end space-y-2"]');
        
        if (badgeArea) {
            // Criar botão de teste
            const testButton = document.createElement('button');
            testButton.innerHTML = '🗑️ <span>Excluir (TESTE)</span>';
            testButton.className = 'flex items-center space-x-1 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 bg-red-50 hover:bg-red-100 transition-colors text-xs px-2 py-1 border rounded';
            testButton.style.fontSize = '12px';
            testButton.style.padding = '4px 8px';
            
            testButton.onclick = () => {
                console.log('🧪 Botão de teste clicado!');
                alert('Botão funcionando! O problema pode ser com as condições de permissão.');
            };
            
            badgeArea.appendChild(testButton);
            console.log('✅ Botão de teste adicionado à primeira AIH');
        } else {
            console.log('❌ Área de badges não encontrada');
        }
    } else {
        console.log('❌ Nenhuma AIH encontrada para teste');
    }
    
    console.log('');
}

// Executar todos os testes
function runAllTests() {
    console.log('🔍 DEBUG BOTÃO DE EXCLUSÃO - RELATÓRIO COMPLETO\n');
    console.log('================================================\n');
    
    checkAuthContext();
    checkDOMElements();
    checkButtonConditions();
    checkConsoleLogs();
    checkPageUserData();
    forceButtonVisibility();
    
    console.log('✅ DEBUG CONCLUÍDO!');
    console.log('Se o botão de teste aparecer, o problema é com as permissões.');
    console.log('Se não aparecer, pode ser estrutura DOM ou dados vazios.');
}

// Auto-executar
runAllTests(); 