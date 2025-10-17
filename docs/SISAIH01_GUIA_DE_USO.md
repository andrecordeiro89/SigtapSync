# 📋 SISAIH01 - Guia de Uso

## 🎯 Visão Geral

O módulo **SISAIH01** é um processador de arquivos de Autorização de Internação Hospitalar (AIH) do DATASUS. Ele permite importar, visualizar, exportar e armazenar dados de internações hospitalares do Sistema Único de Saúde (SUS).

### Características Principais

- ✅ Processamento de arquivos SISAIH01 em formato texto posicional
- ✅ Suporte a encoding ISO-8859-1 (padrão DATASUS)
- ✅ Extração automática de 40+ campos de dados
- ✅ Busca e filtro avançados
- ✅ Exportação para CSV
- ✅ Armazenamento no banco de dados Supabase
- ✅ Dashboard de estatísticas em tempo real
- ✅ Interface moderna e responsiva

---

## 📄 Formato do Arquivo SISAIH01

### Especificações Técnicas

| Propriedade | Valor |
|-------------|-------|
| **Formato** | Arquivo de texto (.txt) |
| **Layout** | Posicional de tamanho fixo |
| **Tamanho da linha** | 1600 caracteres |
| **Encoding** | ISO-8859-1 (Latin-1) |
| **Origem** | DATASUS / Ministério da Saúde |

### Tipos de Registro

O sistema processa os seguintes tipos de AIH:

| Código | Tipo | Descrição |
|--------|------|-----------|
| **01** | Principal | AIH inicial da internação |
| **03** | Continuação | Continuação de internação anterior |
| **05** | Longa Permanência | Internações de longa duração |

> ⚠️ **Nota:** Registros tipo `04` (Registro Civil) e `07` (OPM) são ignorados durante o processamento.

---

## 🚀 Como Usar

### 1. Acessar o Módulo

1. Faça login no sistema SigtapSync
2. No menu lateral, clique em **SISAIH01**
3. A tela do processador será exibida

### 2. Importar Arquivo

Existem **duas formas** de importar dados:

#### Opção A: Upload de Arquivo

1. Clique em **"Escolher Arquivo"**
2. Selecione o arquivo `.txt` do SISAIH01
3. O sistema processará automaticamente

#### Opção B: Colar Conteúdo

1. Copie o conteúdo do arquivo SISAIH01
2. Cole na área de texto "Ou Cole o Conteúdo do Arquivo"
3. Clique em **"Processar Conteúdo"**

> 💡 **Dica:** O sistema detecta automaticamente o encoding ISO-8859-1 para garantir a leitura correta de caracteres acentuados.

### 3. Visualizar Estatísticas

Após o processamento, você verá 4 cards com estatísticas:

| Card | Informação |
|------|------------|
| 🔵 **Total de AIHs** | Quantidade total de registros processados + breakdown por tipo |
| 🟢 **Pacientes Únicos** | Quantidade de pacientes distintos (baseado no CNS) |
| 🟣 **Total Masculino** | Quantidade e percentual de pacientes do sexo masculino |
| 🟡 **Total Feminino** | Quantidade e percentual de pacientes do sexo feminino |

### 4. Buscar e Filtrar

Use a barra de busca para encontrar registros específicos por:

- 👤 Nome do paciente
- 🔢 Número da AIH
- 🏥 CNS (Cartão Nacional de Saúde)
- 👩 Nome da mãe
- 📄 CPF

O filtro é aplicado em tempo real conforme você digita.

### 5. Exportar para CSV

1. Após processar os registros, clique em **"Exportar CSV"**
2. O arquivo será baixado automaticamente
3. Formato: `sisaih01_YYYY-MM-DD.csv`
4. Separador: ponto e vírgula (`;`)
5. Encoding: UTF-8 com BOM

#### Colunas do CSV

O arquivo CSV exportado contém as seguintes colunas:

```
numero_aih, tipo_aih_descricao, cnes_hospital, data_internacao_formatted,
data_saida_formatted, nome_paciente, data_nascimento_formatted, 
sexo_descricao, cns, cpf, nome_mae, logradouro, numero_endereco,
bairro, uf, cep, diagnostico_principal, procedimento_realizado, prontuario
```

