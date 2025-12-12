/**
 * 🔍 Verificar estrutura da tabela sigtap_procedimentos_oficial
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Credenciais do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log('\n🔍 VERIFICANDO ESTRUTURA DA TABELA sigtap_procedimentos_oficial\n');
  console.log('='.repeat(70));

  try {
    // Buscar 1 registro para ver todas as colunas
    const { data: rows, error } = await supabase
      .from('sigtap_procedimentos_oficial')
      .select('*')
      .limit(1);
    
    const data = rows?.[0];

    if (error) {
      console.error('❌ Erro:', error.message);
      return;
    }

    if (data) {
      console.log('\n✅ Colunas disponíveis na tabela:\n');
      
      const columns = Object.keys(data);
      columns.forEach((col, index) => {
        const value = data[col];
        const type = typeof value;
        const preview = value ? String(value).substring(0, 50) : '(vazio)';
        
        console.log(`${index + 1}. ${col}`);
        console.log(`   Tipo: ${type}`);
        console.log(`   Exemplo: ${preview}`);
        console.log('');
      });

      console.log('='.repeat(70));
      console.log(`\n📊 Total de colunas: ${columns.length}\n`);

      // Procurar colunas relacionadas a instrumento
      const instrumentoCols = columns.filter(col => 
        col.toLowerCase().includes('instru') || 
        col.toLowerCase().includes('registro')
      );

      if (instrumentoCols.length > 0) {
        console.log('🎯 Colunas relacionadas a instrumento/registro:');
        instrumentoCols.forEach(col => {
          console.log(`   - ${col}: ${data[col]}`);
        });
      } else {
        console.log('⚠️  Nenhuma coluna relacionada a instrumento/registro encontrada');
      }

      console.log('\n' + '='.repeat(70));
    }

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    console.error(error);
  }
}

checkColumns().then(() => {
  console.log('\n✅ Verificação concluída!\n');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});

