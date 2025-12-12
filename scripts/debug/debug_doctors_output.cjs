// Script para simular exatamente o que a função getAllDoctorsWithPatients retorna
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Simular exatamente a função getAllDoctorsWithPatients
async function simulateGetAllDoctorsWithPatients() {
  console.log('🔍 === SIMULANDO getAllDoctorsWithPatients ===\n');
  
  try {
    // 1. Buscar AIHs
    console.log('1. 📋 Buscando AIHs...');
    const { data: aihsData, error: aihError } = await supabase
      .from('aihs')
      .select('*');
    
    if (aihError) {
      console.error('❌ Erro ao buscar AIHs:', aihError);
      return;
    }
    
    console.log(`   ✅ ${aihsData?.length || 0} AIHs encontradas`);
    
    // 2. Extrair CNS únicos com lógica de priorização
    console.log('\n2. 🎯 Extraindo CNS únicos com priorização...');
    
    const uniqueDoctorsCns = [];
    const cnsStats = {
      'NAO_IDENTIFICADO': 0,
      'com_cns_responsavel': 0,
      'com_cns_solicitante': 0,
      'com_cns_autorizador': 0
    };
    
    if (aihsData) {
      const cnsSet = new Set();
      
      aihsData.forEach(aih => {
        let selectedCNS = null;
        
        // Lógica de priorização exata do código original
        if (aih.cns_responsavel && aih.cns_responsavel.trim() !== '') {
          selectedCNS = aih.cns_responsavel;
          cnsStats.com_cns_responsavel++;
        } else if (aih.cns_solicitante && aih.cns_solicitante.trim() !== '') {
          selectedCNS = aih.cns_solicitante;
          cnsStats.com_cns_solicitante++;
        } else if (aih.cns_autorizador && aih.cns_autorizador.trim() !== '') {
          selectedCNS = aih.cns_autorizador;
          cnsStats.com_cns_autorizador++;
        } else {
          selectedCNS = 'NAO_IDENTIFICADO';
          cnsStats['NAO_IDENTIFICADO']++;
        }
        
        cnsSet.add(selectedCNS);
      });
      
      uniqueDoctorsCns.push(...Array.from(cnsSet));
    }
    
    console.log(`   📊 CNS únicos encontrados: ${uniqueDoctorsCns.length}`);
    console.log(`   📋 Lista: [${uniqueDoctorsCns.join(', ')}]`);
    console.log('   📈 Estatísticas:');
    console.log(`      Com CNS Responsável: ${cnsStats.com_cns_responsavel}`);
    console.log(`      Com CNS Solicitante: ${cnsStats.com_cns_solicitante}`);
    console.log(`      Com CNS Autorizador: ${cnsStats.com_cns_autorizador}`);
    console.log(`      Não Identificado: ${cnsStats['NAO_IDENTIFICADO']}`);
    
    // 3. Buscar dados reais dos médicos
    console.log('\n3. 👨‍⚕️ Buscando dados reais dos médicos...');
    
    const realDoctorsMap = new Map();
    
    if (uniqueDoctorsCns.length > 0) {
      const validCnsList = uniqueDoctorsCns.filter(cns => cns !== 'NAO_IDENTIFICADO');
      
      if (validCnsList.length > 0) {
        const { data: doctorsData, error: doctorsError } = await supabase
          .from('doctors')
          .select('*')
          .in('cns', validCnsList);
        
        if (!doctorsError && doctorsData) {
          console.log(`   ✅ ${doctorsData.length} médicos encontrados na tabela doctors`);
          
          doctorsData.forEach(doctor => {
            realDoctorsMap.set(doctor.cns, {
              name: doctor.name,
              crm: doctor.crm || '',
              specialty: doctor.specialty || 'Especialidade não informada',
              hospitals: [] // Simplificado para este debug
            });
          });
        } else {
          console.log('   ❌ Erro ao buscar médicos ou nenhum encontrado');
        }
      }
    }
    
    // 4. Criar estrutura final dos médicos (igual ao código original)
    console.log('\n4. 🏗️ Criando estrutura final dos médicos...');
    
    const doctorsMap = new Map();
    
    uniqueDoctorsCns.forEach(cns => {
      const realData = realDoctorsMap.get(cns);
      
      let doctorInfo;
      if (cns === 'NAO_IDENTIFICADO') {
        doctorInfo = {
          cns: 'NAO_IDENTIFICADO',
          name: '⚠️ Médico Não Identificado',
          crm: 'N/A',
          specialty: 'AIHs sem CNS médico'
        };
        console.log(`   🚨 Criado: ${doctorInfo.name}`);
      } else if (realData) {
        doctorInfo = {
          cns: cns,
          name: realData.name,
          crm: realData.crm || '',
          specialty: realData.specialty || 'Especialidade não informada'
        };
        console.log(`   ✅ Médico cadastrado: ${doctorInfo.name} (CNS: ${cns})`);
      } else {
        doctorInfo = {
          cns: cns,
          name: `🔍 Dr(a). CNS ${cns}`,
          crm: 'Não Cadastrado',
          specialty: 'Médico não cadastrado no sistema'
        };
        console.log(`   ⚠️ Médico temporário: ${doctorInfo.name}`);
      }
      
      doctorsMap.set(cns, {
        doctor_info: doctorInfo,
        hospitals: realData?.hospitals || [],
        patients: [] // Simplificado para este debug
      });
    });
    
    // 5. Mostrar resultado final
    console.log('\n5. 📋 RESULTADO FINAL:');
    console.log(`   Total de médicos que serão retornados: ${doctorsMap.size}`);
    
    doctorsMap.forEach((doctor, cns) => {
      console.log(`   - ${doctor.doctor_info.name} (CNS: ${cns})`);
      console.log(`     Especialidade: ${doctor.doctor_info.specialty}`);
    });
    
    // 6. Análise do problema
    console.log('\n6. 🔍 ANÁLISE DO PROBLEMA:');
    
    const hasNaoIdentificado = doctorsMap.has('NAO_IDENTIFICADO');
    const tempDoctors = Array.from(doctorsMap.values()).filter(d => 
      d.doctor_info.name.startsWith('🔍 Dr(a). CNS')
    );
    
    if (hasNaoIdentificado) {
      console.log('   ✅ "⚠️ Médico Não Identificado" está sendo criado corretamente');
      console.log('   💡 CAUSA: Existem AIHs sem nenhum CNS válido');
    }
    
    if (tempDoctors.length > 0) {
      console.log(`   ⚠️ ${tempDoctors.length} médicos temporários criados (CNS não cadastrados)`);
      console.log('   💡 CAUSA: CNS válidos nas AIHs mas não cadastrados na tabela doctors');
      console.log('   🔧 SOLUÇÃO: Cadastrar estes médicos na tabela doctors');
      
      tempDoctors.forEach(doctor => {
        console.log(`      - ${doctor.doctor_info.name}`);
      });
    }
    
    if (!hasNaoIdentificado && tempDoctors.length === 0) {
      console.log('   ✅ Todos os médicos estão corretamente cadastrados');
      console.log('   🔍 INVESTIGAR: Problema pode estar na exibição do dashboard');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a simulação:', error);
  }
}

// Executar a simulação
simulateGetAllDoctorsWithPatients().then(() => {
  console.log('\n🏁 Simulação concluída!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});