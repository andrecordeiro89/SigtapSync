const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas!');
  console.log('Certifique-se de que VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão definidas no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateAIHDifference() {
  console.log('🔍 Investigando diferença na contagem de AIHs...');
  console.log('=' .repeat(60));

  try {
    // 1. Contar AIHs na tabela 'aihs'
    console.log('📊 Contando AIHs na tabela "aihs"...');
    const { count: aihsCount, error: aihsError } = await supabase
      .from('aihs')
      .select('*', { count: 'exact', head: true });

    if (aihsError) {
      console.error('❌ Erro ao contar AIHs:', aihsError);
      return;
    }

    console.log(`✅ Total de AIHs na tabela "aihs": ${aihsCount}`);

    // 2. Contar AIHs distintas na tabela 'procedure_records'
    console.log('\n📊 Contando AIHs distintas na tabela "procedure_records"...');
    const { data: procedureAIHs, error: procedureError } = await supabase
      .from('procedure_records')
      .select('aih_number')
      .not('aih_number', 'is', null);

    if (procedureError) {
      console.error('❌ Erro ao buscar AIHs dos procedimentos:', procedureError);
      return;
    }

    const uniqueAIHsInProcedures = new Set(procedureAIHs.map(p => p.aih_number)).size;
    console.log(`✅ AIHs distintas na tabela "procedure_records": ${uniqueAIHsInProcedures}`);

    // 3. Contar AIHs na view v_aih_billing_summary
    console.log('\n📊 Contando AIHs na view "v_aih_billing_summary"...');
    const { count: billingCount, error: billingError } = await supabase
      .from('v_aih_billing_summary')
      .select('*', { count: 'exact', head: true });

    if (billingError) {
      console.error('❌ Erro ao contar AIHs na view de faturamento:', billingError);
      return;
    }

    console.log(`✅ Total de AIHs na view "v_aih_billing_summary": ${billingCount}`);

    // 4. Análise das diferenças
    console.log('\n' + '=' .repeat(60));
    console.log('📈 ANÁLISE DAS DIFERENÇAS:');
    console.log('=' .repeat(60));
    
    console.log(`Tabela "aihs": ${aihsCount}`);
    console.log(`Tabela "procedure_records" (AIHs distintas): ${uniqueAIHsInProcedures}`);
    console.log(`View "v_aih_billing_summary": ${billingCount}`);
    
    const diffAihsVsProcedures = aihsCount - uniqueAIHsInProcedures;
    const diffAihsVsBilling = aihsCount - billingCount;
    const diffProceduresVsBilling = uniqueAIHsInProcedures - billingCount;
    
    console.log(`\n🔍 Diferenças:`);
    console.log(`AIHs vs Procedures: ${diffAihsVsProcedures}`);
    console.log(`AIHs vs Billing: ${diffAihsVsBilling}`);
    console.log(`Procedures vs Billing: ${diffProceduresVsBilling}`);

    // 5. Investigar AIHs sem procedimentos
    console.log('\n🔍 Investigando AIHs sem procedimentos...');
    const { data: aihsWithoutProcedures, error: withoutProcError } = await supabase
      .from('aihs')
      .select('aih_number, patient_name, hospital_code')
      .not('aih_number', 'in', `(${procedureAIHs.map(p => `'${p.aih_number}'`).join(',')})`);

    if (withoutProcError) {
      console.error('❌ Erro ao buscar AIHs sem procedimentos:', withoutProcError);
    } else {
      console.log(`📋 AIHs sem procedimentos: ${aihsWithoutProcedures?.length || 0}`);
      if (aihsWithoutProcedures && aihsWithoutProcedures.length > 0) {
        console.log('Primeiras 5 AIHs sem procedimentos:');
        aihsWithoutProcedures.slice(0, 5).forEach((aih, index) => {
          console.log(`  ${index + 1}. AIH: ${aih.aih_number}, Paciente: ${aih.patient_name}, Hospital: ${aih.hospital_code}`);
        });
      }
    }

    // 6. Verificar AIHs com número null ou vazio
    console.log('\n🔍 Verificando AIHs com número null ou vazio...');
    const { count: nullAIHsCount, error: nullError } = await supabase
      .from('aihs')
      .select('*', { count: 'exact', head: true })
      .or('aih_number.is.null,aih_number.eq.');

    if (nullError) {
      console.error('❌ Erro ao contar AIHs com número null:', nullError);
    } else {
      console.log(`📋 AIHs com número null ou vazio: ${nullAIHsCount}`);
    }

    console.log('\n' + '=' .repeat(60));
    console.log('✅ Investigação concluída!');
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('❌ Erro durante a investigação:', error);
  }
}

// Executar a investigação
investigateAIHDifference().then(() => {
  console.log('\n🏁 Script finalizado.');
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

// Configuração do Supabase
const supabaseUrl = 'https://rnqfqjqjqjqjqjqjqjqj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJucWZxanFqcWpxanFqcWpxanFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ3MjU5NzQsImV4cCI6MjA1MDMwMTk3NH0.Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_Ej_