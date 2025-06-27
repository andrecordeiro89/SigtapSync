#!/usr/bin/env python3
"""
Analisador Simplificado de ZIP SIGTAP
Versão sem pandas - apenas bibliotecas padrão Python
"""

import zipfile
import os
import sys
import json
import re
from pathlib import Path

class SimpleSigtapAnalyzer:
    def __init__(self, zip_path: str):
        self.zip_path = zip_path
        self.results = {
            'arquivo': zip_path,
            'total_arquivos': 0,
            'tabelas_principais': {},
            'tabelas_relacionamento': {},
            'layouts_encontrados': {},
            'documentacao': [],
            'estrategia_importacao': []
        }
    
    def analyze(self):
        """Executa análise completa"""
        print("🔍 ANÁLISE SIGTAP SIMPLIFICADA")
        print(f"📁 Arquivo: {self.zip_path}")
        print("=" * 60)
        
        try:
            with zipfile.ZipFile(self.zip_path, 'r') as zip_ref:
                file_list = zip_ref.namelist()
                self.results['total_arquivos'] = len(file_list)
                
                print(f"📊 Total de arquivos: {len(file_list)}")
                print("\n🔍 CATEGORIZANDO ARQUIVOS...")
                print("-" * 40)
                
                # Categorizar arquivos
                for file_name in file_list:
                    if file_name.endswith('/'):
                        continue
                    
                    self._categorize_file(zip_ref, file_name)
                
                # Analisar principais tabelas
                self._analyze_main_tables(zip_ref)
                
                # Gerar estratégia
                self._generate_strategy()
                
                # Mostrar resultados
                self._show_results()
                
                # Salvar relatório
                self._save_report()
                
        except Exception as e:
            print(f"❌ ERRO: {e}")
    
    def _categorize_file(self, zip_ref, file_name):
        """Categoriza arquivos por tipo"""
        file_info = zip_ref.getinfo(file_name)
        size = file_info.file_size
        base_name = Path(file_name).stem.lower()
        
        # Tabelas principais
        if base_name.startswith('tb_') and file_name.endswith('.txt'):
            self.results['tabelas_principais'][file_name] = {
                'tamanho_bytes': size,
                'tamanho_mb': round(size / (1024 * 1024), 2),
                'tipo': 'tabela_principal'
            }
            
        # Tabelas de relacionamento
        elif base_name.startswith('rl_') and file_name.endswith('.txt'):
            self.results['tabelas_relacionamento'][file_name] = {
                'tamanho_bytes': size,
                'tamanho_mb': round(size / (1024 * 1024), 2),
                'tipo': 'relacionamento'
            }
            
        # Layouts
        elif file_name.endswith('_layout.txt'):
            self.results['layouts_encontrados'][file_name] = {
                'tamanho_bytes': size,
                'tabela_relacionada': file_name.replace('_layout.txt', '.txt')
            }
            
        # Documentação
        elif any(doc in base_name for doc in ['leia_me', 'readme', 'layout']):
            self.results['documentacao'].append({
                'arquivo': file_name,
                'tamanho_bytes': size
            })
    
    def _analyze_main_tables(self, zip_ref):
        """Analisa estrutura das principais tabelas"""
        print("\n📊 ANALISANDO TABELAS PRINCIPAIS...")
        print("-" * 40)
        
        # Priorizar tabelas por importância
        priority_tables = [
            'tb_procedimento.txt',
            'tb_descricao.txt', 
            'tb_grupo.txt',
            'tb_sub_grupo.txt',
            'tb_financiamento.txt',
            'tb_modalidade.txt',
            'tb_cid.txt'
        ]
        
        for table_name in priority_tables:
            if table_name in self.results['tabelas_principais']:
                self._analyze_table_sample(zip_ref, table_name)
    
    def _analyze_table_sample(self, zip_ref, table_name):
        """Analisa amostra de uma tabela"""
        try:
            # Ler arquivo de layout se existir
            layout_file = table_name.replace('.txt', '_layout.txt')
            layout_info = ""
            
            if layout_file in zip_ref.namelist():
                layout_data = zip_ref.read(layout_file)
                try:
                    layout_info = layout_data.decode('utf-8', errors='ignore')
                except:
                    layout_info = layout_data.decode('latin1', errors='ignore')
            
            # Ler amostra da tabela
            table_data = zip_ref.read(table_name)
            try:
                content = table_data.decode('utf-8', errors='ignore')
            except:
                content = table_data.decode('latin1', errors='ignore')
            
            lines = content.split('\n')[:5]  # Primeiras 5 linhas
            
            # Detectar delimitador
            delimiter = self._detect_delimiter(lines[0] if lines else "")
            
            table_info = self.results['tabelas_principais'][table_name]
            table_info.update({
                'delimitador': delimiter,
                'linhas_amostra': len(lines),
                'layout_info': layout_info[:200] if layout_info else "Não encontrado",
                'primeira_linha': lines[0][:100] if lines else ""
            })
            
            print(f"📋 {table_name}")
            print(f"   💾 Tamanho: {table_info['tamanho_mb']} MB")
            print(f"   🔧 Delimitador: '{delimiter}'")
            print(f"   📄 Layout: {'✅ Encontrado' if layout_info else '❌ Não encontrado'}")
            print(f"   📝 Primeira linha: {lines[0][:80]}..." if lines else "   📝 Arquivo vazio")
            
        except Exception as e:
            print(f"   ❌ Erro ao analisar {table_name}: {e}")
    
    def _detect_delimiter(self, line):
        """Detecta delimitador mais provável"""
        delimiters = [';', '|', '\t', ',']
        counts = {delim: line.count(delim) for delim in delimiters}
        return max(counts, key=counts.get) if any(counts.values()) else ';'
    
    def _generate_strategy(self):
        """Gera estratégia de importação"""
        print("\n🎯 ESTRATÉGIA DE IMPORTAÇÃO SUGERIDA:")
        print("-" * 40)
        
        # Ordem sugerida baseada no tamanho e dependências
        strategy = []
        
        # 1. Tabelas pequenas de referência primeiro
        small_tables = []
        medium_tables = []
        large_tables = []
        
        for table, info in self.results['tabelas_principais'].items():
            size_mb = info['tamanho_mb']
            if size_mb < 1:
                small_tables.append((table, size_mb))
            elif size_mb < 5:
                medium_tables.append((table, size_mb))
            else:
                large_tables.append((table, size_mb))
        
        # Ordenar por tamanho
        small_tables.sort(key=lambda x: x[1])
        medium_tables.sort(key=lambda x: x[1])  
        large_tables.sort(key=lambda x: x[1])
        
        print("📋 ORDEM RECOMENDADA:")
        order = 1
        
        for tables, category in [(small_tables, "Pequenas (Referência)"), 
                                (medium_tables, "Médias"), 
                                (large_tables, "Grandes (Principal)")]:
            if tables:
                print(f"\n   🔸 {category}:")
                for table, size in tables:
                    print(f"   {order:2d}. {table:<30} ({size} MB)")
                    strategy.append({
                        'ordem': order,
                        'tabela': table,
                        'tamanho_mb': size,
                        'categoria': category
                    })
                    order += 1
        
        self.results['estrategia_importacao'] = strategy
    
    def _show_results(self):
        """Mostra resumo dos resultados"""
        print("\n📊 RESUMO FINAL:")
        print("=" * 40)
        
        print(f"📄 Total de arquivos: {self.results['total_arquivos']}")
        print(f"📊 Tabelas principais: {len(self.results['tabelas_principais'])}")
        print(f"🔗 Tabelas de relacionamento: {len(self.results['tabelas_relacionamento'])}")
        print(f"📋 Arquivos de layout: {len(self.results['layouts_encontrados'])}")
        print(f"📚 Documentação: {len(self.results['documentacao'])}")
        
        # Tamanho total das tabelas principais
        total_size = sum(info['tamanho_mb'] for info in self.results['tabelas_principais'].values())
        print(f"💾 Tamanho total (principais): {total_size:.1f} MB")
        
        print(f"\n🎯 PRINCIPAIS TABELAS IDENTIFICADAS:")
        for table, info in sorted(self.results['tabelas_principais'].items(), 
                                 key=lambda x: x[1]['tamanho_mb'], reverse=True)[:5]:
            print(f"   📊 {table:<25} {info['tamanho_mb']:>6.1f} MB")
    
    def _save_report(self):
        """Salva relatório em JSON"""
        output_file = 'sigtap_simple_analysis_report.json'
        
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(self.results, f, indent=2, ensure_ascii=False)
            
            print(f"\n💾 Relatório salvo em: {output_file}")
            
        except Exception as e:
            print(f"❌ Erro ao salvar relatório: {e}")

def main():
    if len(sys.argv) != 2:
        print("❌ Uso: python simple_sigtap_analyzer.py <arquivo.zip>")
        sys.exit(1)
    
    zip_path = sys.argv[1]
    
    if not os.path.exists(zip_path):
        print(f"❌ Arquivo não encontrado: {zip_path}")
        sys.exit(1)
    
    analyzer = SimpleSigtapAnalyzer(zip_path)
    analyzer.analyze()
    
    print(f"\n✅ Análise concluída!")
    print(f"📊 Use os resultados para implementar importação customizada")

if __name__ == "__main__":
    main() 