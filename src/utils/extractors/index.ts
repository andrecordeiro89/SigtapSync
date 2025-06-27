// ================================================
// EXTRACTORS ESPECIALIZADOS POR CATEGORIA SIGTAP
// Sistema modular de extração mantendo compatibilidade total
// ================================================

export { IdentificationExtractor } from './IdentificationExtractor';
export { ClassificationExtractor } from './ClassificationExtractor';
export { AmbulatorialValuesExtractor } from './AmbulatorialValuesExtractor';
export { HospitalValuesExtractor } from './HospitalValuesExtractor';
export { EligibilityExtractor } from './EligibilityExtractor';
export { OperationalLimitsExtractor } from './OperationalLimitsExtractor';
export { AdditionalClassificationsExtractor } from './AdditionalClassificationsExtractor';

// Interface comum para todos os extractors
export interface CategoryExtractor {
  extract(blockText: string, positionMap?: Map<string, { x: number, y: number, text: string }>): any;
  getExtractionMethod(): 'sequential' | 'positional' | 'hybrid';
  getFieldNames(): string[];
  getExtractionStats(): {
    successful: number;
    failed: number;
    confidence: number;
  };
}

// Tipos para resultados de extração por categoria
export interface IdentificationResult {
  code: string;
  description: string;
}

export interface ClassificationResult {
  origem: string;
  complexity: string;
  modality: string;
  registrationInstrument: string;
  financing: string;
  especialidadeLeito: string;
}

export interface AmbulatorialValuesResult {
  valueAmb: number;
  valueAmbTotal: number;
}

export interface HospitalValuesResult {
  valueHosp: number;
  valueProf: number;
  valueHospTotal: number;
}

export interface EligibilityResult {
  gender: string;
  minAge: number;
  minAgeUnit: string;
  maxAge: number;
  maxAgeUnit: string;
}

export interface OperationalLimitsResult {
  maxQuantity: number;
  averageStay: number;
  points: number;
}

export interface AdditionalClassificationsResult {
  cbo: string[];
  cid: string[];
  habilitation: string;
  habilitationGroup: string[];
  serviceClassification: string;
  especialidadeLeito: string;
  complementaryAttribute: string;
} 