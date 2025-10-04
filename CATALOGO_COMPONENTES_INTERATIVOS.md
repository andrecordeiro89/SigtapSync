# 🎨 CATÁLOGO DE COMPONENTES INTERATIVOS - SIGTAP SYNC
## Análise Completa de Botões, Componentes e Elementos de Interface

**Data:** 04 de Outubro de 2025  
**Versão:** 1.0

---

## 📋 ÍNDICE DE COMPONENTES

### 1. COMPONENTES GLOBAIS (Todas as Telas)

#### **1.1 HEADER/NAVEGAÇÃO PRINCIPAL**

**Localização:** Topo de todas as páginas  
**Componente:** `Navigation.tsx` / `SidebarNavigation.tsx`

| Elemento | Tipo | Função | Estados | Tooltip/Ajuda |
|----------|------|--------|---------|---------------|
| **Logo SIGTAP Sync** | Imagem clicável | Retorna ao Dashboard | Normal, Hover | "Voltar ao Dashboard" |
| **Badge ADMIN** | Badge visual | Indica modo administrador | Visível apenas para roles elevados | "Acesso total ao sistema" |
| **Tabs de Navegação** | Tabs horizontais | Navegação entre módulos | Active, Inactive, Hover, Disabled | Nome da tab + descrição |
| **Avatar do Usuário** | Avatar circular | Abre menu do usuário | Normal, Hover, Com badge admin | Nome do usuário |
| **Dropdown do Usuário** | Menu dropdown | Opções de perfil e logout | Aberto, Fechado | - |

**TABS DE NAVEGAÇÃO (Detalhamento):**

```
┌─────────────────────────────────────────────────────────────┐
│ [🏠 Dashboard] [📊 SIGTAP] [🔍 Consulta] [📄 AIH] [👥 Pac.]│
│                                                             │
│ Estados de cada tab:                                        │
│ • ATIVO: bg-blue-50, border-blue-500, text-blue-600        │
│ • INATIVO: bg-transparent, border-transparent, text-gray-500│
│ • HOVER: bg-gray-50, border-gray-300                       │
│ • DESABILITADO: opacity-50, cursor-not-allowed             │
└─────────────────────────────────────────────────────────────┘
```

**MENU DO USUÁRIO (Dropdown):**

| Item do Menu | Ícone | Ação | Condição de Exibição |
|--------------|-------|------|---------------------|
| Informações do Usuário | Avatar | - (header) | Sempre |
| Badge de Role | Crown/Shield/User | - (visual) | Sempre |
| Hospital Atual | Building2/Globe | - (informativo) | Sempre |
| Lista de Funcionalidades | CheckCircle | - (informativo) | Sempre |
| Permissões | Badge list | - (informativo) | Sempre |
| **Configurações** | Settings | Abre ProfileEditModal | Sempre |
| **Sair** | LogOut | signOut() + reload | Sempre |

**Comportamento do Avatar:**
- **Clique:** Abre dropdown menu
- **Hover:** Ring azul/roxo (conforme role)
- **Badge Admin:** Coroa roxa no canto superior direito
- **Iniciais:** Primeiras letras do nome ou email
- **Cores:** 
  - Admin/Diretor: Roxo (bg-purple-100, text-purple-700)
  - Operador: Azul (bg-blue-100, text-blue-700)

---

#### **1.2 SIDEBAR NAVEGAÇÃO (Alternativa)**

**Localização:** Lateral esquerda  
**Componente:** `SidebarNavigation.tsx`

| Elemento | Tipo | Função | Estados |
|----------|------|--------|---------|
| **Botão Toggle Sidebar** | Button | Expandir/colapsar sidebar | Expandido, Colapsado |
| **Itens de Menu** | Nav items | Navegação entre seções | Active, Hover, Disabled |
| **Separadores** | Divider | Organização visual | - |
| **Footer Sidebar** | Section | Informações adicionais | - |

**Estados da Sidebar:**
- **Expandida (240px):** Mostra ícones + texto completo
- **Colapsada (64px):** Mostra apenas ícones
- **Mobile:** Overlay modal que cobre tela

---

### 2. COMPONENTES DE FORMULÁRIO E ENTRADA

#### **2.1 CAMPOS DE TEXTO (Input)**

