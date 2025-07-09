# 💻 EXEMPLO DE IMPLEMENTAÇÃO: CORREÇÃO DA LÓGICA DE MÉDICOS POR HOSPITAL

## 🎯 IMPLEMENTAÇÃO PRÁTICA DAS CORREÇÕES

### **1. 🔧 Corrigir Contagem Total de Médicos**

```typescript
// src/components/HospitalRevenueDashboard.tsx - VERSÃO CORRIGIDA

import React, { useState, useEffect } from 'react';
import { DoctorsRevenueService, type HospitalStats, type DoctorAggregated } from '../services/doctorsRevenueService';

const HospitalRevenueDashboard: React.FC = () => {
  const [hospitalStats, setHospitalStats] = useState<HospitalStats[]>([]);
  const [uniqueDoctors, setUniqueDoctors] = useState<DoctorAggregated[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHospitalStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // ✅ CORREÇÃO: Carregar dados únicos para contagem total
      const [hospitalStatsResult, uniqueDoctorsResult] = await Promise.all([
        DoctorsRevenueService.getHospitalStats(),
        DoctorsRevenueService.getDoctorsAggregated()
      ]);
      
      setHospitalStats(hospitalStatsResult || []);
      setUniqueDoctors(uniqueDoctorsResult.doctors || []);
      
    } catch (error) {
      console.error('❌ Erro ao carregar hospitais:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar dados dos hospitais');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHospitalStats();
  }, []);

  // ✅ CORREÇÃO: Cálculos corretos sem duplicação
  const totalHospitals = hospitalStats.length;
  
  // ❌ ANTES: const totalActiveDoctors = hospitalStats.reduce((sum, h) => sum + h.active_doctors_count, 0);
  // ✅ AGORA: Contagem única de médicos
  const totalActiveDoctors = uniqueDoctors.filter(d => d.activity_status === 'ATIVO').length;
  const totalUniqueDoctors = uniqueDoctors.length;
  const doctorsWithMultipleHospitals = uniqueDoctors.filter(d => d.hospitals_count > 1).length;
  
  const totalRevenue = hospitalStats.reduce((sum, h) => sum + h.total_hospital_revenue_reais, 0);
  const avgRevenuePerHospital = totalHospitals > 0 ? totalRevenue / totalHospitals : 0;

  // ... resto do código de loading e error

  return (
    <div className="space-y-6">
      {/* Cabeçalho atualizado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Dashboard de Hospitais
          </h2>
          <p className="text-gray-600">
            {totalHospitals} hospitais • {totalUniqueDoctors} médicos únicos • {doctorsWithMultipleHospitals} em múltiplos hospitais
          </p>
        </div>
        <Button onClick={loadHospitalStats} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* ✅ KPIs Corrigidos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total de Hospitais</p>
                <p className="text-2xl font-bold text-gray-900">{totalHospitals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Médicos Únicos</p>
                <p className="text-2xl font-bold text-gray-900">{totalUniqueDoctors}</p>
                <p className="text-xs text-gray-500">
                  {totalActiveDoctors} ativos • {doctorsWithMultipleHospitals} em múltiplos hospitais
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-emerald-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Faturamento Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Média por Hospital</p>
                <p className="text-2xl font-bold text-gray-900">
                  R$ {avgRevenuePerHospital.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Hospitais com médicos individuais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Building2 className="w-5 h-5 mr-2" />
            Hospitais Cadastrados ({hospitalStats.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hospitalStats.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Nenhum hospital encontrado</p>
            </div>
          ) : (
            <div className="space-y-6">
              {hospitalStats.map((hospital, index) => (
                <HospitalCard 
                  key={hospital.hospital_id || index} 
                  hospital={hospital} 
                  uniqueDoctors={uniqueDoctors}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
```

### **2. 🏥 Componente Individual do Hospital**

