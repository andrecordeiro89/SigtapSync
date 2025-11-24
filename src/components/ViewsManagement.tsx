/**
 * ================================================================
 * COMPONENTE DE GERENCIAMENTO DE VIEWS MATERIALIZADAS
 * ================================================================
 * Permite admins visualizar status e fazer refresh manual das views
 * ================================================================
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Database, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { viewRefreshService } from '@/services/viewRefreshService';

export function ViewsManagement() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewsStatus, setViewsStatus] = useState<any>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<string | null>(null);

  // Carregar status inicial
  useEffect(() => {
    loadViewsStatus();
  }, []);

  const loadViewsStatus = async () => {
    try {
      const status = await viewRefreshService.getViewsStatus();
      setViewsStatus(status);
      
      if (status.lastRefresh) {
        setLastRefreshTime(status.lastRefresh.last_refresh);
      }
    } catch (error) {
      console.error('Erro ao carregar status das views:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      toast.info('Atualizando views materializadas...', {
        description: 'Isso pode levar alguns segundos'
      });

      const result = await viewRefreshService.forceRefresh();

      if (result.success) {
        toast.success('Views atualizadas com sucesso!', {
          description: `Tempo: ${result.duration}ms`
        });
        setLastRefreshTime(result.timestamp);
        await loadViewsStatus();
      } else {
        toast.error('Erro ao atualizar views', {
          description: result.message
        });
      }
    } catch (error: any) {
      toast.error('Erro ao atualizar views', {
        description: error.message
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSmartRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      const result = await viewRefreshService.smartRefresh();

      if (result.success) {
        if (result.duration) {
          toast.success('Views atualizadas!', {
            description: `Tempo: ${result.duration}ms`
          });
        } else {
          toast.info('Views já estão atualizadas', {
            description: result.message
          });
        }
        await loadViewsStatus();
      } else {
        toast.error('Erro ao verificar views', {
          description: result.message
        });
      }
    } catch (error: any) {
      toast.error('Erro ao verificar views', {
        description: error.message
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins < 60) return `${diffMins} minuto${diffMins > 1 ? 's' : ''} atrás`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hora${diffHours > 1 ? 's' : ''} atrás`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} dia${diffDays > 1 ? 's' : ''} atrás`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Gerenciamento de Views Materializadas
            </CardTitle>
            <CardDescription>
              Visualize o status e atualize as views de faturamento
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSmartRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Verificar e Atualizar
                </>
              )}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Forçar Atualização
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Status da última atualização */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Última Atualização:</span>
            </div>
            <Badge variant="secondary">
              {formatDate(lastRefreshTime)}
            </Badge>
          </div>

          {/* Lista de views */}
          {viewsStatus?.views && viewsStatus.views.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium mb-2">Views Disponíveis:</h4>
              {viewsStatus.views.map((view: any) => (
                <div
                  key={view.name}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    {view.view_exists ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <code className="text-sm font-mono">{view.name}</code>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={view.view_exists ? "default" : "destructive"}>
                      {view.view_exists ? 'Ativa' : 'Ausente'}
                    </Badge>
                    {view.size && (
                      <span className="text-xs text-muted-foreground">
                        {view.size}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Carregando status das views...</p>
            </div>
          )}

          {/* Informações adicionais */}
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Informações Importantes
            </h4>
            <ul className="text-xs space-y-1 text-muted-foreground">
              <li>• As views materializadas melhoram a performance das consultas</li>
              <li>• "Verificar e Atualizar" só atualiza se necessário (mais de 1 hora)</li>
              <li>• "Forçar Atualização" atualiza imediatamente (use com moderação)</li>
              <li>• A atualização pode levar de 5 a 30 segundos dependendo do volume de dados</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