**Componente Base:** `ui/input.tsx`

| Variante | Aparência | Uso | Validação |
|----------|-----------|-----|-----------|
| **Default** | Border cinza, focus azul | Texto geral | Optional |
| **Error** | Border vermelho | Quando há erro | Obrigatório |
| **Disabled** | Cinza claro, não editável | Campo bloqueado | N/A |
| **With Icon** | Ícone à esquerda/direita | Busca, senha | Optional |

**Estados:**
- **Normal:** border-gray-300
- **Focus:** border-blue-500, ring-2 ring-blue-200
- **Error:** border-red-500, text-red-600
- **Disabled:** bg-gray-100, cursor-not-allowed, opacity-60

**Exemplos de Uso:**
- **Busca:** `<Input placeholder="Buscar..." icon={<Search />} />`
- **CNS do Paciente:** `<Input type="text" maxLength={15} pattern="[0-9]*" />`
- **Email:** `<Input type="email" validation={emailSchema} />`

---

#### **2.2 SELETORES (Select/Dropdown)**

**Componente Base:** `ui/select.tsx` (Radix UI)

| Parte do Componente | Função | Interação |
|---------------------|--------|-----------|
| **Trigger** | Botão que abre dropdown | Clique para abrir |
| **Content** | Lista de opções | Scroll, seleção |
| **Item** | Opção individual | Hover, Click |
| **Separator** | Divisória visual | - |
| **Label** | Agrupamento | - |

**Estados do Select:**
- **Fechado:** Mostra valor selecionado ou placeholder
- **Aberto:** Lista de opções visível com scroll
- **Item Selecionado:** Checkmark + cor destaque
- **Item Hover:** Background cinza claro
- **Disabled:** Cinza, não clicável

**Exemplos Importantes:**

```typescript
// Seletor de Hospital (para Admin)
<Select onValueChange={setHospitalId}>
  <SelectTrigger>
    <SelectValue placeholder="Selecionar Hospital..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="ALL">
      <Globe className="mr-2" />
      Todos os Hospitais
    </SelectItem>
    <SelectSeparator />
    {hospitals.map(h => (
      <SelectItem key={h.id} value={h.id}>
        <Building2 className="mr-2" />
        {h.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>

// Seletor de Período (Datas)
<Select value={dateRange} onValueChange={setDateRange}>
  <SelectItem value="7d">Últimos 7 dias</SelectItem>
  <SelectItem value="30d">Últimos 30 dias</SelectItem>
  <SelectItem value="90d">Últimos 90 dias</SelectItem>
  <SelectItem value="custom">Personalizado...</SelectItem>
</Select>
```

---

#### **2.3 BOTÕES (Button)**

**Componente Base:** `ui/button.tsx`

**VARIANTES:**

| Variante | Aparência | Uso Recomendado | Exemplo |
|----------|-----------|-----------------|---------|
| **default** | Azul sólido, texto branco | Ação primária | "Salvar", "Processar" |
| **destructive** | Vermelho sólido | Ações destrutivas | "Excluir", "Cancelar" |
| **outline** | Borda, fundo transparente | Ação secundária | "Cancelar", "Voltar" |
| **secondary** | Cinza claro | Ação terciária | "Ver Detalhes" |
| **ghost** | Transparente, hover sutil | Links, ações leves | Ícones de ação |
| **link** | Azul, sem fundo, sublinhado | Navegação interna | "Saiba mais" |

**TAMANHOS:**

| Tamanho | Altura | Padding | Uso |
|---------|--------|---------|-----|
| **sm** | 32px | px-3 | Botões compactos, tabelas |
| **default** | 40px | px-4 | Padrão geral |
| **lg** | 48px | px-6 | Destaque, CTAs principais |
| **icon** | 40x40px | p-2 | Botões apenas com ícone |

**ESTADOS:**

```css
Normal:     bg-blue-600, text-white
Hover:      bg-blue-700, transform scale-105
Active:     bg-blue-800
Disabled:   bg-gray-300, cursor-not-allowed, opacity-50
Loading:    Spinner + "Processando..."
```

**BOTÕES CRÍTICOS NO SISTEMA:**

