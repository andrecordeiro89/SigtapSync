import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Loader2, Lock, Shield, AlertTriangle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'developer' | 'admin' | 'user';
  requiredPermission?: string;
  hospitalId?: string;
  fallback?: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredPermission,
  hospitalId,
  fallback
}) => {
  const { user, profile, loading, hasPermission, hasHospitalAccess, isDeveloper, isAdmin } = useAuth();

  // Mostrar loading enquanto carrega
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Verificando autenticação...</h3>
            <p className="text-sm text-gray-500 text-center">
              Aguarde enquanto validamos suas credenciais
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Usuário não logado
  if (!user || !profile) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Lock className="h-12 w-12 text-red-500" />
            </div>
            <CardTitle className="text-red-700">Acesso Restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Você precisa estar logado para acessar esta área do sistema.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verificar role específico
  if (requiredRole) {
    const hasRequiredRole = () => {
      switch (requiredRole) {
        case 'developer':
          return isDeveloper();
        case 'admin':
          return isAdmin();
        case 'user':
          return true; // Qualquer usuário logado
        default:
          return false;
      }
    };

    if (!hasRequiredRole()) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Shield className="h-12 w-12 text-orange-500" />
              </div>
              <CardTitle className="text-orange-700">Permissão Insuficiente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Você não tem permissão para acessar esta área. 
                  Nível necessário: <strong>{requiredRole.toUpperCase()}</strong>
                </AlertDescription>
              </Alert>
              
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Seu nível atual:</p>
                <Badge variant="secondary" className="capitalize">
                  {profile.role}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  // Verificar permissão específica
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Shield className="h-12 w-12 text-orange-500" />
            </div>
            <CardTitle className="text-orange-700">Permissão Negada</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Você não tem a permissão específica necessária: 
                <code className="ml-1 px-1 py-0.5 bg-gray-100 rounded text-xs">
                  {requiredPermission}
                </code>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verificar acesso ao hospital específico
  if (hospitalId && !hasHospitalAccess(hospitalId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Shield className="h-12 w-12 text-orange-500" />
            </div>
            <CardTitle className="text-orange-700">Acesso ao Hospital Negado</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Você não tem acesso aos dados deste hospital específico.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Usuário autorizado - renderizar conteúdo
  return <>{children}</>;
};

export default ProtectedRoute; 