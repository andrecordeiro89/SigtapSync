import { supabase } from '../lib/supabase';
import { mockPatients, mockSigtapProcedures } from '../data/mockData';
import { CIS_HOSPITALS, CIS_STATS } from '../data/realHospitals';

export async function populateTestData() {
  try {
    console.log('🚀 Iniciando população da rede CIS - Centro Integrado em Saúde...');

    // 1. Inserir TODOS os hospitais CIS
    console.log(`📋 Verificando/Criando ${CIS_HOSPITALS.length} hospitais CIS...`);
    
    const insertedHospitals = [];
    
    for (const hospitalData of CIS_HOSPITALS) {
      // Verificar se hospital já existe
      const { data: existingHospital } = await supabase
        .from('hospitals')
        .select('*')
        .eq('cnpj', hospitalData.cnpj)
        .single();

      if (existingHospital) {
        console.log(`✅ ${hospitalData.name} já existe`);
        insertedHospitals.push(existingHospital);
      } else {
        console.log(`📋 Criando: ${hospitalData.name}...`);
        
        const { data: newHospital, error: hospitalError } = await supabase
          .from('hospitals')
          .insert([{
            name: hospitalData.name,
            cnpj: hospitalData.cnpj,
            address: hospitalData.address,
            city: hospitalData.city,
            state: hospitalData.state,
            zip_code: hospitalData.zip_code,
            phone: hospitalData.phone,
            email: hospitalData.email,
            habilitacoes: hospitalData.habilitacoes,
            is_active: hospitalData.is_active
          }])
          .select()
          .single();

        if (hospitalError) {
          console.error(`❌ Erro ao criar ${hospitalData.name}:`, hospitalError);
          throw hospitalError;
        }

        console.log(`✅ Criado: ${newHospital.name}`);
        insertedHospitals.push(newHospital);
      }
    }

    console.log(`🏥 Rede CIS completa: ${insertedHospitals.length} hospitais`);

    // 2. Criar Versão SIGTAP (usando hospital matriz como referência)
    const hospitalMatriz = insertedHospitals.find(h => 
      CIS_HOSPITALS.find(ch => ch.cnpj === h.cnpj && ch.type === 'matriz')
    );

    console.log('📊 Verificando versão SIGTAP...');
    const versionName = 'SIGTAP-2024-CIS-PRODUCAO';
    
    let version;
    const { data: existingVersion } = await supabase
      .from('sigtap_versions')
      .select('*')
      .eq('version_name', versionName)
      .single();

    if (existingVersion) {
      console.log('✅ Versão SIGTAP já existe:', existingVersion.version_name);
      version = existingVersion;
      
      // Ativar a versão se não estiver ativa
      if (!existingVersion.is_active) {
        await supabase
          .from('sigtap_versions')
          .update({ is_active: false })
          .neq('id', existingVersion.id);
        
        await supabase
          .from('sigtap_versions')
          .update({ is_active: true })
          .eq('id', existingVersion.id);
        
        console.log('✅ Versão SIGTAP ativada');
      }
    } else {
      console.log('📊 Criando versão SIGTAP para rede CIS...');
      
      // Desativar versões existentes
      await supabase
        .from('sigtap_versions')
        .update({ is_active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000');

      const { data: newVersion, error: versionError } = await supabase
        .from('sigtap_versions')
        .insert([{
          version_name: versionName,
          import_date: new Date().toISOString(),
          file_name: 'sigtap_cis_2024.xlsx',
          file_size: 5120000, // 5MB
          file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          total_procedures: mockSigtapProcedures.length,
          processing_time_ms: 8000,
          extraction_method: 'EXCEL',
          is_active: true,
          import_status: 'completed'
        }])
        .select()
        .single();

      if (versionError) {
        console.error('❌ Erro ao criar versão:', versionError);
        throw versionError;
      }

      console.log('✅ Versão SIGTAP CIS criada:', newVersion.version_name);
      version = newVersion;
    }

    const versionId = version.id;

    // 3. Inserir Procedimentos SIGTAP (expandidos para rede CIS)
    console.log('🏥 Verificando procedimentos SIGTAP...');
    const { data: existingProcedures } = await supabase
      .from('sigtap_procedures')
      .select('*')
      .eq('version_id', versionId);

    if (existingProcedures && existingProcedures.length > 0) {
      console.log(`✅ ${existingProcedures.length} procedimentos já existem`);
    } else {
      console.log('🏥 Inserindo procedimentos SIGTAP para rede CIS...');
      
      // Expandir procedimentos com especialidades CIS
      const expandedProcedures = [
        ...mockSigtapProcedures,
        
        // Procedimentos específicos para maternidade
        {
          code: '04110017',
          description: 'PARTO CESARIANO',
          valueAmb: 0,
          valueHosp: 650.45,
          valueProf: 325.22,
          complexity: 'Alta',
          financing: 'Média e Alta Complexidade'
        },
        {
          code: '04110023',
          description: 'PARTO NORMAL',
          valueAmb: 0,
          valueHosp: 425.80,
          valueProf: 212.90,
          complexity: 'Média',
          financing: 'Média e Alta Complexidade'
        },
        
        // Procedimentos de urgência
        {
          code: '03010108',
          description: 'ATENDIMENTO DE URGÊNCIA EM CLÍNICA MÉDICA',
          valueAmb: 25.67,
          valueHosp: 45.30,
          valueProf: 18.12,
          complexity: 'Média',
          financing: 'Média e Alta Complexidade'
        }
      ];

      const proceduresForDB = expandedProcedures.map(proc => ({
        version_id: versionId,
        code: proc.code,
        description: proc.description,
        origem: 'CIS_PRODUCAO',
        complexity: proc.complexity || 'Média',
        modality: 'Ambulatorial',
        registration_instrument: 'CIS',
        financing: proc.financing || 'SUS',
        value_amb: Math.round((proc.valueAmb || 0) * 100),
        value_amb_total: Math.round((proc.valueAmb || 0) * 100),
        value_hosp: Math.round((proc.valueHosp || 0) * 100),
        value_prof: Math.round((proc.valueProf || 0) * 100),
        value_hosp_total: Math.round((proc.valueHosp || 0) * 100),
        complementary_attribute: '',
        service_classification: proc.complexity || 'Geral',
        especialidade_leito: 'CLINICA MEDICA',
        gender: 'A',
        min_age: 0,
        min_age_unit: 'A',
        max_age: 120,
        max_age_unit: 'A',
        max_quantity: 1,
        average_stay: 0,
        points: 0,
        cbo: ['225125'],
        cid: ['Z000'],
        habilitation: null,
        habilitation_group: [],
        extraction_confidence: 100,
        validation_status: 'valid'
      }));

      const { error: procError } = await supabase
        .from('sigtap_procedures')
        .insert(proceduresForDB);

      if (procError) {
        console.error('❌ Erro ao inserir procedimentos:', procError);
        throw procError;
      }

      console.log(`✅ ${proceduresForDB.length} procedimentos SIGTAP inseridos`);
    }

    // 4. Criar pacientes de exemplo para cada hospital
    console.log('👥 Verificando pacientes de exemplo...');
    
    let totalPatientsCreated = 0;
    
    // Criar 1-2 pacientes por hospital para demonstração
    for (const hospital of insertedHospitals.slice(0, 3)) { // Apenas nos 3 primeiros para demonstração
      const { data: existingPatients } = await supabase
        .from('patients')
        .select('*')
        .eq('hospital_id', hospital.id);

      if (existingPatients && existingPatients.length > 0) {
        console.log(`✅ ${hospital.name}: ${existingPatients.length} pacientes já existem`);
        totalPatientsCreated += existingPatients.length;
      } else {
        console.log(`👥 Criando pacientes para: ${hospital.name}...`);
        
        const patientsForHospital = mockPatients.map((patient, index) => ({
          hospital_id: hospital.id,
          name: `${patient.name} - ${hospital.city}`,
          cns: `${patient.cns}${hospital.id.slice(-3)}`, // CNS único por hospital
          cpf: patient.id === '1' ? '11144477735' : '22255588846',
          birth_date: patient.birthDate,
          gender: patient.gender,
          address: patient.address,
          city: hospital.city, // Usar cidade do hospital
          state: hospital.state, // Usar estado do hospital
          zip_code: patient.zipCode?.replace(/\D/g, '') || hospital.zip_code,
          phone: patient.phone?.replace(/\D/g, '') || '11999999999',
          is_active: true
        }));

        const { data: insertedPatients, error: patientError } = await supabase
          .from('patients')
          .insert(patientsForHospital)
          .select();

        if (patientError) {
          console.error(`❌ Erro ao inserir pacientes para ${hospital.name}:`, patientError);
          // Não quebrar o processo por erro de pacientes
        } else {
          console.log(`✅ ${insertedPatients.length} pacientes criados para ${hospital.name}`);
          totalPatientsCreated += insertedPatients.length;
        }
      }
    }

    // 5. Estatísticas finais
    const { data: finalProcedures } = await supabase
      .from('sigtap_procedures')
      .select('*')
      .eq('version_id', versionId);

    const { data: allPatients } = await supabase
      .from('patients')
      .select('*')
      .in('hospital_id', insertedHospitals.map(h => h.id));

    const summary = {
      cisStats: CIS_STATS,
      hospitalsCreated: insertedHospitals.length,
      hospitalsList: insertedHospitals.map(h => ({ name: h.name, city: h.city })),
      version: version,
      proceduresCount: finalProcedures?.length || 0,
      patientsCount: allPatients?.length || 0,
      coverage: `${CIS_STATS.totalCities} cidades do Paraná`,
      message: `Rede CIS completa configurada! ${insertedHospitals.length} hospitais ativos.`
    };

    console.log('🎉 Rede CIS configurada com sucesso!');
    console.log(`📊 Resumo: ${summary.hospitalsCreated} hospitais, ${summary.proceduresCount} procedimentos, ${summary.patientsCount} pacientes`);
    
    return summary;

  } catch (error) {
    console.error('❌ Erro na configuração da rede CIS:', error);
    throw error;
  }
}

export async function clearTestData() {
  try {
    console.log('🧹 Limpando todos os dados da rede CIS...');

    await supabase.from('aih_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('procedure_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('aihs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('patients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('sigtap_procedures').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('sigtap_versions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('hospitals').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('✅ Todos os dados da rede CIS foram removidos');
    return { success: true, message: 'Rede CIS removida com sucesso!' };

  } catch (error) {
    console.error('❌ Erro ao limpar dados da rede CIS:', error);
    throw error;
  }
} 