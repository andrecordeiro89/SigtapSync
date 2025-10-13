const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function vincularMedicoHospital() {
  console.log('🔧 CORREÇÃO: Vincular Médico ao Hospital\n');
  console.log('═'.repeat(80));

  const cns = '702002315432783';
  const hospitalId = '47eddf6e-ac64-4433-acc1-7b644a2b43d0';

  // 1. BUSCAR O MÉDICO
  console.log('\n1️⃣ BUSCANDO MÉDICO...');
  
  const { data: doctor, error: doctorError } = await supabase
    .from('doctors')
    .select('id, name, cns, specialty')
    .eq('cns', cns)
    .single();

  if (doctorError || !doctor) {
    console.log('   ❌ Erro ao buscar médico:', doctorError?.message);
    return;
  }

  console.log('   ✅ Médico encontrado:');
  console.log('      ID:', doctor.id);
  console.log('      Nome:', doctor.name);
  console.log('      CNS:', doctor.cns);

  // 2. BUSCAR O HOSPITAL
  console.log('\n2️⃣ VERIFICANDO HOSPITAL...');
  
  const { data: hospital, error: hospitalError } = await supabase
    .from('hospitals')
    .select('id, name, cnpj')
    .eq('id', hospitalId)
    .single();

  if (hospitalError || !hospital) {
    console.log('   ❌ Erro ao buscar hospital:', hospitalError?.message);
    return;
  }

  console.log('   ✅ Hospital encontrado:');
  console.log('      Nome:', hospital.name);
  console.log('      CNPJ:', hospital.cnpj);

  // 3. VERIFICAR SE JÁ EXISTE O VÍNCULO
  console.log('\n3️⃣ VERIFICANDO VÍNCULO EXISTENTE...');
  
  const { data: existingLink, error: checkError } = await supabase
    .from('doctor_hospital')
    .select('*')
    .eq('doctor_id', doctor.id)
    .eq('hospital_id', hospitalId)
    .maybeSingle();

  if (checkError) {
    console.log('   ❌ Erro ao verificar vínculo:', checkError.message);
  } else if (existingLink) {
    console.log('   ℹ️  Vínculo já existe:');
    console.log('      Ativo:', existingLink.is_active);
    
    if (!existingLink.is_active) {
      console.log('\n4️⃣ ATIVANDO VÍNCULO...');
      
      const { error: updateError } = await supabase
        .from('doctor_hospital')
        .update({ is_active: true })
        .eq('doctor_id', doctor.id)
        .eq('hospital_id', hospitalId);

      if (updateError) {
        console.log('   ❌ Erro ao ativar vínculo:', updateError.message);
      } else {
        console.log('   ✅ Vínculo ativado com sucesso!');
      }
    } else {
      console.log('   ✅ Vínculo já está ativo!');
    }
  } else {
    console.log('   ⚠️  Vínculo não existe. Criando...');
    
    // 4. CRIAR O VÍNCULO
    console.log('\n4️⃣ CRIANDO VÍNCULO...');
    
    const { data: newLink, error: insertError } = await supabase
      .from('doctor_hospital')
      .insert({
        doctor_id: doctor.id,
        hospital_id: hospitalId,
        is_active: true
      })
      .select()
      .single();

    if (insertError) {
      console.log('   ❌ Erro ao criar vínculo:', insertError.message);
      console.log('   📋 Detalhes:', insertError);
    } else {
      console.log('   ✅ Vínculo criado com sucesso!');
      console.log('      doctor_id:', newLink.doctor_id);
      console.log('      hospital_id:', newLink.hospital_id);
      console.log('      is_active:', newLink.is_active);
    }
  }

  // 5. TESTAR A QUERY NOVAMENTE
  console.log('\n5️⃣ TESTANDO QUERY APÓS CORREÇÃO...');
  
  const { data: testResult, error: testError } = await supabase
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

  if (testError) {
    console.log('   ❌ Ainda com erro:', testError.message);
  } else if (!testResult || testResult.length === 0) {
    console.log('   ⚠️  Query executou mas não retornou resultados');
    console.log('   💡 Pode ser necessário configurar a relação no Supabase');
  } else {
    console.log('   ✅ QUERY FUNCIONOU!');
    console.log('      Médico encontrado:', testResult[0].name);
    console.log('      CNS:', testResult[0].cns);
  }

  // 6. RESULTADO FINAL
  console.log('\n' + '═'.repeat(80));
  console.log('🎯 RESULTADO FINAL:\n');
  
  if (testResult && testResult.length > 0) {
    console.log('✅ SUCESSO! O médico agora está vinculado ao hospital!');
    console.log('');
    console.log('📋 PRÓXIMOS PASSOS:');
    console.log('   1. Limpar cache do navegador (Ctrl+Shift+Delete)');
    console.log('   2. Fazer hard refresh (Ctrl+F5)');
    console.log('   3. Tentar processar a AIH novamente');
    console.log('');
    console.log('   ✅ O sistema agora deve reconhecer o médico!');
  } else {
    console.log('⚠️  Vínculo criado mas a query ainda falha');
    console.log('');
    console.log('🔍 POSSÍVEL CAUSA:');
    console.log('   - A relação entre doctors e doctor_hospital não está');
    console.log('     configurada no Supabase (Foreign Key Relationship)');
    console.log('');
    console.log('💡 SOLUÇÃO ALTERNATIVA:');
    console.log('   Modificar useDoctors.ts para não usar JOIN');
  }

  console.log('\n' + '═'.repeat(80));
}

vincularMedicoHospital().catch(console.error);

