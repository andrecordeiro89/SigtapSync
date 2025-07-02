import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseAIH, AIHData } from '../hooks/useSupabase';
import { FileText, Upload, CheckCircle, AlertCircle, Activity, Building2 } from 'lucide-react';
import { toast } from 'sonner';

const AIHUpload = () => {
  const { user, getCurrentHospital } = useAuth();
  const { processAIH, loading } = useSupabaseAIH();
  
  const [formData, setFormData] = useState({
    aih_number: '',
    patient_name: '',
    procedure_code: '',
    admission_date: '',
  });
  const [result, setResult] = useState<any>(null);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.hospital_id) {
      toast.error('Hospital não selecionado');
      return;
    }

    if (!formData.aih_number || !formData.patient_name) {
      toast.error('Preencha pelo menos o número da AIH e nome do paciente');
      return;
    }

    const aihData: AIHData = {
      ...formData,
      hospital_id: user.hospital_id,
      processed_by: user.id,
      processing_timestamp: new Date().toISOString()
    };

    const result = await processAIH(aihData);
    setResult(result);

    if (result.success) {
      // Limpar formulário
      setFormData({
        aih_number: '',
        patient_name: '',
        procedure_code: '',
        admission_date: '',
      });
    }
  };

  const generateSampleData = () => {
    const sampleNumber = `AIH${Date.now().toString().slice(-6)}`;
    const sampleNames = ['João Silva', 'Maria Santos', 'Pedro Oliveira', 'Ana Costa'];
    const sampleProcedures = ['03.03.01.001-2', '03.01.01.007-0', '04.07.01.028-1'];
    
    setFormData({
      aih_number: sampleNumber,
      patient_name: sampleNames[Math.floor(Math.random() * sampleNames.length)],
      procedure_code: sampleProcedures[Math.floor(Math.random() * sampleProcedures.length)],
      admission_date: new Date().toISOString().split('T')[0],
    });
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Acesso Negado</h3>
          <p className="text-gray-500">Você precisa estar logado para processar AIHs.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8" />
      <div>
            <h1 className="text-2xl font-bold">Upload de AIH</h1>
            <p className="text-blue-100">
              Processamento com rastreabilidade completa
            </p>
          </div>
        </div>
      </div>

      {/* Informações do Contexto */}
        <Card>
          <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Contexto da Sessão
            </CardTitle>
          </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Usuário</p>
              <p className="font-medium">{user.full_name || user.email}</p>
              <Badge variant="outline" className="mt-1 text-xs">
                {user.role.toUpperCase()}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500">Hospital</p>
              <p className="font-medium">{getCurrentHospital()}</p>
              <p className="text-xs text-gray-500">ID do hospital selecionado</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Rastreabilidade</p>
              <div className="flex items-center gap-2 mt-1">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Ativa</span>
                      </div>
              <p className="text-xs text-gray-500">Todas as ações serão registradas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulário de Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Processar Nova AIH
          </CardTitle>
          <CardDescription>
            Insira os dados da AIH para processamento e registro no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="aih_number">Número da AIH *</Label>
                <Input
                  id="aih_number"
                  placeholder="Ex: AIH123456"
                  value={formData.aih_number}
                  onChange={(e) => handleInputChange('aih_number', e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="patient_name">Nome do Paciente *</Label>
                <Input
                  id="patient_name"
                  placeholder="Ex: João Silva"
                  value={formData.patient_name}
                  onChange={(e) => handleInputChange('patient_name', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="procedure_code">Código do Procedimento</Label>
                <Input
                  id="procedure_code"
                  placeholder="Ex: 03.03.01.001-2"
                  value={formData.procedure_code}
                  onChange={(e) => handleInputChange('procedure_code', e.target.value)}
                />
            </div>

              <div className="space-y-2">
                <Label htmlFor="admission_date">Data de Internação</Label>
                <Input
                  id="admission_date"
                  type="date"
                  value={formData.admission_date}
                  onChange={(e) => handleInputChange('admission_date', e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                type="submit" 
                disabled={loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Activity className="h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Processar AIH
                  </>
                )}
              </Button>
              
              <Button 
                type="button" 
                variant="outline"
                onClick={generateSampleData}
                disabled={loading}
              >
                Dados de Exemplo
              </Button>
            </div>
          </form>
          </CardContent>
        </Card>

      {/* Resultado do Processamento */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              Resultado do Processamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.success ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                    <div className="space-y-2">
                    <p className="font-medium">AIH processada com sucesso!</p>
                    <div className="text-sm space-y-1">
                      <p>• <strong>ID da AIH:</strong> {result.aih_id}</p>
                      <p>• <strong>ID de Auditoria:</strong> {result.audit_id}</p>
                      <p>• <strong>Hospital:</strong> {getCurrentHospital()}</p>
                      <p>• <strong>Processado por:</strong> {user.email}</p>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Erro no processamento:</p>
                    <p className="text-sm">{result.error}</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Informações sobre Rastreabilidade */}
        <Card>
          <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-600" />
            Sistema de Rastreabilidade
            </CardTitle>
          </CardHeader>
          <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
              <h4 className="font-medium mb-3">O que é registrado:</h4>
              <div className="space-y-2 text-sm text-gray-600">
                <p>✅ Início do processamento</p>
                <p>✅ Dados da AIH enviada</p>
                <p>✅ Usuário responsável</p>
                <p>✅ Hospital de origem</p>
                <p>✅ Timestamp completo</p>
                <p>✅ Resultado (sucesso/erro)</p>
                <p>✅ IP e User Agent</p>
                </div>
              </div>
                <div>
              <h4 className="font-medium mb-3">Benefícios:</h4>
              <div className="space-y-2 text-sm text-gray-600">
                <p>🔍 Auditoria completa</p>
                <p>👤 Responsabilização individual</p>
                <p>🏥 Controle por hospital</p>
                <p>⏱️ Histórico temporal</p>
                <p>🚨 Detecção de problemas</p>
                <p>📊 Relatórios detalhados</p>
                <p>✅ Conformidade regulatória</p>
              </div>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  );
};

export default AIHUpload;