### 6. Salvar no Banco de Dados

1. Após processar os registros, clique em **"Salvar no Banco"**
2. O sistema fará inserção em lote (upsert)
3. Registros duplicados (mesmo número de AIH) serão atualizados
4. Uma notificação confirmará o sucesso da operação

> ⚠️ **Importante:** A operação de salvamento é **idempotente**. Você pode executá-la várias vezes sem criar duplicatas.

---

## 📊 Visualização de Dados

### Layout dos Cards

Cada registro AIH é exibido em um card expansível com **3 colunas**:

#### 🔵 Coluna 1 - Dados do Paciente

- Nome completo
- Data de nascimento
- Sexo (com badge colorido)
- CNS (Cartão Nacional de Saúde)
- CPF
- Nome da mãe

#### 🟢 Coluna 2 - Internação

- Número da AIH (destaque em verde)
- Tipo de AIH (badge colorido)
- CNES do hospital
- Data de internação
- Data de saída
- Prontuário hospitalar
- Enfermaria e leito

#### 🟣 Coluna 3 - Endereço e Diagnóstico

- Logradouro completo (rua, número, complemento)
- Bairro
- UF e CEP
- **Diagnóstico:** CID-10 principal e secundário (destaque em vermelho)
- Procedimento realizado

### Paginação

- 📄 **20 registros por página**
- Navegação com botões "Anterior" e "Próxima"
- Indicador de página atual e total de páginas
- Total de registros exibido

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `aih_registros`

A tabela possui **39 colunas** organizadas nos seguintes grupos:

#### Identificação e Controle
- `id` (UUID, PK)
- `created_at`, `updated_at` (timestamps automáticos)
- `numero_aih` (UNIQUE)

#### Dados da AIH
- `tipo_aih`, `tipo_aih_descricao`
- `cnes_hospital`, `municipio_hospital`, `competencia`
- `data_emissao`, `data_internacao`, `data_saida`

#### Procedimentos e Diagnósticos
- `procedimento_solicitado`, `procedimento_realizado`
- `carater_internacao`, `motivo_saida`
- `diagnostico_principal`, `diagnostico_secundario`, `diagnostico_complementar`, `diagnostico_obito`

#### Dados do Paciente
- `nome_paciente`, `data_nascimento`, `sexo`, `raca_cor`
- `cns`, `cpf`, `nome_mae`, `nome_responsavel`

#### Endereço
- `logradouro`, `numero_endereco`, `complemento`, `bairro`
- `codigo_municipio`, `uf`, `cep`

#### Dados Hospitalares
- `prontuario`, `enfermaria`, `leito`
- `medico_solicitante`, `medico_responsavel`

### Índices de Performance

Os seguintes índices foram criados para otimizar buscas:

```sql
idx_aih_nome_paciente        -- Busca por nome
idx_aih_cns                  -- Busca por CNS
idx_aih_cpf                  -- Busca por CPF
idx_aih_data_internacao      -- Ordenação por data (DESC)
idx_aih_cnes_hospital        -- Filtro por hospital
idx_aih_nome_mae             -- Busca por nome da mãe
idx_aih_created_at           -- Ordenação por criação
idx_aih_tipo_data            -- Busca composta (tipo + data)
```

### Views Analíticas

O sistema cria 3 views para análise:

1. **`aih_registros_stats`** - Estatísticas gerais
2. **`aih_registros_por_hospital`** - Análise por hospital
3. **`aih_registros_top_diagnosticos`** - Top 10 diagnósticos

#### Exemplo de Consulta

```sql
-- Ver estatísticas gerais
SELECT * FROM aih_registros_stats;

-- Ver análise por hospital
SELECT * FROM aih_registros_por_hospital 
ORDER BY total_aihs DESC;

-- Ver top diagnósticos
SELECT * FROM aih_registros_top_diagnosticos;
```

---

## 🔐 Segurança e Permissões

### Row Level Security (RLS)

A tabela `aih_registros` possui **RLS habilitado** com as seguintes políticas:

