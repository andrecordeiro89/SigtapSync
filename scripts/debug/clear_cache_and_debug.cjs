// Script para limpar cache e investigar dados residuais do "Médico Não Identificado"
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function clearCacheAndDebug() {
  try {
    console.log('🧹 === LIMPEZA DE CACHE E DEBUG ===\n');
    
    // 1. Verificar se há AIHs sem CNS (que criariam NAO_IDENTIFICADO)
    console.log('1. 🔍 Verificando AIHs sem CNS...');
    const { data: aihsWithoutCNS, error: aihError } = await supabase
      .from('v_aihs_with_doctors')
      .select('id, aih_number, cns_responsavel, cns_solicitante, cns_autorizador')
      .is('cns_responsavel', null)
      .is('cns_solicitante', null)
      .is('cns_autorizador', null);
    
    if (aihError) {
      console.error('❌ Erro ao buscar AIHs:', aihError.message);
    } else {
      console.log(`📊 AIHs sem nenhum CNS: ${aihsWithoutCNS?.length || 0}`);
      if (aihsWithoutCNS && aihsWithoutCNS.length > 0) {
        console.log('🚨 PROBLEMA ENCONTRADO: Existem AIHs sem CNS!');
        aihsWithoutCNS.slice(0, 5).forEach((aih, index) => {
          console.log(`   ${index + 1}. AIH ${aih.aih_number} (ID: ${aih.id})`);
        });
      } else {
        console.log('✅ Todas as AIHs têm pelo menos um CNS');
      }
    }
    
    // 2. Verificar se há médicos com CNS NAO_IDENTIFICADO na tabela doctors
    console.log('\n2. 🔍 Verificando médicos com CNS NAO_IDENTIFICADO...');
    const { data: naoIdentificadoDoctors, error: doctorError } = await supabase
      .from('doctors')
      .select('*')
      .eq('cns', 'NAO_IDENTIFICADO');
    
    if (doctorError) {
      console.error('❌ Erro ao buscar médicos:', doctorError.message);
    } else {
      console.log(`📊 Médicos com CNS NAO_IDENTIFICADO: ${naoIdentificadoDoctors?.length || 0}`);
      if (naoIdentificadoDoctors && naoIdentificadoDoctors.length > 0) {
        console.log('🚨 PROBLEMA ENCONTRADO: Existe médico NAO_IDENTIFICADO na tabela!');
        naoIdentificadoDoctors.forEach((doctor, index) => {
          console.log(`   ${index + 1}. ${doctor.name} (ID: ${doctor.id})`);
        });
      } else {
        console.log('✅ Não há médicos NAO_IDENTIFICADO na tabela doctors');
      }
    }
    
    // 3. Simular a lógica do getAllDoctorsWithPatients para ver se cria NAO_IDENTIFICADO
    console.log('\n3. 🔍 Simulando lógica de criação de médicos...');
    const { data: allAihs, error: allAihsError } = await supabase
      .from('v_aihs_with_doctors')
      .select('cns_responsavel, cns_solicitante, cns_autorizador')
      .limit(100);
    
    if (allAihsError) {
      console.error('❌ Erro ao buscar AIHs:', allAihsError.message);
    } else {
      const allDoctorsCns = new Set();
      let aihsWithoutAnyCNS = 0;
      
      allAihs.forEach(aih => {
        let fallbackCns = null;
        
        // Lógica exata do doctorPatientService
        if (aih.cns_responsavel) {
          fallbackCns = aih.cns_responsavel;
        } else if (aih.cns_solicitante) {
          fallbackCns = aih.cns_solicitante;
        } else if (aih.cns_autorizador) {
          fallbackCns = aih.cns_autorizador;
        }
        
        if (fallbackCns) {
          allDoctorsCns.add(fallbackCns);
        } else {
          // Esta é a condição que cria NAO_IDENTIFICADO
          allDoctorsCns.add('NAO_IDENTIFICADO');
          aihsWithoutAnyCNS++;
        }
      });
      
      console.log(`📊 CNS únicos encontrados: ${allDoctorsCns.size}`);
      console.log(`🚨 AIHs que criariam NAO_IDENTIFICADO: ${aihsWithoutAnyCNS}`);
      
      if (allDoctorsCns.has('NAO_IDENTIFICADO')) {
        console.log('🚨 PROBLEMA CONFIRMADO: A lógica está criando NAO_IDENTIFICADO!');
        console.log('💡 CAUSA: Existem AIHs sem nenhum CNS válido');
      } else {
        console.log('✅ A lógica NÃO está criando NAO_IDENTIFICADO');
      }
    }
    
    // 4. Verificar dados específicos do paciente SERGIO DONIZETE TEXEIRA
    console.log('\n4. 🔍 Verificando dados do paciente SERGIO DONIZETE TEXEIRA...');
    const { data: sergioData, error: sergioError } = await supabase
      .from('v_aihs_with_doctors')
      .select('*')
      .ilike('patients.name', '%SERGIO DONIZETE TEXEIRA%');
    
    if (sergioError) {
      console.error('❌ Erro ao buscar dados do Sergio:', sergioError.message);
    } else {
      console.log(`📊 AIHs do SERGIO encontradas: ${sergioData?.length || 0}`);
      if (sergioData && sergioData.length > 0) {
        sergioData.forEach((aih, index) => {
          console.log(`   AIH ${index + 1}:`);
          console.log(`     CNS Responsável: ${aih.cns_responsavel || 'NULO'}`);
          console.log(`     CNS Solicitante: ${aih.cns_solicitante || 'NULO'}`);
          console.log(`     CNS Autorizador: ${aih.cns_autorizador || 'NULO'}`);
        });
      }
    }
    
    // 5. Recomendações
    console.log('\n🎯 === RECOMENDAÇÕES ===');
    console.log('1. 🧹 Limpe o cache do navegador (Ctrl+Shift+Delete)');
    console.log('2. 🔄 Reinicie o servidor de desenvolvimento');
    console.log('3. 🗑️ Limpe o localStorage: localStorage.clear()');
    console.log('4. 📱 Teste em uma aba anônima/privada');
    console.log('5. 🔍 Verifique se há dados antigos em cache do React Query/SWR');
    
    if (aihsWithoutCNS && aihsWithoutCNS.length > 0) {
      console.log('\n🚨 AÇÃO NECESSÁRIA:');
      console.log('   Existem AIHs sem CNS que estão criando o "Médico Não Identificado"');
      console.log('   Você precisa corrigir esses dados ou ajustar a lógica de fallback');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a limpeza e debug:', error);
  }
}

clearCacheAndDebug();