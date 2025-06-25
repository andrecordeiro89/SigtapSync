// Configurações de ambiente e constantes da aplicação

export const ENV_CONFIG = {
  // API Keys
  GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY || '',
  
  // Configurações da aplicação
  APP_NAME: import.meta.env.VITE_APP_NAME || 'SIGTAP Billing Wizard',
  APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
  
  // Configurações de desenvolvimento
  IS_DEVELOPMENT: import.meta.env.DEV,
  IS_PRODUCTION: import.meta.env.PROD,
  
  // Configurações do PDF
  PDF_WORKER_PATH: '/pdf.worker.min.mjs',
  
  // Configurações do Gemini
  GEMINI_MODEL: 'gemini-1.5-flash',
  GEMINI_TEMPERATURE: 0.1,
  GEMINI_MAX_TOKENS: 8192,
  
  // Configurações do sistema híbrido
  HYBRID_CONFIG: {
    minProceduresThreshold: 1,
    confidenceThreshold: 70,
    enableGeminiFallback: true,
    maxGeminiPagesPerBatch: 50,
    geminiCooldownMs: 500
  },
  
  // Configurações de processamento
  PDF_BATCH_SIZE: 10,
  MAX_FILE_SIZE_MB: 100,
  
  // Configurações de UI
  ITEMS_PER_PAGE: 20,
  MAX_DESCRIPTION_LENGTH: 50
} as const;

// Validação de configurações críticas
export const validateConfig = (): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Verificar se a chave do Gemini está configurada
  if (!ENV_CONFIG.GEMINI_API_KEY || ENV_CONFIG.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    errors.push('VITE_GEMINI_API_KEY não está configurada no arquivo .env');
  }
  
  // Verificar se o worker do PDF existe
  if (typeof window !== 'undefined') {
    // Esta verificação só funciona no browser
    // Em produção, você pode querer verificar se o arquivo existe
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Helper para logging baseado no ambiente
export const logger = {
  info: (message: string, ...args: any[]) => {
    if (ENV_CONFIG.IS_DEVELOPMENT) {
      console.log(`ℹ️ ${message}`, ...args);
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    console.warn(`⚠️ ${message}`, ...args);
  },
  
  error: (message: string, ...args: any[]) => {
    console.error(`❌ ${message}`, ...args);
  },
  
  success: (message: string, ...args: any[]) => {
    if (ENV_CONFIG.IS_DEVELOPMENT) {
      console.log(`✅ ${message}`, ...args);
    }
  },
  
  debug: (message: string, ...args: any[]) => {
    if (ENV_CONFIG.IS_DEVELOPMENT) {
      console.debug(`🐛 ${message}`, ...args);
    }
  }
};

// Helper para formatação de valores
export const formatters = {
  currency: (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  },
  
  percentage: (value: number): string => {
    return `${value.toFixed(1)}%`;
  },
  
  fileSize: (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  },
  
  duration: (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = seconds / 60;
    return `${minutes.toFixed(1)}min`;
  }
};

// Configurações específicas para diferentes tipos de arquivo
export const FILE_CONFIG = {
  PDF: {
    maxSizeMB: ENV_CONFIG.MAX_FILE_SIZE_MB,
    allowedExtensions: ['.pdf'],
    mimeTypes: ['application/pdf']
  },
  
  ZIP: {
    maxSizeMB: ENV_CONFIG.MAX_FILE_SIZE_MB * 2, // ZIP pode ser maior
    allowedExtensions: ['.zip'],
    mimeTypes: ['application/zip', 'application/x-zip-compressed']
  }
} as const; 