##### **A) Botão "Processar AIHs"**
```tsx
<Button 
  size="lg" 
  className="w-full"
  onClick={handleProcessAIHs}
  disabled={!selectedFile || isProcessing}
>
  {isProcessing ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Processando...
    </>
  ) : (
    <>
      <Rocket className="mr-2 h-4 w-4" />
      🚀 Processar AIHs
    </>
  )}
</Button>
```
- **Função:** Inicia processamento de AIHs
- **Localização:** AIH Avançado > Tab Upload
- **Estados:** Normal, Loading (spinner), Disabled
- **Feedback:** Loading state + progress bar separada

##### **B) Botão "Salvar Paciente"**
```tsx
<Button 
  type="submit" 
  disabled={!isValid || isSaving}
>
  {isSaving ? "Salvando..." : "💾 Salvar Paciente"}
</Button>
```
- **Função:** Salva/atualiza dados do paciente
- **Localização:** Modal de Cadastro/Edição de Paciente
- **Validação:** Desabilitado se form inválido
- **Feedback:** Toast de sucesso/erro

##### **C) Botão "Exportar Excel"**
```tsx
<Button 
  variant="outline" 
  onClick={handleExportExcel}
>
  <Download className="mr-2 h-4 w-4" />
  ⬇️ Exportar Excel
</Button>
```
- **Função:** Exporta dados visíveis para Excel
- **Localização:** Múltiplas telas (Consulta SIGTAP, Dashboards)
- **Feedback:** Download automático do arquivo

##### **D) Botão "Sair" (Logout)**
```tsx
<DropdownMenuItem 
  onClick={handleLogout}
  disabled={isLoggingOut}
  className="text-red-600"
>
  <LogOut className="mr-2 h-4 w-4" />
  {isLoggingOut ? "Saindo..." : "Sair"}
</DropdownMenuItem>
```
- **Função:** Logout do sistema
- **Localização:** Dropdown do usuário (header)
- **Confirmação:** Não requer confirmação
- **Ação:** signOut() + reload da página

---

#### **2.4 SWITCHES E CHECKBOXES**

**Switch Component:** `ui/switch.tsx`

| Elemento | Função | Estados | Uso |
|----------|--------|---------|-----|
| **Switch** | Toggle on/off | On (azul), Off (cinza) | Ativar/desativar features |
| **Checkbox** | Múltipla seleção | Checked, Unchecked, Indeterminate | Seleções múltiplas |
| **Radio** | Seleção única | Selected, Unselected | Escolha exclusiva |

**Exemplos:**

```tsx
// Switch para ativar filtros avançados
<div className="flex items-center space-x-2">
  <Switch 
    id="advanced-filters" 
    checked={showAdvanced}
    onCheckedChange={setShowAdvanced}
  />
  <Label htmlFor="advanced-filters">
    Mostrar Filtros Avançados
  </Label>
</div>

// Checkbox para seleção múltipla de hospitais
<Checkbox 
  checked={selectedHospitals.includes(hospital.id)}
  onCheckedChange={(checked) => handleHospitalToggle(hospital.id, checked)}
/>

// Radio para seleção de formato de arquivo
<RadioGroup value={fileFormat} onValueChange={setFileFormat}>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="excel" id="excel" />
    <Label htmlFor="excel">📊 Excel (.xlsx)</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="pdf" id="pdf" />
    <Label htmlFor="pdf">📄 PDF (.pdf)</Label>
  </div>
</RadioGroup>
```

---

### 3. COMPONENTES DE VISUALIZAÇÃO

#### **3.1 CARDS**

**Componente Base:** `ui/card.tsx`

**Estrutura:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Título do Card</CardTitle>
    <CardDescription>Descrição opcional</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Conteúdo principal */}
  </CardContent>
  <CardFooter>
    {/* Ações ou informações adicionais */}
  </CardFooter>
</Card>
```

**Variantes no Sistema:**

##### **A) Card de Métrica (KPI)**
```tsx
<Card className="hover:shadow-lg transition-shadow">
  <CardContent className="pt-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">
          Total de AIHs
        </p>
        <p className="text-3xl font-bold text-gray-900">
          {formatNumber(totalAIHs)}
        </p>
        <p className="text-xs text-green-600 flex items-center mt-1">
          <TrendingUp className="w-3 h-3 mr-1" />
          +12% vs mês anterior
        </p>
      </div>
      <div className="p-3 bg-blue-100 rounded-full">
        <FileText className="w-6 h-6 text-blue-600" />
      </div>
    </div>
  </CardContent>
