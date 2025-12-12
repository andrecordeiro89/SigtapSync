// Script para corrigir o vínculo hospitalar do médico JOAO VICTOR RODRIGUES
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function fixJoaoVictorHospital() {
  const targetCNS = '700108988282314';
  const targetName = 'JOAO VICTOR RODRIGUES';
  
  try {
    console.log('🔧 === CORREÇÃO: VÍNCULO HOSPITALAR JOAO VICTOR ===\n');
    
    // 1. Buscar o médico
    console.log('1. 👤 Buscando dados do médico...');
    const { data: doctorData, error: doctorError } = await supabase
      .from('doctors')
      .select('*')
      .eq('cns', targetCNS)
      .single();
    
    if (doctorError) {
      console.error('❌ Erro ao buscar médico:', doctorError.message);
      return;
    }
    
    console.log(`✅ Médico encontrado: ${doctorData.name} (ID: ${doctorData.id})`);
    
    // 2. Identificar o hospital das AIHs
    console.log('\n2. 🏥 Identificando hospital das AIHs...');
    const { data: aihData, error: aihError } = await supabase
      .from('aihs')
      .select(`
        hospital_id,
        hospitals (
          id,
          name,
          cnpj
        )
      `)
      .eq('cns_responsavel', targetCNS)
      .limit(1)
      .single();
    
    if (aihError) {
      console.error('❌ Erro ao buscar AIH:', aihError.message);
      return;
    }
    
    const hospitalId = aihData.hospital_id;
    const hospitalInfo = aihData.hospitals;
    console.log(`🏥 Hospital identificado: ${hospitalInfo.name} (ID: ${hospitalId})`);
    
    // 3. Verificar se já existe vínculo
    console.log('\n3. 🔍 Verificando vínculo existente...');
    const { data: existingLink, error: linkError } = await supabase
      .from('doctor_hospital')
      .select('*')
      .eq('doctor_id', doctorData.id)
      .eq('hospital_id', hospitalId);
    
    if (linkError) {
      console.error('❌ Erro ao verificar vínculo:', linkError.message);
      return;
    }
    
    if (existingLink && existingLink.length > 0) {
      console.log('⚠️ Vínculo já existe!');
      const link = existingLink[0];
      console.log(`   Status: ${link.is_active ? 'ATIVO' : 'INATIVO'}`);
      console.log(`   Função: ${link.role}`);
      console.log(`   Hospital Principal: ${link.is_primary_hospital}`);
      
      if (!link.is_active) {
        console.log('\n🔧 Ativando vínculo existente...');
        const { data: updateData, error: updateError } = await supabase
          .from('doctor_hospital')
          .update({ 
            is_active: true,
            is_primary_hospital: true,
            role: 'Médico Assistente'
          })
          .eq('id', link.id)
          .select();
        
        if (updateError) {
          console.error('❌ Erro ao ativar vínculo:', updateError.message);
        } else {
          console.log('✅ Vínculo ativado com sucesso!');
        }
      } else {
        console.log('✅ Vínculo já está ativo');
      }
    } else {
      console.log('❌ Vínculo não existe. Criando novo vínculo...');
      
      // 4. Criar novo vínculo
      const { data: newLink, error: createError } = await supabase
        .from('doctor_hospital')
        .insert({
          doctor_id: doctorData.id,
          doctor_cns: doctorData.cns,
          hospital_id: hospitalId,
          role: 'Médico Assistente',
          department: 'Cirurgia Geral',
          is_active: true,
          is_primary_hospital: true
        })
        .select();
      
      if (createError) {
        console.error('❌ Erro ao criar vínculo:', createError.message);
      } else {
        console.log('✅ Vínculo criado com sucesso!');
        console.log(`   ID do vínculo: ${newLink[0].id}`);
      }
    }
    
    // 5. Verificar se o problema foi resolvido
    console.log('\n5. ✅ Verificando se o problema foi resolvido...');
    const { data: finalCheck, error: finalError } = await supabase
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
    
    if (finalError) {
      console.error('❌ Erro na verificação final:', finalError.message);
    } else {
      console.log(`📊 Vínculos ativos encontrados: ${finalCheck?.length || 0}`);
      if (finalCheck && finalCheck.length > 0) {
        finalCheck.forEach((link, index) => {
          console.log(`   ${index + 1}. Hospital: ${link.hospitals.name}`);
          console.log(`      Função: ${link.role}`);
          console.log(`      Ativo: ${link.is_active}`);
          console.log(`      Principal: ${link.is_primary_hospital}`);
        });
        
        console.log('\n🎉 PROBLEMA RESOLVIDO!');
        console.log('   O médico agora tem vínculo hospitalar ativo');
        console.log('   Ele deve aparecer corretamente no dashboard');
      } else {
        console.log('\n❌ PROBLEMA AINDA EXISTE');
        console.log('   O médico ainda não tem vínculo hospitalar ativo');
      }
    }
    
    // 6. Limpar cache se necessário
    console.log('\n6. 🧹 Recomendações para limpar cache:');
    console.log('   - Recarregar a página (F5)');
    console.log('   - Limpar cache do navegador');
    console.log('   - Testar em aba anônima');
    console.log('   - Reiniciar o servidor de desenvolvimento');
    
  } catch (error) {
    console.error('❌ Erro durante a correção:', error);
  }
}

fixJoaoVictorHospital();