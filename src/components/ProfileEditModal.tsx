import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { User, Settings, Save, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

interface ProfileEditModalProps {
  children?: React.ReactNode;
  isOpen?: boolean;
  onClose?: () => void;
}

const ProfileEditModal: React.FC<ProfileEditModalProps> = ({ children, isOpen: externalIsOpen, onClose }) => {
  const { user, profile, updateProfile } = useAuth();
  const { toast } = useToast();
  
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalIsOpen !== undefined ? onClose || (() => {}) : setInternalIsOpen;
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || ''
  });

  // Atualizar dados do formulário quando o usuário mudar ou modal abrir
  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || ''
      });
    }
  }, [isOpen, user]);

  const handleSave = async () => {
    try {
      setIsLoading(true);

      // Validações
      if (!formData.full_name.trim()) {
        toast({
          title: "Erro",
          description: "Nome completo é obrigatório",
          variant: "destructive"
        });
        return;
      }

      if (formData.full_name.trim().length < 3) {
        toast({
          title: "Erro", 
          description: "Nome deve ter pelo menos 3 caracteres",
          variant: "destructive"
        });
        return;
      }

      // Atualizar perfil
      const result = await updateProfile({
        full_name: formData.full_name.trim()
      });

      if (result.error) {
        toast({
          title: "Erro",
          description: result.error,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Sucesso",
        description: "Perfil atualizado com sucesso!",
      });

      if (externalIsOpen !== undefined && onClose) {
        onClose();
      } else {
        setInternalIsOpen(false);
      }
      
      // Recarregar a página para refletir as mudanças
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar perfil",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      full_name: user?.full_name || '',
      email: user?.email || ''
    });
    if (externalIsOpen !== undefined && onClose) {
      onClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      'developer': { label: 'Desenvolvedor', className: 'bg-purple-100 text-purple-800' },
      'admin': { label: 'Administrador', className: 'bg-red-100 text-red-800' },
      'director': { label: 'Diretor', className: 'bg-blue-100 text-blue-800' },
      'coordinator': { label: 'Coordenador', className: 'bg-green-100 text-green-800' },
      'auditor': { label: 'Auditor', className: 'bg-yellow-100 text-yellow-800' },
      'ti': { label: 'TI', className: 'bg-indigo-100 text-indigo-800' },
      'user': { label: 'Usuário', className: 'bg-gray-100 text-gray-800' }
    };

    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.user;
    
    return (
      <Badge className={`${config.className} text-xs`}>
        {config.label}
      </Badge>
    );
  };

  const handleOpenChange = (open: boolean) => {
    if (externalIsOpen !== undefined && onClose) {
      if (!open) onClose();
    } else {
      setInternalIsOpen(open);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {/* Só renderiza DialogTrigger se não estiver sendo usado de forma controlada */}
      {externalIsOpen === undefined && (
        <DialogTrigger asChild>
          {children || (
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Editar Perfil
            </Button>
          )}
        </DialogTrigger>
      )}
      
      <DialogContent className="sm:max-w-[460px] max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center space-x-2 text-lg">
            <User className="w-4 h-4" />
            <span>Editar Perfil do Usuário</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Informações do Sistema */}
          <div className="bg-gray-50 p-3 rounded-lg space-y-1.5">
            <h3 className="font-medium text-gray-900 text-sm">Informações do Sistema</h3>
            <div className="grid grid-cols-1 gap-1.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-xs">Email:</span>
                <span className="font-medium text-xs truncate ml-2 max-w-[250px]">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-xs">Função:</span>
                {user?.role && getRoleBadge(user.role)}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-xs">ID do Usuário:</span>
                <code className="text-xs bg-gray-200 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[200px]">{user?.id}</code>
              </div>
            </div>
          </div>

          {/* Formulário de Edição */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="full_name" className="text-sm">Nome Completo *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Digite seu nome completo"
                disabled={isLoading}
                className="text-sm h-9"
              />
              <p className="text-xs text-gray-500 mt-1 leading-tight">
                Este nome será exibido nas AIHs processadas e nos relatórios da diretoria
              </p>
            </div>

            <div>
              <Label htmlFor="email" className="text-sm">Email (Não Editável)</Label>
              <Input
                id="email"
                value={formData.email}
                disabled
                className="bg-gray-100 text-sm h-9"
              />
              <p className="text-xs text-gray-500 mt-1 leading-tight">
                O email não pode ser alterado pelo usuário
              </p>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end space-x-2 pt-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
              size="sm"
              className="text-sm h-8"
            >
              <X className="w-3 h-3 mr-1" />
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isLoading || !formData.full_name.trim()}
              size="sm"
              className="text-sm h-8"
            >
              <Save className="w-3 h-3 mr-1" />
              {isLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileEditModal; 