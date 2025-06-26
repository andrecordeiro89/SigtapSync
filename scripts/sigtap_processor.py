#!/usr/bin/env python3
"""
🏥 SIGTAP Excel Processor
Processa e estrutura dados SIGTAP desestruturados do Excel DATASUS
Gera arquivo JSON limpo para importação no sistema
"""

import pandas as pd
import json
import re
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class SigtapProcedure:
    """Estrutura padronizada de um procedimento SIGTAP"""
    code: str
    description: str
    origem: str = ""
    complexity: str = ""
    modality: str = ""
    registration_instrument: str = ""
    financing: str = ""
    value_amb: float = 0.0
    value_amb_total: float = 0.0
    value_hosp: float = 0.0
    value_prof: float = 0.0
    value_hosp_total: float = 0.0
    complementary_attribute: str = ""
    service_classification: str = ""
    especialidade_leito: str = ""
    gender: str = ""
    min_age: int = 0
    min_age_unit: str = ""
    max_age: int = 0
    max_age_unit: str = ""
    max_quantity: int = 0
    average_stay: int = 0
    points: int = 0
    cbo: List[str] = None
    cid: List[str] = None
    habilitation: str = ""
    habilitation_group: List[str] = None
    
    def __post_init__(self):
        if self.cbo is None:
            self.cbo = []
        if self.cid is None:
            self.cid = []
        if self.habilitation_group is None:
            self.habilitation_group = []

