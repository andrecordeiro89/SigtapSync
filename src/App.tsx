import React, { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SigtapProvider } from "./contexts/SigtapContext";
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginForm from './components/auth/LoginForm';
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from 'sonner';
import { viewRefreshService } from './services/viewRefreshService';

const queryClient = new QueryClient();

// Componente interno que usa o contexto de auth
function AppContent() {
  const { user, loading } = useAuth();
  const [loadingTime, setLoadingTime] = useState(0);
  const [showResetOption, setShowResetOption] = useState(false);

  // Contar tempo de loading
  useEffect(() => {
    if (loading) {
      const timer = setInterval(() => {
        setLoadingTime(prev => {
          const newTime = prev + 1;
          if (newTime >= 5) { // Após 5 segundos, mostrar opção de reset
            setShowResetOption(true);
          }
          return newTime;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setLoadingTime(0);
      setShowResetOption(false);
    }
  }, [loading]);

  // Função para reset de emergência
  const handleEmergencyReset = async () => {
    try {
      toast.loading('🧹 Resetando sessão...');
      
      // Limpar localStorage
      localStorage.clear();
      
      // Limpar sessionStorage
      sessionStorage.clear();
      
      // Limpar cookies
      document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      });
      
      toast.success('✅ Sessão resetada! Recarregando...');
      
      // Recarregar a página após 1 segundo
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('Erro no reset:', error);
      toast.error('❌ Erro no reset. Tente recarregar a página manualmente (F5)');
    }
  };

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600">Verificando autenticação...</p>
            <p className="text-sm text-gray-500">Tempo: {loadingTime}s</p>
            
            {showResetOption && (
              <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
                  <span className="text-orange-800 font-medium">Sistema travado?</span>
                </div>
                <p className="text-sm text-orange-700 mb-3">
                  Se o sistema não carregar, clique no botão abaixo para resetar a sessão.
                </p>
                <Button 
                  onClick={handleEmergencyReset}
                  variant="outline" 
                  className="border-orange-300 text-orange-700 hover:bg-orange-100"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  🧹 Resetar Sessão
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Se não há usuário logado, mostrar tela de login
  if (!user) {
    return <LoginForm onSuccess={() => window.location.reload()} />;
  }

  // Usuário logado - mostrar aplicação protegida
  return (
    <div className="min-h-screen bg-background">
      <ProtectedRoute>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ProtectedRoute>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <SigtapProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}
          >
            <AppContent />
          </BrowserRouter>
        </SigtapProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