| Operação | Permissão |
|----------|-----------|
| **SELECT** | Todos os usuários autenticados |
| **INSERT** | Todos os usuários autenticados |
| **UPDATE** | Todos os usuários autenticados |
| **DELETE** | Todos os usuários autenticados |

> 🔒 **Nota de Segurança:** Apenas usuários **logados** no sistema podem acessar os dados de AIH.

---

## 🛠️ Troubleshooting

### Problema: "Nenhum registro válido encontrado"

**Possíveis causas:**
- Arquivo não está no formato SISAIH01
- Linhas com menos de 100 caracteres
- Apenas registros tipo 04 ou 07 (não processados)

**Solução:**
- Verifique se o arquivo é do DATASUS
- Certifique-se de que contém registros tipo 01, 03 ou 05

### Problema: Caracteres acentuados incorretos

**Causa:**
- Arquivo não está em encoding ISO-8859-1

**Solução:**
- Use a opção de **upload de arquivo** (detecta automaticamente)
- Se colar manualmente, converta o arquivo para ISO-8859-1 antes

### Problema: Erro ao salvar no banco

**Possíveis causas:**
- Campos obrigatórios vazios (nome_paciente, data_internacao, data_nascimento, sexo)
- Número de AIH duplicado (conflito)

**Solução:**
- Verifique a qualidade dos dados do arquivo
- O sistema faz **upsert** automático em caso de duplicatas

---

## 📚 Campos Extraídos

### Lista Completa (40+ campos)

<details>
<summary>Clique para expandir</summary>

#### Identificação
- Número da AIH (13 dígitos)
- Tipo de AIH (01, 03, 05)
- CNES do Hospital (7 dígitos)
- Município do Hospital (6 dígitos)
- Competência (AAAAMM)

#### Datas
- Data de Emissão
- Data de Internação
- Data de Saída

#### Procedimentos
- Procedimento Solicitado (10 dígitos)
- Procedimento Realizado (10 dígitos)
- Caráter de Internação (2 dígitos)
- Motivo de Saída (2 dígitos)

#### Diagnósticos (CID-10)
- Diagnóstico Principal (4 caracteres)
- Diagnóstico Secundário (4 caracteres)
- Diagnóstico Complementar (4 caracteres)
- Diagnóstico de Óbito (4 caracteres)

#### Paciente
- Nome (70 caracteres)
- Data de Nascimento
- Sexo (M/F)
- Raça/Cor (2 dígitos)
- CNS (15 dígitos)
- CPF (11 dígitos)
- Nome da Mãe (70 caracteres)
- Nome do Responsável (70 caracteres)

#### Endereço
- Logradouro (50 caracteres)
- Número (7 dígitos)
- Complemento (15 caracteres)
- Bairro (30 caracteres)
- Código do Município IBGE (6 dígitos)
- UF (2 letras)
- CEP (8 dígitos)

#### Hospitalização
- Número do Prontuário (15 caracteres)
- Número da Enfermaria (4 dígitos)
- Número do Leito (4 dígitos)

#### Profissionais
- Documento do Médico Solicitante (15 caracteres)
- Documento do Médico Responsável (15 caracteres)

</details>

---

## 🎨 Interface e Design

### Paleta de Cores

| Elemento | Cor |
|----------|-----|
| **Header** | Gradiente azul-indigo (`from-blue-600 to-indigo-600`) |
| **Estatísticas - Total AIHs** | Azul (`blue-600`) |
| **Estatísticas - Pacientes** | Verde (`green-600`) |
| **Estatísticas - Masculino** | Roxo (`purple-600`) |
| **Estatísticas - Feminino** | Rosa (`pink-600`) |
| **Badge Masculino** | Azul claro (`blue-50`) |
| **Badge Feminino** | Rosa claro (`pink-50`) |
| **Diagnóstico** | Vermelho (`red-600`) |

### Ícones (Lucide React)

