const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function debugDoctorHospitalLink() {
  console.log('🔍 DIAGNÓSTICO: Vínculo Médico-Hospital\n');
  console.log('═'.repeat(80));

  const cns = '702002315432783';
  const hospitalId = '47eddf6e-ac64-4433-acc1-7b644a2b43d0';

  // 1. VERIFICAR SE O MÉDICO ESTÁ NA TABELA DOCTORS
  console.log('\n1️⃣ MÉDICO NA TABELA DOCTORS:');
  
  const { data: doctor, error: doctorError } = await supabase
    .from('doctors')
    .select('id, name, cns, specialty, hospital_id')
    .eq('cns', cns)
    .single();

  if (doctorError) {
    console.log('   ❌ Erro:', doctorError.message);
  } else {
    console.log('   ✅ Médico encontrado:');
    console.log('      ID:', doctor.id);
    console.log('      Nome:', doctor.name);
    console.log('      CNS:', doctor.cns);
    console.log('      hospital_id (campo direto):', doctor.hospital_id);
  }

  // 2. VERIFICAR SE EXISTE NA TABELA DOCTOR_HOSPITAL
  console.log('\n2️⃣ VÍNCULO NA TABELA DOCTOR_HOSPITAL:');
  
  const { data: links, error: linkError } = await supabase
    .from('doctor_hospital')
    .select('*')
    .eq('doctor_id', doctor?.id);

  if (linkError) {
    console.log('   ❌ Erro:', linkError.message);
  } else if (!links || links.length === 0) {
    console.log('   ⚠️  MÉDICO NÃO ESTÁ VINCULADO A NENHUM HOSPITAL!');
    console.log('   💡 Este é o problema!');
  } else {
    console.log(`   📊 Médico vinculado a ${links.length} hospital(is):`);
    links.forEach(link => {
      console.log(`      - Hospital: ${link.hospital_id}`);
      console.log(`        Ativo: ${link.is_active}`);
      console.log(`        Match com hospital desejado: ${link.hospital_id === hospitalId ? '✅ SIM' : '❌ NÃO'}`);
    });
  }

  // 3. VERIFICAR SE O VÍNCULO EXISTE PARA O HOSPITAL ESPECÍFICO
  console.log('\n3️⃣ VÍNCULO COM HOSPITAL ESPECÍFICO:');
  console.log(`   Hospital ID: ${hospitalId}`);
  
  if (doctor) {
    const { data: specificLink, error: specificError } = await supabase
      .from('doctor_hospital')
      .select('*')
      .eq('doctor_id', doctor.id)
      .eq('hospital_id', hospitalId);

    if (specificError) {
      console.log('   ❌ Erro:', specificError.message);
    } else if (!specificLink || specificLink.length === 0) {
      console.log('   ❌ MÉDICO NÃO ESTÁ VINCULADO A ESTE HOSPITAL!');
      console.log('   💡 O sistema exige este vínculo para processar AIH');
    } else {
      console.log('   ✅ Vínculo encontrado:');
      specificLink.forEach(link => {
        console.log('      doctor_id:', link.doctor_id);
        console.log('      hospital_id:', link.hospital_id);
        console.log('      is_active:', link.is_active);
      });
    }
  }

  // 4. BUSCAR NOME DO HOSPITAL
  console.log('\n4️⃣ INFORMAÇÕES DO HOSPITAL:');
  
  const { data: hospital, error: hospitalError } = await supabase
    .from('hospitals')
    .select('id, name, cnpj')
    .eq('id', hospitalId)
    .single();

  if (hospitalError) {
    console.log('   ❌ Erro:', hospitalError.message);
  } else {
    console.log('   ✅ Hospital:');
    console.log('      Nome:', hospital.name);
    console.log('      CNPJ:', hospital.cnpj);
  }

  // 5. TESTAR A QUERY PROBLEMÁTICA (como o sistema faz)
  console.log('\n5️⃣ TESTE DA QUERY PROBLEMÁTICA (JOIN):');
  console.log('   Query: SELECT * FROM doctors INNER JOIN doctor_hospital...');
  
  const { data: joinResult, error: joinError } = await supabase
    .from('doctors')
    .select(`
      id,
      name,
      cns,
      specialty,
      doctor_hospital!inner (
        hospital_id
      )
    `)
    .eq('cns', cns)
    .eq('doctor_hospital.hospital_id', hospitalId)
    .eq('is_active', true);

  if (joinError) {
    console.log('   ❌ ERRO (mesmo do console):');
    console.log('      Código:', joinError.code);
    console.log('      Mensagem:', joinError.message);
    console.log('      Details:', joinError.details);
    console.log('      Hint:', joinError.hint);
  } else if (!joinResult || joinResult.length === 0) {
    console.log('   ⚠️  Query executou mas não retornou resultados');
  } else {
    console.log('   ✅ Query funcionou:', joinResult);
  }

  // 6. DIAGNÓSTICO FINAL
  console.log('\n' + '═'.repeat(80));
  console.log('🎯 DIAGNÓSTICO FINAL:\n');

  if (!links || links.length === 0) {
    console.log('❌ PROBLEMA IDENTIFICADO: MÉDICO NÃO ESTÁ NA TABELA DOCTOR_HOSPITAL');
    console.log('');
    console.log('📋 EXPLICAÇÃO:');
    console.log('   - O médico está cadastrado na tabela "doctors"');
    console.log('   - MAS não está vinculado ao hospital na tabela "doctor_hospital"');
    console.log('   - O sistema exige este vínculo para processar AIH');
    console.log('');
    console.log('💡 SOLUÇÃO:');
    console.log('   Criar vínculo do médico com o hospital:');
    console.log('');
    console.log('   SQL:');
    console.log(`   INSERT INTO doctor_hospital (doctor_id, hospital_id, is_active)`);
    console.log(`   VALUES ('${doctor?.id}', '${hospitalId}', true)`);
    console.log(`   ON CONFLICT (doctor_id, hospital_id) DO UPDATE SET is_active = true;`);
    console.log('');
  } else {
    const hasLinkToHospital = links.some(l => l.hospital_id === hospitalId);
    
    if (!hasLinkToHospital) {
      console.log('❌ PROBLEMA: MÉDICO ESTÁ VINCULADO A OUTRO(S) HOSPITAL(IS)');
      console.log('');
      console.log('📋 SITUAÇÃO:');
      console.log(`   - Médico está vinculado a ${links.length} hospital(is)`);
      console.log(`   - MAS não está vinculado ao hospital: ${hospitalId}`);
      console.log('');
      console.log('💡 SOLUÇÃO:');
      console.log('   Adicionar vínculo com o hospital correto:');
      console.log('');
      console.log('   SQL:');
      console.log(`   INSERT INTO doctor_hospital (doctor_id, hospital_id, is_active)`);
      console.log(`   VALUES ('${doctor?.id}', '${hospitalId}', true)`);
      console.log(`   ON CONFLICT (doctor_id, hospital_id) DO UPDATE SET is_active = true;`);
      console.log('');
    } else {
      console.log('✅ VÍNCULO EXISTE!');
      console.log('');
      console.log('⚠️  MAS o erro persiste. Possíveis causas:');
      console.log('   1. Problema na configuração da relação no Supabase');
      console.log('   2. Cache do navegador');
      console.log('   3. RLS bloqueando a query com JOIN');
      console.log('');
      console.log('💡 SOLUÇÃO ALTERNATIVA:');
      console.log('   Modificar useDoctors.ts para não usar JOIN');
    }
  }

  console.log('\n' + '═'.repeat(80));
}

debugDoctorHospitalLink().catch(console.error);

