import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Calendar, RefreshCw, Download, Filter, Clock, TrendingUp } from 'lucide-react';
import { DateRange } from '../types';

interface ExecutiveDateFiltersProps {
  onDateRangeChange: (range: DateRange) => void;
  onRefresh: () => void;
  onExport?: () => void;
  isLoading?: boolean;
  showExport?: boolean;
  title?: string;
  subtitle?: string;
}

const ExecutiveDateFilters: React.FC<ExecutiveDateFiltersProps> = ({
  onDateRangeChange,
  onRefresh,
  onExport,
  isLoading = false,
  showExport = true,
  title = "Filtros Executivos",
  subtitle = "Selecione o período para análise"
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('30d');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isCustomRange, setIsCustomRange] = useState(false);

  // Presets de período
  const presets = [
    { value: '7d', label: '7 dias', icon: '📅' },
    { value: '30d', label: '30 dias', icon: '📊' },
    { value: '3m', label: '3 meses', icon: '📈' },
    { value: '6m', label: '6 meses', icon: '🎯' },
    { value: '1y', label: '1 ano', icon: '💎' },
    { value: 'custom', label: 'Personalizado', icon: '⚙️' }
  ];

  // Função para calcular datas baseadas no preset
  const getDateRangeFromPreset = (preset: string): DateRange => {
    const now = new Date();
    let startDate: Date;

    switch (preset) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3m':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case '6m':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      case '1y':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate: now };
  };

  // Função para aplicar filtros
  const applyFilters = () => {
    if (isCustomRange && customStartDate && customEndDate) {
      const range: DateRange = {
        startDate: new Date(customStartDate),
        endDate: new Date(customEndDate)
      };
      onDateRangeChange(range);
    } else {
      const range = getDateRangeFromPreset(selectedPreset);
      onDateRangeChange(range);
    }
  };

  // Aplicar filtros quando preset muda
  useEffect(() => {
    if (selectedPreset !== 'custom') {
      setIsCustomRange(false);
      applyFilters();
    } else {
      setIsCustomRange(true);
    }
  }, [selectedPreset]);

  // Aplicar filtros quando datas customizadas mudam
  useEffect(() => {
    if (isCustomRange && customStartDate && customEndDate) {
      applyFilters();
    }
  }, [customStartDate, customEndDate]);

  // Inicializar com período padrão
  useEffect(() => {
    applyFilters();
  }, []);

  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const getCurrentPeriodText = (): string => {
    const selectedPresetData = presets.find(p => p.value === selectedPreset);
    if (selectedPresetData && selectedPresetData.value !== 'custom') {
      return selectedPresetData.label;
    }
    
    if (isCustomRange && customStartDate && customEndDate) {
      const start = new Date(customStartDate).toLocaleDateString('pt-BR');
      const end = new Date(customEndDate).toLocaleDateString('pt-BR');
      return `${start} - ${end}`;
    }
    
    return 'Período não selecionado';
  };

  return (
    <Card className="border-2 border-blue-100 bg-gradient-to-r from-blue-50 to-purple-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-blue-600" />
            <span className="text-blue-800">{title}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-blue-100 text-blue-700">
              <Clock className="h-3 w-3 mr-1" />
              {getCurrentPeriodText()}
            </Badge>
          </div>
        </CardTitle>
        {subtitle && (
          <p className="text-sm text-blue-600 mt-1">{subtitle}</p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Seletor de Período */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Período de Análise</label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.value}
                variant={selectedPreset === preset.value ? "default" : "outline"}
                className={`text-xs px-3 py-2 h-auto flex-col space-y-1 ${
                  selectedPreset === preset.value 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'hover:bg-blue-50 hover:border-blue-300'
                }`}
                onClick={() => setSelectedPreset(preset.value)}
              >
                <span className="text-lg">{preset.icon}</span>
                <span>{preset.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Datas Personalizadas */}
        {isCustomRange && (
          <div className="space-y-3 p-4 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Período Personalizado</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Data Inicial
                </label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Data Final
                </label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full"
                  max={formatDateForInput(new Date())}
                />
              </div>
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center space-x-1"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </Button>
            
            {showExport && onExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExport}
                disabled={isLoading}
                className="flex items-center space-x-1"
              >
                <Download className="h-4 w-4" />
                <span>Exportar</span>
              </Button>
            )}
          </div>

          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <TrendingUp className="h-4 w-4" />
            <span>Dados atualizados em tempo real</span>
          </div>
        </div>

        {/* Indicadores de Status */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-gray-600">Sistema Online</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-xs text-gray-600">Dados Sincronizados</span>
            </div>
          </div>
          
          <div className="text-xs text-gray-500">
            Última atualização: {new Date().toLocaleTimeString('pt-BR')}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExecutiveDateFilters; 