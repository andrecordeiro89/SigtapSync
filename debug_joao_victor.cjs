// Script para investigar o médico JOAO VICTOR RODRIGUES (CNS: 700108988282314)
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function debugJoaoVictor() {
  const targetCNS = '700108988282314';
  const targetName = 'JOAO VICTOR RODRIGUES';
  
  try {
    console.log('🔍 === INVESTIGAÇÃO: JOAO VICTOR RODRIGUES ===\n');
    console.log(`🎯 CNS alvo: ${targetCNS}`);
    console.log(`👤 Nome alvo: ${targetName}\n`);
    
    // 1. Verificar se o médico existe na tabela doctors
    console.log('1. 🏥 Verificando tabela DOCTORS...');
    const { data: doctorData, error: doctorError } = await supabase
      .from('doctors')
      .select('*')
      .eq('cns', targetCNS);
    
    if (doctorError) {
      console.error('❌ Erro ao buscar na tabela doctors:', doctorError.message);
    } else {
      console.log(`📊 Registros encontrados: ${doctorData?.length || 0}`);
      if (doctorData && doctorData.length > 0) {
        doctorData.forEach((doc, index) => {
          console.log(`   ${index + 1}. ID: ${doc.id}`);
          console.log(`      Nome: ${doc.name}`);
          console.log(`      CNS: ${doc.cns}`);
          console.log(`      CRM: ${doc.crm || 'N/A'}`);
          console.log(`      Especialidade: ${doc.specialty || 'N/A'}`);
          console.log(`      Ativo: ${doc.is_active}`);
          console.log(`      Criado em: ${doc.created_at}`);
        });
      } else {
        console.log('   ❌ Médico NÃO encontrado na tabela doctors');
      }
    }
    
    // 2. Verificar se há variações do nome ou CNS
    console.log('\n2. 🔍 Buscando variações do nome...');
    const { data: nameVariations, error: nameError } = await supabase
      .from('doctors')
      .select('*')
      .ilike('name', '%JOAO%VICTOR%RODRIGUES%');
    
    if (nameError) {
      console.error('❌ Erro ao buscar variações do nome:', nameError.message);
    } else {
      console.log(`📊 Variações do nome encontradas: ${nameVariations?.length || 0}`);
      if (nameVariations && nameVariations.length > 0) {
        nameVariations.forEach((doc, index) => {
          console.log(`   ${index + 1}. Nome: ${doc.name} | CNS: ${doc.cns}`);
        });
      }
    }
    
    // 3. Verificar se o CNS aparece em AIHs
    console.log('\n3. 📋 Verificando AIHs com este CNS...');
    const { data: aihsData, error: aihsError } = await supabase
      .from('aihs')
      .select('id, aih_number, cns_responsavel, cns_solicitante, cns_autorizador, hospital_id')
      .or(`cns_responsavel.eq.${targetCNS},cns_solicitante.eq.${targetCNS},cns_autorizador.eq.${targetCNS}`);
    
    if (aihsError) {
      console.error('❌ Erro ao buscar AIHs:', aihsError.message);
    } else {
      console.log(`📊 AIHs encontradas: ${aihsData?.length || 0}`);
      if (aihsData && aihsData.length > 0) {
        aihsData.slice(0, 5).forEach((aih, index) => {
          console.log(`   ${index + 1}. AIH: ${aih.aih_number}`);
          console.log(`      CNS Responsável: ${aih.cns_responsavel || 'N/A'}`);
          console.log(`      CNS Solicitante: ${aih.cns_solicitante || 'N/A'}`);
          console.log(`      CNS Autorizador: ${aih.cns_autorizador || 'N/A'}`);
          console.log(`      Hospital ID: ${aih.hospital_id}`);
        });
        if (aihsData.length > 5) {
          console.log(`   ... e mais ${aihsData.length - 5} AIHs`);
        }
      } else {
        console.log('   ❌ Nenhuma AIH encontrada com este CNS');
      }
    }
    
    // 4. Verificar se o CNS aparece em procedimentos
    console.log('\n4. 🏥 Verificando procedimentos com este CNS...');
    const { data: proceduresData, error: proceduresError } = await supabase
      .from('procedure_records')
      .select('id, professional_cns, professional_name, aih_id')
      .eq('professional_cns', targetCNS)
      .limit(5);
    
    if (proceduresError) {
      console.error('❌ Erro ao buscar procedimentos:', proceduresError.message);
    } else {
      console.log(`📊 Procedimentos encontrados: ${proceduresData?.length || 0}`);
      if (proceduresData && proceduresData.length > 0) {
        proceduresData.forEach((proc, index) => {
          console.log(`   ${index + 1}. ID: ${proc.id}`);
          console.log(`      Nome Profissional: ${proc.professional_name}`);
          console.log(`      CNS: ${proc.professional_cns}`);
          console.log(`      AIH ID: ${proc.aih_id}`);
        });
      } else {
        console.log('   ❌ Nenhum procedimento encontrado com este CNS');
      }
    }
    
    // 5. Verificar se está na tabela doctor_hospital
    console.log('\n5. 🏥 Verificando vínculos hospitalares...');
    const { data: hospitalLinks, error: hospitalError } = await supabase
      .from('doctor_hospital')
      .select(`
        *,
        doctors (
          name,
          cns
        ),
        hospitals (
          name,
          cnpj
        )
      `)
      .eq('doctor_cns', targetCNS);
    
    if (hospitalError) {
      console.error('❌ Erro ao buscar vínculos hospitalares:', hospitalError.message);
    } else {
      console.log(`📊 Vínculos hospitalares encontrados: ${hospitalLinks?.length || 0}`);
      if (hospitalLinks && hospitalLinks.length > 0) {
        hospitalLinks.forEach((link, index) => {
          console.log(`   ${index + 1}. Hospital: ${link.hospitals?.name || 'N/A'}`);
          console.log(`      Função: ${link.role || 'N/A'}`);
          console.log(`      Ativo: ${link.is_active}`);
          console.log(`      Hospital Principal: ${link.is_primary_hospital}`);
        });
      } else {
        console.log('   ❌ Nenhum vínculo hospitalar encontrado');
      }
    }
    
    // 6. Simular como o DoctorPatientService processaria este médico
    console.log('\n6. 🔄 Simulando processamento do DoctorPatientService...');
    
    // Buscar dados reais do médico
    const { data: realDoctorData, error: realDoctorError } = await supabase
      .from('doctors')
      .select('name, cns, crm, specialty')
      .eq('cns', targetCNS)
      .single();
    
    if (realDoctorError && realDoctorError.code !== 'PGRST116') {
      console.error('❌ Erro ao buscar dados reais:', realDoctorError.message);
    } else if (realDoctorData) {
      console.log('✅ Médico seria processado como CADASTRADO:');
      console.log(`   Nome: ${realDoctorData.name}`);
      console.log(`   CNS: ${realDoctorData.cns}`);
      console.log(`   CRM: ${realDoctorData.crm || 'N/A'}`);
      console.log(`   Especialidade: ${realDoctorData.specialty || 'Especialidade não informada'}`);
    } else {
      console.log('❌ Médico seria processado como NÃO CADASTRADO:');
      console.log(`   Nome: 🔍 Dr(a). CNS ${targetCNS}`);
      console.log(`   CRM: Não Cadastrado`);
      console.log(`   Especialidade: Médico não cadastrado no sistema`);
    }
    
    // 7. Verificar se há problemas de cache ou sessão
    console.log('\n7. 🔄 Verificando possíveis problemas...');
    
    // Verificar se há duplicatas
    const { data: duplicates, error: dupError } = await supabase
      .from('doctors')
      .select('*')
      .eq('cns', targetCNS);
    
    if (!dupError && duplicates && duplicates.length > 1) {
      console.log(`⚠️ PROBLEMA: ${duplicates.length} registros duplicados encontrados!`);
      duplicates.forEach((dup, index) => {
        console.log(`   ${index + 1}. ID: ${dup.id} | Nome: ${dup.name} | Ativo: ${dup.is_active}`);
      });
    }
    
    // Verificar se há problemas de formatação no CNS
    const cleanCNS = targetCNS.replace(/[^0-9]/g, '');
    if (cleanCNS !== targetCNS) {
      console.log(`⚠️ CNS pode ter formatação: Original: ${targetCNS} | Limpo: ${cleanCNS}`);
      
      const { data: cleanSearch, error: cleanError } = await supabase
        .from('doctors')
        .select('*')
        .eq('cns', cleanCNS);
      
      if (!cleanError && cleanSearch && cleanSearch.length > 0) {
        console.log('✅ Médico encontrado com CNS limpo!');
      }
    }
    
    // 8. Conclusão
    console.log('\n8. 📋 CONCLUSÃO:');
    
    if (doctorData && doctorData.length > 0) {
      console.log('✅ MÉDICO ESTÁ CADASTRADO na tabela doctors');
      if (aihsData && aihsData.length > 0) {
        console.log('✅ MÉDICO TEM AIHs associadas');
        console.log('🔍 PROBLEMA PODE SER:');
        console.log('   - Cache do navegador');
        console.log('   - Filtros aplicados no dashboard');
        console.log('   - Problema na consulta do DoctorPatientService');
        console.log('   - Médico inativo ou sem vínculo hospitalar ativo');
      } else {
        console.log('⚠️ MÉDICO NÃO TEM AIHs - pode não aparecer no dashboard');
      }
    } else {
      console.log('❌ MÉDICO NÃO ESTÁ CADASTRADO na tabela doctors');
      console.log('🔧 SOLUÇÃO: Cadastrar o médico na tabela doctors');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a investigação:', error);
  }
}

debugJoaoVictor();