</Card>
```
- **Uso:** Dashboard, métricas principais
- **Interação:** Hover para shadow elevado
- **Variação:** Cores conforme métrica (verde=positivo, vermelho=negativo)

##### **B) Card de Procedimento (Resultado de Busca)**
```tsx
<Card className="cursor-pointer hover:border-blue-400">
  <CardHeader>
    <div className="flex justify-between items-start">
      <div>
        <Badge variant="outline">{procedure.code}</Badge>
        <CardTitle className="mt-2">{procedure.description}</CardTitle>
      </div>
      <Button variant="ghost" size="icon">
        <Eye className="w-4 h-4" />
      </Button>
    </div>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div>
        <span className="text-gray-600">Modalidade:</span>
        <span className="ml-2 font-medium">{procedure.modality}</span>
      </div>
      <div>
        <span className="text-gray-600">Valor:</span>
        <span className="ml-2 font-medium">{formatCurrency(procedure.value_hosp)}</span>
      </div>
    </div>
  </CardContent>
</Card>
```
- **Uso:** Lista de procedimentos SIGTAP
- **Interação:** Clique para ver detalhes, hover para destaque
- **Responsivo:** Grid adapta-se em mobile

---

#### **3.2 BADGES**

**Componente Base:** `ui/badge.tsx`

**Variantes:**

| Variante | Aparência | Uso |
|----------|-----------|-----|
| **default** | Azul sólido | Status padrão, neutro |
| **secondary** | Cinza claro | Informações complementares |
| **destructive** | Vermelho sólido | Erros, alertas críticos |
| **outline** | Borda, fundo transparente | Tags, categorias |

**Badges Específicas do Sistema:**

```tsx
// Badge de Status de AIH
{status === 'approved' && (
  <Badge className="bg-green-100 text-green-800">
    ✅ Aprovada
  </Badge>
)}
{status === 'pending' && (
  <Badge className="bg-yellow-100 text-yellow-800">
    ⏳ Pendente
  </Badge>
)}
{status === 'rejected' && (
  <Badge variant="destructive">
    ❌ Rejeitada
  </Badge>
)}

// Badge de Role do Usuário
{role === 'director' && (
  <Badge className="bg-purple-100 text-purple-800 border-purple-200">
    <Crown className="w-3 h-3 mr-1" />
    DIRETOR
  </Badge>
)}

// Badge de Score de Matching
<Badge className={scoreColor}>
  {score}% Match
</Badge>
// Cores: >80% verde, 50-80% amarelo, <50% vermelho

// Badge "OFICIAL" para sistemas oficiais
<Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
  🟢 OFICIAL
</Badge>
```

---

#### **3.3 TABELAS**

**Componente Base:** `ui/table.tsx`

**Estrutura:**
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Coluna 1</TableHead>
      <TableHead>Coluna 2</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Dado 1</TableCell>
      <TableCell>Dado 2</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

**Features Implementadas:**
- **Ordenação:** Clique no cabeçalho para ordenar
- **Paginação:** Componente separado abaixo da tabela
- **Hover:** Linha destacada ao passar mouse
- **Striped:** Linhas alternadas (opcional)
- **Responsividade:** Scroll horizontal em mobile

**Exemplo Completo (Tabela de Pacientes):**

```tsx
<div className="rounded-md border">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
          Nome {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
        </TableHead>
        <TableHead>CNS</TableHead>
        <TableHead>Data Nascimento</TableHead>
        <TableHead>Gênero</TableHead>
        <TableHead className="text-right">Ações</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {patients.length === 0 ? (
        <TableRow>
          <TableCell colSpan={5} className="text-center text-gray-500">
            Nenhum paciente encontrado
          </TableCell>
        </TableRow>
      ) : (
        patients.map(patient => (
          <TableRow key={patient.id} className="hover:bg-gray-50">
            <TableCell className="font-medium">{patient.name}</TableCell>
            <TableCell>{formatCNS(patient.cns)}</TableCell>
            <TableCell>{formatDate(patient.birth_date)}</TableCell>
            <TableCell>
              <Badge variant="outline">
                {patient.gender === 'M' ? '👨 Masculino' : '👩 Feminino'}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="icon" onClick={() => handleEdit(patient.id)}>
                <Edit className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(patient.id)}>
                <Trash className="w-4 h-4 text-red-600" />
              </Button>
            </TableCell>
          </TableRow>
        ))
      )}
    </TableBody>
  </Table>
