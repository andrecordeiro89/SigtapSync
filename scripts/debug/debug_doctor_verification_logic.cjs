const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testDoctorVerification() {
  console.log('🔍 TESTE: Verificação de Médico (mesma lógica do sistema)\n');
  console.log('═'.repeat(80));

  const cns = '702002315432783';

  // 1. TESTE COM .single() (como o sistema faz)
  console.log('\n1️⃣ TESTE COM .single() (LÓGICA ATUAL DO SISTEMA):');
  console.log('   Código:');
  console.log('   const { data, error } = await supabase');
  console.log('     .from("doctors")');
  console.log('     .select("id")');
  console.log(`     .eq("cns", "${cns}")`);
  console.log('     .single();');
  console.log('');

  try {
    const { data: dataSingle, error: errorSingle } = await supabase
      .from('doctors')
      .select('id')
      .eq('cns', cns.trim())
      .single();

    if (errorSingle) {
      console.log(`   ❌ ERRO: ${errorSingle.message}`);
      console.log(`   📋 Código do erro: ${errorSingle.code}`);
      
      if (errorSingle.code === 'PGRST116') {
        console.log('   ⚠️  PGRST116 = Nenhum registro encontrado');
        console.log('   🔍 MAS o diagnóstico mostrou que o médico existe!');
        console.log('   💡 POSSÍVEL PROBLEMA: Timing de cache ou RLS (Row Level Security)');
      } else if (errorSingle.code === 'PGRST202') {
        console.log('   ⚠️  PGRST202 = Múltiplos registros encontrados (duplicação!)');
      }
    } else if (dataSingle) {
      console.log('   ✅ SUCESSO!');
      console.log('   📋 Médico encontrado:', dataSingle);
      console.log('   ✅ A função doctorExistsByCNS() deveria retornar TRUE');
    } else {
      console.log('   ⚠️  data = null (sem erro, mas sem dados)');
    }
  } catch (e) {
    console.log('   ❌ EXCEÇÃO:', e.message);
  }

  // 2. TESTE SEM .single() (busca múltipla)
  console.log('\n2️⃣ TESTE SEM .single() (BUSCA MÚLTIPLA):');
  
  const { data: dataMultiple, error: errorMultiple } = await supabase
    .from('doctors')
    .select('id, name, cns, is_active')
    .eq('cns', cns.trim());

  if (errorMultiple) {
    console.log('   ❌ Erro:', errorMultiple.message);
  } else {
    console.log(`   📊 Registros encontrados: ${dataMultiple?.length || 0}`);
    
    if (dataMultiple && dataMultiple.length > 0) {
      console.log('   ✅ Médicos encontrados:');
      dataMultiple.forEach((doc, index) => {
        console.log(`      ${index + 1}. ID: ${doc.id}`);
        console.log(`         Nome: ${doc.name}`);
        console.log(`         CNS: ${doc.cns}`);
        console.log(`         Ativo: ${doc.is_active}`);
      });

      if (dataMultiple.length > 1) {
        console.log('\n   ⚠️  PROBLEMA DETECTADO: DUPLICAÇÃO!');
        console.log('   💡 .single() falha quando há múltiplos registros');
        console.log('   💡 Isso explica por que o sistema não reconhece o médico');
      }
    }
  }

  // 3. VERIFICAR is_active
  console.log('\n3️⃣ VERIFICAR STATUS is_active:');
  
  const { data: activeCheck, error: activeError } = await supabase
    .from('doctors')
    .select('id, name, cns, is_active')
    .eq('cns', cns.trim())
    .eq('is_active', true);

  if (activeError) {
    console.log('   ❌ Erro:', activeError.message);
  } else {
    console.log(`   📊 Médicos ATIVOS com este CNS: ${activeCheck?.length || 0}`);
    
    if (activeCheck && activeCheck.length > 0) {
      activeCheck.forEach(doc => {
        console.log(`      - ${doc.name} (ID: ${doc.id}, ativo: ${doc.is_active})`);
      });
    } else {
      console.log('   ⚠️  Nenhum médico ATIVO encontrado!');
      console.log('   💡 O médico pode estar com is_active = false');
    }
  }

  // 4. DIAGNÓSTICO FINAL
  console.log('\n' + '═'.repeat(80));
  console.log('🎯 DIAGNÓSTICO E SOLUÇÃO:\n');

  if (dataMultiple && dataMultiple.length > 1) {
    console.log('❌ PROBLEMA IDENTIFICADO: DUPLICAÇÃO DE MÉDICO');
    console.log(`   Existem ${dataMultiple.length} registros com o mesmo CNS ${cns}`);
    console.log('');
    console.log('📋 CAUSA:');
    console.log('   - O método .single() falha quando há múltiplos registros');
    console.log('   - O sistema interpreta isso como "médico não encontrado"');
    console.log('');
    console.log('💡 SOLUÇÃO:');
    console.log('   Opção 1: Deletar registros duplicados (manter apenas 1)');
    console.log('   Opção 2: Modificar doctorExistsByCNS() para usar .limit(1) em vez de .single()');
    console.log('');
    console.log('🛠️  SQL para identificar duplicados:');
    console.log(`   SELECT * FROM doctors WHERE cns = '${cns}' ORDER BY created_at;`);
    console.log('');
    console.log('🛠️  SQL para deletar duplicados (MANTER O MAIS ANTIGO):');
    console.log(`   DELETE FROM doctors`);
    console.log(`   WHERE cns = '${cns}'`);
    console.log(`   AND id NOT IN (`);
    console.log(`     SELECT id FROM doctors WHERE cns = '${cns}' ORDER BY created_at LIMIT 1`);
    console.log(`   );`);
  } else if (dataMultiple && dataMultiple.length === 1) {
    console.log('✅ MÉDICO ÚNICO ENCONTRADO');
    console.log('');
    console.log('⚠️  MAS o sistema ainda reporta "não cadastrado"');
    console.log('');
    console.log('🔍 POSSÍVEIS CAUSAS:');
    console.log('   1. Cache do navegador desatualizado');
    console.log('   2. Row Level Security (RLS) bloqueando a consulta no frontend');
    console.log('   3. Problema de conexão temporária com Supabase');
    console.log('   4. is_active = false');
    console.log('');
    console.log('💡 SOLUÇÕES:');
    console.log('   1. Limpar cache: Ctrl+Shift+Delete');
    console.log('   2. Hard refresh: Ctrl+F5');
    console.log('   3. Verificar RLS policies na tabela doctors');
    console.log('   4. Abrir console do navegador (F12) e verificar erros');
    console.log('   5. Verificar se is_active = true');
  } else {
    console.log('❌ MÉDICO NÃO ENCONTRADO NA VERIFICAÇÃO');
    console.log('');
    console.log('⚠️  INCONSISTÊNCIA DETECTADA:');
    console.log('   - O diagnóstico anterior mostrou que o médico existe');
    console.log('   - Esta verificação não encontrou o médico');
    console.log('');
    console.log('🔍 POSSÍVEL CAUSA:');
    console.log('   - Row Level Security (RLS) está bloqueando a consulta');
    console.log('   - A chave ANON_KEY não tem permissão para ver este registro');
    console.log('');
    console.log('💡 SOLUÇÃO:');
    console.log('   Verificar RLS policies na tabela doctors no Supabase');
  }

  console.log('\n' + '═'.repeat(80));
}

testDoctorVerification().catch(console.error);

