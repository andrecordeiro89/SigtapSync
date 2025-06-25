
import * as pdfjsLib from 'pdfjs-dist';
import { SigtapProcedure } from '../types';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface PDFProcessingResult {
  success: boolean;
  message: string;
  procedures: SigtapProcedure[];
  totalProcessed: number;
  totalPages?: number;
}

export const processSigtapPDF = async (
  file: File,
  onProgress?: (progress: number, currentPage: number, totalPages: number) => void
): Promise<PDFProcessingResult> => {
  try {
    console.log('Iniciando processamento do PDF SIGTAP:', file.name);
    
    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const totalPages = pdf.numPages;
    console.log(`PDF carregado com ${totalPages} páginas`);
    
    const procedures: SigtapProcedure[] = [];
    let processedPages = 0;
    
    // Process pages in batches to avoid memory issues
    const batchSize = 10;
    for (let i = 1; i <= totalPages; i += batchSize) {
      const endPage = Math.min(i + batchSize - 1, totalPages);
      
      // Process batch of pages
      for (let pageNum = i; pageNum <= endPage; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Extract procedures from page text
          const pageProcedures = extractProceduresFromPageText(textContent, pageNum);
          procedures.push(...pageProcedures);
          
          processedPages++;
          
          // Update progress
          const progress = Math.round((processedPages / totalPages) * 100);
          if (onProgress) {
            onProgress(progress, processedPages, totalPages);
          }
          
          // Allow UI to update
          await new Promise(resolve => setTimeout(resolve, 10));
          
        } catch (pageError) {
          console.warn(`Erro ao processar página ${pageNum}:`, pageError);
        }
      }
      
      // Small delay between batches to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Processamento concluído: ${procedures.length} procedimentos extraídos`);
    
    return {
      success: true,
      message: `PDF processado com sucesso! ${procedures.length} procedimentos extraídos de ${totalPages} páginas.`,
      procedures: procedures,
      totalProcessed: procedures.length,
      totalPages: totalPages
    };
    
  } catch (error) {
    console.error('Erro no processamento do PDF:', error);
    return {
      success: false,
      message: `Erro ao processar PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      procedures: [],
      totalProcessed: 0
    };
  }
};

const extractProceduresFromPageText = (textContent: any, pageNumber: number): SigtapProcedure[] => {
  const procedures: SigtapProcedure[] = [];
  
  try {
    // Extract text items from PDF page
    const textItems = textContent.items;
    const lines: string[] = [];
    
    // Group text items by approximate Y position to form lines
    const lineGroups: { [key: number]: string[] } = {};
    
    textItems.forEach((item: any) => {
      const y = Math.round(item.transform[5]); // Y position
      if (!lineGroups[y]) {
        lineGroups[y] = [];
      }
      lineGroups[y].push(item.str);
    });
    
    // Convert groups to lines
    Object.keys(lineGroups)
      .sort((a, b) => parseInt(b) - parseInt(a)) // Sort by Y position (top to bottom)
      .forEach(y => {
        const line = lineGroups[parseInt(y)].join(' ').trim();
        if (line) {
          lines.push(line);
        }
      });
    
    // Process lines to extract procedure data
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for procedure code pattern (XX.XX.XX.XXX-X)
      const codeMatch = line.match(/(\d{2}\.\d{2}\.\d{2}\.\d{3}-\d)/);
      if (codeMatch) {
        const code = codeMatch[1];
        
        // Extract description (usually on the same line or next line)
        let description = line.replace(codeMatch[0], '').trim();
        
        // If description is empty or too short, try next line
        if (description.length < 10 && i + 1 < lines.length) {
          description = lines[i + 1].trim();
        }
        
        // Extract values (look for currency patterns)
        const valueMatches = line.match(/(\d+[,\.]\d{2})/g);
        let valueAmb = 0, valueHosp = 0, valueProf = 0;
        
        if (valueMatches && valueMatches.length >= 3) {
          valueAmb = parseFloat(valueMatches[0].replace(',', '.'));
          valueHosp = parseFloat(valueMatches[1].replace(',', '.'));
          valueProf = parseFloat(valueMatches[2].replace(',', '.'));
        }
        
        // Determine complexity and financing (basic heuristics)
        let complexity = 'MEDIA COMPLEXIDADE';
        let financing = 'MEDIA E ALTA COMPLEXIDADE';
        
        if (description.toLowerCase().includes('consulta') || 
            description.toLowerCase().includes('basica') ||
            valueAmb < 20) {
          complexity = 'ATENCAO BASICA';
          financing = 'ATENCAO BASICA';
        } else if (valueAmb + valueHosp + valueProf > 500) {
          complexity = 'ALTA COMPLEXIDADE';
        }
        
        // Only add if we have meaningful data
        if (description.length > 5) {
          procedures.push({
            code,
            description: description.substring(0, 200), // Limit description length
            valueAmb,
            valueHosp,
            valueProf,
            complexity,
            financing
          });
        }
      }
    }
    
  } catch (error) {
    console.warn(`Erro ao extrair dados da página ${pageNumber}:`, error);
  }
  
  return procedures;
};
