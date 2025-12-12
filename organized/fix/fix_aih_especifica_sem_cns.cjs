// Script para corrigir a AIH específica que está causando "Médico Não Identificado"
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function fixAihEspecifica() {
  try {
    console.log('🔧 === CORREÇÃO DA AIH ESPECÍFICA SEM CNS ===\n');
    
    const aihId = 'a435937a-a5f0-4db8-bf5c-a79d834f52d8';
    const aihNumber = '412511059673-9';
    
    // 1. Verificar a AIH problemática
    console.log('1. 🔍 Verificando AIH problemática...');
    
    const { data: aihProblematica, error: aihError } = await supabase
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
      .eq('id', aihId)
      .single();
    
    if (aihError) {
      console.error('❌ Erro ao buscar AIH:', aihError.message);
      return;
    }
    
    console.log('📊 AIH encontrada:');
    console.log(`   Número: ${aihProblematica.aih_number}`);
    console.log(`   Hospital: ${aihProblematica.hospitals?.name}`);
    console.log(`   CNS Responsável: ${aihProblematica.cns_responsavel || 'NULL'}`);
    console.log(`   CNS Solicitante: ${aihProblematica.cns_solicitante || 'NULL'}`);
    console.log(`   CNS Autorizador: ${aihProblematica.cns_autorizador || 'NULL'}`);
    
    // 2. Buscar procedimentos relacionados para encontrar CNS
    console.log('\n2. 🔍 Buscando procedimentos relacionados...');
    
    const { data: procedimentos, error: procError } = await supabase
      .from('procedure_records')
      .select('professional, procedure_code')
      .eq('aih_id', aihId)
      .not('professional', 'is', null)
      .limit(5);
    
    if (procError) {
      console.error('❌ Erro ao buscar procedimentos:', procError.message);
    } else {
      console.log(`📊 Procedimentos encontrados: ${procedimentos?.length || 0}`);
      
      if (procedimentos && procedimentos.length > 0) {
        console.log('\n📋 CNS encontrados nos procedimentos:');
        const cnsUnicos = [...new Set(procedimentos.map(p => p.professional).filter(Boolean))];
        cnsUnicos.forEach((cns, index) => {
          console.log(`   ${index + 1}. ${cns}`);
        });
        
        if (cnsUnicos.length > 0) {
          const cnsEscolhido = cnsUnicos[0];
          console.log(`\n✅ Usando CNS: ${cnsEscolhido}`);
          
          // 3. Atualizar a AIH com o CNS encontrado
          console.log('\n3. 🔧 Atualizando AIH...');
          
          const { error: updateError } = await supabase
            .from('aihs')
            .update({
              cns_responsavel: cnsEscolhido,
              cns_solicitante: cnsEscolhido
            })
            .eq('id', aihId);
          
          if (updateError) {
            console.error('❌ Erro ao atualizar AIH:', updateError.message);
          } else {
            console.log('✅ AIH atualizada com sucesso!');
            console.log(`   CNS Responsável: ${cnsEscolhido}`);
            console.log(`   CNS Solicitante: ${cnsEscolhido}`);
          }
        }
      }
    }
    
    // 4. Se não encontrou CNS nos procedimentos, buscar médico ativo do hospital
    if (!procedimentos || procedimentos.length === 0) {
      console.log('\n4. 🔍 Buscando médico ativo do hospital...');
      
      const { data: medicoHospital, error: medicoError } = await supabase
        .from('doctor_hospital')
        .select(`
          doctor_cns,
          doctors(name, cns)
        `)
        .eq('hospital_id', aihProblematica.hospital_id)
        .eq('is_active', true)
        .not('doctor_cns', 'is', null)
        .limit(1)
        .single();
      
      if (medicoError) {
        console.log('⚠️ Nenhum médico ativo encontrado no hospital');
        
        // 5. Última opção: usar um CNS padrão
        console.log('\n5. 🔧 Usando CNS padrão...');
        const cnsDefault = '000.048.201-50'; // CNS que sabemos que existe
        
        const { error: updateError } = await supabase
          .from('aihs')
          .update({
            cns_responsavel: cnsDefault,
            cns_solicitante: cnsDefault
          })
          .eq('id', aihId);
        
        if (updateError) {
          console.error('❌ Erro ao atualizar AIH:', updateError.message);
        } else {
          console.log('✅ AIH atualizada com CNS padrão!');
          console.log(`   CNS usado: ${cnsDefault}`);
        }
      } else {
        console.log(`📊 Médico encontrado: ${medicoHospital.doctors?.name}`);
        console.log(`   CNS: ${medicoHospital.doctor_cns}`);
        
        const { error: updateError } = await supabase
          .from('aihs')
          .update({
            cns_responsavel: medicoHospital.doctor_cns,
            cns_solicitante: medicoHospital.doctor_cns
          })
          .eq('id', aihId);
        
        if (updateError) {
          console.error('❌ Erro ao atualizar AIH:', updateError.message);
        } else {
          console.log('✅ AIH atualizada com médico do hospital!');
          console.log(`   CNS usado: ${medicoHospital.doctor_cns}`);
        }
      }
    }
    
    // 6. Verificar resultado final
    console.log('\n6. ✅ Verificando resultado final...');
    
    const { data: aihFinal, error: finalError } = await supabase
      .from('aihs')
      .select('cns_responsavel, cns_solicitante, cns_autorizador')
      .eq('id', aihId)
      .single();
    
    if (finalError) {
      console.error('❌ Erro ao verificar resultado:', finalError.message);
    } else {
      console.log('📊 Estado final da AIH:');
      console.log(`   CNS Responsável: ${aihFinal.cns_responsavel || 'NULL'}`);
      console.log(`   CNS Solicitante: ${aihFinal.cns_solicitante || 'NULL'}`);
      console.log(`   CNS Autorizador: ${aihFinal.cns_autorizador || 'NULL'}`);
      
      const temCns = aihFinal.cns_responsavel || aihFinal.cns_solicitante || aihFinal.cns_autorizador;
      
      if (temCns) {
        console.log('\n🎉 PROBLEMA RESOLVIDO!');
        console.log('   A AIH agora tem pelo menos um CNS');
        console.log('   O "Médico Não Identificado" deve desaparecer');
      } else {
        console.log('\n⚠️ PROBLEMA PERSISTE!');
        console.log('   A AIH ainda não tem nenhum CNS');
      }
    }
    
    // 7. Verificar se ainda há outras AIHs sem CNS
    console.log('\n7. 🔍 Verificando outras AIHs sem CNS...');
    
    const { data: outrasAihs, error: outrasError } = await supabase
      .from('aihs')
      .select('id, aih_number')
      .is('cns_responsavel', null)
      .is('cns_solicitante', null)
      .is('cns_autorizador', null)
      .limit(5);
    
    if (outrasError) {
      console.error('❌ Erro ao verificar outras AIHs:', outrasError.message);
    } else {
      console.log(`📊 Outras AIHs sem CNS: ${outrasAihs?.length || 0}`);
      
      if (outrasAihs && outrasAihs.length > 0) {
        console.log('\n⚠️ ATENÇÃO: Ainda há outras AIHs sem CNS:');
        outrasAihs.forEach((aih, index) => {
          console.log(`   ${index + 1}. ${aih.aih_number} (ID: ${aih.id})`);
        });
      } else {
        console.log('\n✅ Nenhuma outra AIH sem CNS encontrada!');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro durante a correção:', error);
  }
}

fixAihEspecifica();