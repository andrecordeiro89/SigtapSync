
import React, { createContext, useContext, ReactNode } from 'react';
import { useSigtapData } from '../hooks/useSigtapData';
import { SigtapProcedure } from '../types';
import { SigtapProcessingResult } from '../utils/sigtapProcessor';

interface SigtapContextType {
  procedures: SigtapProcedure[];
  isLoading: boolean;
  error: string | null;
  lastImportDate: string | null;
  totalProcedures: number;
  processingProgress: number;
  currentPage?: number;
  totalPages?: number;
  importSigtapFile: (file: File) => Promise<SigtapProcessingResult>;
  clearData: () => void;
}

const SigtapContext = createContext<SigtapContextType | undefined>(undefined);

export const SigtapProvider = ({ children }: { children: ReactNode }) => {
  const sigtapData = useSigtapData();

  return (
    <SigtapContext.Provider value={sigtapData}>
      {children}
    </SigtapContext.Provider>
  );
};

export const useSigtapContext = () => {
  const context = useContext(SigtapContext);
  if (context === undefined) {
    throw new Error('useSigtapContext deve ser usado dentro de um SigtapProvider');
  }
  return context;
};
