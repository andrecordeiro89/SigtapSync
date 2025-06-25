
import { useState, useCallback } from 'react';
import { SigtapProcedure } from '../types';
import { processSigtapZip, SigtapProcessingResult } from '../utils/sigtapProcessor';

export interface SigtapDataState {
  procedures: SigtapProcedure[];
  isLoading: boolean;
  error: string | null;
  lastImportDate: string | null;
  totalProcedures: number;
}

export const useSigtapData = () => {
  const [state, setState] = useState<SigtapDataState>({
    procedures: [],
    isLoading: false,
    error: null,
    lastImportDate: null,
    totalProcedures: 0
  });

  const importSigtapFile = useCallback(async (file: File): Promise<SigtapProcessingResult> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await processSigtapZip(file);
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          procedures: result.procedures,
          totalProcedures: result.totalProcessed,
          lastImportDate: new Date().toISOString(),
          isLoading: false,
          error: null
        }));
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: result.message
        }));
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
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
      totalProcedures: 0
    });
  }, []);

  return {
    ...state,
    importSigtapFile,
    clearData
  };
};
