#!/usr/bin/env python3
"""
Inspetor rápido de ZIP SIGTAP
Análise básica para descobrir a estrutura inicial
"""

import zipfile
import sys
import os
from pathlib import Path

def quick_inspect(zip_path: str):
    """Inspeção rápida do arquivo ZIP"""
    
    print("🔍 INSPEÇÃO RÁPIDA DO ZIP SIGTAP")
    print(f"📁 Arquivo: {zip_path}")
    print("=" * 60)
    
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            file_list = zip_ref.namelist()
            
            print(f"📊 Total de arquivos: {len(file_list)}")
            print("\n📄 LISTA DE ARQUIVOS:")
            print("-" * 60)
            
            # Categorizar arquivos
            data_files = []
            other_files = []
            
            for file_name in sorted(file_list):
                if file_name.endswith('/'):
                    continue
                    
                file_info = zip_ref.getinfo(file_name)
                size = file_info.file_size
                ext = Path(file_name).suffix.lower()
                
                size_str = f"{size:,} bytes" if size < 1024*1024 else f"{size/(1024*1024):.1f} MB"
                
                if ext in ['.csv', '.txt', '.tsv', '.xls', '.xlsx']:
                    data_files.append((file_name, size, ext))
                    print(f"📊 {file_name:<50} {ext:<6} {size_str}")
                else:
                    other_files.append((file_name, size, ext))
                    print(f"📄 {file_name:<50} {ext:<6} {size_str}")
            
            print(f"\n📈 RESUMO:")
            print(f"   📊 Arquivos de dados: {len(data_files)}")
            print(f"   📄 Outros arquivos: {len(other_files)}")
            
            if data_files:
                total_data_size = sum(size for _, size, _ in data_files)
                print(f"   💾 Tamanho total dos dados: {total_data_size/(1024*1024):.1f} MB")
                
                print(f"\n🎯 MAIORES ARQUIVOS DE DADOS:")
                sorted_data = sorted(data_files, key=lambda x: x[1], reverse=True)
                for file_name, size, ext in sorted_data[:5]:
                    size_str = f"{size/(1024*1024):.1f} MB" if size > 1024*1024 else f"{size:,} bytes"
                    print(f"   📊 {Path(file_name).name:<40} {size_str}")
            
            print(f"\n💡 PRÓXIMA ETAPA:")
            print(f"   Execute: python scripts/analyze_sigtap_zip.py \"{zip_path}\"")
            print(f"   Para análise detalhada dos dados e estrutura")
            
    except Exception as e:
        print(f"❌ ERRO: {e}")

def main():
    if len(sys.argv) != 2:
        print("❌ Uso: python quick_zip_inspector.py <arquivo.zip>")
        print("📝 Exemplo: python quick_zip_inspector.py sigtap_202412.zip")
        sys.exit(1)
    
    zip_path = sys.argv[1]
    
    if not os.path.exists(zip_path):
        print(f"❌ Arquivo não encontrado: {zip_path}")
        sys.exit(1)
    
    quick_inspect(zip_path)

if __name__ == "__main__":
    main() 