</div>

{/* Paginação */}
<div className="flex items-center justify-between px-2 py-4">
  <div className="text-sm text-gray-700">
    Mostrando {startIndex + 1} a {endIndex} de {totalItems} resultados
  </div>
  <div className="flex space-x-2">
    <Button variant="outline" size="sm" onClick={prevPage} disabled={currentPage === 1}>
      <ChevronLeft className="w-4 h-4" />
      Anterior
    </Button>
    {pageNumbers.map(pageNum => (
      <Button
        key={pageNum}
        variant={currentPage === pageNum ? "default" : "outline"}
        size="sm"
        onClick={() => goToPage(pageNum)}
      >
        {pageNum}
      </Button>
    ))}
    <Button variant="outline" size="sm" onClick={nextPage} disabled={currentPage === totalPages}>
      Próximo
      <ChevronRight className="w-4 h-4" />
    </Button>
  </div>
</div>
```

---

#### **3.4 MODAIS (Dialogs)**

**Componente Base:** `ui/dialog.tsx` (Radix UI)

**Estrutura:**
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger asChild>
    <Button>Abrir Modal</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Título do Modal</DialogTitle>
      <DialogDescription>Descrição opcional</DialogDescription>
    </DialogHeader>
    
    {/* Conteúdo do Modal */}
    
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsOpen(false)}>
        Cancelar
      </Button>
      <Button onClick={handleSave}>
        Salvar
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Modais Principais do Sistema:**

##### **A) Modal de Edição de Perfil**
- **Componente:** `ProfileEditModal.tsx`
- **Trigger:** Botão "Configurações" no menu do usuário
- **Conteúdo:**
  - Campos: Nome completo, Email (readonly), Telefone
  - Botão "Alterar Senha"
  - Botão "Salvar"
- **Tamanho:** Medium (max-w-md)
- **Comportamento:** Fecha ao salvar com sucesso

##### **B) Modal de Detalhes do Procedimento**
- **Componente:** Interno em `SigtapViewer.tsx`
- **Trigger:** Clique em linha da tabela de procedimentos
- **Conteúdo:**
  - Todos os campos do procedimento SIGTAP (22 campos)
  - Botão "Copiar Informações"
  - Botão "Fechar"
- **Tamanho:** Large (max-w-2xl)
- **Scroll:** Vertical se conteúdo exceder viewport

##### **C) Modal de Revisão Manual de AIH**
- **Componente:** Interno em `AIHMultiPageTester.tsx`
- **Trigger:** Clique em AIH com status "⚠️ Revisão Manual"
- **Conteúdo:**
  - Dados do paciente
  - Dados da AIH
  - Procedimento sugerido (com score)
  - Validações (checkmarks ou alertas)
  - Botões: "✅ Aprovar", "❌ Rejeitar", "🔍 Ver Alternativas"
- **Tamanho:** Extra Large (max-w-4xl)
- **Ações:** Não fecha ao clicar fora (modal crítico)

##### **D) Modal de Confirmação de Exclusão**
- **Componente:** `AlertDialog` component
- **Trigger:** Botão de excluir em qualquer entidade
- **Conteúdo:**
  - ⚠️ Ícone de alerta
  - "Tem certeza que deseja excluir?"
  - Descrição da ação irreversível
  - Botões: "Cancelar" (outline) + "Excluir" (destructive)
- **Tamanho:** Small (max-w-sm)
- **Foco:** Botão "Cancelar" recebe foco inicial

---

#### **3.5 TOASTS E NOTIFICAÇÕES**

**Componentes:** `ui/toast.tsx` + `ui/sonner.tsx`

**Tipos de Toast:**

| Tipo | Aparência | Uso | Duração |
|------|-----------|-----|---------|
| **Success** | Verde, ✅ | Ações bem-sucedidas | 3s |
| **Error** | Vermelho, ❌ | Erros e falhas | 5s |
| **Warning** | Amarelo, ⚠️ | Avisos importantes | 4s |
| **Info** | Azul, ℹ️ | Informações gerais | 3s |
| **Loading** | Spinner | Processamento em andamento | Até dismiss |

**Exemplos de Uso:**

```typescript
// Sucesso ao salvar
toast.success('✅ Paciente salvo com sucesso!', {
  description: 'Os dados foram atualizados no sistema.'
});

