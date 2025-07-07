// 🔧 DIAGNÓSTICO RÁPIDO - PROCEDURE_RECORDS
// Cole este código no console do navegador (F12) e execute

console.log('🔍 INICIANDO DIAGNÓSTICO PROCEDURE_RECORDS...');

const SUPABASE_URL = 'https://fvtfxunakabdrlkocdme.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2dGZ4dW5ha2FiZHJsa29jZG1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQxOTQxNTUsImV4cCI6MjA0OTc3MDE1NX0.F8Hfnk7k9ZW7eVH1e5OJE4MCZQ1OTKtc7f3ckqJ3xQs';
const TARGET_AIH = 'b9fc1770-aa93-4430-a34c-d2f6b39e0a78';
const TARGET_HOSPITAL = 'a8978eaa-b90e-4dc8-8fd5-0af984374d34';

// Função helper para fazer requests
async function supabaseRequest(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}${queryString ? '?' + queryString : ''}`;
    
    console.log(`📡 Request: ${url}`);
    
    try {
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            console.error(`❌ HTTP ${response.status}:`, data);
            return { error: data, status: response.status };
        }
        
        console.log(`✅ Sucesso:`, data);
        return { data, status: response.status };
    } catch (error) {
        console.error(`❌ Erro de rede:`, error);
        return { error: error.message };
    }
}

// 1. Testar se tabela procedure_records existe e tem dados
async function test1_tableExists() {
    console.log('\n📋 TESTE 1: Verificando se tabela procedure_records existe...');
    
    const result = await supabaseRequest('procedure_records', {
        select: 'count',
        head: 'true'
    });
    
    if (result.error) {
        console.log('❌ Tabela não existe ou sem acesso');
        return false;
    }
    
    console.log('✅ Tabela acessível');
    return true;
}

// 2. Contar registros na tabela
async function test2_countRecords() {
    console.log('\n📊 TESTE 2: Contando registros...');
    
    const result = await supabaseRequest('procedure_records', {
        select: '*',
        limit: '1'
    });
    
    if (result.error) {
        console.log('❌ Erro ao contar registros');
        return 0;
    }
    
    console.log(`📊 Encontrados dados: ${result.data?.length || 0} registro(s) (amostra)`);
    return result.data?.length || 0;
}

// 3. Verificar registros para hospital específico
async function test3_hospitalRecords() {
    console.log('\n🏥 TESTE 3: Verificando registros do hospital...');
    
    const result = await supabaseRequest('procedure_records', {
        select: '*',
        hospital_id: `eq.${TARGET_HOSPITAL}`,
        limit: '5'
    });
    
    if (result.error) {
        console.log('❌ Erro ao buscar por hospital');
        return 0;
    }
    
    console.log(`🏥 Registros do hospital: ${result.data?.length || 0}`);
    if (result.data?.length > 0) {
        console.log('📋 Amostra:', result.data[0]);
    }
    return result.data?.length || 0;
}

// 4. Verificar registros para AIH específica
async function test4_aihRecords() {
    console.log('\n📄 TESTE 4: Verificando registros da AIH específica...');
    
    const result = await supabaseRequest('procedure_records', {
        select: '*',
        aih_id: `eq.${TARGET_AIH}`,
        order: 'procedure_sequence.asc'
    });
    
    if (result.error) {
        console.log('❌ Erro ao buscar por AIH');
        return 0;
    }
    
    console.log(`📄 Procedimentos da AIH: ${result.data?.length || 0}`);
    if (result.data?.length > 0) {
        console.log('📋 Procedimentos:', result.data);
    }
    return result.data?.length || 0;
}

// 5. Testar query com JOIN (a que está falhando)
async function test5_joinQuery() {
    console.log('\n🔗 TESTE 5: Testando query com JOIN...');
    
    const result = await supabaseRequest('procedure_records', {
        select: '*,sigtap_procedures(code,description)',
        aih_id: `eq.${TARGET_AIH}`,
        order: 'procedure_sequence.asc'
    });
    
    if (result.error) {
        console.log('❌ Query JOIN falhou:', result.error);
        return false;
    }
    
    console.log('✅ Query JOIN funcionou!');
    console.log('🔗 Dados com JOIN:', result.data);
    return true;
}

// 6. Verificar se AIH existe
async function test6_aihExists() {
    console.log('\n📄 TESTE 6: Verificando se AIH existe...');
    
    const result = await supabaseRequest('aihs', {
        select: 'id,aih_number,patient_id',
        id: `eq.${TARGET_AIH}`
    });
    
    if (result.error) {
        console.log('❌ Erro ao buscar AIH');
        return false;
    }
    
    if (result.data?.length === 0) {
        console.log('❌ AIH não encontrada!');
        return false;
    }
    
    console.log('✅ AIH encontrada:', result.data[0]);
    return true;
}

// 7. Criar dados de teste se necessário
async function test7_createTestData() {
    console.log('\n🧪 TESTE 7: Criando dados de teste...');
    
    // Primeiro verificar se a AIH existe
    const aihCheck = await supabaseRequest('aihs', {
        select: 'id,patient_id',
        id: `eq.${TARGET_AIH}`
    });
    
    if (aihCheck.error || !aihCheck.data || aihCheck.data.length === 0) {
        console.log('❌ Não é possível criar dados de teste: AIH não existe');
        return false;
    }
    
    const aih = aihCheck.data[0];
    
    const testData = [
        {
            hospital_id: TARGET_HOSPITAL,
            aih_id: TARGET_AIH,
            patient_id: aih.patient_id,
            procedure_sequence: 1,
            procedure_code: '0301010019',
            procedure_description: 'Consulta médica em atenção primária - TESTE',
            match_status: 'pending',
            match_confidence: 0.95,
            value_charged: 2200,
            professional: 'Dr. João Silva - TESTE DIAGNÓSTICO',
            professional_cbo: '225125',
            procedure_date: new Date().toISOString().split('T')[0],
            created_by: 'diagnostic-test'
        }
    ];
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/procedure_records`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(testData[0])
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            console.log('❌ Erro ao criar dados de teste:', result);
            return false;
        }
        
        console.log('✅ Dados de teste criados:', result);
        return true;
        
    } catch (error) {
        console.log('❌ Erro na criação:', error);
        return false;
    }
}