- 📄 `FileText` - Identificação geral
- ⬆️ `Upload` - Upload de arquivos
- 👥 `Users` - Dados do paciente
- ♂️ `Male` - Sexo masculino
- ♀️ `Female` - Sexo feminino
- 📊 `FileSpreadsheet` - Exportação
- 💾 `Save` - Salvar no banco
- 🔍 `Search` - Busca
- 🔄 `RefreshCw` - Processamento
- 🏥 `Hospital` - Dados da internação
- 🩺 `Stethoscope` - Diagnósticos
- 📍 `MapPin` - Endereço
- 📅 `Calendar` - Datas

---

## 📈 Casos de Uso

### 1. Importação Mensal de AIHs

**Cenário:** Hospital recebe arquivo mensal do DATASUS com todas as AIHs do mês.

**Passos:**
1. Fazer upload do arquivo `SISAIH01_YYYY_MM.txt`
2. Aguardar processamento
3. Revisar estatísticas
4. Salvar no banco de dados
5. Exportar CSV para backup local

### 2. Busca de Paciente Específico

**Cenário:** Necessidade de localizar dados de internação de um paciente.

**Passos:**
1. Processar arquivo SISAIH01
2. Usar busca por nome ou CNS
3. Visualizar card do registro
4. Copiar informações necessárias

### 3. Análise de Diagnósticos

**Cenário:** Identificar os diagnósticos mais frequentes no período.

**Passos:**
1. Importar arquivo SISAIH01
2. Salvar no banco de dados
3. Executar query na view `aih_registros_top_diagnosticos`
4. Analisar resultados

### 4. Auditoria de Internações

**Cenário:** Verificar conformidade dos registros de internação.

**Passos:**
1. Processar arquivo SISAIH01
2. Filtrar por hospital (CNES)
3. Revisar dados de cada card
4. Exportar CSV para análise detalhada

---

## 🔧 Configuração Técnica

### Dependências

O módulo utiliza as seguintes bibliotecas:

```json
{
  "react": "^18.3.1",
  "lucide-react": "^0.index_45.0",
  "@supabase/supabase-js": "^2.39.0",
  "sonner": "^1.3.1"
}
```

### Arquivos do Sistema

```
SigtapSync-7/
├── src/
│   ├── components/
│   │   └── SISAIH01Page.tsx          # Componente principal
│   ├── utils/
│   │   └── sisaih01Parser.ts         # Parser do layout posicional
│   └── pages/
│       └── Index.tsx                  # Integração com rotas
├── database/
│   └── create_aih_registros_table.sql # Script SQL
└── docs/
    └── SISAIH01_GUIA_DE_USO.md       # Este documento
```

---

## 📞 Suporte

Para dúvidas ou problemas com o módulo SISAIH01:

1. Consulte este guia
2. Verifique a seção de **Troubleshooting**
3. Entre em contato com a equipe de desenvolvimento

---

## 📝 Changelog

### v1.0.0 (2024-10-17)

✨ **Recursos Iniciais:**
- Processamento de arquivos SISAIH01
- Upload de arquivo e cola de conteúdo
- Extração de 40+ campos posicionais
- Dashboard de estatísticas
- Busca e filtro avançados
- Exportação para CSV
- Salvamento em batch no Supabase
- Interface responsiva com cards expansíveis
- Suporte a encoding ISO-8859-1
- Tratamento de duplicatas (upsert)
- Views analíticas no banco
- Row Level Security (RLS)
- Índices de performance
- Documentação completa

---

## 🎓 Glossário

| Termo | Significação |
|-------|--------------|
| **AIH** | Autorização de Internação Hospitalar |
| **DATASUS** | Departamento de Informática do SUS |
| **SISAIH01** | Sistema de Informações de AIH (formato de arquivo) |
| **CNS** | Cartão Nacional de Saúde |
| **CNES** | Cadastro Nacional de Estabelecimentos de Saúde |
| **CID-10** | Classificação Internacional de Doenças (10ª revisão) |
| **RLS** | Row Level Security (segurança em nível de linha) |
| **Upsert** | Operação que insere ou atualiza (INSERT + UPDATE) |
| **Layout Posicional** | Formato de arquivo onde cada campo tem posição fixa |
| **ISO-8859-1** | Encoding de caracteres (Latin-1) usado pelo DATASUS |

---

**Desenvolvido para SigtapSync v7**  
© 2024 - Sistema de Gestão Hospitalar SUS