```typescript
// Novo componente HospitalCard com lista de médicos
interface HospitalCardProps {
  hospital: HospitalStats;
  uniqueDoctors: DoctorAggregated[];
}

const HospitalCard: React.FC<HospitalCardProps> = ({ hospital, uniqueDoctors }) => {
  const [showDoctors, setShowDoctors] = useState(false);
  
  // Filtrar médicos deste hospital
  const hospitalDoctors = uniqueDoctors.filter(doctor => 
    doctor.hospital_ids.split(',').includes(hospital.hospital_id)
  );

  const activeDoctors = hospitalDoctors.filter(d => d.activity_status === 'ATIVO');
  const doctorsWithMultipleHospitals = hospitalDoctors.filter(d => d.hospitals_count > 1);

  return (
    <div className="p-6 border rounded-lg hover:bg-gray-50 transition-colors">
      {/* Header do Hospital */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-1">
            {hospital.hospital_name || 'Nome não informado'}
          </h4>
          <p className="text-sm text-gray-500">
            CNPJ: {hospital.hospital_cnpj || 'N/A'} • ID: {hospital.hospital_id}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={hospitalDoctors.length > 10 ? "default" : "secondary"}>
            {hospitalDoctors.length} médicos
          </Badge>
          <Badge variant={activeDoctors.length > 5 ? "default" : "outline"}>
            {activeDoctors.length} ativos
          </Badge>
          {doctorsWithMultipleHospitals.length > 0 && (
            <Badge variant="outline" className="text-orange-600">
              {doctorsWithMultipleHospitals.length} em múltiplos hospitais
            </Badge>
          )}
        </div>
      </div>

      {/* Métricas do Hospital */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="flex items-center">
            <Users className="w-4 h-4 text-blue-600 mr-2" />
            <span className="text-xs text-blue-600 font-medium">Médicos</span>
          </div>
          <p className="text-lg font-bold text-blue-900 mt-1">
            {hospitalDoctors.length}
          </p>
          <p className="text-xs text-blue-600">
            {activeDoctors.length} ativos
          </p>
        </div>

        <div className="bg-green-50 p-3 rounded-lg">
          <div className="flex items-center">
            <DollarSign className="w-4 h-4 text-green-600 mr-2" />
            <span className="text-xs text-green-600 font-medium">Faturamento</span>
          </div>
          <p className="text-lg font-bold text-green-900 mt-1">
            R$ {(hospital.total_hospital_revenue_reais || 0).toLocaleString('pt-BR', { 
              minimumFractionDigits: 0,
              maximumFractionDigits: 0 
            })}
          </p>
          <p className="text-xs text-green-600">12 meses</p>
        </div>

        <div className="bg-purple-50 p-3 rounded-lg">
          <div className="flex items-center">
            <BarChart3 className="w-4 h-4 text-purple-600 mr-2" />
            <span className="text-xs text-purple-600 font-medium">Procedimentos</span>
          </div>
          <p className="text-lg font-bold text-purple-900 mt-1">
            {(hospital.total_procedures || 0).toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-purple-600">
            {(hospital.avg_procedures_per_doctor || 0).toFixed(0)} por médico
          </p>
        </div>

        <div className="bg-orange-50 p-3 rounded-lg">
          <div className="flex items-center">
            <Activity className="w-4 h-4 text-orange-600 mr-2" />
            <span className="text-xs text-orange-600 font-medium">Taxa Pagamento</span>
          </div>
          <p className="text-lg font-bold text-orange-900 mt-1">
            {(hospital.avg_payment_rate || 0).toFixed(1)}%
          </p>
          <p className="text-xs text-orange-600">aprovação</p>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center">
            <TrendingUp className="w-4 h-4 text-gray-600 mr-2" />
            <span className="text-xs text-gray-600 font-medium">Especialidade</span>
          </div>
          <p className="text-sm font-bold text-gray-900 mt-1">
            {hospital.top_specialty_by_revenue || 'N/A'}
          </p>
          <p className="text-xs text-gray-600">top faturamento</p>
        </div>
      </div>

      {/* Botão para mostrar médicos */}
      <div className="pt-4 border-t border-gray-200">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowDoctors(!showDoctors)}
          className="w-full"
        >
          {showDoctors ? (
            <>
              <ChevronUp className="w-4 h-4 mr-2" />
              Ocultar Médicos
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-2" />
              Ver Médicos ({hospitalDoctors.length})
            </>
          )}
        </Button>
      </div>

      {/* ✅ Lista de Médicos (NEW) */}
      {showDoctors && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h5 className="font-semibold mb-3 flex items-center">
            <Stethoscope className="w-4 h-4 mr-2" />
            Médicos desta unidade ({hospitalDoctors.length})
          </h5>
          
          {hospitalDoctors.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhum médico cadastrado neste hospital.</p>
          ) : (
            <div className="space-y-2">
              {hospitalDoctors.map(doctor => (
                <div key={doctor.doctor_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-900">{doctor.doctor_name}</span>
                      {doctor.hospitals_count > 1 && (
                        <Badge variant="outline" className="ml-2 text-xs text-orange-600">
                          {doctor.hospitals_count} hospitais
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      <span>CRM: {doctor.doctor_crm}</span>
                      <span className="ml-4">CNS: {doctor.doctor_cns}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span>{doctor.doctor_specialty || 'Especialidade não informada'}</span>
                      {doctor.hospitals_count > 1 && (
                        <span className="ml-4 text-orange-600">
                          Atende: {doctor.hospitals_list}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={doctor.activity_status === 'ATIVO' ? 'default' : 'secondary'}>
                      {doctor.activity_status}
                    </Badge>
                    <div className="text-right text-sm">
                      <div className="font-medium text-gray-900">
                        R$ {doctor.total_revenue_12months_reais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-gray-500">
                        {doctor.total_procedures_12months} procedimentos
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HospitalRevenueDashboard;
```