// EXECUTAR TODOS OS TESTES
async function runAllTests() {
    console.log('🚀 ================================');
    console.log('🚀 DIAGNÓSTICO COMPLETO INICIADO');
    console.log('🚀 ================================');
    
    const test1 = await test1_tableExists();
    const test2 = await test2_countRecords();
    const test3 = await test3_hospitalRecords();
    const test4 = await test4_aihRecords();
    const test5 = await test5_joinQuery();
    const test6 = await test6_aihExists();
    
    console.log('\n📊 ================================');
    console.log('📊 RESUMO DOS RESULTADOS');
    console.log('📊 ================================');
    console.log(`✅ Tabela acessível: ${test1}`);
    console.log(`📊 Tem dados gerais: ${test2 > 0}`);
    console.log(`🏥 Tem dados do hospital: ${test3 > 0}`);
    console.log(`📄 Tem dados da AIH: ${test4 > 0}`);
    console.log(`🔗 Query JOIN funciona: ${test5}`);
    console.log(`📄 AIH existe: ${test6}`);
    
    if (!test1) {
        console.log('\n🚨 PROBLEMA: Tabela procedure_records não acessível');
        console.log('💡 SOLUÇÃO: Verificar se tabela existe e políticas RLS');
        return;
    }
    
    if (!test6) {
        console.log('\n🚨 PROBLEMA: AIH alvo não existe');
        console.log('💡 SOLUÇÃO: Use uma AIH válida ou crie dados de teste');
        return;
    }
    
    if (test4 === 0) {
        console.log('\n⚠️ PROBLEMA IDENTIFICADO: Tabela vazia para esta AIH');
        console.log('💡 SOLUÇÃO: Criar dados de teste');
        
        const confirm = window.confirm('Deseja criar dados de teste agora?');
        if (confirm) {
            await test7_createTestData();
            console.log('\n🔄 Testando novamente após criar dados...');
            await test4_aihRecords();
        }
        return;
    }
    
    if (!test5) {
        console.log('\n🚨 PROBLEMA: Query JOIN está falhando');
        console.log('💡 SOLUÇÃO: Verificar relacionamentos entre tabelas');
        return;
    }
    
    console.log('\n✅ ================================');
    console.log('✅ DIAGNÓSTICO: TUDO OK!');
    console.log('✅ ================================');
    console.log('💡 O problema pode estar no frontend React');
    console.log('🔧 Verifique a função getAIHProcedures() corrigida');
}

// 🚀 EXECUTE ESTE COMANDO:
runAllTests(); 