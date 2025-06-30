import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff, BarChart3, Code, Crown, LogIn, UserPlus } from 'lucide-react';

interface LoginFormProps {
  onSuccess?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const { signIn, signUp, loading } = useAuth();
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'admin' as 'developer' | 'admin'
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.email || !formData.password) {
      setError('Email e senha são obrigatórios');
      return;
    }

    try {
      if (isLoginMode) {
        // Login
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          setError(error.message);
        } else {
          onSuccess?.();
        }
      } else {
        // Cadastro
        const { error } = await signUp(formData.email, formData.password, {
          full_name: formData.fullName,
          role: formData.role,
          hospital_access: [], // Admin/Dev terão acesso configurado pelo sistema
          permissions: formData.role === 'developer' ? ['all'] : ['admin']
        });
        if (error) {
          setError(error.message);
        } else {
          setIsLoginMode(true);
          setFormData({ email: '', password: '', fullName: '', role: 'admin' });
        }
      }
    } catch (err: any) {
      setError('Erro inesperado. Tente novamente.');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(''); // Limpar erro ao digitar
  };

  // Credenciais de demonstração - USUÁRIO ÚNICO  
  const demoCredentials = [
    { role: 'developer', email: 'developer@gmail.com', password: 'dev123456', name: 'Developer', icon: Code }
  ];

  const fillDemoCredentials = (role: 'developer' | 'admin') => {
    const cred = demoCredentials.find(c => c.role === role);
    if (cred) {
      setFormData(prev => ({
        ...prev,
        email: cred.email,
        password: cred.password
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo e Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center mb-4">
            <BarChart3 className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">SIGTAP Sync</h1>
          <p className="text-blue-200">Sistema de Autenticação Segura</p>
        </div>

        <Card className="shadow-2xl border-0">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              {isLoginMode ? <LogIn className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
              {isLoginMode ? 'Fazer Login' : 'Criar Conta'}
            </CardTitle>
            <CardDescription>
              {isLoginMode 
                ? 'Acesse sua conta de desenvolvedor ou administrador'
                : 'Crie uma nova conta com privilégios elevados'
              }
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Credenciais Demo */}
            {isLoginMode && (
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-600">Acesso Rápido:</Label>
                <div className="grid grid-cols-1 gap-2">
                  {demoCredentials.map((cred) => (
                    <Button
                      key={cred.role}
                      variant="outline"
                      size="sm"
                      onClick={() => fillDemoCredentials(cred.role as 'developer' | 'admin')}
                      className="flex items-center gap-2 text-sm justify-center"
                    >
                      <cred.icon className="h-4 w-4" />
                      {cred.name} - {cred.email}
                    </Button>
                  ))}
                </div>
                <Separator />
              </div>
            )}

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLoginMode && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Seu nome completo"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    required={!isLoginMode}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Sua senha"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {!isLoginMode && (
                <div className="space-y-2">
                  <Label htmlFor="role">Tipo de Conta</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={formData.role === 'admin' ? 'default' : 'outline'}
                      onClick={() => handleInputChange('role', 'admin')}
                      className="flex items-center gap-2"
                    >
                      <Crown className="h-4 w-4" />
                      Admin
                    </Button>
                    <Button
                      type="button"
                      variant={formData.role === 'developer' ? 'default' : 'outline'}
                      onClick={() => handleInputChange('role', 'developer')}
                      className="flex items-center gap-2"
                    >
                      <Code className="h-4 w-4" />
                      Developer
                    </Button>
                  </div>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Processando...' : (isLoginMode ? 'Entrar' : 'Criar Conta')}
              </Button>
            </form>

            {/* Toggle entre Login/Cadastro */}
            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setIsLoginMode(!isLoginMode);
                  setError('');
                  setFormData({ email: '', password: '', fullName: '', role: 'admin' });
                }}
                className="text-sm"
              >
                {isLoginMode 
                  ? 'Não tem conta? Criar nova conta'
                  : 'Já tem conta? Fazer login'
                }
              </Button>
            </div>

            {/* Informações de Acesso */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Níveis de Acesso:</h3>
              <div className="space-y-2 text-xs text-blue-700">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    <Code className="h-3 w-3 mr-1" />
                    DEVELOPER
                  </Badge>
                  <span>Acesso total ao sistema + código</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    <Crown className="h-3 w-3 mr-1" />
                    ADMIN
                  </Badge>
                  <span>Acesso administrativo completo</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-blue-200 text-sm">
            Sistema protegido com Supabase Auth
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm; 