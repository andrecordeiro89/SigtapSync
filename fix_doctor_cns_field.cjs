// Script para corrigir o campo doctor_cns nos vínculos hospitalares
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function fixDoctorCnsField() {
  const targetCNS = '700108988282314';
  
  try {
    console.log('🔧 === CORREÇÃO: CAMPO DOCTOR_CNS ===\n');
    
    // 1. Buscar o médico
    const { data: doctorData, error: doctorError } = await supabase
      .from('doctors')
      .select('*')
      .eq('cns', targetCNS)
      .single();
    
    if (doctorError) {
      console.error('❌ Erro ao buscar médico:', doctorError.message);
      return;
    }
    
    console.log(`👤 Médico: ${doctorData.name} (CNS: ${doctorData.cns})`);
    
    // 2. Buscar vínculos com doctor_cns NULL
    console.log('\n2. 🔍 Buscando vínculos com doctor_cns NULL...');
    const { data: brokenLinks, error: brokenError } = await supabase
      .from('doctor_hospital')
      .select('*')
      .eq('doctor_id', doctorData.id)
      .is('doctor_cns', null);
    
    if (brokenError) {
      console.error('❌ Erro ao buscar vínculos:', brokenError.message);
      return;
    }
    
    console.log(`📊 Vínculos com doctor_cns NULL: ${brokenLinks?.length || 0}`);
    
    if (!brokenLinks || brokenLinks.length === 0) {
      console.log('✅ Nenhum vínculo com doctor_cns NULL encontrado');
      return;
    }
    
    // 3. Corrigir cada vínculo
    console.log('\n3. 🔧 Corrigindo vínculos...');
    
    for (let i = 0; i < brokenLinks.length; i++) {
      const link = brokenLinks[i];
      console.log(`\n   Corrigindo vínculo ${i + 1}/${brokenLinks.length}:`);
      console.log(`   ID: ${link.id}`);
      console.log(`   Hospital ID: ${link.hospital_id}`);
      
      const { data: updateData, error: updateError } = await supabase
        .from('doctor_hospital')
        .update({ doctor_cns: doctorData.cns })
        .eq('id', link.id)
        .select();
      
      if (updateError) {
        console.error(`   ❌ Erro ao atualizar vínculo ${link.id}:`, updateError.message);
      } else {
        console.log(`   ✅ Vínculo ${link.id} atualizado com sucesso`);
        console.log(`   Doctor CNS agora: ${updateData[0].doctor_cns}`);
      }
    }
    
    // 4. Verificar se a correção funcionou
    console.log('\n4. ✅ Verificando correção...');
    
    const { data: fixedLinks, error: fixedError } = await supabase
      .from('doctor_hospital')
      .select('*')
      .eq('doctor_cns', targetCNS)
      .eq('is_active', true);
    
    if (fixedError) {
      console.error('❌ Erro ao verificar correção:', fixedError.message);
    } else {
      console.log(`📊 Vínculos com doctor_cns correto: ${fixedLinks?.length || 0}`);
      
      if (fixedLinks && fixedLinks.length > 0) {
        fixedLinks.forEach((link, index) => {
          console.log(`   ${index + 1}. ID: ${link.id}`);
          console.log(`      Doctor CNS: ${link.doctor_cns}`);
          console.log(`      Hospital ID: ${link.hospital_id}`);
          console.log(`      Ativo: ${link.is_active}`);
          console.log(`      Principal: ${link.is_primary_hospital}`);
        });
      }
    }
    
    // 5. Testar a consulta que estava falhando
    console.log('\n5. 🧪 Testando consulta que estava falhando...');
    
    const { data: testQuery, error: testError } = await supabase
      .from('doctor_hospital')
      .select(`
        *,
        doctors (
          name,
          cns
        ),
        hospitals (
          name
        )
      `)
      .eq('doctor_cns', targetCNS)
      .eq('is_active', true);
    
    if (testError) {
      console.error('❌ Consulta ainda falha:', testError.message);
    } else {
      console.log(`📊 Consulta com JOIN: ${testQuery?.length || 0} registros`);
      
      if (testQuery && testQuery.length > 0) {
        console.log('\n🎉 PROBLEMA RESOLVIDO!');
        console.log('   A consulta com JOIN agora funciona');
        console.log('   O médico deve aparecer corretamente no dashboard');
        
        testQuery.forEach((result, index) => {
          console.log(`   ${index + 1}. Médico: ${result.doctors.name}`);
          console.log(`      Hospital: ${result.hospitals.name}`);
          console.log(`      Função: ${result.role || 'N/A'}`);
        });
      } else {
        console.log('❌ Consulta ainda retorna 0 registros');
      }
    }
    
    // 6. Verificar se há outros médicos com o mesmo problema
    console.log('\n6. 🔍 Verificando outros médicos com problema similar...');
    
    const { data: otherBrokenLinks, error: otherError } = await supabase
      .from('doctor_hospital')
      .select(`
        id,
        doctor_id,
        doctor_cns,
        doctors (
          name,
          cns
        )
      `)
      .is('doctor_cns', null)
      .eq('is_active', true)
      .limit(10);
    
    if (otherError) {
      console.error('❌ Erro ao buscar outros problemas:', otherError.message);
    } else {
      console.log(`📊 Outros vínculos com doctor_cns NULL: ${otherBrokenLinks?.length || 0}`);
      
      if (otherBrokenLinks && otherBrokenLinks.length > 0) {
        console.log('⚠️ ATENÇÃO: Há outros médicos com o mesmo problema!');
        console.log('🔧 RECOMENDAÇÃO: Executar correção em massa');
        
        otherBrokenLinks.forEach((link, index) => {
          console.log(`   ${index + 1}. ${link.doctors?.name || 'Nome não encontrado'} (CNS: ${link.doctors?.cns || 'N/A'})`);
        });
        
        console.log('\n💡 Para corrigir todos de uma vez, execute:');
        console.log('   UPDATE doctor_hospital SET doctor_cns = (SELECT cns FROM doctors WHERE doctors.id = doctor_hospital.doctor_id) WHERE doctor_cns IS NULL;');
      } else {
        console.log('✅ Nenhum outro médico com problema similar');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro durante a correção:', error);
  }
}

fixDoctorCnsField();