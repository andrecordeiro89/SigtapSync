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
  compact?: boolean;
  defaultPreset?: string;
}

const ExecutiveDateFilters: React.FC<ExecutiveDateFiltersProps> = ({
  onDateRangeChange,
  onRefresh,
  onExport,
  isLoading = false,
  showExport = true,
  title = "Filtros Executivos",
  subtitle = "Selecione o período para análise",
  compact = false,
  defaultPreset = 'custom'
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>(defaultPreset);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  // "custom" é derivado do preset selecionado; evitamos race conditions

  // Presets de período
  const presets = [
    { value: 'lastMonth', label: 'Último mês', icon: '🗓️' },
    { value: 'last3m', label: 'Últimos 3 meses', icon: '📈' },
    { value: 'custom', label: 'Personalizado', icon: '⚙️' }
  ];

  // Função para calcular datas baseadas no preset
  const getDateRangeFromPreset = (preset: string): DateRange => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (preset) {
      case 'lastMonth': {
        const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        // incluir todo o último dia do mês anterior
        lastDayPrevMonth.setHours(23, 59, 59, 999);
        startDate = firstDayPrevMonth;
        endDate = lastDayPrevMonth;
        break;
      }
      case 'last3m': {
        // Três meses completos anteriores ao mês atual
        const firstDayThreeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        lastDayPrevMonth.setHours(23, 59, 59, 999);
        startDate = firstDayThreeMonthsAgo;
        endDate = lastDayPrevMonth;
        break;
      }
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

    return { startDate, endDate };
  };

  // Utilitário para exibir/editar datas sempre visíveis
  const getInputDates = (): { start: string; end: string; disabled: boolean } => {
    const isCustom = selectedPreset === 'custom';
    if (isCustom) {
      return {
        start: customStartDate || '',
        end: customEndDate || '',
        disabled: false,
      };
    }
    const range = getDateRangeFromPreset(selectedPreset);
    return {
      start: formatDateForInput(range.startDate),
      end: formatDateForInput(range.endDate),
      disabled: true,
    };
  };

  // Função para aplicar filtros (sem depender de estado derivado)
  const applyFilters = () => {
    const isCustom = selectedPreset === 'custom';
    if (isCustom) {
      if (customStartDate && customEndDate) {
        onDateRangeChange({
          startDate: new Date(customStartDate),
          endDate: new Date(customEndDate)
        });
      }
      return;
    }
    const range = getDateRangeFromPreset(selectedPreset);
    onDateRangeChange(range);
  };

  // Aplicar filtros quando preset ou datas mudam
  useEffect(() => {
    // Pré-preencher datas personalizadas com "Último mês" caso vazias
    if (selectedPreset === 'custom' && (!customStartDate || !customEndDate)) {
      const lm = getDateRangeFromPreset('lastMonth');
      setCustomStartDate(formatDateForInput(lm.startDate));
      setCustomEndDate(formatDateForInput(lm.endDate));
      // Após preencher, não retorna; o próximo efeito de dependência acionará apply
    } else {
      applyFilters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPreset, customStartDate, customEndDate]);

  // Removido efeito separado para datas; consolidado acima

  // Inicializar com período padrão
  useEffect(() => {
    // Iniciar do primeiro dia do mês atual até hoje
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    setSelectedPreset('custom');
    setCustomStartDate(formatDateForInput(startOfMonth));
    setCustomEndDate(formatDateForInput(now));
    onDateRangeChange({ startDate: startOfMonth, endDate: now });
  }, []);

  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const getCurrentPeriodText = (isCompactMode: boolean = false): string => {
    const selectedPresetData = presets.find(p => p.value === selectedPreset);
    
    if (selectedPresetData && selectedPresetData.value !== 'custom') {
      // Para presets, mostrar label + datas específicas
      const range = getDateRangeFromPreset(selectedPreset);
      const start = range.startDate.toLocaleDateString('pt-BR');
      const end = range.endDate.toLocaleDateString('pt-BR');
      
      if (isCompactMode) {
        // Versão compacta: só as datas
        return `${start} - ${end}`;
      } else {
        // Versão completa: label + datas
        return `${selectedPresetData.label} (${start} - ${end})`;
      }
    }
    
    if (selectedPreset === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate).toLocaleDateString('pt-BR');
      const end = new Date(customEndDate).toLocaleDateString('pt-BR');
      
      if (isCompactMode) {
        return `${start} - ${end}`;
      } else {
        return `Personalizado (${start} - ${end})`;
      }
    }
    
    return 'Período não selecionado';
  };

  // Versão compacta
  if (compact) {
    const inputDates = getInputDates();
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Período</span>
            {/* Indicador do preset selecionado */}
            {selectedPreset !== 'custom' && (
              <span className="text-xs text-gray-500">
                ({presets.find(p => p.value === selectedPreset)?.label})
              </span>
            )}
          </div>
          <Badge variant="outline" className="bg-blue-100 text-blue-700 text-xs font-mono">
            {getCurrentPeriodText(true)}
          </Badge>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          {presets.map((preset) => (
            <Button
              key={preset.value}
              variant={selectedPreset === preset.value ? "default" : "outline"}
              size="sm"
              className={`text-xs px-2 py-1 h-8 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${
                selectedPreset === preset.value 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'bg-white hover:bg-blue-50 hover:border-blue-300'
              }`}
              onClick={() => setSelectedPreset(preset.value)}
            >
              <span className="mr-1">{preset.icon}</span>
              <span>{preset.label}</span>
            </Button>
          ))}
        </div>

        {/* Datepickers sempre visíveis (desabilitados quando preset ≠ custom) */}
        <div className="grid grid-cols-2 gap-2 p-2 bg-gray-50 rounded">
          <Input
            type="date"
            value={inputDates.start}
            onChange={(e) => setCustomStartDate(e.target.value)}
            className="text-xs h-8"
            placeholder="Data inicial"
            disabled={inputDates.disabled}
            title={inputDates.disabled ? "Selecione 'Personalizado' para editar" : ''}
          />
          <Input
            type="date"
            value={inputDates.end}
            onChange={(e) => setCustomEndDate(e.target.value)}
            className="text-xs h-8"
            max={formatDateForInput(new Date())}
            placeholder="Data final"
            disabled={inputDates.disabled}
            title={inputDates.disabled ? "Selecione 'Personalizado' para editar" : ''}
          />
        </div>
      </div>
    );
  }

  // Versão completa
  return (
    <Card className="border border-blue-100 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-blue-600" />
            <span className="text-blue-800">{title}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-blue-100 text-blue-700">
              <Clock className="h-3 w-3 mr-1" />
              {getCurrentPeriodText(false)}
            </Badge>
          </div>
        </CardTitle>
        {subtitle && (
          <p className="text-sm text-blue-600 mt-1">{subtitle}</p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Seletor de Período */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Período de Análise</label>
          <div className="grid grid-cols-3 md:grid-cols-3 gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.value}
                variant={selectedPreset === preset.value ? "default" : "outline"}
                className={`text-xs px-3 py-2 h-10 flex-row items-center justify-center gap-1 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.05)] ${
                  selectedPreset === preset.value 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'bg-white hover:bg-blue-50 hover:border-blue-300'
                }`}
                onClick={() => setSelectedPreset(preset.value)}
              >
                <span className="text-sm">{preset.icon}</span>
                <span className="font-medium">{preset.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Datepickers sempre visíveis (desabilitados quando preset ≠ custom) */}
        {(() => {
          const inputDates = getInputDates();
          return (
            <div className="space-y-2 p-3 bg-white rounded-lg border border-gray-200">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Período Selecionado</span>
                {inputDates.disabled && (
                  <span className="text-xs text-gray-500">(edite em "Personalizado")</span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Data Inicial
                  </label>
                  <Input
                    type="date"
                    value={inputDates.start}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full h-9 text-sm"
                    disabled={inputDates.disabled}
                    title={inputDates.disabled ? "Selecione 'Personalizado' para editar" : ''}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Data Final
                  </label>
                  <Input
                    type="date"
                    value={inputDates.end}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full h-9 text-sm"
                    max={formatDateForInput(new Date())}
                    disabled={inputDates.disabled}
                    title={inputDates.disabled ? "Selecione 'Personalizado' para editar" : ''}
                  />
                </div>
              </div>
            </div>
          );
        })()}

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