import React, { useState } from 'react';
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
  Eye
} from 'lucide-react';
import { CIS_HOSPITALS } from '../data/realHospitals';

const ReportsSimple: React.FC = () => {
  const [selectedHospital, setSelectedHospital] = useState('');
  const [selectedHospitalName, setSelectedHospitalName] = useState('');

  // Dados mock para demonstração
  const mockStatistics = {
    totalAIHs: 24,
    totalProcedimentos: 85,
    procedimentosAprovados: 78,
    valorTotal: 45750.90,
    ticketMedio: 1906.29,
    hospitaisDistintos: 3
  };

  const mockAIHs = [
    { numeroAIH: '2024001001', paciente: 'João Silva Santos', hospital: 'Hospital Santa Alice', valor: 1250.80 },
    { numeroAIH: '2024001002', paciente: 'Maria Oliveira Costa', hospital: 'Hospital Faxinal', valor: 2100.50 },
    { numeroAIH: '2024001003', paciente: 'Carlos Eduardo Lima', hospital: 'Hospital CIS', valor: 875.25 }
  ];

  const handleHospitalSelect = (hospitalCnpj: string) => {
    const hospital = CIS_HOSPITALS.find(h => h.cnpj === hospitalCnpj);
    setSelectedHospital(hospitalCnpj);
    setSelectedHospitalName(hospital?.name || '');
  };

  const handleExportExcel = () => {
    toast.success('📊 Relatório Excel gerado com sucesso!');
  };

  const handleExportPDF = () => {
    toast.success('📄 Relatório PDF Premium gerado com sucesso!');
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">📊 Central de Relatórios</h1>
            <p className="text-blue-100">Análises executivas e relatórios detalhados de faturamento</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{mockStatistics.totalAIHs}</div>
            <div className="text-blue-100">AIHs no Período</div>
          </div>
        </div>
      </div>

      {/* FILTROS AVANÇADOS */}
      <Card className="border-blue-200 shadow-md">
        <CardHeader className="bg-blue-50">
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <Filter className="h-5 w-5" />
            Filtros Avançados
          </CardTitle>
          <CardDescription>Configure os filtros para gerar relatórios personalizados</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* HOSPITAL */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Hospital</label>
              <Select onValueChange={handleHospitalSelect} value={selectedHospital}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os hospitais" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os hospitais</SelectItem>
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
        </CardContent>
      </Card>

      {/* ESTATÍSTICAS EXECUTIVAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card className="border-blue-200">
          <CardContent className="p-4 text-center">
            <FileText className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold text-blue-700">{mockStatistics.totalAIHs}</div>
            <div className="text-sm text-blue-500">AIHs Processadas</div>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold text-green-700">{mockStatistics.procedimentosAprovados}</div>
            <div className="text-sm text-green-500">Proc. Aprovados</div>
          </CardContent>
        </Card>

        <Card className="border-purple-200">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-600" />
            <div className="text-2xl font-bold text-purple-700">{mockStatistics.totalProcedimentos}</div>
            <div className="text-sm text-purple-500">Total Proc.</div>
          </CardContent>
        </Card>

        <Card className="border-orange-200">
          <CardContent className="p-4 text-center">
            <Hospital className="h-8 w-8 mx-auto mb-2 text-orange-600" />
            <div className="text-2xl font-bold text-orange-700">{mockStatistics.hospitaisDistintos}</div>
            <div className="text-sm text-orange-500">Hospitais</div>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardContent className="p-4 text-center">
            <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <div className="text-lg font-bold text-green-700">
              R$ {mockStatistics.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-green-500">Faturamento</div>
          </CardContent>
        </Card>

        <Card className="border-indigo-200">
          <CardContent className="p-4 text-center">
            <BarChart4 className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
            <div className="text-lg font-bold text-indigo-700">
              R$ {mockStatistics.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
            Preview dos Dados ({mockAIHs.length} AIHs)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockAIHs.map((item, index) => (
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