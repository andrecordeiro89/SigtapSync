#!/usr/bin/env python3
"""
Analisador automático de arquivos ZIP do SIGTAP
Descobre a estrutura e lógica dos dados para importação
"""

import zipfile
import os
import pandas as pd
import chardet
from pathlib import Path
import json
import re
from typing import Dict, List, Any
import sys

class SigtapZipAnalyzer:
    def __init__(self, zip_path: str):
        self.zip_path = zip_path
        self.analysis_results = {
            'file_structure': {},
            'data_samples': {},
            'column_mappings': {},
            'relationships': {},
            'import_strategy': {},
            'encoding_info': {}
        }
    
    def analyze(self) -> Dict[str, Any]:
        """Executa análise completa do ZIP"""
        print("🔍 ANALISANDO ARQUIVO ZIP DO SIGTAP...")
        print(f"📁 Arquivo: {self.zip_path}")
        print("=" * 60)
        
        try:
            with zipfile.ZipFile(self.zip_path, 'r') as zip_ref:
                # Etapa 1: Estrutura dos arquivos
                self._analyze_file_structure(zip_ref)
                
                # Etapa 2: Análise de conteúdo
                self._analyze_file_contents(zip_ref)
                
                # Etapa 3: Detectar relacionamentos
                self._detect_relationships()
                
                # Etapa 4: Sugerir estratégia de importação
                self._suggest_import_strategy()
                
                # Etapa 5: Gerar relatório
                self._generate_report()
                
        except Exception as e:
            print(f"❌ ERRO na análise: {e}")
            return {}
        
        return self.analysis_results
    
    def _analyze_file_structure(self, zip_ref: zipfile.ZipFile):
        """Analisa estrutura básica dos arquivos"""
        print("\n📊 ETAPA 1: ESTRUTURA DOS ARQUIVOS")
        print("-" * 40)
        
        file_list = zip_ref.namelist()
        
        for file_name in file_list:
            if file_name.endswith('/'):  # Diretório
                continue
                
            file_info = zip_ref.getinfo(file_name)
            
            # Extrair informações básicas
            file_size = file_info.file_size
            file_ext = Path(file_name).suffix.lower()
            file_base = Path(file_name).stem
            
            self.analysis_results['file_structure'][file_name] = {
                'size_bytes': file_size,
                'size_mb': round(file_size / (1024 * 1024), 2),
                'extension': file_ext,
                'base_name': file_base,
                'is_data_file': file_ext in ['.csv', '.txt', '.tsv', '.xls', '.xlsx']
            }
            
            # Mostrar informação no console
            size_str = f"{file_size:,} bytes" if file_size < 1024*1024 else f"{file_size/(1024*1024):.1f} MB"
            print(f"📄 {file_name:<40} {file_ext:<6} {size_str}")
    
    def _analyze_file_contents(self, zip_ref: zipfile.ZipFile):
        """Analisa conteúdo dos arquivos de dados"""
        print("\n📖 ETAPA 2: ANÁLISE DE CONTEÚDO")
        print("-" * 40)
        
        for file_name, file_info in self.analysis_results['file_structure'].items():
            if not file_info['is_data_file']:
                continue
                
            print(f"\n🔍 Analisando: {file_name}")
            
            try:
                # Ler bytes do arquivo
                file_data = zip_ref.read(file_name)
                
                # Detectar encoding
                encoding_result = chardet.detect(file_data)
                encoding = encoding_result.get('encoding', 'utf-8')
                confidence = encoding_result.get('confidence', 0)
                
                self.analysis_results['encoding_info'][file_name] = {
                    'encoding': encoding,
                    'confidence': confidence
                }
                
                print(f"   📝 Encoding: {encoding} (confiança: {confidence:.2f})")
                
                # Decodificar conteúdo
                content = file_data.decode(encoding, errors='ignore')
                lines = content.split('\n')[:10]  # Primeiras 10 linhas
                
                # Detectar delimitador
                delimiter = self._detect_delimiter(lines[0] if lines else "")
                print(f"   🔧 Delimitador detectado: '{delimiter}'")
                
                # Analisar primeira linha (cabeçalho)
                if lines:
                    header_line = lines[0].strip()
                    columns = [col.strip() for col in header_line.split(delimiter)]
                    
                    print(f"   📋 Colunas ({len(columns)}): {columns[:5]}...")
                    
                    self.analysis_results['column_mappings'][file_name] = {
                        'delimiter': delimiter,
                        'columns': columns,
                        'total_columns': len(columns),
                        'sample_lines': lines[:5]
                    }
                    
                    # Tentar identificar chaves primárias
                    potential_keys = self._identify_potential_keys(columns)
                    if potential_keys:
                        print(f"   🔑 Possíveis chaves: {potential_keys}")
                        self.analysis_results['column_mappings'][file_name]['potential_keys'] = potential_keys
                
                # Mostrar amostra de dados
                print(f"   📊 Amostra (primeiras 3 linhas):")
                for i, line in enumerate(lines[1:4], 1):
                    if line.strip():
                        print(f"      {i}: {line[:100]}...")
                        
            except Exception as e:
                print(f"   ❌ Erro ao analisar {file_name}: {e}")
    
    def _detect_delimiter(self, line: str) -> str:
        """Detecta o delimitador mais provável"""
        delimiters = [';', ',', '\t', '|']
        delimiter_counts = {}
        
        for delim in delimiters:
            delimiter_counts[delim] = line.count(delim)
        
        # Retorna o delimitador com mais ocorrências
        best_delimiter = max(delimiter_counts, key=delimiter_counts.get)
        return best_delimiter if delimiter_counts[best_delimiter] > 0 else ';'
    
    def _identify_potential_keys(self, columns: List[str]) -> List[str]:
        """Identifica possíveis chaves primárias nos nomes das colunas"""
        key_patterns = [
            r'.*id.*', r'.*cod.*', r'.*codigo.*', r'.*key.*',
            r'.*pk.*', r'.*primary.*', r'.*seq.*', r'.*numero.*'
        ]
        
        potential_keys = []
        for col in columns:
            col_lower = col.lower()
            for pattern in key_patterns:
                if re.match(pattern, col_lower):
                    potential_keys.append(col)
                    break
        
        return potential_keys
    
    def _detect_relationships(self):
        """Detecta relacionamentos entre arquivos"""
        print("\n🧩 ETAPA 3: DETECTANDO RELACIONAMENTOS")
        print("-" * 40)
        
        # Coletar todas as colunas de todos os arquivos
        all_columns = {}
        for file_name, mapping in self.analysis_results['column_mappings'].items():
            all_columns[file_name] = mapping.get('columns', [])
        
        # Procurar colunas comuns
        relationships = {}
        
        for file1, cols1 in all_columns.items():
            for file2, cols2 in all_columns.items():
                if file1 >= file2:  # Evitar duplicatas
                    continue
                
                common_columns = set(cols1) & set(cols2)
                if common_columns:
                    relationship_key = f"{file1} <-> {file2}"
                    relationships[relationship_key] = list(common_columns)
                    
                    print(f"🔗 {Path(file1).stem} <-> {Path(file2).stem}")
                    print(f"   Colunas comuns: {list(common_columns)}")
        
        self.analysis_results['relationships'] = relationships
    
    def _suggest_import_strategy(self):
        """Sugere estratégia de importação"""
        print("\n🎯 ETAPA 4: ESTRATÉGIA DE IMPORTAÇÃO")
        print("-" * 40)
        
        # Analisar arquivos por tamanho e dependências
        file_sizes = {}
        for file_name, info in self.analysis_results['file_structure'].items():
            if info['is_data_file']:
                file_sizes[file_name] = info['size_bytes']
        
        # Ordenar por tamanho (menor primeiro - geralmente são tabelas de referência)
        sorted_files = sorted(file_sizes.items(), key=lambda x: x[1])
        
        strategy = {
            'import_order': [file_name for file_name, _ in sorted_files],
            'recommendations': [],
            'table_mapping': {}
        }
        
        print("📋 Ordem sugerida de importação:")
        for i, (file_name, size) in enumerate(sorted_files, 1):
            base_name = Path(file_name).stem
            table_name = self._suggest_table_name(base_name)
            strategy['table_mapping'][file_name] = table_name
            
            size_str = f"{size/(1024*1024):.1f} MB" if size > 1024*1024 else f"{size:,} bytes"
            print(f"   {i}. {file_name} -> tabela '{table_name}' ({size_str})")
        
        # Adicionar recomendações
        strategy['recommendations'].extend([
            "Importar arquivos menores primeiro (tabelas de referência)",
            "Verificar encoding antes da importação",
            "Criar índices nas colunas de chave identificadas",
            "Validar integridade referencial entre tabelas"
        ])
        
        self.analysis_results['import_strategy'] = strategy
    
    def _suggest_table_name(self, base_name: str) -> str:
        """Sugere nome de tabela baseado no nome do arquivo"""
        # Remover prefixos/sufixos comuns
        clean_name = base_name.lower()
        clean_name = re.sub(r'^(tb_|tbl_|sigtap_)', '', clean_name)
        clean_name = re.sub(r'(_\d{4,}|_v\d+)$', '', clean_name)
        
        # Converter para formato de tabela
        return f"sigtap_{clean_name}"
    
    def _generate_report(self):
        """Gera relatório final"""
        print("\n📊 ETAPA 5: RELATÓRIO FINAL")
        print("=" * 60)
        
        total_files = len([f for f in self.analysis_results['file_structure'] 
                          if self.analysis_results['file_structure'][f]['is_data_file']])
        
        total_size = sum([info['size_bytes'] for info in self.analysis_results['file_structure'].values()
                         if info['is_data_file']])
        
        print(f"📄 Total de arquivos de dados: {total_files}")
        print(f"💾 Tamanho total: {total_size/(1024*1024):.1f} MB")
        print(f"🔗 Relacionamentos encontrados: {len(self.analysis_results['relationships'])}")
        
        # Salvar resultados em JSON
        output_file = 'sigtap_analysis_report.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.analysis_results, f, indent=2, ensure_ascii=False)
        
        print(f"💾 Relatório detalhado salvo em: {output_file}")
        
        print("\n🎯 PRÓXIMOS PASSOS:")
        print("1. Implementar importador baseado na estratégia sugerida")
        print("2. Criar schema de banco de dados com as tabelas identificadas")
        print("3. Implementar validação de integridade referencial")
        print("4. Criar interface para seleção de versão dos dados")

def main():
    if len(sys.argv) != 2:
        print("❌ Uso: python analyze_sigtap_zip.py <caminho_para_arquivo.zip>")
        sys.exit(1)
    
    zip_path = sys.argv[1]
    
    if not os.path.exists(zip_path):
        print(f"❌ Arquivo não encontrado: {zip_path}")
        sys.exit(1)
    
    analyzer = SigtapZipAnalyzer(zip_path)
    results = analyzer.analyze()
    
    print(f"\n✅ Análise concluída! Verifique o arquivo 'sigtap_analysis_report.json'")

if __name__ == "__main__":
    main() 