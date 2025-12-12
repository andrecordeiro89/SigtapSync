// Script para corrigir o campo doctor_cns para TODOS os médicos
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function fixAllDoctorCns() {
  try {
    console.log('🔧 === CORREÇÃO EM MASSA: TODOS OS DOCTOR_CNS ===\n');
    
    // 1. Verificar quantos registros precisam de correção
    console.log('1. 🔍 Verificando registros que precisam de correção...');
    const { data: brokenLinks, error: brokenError } = await supabase
      .from('doctor_hospital')
      .select(`
        id,
        doctor_id,
        doctor_cns,
        doctors (
          name,
          cns
        )
      `)
      .is('doctor_cns', null);
    
    if (brokenError) {
      console.error('❌ Erro ao buscar registros:', brokenError.message);
      return;
    }
    
    console.log(`📊 Registros que precisam de correção: ${brokenLinks?.length || 0}`);
    
    if (!brokenLinks || brokenLinks.length === 0) {
      console.log('✅ Nenhum registro precisa de correção!');
      return;
    }
    
    // 2. Mostrar alguns exemplos
    console.log('\n2. 📋 Exemplos de registros que serão corrigidos:');
    brokenLinks.slice(0, 5).forEach((link, index) => {
      console.log(`   ${index + 1}. ${link.doctors?.name || 'Nome não encontrado'} (CNS: ${link.doctors?.cns || 'N/A'})`);
    });
    
    if (brokenLinks.length > 5) {
      console.log(`   ... e mais ${brokenLinks.length - 5} registros`);
    }
    
    // 3. Executar correção em massa usando SQL direto
    console.log('\n3. 🚀 Executando correção em massa...');
    
    const { data: updateResult, error: updateError } = await supabase.rpc('fix_doctor_cns_bulk');
    
    if (updateError) {
      console.log('⚠️ Função RPC não existe. Usando método alternativo...');
      
      // Método alternativo: corrigir um por um
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < brokenLinks.length; i++) {
        const link = brokenLinks[i];
        const doctorCns = link.doctors?.cns;
        
        if (!doctorCns) {
          console.log(`   ⚠️ Pulando registro ${link.id}: CNS não encontrado`);
          errorCount++;
          continue;
        }
        
        const { error: individualError } = await supabase
          .from('doctor_hospital')
          .update({ doctor_cns: doctorCns })
          .eq('id', link.id);
        
        if (individualError) {
          console.log(`   ❌ Erro ao atualizar ${link.id}: ${individualError.message}`);
          errorCount++;
        } else {
          successCount++;
          if (i % 10 === 0 || i === brokenLinks.length - 1) {
            console.log(`   ✅ Progresso: ${i + 1}/${brokenLinks.length} (${successCount} sucessos, ${errorCount} erros)`);
          }
        }
      }
      
      console.log(`\n📊 Resultado da correção individual:`);
      console.log(`   ✅ Sucessos: ${successCount}`);
      console.log(`   ❌ Erros: ${errorCount}`);
      
    } else {
      console.log('✅ Correção em massa executada via RPC!');
      console.log(`📊 Registros atualizados: ${updateResult}`);
    }
    
    // 4. Verificar resultado final
    console.log('\n4. ✅ Verificando resultado final...');
    
    const { data: remainingBroken, error: remainingError } = await supabase
      .from('doctor_hospital')
      .select('id')
      .is('doctor_cns', null);
    
    if (remainingError) {
      console.error('❌ Erro ao verificar resultado:', remainingError.message);
    } else {
      console.log(`📊 Registros ainda com doctor_cns NULL: ${remainingBroken?.length || 0}`);
      
      if (!remainingBroken || remainingBroken.length === 0) {
        console.log('🎉 TODOS OS REGISTROS FORAM CORRIGIDOS!');
      } else {
        console.log(`⚠️ Ainda há ${remainingBroken.length} registros com problema`);
      }
    }
    
    // 5. Testar alguns médicos específicos
    console.log('\n5. 🧪 Testando médicos específicos...');
    
    const testCNSList = [
      '700108988282314', // JOAO VICTOR RODRIGUES
      '702801639045760', // ADRIANO MARCIO RISSATI JUNIOR
      '700003408332805'  // BRUNO BOSIO DA SILVA
    ];
    
    for (const cns of testCNSList) {
      const { data: testResult, error: testError } = await supabase
        .from('doctor_hospital')
        .select(`
          doctors (
            name
          ),
          hospitals (
            name
          )
        `)
        .eq('doctor_cns', cns)
        .eq('is_active', true)
        .limit(1);
      
      if (testError) {
        console.log(`   ❌ Erro ao testar CNS ${cns}: ${testError.message}`);
      } else if (testResult && testResult.length > 0) {
        console.log(`   ✅ CNS ${cns}: ${testResult[0].doctors?.name} encontrado`);
      } else {
        console.log(`   ⚠️ CNS ${cns}: Não encontrado`);
      }
    }
    
    // 6. Estatísticas finais
    console.log('\n6. 📊 Estatísticas finais...');
    
    const { data: totalLinks, error: totalError } = await supabase
      .from('doctor_hospital')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);
    
    const { data: validLinks, error: validError } = await supabase
      .from('doctor_hospital')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .not('doctor_cns', 'is', null);
    
    if (!totalError && !validError) {
      const totalCount = totalLinks || 0;
      const validCount = validLinks || 0;
      const percentage = totalCount > 0 ? ((validCount / totalCount) * 100).toFixed(1) : 0;
      
      console.log(`   Total de vínculos ativos: ${totalCount}`);
      console.log(`   Vínculos com doctor_cns válido: ${validCount}`);
      console.log(`   Porcentagem corrigida: ${percentage}%`);
      
      if (percentage === '100.0') {
        console.log('\n🎉 MISSÃO CUMPRIDA!');
        console.log('   Todos os vínculos hospitalares estão corrigidos');
        console.log('   Os médicos devem aparecer corretamente no dashboard');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro durante a correção em massa:', error);
  }
}

fixAllDoctorCns();