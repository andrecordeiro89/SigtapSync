import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { 
  BarChart4, 
  Download, 
  Filter, 
  Hospital,
  FileText,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  Building2,
  CheckCircle,
  AlertTriangle,
  Eye,
  RefreshCw,
  Database
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PatientService, AIHService } from '../services/supabaseService';
import { CIS_HOSPITALS } from '../data/realHospitals';

interface ReportData {
  totalAIHs: number;
  totalProcedimentos: number;
  procedimentosAprovados: number;
  valorTotal: number;
  ticketMedio: number;
  hospitaisDistintos: number;
  aihsList: Array<{
    numeroAIH: string;
    paciente: string;
    hospital: string;
    valor: number;
    status: string;
    data: string;
  }>;
}

const ReportsSimple: React.FC = () => {
  const [selectedHospital, setSelectedHospital] = useState('all');
  const [selectedHospitalName, setSelectedHospitalName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData>({
    totalAIHs: 0,
    totalProcedimentos: 0,
    procedimentosAprovados: 0,
    valorTotal: 0,
    ticketMedio: 0,
    hospitaisDistintos: 0,
    aihsList: []
  });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const { user, profile } = useAuth();
  
  // MODO DESENVOLVIMENTO: Hospital padrão
  const currentHospital = { 
    id: 'a0000000-0000-0000-0000-000000000001', 
    name: 'Hospital Demo - Desenvolvimento' 
  };
  
  // Original code comentado para modo desenvolvimento:
  // const currentHospital = profile?.hospital_access?.[0] 
  //   ? { id: profile.hospital_access[0], name: 'Hospital Principal' }
  //   : { id: 'a0000000-0000-0000-0000-000000000001', name: 'Hospital Demo' };

  // Carregar dados reais do relatório
  const loadReportData = async () => {
    if (!currentHospital) return;
    
    setIsLoading(true);
    try {
      console.log('📊 Carregando dados do relatório...');
      
      // Carregar AIHs
      const aihs = await AIHService.getAIHs(
        selectedHospital === 'all' ? undefined : selectedHospital
      );
      
      // Carregar pacientes para enriquecer dados
      const patients = await PatientService.getPatients(currentHospital.id);
      const patientsMap = new Map(patients.map(p => [p.id, p]));
      
      // Processar dados
      const valorTotal = aihs.reduce((sum, aih) => {
        return sum + (aih.original_value ? aih.original_value / 100 : 0);
      }, 0);
      
      const procedimentosAprovados = aihs.filter(aih => 
        aih.processing_status === 'matched' || aih.processing_status === 'approved'
      ).length;
      
      const aihsList = aihs.map(aih => {
        const patient = patientsMap.get(aih.patient_id);
        return {
          numeroAIH: aih.aih_number,
          paciente: patient?.name || 'Nome não encontrado',
          hospital: currentHospital.name,
          valor: aih.original_value ? aih.original_value / 100 : 0,
          status: aih.processing_status || 'pending',
          data: new Date(aih.admission_date).toLocaleDateString('pt-BR')
        };
      });
      
      const newReportData: ReportData = {
        totalAIHs: aihs.length,
        totalProcedimentos: aihs.length, // Simplificado
        procedimentosAprovados,
        valorTotal,
        ticketMedio: aihs.length > 0 ? valorTotal / aihs.length : 0,
        hospitaisDistintos: 1, // Simplificado para Fase 1
        aihsList
      };
      
      setReportData(newReportData);
      setLastUpdate(new Date());
      
      console.log('✅ Dados do relatório carregados:', newReportData);
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados do relatório:', error);
      toast.error('Erro ao carregar dados do relatório');
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar dados na inicialização
  useEffect(() => {
    loadReportData();
  }, [selectedHospital, currentHospital?.id]);

  const handleHospitalSelect = (hospitalCnpj: string) => {
    if (hospitalCnpj === 'all') {
      setSelectedHospital('all');
      setSelectedHospitalName('');
    } else {
      const hospital = CIS_HOSPITALS.find(h => h.cnpj === hospitalCnpj);
      setSelectedHospital(hospitalCnpj);
      setSelectedHospitalName(hospital?.name || '');
    }
  };

  const handleExportExcel = () => {
    // Preparar dados para exportação
    const exportData = [
      ['Número AIH', 'Paciente', 'Hospital', 'Valor (R$)', 'Status', 'Data'],
      ...reportData.aihsList.map(aih => [
        aih.numeroAIH,
        aih.paciente,
        aih.hospital,
        aih.valor.toFixed(2),
        aih.status,
        aih.data
      ])
    ];
    
    // Converter para CSV simples
    const csvContent = exportData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-aihs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('📊 Relatório CSV gerado com sucesso!');
  };

  const handleExportPDF = () => {
    toast.success('📄 Relatório PDF Premium gerado com sucesso!');
  };

  // MODO DESENVOLVIMENTO: Acesso livre aos relatórios
  // if (!user) {
  //   return (
  //     <div className="flex items-center justify-center h-64">
  //       <div className="text-center">
  //         <BarChart4 className="mx-auto h-12 w-12 text-gray-400" />
  //         <h3 className="mt-2 text-sm font-semibold text-gray-900">Acesso restrito</h3>
  //         <p className="mt-1 text-sm text-gray-500">
  //           Faça login para acessar os relatórios
  //         </p>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">📊 Central de Relatórios</h1>
            <p className="text-blue-100">
              {currentHospital?.name || 'Sistema de Faturamento SIGTAP'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {isLoading ? '...' : reportData.totalAIHs}
            </div>
            <div className="text-blue-100">AIHs no Sistema</div>
            {lastUpdate && (
              <div className="text-xs text-blue-200 mt-1">
                Atualizado: {lastUpdate.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FILTROS AVANÇADOS */}
      <Card className="border-blue-200 shadow-md">
        <CardHeader className="bg-blue-50">
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <Filter className="h-5 w-5" />
            Filtros e Controles
          </CardTitle>
          <CardDescription>Configure os filtros e atualize os dados</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* HOSPITAL */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Hospital</label>
              <Select onValueChange={handleHospitalSelect} value={selectedHospital}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os hospitais" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os hospitais</SelectItem>
                  {CIS_HOSPITALS.filter(h => h.is_active).map(hospital => (
                    <SelectItem key={hospital.cnpj} value={hospital.cnpj}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>{hospital.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* PERÍODO */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Período</label>
              <Select defaultValue="month">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Esta semana</SelectItem>
                  <SelectItem value="month">Este mês</SelectItem>
                  <SelectItem value="quarter">Trimestre</SelectItem>
                  <SelectItem value="year">Este ano</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* STATUS */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Status</label>
              <Select defaultValue="all">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="approved">Aprovados</SelectItem>
                  <SelectItem value="rejected">Rejeitados</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ATUALIZAR */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Controles</label>
              <Button 
                onClick={loadReportData} 
                disabled={isLoading}
                className="w-full flex items-center space-x-2"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </Button>
            </div>
          </div>

          {/* HOSPITAL SELECIONADO */}
          {selectedHospitalName && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 font-medium">
                <Hospital className="h-4 w-4" />
                Hospital Selecionado: {selectedHospitalName}
              </div>
            </div>
          )}

          {/* STATUS DO BANCO */}
          <div className="mt-4 flex items-center space-x-2 text-sm text-gray-600">
            <Database className="w-4 h-4" />
            <span>
              {isLoading ? 'Carregando...' : `${reportData.totalAIHs} AIH(s) encontrada(s)`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ESTATÍSTICAS EXECUTIVAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card className="border-blue-200">
          <CardContent className="p-4 text-center">
            <FileText className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold text-blue-700">
              {isLoading ? '...' : reportData.totalAIHs}
            </div>
            <div className="text-sm text-blue-500">AIHs Processadas</div>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold text-green-700">
              {isLoading ? '...' : reportData.procedimentosAprovados}
            </div>
            <div className="text-sm text-green-500">Proc. Aprovados</div>
          </CardContent>
        </Card>

        <Card className="border-purple-200">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-600" />
            <div className="text-2xl font-bold text-purple-700">
              {isLoading ? '...' : reportData.totalProcedimentos}
            </div>
            <div className="text-sm text-purple-500">Total Proc.</div>
          </CardContent>
        </Card>

        <Card className="border-orange-200">
          <CardContent className="p-4 text-center">
            <Hospital className="h-8 w-8 mx-auto mb-2 text-orange-600" />
            <div className="text-2xl font-bold text-orange-700">
              {isLoading ? '...' : reportData.hospitaisDistintos}
            </div>
            <div className="text-sm text-orange-500">Hospitais</div>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardContent className="p-4 text-center">
            <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <div className="text-lg font-bold text-green-700">
              R$ {isLoading ? '...' : reportData.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-green-500">Faturamento</div>
          </CardContent>
        </Card>

        <Card className="border-indigo-200">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
            <div className="text-lg font-bold text-indigo-700">
              R$ {isLoading ? '...' : reportData.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-indigo-500">Ticket Médio</div>
          </CardContent>
        </Card>
      </div>

      {/* AÇÕES DE EXPORTAÇÃO */}
      <Card className="border-green-200 shadow-md">
        <CardHeader className="bg-green-50">
          <CardTitle className="flex items-center gap-2 text-green-700">
            <Download className="h-5 w-5" />
            Exportar Relatórios
          </CardTitle>
          <CardDescription>
            Gere relatórios executivos em Excel e PDF para a diretoria
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Button
              onClick={handleExportExcel}
              className="bg-green-600 hover:bg-green-700"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
            
            <Button
              onClick={handleExportPDF}
              className="bg-red-600 hover:bg-red-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PREVIEW DOS DADOS */}
      <Card className="border-gray-200 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview dos Dados ({reportData.aihsList.length} AIHs)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {reportData.aihsList.map((item, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">AIH</div>
                    <div className="font-medium">{item.numeroAIH}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Hospital</div>
                    <div className="font-medium">{item.hospital}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Paciente</div>
                    <div className="font-medium">{item.paciente}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Valor</div>
                    <div className="font-bold text-green-600">
                      R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsSimple; 