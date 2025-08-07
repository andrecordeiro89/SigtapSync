// Script para investigar profundamente o problema do "Médico Não Identificado"
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function debugMedicoNaoIdentificado() {
  try {
    console.log('🔍 === INVESTIGAÇÃO PROFUNDA: MÉDICO NÃO IDENTIFICADO ===\n');
    
    // 1. Verificar AIHs sem CNS (todas as variações)
    console.log('1. 🔍 Verificando AIHs sem CNS...');
    
    const { data: aihsSemCns, error: aihsError } = await supabase
      .from('aihs')
      .select('id, aih_number, cns_responsavel, cns_solicitante, cns_autorizador')
      .or('cns_responsavel.is.null,cns_solicitante.is.null,cns_autorizador.is.null')
      .limit(10);
    
    if (aihsError) {
      console.error('❌ Erro ao buscar AIHs:', aihsError.message);
    } else {
      console.log(`📊 AIHs com pelo menos um CNS NULL: ${aihsSemCns?.length || 0}`);
      
      if (aihsSemCns && aihsSemCns.length > 0) {
        console.log('\n📋 Exemplos de AIHs problemáticas:');
        aihsSemCns.slice(0, 5).forEach((aih, index) => {
          console.log(`   ${index + 1}. AIH: ${aih.aih_number}`);
          console.log(`      Responsável: ${aih.cns_responsavel || 'NULL'}`);
          console.log(`      Solicitante: ${aih.cns_solicitante || 'NULL'}`);
          console.log(`      Autorizador: ${aih.cns_autorizador || 'NULL'}`);
        });
      }
    }
    
    // 2. Verificar AIHs completamente sem CNS
    console.log('\n2. 🔍 Verificando AIHs COMPLETAMENTE sem CNS...');
    
    const { data: aihsCompletamenteSemCns, error: aihsComplError } = await supabase
      .from('aihs')
      .select('id, aih_number, hospital_id, hospitals(name)')
      .is('cns_responsavel', null)
      .is('cns_solicitante', null)
      .is('cns_autorizador', null)
      .limit(5);
    
    if (aihsComplError) {
      console.error('❌ Erro ao buscar AIHs completamente sem CNS:', aihsComplError.message);
    } else {
      console.log(`📊 AIHs COMPLETAMENTE sem CNS: ${aihsCompletamenteSemCns?.length || 0}`);
      
      if (aihsCompletamenteSemCns && aihsCompletamenteSemCns.length > 0) {
        console.log('\n⚠️ ESTAS AIHs ESTÃO CAUSANDO O PROBLEMA:');
        aihsCompletamenteSemCns.forEach((aih, index) => {
          console.log(`   ${index + 1}. AIH: ${aih.aih_number}`);
          console.log(`      Hospital: ${aih.hospitals?.name || 'N/A'}`);
          console.log(`      ID: ${aih.id}`);
        });
      }
    }
    
    // 3. Verificar se existe "NAO_IDENTIFICADO" na tabela doctors
    console.log('\n3. 🔍 Verificando médicos "NAO_IDENTIFICADO"...');
    
    const { data: medicosNaoId, error: medicosError } = await supabase
      .from('doctors')
      .select('*')
      .or('cns.eq.NAO_IDENTIFICADO,name.ilike.%não identificado%,name.ilike.%nao identificado%');
    
    if (medicosError) {
      console.error('❌ Erro ao buscar médicos não identificados:', medicosError.message);
    } else {
      console.log(`📊 Médicos "NAO_IDENTIFICADO" encontrados: ${medicosNaoId?.length || 0}`);
      
      if (medicosNaoId && medicosNaoId.length > 0) {
        console.log('\n📋 Médicos não identificados:');
        medicosNaoId.forEach((medico, index) => {
          console.log(`   ${index + 1}. Nome: ${medico.name}`);
          console.log(`      CNS: ${medico.cns}`);
          console.log(`      Especialidade: ${medico.specialty}`);
          console.log(`      ID: ${medico.id}`);
        });
      }
    }
    
    // 4. Simular o processamento do DoctorPatientService
    console.log('\n4. 🧪 Simulando DoctorPatientService...');
    
    // Buscar AIHs e simular o processamento
    const { data: aihsParaProcessar, error: aihsProcessarError } = await supabase
      .from('aihs')
      .select(`
        id,
        aih_number,
        cns_responsavel,
        cns_solicitante,
        cns_autorizador,
        hospital_id,
        hospitals(name)
      `)
      .limit(20);
    
    if (aihsProcessarError) {
      console.error('❌ Erro ao buscar AIHs para processar:', aihsProcessarError.message);
    } else {
      console.log(`📊 Processando ${aihsParaProcessar?.length || 0} AIHs...`);
      
      let medicosNaoIdentificadosGerados = 0;
      
      for (const aih of aihsParaProcessar || []) {
        const cnsList = [
          aih.cns_responsavel,
          aih.cns_solicitante,
          aih.cns_autorizador
        ].filter(cns => cns && cns.trim() !== '');
        
        if (cnsList.length === 0) {
          medicosNaoIdentificadosGerados++;
          console.log(`   ⚠️ AIH ${aih.aih_number} geraria "Médico Não Identificado"`);
          console.log(`      Hospital: ${aih.hospitals?.name || 'N/A'}`);
        }
      }
      
      console.log(`\n📊 AIHs que gerariam "Médico Não Identificado": ${medicosNaoIdentificadosGerados}`);
    }
    
    // 5. Verificar procedure_records sem CNS
    console.log('\n5. 🔍 Verificando procedure_records sem CNS...');
    
    const { data: proceduresSemCns, error: proceduresError } = await supabase
      .from('procedure_records')
      .select('id, aih_id, professional')
      .is('professional', null)
      .limit(10);
    
    if (proceduresError) {
      console.error('❌ Erro ao buscar procedures sem CNS:', proceduresError.message);
    } else {
      console.log(`📊 Procedure records sem CNS: ${proceduresSemCns?.length || 0}`);
    }
    
    // 6. Verificar cache/estado atual do dashboard
    console.log('\n6. 🔍 Verificando estado atual dos dados processados...');
    
    // Simular a query que o dashboard faz
    const { data: dadosDashboard, error: dashboardError } = await supabase
      .from('aihs')
      .select(`
        id,
        aih_number,
        cns_responsavel,
        cns_solicitante,
        cns_autorizador,
        total_value,
        hospital_id,
        hospitals(name)
      `)
      .limit(50);
    
    if (dashboardError) {
      console.error('❌ Erro ao buscar dados do dashboard:', dashboardError.message);
    } else {
      console.log(`📊 Dados do dashboard: ${dadosDashboard?.length || 0} AIHs`);
      
      // Agrupar por médicos
      const medicoMap = new Map();
      
      for (const aih of dadosDashboard || []) {
        const cnsList = [
          aih.cns_responsavel,
          aih.cns_solicitante,
          aih.cns_autorizador
        ].filter(cns => cns && cns.trim() !== '');
        
        if (cnsList.length === 0) {
          // Este seria um "Médico Não Identificado"
          const key = 'NAO_IDENTIFICADO';
          if (!medicoMap.has(key)) {
            medicoMap.set(key, {
              name: 'Médico Não Identificado',
              cns: 'NAO_IDENTIFICADO',
              aihs: [],
              valor_total: 0
            });
          }
          const medico = medicoMap.get(key);
          medico.aihs.push(aih.aih_number);
          medico.valor_total += parseFloat(aih.total_value || 0);
        } else {
          // Médicos identificados
          for (const cns of cnsList) {
            if (!medicoMap.has(cns)) {
              medicoMap.set(cns, {
                cns: cns,
                aihs: [],
                valor_total: 0
              });
            }
            const medico = medicoMap.get(cns);
            if (!medico.aihs.includes(aih.aih_number)) {
              medico.aihs.push(aih.aih_number);
              medico.valor_total += parseFloat(aih.total_value || 0);
            }
          }
        }
      }
      
      console.log(`\n📊 Médicos processados: ${medicoMap.size}`);
      
      if (medicoMap.has('NAO_IDENTIFICADO')) {
        const naoId = medicoMap.get('NAO_IDENTIFICADO');
        console.log(`\n⚠️ ENCONTRADO: "Médico Não Identificado"`);
        console.log(`   AIHs: ${naoId.aihs.length}`);
        console.log(`   Valor total: R$ ${naoId.valor_total.toFixed(2)}`);
        console.log(`   AIHs específicas: ${naoId.aihs.slice(0, 5).join(', ')}${naoId.aihs.length > 5 ? '...' : ''}`);
      } else {
        console.log('✅ Nenhum "Médico Não Identificado" encontrado no processamento');
      }
    }
    
    // 7. Recomendações
    console.log('\n7. 💡 RECOMENDAÇÕES:');
    console.log('   1. Limpar cache do navegador (Ctrl+Shift+Delete)');
    console.log('   2. Testar em modo incógnito');
    console.log('   3. Verificar se há cache no React Query/SWR');
    console.log('   4. Reiniciar o servidor de desenvolvimento');
    console.log('   5. Verificar se há AIHs sendo processadas em tempo real');
    
  } catch (error) {
    console.error('❌ Erro durante a investigação:', error);
  }
}

debugMedicoNaoIdentificado();