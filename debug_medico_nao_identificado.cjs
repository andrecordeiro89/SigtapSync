// Script para investigar o problema do "Médico Não Identificado"
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = 'https://fvtfxunakabdrlkocdme.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2dGZ4dW5ha2FiZHJsa29jZG1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5MzU2NDUsImV4cCI6MjA2NjUxMTY0NX0.sclE7gxen5qG5GMeyyAM_9tHR2iAlk1F1SyLeXBKvXc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigarMedicoNaoIdentificado() {
  console.log('🔍 === INVESTIGAÇÃO: MÉDICO NÃO IDENTIFICADO ===\n');
  
  try {
    // 1. Verificar total de AIHs
    console.log('📊 1. TOTAL DE AIHs NO SISTEMA');
    const { count: totalAIHs, error: totalError } = await supabase
      .from('aihs')
      .select('*', { count: 'exact', head: true });
    
    if (totalError) {
      console.error('❌ Erro ao contar AIHs:', totalError);
      return;
    }
    
    console.log(`   Total de AIHs: ${totalAIHs}\n`);
    
    // 2. Verificar AIHs SEM médico responsável
    console.log('🚫 2. AIHs SEM MÉDICO RESPONSÁVEL');
    const { data: aihsSemMedico, error: semMedicoError } = await supabase
      .from('aihs')
      .select(`
        id,
        aih_number,
        cns_responsavel,
        cns_solicitante,
        cns_autorizador,
        admission_date,
        processing_status,
        source_file,
        patients (
          name
        )
      `)
      .is('cns_responsavel', null)
      .limit(10);
    
    if (semMedicoError) {
      console.error('❌ Erro ao buscar AIHs sem médico:', semMedicoError);
    } else {
      console.log(`   AIHs sem CNS responsável: ${aihsSemMedico?.length || 0}`);
      if (aihsSemMedico && aihsSemMedico.length > 0) {
        console.log('   Primeiras 5 AIHs sem médico responsável:');
        aihsSemMedico.slice(0, 5).forEach((aih, index) => {
          console.log(`     ${index + 1}. AIH: ${aih.aih_number}`);
          console.log(`        Paciente: ${aih.patients?.name || 'N/A'}`);
          console.log(`        CNS Solicitante: ${aih.cns_solicitante || 'NULL'}`);
          console.log(`        CNS Autorizador: ${aih.cns_autorizador || 'NULL'}`);
          console.log(`        Data: ${aih.admission_date}`);
          console.log(`        Arquivo: ${aih.source_file || 'N/A'}\n`);
        });
      }
    }
    
    // 3. Verificar AIHs COM médico responsável
    console.log('✅ 3. AIHs COM MÉDICO RESPONSÁVEL');
    const { count: aihsComMedico, error: comMedicoError } = await supabase
      .from('aihs')
      .select('*', { count: 'exact', head: true })
      .not('cns_responsavel', 'is', null);
    
    if (comMedicoError) {
      console.error('❌ Erro ao contar AIHs com médico:', comMedicoError);
    } else {
      console.log(`   AIHs com CNS responsável: ${aihsComMedico}\n`);
    }
    
    // 4. Verificar CNS únicos no sistema
    console.log('👨‍⚕️ 4. CNS ÚNICOS NO SISTEMA');
    const { data: cnsUnicos, error: cnsError } = await supabase
      .from('aihs')
      .select('cns_responsavel, cns_solicitante, cns_autorizador')
      .not('cns_responsavel', 'is', null)
      .limit(100);
    
    if (cnsError) {
      console.error('❌ Erro ao buscar CNS:', cnsError);
    } else {
      const cnsSet = new Set();
      cnsUnicos?.forEach(aih => {
        if (aih.cns_responsavel) cnsSet.add(aih.cns_responsavel);
        if (aih.cns_solicitante) cnsSet.add(aih.cns_solicitante);
        if (aih.cns_autorizador) cnsSet.add(aih.cns_autorizador);
      });
      
      console.log(`   CNS únicos encontrados: ${cnsSet.size}`);
      console.log(`   Primeiros 5 CNS:`);
      Array.from(cnsSet).slice(0, 5).forEach((cns, index) => {
        console.log(`     ${index + 1}. ${cns}`);
      });
      console.log();
    }
    
    // 5. Verificar médicos cadastrados na tabela doctors
    console.log('🏥 5. MÉDICOS CADASTRADOS NA TABELA DOCTORS');
    const { count: medicosCount, error: medicosError } = await supabase
      .from('doctors')
      .select('*', { count: 'exact', head: true });
    
    if (medicosError) {
      console.error('❌ Erro ao contar médicos:', medicosError);
    } else {
      console.log(`   Total de médicos cadastrados: ${medicosCount}\n`);
    }
    
    // 6. Verificar se há CNS de AIHs que não estão na tabela doctors
    console.log('🔍 6. CNS DE AIHS NÃO CADASTRADOS COMO MÉDICOS');
    const { data: aihsCns, error: aihsCnsError } = await supabase
      .from('aihs')
      .select('cns_responsavel')
      .not('cns_responsavel', 'is', null)
      .limit(50);
    
    if (aihsCnsError) {
      console.error('❌ Erro ao buscar CNS das AIHs:', aihsCnsError);
    } else {
      const cnsAihs = [...new Set(aihsCns?.map(a => a.cns_responsavel).filter(Boolean))];
      
      for (const cns of cnsAihs.slice(0, 5)) {
        const { data: medico, error: medicoError } = await supabase
          .from('doctors')
          .select('name, cns, specialty')
          .eq('cns', cns)
          .single();
        
        if (medicoError || !medico) {
          console.log(`   ❌ CNS ${cns} NÃO encontrado na tabela doctors`);
        } else {
          console.log(`   ✅ CNS ${cns} encontrado: ${medico.name} (${medico.specialty})`);
        }
      }
      console.log();
    }
    
    // 7. Verificar uma AIH específica recente
    console.log('🔍 7. ANÁLISE DE AIH RECENTE');
    const { data: aihRecente, error: recenteError } = await supabase
      .from('aihs')
      .select(`
        id,
        aih_number,
        cns_responsavel,
        cns_solicitante,
        cns_autorizador,
        admission_date,
        patients (
          name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (recenteError) {
      console.error('❌ Erro ao buscar AIH recente:', recenteError);
    } else {
      console.log('   AIH mais recente:');
      console.log(`     ID: ${aihRecente.id}`);
      console.log(`     Número: ${aihRecente.aih_number}`);
      console.log(`     Paciente: ${aihRecente.patients?.name || 'N/A'}`);
      console.log(`     CNS Responsável: ${aihRecente.cns_responsavel || 'NULL'}`);
      console.log(`     CNS Solicitante: ${aihRecente.cns_solicitante || 'NULL'}`);
      console.log(`     CNS Autorizador: ${aihRecente.cns_autorizador || 'NULL'}`);
      console.log(`     Data: ${aihRecente.admission_date}\n`);
      
      // Verificar se este CNS está cadastrado
      if (aihRecente.cns_responsavel) {
        const { data: medicoRecente, error: medicoRecenteError } = await supabase
          .from('doctors')
          .select('name, cns, specialty')
          .eq('cns', aihRecente.cns_responsavel)
          .single();
        
        if (medicoRecenteError || !medicoRecente) {
          console.log(`   ❌ CNS ${aihRecente.cns_responsavel} desta AIH NÃO está cadastrado na tabela doctors`);
          console.log(`   🔧 SOLUÇÃO: Este CNS deveria ser cadastrado automaticamente ou manualmente\n`);
        } else {
          console.log(`   ✅ CNS ${aihRecente.cns_responsavel} está cadastrado: ${medicoRecente.name}\n`);
        }
      }
    }
    
    console.log('=' .repeat(60));
    console.log('📋 RESUMO DA INVESTIGAÇÃO:');
    console.log('=' .repeat(60));
    console.log(`• Total de AIHs: ${totalAIHs}`);
    console.log(`• AIHs com médico responsável: ${aihsComMedico}`);
    console.log(`• AIHs sem médico responsável: ${(aihsSemMedico?.length || 0)}`);
    console.log(`• Médicos cadastrados: ${medicosCount}`);
    console.log();
    console.log('🎯 POSSÍVEIS CAUSAS DO PROBLEMA:');
    console.log('1. AIHs sendo salvas sem CNS responsável');
    console.log('2. CNS das AIHs não estão sendo cadastrados na tabela doctors');
    console.log('3. Lógica de associação médico-paciente com fallback incorreto');
    console.log();
    
  } catch (error) {
    console.error('❌ Erro durante a investigação:', error);
  }
}

// Executar a investigação
investigarMedicoNaoIdentificado().then(() => {
  console.log('🏁 Investigação concluída.');
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});