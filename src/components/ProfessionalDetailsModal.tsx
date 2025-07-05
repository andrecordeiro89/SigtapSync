import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { 
  Users, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar,
  Building2,
  Stethoscope,
  Check,
  X,
  FileText,
  Activity,
  Star,
  Clock
} from 'lucide-react';
import { DoctorHospitalInfo } from '../types';

/**
 * 🩺 MODAL DE DETALHES DO PROFISSIONAL
 * Modal completo para visualização de informações detalhadas do profissional médico
 */
interface ProfessionalDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  professional: DoctorHospitalInfo | null;
}

const ProfessionalDetailsModal: React.FC<ProfessionalDetailsModalProps> = ({ 
  isOpen, 
  onClose, 
  professional 
}) => {
  if (!professional) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Detalhes do Profissional</span>
          </DialogTitle>
          <DialogDescription>
            Informações completas do profissional médico
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* HEADER COM INFORMAÇÕES PRINCIPAIS */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {professional.doctor_name}
                </h2>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <FileText className="h-4 w-4" />
                    <span>{professional.doctor_crm} - {professional.doctor_crm_state}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Activity className="h-4 w-4" />
                    <span>CNS: {professional.doctor_cns}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col space-y-2">
                <Badge 
                  variant={professional.doctor_is_active ? "default" : "destructive"}
                  className="text-xs"
                >
                  {professional.doctor_is_active ? 'Ativo' : 'Inativo'}
                </Badge>
                {professional.doctor_is_sus_enabled && (
                  <Badge variant="secondary" className="text-xs">
                    SUS Habilitado
                  </Badge>
                )}
                {professional.link_is_primary_hospital && (
                  <Badge variant="outline" className="text-xs">
                    Hospital Principal
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* CARDS DE INFORMAÇÕES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* INFORMAÇÕES PESSOAIS */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Informações Pessoais</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Nome Completo</label>
                  <div className="text-gray-900">{professional.doctor_name}</div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Registro Médico</label>
                  <div className="text-gray-900">
                    {professional.doctor_crm} - {professional.doctor_crm_state}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">CNS</label>
                  <div className="text-gray-900">{professional.doctor_cns}</div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Status Profissional</label>
                  <div className="text-gray-900">{professional.doctor_professional_status}</div>
                </div>
              </CardContent>
            </Card>

            {/* ESPECIALIDADES */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Stethoscope className="h-5 w-5" />
                  <span>Especialidades</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Especialidade Principal</label>
                  <div className="text-gray-900">
                    <Badge variant="default" className="mt-1">
                      {professional.doctor_specialty}
                    </Badge>
                  </div>
                </div>
                
                {professional.doctor_secondary_specialties && professional.doctor_secondary_specialties.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Especialidades Secundárias</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {professional.doctor_secondary_specialties.map((specialty, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {professional.doctor_cbo_codes && professional.doctor_cbo_codes.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Códigos CBO</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {professional.doctor_cbo_codes.map((cbo, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {cbo}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* INFORMAÇÕES HOSPITALARES */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>Informações Hospitalares</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Hospital</label>
                    <div className="text-gray-900 font-medium">{professional.hospital_name}</div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Cargo/Função</label>
                    <div className="text-gray-900">{professional.link_role || 'Não informado'}</div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Departamento</label>
                    <div className="text-gray-900">{professional.link_department || 'Não informado'}</div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Tipo de Vínculo</label>
                    <div className="flex items-center space-x-2">
                      <Badge variant={professional.link_is_primary_hospital ? "default" : "secondary"}>
                        {professional.link_is_primary_hospital ? 'Hospital Principal' : 'Hospital Secundário'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Status do Vínculo</label>
                    <div className="flex items-center space-x-2">
                      <Badge variant={professional.link_is_active ? "default" : "destructive"}>
                        {professional.link_is_active ? 'Vínculo Ativo' : 'Vínculo Inativo'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Período</label>
                    <div className="text-gray-900 text-sm">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span>
                          Início: {professional.link_start_date ? 
                            new Date(professional.link_start_date).toLocaleDateString('pt-BR') : 
                            'Não informado'
                          }
                        </span>
                      </div>
                      {professional.link_end_date && (
                        <div className="flex items-center space-x-1 mt-1">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span>
                            Fim: {new Date(professional.link_end_date).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* INFORMAÇÕES DE CONTATO */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Phone className="h-5 w-5" />
                <span>Informações de Contato</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-600">Email</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-900">
                      {professional.doctor_email || 'Não informado'}
                    </span>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Telefone</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-900">
                      {professional.doctor_phone || 'Não informado'}
                    </span>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Celular</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-900">
                      {professional.doctor_mobile_phone || 'Não informado'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* INFORMAÇÕES DO HOSPITAL */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5" />
                <span>Dados do Hospital</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Nome do Hospital</label>
                    <div className="text-gray-900 font-medium">{professional.hospital_name}</div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Endereço</label>
                    <div className="text-gray-900">{professional.hospital_address || 'Não informado'}</div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Cidade/Estado</label>
                    <div className="text-gray-900">
                      {professional.hospital_city ? 
                        `${professional.hospital_city} - ${professional.hospital_state}` : 
                        'Não informado'
                      }
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">CEP</label>
                    <div className="text-gray-900">{professional.hospital_zip_code || 'Não informado'}</div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Telefone do Hospital</label>
                    <div className="text-gray-900">{professional.hospital_phone || 'Não informado'}</div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Email do Hospital</label>
                    <div className="text-gray-900">{professional.hospital_email || 'Não informado'}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* RESUMO DE STATUS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Resumo de Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-center mb-2">
                    {professional.doctor_is_active ? (
                      <Check className="h-6 w-6 text-green-600" />
                    ) : (
                      <X className="h-6 w-6 text-red-600" />
                    )}
                  </div>
                  <div className="text-sm font-medium text-gray-600">Médico</div>
                  <div className="text-xs text-gray-500">
                    {professional.doctor_is_active ? 'Ativo' : 'Inativo'}
                  </div>
                </div>
                
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-center mb-2">
                    {professional.doctor_is_sus_enabled ? (
                      <Check className="h-6 w-6 text-green-600" />
                    ) : (
                      <X className="h-6 w-6 text-red-600" />
                    )}
                  </div>
                  <div className="text-sm font-medium text-gray-600">SUS</div>
                  <div className="text-xs text-gray-500">
                    {professional.doctor_is_sus_enabled ? 'Habilitado' : 'Não Habilitado'}
                  </div>
                </div>
                
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-center mb-2">
                    {professional.link_is_active ? (
                      <Check className="h-6 w-6 text-green-600" />
                    ) : (
                      <X className="h-6 w-6 text-red-600" />
                    )}
                  </div>
                  <div className="text-sm font-medium text-gray-600">Vínculo</div>
                  <div className="text-xs text-gray-500">
                    {professional.link_is_active ? 'Ativo' : 'Inativo'}
                  </div>
                </div>
                
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-center mb-2">
                    {professional.hospital_is_active ? (
                      <Check className="h-6 w-6 text-green-600" />
                    ) : (
                      <X className="h-6 w-6 text-red-600" />
                    )}
                  </div>
                  <div className="text-sm font-medium text-gray-600">Hospital</div>
                  <div className="text-xs text-gray-500">
                    {professional.hospital_is_active ? 'Ativo' : 'Inativo'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfessionalDetailsModal; 