class SigtapProcessor:
    """Processador principal de dados SIGTAP"""
    
    def __init__(self, excel_path: str):
        self.excel_path = Path(excel_path)
        self.procedures: List[SigtapProcedure] = []
        self.stats = {
            'total_sheets': 0,
            'processed_sheets': 0,
            'total_procedures': 0,
            'valid_procedures': 0,
            'errors': []
        }
    
    def process(self) -> Dict[str, Any]:
        """Processa o arquivo Excel SIGTAP completo"""
        logger.info(f"🚀 Iniciando processamento: {self.excel_path}")
        
        try:
            # Ler todas as abas do Excel
            excel_file = pd.ExcelFile(self.excel_path)
            self.stats['total_sheets'] = len(excel_file.sheet_names)
            
            logger.info(f"📊 Encontradas {self.stats['total_sheets']} abas: {excel_file.sheet_names}")
            
            for sheet_name in excel_file.sheet_names:
                try:
                    self._process_sheet(excel_file, sheet_name)
                    self.stats['processed_sheets'] += 1
                except Exception as e:
                    error_msg = f"Erro na aba '{sheet_name}': {str(e)}"
                    logger.error(error_msg)
                    self.stats['errors'].append(error_msg)
            
            # Consolidar e limpar dados
            self._post_process()
            
            logger.info(f"✅ Processamento concluído: {self.stats['valid_procedures']} procedimentos válidos")
            return self._generate_output()
            
        except Exception as e:
            logger.error(f"❌ Erro fatal: {str(e)}")
            raise
    
    def _process_sheet(self, excel_file: pd.ExcelFile, sheet_name: str):
        """Processa uma aba específica do Excel"""
        logger.info(f"📋 Processando aba: {sheet_name}")
        
        df = pd.read_excel(excel_file, sheet_name=sheet_name)
        
        # Detectar tipo de aba e aplicar processamento específico
        if self._is_procedure_sheet(df, sheet_name):
            self._extract_procedures_from_sheet(df, sheet_name)
        else:
            logger.info(f"⏭️ Aba '{sheet_name}' ignorada (não contém procedimentos)")
    
    def _is_procedure_sheet(self, df: pd.DataFrame, sheet_name: str) -> bool:
        """Detecta se a aba contém procedimentos SIGTAP"""
        # Estratégias de detecção
        indicators = [
            # Verificar se há colunas com códigos de procedimento
            any(col.lower().find('codigo') != -1 or col.lower().find('procedimento') != -1 for col in df.columns),
            # Verificar se há códigos no formato XX.XX.XX.XXX-X
            df.astype(str).apply(lambda x: x.str.contains(r'\d{2}\.\d{2}\.\d{2}\.\d{3}-\d', na=False)).any().any(),
            # Verificar nome da aba
            any(keyword in sheet_name.lower() for keyword in ['proc', 'sigtap', 'tab', 'procedimento'])
        ]
        
        return any(indicators)
    
    def _extract_procedures_from_sheet(self, df: pd.DataFrame, sheet_name: str):
        """Extrai procedimentos de uma aba específica"""
        logger.info(f"🔍 Extraindo procedimentos da aba '{sheet_name}' ({len(df)} linhas)")
        
        # Mapear colunas para campos padrão
        column_mapping = self._map_columns(df.columns)
        
        valid_count = 0
        for index, row in df.iterrows():
            try:
                procedure = self._create_procedure_from_row(row, column_mapping)
                if procedure and self._validate_procedure(procedure):
                    self.procedures.append(procedure)
                    valid_count += 1
                    self.stats['total_procedures'] += 1
            except Exception as e:
                error_msg = f"Erro linha {index + 1} da aba '{sheet_name}': {str(e)}"
                logger.warning(error_msg)
                self.stats['errors'].append(error_msg)
        
        logger.info(f"✅ Extraídos {valid_count} procedimentos válidos da aba '{sheet_name}'")
    
    def _map_columns(self, columns: List[str]) -> Dict[str, str]:
        """Mapeia colunas do Excel para campos padronizados"""
        mapping = {}
        
        # Dicionário de mapeamento flexível
        field_patterns = {
            'code': [r'cod.*proc', r'procedimento.*cod', r'codigo', r'^cod$'],
            'description': [r'descri', r'nome.*proc', r'procedimento$', r'^desc$'],
            'value_amb': [r'val.*amb', r'ambulat', r'valor.*a'],
            'value_hosp': [r'val.*hosp', r'hospital', r'valor.*h'],
            'value_prof': [r'val.*prof', r'profiss', r'valor.*p'],
            'complexity': [r'complex', r'nivel'],
            'financing': [r'financ', r'recurso'],
            'gender': [r'sexo', r'genero'],
            'min_age': [r'idade.*min', r'min.*idade'],
            'max_age': [r'idade.*max', r'max.*idade'],
            'cid': [r'cid'],
            'cbo': [r'cbo'],
            'habilitation': [r'habilit', r'credenc']
        }
        
        for col in columns:
            col_lower = str(col).lower().strip()
            for field, patterns in field_patterns.items():
                if any(re.search(pattern, col_lower) for pattern in patterns):
                    mapping[field] = col
                    break
        
        logger.debug(f"🗺️ Mapeamento de colunas: {mapping}")
        return mapping
    
    def _create_procedure_from_row(self, row: pd.Series, column_mapping: Dict[str, str]) -> Optional[SigtapProcedure]:
        """Cria objeto SigtapProcedure a partir de uma linha do Excel"""
        try:
            # Extrair código do procedimento
            code = self._extract_procedure_code(row, column_mapping)
            if not code:
                return None
            
            # Extrair descrição
            description = self._extract_field(row, column_mapping, 'description', '')
            if not description:
                return None
            
            # Criar procedimento base
            procedure = SigtapProcedure(
                code=code,
                description=description,
                value_amb=self._extract_numeric_field(row, column_mapping, 'value_amb'),
                value_hosp=self._extract_numeric_field(row, column_mapping, 'value_hosp'),
                value_prof=self._extract_numeric_field(row, column_mapping, 'value_prof'),
                complexity=self._extract_field(row, column_mapping, 'complexity'),
                financing=self._extract_field(row, column_mapping, 'financing'),
                gender=self._extract_field(row, column_mapping, 'gender'),
                min_age=int(self._extract_numeric_field(row, column_mapping, 'min_age')),
                max_age=int(self._extract_numeric_field(row, column_mapping, 'max_age')),
                cid=self._extract_list_field(row, column_mapping, 'cid'),
                cbo=self._extract_list_field(row, column_mapping, 'cbo'),
                habilitation=self._extract_field(row, column_mapping, 'habilitation')
            )
            
            return procedure
            
        except Exception as e:
            logger.warning(f"Erro ao criar procedimento: {str(e)}")
            return None
    
    def _extract_procedure_code(self, row: pd.Series, column_mapping: Dict[str, str]) -> Optional[str]:
        """Extrai e valida código do procedimento"""
        code_field = column_mapping.get('code')
        if not code_field:
            # Buscar em todas as colunas por código no formato correto
            for col, value in row.items():
                if pd.notna(value) and re.match(r'\d{2}\.\d{2}\.\d{2}\.\d{3}-\d', str(value)):
                    return str(value).strip()
            return None
        
        code = str(row[code_field]).strip() if pd.notna(row[code_field]) else ''
        
        # Validar formato do código
        if re.match(r'\d{2}\.\d{2}\.\d{2}\.\d{3}-\d', code):
            return code
        
        return None
    
    def _extract_field(self, row: pd.Series, column_mapping: Dict[str, str], field: str, default: str = '') -> str:
        """Extrai campo de texto"""
        col = column_mapping.get(field)
        if col and col in row.index:
            value = row[col]
            return str(value).strip() if pd.notna(value) else default
        return default
    
    def _extract_numeric_field(self, row: pd.Series, column_mapping: Dict[str, str], field: str) -> float:
        """Extrai campo numérico"""
        col = column_mapping.get(field)
        if col and col in row.index:
            value = row[col]
            if pd.notna(value):
                try:
                    # Limpar formatação brasileira (vírgulas, pontos)
                    clean_value = str(value).replace(',', '.').replace(' ', '')
                    return float(clean_value)
                except ValueError:
                    pass
        return 0.0
    
    def _extract_list_field(self, row: pd.Series, column_mapping: Dict[str, str], field: str) -> List[str]:
        """Extrai campo de lista (CID, CBO, etc.)"""
        col = column_mapping.get(field)
        if col and col in row.index:
            value = row[col]
            if pd.notna(value):
                # Dividir por vírgulas, ponto-e-vírgula ou quebras de linha
                items = re.split(r'[,;\n]', str(value))
                return [item.strip() for item in items if item.strip()]
        return []
    
    def _validate_procedure(self, procedure: SigtapProcedure) -> bool:
        """Valida se o procedimento está completo"""
        return bool(procedure.code and procedure.description)
    
    def _post_process(self):
        """Pós-processamento: limpeza e consolidação"""
        logger.info(f"🧹 Pós-processamento de {len(self.procedures)} procedimentos")
        
        # Remover duplicatas
        unique_procedures = {}
        for proc in self.procedures:
            if proc.code not in unique_procedures:
                unique_procedures[proc.code] = proc
            else:
                # Manter o mais completo em caso de duplicata
                existing = unique_procedures[proc.code]
                if len(proc.description) > len(existing.description):
                    unique_procedures[proc.code] = proc
        
        self.procedures = list(unique_procedures.values())
        self.stats['valid_procedures'] = len(self.procedures)
        
        logger.info(f"✅ Dados consolidados: {self.stats['valid_procedures']} procedimentos únicos")
    
    def _generate_output(self) -> Dict[str, Any]:
        """Gera output final estruturado"""
        return {
            'metadata': {
                'source_file': str(self.excel_path),
                'processing_stats': self.stats,
                'total_procedures': self.stats['valid_procedures'],
                'generated_at': pd.Timestamp.now().isoformat()
            },
            'procedures': [asdict(proc) for proc in self.procedures]
        }
    
    def save_json(self, output_path: str):
        """Salva resultado em JSON estruturado"""
        output = self._generate_output()
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        
        logger.info(f"💾 Arquivo JSON salvo: {output_path}")
        return output_path

# Script de uso
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) != 2:
        print("Uso: python sigtap_processor.py <arquivo_excel>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    processor = SigtapProcessor(input_file)
    result = processor.process()
    
    json_path = processor.save_json('sigtap_structured.json')
    print(f"🎉 Processamento concluído! Arquivo salvo: {json_path}") 