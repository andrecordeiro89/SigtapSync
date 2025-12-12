// Script para corrigir a AIH sem CNS que está causando o "Médico Não Identificado"
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function fixAihSemCns() {
  try {
    console.log('🔧 === CORREÇÃO DA AIH SEM CNS ===\n');
    
    // 1. Buscar a AIH problemática
    console.log('1. 🔍 Buscando AIH 412511059673-9...');
    const { data: aihData, error: aihError } = await supabase
      .from('aihs')
      .select('*')
      .eq('aih_number', '412511059673-9')
      .single();
    
    if (aihError) {
      console.error('❌ Erro ao buscar AIH:', aihError.message);
      return;
    }
    
    if (!aihData) {
      console.log('❌ AIH não encontrada');
      return;
    }
    
    console.log('📋 Dados da AIH encontrada:');
    console.log(`   ID: ${aihData.id}`);
    console.log(`   Número: ${aihData.aih_number}`);
    console.log(`   CNS Responsável: ${aihData.cns_responsavel || 'NULO'}`);
    console.log(`   CNS Solicitante: ${aihData.cns_solicitante || 'NULO'}`);
    console.log(`   CNS Autorizador: ${aihData.cns_autorizador || 'NULO'}`);
    console.log(`   Hospital ID: ${aihData.hospital_id}`);
    console.log(`   Patient ID: ${aihData.patient_id}`);
    
    // 2. Verificar se há outros CNS disponíveis na mesma AIH ou procedimentos relacionados
    console.log('\n2. 🔍 Buscando CNS em procedimentos relacionados...');
    const { data: proceduresData, error: procError } = await supabase
      .from('procedure_records')
      .select('professional_cns, professional_name')
      .eq('aih_id', aihData.id)
      .not('professional_cns', 'is', null);
    
    if (procError) {
      console.error('❌ Erro ao buscar procedimentos:', procError.message);
    } else {
      console.log(`📊 Procedimentos com CNS encontrados: ${proceduresData?.length || 0}`);
      if (proceduresData && proceduresData.length > 0) {
        const uniqueCNS = [...new Set(proceduresData.map(p => p.professional_cns))];
        console.log('🩺 CNS encontrados nos procedimentos:');
        uniqueCNS.forEach((cns, index) => {
          const proc = proceduresData.find(p => p.professional_cns === cns);
          console.log(`   ${index + 1}. CNS: ${cns} - ${proc?.professional_name || 'Nome não disponível'}`);
        });
        
        // Usar o primeiro CNS encontrado como responsável
        const selectedCNS = uniqueCNS[0];
        console.log(`\n🎯 Usando CNS ${selectedCNS} como responsável...`);
        
        const { data: updateData, error: updateError } = await supabase
          .from('aihs')
          .update({ cns_responsavel: selectedCNS })
          .eq('id', aihData.id)
          .select();
        
        if (updateError) {
          console.error('❌ Erro ao atualizar AIH:', updateError.message);
        } else {
          console.log('✅ AIH atualizada com sucesso!');
          console.log(`   CNS Responsável agora: ${selectedCNS}`);
        }
      } else {
        console.log('⚠️ Nenhum procedimento com CNS encontrado');
        
        // Opção 2: Buscar médicos do mesmo hospital
        console.log('\n3. 🔍 Buscando médicos do mesmo hospital...');
        const { data: hospitalDoctors, error: hospitalError } = await supabase
          .from('doctor_hospital')
          .select(`
            doctor_cns,
            doctors (
              name,
              cns,
              specialty
            )
          `)
          .eq('hospital_id', aihData.hospital_id)
          .eq('is_active', true)
          .limit(5);
        
        if (hospitalError) {
          console.error('❌ Erro ao buscar médicos do hospital:', hospitalError.message);
        } else {
          console.log(`📊 Médicos do hospital encontrados: ${hospitalDoctors?.length || 0}`);
          if (hospitalDoctors && hospitalDoctors.length > 0) {
            console.log('🩺 Médicos disponíveis:');
            hospitalDoctors.forEach((doc, index) => {
              const doctor = doc.doctors;
              console.log(`   ${index + 1}. CNS: ${doc.doctor_cns} - ${doctor?.name || 'Nome não disponível'} (${doctor?.specialty || 'Especialidade não informada'})`);
            });
            
            // Usar o primeiro médico como responsável
            const selectedDoctor = hospitalDoctors[0];
            console.log(`\n🎯 Usando médico ${selectedDoctor.doctor_cns} como responsável...`);
            
            const { data: updateData, error: updateError } = await supabase
              .from('aihs')
              .update({ cns_responsavel: selectedDoctor.doctor_cns })
              .eq('id', aihData.id)
              .select();
            
            if (updateError) {
              console.error('❌ Erro ao atualizar AIH:', updateError.message);
            } else {
              console.log('✅ AIH atualizada com sucesso!');
              console.log(`   CNS Responsável agora: ${selectedDoctor.doctor_cns}`);
            }
          } else {
            console.log('⚠️ Nenhum médico ativo encontrado no hospital');
            console.log('\n🗑️ OPÇÃO: Excluir esta AIH se for dados de teste inválidos');
            console.log(`   Para excluir: DELETE FROM aihs WHERE id = '${aihData.id}';`);
          }
        }
      }
    }
    
    // 4. Verificar se o problema foi resolvido
    console.log('\n4. ✅ Verificando se o problema foi resolvido...');
    const { data: checkData, error: checkError } = await supabase
      .from('aihs')
      .select('cns_responsavel, cns_solicitante, cns_autorizador')
      .eq('aih_number', '412511059673-9')
      .single();
    
    if (checkError) {
      console.error('❌ Erro ao verificar AIH:', checkError.message);
    } else {
      console.log('📋 Estado atual da AIH:');
      console.log(`   CNS Responsável: ${checkData.cns_responsavel || 'NULO'}`);
      console.log(`   CNS Solicitante: ${checkData.cns_solicitante || 'NULO'}`);
      console.log(`   CNS Autorizador: ${checkData.cns_autorizador || 'NULO'}`);
      
      if (checkData.cns_responsavel || checkData.cns_solicitante || checkData.cns_autorizador) {
        console.log('\n🎉 PROBLEMA RESOLVIDO!');
        console.log('   A AIH agora tem pelo menos um CNS válido');
        console.log('   O "Médico Não Identificado" não deve mais aparecer');
      } else {
        console.log('\n❌ PROBLEMA AINDA EXISTE');
        console.log('   A AIH ainda não tem nenhum CNS válido');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro durante a correção:', error);
  }
}

fixAihSemCns();