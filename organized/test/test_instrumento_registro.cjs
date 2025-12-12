/**
 * 🧪 TESTE: Verificar se instrumento_registro está sendo carregado corretamente
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Credenciais do Supabase não encontradas no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInstrumentoRegistro() {
  console.log('\n🧪 TESTE: Verificação do Campo instrumento_registro\n');
  console.log('=' .repeat(60));

  try {
    // Teste 1: Verificar se o campo existe na tabela
    console.log('\n📋 Teste 1: Verificar estrutura da tabela sigtap_procedimentos_oficial');
    const { data: sample, error: sampleError } = await supabase
      .from('sigtap_procedimentos_oficial')
      .select('codigo, nome, instrumento_registro')
      .limit(5);

    if (sampleError) {
      console.error('❌ Erro ao buscar dados:', sampleError.message);
      return;
    }

    console.log(`✅ Campo instrumento_registro existe na tabela`);
    console.log(`✅ Encontrados ${sample?.length || 0} registros de exemplo\n`);

    // Mostrar exemplos
    console.log('📊 Exemplos de registros:');
    sample?.forEach((item, index) => {
      console.log(`\n   ${index + 1}. Código: ${item.codigo}`);
      console.log(`      Nome: ${item.nome?.substring(0, 50)}...`);
      console.log(`      Instrumento: ${item.instrumento_registro || '(vazio)'}`);
    });

    // Teste 2: Buscar procedimento específico (do exemplo da imagem)
    console.log('\n' + '='.repeat(60));
    console.log('\n📋 Teste 2: Buscar procedimento 04.08.01.005-5 (ARTROPLASTIA)');
    
    const testCodes = [
      '04.08.01.005-5',
      '0408010055',  // Sem formatação
      '04080100055'  // Outras variações
    ];

    for (const code of testCodes) {
      const { data: procedureData, error: procedureError } = await supabase
        .from('sigtap_procedimentos_oficial')
        .select('codigo, nome, instrumento_registro')
        .eq('codigo', code)
        .single();

      if (!procedureError && procedureData) {
        console.log(`\n✅ Encontrado com código: ${code}`);
        console.log(`   Nome: ${procedureData.nome}`);
        console.log(`   Instrumento: ${procedureData.instrumento_registro || '(vazio)'}`);
        break;
      }
    }

    // Teste 3: Estatísticas gerais
    console.log('\n' + '='.repeat(60));
    console.log('\n📋 Teste 3: Estatísticas do campo instrumento_registro');

    const { count: totalCount } = await supabase
      .from('sigtap_procedimentos_oficial')
      .select('*', { count: 'exact', head: true });

    console.log(`\n   Total de procedimentos: ${totalCount || 0}`);

    // Contar procedimentos com instrumento preenchido
    const { data: withInstrument } = await supabase
      .from('sigtap_procedimentos_oficial')
      .select('instrumento_registro')
      .not('instrumento_registro', 'is', null)
      .neq('instrumento_registro', '');

    console.log(`   Com instrumento preenchido: ${withInstrument?.length || 0}`);
    console.log(`   Sem instrumento: ${(totalCount || 0) - (withInstrument?.length || 0)}`);

    // Teste 4: Verificar distribuição de instrumentos
    console.log('\n' + '='.repeat(60));
    console.log('\n📋 Teste 4: Distribuição por tipo de instrumento');

    const { data: allInstruments } = await supabase
      .from('sigtap_procedimentos_oficial')
      .select('instrumento_registro')
      .not('instrumento_registro', 'is', null)
      .neq('instrumento_registro', '');

    if (allInstruments) {
      const distribution = {};
      allInstruments.forEach(item => {
        const inst = item.instrumento_registro || 'Não informado';
        distribution[inst] = (distribution[inst] || 0) + 1;
      });

      console.log('\n   Distribuição:');
      Object.entries(distribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([inst, count]) => {
          console.log(`   ${inst}: ${count} procedimentos`);
        });
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO!\n');

  } catch (error) {
    console.error('\n❌ Erro durante o teste:', error.message);
    console.error(error);
  }
}

// Executar teste
testInstrumentoRegistro().then(() => {
  console.log('🎉 Teste finalizado!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});

