
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, FileText, Calendar, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { mockPatients, mockSigtapProcedures, mockProcedureRecords } from '../data/mockData';
import { formatCurrency, formatDate } from '../utils/validation';
import { ProcedureRecord } from '../types';

const ProcedureRecords = () => {
  const [records, setRecords] = useState(mockProcedureRecords);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [procedureSearch, setProcedureSearch] = useState('');
  const [formData, setFormData] = useState({
    patientId: '',
    procedureCode: '',
    date: '',
    professional: ''
  });
  const { toast } = useToast();

  const filteredRecords = records.filter(record => {
    const patient = mockPatients.find(p => p.id === record.patientId);
    return patient?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           record.procedureDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
           record.professional.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredProcedures = useMemo(() => {
    return mockSigtapProcedures.filter(proc =>
      proc.code.includes(procedureSearch) ||
      proc.description.toLowerCase().includes(procedureSearch.toLowerCase())
    );
  }, [procedureSearch]);

  const selectedProcedure = mockSigtapProcedures.find(p => p.code === formData.procedureCode);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProcedure) {
      toast({
        title: "Procedimento não selecionado",
        description: "Por favor, selecione um procedimento válido.",
        variant: "destructive"
      });
      return;
    }

    const newRecord: ProcedureRecord = {
      id: Date.now().toString(),
      patientId: formData.patientId,
      procedureCode: formData.procedureCode,
      procedureDescription: selectedProcedure.description,
      value: selectedProcedure.valueAmb,
      date: formData.date,
      professional: formData.professional,
      createdAt: new Date().toISOString()
    };

    setRecords([newRecord, ...records]);
    setFormData({
      patientId: '',
      procedureCode: '',
      date: '',
      professional: ''
    });
    setProcedureSearch('');
    setShowForm(false);

    const patient = mockPatients.find(p => p.id === formData.patientId);
    toast({
      title: "Procedimento registrado",
      description: `Procedimento registrado para ${patient?.name}.`,
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Registro de Procedimentos</h2>
          <p className="text-gray-600 mt-1">Registre procedimentos realizados nos pacientes</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Novo Procedimento</span>
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Registrar Novo Procedimento</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="patient">Paciente*</Label>
                  <Select value={formData.patientId} onValueChange={(value) => handleInputChange('patientId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockPatients.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.name} - CNS: {patient.cns}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Data do Procedimento*</Label>
                  <Input
                    id="date"
                    type="datetime-local"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="procedure-search">Buscar Procedimento SIGTAP*</Label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    id="procedure-search"
                    placeholder="Digite o código ou descrição do procedimento..."
                    value={procedureSearch}
                    onChange={(e) => setProcedureSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {procedureSearch && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {filteredProcedures.slice(0, 10).map((procedure) => (
                      <div
                        key={procedure.code}
                        className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                          formData.procedureCode === procedure.code ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                        onClick={() => {
                          handleInputChange('procedureCode', procedure.code);
                          setProcedureSearch(procedure.description);
                        }}
                      >
                        <div className="font-medium text-sm">{procedure.code} - {procedure.description}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Valor: {formatCurrency(procedure.valueAmb)} | {procedure.complexity} | {procedure.financing}
                        </div>
                      </div>
                    ))}
                    {filteredProcedures.length === 0 && (
                      <div className="p-3 text-center text-gray-500 text-sm">
                        Nenhum procedimento encontrado
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedProcedure && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-4">
                    <h4 className="font-medium text-blue-900 mb-2">Procedimento Selecionado</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-blue-800">Código:</span>
                        <p className="text-blue-700">{selectedProcedure.code}</p>
                      </div>
                      <div>
                        <span className="font-medium text-blue-800">Valor Ambulatorial:</span>
                        <p className="text-blue-700">{formatCurrency(selectedProcedure.valueAmb)}</p>
                      </div>
                      <div>
                        <span className="font-medium text-blue-800">Complexidade:</span>
                        <p className="text-blue-700">{selectedProcedure.complexity}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <Label htmlFor="professional">Profissional Responsável*</Label>
                <Input
                  id="professional"
                  value={formData.professional}
                  onChange={(e) => handleInputChange('professional', e.target.value)}
                  placeholder="Nome do profissional"
                  required
                />
              </div>

              <div className="flex space-x-2">
                <Button type="submit" disabled={!selectedProcedure}>
                  Registrar Procedimento
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Procedimentos Registrados</span>
            <Badge variant="secondary">{records.length} registros</Badge>
          </CardTitle>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <Input
              placeholder="Buscar por paciente, procedimento ou profissional..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredRecords.map((record) => {
              const patient = mockPatients.find(p => p.id === record.patientId);
              return (
                <div key={record.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <FileText className="w-6 h-6 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{record.procedureDescription}</h3>
                        <div className="text-sm text-gray-600 space-y-1 mt-1">
                          <p className="flex items-center space-x-1">
                            <User className="w-3 h-3" />
                            <span className="font-medium">Paciente:</span>
                            <span>{patient?.name}</span>
                          </p>
                          <p className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span className="font-medium">Data:</span>
                            <span>{formatDate(record.date)}</span>
                          </p>
                          <p>
                            <span className="font-medium">Código:</span> {record.procedureCode}
                            <span className="ml-4 font-medium">Valor:</span> {formatCurrency(record.value)}
                          </p>
                          <p>
                            <span className="font-medium">Profissional:</span> {record.professional}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      Registrado
                    </Badge>
                  </div>
                </div>
              );
            })}
            
            {filteredRecords.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'Nenhum procedimento encontrado com os termos pesquisados.' : 'Nenhum procedimento registrado ainda.'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProcedureRecords;
