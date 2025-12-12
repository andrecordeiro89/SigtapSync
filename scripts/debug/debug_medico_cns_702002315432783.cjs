const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function debugMedicoCNS() {
  console.log('🔍 DIAGNÓSTICO: Médico CNS 702002315432783\n');
  console.log('═'.repeat(80));

  const cnsTarget = '702002315432783';

  // 1. BUSCAR NA TABELA DOCTORS (exatamente como o sistema faz)
  console.log('\n1️⃣ BUSCA EXATA NA TABELA DOCTORS (como o sistema faz):');
  console.log('   Query: .from("doctors").select("*").eq("cns", "702002315432783")');
  
  const { data: doctorExact, error: errorExact } = await supabase
    .from('doctors')
    .select('*')
    .eq('cns', cnsTarget.trim());

  if (errorExact) {
    console.log('   ❌ Erro:', errorExact.message);
  } else if (!doctorExact || doctorExact.length === 0) {
    console.log('   ⚠️  MÉDICO NÃO ENCONTRADO com busca exata!');
  } else {
    console.log('   ✅ Médico encontrado:', {
      id: doctorExact[0].id,
      name: doctorExact[0].name,
      cns: doctorExact[0].cns,
      crm: doctorExact[0].crm,
      specialty: doctorExact[0].specialty,
      hospital_id: doctorExact[0].hospital_id
    });
  }

  // 2. BUSCAR TODOS OS MÉDICOS E VERIFICAR CNS
  console.log('\n2️⃣ BUSCANDO TODOS OS MÉDICOS E COMPARANDO CNS:');
  
  const { data: allDoctors, error: errorAll } = await supabase
    .from('doctors')
    .select('id, name, cns, crm');

  if (errorAll) {
    console.log('   ❌ Erro:', errorAll.message);
  } else {
    console.log(`   📊 Total de médicos cadastrados: ${allDoctors.length}`);
    
    // Procurar variações do CNS
    const variations = allDoctors.filter(d => {
      const dcns = String(d.cns || '');
      return dcns.includes('702002315432783') || 
             dcns.replace(/\s/g, '') === cnsTarget ||
             dcns === cnsTarget;
    });

    if (variations.length > 0) {
      console.log('\n   ✅ ENCONTRADO com variações:');
      variations.forEach(v => {
        console.log('      -', {
          id: v.id,
          name: v.name,
          cns: v.cns,
          cns_length: String(v.cns || '').length,
          cns_type: typeof v.cns,
          cns_com_espacos: JSON.stringify(v.cns),
          crm: v.crm
        });
      });
    } else {
      console.log('   ⚠️  Nenhuma variação encontrada');
    }
  }

  // 3. BUSCAR CNS SIMILARES (pode ter dígito errado)
  console.log('\n3️⃣ BUSCANDO CNS SIMILARES (primeiros 10 dígitos):');
  
  const prefixo = cnsTarget.substring(0, 10);
  const similar = allDoctors?.filter(d => {
    const dcns = String(d.cns || '');
    return dcns.startsWith(prefixo);
  }) || [];

  if (similar.length > 0) {
    console.log(`   📋 Encontrados ${similar.length} CNS similares:`);
    similar.forEach(s => {
      console.log('      -', {
        name: s.name,
        cns: s.cns,
        match: s.cns === cnsTarget ? '✅ EXATO' : '⚠️  Diferente'
      });
    });
  } else {
    console.log('   ⚠️  Nenhum CNS similar encontrado');
  }

  // 4. VERIFICAR AIHS COM ESTE CNS RESPONSÁVEL
  console.log('\n4️⃣ AIHS QUE USAM ESTE CNS COMO RESPONSÁVEL:');
  
  const { data: aihsWithCNS, error: errorAIH } = await supabase
    .from('aihs')
    .select('id, aih_number, cns_responsavel, admission_date')
    .eq('cns_responsavel', cnsTarget)
    .order('admission_date', { ascending: false })
    .limit(5);

  if (errorAIH) {
    console.log('   ❌ Erro:', errorAIH.message);
  } else if (!aihsWithCNS || aihsWithCNS.length === 0) {
    console.log('   ℹ️  Nenhuma AIH encontrada com este CNS como responsável');
  } else {
    console.log(`   ✅ ${aihsWithCNS.length} AIHs encontradas:`);
    aihsWithCNS.forEach(a => {
      console.log('      -', {
        aih: a.aih_number,
        cns_responsavel: a.cns_responsavel,
        data: a.admission_date
      });
    });
  }

  // 5. VERIFICAR PROCEDURE_RECORDS COM ESTE CNS
  console.log('\n5️⃣ PROCEDURE_RECORDS COM ESTE CNS:');
  
  const { data: procedures, error: errorProc } = await supabase
    .from('procedure_records')
    .select('id, aih_id, doctor_cns, procedure_code')
    .eq('doctor_cns', cnsTarget)
    .limit(5);

  if (errorProc) {
    console.log('   ❌ Erro:', errorProc.message);
  } else if (!procedures || procedures.length === 0) {
    console.log('   ℹ️  Nenhum procedure_record encontrado com este CNS');
  } else {
    console.log(`   ✅ ${procedures.length} procedures encontrados com este CNS`);
  }

  // 6. DIAGNÓSTICO FINAL
  console.log('\n' + '═'.repeat(80));
  console.log('🎯 DIAGNÓSTICO FINAL:\n');

  if (doctorExact && doctorExact.length > 0) {
    console.log('✅ Médico ESTÁ cadastrado na tabela doctors');
    console.log('✅ O sistema DEVERIA reconhecer o médico');
    console.log('\n⚠️  POSSÍVEL PROBLEMA:');
    console.log('   - Cache do navegador');
    console.log('   - Conexão com Supabase');
    console.log('   - Erro de runtime no frontend');
    console.log('\n💡 SOLUÇÃO:');
    console.log('   1. Limpar cache do navegador (Ctrl+Shift+Delete)');
    console.log('   2. Fazer hard refresh (Ctrl+F5)');
    console.log('   3. Verificar console do navegador por erros');
  } else if (variations.length > 0) {
    console.log('⚠️  Médico encontrado mas com PROBLEMA NO CNS');
    console.log(`   CNS esperado: "${cnsTarget}"`);
    console.log(`   CNS no banco: "${variations[0].cns}"`);
    console.log('\n❌ PROBLEMA IDENTIFICADO:');
    console.log('   - CNS pode ter espaços extras');
    console.log('   - CNS pode ter caracteres invisíveis');
    console.log('   - Tipo de dado pode estar incorreto');
    console.log('\n💡 SOLUÇÃO:');
    console.log(`   Execute: UPDATE doctors SET cns = '${cnsTarget}' WHERE id = '${variations[0].id}';`);
  } else {
    console.log('❌ Médico NÃO está cadastrado na tabela doctors');
    console.log('\n💡 SOLUÇÃO:');
    console.log('   Cadastrar o médico antes de processar a AIH:');
    console.log('   1. Ir para tela "Corpo Médico"');
    console.log('   2. Clicar em "Adicionar Médico"');
    console.log(`   3. Preencher com CNS: ${cnsTarget}`);
    console.log('   4. Depois processar a AIH novamente');
  }

  console.log('\n' + '═'.repeat(80));
}

debugMedicoCNS().catch(console.error);