// Erro ao processar
toast.error('❌ Erro ao processar AIH', {
  description: 'Não foi possível conectar ao banco de dados. Tente novamente.',
  action: {
    label: '🔄 Tentar Novamente',
    onClick: () => retry()
  }
});

// Loading com promessa
toast.promise(
  processAIHs(),
  {
    loading: '⏳ Processando AIHs...',
    success: (data) => `✅ ${data.count} AIHs processadas com sucesso!`,
    error: '❌ Erro no processamento'
  }
);

// Warning com ação
toast.warning('⚠️ Sessão expirando em 2 minutos', {
  action: {
    label: '🔄 Renovar Sessão',
    onClick: () => renewSession()
  },
  duration: 120000 // 2 minutos
});
```

**Posicionamento:** Top-right (padrão), configurável

---

### 4. COMPONENTES ESPECIALIZADOS

#### **4.1 UPLOAD DE ARQUIVOS (Drag & Drop)**

**Componente Personalizado** (usado em múltiplas telas)

**Estrutura:**
```tsx
<div
  className={cn(
    "border-2 border-dashed rounded-lg p-8",
    "transition-colors duration-200",
    isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300",
    "hover:border-gray-400 hover:bg-gray-50",
    "cursor-pointer"
  )}
  onDrop={handleDrop}
  onDragOver={handleDragOver}
  onDragEnter={handleDragEnter}
  onDragLeave={handleDragLeave}
  onClick={handleClick}
>
  <input
    ref={fileInputRef}
    type="file"
    accept=".xlsx,.xls,.pdf,.zip"
    onChange={handleFileSelect}
    className="hidden"
  />
  
  <div className="text-center">
    <Upload className="mx-auto h-12 w-12 text-gray-400" />
    <p className="mt-2 text-sm font-medium">
      📁 Arraste o arquivo aqui
    </p>
    <p className="mt-1 text-xs text-gray-500">
      ou clique para selecionar
    </p>
    <p className="mt-2 text-xs text-gray-400">
      Formatos aceitos: Excel, PDF, ZIP • Máximo 100 MB
    </p>
  </div>
</div>

{selectedFile && (
  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <FileIcon className="w-5 h-5 text-blue-600 mr-2" />
        <div>
          <p className="text-sm font-medium">{selectedFile.name}</p>
          <p className="text-xs text-gray-500">
            {formatFileSize(selectedFile.size)}
          </p>
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={handleRemoveFile}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  </div>
)}
```

**Estados:**
- **Idle:** Border cinza pontilhada
- **Hover:** Border cinza sólida, background cinza claro
- **Dragging:** Border azul, background azul claro
- **File Selected:** Mostra card com preview e botão remover
- **Error:** Border vermelho, mensagem de erro

**Validações:**
- Tipo de arquivo (MIME type real, não apenas extensão)
- Tamanho máximo (100 MB padrão)
- Nome do arquivo (caracteres especiais)

---

#### **4.2 PROGRESS BAR (Barra de Progresso)**

**Componente Base:** `ui/progress.tsx`

**Variantes:**

##### **A) Progress Simples**
```tsx
<Progress value={percentage} className="w-full" />
```

##### **B) Progress com Label**
```tsx
<div className="space-y-2">
  <div className="flex justify-between text-sm">
    <span>Processando...</span>
    <span className="font-medium">{percentage}%</span>
  </div>
  <Progress value={percentage} />
