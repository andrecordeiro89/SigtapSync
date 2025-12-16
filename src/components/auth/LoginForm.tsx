import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Building2, Mail, LogIn, Loader2, MapPin, Shield, Users } from 'lucide-react';
import { toast } from 'sonner';

interface LoginFormProps {
  onSuccess?: () => void;
}

interface Hospital {
  id: string;
  name: string;
  cnpj: string;
  city?: string;
  state?: string;
  is_active: boolean;
}

interface UserClassification {
  role: 'admin' | 'coordinator' | 'director' | 'auditor' | 'ti' | 'user';
  permissions: string[];
  hospital_access: string[];
  full_access: boolean;
  hospital_id?: string;
}

// Mapeamento de e-mails para hospitais e permissões
const EMAIL_HOSPITAL_MAP: Record<string, UserClassification> = {
  // Hospital Municipal 18 de Dezembro (Arapongas)
  'faturamento.ara@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  'faturamento.ara01@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  'faturamento.ara02@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  
  // Hospital Torao Tokuda (Apucarana) - NOVO
  'faturamento.apu@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  'faturamento.apu01@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  'faturamento.apu02@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  
  // Hospital Municipal Juarez Barreto de Macedo (Faxinal)
  'faturamento.fax@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  'faturamento.fax01@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  'faturamento.fax02@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  
  // HUOP (Cascavel)
  'faturamento.cas@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  'faturamento.cas01@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  'faturamento.cas02@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  
  // Hospital Nossa Senhora Aparecida (Foz do Iguaçu)
  'faturamento.foz@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  'faturamento.foz01@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  'faturamento.foz02@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  
  // Hospital Municipal Santa Alice (Santa Maria)
  'faturamento.sm@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  'faturamento.sm01@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  'faturamento.sm02@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  
  // Hospital Municipal São José (Carambeí)
  'faturamento.car@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  'faturamento.car01@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  'faturamento.car02@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  
  // Hospital Maternidade Nossa Senhora Aparecida (Foz do Iguaçu)
  'faturamento.frg@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  'faturamento.frg01@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  'faturamento.frg02@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  
  // Hospital Regional Centro Oeste (Guarapuava)
  'faturamento.gua@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  'faturamento.gua01@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  'faturamento.gua02@sigtap.com': { role: 'user', permissions: ['basic_access'], hospital_access: [], full_access: false },
  
  // ACESSO TOTAL
  'diretoria@sigtap.com': { role: 'director', permissions: ['full_access', 'all_hospitals', 'system_admin'], hospital_access: ['ALL'], full_access: true },
  'ti@sigtap.com': { role: 'ti', permissions: ['full_access', 'all_hospitals', 'system_admin', 'technical_support'], hospital_access: ['ALL'], full_access: true },
  'coordenacao@sigtap.com': { role: 'coordinator', permissions: ['full_access', 'all_hospitals', 'coordination'], hospital_access: ['ALL'], full_access: true },
  'auditoria@sigtap.com': { role: 'auditor', permissions: ['full_access', 'all_hospitals', 'audit_access'], hospital_access: ['ALL'], full_access: true },
  'admin@sigtap.com': { role: 'admin', permissions: ['full_access', 'all_hospitals', 'system_admin'], hospital_access: ['ALL'], full_access: true }
};

