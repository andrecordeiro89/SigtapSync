// Script para investigar os dados retornados pelo getAllDoctorsWithPatients
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Simular a lógica da função getAllDoctorsWithPatients
async function debugDashboardData() {
  console.log('🔍 === INVESTIGANDO DADOS DO DASHBOARD ===\n');
  
  try {
    // 1. Buscar AIHs diretamente
    console.log('1. 📋 Buscando AIHs...');
    const { data: aihs, error: aihError } = await supabase
      .from('aihs')
      .select('*')
      .limit(10);
    
    if (aihError) {
      console.error('❌ Erro ao buscar AIHs:', aihError);
      return;
    }
    
    console.log(`   ✅ ${aihs?.length || 0} AIHs encontradas`);
    
    if (aihs && aihs.length > 0) {
      console.log('   📝 Exemplo de AIH:');
      const exampleAIH = aihs[0];
      console.log(`      ID: ${exampleAIH.id}`);
      console.log(`      CNS Responsável: ${exampleAIH.cns_responsavel}`);
      console.log(`      CNS Solicitante: ${exampleAIH.cns_solicitante}`);
      console.log(`      CNS Autorizador: ${exampleAIH.cns_autorizador}`);
      console.log(`      Hospital: ${exampleAIH.hospital_id}`);
    }
    
    // 2. Verificar médicos cadastrados
    console.log('\n2. 👨‍⚕️ Verificando médicos cadastrados...');
    const { data: doctors, error: doctorsError } = await supabase
      .from('doctors')
      .select('*')
      .limit(10);
    
    if (doctorsError) {
      console.error('❌ Erro ao buscar médicos:', doctorsError);
    } else {
      console.log(`   ✅ ${doctors?.length || 0} médicos encontrados`);
      
      if (doctors && doctors.length > 0) {
        console.log('   📝 Exemplo de médico:');
        const exampleDoctor = doctors[0];
        console.log(`      Nome: ${exampleDoctor.name}`);
        console.log(`      CNS: ${exampleDoctor.cns}`);
        console.log(`      CRM: ${exampleDoctor.crm}`);
        console.log(`      Especialidade: ${exampleDoctor.specialty}`);
      }
    }
    
    // 3. Simular a lógica de priorização de CNS
    console.log('\n3. 🎯 Simulando lógica de priorização de CNS...');
    
    const cnsStats = {
      'NAO_IDENTIFICADO': 0,
      'com_cns_responsavel': 0,
      'com_cns_solicitante': 0,
      'com_cns_autorizador': 0,
      'total_aihs': aihs?.length || 0
    };
    
    const uniqueCNSValues = new Set();
    const doctorCNSMap = new Map();
    
    // Mapear CNS dos médicos cadastrados
    if (doctors) {
      doctors.forEach(doctor => {
        doctorCNSMap.set(doctor.cns, doctor);
      });
    }
    
    if (aihs) {
      aihs.forEach(aih => {
        let selectedCNS = null;
        
        // Lógica de priorização (igual ao código original)
        if (aih.cns_responsavel && aih.cns_responsavel.trim() !== '') {
          selectedCNS = aih.cns_responsavel;
          cnsStats.com_cns_responsavel++;
        } else if (aih.cns_solicitante && aih.cns_solicitante.trim() !== '') {
          selectedCNS = aih.cns_solicitante;
          cnsStats.com_cns_solicitante++;
        } else if (aih.cns_autorizador && aih.cns_autorizador.trim() !== '') {
          selectedCNS = aih.cns_autorizador;
          cnsStats.com_cns_autorizador++;
        } else {
          selectedCNS = 'NAO_IDENTIFICADO';
          cnsStats['NAO_IDENTIFICADO']++;
        }
        
        uniqueCNSValues.add(selectedCNS);
      });
    }
    
    console.log('   📊 Estatísticas de CNS:');
    console.log(`      Total AIHs: ${cnsStats.total_aihs}`);
    console.log(`      Com CNS Responsável: ${cnsStats.com_cns_responsavel}`);
    console.log(`      Com CNS Solicitante: ${cnsStats.com_cns_solicitante}`);
    console.log(`      Com CNS Autorizador: ${cnsStats.com_cns_autorizador}`);
    console.log(`      Não Identificado: ${cnsStats['NAO_IDENTIFICADO']}`);
    console.log(`      CNS únicos encontrados: ${uniqueCNSValues.size}`);
    
    // 4. Verificar quais CNS estão cadastrados
    console.log('\n4. 🔍 Verificando CNS cadastrados vs não cadastrados...');
    
    const registeredCNS = [];
    const unregisteredCNS = [];
    
    uniqueCNSValues.forEach(cns => {
      if (cns === 'NAO_IDENTIFICADO') {
        return; // Pular este caso especial
      }
      
      if (doctorCNSMap.has(cns)) {
        registeredCNS.push({
          cns,
          doctor: doctorCNSMap.get(cns)
        });
      } else {
        unregisteredCNS.push(cns);
      }
    });
    
    console.log(`   ✅ CNS cadastrados: ${registeredCNS.length}`);
    registeredCNS.forEach(item => {
      console.log(`      ${item.cns} → ${item.doctor.name}`);
    });
    
    console.log(`   ❌ CNS não cadastrados: ${unregisteredCNS.length}`);
    unregisteredCNS.forEach(cns => {
      console.log(`      ${cns}`);
    });
    
    // 5. Análise final
    console.log('\n5. 📋 ANÁLISE FINAL:');
    
    if (cnsStats['NAO_IDENTIFICADO'] > 0) {
      console.log(`   🚨 PROBLEMA IDENTIFICADO: ${cnsStats['NAO_IDENTIFICADO']} AIHs sem CNS válido`);
      console.log('   💡 CAUSA: AIHs não possuem cns_responsavel, cns_solicitante nem cns_autorizador');
      console.log('   🔧 SOLUÇÃO: Verificar o processo de extração/importação das AIHs');
    }
    
    if (unregisteredCNS.length > 0) {
      console.log(`   ⚠️ PROBLEMA SECUNDÁRIO: ${unregisteredCNS.length} CNS não cadastrados na tabela doctors`);
      console.log('   💡 CAUSA: Médicos com CNS válido mas não cadastrados no sistema');
      console.log('   🔧 SOLUÇÃO: Cadastrar estes médicos ou implementar cadastro automático');
    }
    
    if (cnsStats['NAO_IDENTIFICADO'] === 0 && unregisteredCNS.length === 0) {
      console.log('   ✅ DADOS PARECEM CORRETOS: Todos os CNS são válidos e estão cadastrados');
      console.log('   🔍 INVESTIGAR: O problema pode estar na exibição/filtros do dashboard');
    }
    
    // 6. Verificar se há "Médico Não Identificado" sendo exibido incorretamente
    console.log('\n6. 🎭 Verificando exibição de "Médico Não Identificado"...');
    
    const hasNaoIdentificado = uniqueCNSValues.has('NAO_IDENTIFICADO');
    console.log(`   CNS 'NAO_IDENTIFICADO' presente: ${hasNaoIdentificado}`);
    
    if (hasNaoIdentificado) {
      console.log('   ✅ CORRETO: "Médico Não Identificado" deve aparecer no dashboard');
    } else {
      console.log('   🚨 PROBLEMA: "Médico Não Identificado" NÃO deveria aparecer!');
      console.log('   🔍 INVESTIGAR: Lógica de exibição no componente React');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a investigação:', error);
  }
}

// Executar o debug
debugDashboardData().then(() => {
  console.log('\n🏁 Investigação concluída!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});