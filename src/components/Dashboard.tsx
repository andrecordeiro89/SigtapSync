
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, DollarSign, AlertCircle } from 'lucide-react';
import { mockDashboardStats } from '../data/mockData';
import { formatCurrency } from '../utils/validation';

const Dashboard = () => {
  const stats = mockDashboardStats;

  const statCards = [
    {
      title: 'Total de Pacientes',
      value: stats.totalPatients,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Procedimentos Realizados',
      value: stats.totalProcedures,
      icon: FileText,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Faturamento Mensal',
      value: formatCurrency(stats.monthlyRevenue),
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    },
    {
      title: 'Pendentes de Faturamento',
      value: stats.pendingBilling,
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-1">Visão geral do sistema de faturamento</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Tabela SIGTAP atualizada</p>
                  <p className="text-xs text-gray-500">Há 2 horas</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">5 novos pacientes cadastrados</p>
                  <p className="text-xs text-gray-500">Hoje</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Relatório mensal gerado</p>
                  <p className="text-xs text-gray-500">Ontem</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Procedimentos Mais Realizados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Consulta Médica Básica</span>
                <span className="text-sm font-medium">342</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Eletrocardiograma</span>
                <span className="text-sm font-medium">156</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Radiografia Tórax</span>
                <span className="text-sm font-medium">89</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Consulta Especializada</span>
                <span className="text-sm font-medium">67</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