### **3. 🔄 Função no Serviço para Filtrar por Hospital**

```typescript
// src/services/doctorsRevenueService.ts - ADICIONAR NOVA FUNÇÃO

/**
 * 🏥 OBTER MÉDICOS DE UM HOSPITAL ESPECÍFICO
 */
static async getDoctorsByHospital(hospitalId: string) {
  try {
    const result = await this.getDoctorsAggregated();
    
    // Filtrar médicos que atendem este hospital
    const hospitalDoctors = result.doctors.filter(doctor => 
      doctor.hospital_ids.split(',').includes(hospitalId)
    );

    return {
      doctors: hospitalDoctors,
      totalCount: hospitalDoctors.length,
      activeCount: hospitalDoctors.filter(d => d.activity_status === 'ATIVO').length,
      multipleHospitalsCount: hospitalDoctors.filter(d => d.hospitals_count > 1).length
    };
  } catch (error) {
    console.error('💥 Erro no getDoctorsByHospital:', error);
    throw error;
  }
}
```

### **4. 📊 Resultado Final**

Com essas implementações, a tela ficará assim:

```
🏥 Dashboard de Hospitais
📊 3 hospitais • 45 médicos únicos • 18 em múltiplos hospitais

┌─────────────────────────────────────────────────────────────────┐
│ Total Hospitais: 3    │ Médicos Únicos: 45   │ Faturamento: R$ 1.2M │
│                       │ 32 ativos • 18 mult. │                      │
└─────────────────────────────────────────────────────────────────┘

🏥 Hospital Municipal Santa Alice
   👥 12 médicos • 8 ativos • 5 em múltiplos hospitais
   💰 R$ 245.000 • 📊 1.234 procedimentos • ⚡ 92.5% aprovação

   [Ver Médicos (12) ▼]
   
   👨‍⚕️ Dr. João Silva - Cardiologia [2 hospitais]
      CRM: 12345 • CNS: 98765 • ATIVO
      Atende: Hospital Santa Alice | Hospital São João
      R$ 25.000 • 45 procedimentos

   👩‍⚕️ Dra. Maria Santos - Pediatria
      CRM: 67890 • CNS: 54321 • ATIVO  
      R$ 18.500 • 32 procedimentos

   👨‍⚕️ Dr. Pedro Costa - Cirurgia [3 hospitais]
      CRM: 11111 • CNS: 22222 • ATIVO
      Atende: Hospital Santa Alice | Hospital São João | Clínica Norte
      R$ 45.000 • 78 procedimentos
```

### **5. 🎯 Benefícios da Implementação**

✅ **Contagem correta**: Não duplica médicos no total geral
✅ **Visibilidade individual**: Mostra cada médico de cada hospital
✅ **Múltiplos hospitais**: Indica claramente médicos que atendem múltiplos locais
✅ **Métricas precisas**: Faturamento e estatísticas corretas
✅ **Interface intuitiva**: Expandir/recolher lista de médicos por hospital
✅ **Drill-down**: Permite ver detalhes de cada médico

### **6. 🚀 Prioridade de Implementação**

1. **ALTA**: Corrigir contagem total de médicos (evita relatórios incorretos)
2. **MÉDIA**: Adicionar lista de médicos por hospital (melhora usabilidade)
3. **BAIXA**: Indicadores visuais e drill-down (melhorias de UX)

Esta implementação resolve todos os problemas identificados mantendo a performance e usabilidade do sistema. 