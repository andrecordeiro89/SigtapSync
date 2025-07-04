import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useAuth } from '../contexts/AuthContext';
import { DoctorsCrudService, DoctorCreateData, DoctorUpdateData } from '../services/doctorsCrudService';
import { MedicalDoctor } from '../types';
import { 
  User, 
  Stethoscope, 
  MapPin, 
  Phone, 
  Mail, 
  Calendar, 
  FileText,
  Shield,
  AlertTriangle,
  Save,
  X,
  Edit3,
  UserPlus
} from 'lucide-react';

// ===== INTERFACES =====

interface DoctorEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: MedicalDoctor | null;
  mode: 'create' | 'edit';
  onSuccess: () => void;
}

// ===== ESPECIALIDADES MÉDICAS =====

const MEDICAL_SPECIALTIES = [
  'Cardiologia',
  'Neurologia',
  'Ortopedia',
  'Pediatria',
  'Ginecologia',
  'Urologia',
  'Dermatologia',
  'Oftalmologia',
  'Endocrinologia',
  'Cirurgia Geral',
  'Anestesiologia',
  'Radiologia',
  'Patologia',
  'Psiquiatria',
  'Oncologia',
  'Gastroenterologia',
  'Pneumologia',
  'Reumatologia',
  'Hematologia',
  'Infectologia',
  'Medicina Intensiva',
  'Medicina de Família',
  'Geriatria',
  'Nefrologia',
  'Proctologia',
  'Otorrinolaringologia',
  'Medicina do Trabalho',
  'Medicina Legal',
  'Medicina Nuclear',
  'Homeopatia'
].sort();

// ===== COMPONENTE PRINCIPAL =====

