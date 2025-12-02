// Configurações de ambiente e constantes da aplicação

export const ENV_CONFIG = {
  // ===== SUPABASE =====
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  // ===== SUPABASE (FONTE SIH REMOTA) =====
  SIH_SUPABASE_URL: import.meta.env.VITE_SIH_SUPABASE_URL || '',
  SIH_SUPABASE_ANON_KEY: import.meta.env.VITE_SIH_SUPABASE_ANON_KEY || '',
  
  // ===== API KEYS =====
  GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY || '',
  
  // ===== APLICAÇÃO =====
  APP_NAME: import.meta.env.VITE_APP_NAME || 'SIGTAP Sync',
  APP_VERSION: import.meta.env.VITE_APP_VERSION || '3.0.0',
  APP_ENVIRONMENT: import.meta.env.VITE_APP_ENVIRONMENT || 'development',
  USE_SIH_SOURCE: import.meta.env.VITE_USE_SIH_SOURCE === 'true',
  
  // ===== DESENVOLVIMENTO =====
  IS_DEVELOPMENT: import.meta.env.DEV,
  IS_PRODUCTION: import.meta.env.PROD,
  DEBUG_MODE: import.meta.env.VITE_DEBUG_MODE === 'true',
  LOG_LEVEL: import.meta.env.VITE_LOG_LEVEL || 'info',
  
  // Configurações do PDF
  PDF_WORKER_PATH: '/pdf.worker.min.mjs',
  
  // Configurações do Gemini
  GEMINI_MODEL: 'gemini-1.5-flash',
  GEMINI_TEMPERATURE: 0.1,
  GEMINI_MAX_TOKENS: 8192,
  
  // ===== SISTEMA HÍBRIDO =====
  HYBRID_CONFIG: {
    minProceduresThreshold: 1,
    confidenceThreshold: 70,
    enableGeminiFallback: import.meta.env.VITE_ENABLE_AI_FALLBACK !== 'false',
    maxGeminiPagesPerBatch: 50,
    geminiCooldownMs: 500
  },
  
  // ===== PROCESSAMENTO =====
  PDF_BATCH_SIZE: Number(import.meta.env.VITE_PDF_BATCH_SIZE) || 10,
  EXCEL_BATCH_SIZE: Number(import.meta.env.VITE_EXCEL_BATCH_SIZE) || 1000,
  MAX_FILE_SIZE_MB: Number(import.meta.env.VITE_MAX_FILE_SIZE_MB) || 100,
  
  // ===== MATCHING AIH =====
  MATCHING_CONFIG: {
    minMatchScore: Number(import.meta.env.VITE_MIN_MATCH_SCORE) || 70,
    autoApproveScore: Number(import.meta.env.VITE_AUTO_APPROVE_SCORE) || 90,
    manualReviewScore: Number(import.meta.env.VITE_MANUAL_REVIEW_SCORE) || 60,
    enableBatchProcessing: import.meta.env.VITE_ENABLE_BATCH_PROCESSING !== 'false'
  },
  
  // ===== UI E UX =====
  ITEMS_PER_PAGE: 20,
  MAX_DESCRIPTION_LENGTH: 50,
  
  // ===== RECURSOS OPCIONAIS =====
  ENABLE_AUDIT_LOGS: import.meta.env.VITE_ENABLE_AUDIT_LOGS !== 'false',
  ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === 'true'
} as const;

// Validação de configurações críticas
export const validateConfig = (): { 
  isValid: boolean; 
  errors: string[]; 
  warnings: string[];
  supabaseEnabled: boolean;
  geminiEnabled: boolean;
} => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // ===== VERIFICAR SUPABASE (OBRIGATÓRIO) =====
  let supabaseEnabled = false;
  if (!ENV_CONFIG.SUPABASE_URL || ENV_CONFIG.SUPABASE_URL === 'sua_url_do_supabase_aqui') {
    errors.push('❌ VITE_SUPABASE_URL não está configurada no arquivo .env');
  } else if (!ENV_CONFIG.SUPABASE_ANON_KEY || ENV_CONFIG.SUPABASE_ANON_KEY === 'sua_chave_anonima_supabase_aqui') {
    errors.push('❌ VITE_SUPABASE_ANON_KEY não está configurada no arquivo .env');
  } else {
    supabaseEnabled = true;
  }

  // ===== VERIFICAR SUPABASE SIH REMOTO (OPCIONAL) =====
  if (ENV_CONFIG.USE_SIH_SOURCE) {
    if (!ENV_CONFIG.SIH_SUPABASE_URL) {
      warnings.push('⚠️ VITE_SIH_SUPABASE_URL não configurada - Fonte SIH remota desativada');
    }
    if (!ENV_CONFIG.SIH_SUPABASE_ANON_KEY) {
      warnings.push('⚠️ VITE_SIH_SUPABASE_ANON_KEY não configurada - Fonte SIH remota desativada');
    }
  }
  
  // ===== VERIFICAR GEMINI (OPCIONAL) =====
  let geminiEnabled = false;
  if (!ENV_CONFIG.GEMINI_API_KEY || ENV_CONFIG.GEMINI_API_KEY === 'sua_chave_gemini_aqui') {
    warnings.push('⚠️ VITE_GEMINI_API_KEY não configurada - Extração híbrida com IA desabilitada');
  } else {
    geminiEnabled = true;
  }
  
  // ===== VERIFICAR CONFIGURAÇÕES DE PRODUÇÃO =====
  if (ENV_CONFIG.IS_PRODUCTION) {
    if (ENV_CONFIG.DEBUG_MODE) {
      warnings.push('⚠️ Debug mode habilitado em produção');
    }
    if (!ENV_CONFIG.ENABLE_ANALYTICS) {
      warnings.push('⚠️ Analytics desabilitado em produção');
    }
  }
  
  // ===== VERIFICAR WORKER DO PDF =====
  if (typeof window !== 'undefined') {
    // Esta verificação só funciona no browser
    // TODO: Verificar se o arquivo pdf.worker.min.mjs existe
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    supabaseEnabled,
    geminiEnabled
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
