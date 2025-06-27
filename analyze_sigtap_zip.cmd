@echo off
:: Script para análise de arquivos ZIP SIGTAP
:: Uso: analyze_sigtap_zip.cmd caminho/para/arquivo.zip

echo.
echo 🔍 ANALISADOR DE ZIP SIGTAP
echo ========================
echo.

if "%1"=="" (
    echo ❌ ERRO: Forneça o caminho para o arquivo ZIP
    echo.
    echo 📝 Uso: analyze_sigtap_zip.cmd caminho\para\sigtap.zip
    echo.
    echo 💡 Exemplo: analyze_sigtap_zip.cmd C:\Downloads\sigtap_202412.zip
    pause
    exit /b 1
)

if not exist "%1" (
    echo ❌ ERRO: Arquivo não encontrado: %1
    echo.
    pause
    exit /b 1
)

echo 📁 Arquivo: %1
echo.

echo 🚀 ETAPA 1: Inspeção rápida...
echo ================================
python scripts/quick_zip_inspector.py "%1"

echo.
echo.
echo 🚀 ETAPA 2: Análise detalhada...
echo =================================
python scripts/analyze_sigtap_zip.py "%1"

echo.
echo ✅ ANÁLISE CONCLUÍDA!
echo =====================
echo.
echo 📊 Resultados salvos em: sigtap_analysis_report.json
echo 📖 Documentação: SIGTAP_ZIP_ANALYSIS_GUIDE.md
echo.
echo 🎯 Próximo passo: Implementar importador baseado no relatório gerado
echo.
pause 