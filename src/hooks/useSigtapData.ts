
import { useState, useCallback } from 'react';
import { SigtapProcedure } from '../types';
import { processSigtapFile, SigtapProcessingResult } from '../utils/sigtapProcessor';

export interface SigtapDataState {
  procedures: SigtapProcedure[];
  isLoading: boolean;
  error: string | null;
  lastImportDate: string | null;
  totalProcedures: number;
  processingProgress: number;
  currentPage?: number;
  totalPages?: number;
}

export const useSigtapData = () => {
  const [state, setState] = useState<SigtapDataState>({
    procedures: [],
    isLoading: false,
    error: null,
    lastImportDate: null,
    totalProcedures: 0,
    processingProgress: 0
  });

  const importSigtapFile = useCallback(async (file: File | null, directProcedures?: SigtapProcedure[]): Promise<SigtapProcessingResult> => {
    setState(prev => ({ ...prev, isLoading: true, error: null, processingProgress: 0 }));
    
    try {
      let result: SigtapProcessingResult;
      
      if (directProcedures) {
        // Importação direta de procedimentos (Excel)
        result = {
          success: true,
          message: `${directProcedures.length} procedimentos importados com sucesso!`,
          procedures: directProcedures,
          totalProcessed: directProcedures.length
        };
        
        setState(prev => ({ ...prev, processingProgress: 100 }));
      } else if (file) {
        // Importação de arquivo (PDF/ZIP)
        result = await processSigtapFile(file, (progress, currentPage, totalPages) => {
          setState(prev => ({ 
            ...prev, 
            processingProgress: progress,
            currentPage,
            totalPages
          }));
        });
      } else {
        throw new Error('Nenhum arquivo ou procedimentos fornecidos');
      }
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          procedures: result.procedures,
          totalProcedures: result.totalProcessed,
          lastImportDate: new Date().toISOString(),
          isLoading: false,
          error: null,
          processingProgress: 100
        }));
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: result.message,
          processingProgress: 0
        }));
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        processingProgress: 0
      }));
      
      return {
        success: false,
        message: errorMessage,
        procedures: [],
        totalProcessed: 0
      };
    }
  }, []);

  const clearData = useCallback(() => {
    setState({
      procedures: [],
      isLoading: false,
      error: null,
      lastImportDate: null,
      totalProcedures: 0,
      processingProgress: 0
    });
  }, []);

  return {
    ...state,
    importSigtapFile,
    clearData
  };
};
