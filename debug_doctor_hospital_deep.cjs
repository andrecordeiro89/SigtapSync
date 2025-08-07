// Script para investigar profundamente o problema do doctor_hospital
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function debugDoctorHospitalDeep() {
  const targetCNS = '700108988282314';
  
  try {
    console.log('🔍 === INVESTIGAÇÃO PROFUNDA: DOCTOR_HOSPITAL ===\n');
    
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
    
    console.log(`👤 Médico: ${doctorData.name} (ID: ${doctorData.id})`);
    
    // 2. Buscar TODOS os vínculos deste médico (por ID)
    console.log('\n2. 🔍 Buscando vínculos por doctor_id...');
    const { data: linksByDoctorId, error: linksByIdError } = await supabase
      .from('doctor_hospital')
      .select('*')
      .eq('doctor_id', doctorData.id);
    
    if (linksByIdError) {
      console.error('❌ Erro ao buscar por doctor_id:', linksByIdError.message);
    } else {
      console.log(`📊 Vínculos por doctor_id: ${linksByDoctorId?.length || 0}`);
      if (linksByDoctorId && linksByDoctorId.length > 0) {
        linksByDoctorId.forEach((link, index) => {
          console.log(`   ${index + 1}. ID: ${link.id}`);
          console.log(`      Doctor ID: ${link.doctor_id}`);
          console.log(`      Doctor CNS: ${link.doctor_cns}`);
          console.log(`      Hospital ID: ${link.hospital_id}`);
          console.log(`      Função: ${link.role || 'NULL'}`);
          console.log(`      Ativo: ${link.is_active}`);
          console.log(`      Principal: ${link.is_primary_hospital}`);
          console.log(`      Criado em: ${link.created_at}`);
        });
      }
    }
    
    // 3. Buscar vínculos por CNS
    console.log('\n3. 🔍 Buscando vínculos por doctor_cns...');
    const { data: linksByCNS, error: linksByCNSError } = await supabase
      .from('doctor_hospital')
      .select('*')
      .eq('doctor_cns', targetCNS);
    
    if (linksByCNSError) {
      console.error('❌ Erro ao buscar por doctor_cns:', linksByCNSError.message);
    } else {
      console.log(`📊 Vínculos por doctor_cns: ${linksByCNS?.length || 0}`);
      if (linksByCNS && linksByCNS.length > 0) {
        linksByCNS.forEach((link, index) => {
          console.log(`   ${index + 1}. ID: ${link.id}`);
          console.log(`      Doctor ID: ${link.doctor_id}`);
          console.log(`      Doctor CNS: ${link.doctor_cns}`);
          console.log(`      Hospital ID: ${link.hospital_id}`);
          console.log(`      Função: ${link.role || 'NULL'}`);
          console.log(`      Ativo: ${link.is_active}`);
          console.log(`      Principal: ${link.is_primary_hospital}`);
        });
      }
    }
    
    // 4. Testar a consulta exata que falhou
    console.log('\n4. 🔍 Testando consulta que falhou...');
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
      console.error('❌ Erro na consulta com JOIN:', finalError.message);
      console.log('🔍 Tentando consulta sem JOIN...');
      
      const { data: simpleCheck, error: simpleError } = await supabase
        .from('doctor_hospital')
        .select('*')
        .eq('doctor_cns', targetCNS)
        .eq('is_active', true);
      
      if (simpleError) {
        console.error('❌ Erro na consulta simples:', simpleError.message);
      } else {
        console.log(`📊 Consulta simples: ${simpleCheck?.length || 0} registros`);
        if (simpleCheck && simpleCheck.length > 0) {
          console.log('✅ Problema está no JOIN!');
          simpleCheck.forEach((link, index) => {
            console.log(`   ${index + 1}. Doctor ID: ${link.doctor_id} | Hospital ID: ${link.hospital_id}`);
          });
        }
      }
    } else {
      console.log(`📊 Consulta com JOIN: ${finalCheck?.length || 0} registros`);
      if (finalCheck && finalCheck.length > 0) {
        console.log('✅ Consulta funcionou!');
      }
    }
    
    // 5. Verificar se há problemas nas tabelas relacionadas
    console.log('\n5. 🔍 Verificando tabelas relacionadas...');
    
    // Verificar se o doctor_id existe na tabela doctors
    const { data: doctorExists, error: doctorExistsError } = await supabase
      .from('doctors')
      .select('id, name')
      .eq('id', doctorData.id);
    
    if (doctorExistsError) {
      console.error('❌ Erro ao verificar doctors:', doctorExistsError.message);
    } else {
      console.log(`👤 Doctor existe: ${doctorExists?.length > 0 ? 'SIM' : 'NÃO'}`);
    }
    
    // Verificar hospital
    if (linksByDoctorId && linksByDoctorId.length > 0) {
      const hospitalId = linksByDoctorId[0].hospital_id;
      const { data: hospitalExists, error: hospitalExistsError } = await supabase
        .from('hospitals')
        .select('id, name')
        .eq('id', hospitalId);
      
      if (hospitalExistsError) {
        console.error('❌ Erro ao verificar hospitals:', hospitalExistsError.message);
      } else {
        console.log(`🏥 Hospital existe: ${hospitalExists?.length > 0 ? 'SIM' : 'NÃO'}`);
        if (hospitalExists && hospitalExists.length > 0) {
          console.log(`   Nome: ${hospitalExists[0].name}`);
        }
      }
    }
    
    // 6. Simular como o DoctorPatientService busca médicos
    console.log('\n6. 🔄 Simulando busca do DoctorPatientService...');
    
    // Esta é a consulta que o serviço usa para buscar dados reais dos médicos
    const { data: serviceQuery, error: serviceError } = await supabase
      .from('doctors')
      .select(`
        name,
        cns,
        crm,
        specialty,
        doctor_hospital!inner (
          hospital_id,
          role,
          is_active,
          hospitals (
            id,
            name,
            cnpj
          )
        )
      `)
      .eq('cns', targetCNS)
      .eq('doctor_hospital.is_active', true);
    
    if (serviceError) {
      console.error('❌ Erro na consulta do serviço:', serviceError.message);
      console.log('🔍 Problema pode estar no INNER JOIN!');
    } else {
      console.log(`📊 Consulta do serviço: ${serviceQuery?.length || 0} registros`);
      if (serviceQuery && serviceQuery.length > 0) {
        console.log('✅ Médico seria encontrado pelo serviço!');
        serviceQuery.forEach((result, index) => {
          console.log(`   ${index + 1}. Nome: ${result.name}`);
          console.log(`      CNS: ${result.cns}`);
          console.log(`      Hospitais: ${result.doctor_hospital?.length || 0}`);
        });
      } else {
        console.log('❌ Médico NÃO seria encontrado pelo serviço!');
        console.log('🔧 CAUSA: Problema no vínculo doctor_hospital');
      }
    }
    
    // 7. Conclusão
    console.log('\n7. 📋 DIAGNÓSTICO FINAL:');
    
    const hasLinks = (linksByDoctorId && linksByDoctorId.length > 0) || (linksByCNS && linksByCNS.length > 0);
    const serviceWorks = serviceQuery && serviceQuery.length > 0;
    
    if (hasLinks && serviceWorks) {
      console.log('✅ TUDO FUNCIONANDO - problema pode ser cache/filtros');
    } else if (hasLinks && !serviceWorks) {
      console.log('❌ PROBLEMA NO INNER JOIN - vínculo existe mas consulta falha');
      console.log('🔧 SOLUÇÃO: Verificar/corrigir dados do vínculo hospitalar');
    } else if (!hasLinks) {
      console.log('❌ PROBLEMA: Nenhum vínculo hospitalar encontrado');
      console.log('🔧 SOLUÇÃO: Criar vínculo hospitalar válido');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a investigação:', error);
  }
}

debugDoctorHospitalDeep();