// Mapear código do hospital baseado no email
const getHospitalCodeFromEmail = (email: string): string | null => {
  const hospitalCodes: Record<string, string> = {
    'ara': 'arapongas', // Hospital Municipal 18 de Dezembro
    'apu': 'apucarana', // Hospital Torao Tokuda - NOVO
    'fax': 'faxinal',   // Hospital Municipal Juarez Barreto de Macedo
    'cas': 'cascavel',  // HUOP
    'foz': 'foz',       // Hospital Nossa Senhora Aparecida
    'sm': 'santa-maria', // Hospital Municipal Santa Alice
    'car': 'carambei',   // Hospital Municipal São José
    'frg': 'foz-maternidade', // Hospital Maternidade Nossa Senhora Aparecida
    'gua': 'guarapuava' // Hospital Regional Centro Oeste
  };

  for (const [code, hospitalId] of Object.entries(hospitalCodes)) {
    if (email.includes(`faturamento.${code}`)) {
      return hospitalId;
    }
  }
  return null;
};

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const { signIn, loading } = useAuth();
  
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    hospital_id: '',
  });
  const [error, setError] = useState('');
  const [userClassification, setUserClassification] = useState<UserClassification | null>(null);

  // Classificar usuário baseado no email
  const classifyUser = (email: string): UserClassification => {
    const classification = EMAIL_HOSPITAL_MAP[email.toLowerCase()];
    
    if (classification) {
      return classification;
    }

    // Para emails não mapeados, tentar detectar o hospital pelo código
    const hospitalCode = getHospitalCodeFromEmail(email);
    if (hospitalCode) {
      return {
        role: 'user',
        permissions: ['basic_access'],
        hospital_access: [hospitalCode],
        full_access: false
      };
    }

    // Usuário genérico sem hospital específico
    return {
      role: 'user',
      permissions: ['basic_access'],
      hospital_access: [],
      full_access: false
    };
  };

  // Atualizar classificação quando email muda
  useEffect(() => {
    if (formData.email) {
      const classification = classifyUser(formData.email);
      setUserClassification(classification);

      // Se é usuário com acesso total, selecionar "TODOS OS HOSPITAIS" automaticamente
      if (classification.full_access) {
        setFormData(prev => ({ ...prev, hospital_id: 'ALL' }));
      }
    } else {
      setUserClassification(null);
    }
  }, [formData.email]);

  // Carregar hospitais ativos
  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        setLoadingHospitals(true);
        
        const { data, error } = await supabase
          .from('hospitals')
          .select('id, name, cnpj, city, state, is_active')
          .eq('is_active', true)
          .order('name');

        if (error) {
          console.error('Erro ao carregar hospitais:', error);
          toast.error('Erro ao carregar lista de hospitais');
          return;
        }

        setHospitals(data || []);
        
        if (!data || data.length === 0) {
          toast.warning('Nenhum hospital ativo encontrado. Verifique a configuração.');
        }
        
      } catch (err) {
        console.error('Erro inesperado ao carregar hospitais:', err);
        toast.error('Erro inesperado ao carregar hospitais');
      } finally {
        setLoadingHospitals(false);
      }
    };

    fetchHospitals();
  }, []);

  // Registrar ação de auditoria
  const logAuditAction = async (action: string, details: any) => {
    try {
      // Obter informações do navegador
      const userAgent = navigator.userAgent;
      const ipAddress = '127.0.0.1'; // Será preenchido pelo servidor

      await supabase
        .from('audit_logs')
        .insert({
          table_name: 'user_profiles',
          record_id: details.user_id || null,
          action,
          new_values: details,
          changed_fields: Object.keys(details),
          user_id: details.user_id || null,
          hospital_id: formData.hospital_id === 'ALL' ? null : formData.hospital_id,
          ip_address: ipAddress,
          user_agent: userAgent,
          operation_type: 'LOGIN',
          session_id: crypto.randomUUID()
        });

      console.log(`✅ Auditoria registrada: ${action}`);
    } catch (auditError) {
      console.warn('⚠️ Erro ao registrar auditoria (não crítico):', auditError);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações
    if (!formData.email) {
      setError('Email é obrigatório');
      return;
    }

    if (!formData.hospital_id) {
      setError('Selecione um hospital ou "TODOS OS HOSPITAIS"');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Email inválido');
      return;
    }

    const classification = classifyUser(formData.email);

    // Verificar se o email está autorizado
    if (!EMAIL_HOSPITAL_MAP[formData.email.toLowerCase()] && 
        !getHospitalCodeFromEmail(formData.email)) {
      setError('Email não autorizado. Entre em contato com a administração.');
      return;
    }

    // Verificar se usuário sem acesso total está tentando acessar "TODOS OS HOSPITAIS"
    if (formData.hospital_id === 'ALL' && !classification.full_access) {
      setError('Você não tem permissão para acessar todos os hospitais');
      return;
    }

    try {
      // Buscar usuário existente ou criar novo
      let { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', formData.email)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      // Se usuário não existe, criar novo
      if (!userProfile) {
        const newUserId = crypto.randomUUID();
        
        // Determinar hospital_access baseado na classificação
        let hospitalAccess: string[] = [];
        if (classification.full_access) {
          hospitalAccess = ['ALL'];
        } else if (classification.hospital_access.length > 0) {
          hospitalAccess = classification.hospital_access;
        } else {
          hospitalAccess = [formData.hospital_id];
        }
        
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert({
            id: newUserId,
            email: formData.email,
            role: classification.role,
            full_name: formData.email.split('@')[0],
            hospital_access: hospitalAccess,
            permissions: classification.permissions,
            is_active: true
          })
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        userProfile = newProfile;
        
        // Registrar criação de usuário
        await logAuditAction('USER_CREATED', {
          user_id: newUserId,
          email: formData.email,
          hospital_id: formData.hospital_id,
          role: classification.role,
          permissions: classification.permissions,
          full_access: classification.full_access
        });

        toast.success('Usuário criado com sucesso!');
      }

      // Verificar se usuário tem acesso ao hospital/opção selecionada
      const hasAccess = userProfile.hospital_access.includes('ALL') || 
                       userProfile.hospital_access.includes(formData.hospital_id) ||
                       formData.hospital_id === 'ALL' && userProfile.hospital_access.includes('ALL');

      if (!hasAccess) {
        setError('Você não tem acesso a esta opção');
        return;
      }

      // Registrar login bem-sucedido
      await logAuditAction('LOGIN_SUCCESS', {
        user_id: userProfile.id,
        email: formData.email,
        hospital_id: formData.hospital_id,
        role: userProfile.role,
        full_access: userProfile.hospital_access.includes('ALL'),
        login_time: new Date().toISOString()
      });

      // Simular login (já que não estamos usando Supabase Auth)
      // Salvar dados da sessão
      sessionStorage.setItem('current_user', JSON.stringify({
        id: userProfile.id,
        email: userProfile.email,
        role: userProfile.role,
        full_name: userProfile.full_name,
        hospital_id: formData.hospital_id,
        hospital_access: userProfile.hospital_access,
        permissions: userProfile.permissions,
        full_access: userProfile.hospital_access.includes('ALL')
      }));

      toast.success(`Login realizado com sucesso! ${classification.full_access ? '(Acesso Total)' : ''}`);
      onSuccess?.();

    } catch (err: any) {
      console.error('Erro no login:', err);
      
      // Registrar falha de login
      await logAuditAction('LOGIN_FAILED', {
        email: formData.email,
        hospital_id: formData.hospital_id,
        error: err.message,
        attempt_time: new Date().toISOString()
      });

      setError(err.message || 'Erro inesperado. Tente novamente.');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const selectedHospital = hospitals.find(h => h.id === formData.hospital_id);

  return (
    <div className="min-h-screen bg-white grid grid-cols-1 lg:grid-cols-2">
      <div className="hidden lg:flex items-center justify-center border-r border-gray-200 p-10">
        <div className="max-w-md space-y-4">
          <div className="flex items-center gap-3">
            <img src="/Favicon_Oficial.png?v=2" alt="Logo" className="w-10 h-10" />
            <div>
              <h1 className="text-3xl font-bold text-black">SIGTAP Sync</h1>
              <p className="text-sm text-neutral-700">Rastreabilidade e produção médica corporativa</p>
            </div>
          </div>
          <p className="text-neutral-700 text-sm leading-relaxed">
            Plataforma executiva para gestão SIGTAP: importação segura de AIH, auditoria integrada e relatórios profissionais por hospital.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
        <Card className="border border-gray-200 bg-white">
          <CardHeader className="pb-6">
            <CardTitle className="flex items-center gap-2 text-black text-xl">
              <LogIn className="h-5 w-5 text-black" />
              Fazer Login
            </CardTitle>
            <CardDescription className="text-neutral-700">
              {userClassification?.full_access 
                ? "Acesso administrativo detectado" 
                : "Selecione seu hospital e insira seu email"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Campo de Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-black text-sm font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@sigtap.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="pl-10 border-gray-300 focus:border-black focus:ring-black"
                    required
                  />
                </div>
              </div>

              {/* Classificação do Usuário */}
              {userClassification && (
                <div className={`p-3.5 rounded-lg border ${
                  userClassification.full_access 
                    ? 'bg-white border-gray-200' 
                    : 'bg-white border-gray-200'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-black" />
                    <span className="text-sm font-medium text-black">
                      {userClassification.full_access ? 'Acesso Administrativo' : 'Usuário de Hospital'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-700">
                    Perfil: {userClassification.role.toUpperCase()}
                  </p>
                </div>
              )}
              
              {/* Seleção de Hospital */}
              <div className="space-y-2">
                <Label htmlFor="hospital" className="text-black text-sm font-medium">
                  {userClassification?.full_access ? "Acesso" : "Hospital"}
                </Label>
                {loadingHospitals ? (
                  <div className="flex items-center justify-center p-3 border border-gray-200 rounded-md bg-white">
                    <Loader2 className="h-4 w-4 animate-spin mr-2 text-neutral-400" />
                    <span className="text-sm text-neutral-700">Carregando hospitais...</span>
                  </div>
                ) : (
                  <Select 
                    value={formData.hospital_id} 
                    onValueChange={(value) => handleInputChange('hospital_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        userClassification?.full_access 
                          ? "Selecione o tipo de acesso" 
                          : "Selecione um hospital"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Opção "TODOS OS HOSPITAIS" para usuários com acesso total */}
                      {userClassification?.full_access && (
                        <SelectItem value="ALL">
                          <div className="flex flex-col items-start">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-black" />
                              <span className="font-medium text-black">TODOS OS HOSPITAIS</span>
                            </div>
                            <span className="text-xs text-neutral-700">Acesso completo ao sistema</span>
                          </div>
                        </SelectItem>
                      )}
                      
                      {/* Lista de hospitais individuais */}
                      {hospitals.map((hospital) => (
                        <SelectItem key={hospital.id} value={hospital.id}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium text-black">{hospital.name}</span>
                            <span className="text-xs text-neutral-700">
                              {hospital.city && hospital.state && (
                                <>
                                  <MapPin className="h-3 w-3 inline mr-1" />
                                  {hospital.city}, {hospital.state}
                                </>
                              )}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Informações do Hospital/Acesso Selecionado */}
              {formData.hospital_id === 'ALL' ? (
                <div className="p-3.5 bg-white rounded-lg border border-gray-200">
                  <h4 className="text-sm font-medium text-black mb-1">Acesso Administrativo:</h4>
                  <p className="text-sm text-black font-medium">TODOS OS HOSPITAIS</p>
                  <p className="text-xs text-neutral-700 mt-1">
                    <Shield className="h-3 w-3 inline mr-1" />
                    Controle total sobre {hospitals.length} hospitais
                  </p>
                  <Badge variant="secondary" className="mt-2 text-xs bg-white text-black border-gray-300">
                    ADMINISTRADOR
                  </Badge>
                </div>
              ) : selectedHospital && (
                <div className="p-3.5 bg-white rounded-lg border border-gray-200">
                  <h4 className="text-sm font-medium text-black mb-1">Hospital Selecionado:</h4>
                  <p className="text-sm text-black font-medium">{selectedHospital.name}</p>
                  {selectedHospital.city && selectedHospital.state && (
                    <p className="text-xs text-neutral-700 mt-1">
                      <MapPin className="h-3 w-3 inline mr-1" />
                      {selectedHospital.city}, {selectedHospital.state}
                    </p>
                  )}
                  <Badge variant="secondary" className="mt-2 text-xs bg-white text-black border-gray-300">
                    CNPJ: {selectedHospital.cnpj}
                  </Badge>
                </div>
              )}

              {/* Erro */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Botão de Login */}
              <Button 
                type="submit" 
                className="w-full bg-black hover:bg-neutral-800 text-white"
                disabled={loading || loadingHospitals}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processando...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    {userClassification?.full_access ? 'Acessar como Admin' : 'Entrar'}
                  </>
                )}
              </Button>
            </form>

            {/* Informações do Sistema */}
            <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
              <h3 className="text-sm font-medium text-black mb-2.5">Sistema de Rastreabilidade:</h3>
              <div className="space-y-1.5 text-xs text-neutral-700">
                <p className="flex items-center gap-1.5">
                  <span className="text-neutral-400">•</span>
                  Todas as ações são registradas
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="text-neutral-400">•</span>
                  Controle de acesso por hospital
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="text-neutral-400">•</span>
                  Auditoria completa de processamento
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="text-neutral-400">•</span>
                  Acesso administrativo para diretoria
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <p className="text-neutral-700 text-sm">
            {hospitals.length} {hospitals.length === 1 ? 'hospital ativo' : 'hospitais ativos'}
            {userClassification?.full_access && ' • Acesso Total Autorizado'}
          </p>
        </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm; 
