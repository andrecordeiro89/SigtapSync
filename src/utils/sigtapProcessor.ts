
import { SigtapProcedure } from '../types';
import { processSigtapPDF } from './pdfProcessor';

export interface SigtapProcessingResult {
  success: boolean;
  message: string;
  procedures: SigtapProcedure[];
  totalProcessed: number;
  totalPages?: number;
}

export const processSigtapFile = async (
  file: File,
  onProgress?: (progress: number, currentPage?: number, totalPages?: number) => void
): Promise<SigtapProcessingResult> => {
  try {
    console.log('Iniciando processamento do arquivo SIGTAP:', file.name);
    
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.pdf')) {
      // Process PDF file
      return await processSigtapPDF(file, onProgress);
    } else if (fileName.endsWith('.zip')) {
      // Process ZIP file (existing logic)
      return await processSigtapZip(file, onProgress);
    } else {
      return {
        success: false,
        message: 'Formato de arquivo não suportado. Use arquivos PDF ou ZIP.',
        procedures: [],
        totalProcessed: 0
      };
    }
    
  } catch (error) {
    console.error('Erro no processamento:', error);
    return {
      success: false,
      message: `Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      procedures: [],
      totalProcessed: 0
    };
  }
};

export const processSigtapZip = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<SigtapProcessingResult> => {
  try {
    console.log('Processando arquivo ZIP:', file.name);
    
    // Simular processamento real - em produção, aqui seria feito:
    // 1. Extrair ZIP usando JSZip
    // 2. Processar arquivos .DBC/.DBF 
    // 3. Converter para JSON/estrutura utilizável
    
    // Para demonstração, vamos simular o processamento
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      if (onProgress) {
        onProgress((i / steps) * 100);
      }
    }
    
    // Gerar dados simulados baseados no nome do arquivo
    const mockProcedures = generateMockProceduresFromFile(file.name);
    
    const result: SigtapProcessingResult = {
      success: true,
      message: `Arquivo ZIP ${file.name} processado com sucesso! ${mockProcedures.length} procedimentos importados.`,
      procedures: mockProcedures,
      totalProcessed: mockProcedures.length
    };
    
    console.log('Processamento ZIP concluído:', result);
    return result;
    
  } catch (error) {
    console.error('Erro no processamento ZIP:', error);
    return {
      success: false,
      message: `Erro ao processar arquivo ZIP: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      procedures: [],
      totalProcessed: 0
    };
  }
};

const generateMockProceduresFromFile = (filename: string): SigtapProcedure[] => {
  // Simular diferentes conjuntos de dados baseados no nome do arquivo
  const baseDate = new Date().toISOString().substring(0, 7); // YYYY-MM
  
  const procedures: SigtapProcedure[] = [
    {
      code: '03.01.01.007-2',
      description: 'BIOPSIA DE MAMA',
      valueAmb: 45.67,
      valueHosp: 120.50,
      valueProf: 78.90,
      complexity: 'MEDIA COMPLEXIDADE',
      financing: 'MEDIA E ALTA COMPLEXIDADE'
    },
    {
      code: '04.03.02.008-9',
      description: 'ULTRASSONOGRAFIA OBSTETRICA',
      valueAmb: 32.45,
      valueHosp: 0.00,
      valueProf: 25.60,
      complexity: 'MEDIA COMPLEXIDADE',
      financing: 'MEDIA E ALTA COMPLEXIDADE'
    },
    {
      code: '02.05.01.001-0',
      description: 'CONSULTA MEDICA EM ATENCAO BASICA',
      valueAmb: 15.00,
      valueHosp: 0.00,
      valueProf: 10.00,
      complexity: 'ATENCAO BASICA',
      financing: 'ATENCAO BASICA'
    },
    {
      code: '04.11.01.012-3',
      description: 'CIRURGIA CARDIACA VALVAR',
      valueAmb: 0.00,
      valueHosp: 4500.00,
      valueProf: 1200.00,
      complexity: 'ALTA COMPLEXIDADE',
      financing: 'MEDIA E ALTA COMPLEXIDADE'
    },
    {
      code: '02.11.07.010-0',
      description: 'ATENDIMENTO FISIOTERAPEUTICO NAS ALTERACOES MOTORAS',
      valueAmb: 8.74,
      valueHosp: 0.00,
      valueProf: 5.20,
      complexity: 'MEDIA COMPLEXIDADE',
      financing: 'MEDIA E ALTA COMPLEXIDADE'
    }
  ];

  // Adicionar mais procedimentos para simular um arquivo real
  const additionalProcedures: SigtapProcedure[] = [];
  for (let i = 0; i < 50; i++) {
    additionalProcedures.push({
      code: `${String(Math.floor(Math.random() * 10)).padStart(2, '0')}.${String(Math.floor(Math.random() * 100)).padStart(2, '0')}.${String(Math.floor(Math.random() * 100)).padStart(2, '0')}.${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}-${Math.floor(Math.random() * 10)}`,
      description: `PROCEDIMENTO SIMULADO ${i + 1} - ${filename.replace(/\.(zip|pdf)$/i, '').toUpperCase()}`,
      valueAmb: Math.random() * 100,
      valueHosp: Math.random() * 500,
      valueProf: Math.random() * 150,
      complexity: ['ATENCAO BASICA', 'MEDIA COMPLEXIDADE', 'ALTA COMPLEXIDADE'][Math.floor(Math.random() * 3)],
      financing: ['ATENCAO BASICA', 'MEDIA E ALTA COMPLEXIDADE'][Math.floor(Math.random() * 2)]
    });
  }

  return [...procedures, ...additionalProcedures];
};