</div>
```

##### **C) Progress Multi-etapas (Stepper)**
```tsx
<div className="space-y-3">
  {steps.map((step, index) => (
    <div key={index} className="flex items-center gap-3">
      <div className={cn(
        "flex items-center justify-center w-8 h-8 rounded-full",
        step.status === 'completed' && "bg-green-500",
        step.status === 'in-progress' && "bg-blue-500",
        step.status === 'pending' && "bg-gray-300"
      )}>
        {step.status === 'completed' && <Check className="w-4 h-4 text-white" />}
        {step.status === 'in-progress' && <Loader2 className="w-4 h-4 text-white animate-spin" />}
        {step.status === 'pending' && <span className="text-xs text-gray-600">{index + 1}</span>}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{step.label}</p>
        {step.description && (
          <p className="text-xs text-gray-500">{step.description}</p>
        )}
      </div>
      {step.duration && (
        <Badge variant="outline">{step.duration}</Badge>
      )}
    </div>
  ))}
</div>
```

**Cores por Status:**
- **Completed:** Verde (bg-green-500)
- **In Progress:** Azul (bg-blue-500) + animação
- **Pending:** Cinza (bg-gray-300)
- **Error:** Vermelho (bg-red-500)

---

#### **4.3 GRÁFICOS (Charts)**

**Biblioteca:** ECharts 5.6.0  
**Wrapper:** `echarts-for-react`

**Tipos de Gráficos Usados:**

##### **A) Gráfico de Barras (Receita por Hospital)**
```tsx
<ReactECharts
  option={{
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: hospitals.map(h => h.name)
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value) => formatCurrency(value)
      }
    },
    series: [{
      name: 'Receita',
      type: 'bar',
      data: hospitals.map(h => h.revenue),
      itemStyle: {
        color: '#3b82f6'
      }
    }]
  }}
  style={{ height: '400px' }}
/>
```

##### **B) Gráfico de Linha (Tendência Temporal)**
```tsx
<ReactECharts
  option={{
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        return `${params[0].name}<br/>${params[0].marker}${formatCurrency(params[0].value)}`
      }
    },
    xAxis: {
      type: 'category',
      data: dates
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      name: 'Receita Diária',
      type: 'line',
      smooth: true,
      data: revenues,
      areaStyle: { opacity: 0.3 }
    }]
  }}
/>
```

##### **C) Gráfico de Pizza (Distribuição por Especialidade)**
```tsx
<ReactECharts
  option={{
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [{
      name: 'Especialidades',
      type: 'pie',
      radius: '50%',
      data: specialties.map(s => ({
        name: s.name,
        value: s.count
      })),
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  }}
/>
```

**Interatividade:**
- **Hover:** Tooltip com detalhes
- **Click:** Drill-down (quando aplicável)
- **Zoom:** Scroll para zoom (gráficos temporais)
- **Export:** Botão para baixar como imagem

---

#### **4.4 DATE PICKERS (Seletores de Data)**

**Componente:** Baseado em `react-day-picker` + `date-fns`

**Variantes:**

##### **A) Single Date Picker**
```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" className="w-[240px] justify-start">
      <Calendar className="mr-2 h-4 w-4" />
      {date ? format(date, "PPP", { locale: ptBR }) : "Selecionar data"}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0">
    <DayPicker
      mode="single"
      selected={date}
      onSelect={setDate}
      initialFocus
    />
  </PopoverContent>
</Popover>
```

##### **B) Date Range Picker**
```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" className="w-[300px] justify-start">
      <Calendar className="mr-2 h-4 w-4" />
      {dateRange?.from ? (
        dateRange.to ? (
          <>
            {format(dateRange.from, "PPP")} - {format(dateRange.to, "PPP")}
          </>
        ) : (
          format(dateRange.from, "PPP")
        )
      ) : (
        "Selecionar período"
      )}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0" align="start">
    <DayPicker
      mode="range"
      selected={dateRange}
      onSelect={setDateRange}
      numberOfMonths={2}
      initialFocus
    />
  </PopoverContent>
</Popover>
```

**Presets Rápidos:**
- Hoje
- Ontem
- Últimos 7 dias
- Últimos 30 dias
- Este mês
- Mês passado
- Personalizado

---

### 5. ÍCONES E ELEMENTOS VISUAIS

**Biblioteca:** `lucide-react` (v0.462.0)

**Ícones Principais por Categoria:**

#### **Navegação e Ações:**
```tsx
Home            // Dashboard
FileUp          // Upload
Search          // Busca
Eye             // Visualizar
Edit            // Editar
Trash           // Excluir
Download        // Baixar
Upload          // Enviar
Plus            // Adicionar
X               // Fechar
Check           // Confirmar
ChevronLeft/Right/Up/Down  // Navegação
```

#### **Usuários e Permissões:**
```tsx
User            // Usuário genérico
Users           // Múltiplos usuários
Crown           // Admin/Diretor
Shield          // Proteção/Segurança
Eye             // Auditor
Code            // Developer/TI
Building2       // Hospital
Globe           // Acesso global
```

#### **Status e Feedback:**
```tsx
CheckCircle     // Sucesso
AlertTriangle   // Aviso
XCircle         // Erro
Info            // Informação
Loader2         // Loading (com spin)
Clock           // Tempo/Pendente
TrendingUp/Down // Crescimento/Queda
```

#### **Dados e Analytics:**
```tsx
BarChart4       // Gráficos
PieChart        // Pizza
Activity        // Atividade
TrendingUp      // Crescimento
DollarSign      // Financeiro
FileText        // Documentos
```

#### **Médico/Saúde:**
```tsx
Stethoscope     // Médico
Hospital        // Hospital
Heart           // Saúde
Pill            // Medicamento
Syringe         // Procedimento
```

**Tamanhos Padrão:**
- **Small:** `w-3 h-3` (12px) - Badges, textos inline
- **Normal:** `w-4 h-4` (16px) - Botões, menus
- **Medium:** `w-5 h-5` (20px) - Cards, headers
- **Large:** `w-6 h-6` (24px) - Ícones de destaque
- **Extra Large:** `w-8 h-8` (32px) - Loading states, empty states

---

### 6. ANIMAÇÕES E TRANSIÇÕES

**Biblioteca:** Framer Motion + TailwindCSS

**Animações Padrão:**

```tsx
// Fade In
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.3 }}
>
  Conteúdo
