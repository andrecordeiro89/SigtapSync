// Script para verificar se existem AIHs sem nenhum CNS válido
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAIHsSemCNS() {
  console.log('🔍 === VERIFICANDO AIHs SEM CNS VÁLIDO ===\n');
  
  try {
    // 1. Buscar todas as AIHs
    console.log('1. 📋 Buscando todas as AIHs...');
    const { data: aihs, error: aihError } = await supabase
      .from('aihs')
      .select('*');
    
    if (aihError) {
      console.error('❌ Erro ao buscar AIHs:', aihError);
      return;
    }
    
    console.log(`   ✅ ${aihs?.length || 0} AIHs encontradas`);
    
    if (!aihs || aihs.length === 0) {
      console.log('   ❌ Nenhuma AIH encontrada!');
      return;
    }
    
    // 2. Analisar CNS em cada AIH
    console.log('\n2. 🔍 Analisando CNS em cada AIH...');
    
    const stats = {
      total: aihs.length,
      com_cns_responsavel: 0,
      com_cns_solicitante: 0,
      com_cns_autorizador: 0,
      sem_nenhum_cns: 0,
      cns_responsavel_vazio: 0,
      cns_solicitante_vazio: 0,
      cns_autorizador_vazio: 0
    };
    
    const aihsSemCNS = [];
    const exemplosCNS = {
      responsavel: [],
      solicitante: [],
      autorizador: []
    };
    
    aihs.forEach((aih, index) => {
      // Verificar CNS Responsável
      const hasResponsavel = aih.cns_responsavel && aih.cns_responsavel.trim() !== '';
      const hasSolicitante = aih.cns_solicitante && aih.cns_solicitante.trim() !== '';
      const hasAutorizador = aih.cns_autorizador && aih.cns_autorizador.trim() !== '';
      
      if (hasResponsavel) {
        stats.com_cns_responsavel++;
        if (exemplosCNS.responsavel.length < 3) {
          exemplosCNS.responsavel.push(aih.cns_responsavel);
        }
      } else {
        stats.cns_responsavel_vazio++;
      }
      
      if (hasSolicitante) {
        stats.com_cns_solicitante++;
        if (exemplosCNS.solicitante.length < 3) {
          exemplosCNS.solicitante.push(aih.cns_solicitante);
        }
      } else {
        stats.cns_solicitante_vazio++;
      }
      
      if (hasAutorizador) {
        stats.com_cns_autorizador++;
        if (exemplosCNS.autorizador.length < 3) {
          exemplosCNS.autorizador.push(aih.cns_autorizador);
        }
      } else {
        stats.cns_autorizador_vazio++;
      }
      
      // Verificar se não tem NENHUM CNS válido
      if (!hasResponsavel && !hasSolicitante && !hasAutorizador) {
        stats.sem_nenhum_cns++;
        if (aihsSemCNS.length < 5) { // Guardar apenas os primeiros 5 exemplos
          aihsSemCNS.push({
            id: aih.id,
            aih_number: aih.aih_number,
            hospital_id: aih.hospital_id,
            cns_responsavel: aih.cns_responsavel,
            cns_solicitante: aih.cns_solicitante,
            cns_autorizador: aih.cns_autorizador
          });
        }
      }
    });
    
    // 3. Mostrar estatísticas
    console.log('\n3. 📊 ESTATÍSTICAS:');
    console.log(`   Total de AIHs: ${stats.total}`);
    console.log(`   ✅ Com CNS Responsável: ${stats.com_cns_responsavel} (${((stats.com_cns_responsavel/stats.total)*100).toFixed(1)}%)`);
    console.log(`   ⚠️ Com CNS Solicitante: ${stats.com_cns_solicitante} (${((stats.com_cns_solicitante/stats.total)*100).toFixed(1)}%)`);
    console.log(`   ⚠️ Com CNS Autorizador: ${stats.com_cns_autorizador} (${((stats.com_cns_autorizador/stats.total)*100).toFixed(1)}%)`);
    console.log(`   ❌ SEM NENHUM CNS: ${stats.sem_nenhum_cns} (${((stats.sem_nenhum_cns/stats.total)*100).toFixed(1)}%)`);
    
    console.log('\n   📋 Campos vazios:');
    console.log(`   CNS Responsável vazio: ${stats.cns_responsavel_vazio}`);
    console.log(`   CNS Solicitante vazio: ${stats.cns_solicitante_vazio}`);
    console.log(`   CNS Autorizador vazio: ${stats.cns_autorizador_vazio}`);
    
    // 4. Mostrar exemplos de CNS
    console.log('\n4. 📝 EXEMPLOS DE CNS:');
    console.log(`   CNS Responsável: [${exemplosCNS.responsavel.join(', ')}]`);
    console.log(`   CNS Solicitante: [${exemplosCNS.solicitante.join(', ')}]`);
    console.log(`   CNS Autorizador: [${exemplosCNS.autorizador.join(', ')}]`);
    
    // 5. Mostrar AIHs sem CNS (se houver)
    if (aihsSemCNS.length > 0) {
      console.log('\n5. 🚨 AIHs SEM NENHUM CNS VÁLIDO:');
      aihsSemCNS.forEach((aih, index) => {
        console.log(`   ${index + 1}. AIH: ${aih.aih_number} (ID: ${aih.id})`);
        console.log(`      Hospital: ${aih.hospital_id}`);
        console.log(`      CNS Responsável: '${aih.cns_responsavel}'`);
        console.log(`      CNS Solicitante: '${aih.cns_solicitante}'`);
        console.log(`      CNS Autorizador: '${aih.cns_autorizador}'`);
        console.log('');
      });
    } else {
      console.log('\n5. ✅ TODAS AS AIHs TÊM PELO MENOS UM CNS VÁLIDO');
    }
    
    // 6. Análise final
    console.log('\n6. 🔍 ANÁLISE FINAL:');
    
    if (stats.sem_nenhum_cns > 0) {
      console.log(`   🚨 PROBLEMA CONFIRMADO: ${stats.sem_nenhum_cns} AIHs sem nenhum CNS válido`);
      console.log('   💡 CAUSA: Estas AIHs irão gerar o "⚠️ Médico Não Identificado"');
      console.log('   🔧 SOLUÇÃO: Verificar o processo de extração/importação das AIHs');
      console.log('   📋 AÇÃO: Corrigir os CNS nestas AIHs ou investigar por que estão vazios');
    } else {
      console.log('   ✅ TODAS AS AIHs TÊM PELO MENOS UM CNS VÁLIDO');
      console.log('   🤔 MISTÉRIO: "Médico Não Identificado" NÃO deveria aparecer!');
      console.log('   🔍 INVESTIGAR: Problema pode estar na lógica do dashboard ou filtros');
    }
    
    // 7. Verificar se há CNS com valores estranhos
    console.log('\n7. 🔍 VERIFICANDO CNS COM VALORES ESTRANHOS...');
    
    const cnsEstranhos = [];
    
    aihs.forEach(aih => {
      [aih.cns_responsavel, aih.cns_solicitante, aih.cns_autorizador].forEach(cns => {
        if (cns && cns.trim() !== '') {
          // Verificar se o CNS tem formato válido (15 dígitos)
          if (!/^\d{15}$/.test(cns.trim())) {
            cnsEstranhos.push({
              aih_number: aih.aih_number,
              cns: cns,
              tipo: cns === aih.cns_responsavel ? 'responsavel' : 
                    cns === aih.cns_solicitante ? 'solicitante' : 'autorizador'
            });
          }
        }
      });
    });
    
    if (cnsEstranhos.length > 0) {
      console.log(`   ⚠️ ${cnsEstranhos.length} CNS com formato inválido encontrados:`);
      cnsEstranhos.slice(0, 5).forEach(item => {
        console.log(`      AIH ${item.aih_number}: CNS ${item.tipo} = '${item.cns}'`);
      });
    } else {
      console.log('   ✅ Todos os CNS têm formato válido (15 dígitos)');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a verificação:', error);
  }
}

// Executar a verificação
debugAIHsSemCNS().then(() => {
  console.log('\n🏁 Verificação concluída!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});