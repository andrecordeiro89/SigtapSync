
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, User, Phone, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { mockPatients } from '../data/mockData';
import { validateCNS, formatCNS, formatDate } from '../utils/validation';
import { Patient } from '../types';

const PatientManagement = () => {
  const [patients, setPatients] = useState(mockPatients);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    cns: '',
    birthDate: '',
    gender: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: ''
  });
  const { toast } = useToast();

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.cns.includes(searchTerm.replace(/\D/g, ''))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateCNS(formData.cns)) {
      toast({
        title: "CNS Inválido",
        description: "Por favor, verifique o número do Cartão Nacional de Saúde.",
        variant: "destructive"
      });
      return;
    }

    const newPatient: Patient = {
      id: Date.now().toString(),
      ...formData,
      gender: formData.gender as 'M' | 'F',
      createdAt: new Date().toISOString()
    };

    setPatients([newPatient, ...patients]);
    setFormData({
      name: '',
      cns: '',
      birthDate: '',
      gender: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      phone: ''
    });
    setShowForm(false);

    toast({
      title: "Paciente cadastrado",
      description: `${newPatient.name} foi cadastrado com sucesso.`,
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'cns' ? value.replace(/\D/g, '') : value
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gerenciamento de Pacientes</h2>
          <p className="text-gray-600 mt-1">Cadastre e gerencie os dados dos pacientes</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Novo Paciente</span>
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Cadastrar Novo Paciente</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo*</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cns">Cartão Nacional de Saúde (CNS)*</Label>
                  <Input
                    id="cns"
                    value={formatCNS(formData.cns)}
                    onChange={(e) => handleInputChange('cns', e.target.value)}
                    placeholder="000 0000 0000 0000"
                    maxLength={18}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Data de Nascimento*</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => handleInputChange('birthDate', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Sexo*</Label>
                  <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o sexo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">CEP</Label>
                  <Input
                    id="zipCode"
                    value={formData.zipCode}
                    onChange={(e) => handleInputChange('zipCode', e.target.value)}
                    placeholder="00000-000"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Endereço Completo*</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade*</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado*</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    placeholder="SP"
                    maxLength={2}
                    required
                  />
                </div>
              </div>
              <div className="flex space-x-2">
                <Button type="submit">Cadastrar Paciente</Button>
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
            <span>Pacientes Cadastrados</span>
            <Badge variant="secondary">{patients.length} pacientes</Badge>
          </CardTitle>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <Input
              placeholder="Buscar por nome ou CNS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredPatients.map((patient) => (
              <div key={patient.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{patient.name}</h3>
                      <div className="text-sm text-gray-600 space-y-1 mt-1">
                        <p className="flex items-center space-x-1">
                          <span className="font-medium">CNS:</span>
                          <span>{formatCNS(patient.cns)}</span>
                        </p>
                        <p>
                          <span className="font-medium">Nascimento:</span> {formatDate(patient.birthDate)} 
                          <span className="ml-2 font-medium">Sexo:</span> {patient.gender === 'M' ? 'Masculino' : 'Feminino'}
                        </p>
                        {patient.phone && (
                          <p className="flex items-center space-x-1">
                            <Phone className="w-3 h-3" />
                            <span>{patient.phone}</span>
                          </p>
                        )}
                        <p className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3" />
                          <span>{patient.address}, {patient.city}/{patient.state}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Cadastrado em {formatDate(patient.createdAt)}
                  </div>
                </div>
              </div>
            ))}
            
            {filteredPatients.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'Nenhum paciente encontrado com os termos pesquisados.' : 'Nenhum paciente cadastrado ainda.'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PatientManagement;