export const DoctorEditModal: React.FC<DoctorEditModalProps> = ({
  isOpen,
  onClose,
  doctor,
  mode,
  onSuccess
}) => {
  const { user, profile } = useAuth();
  
  // Estados do formulário
  const [formData, setFormData] = useState<DoctorCreateData>({
    name: '',
    cns: '',
    crm: '',
    specialty: '',
    sub_specialty: '',
    email: '',
    phone: '',
    birth_date: '',
    gender: undefined,
    notes: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string>('');

  // ===== CONTROLE DE PERMISSÕES =====

  const canEditCNS = profile?.role === 'developer' || profile?.role === 'ti';
  const canEditAll = ['director', 'admin', 'coordinator', 'ti', 'developer'].includes(profile?.role || '');

  // ===== EFFECTS =====

  useEffect(() => {
    if (doctor && mode === 'edit') {
      setFormData({
        name: doctor.name || '',
        cns: doctor.cns || '',
        crm: doctor.crm || '',
        specialty: doctor.speciality || '',
        sub_specialty: '',
        email: '',
        phone: '',
        birth_date: '',
        gender: undefined,
        notes: ''
      });
    } else {
      // Limpar formulário para criação
      setFormData({
        name: '',
        cns: '',
        crm: '',
        specialty: '',
        sub_specialty: '',
        email: '',
        phone: '',
        birth_date: '',
        gender: undefined,
        notes: ''
      });
    }
    
    setErrors([]);
    setSuccess('');
  }, [doctor, mode, isOpen]);

  // ===== HANDLERS =====

  const handleInputChange = (field: keyof DoctorCreateData, value: string | undefined) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Limpar erros ao alterar dados
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors([]);
    setSuccess('');

    try {
      // Validar dados
      const validation = DoctorsCrudService.validateDoctorData(formData);
      if (!validation.isValid) {
        setErrors(validation.errors);
        setIsLoading(false);
        return;
      }

      let result;

      if (mode === 'create') {
        // Criar novo médico
        result = await DoctorsCrudService.createDoctor(formData, user?.id);
      } else {
        // Atualizar médico existente
        if (!doctor) {
          setErrors(['Médico não encontrado']);
          setIsLoading(false);
          return;
        }

        const updateData: DoctorUpdateData = {
          name: formData.name,
          crm: formData.crm,
          specialty: formData.specialty,
          sub_specialty: formData.sub_specialty,
          email: formData.email,
          phone: formData.phone,
          birth_date: formData.birth_date,
          gender: formData.gender,
          notes: formData.notes
        };

        result = await DoctorsCrudService.updateDoctor(
          doctor.id,
          updateData,
          user?.id,
          canEditCNS
        );
      }

      if (result.success) {
        setSuccess(result.message || 'Operação realizada com sucesso');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setErrors([result.error || 'Erro desconhecido']);
      }

    } catch (error) {
      console.error('Erro ao salvar médico:', error);
      setErrors(['Erro inesperado ao salvar médico']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: '',
      cns: '',
      crm: '',
      specialty: '',
      sub_specialty: '',
      email: '',
      phone: '',
      birth_date: '',
      gender: undefined,
      notes: ''
    });
    setErrors([]);
    setSuccess('');
    onClose();
  };

  // ===== RENDER =====

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'create' ? (
              <>
                <UserPlus className="h-5 w-5 text-blue-600" />
                Cadastrar Novo Médico
              </>
            ) : (
              <>
                <Edit3 className="h-5 w-5 text-blue-600" />
                Editar Médico
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ===== ALERTAS ===== */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">
                {success}
              </AlertDescription>
            </Alert>
          )}

          {/* ===== PERMISSÕES ===== */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4" />
                Permissões de Edição
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant={canEditAll ? "default" : "secondary"}>
                  {canEditAll ? "✓" : "✗"} Dados Gerais
                </Badge>
                <Badge variant={canEditCNS ? "default" : "secondary"}>
                  {canEditCNS ? "✓" : "✗"} CNS (Desenvolvedor)
                </Badge>
              </div>
              {!canEditCNS && (
                <p className="text-xs text-gray-500">
                  * CNS só pode ser alterado por desenvolvedores
                </p>
              )}
            </CardContent>
          </Card>

          {/* ===== DADOS PRINCIPAIS ===== */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4" />
                Dados Principais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  disabled={!canEditAll}
                  placeholder="Ex: Dr. João Silva Santos"
                  className="w-full"
                />
              </div>

              {/* CNS */}
              <div className="space-y-2">
                <Label htmlFor="cns" className="flex items-center gap-2">
                  CNS - Cartão Nacional de Saúde *
                  {!canEditCNS && (
                    <Badge variant="secondary" className="text-xs">
                      Somente Desenvolvedor
                    </Badge>
                  )}
                </Label>
                <Input
                  id="cns"
                  value={formData.cns}
                  onChange={(e) => handleInputChange('cns', e.target.value)}
                  disabled={!canEditCNS}
                  placeholder="123456789012345"
                  maxLength={15}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  15 dígitos do Cartão Nacional de Saúde
                </p>
              </div>

              {/* CRM */}
              <div className="space-y-2">
                <Label htmlFor="crm">CRM - Conselho Regional *</Label>
                <Input
                  id="crm"
                  value={formData.crm}
                  onChange={(e) => handleInputChange('crm', e.target.value)}
                  disabled={!canEditAll}
                  placeholder="SP-123456"
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  Formato: UF-NÚMERO (ex: SP-123456)
                </p>
              </div>

              {/* Gênero */}
              <div className="space-y-2">
                <Label htmlFor="gender">Gênero</Label>
                <Select 
                  value={formData.gender} 
                  onValueChange={(value) => handleInputChange('gender', value === 'none' ? undefined : value as 'M' | 'F')}
                  disabled={!canEditAll}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o gênero" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não especificado</SelectItem>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Data de Nascimento */}
              <div className="space-y-2">
                <Label htmlFor="birth_date">Data de Nascimento</Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => handleInputChange('birth_date', e.target.value)}
                  disabled={!canEditAll}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>

          {/* ===== DADOS PROFISSIONAIS ===== */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Stethoscope className="h-4 w-4" />
                Dados Profissionais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Especialidade */}
              <div className="space-y-2">
                <Label htmlFor="specialty">Especialidade Médica *</Label>
                <Select 
                  value={formData.specialty} 
                  onValueChange={(value) => handleInputChange('specialty', value)}
                  disabled={!canEditAll}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a especialidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDICAL_SPECIALTIES.map(specialty => (
                      <SelectItem key={specialty} value={specialty}>
                        {specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subespecialidade */}
              <div className="space-y-2">
                <Label htmlFor="sub_specialty">Subespecialidade</Label>
                <Input
                  id="sub_specialty"
                  value={formData.sub_specialty}
                  onChange={(e) => handleInputChange('sub_specialty', e.target.value)}
                  disabled={!canEditAll}
                  placeholder="Ex: Cardiologia Intervencionista"
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>

          {/* ===== CONTATO ===== */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4" />
                Informações de Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Profissional</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  disabled={!canEditAll}
                  placeholder="medico@hospital.com"
                  className="w-full"
                />
              </div>

              {/* Telefone */}
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  disabled={!canEditAll}
                  placeholder="(11) 99999-9999"
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>

          {/* ===== OBSERVAÇÕES ===== */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                Observações Administrativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="notes">Notas Internas</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  disabled={!canEditAll}
                  placeholder="Observações internas sobre o médico..."
                  rows={3}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>
        </form>

        <DialogFooter className="flex gap-3">
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleCancel}
            disabled={isLoading}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button 
            type="submit" 
            onClick={handleSubmit}
            disabled={isLoading || !canEditAll}
            className="min-w-[120px]"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Salvando...
              </div>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {mode === 'create' ? 'Cadastrar' : 'Salvar'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DoctorEditModal; 