</motion.div>

// Slide Up
<motion.div
  initial={{ y: 20, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  transition={{ duration: 0.4 }}
>
  Conteúdo
</motion.div>

// Scale on Hover (CSS)
<div className="transition-transform hover:scale-105 duration-200">
  Card
</div>

// Skeleton Loading
<div className="animate-pulse space-y-4">
  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
</div>

// Spinner
<Loader2 className="w-4 h-4 animate-spin" />
```

**Timing:**
- **Fast:** 200ms - Hover, estados simples
- **Normal:** 300-400ms - Transições padrão, modais
- **Slow:** 500-600ms - Carregamento de páginas, transições complexas

---

## 📊 RESUMO ESTATÍSTICO

### Componentes por Categoria:

| Categoria | Quantidade | Complexidade |
|-----------|------------|--------------|
| **Formulários** | 15+ tipos | Média |
| **Visualização** | 20+ componentes | Alta |
| **Navegação** | 10+ elementos | Média |
| **Feedback** | 8+ tipos | Baixa |
| **Especializados** | 12+ componentes | Alta |
| **Ícones** | 50+ variações | Baixa |

### Interatividade:

- **Componentes Clicáveis:** 100+
- **Componentes com Hover:** 80+
- **Componentes com Animação:** 50+
- **Componentes Responsivos:** 100% (todos)

### Acessibilidade:

- **ARIA Labels:** ✅ Implementado
- **Keyboard Navigation:** ✅ Suportado
- **Screen Reader Support:** ⚠️ Parcial (em melhoria)
- **Contraste de Cores:** ✅ WCAG AA compliant

---

## 🎯 BOAS PRÁTICAS IDENTIFICADAS

1. **Consistência:** Todos os componentes seguem design system unificado
2. **Reutilização:** Componentes base (`ui/`) usados em todo o sistema
3. **Feedback Visual:** Sempre há indicação de estado (loading, success, error)
4. **Acessibilidade:** Componentes Radix UI com ARIA embutido
5. **Performance:** Lazy loading, memoization, otimização de renders
6. **Responsividade:** Mobile-first approach, breakpoints consistentes
7. **Tipagem:** TypeScript para type safety em todos os componentes

---

**© 2025 SIGTAP Sync - Catálogo de Componentes Interativos**  
*Versão 1.0 - Completo e Validado*

