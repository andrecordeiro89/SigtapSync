import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import ReactECharts from 'echarts-for-react'
import { supabaseSih } from '../lib/sihSupabase'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown, Loader2, Activity, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatNumber, formatSigtapCode } from '../utils/formatters'
import { SigtapService } from '../services/supabaseService'

type AmbulatoryMode = 'APAC' | 'BPA' | 'Todos'

type Option = {
  value: string
  label: string
}

type SiaAggRow = {
  cnes: string
  competencia: string
  procedimento: string
  qtd_apresentada: number | null
  qtd_aprovada: number | null
  valor_apresentado: number | null
  valor_aprovado: number | null
}

type HospitalAgg = {
  cnes: string
  hospitalName: string
  qtdApresentada: number
  qtdAprovada: number
  valorApresentado: number
  valorAprovado: number
}

type ProcedureAgg = {
  procedimento: string
  procedimentoNome: string
  qtdApresentada: number
  qtdAprovada: number
  valorApresentado: number
  valorAprovado: number
}

const TABLE_NAME = 'sia_pa_agg_cnes_competencia'

const toNumber = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const sum = (arr: number[]): number => arr.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0)

const normalizeCnes = (raw: unknown): string => {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.padStart(7, '0')
}

const expandCnesForRemoteFilter = (cnesList: string[]): string[] => {
  const out = new Set<string>()
  ;(cnesList || []).forEach((c) => {
    const digits = String(c ?? '').replace(/\D/g, '')
    if (!digits) return
    const padded = digits.padStart(7, '0')
    const unpadded = padded.replace(/^0+/, '')
    if (unpadded) out.add(unpadded)
    out.add(padded)
  })
  return Array.from(out)
}

const normalizeCompetenciaMonth = (raw: unknown): string => {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const iso = s.match(/^(\d{4})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}`
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2]}`
  const digits = s.replace(/\D/g, '')
  if (digits.length >= 6) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`
  return ''
}

const nextCompetenciaCursorISO = (monthKey: string): string => {
  const m = String(monthKey || '').match(/^(\d{4})-(\d{2})$/)
  if (!m) return ''
  const y = Number(m[1])
  const mo = Number(m[2])
  if (!y || !mo) return ''
  const next = new Date(Date.UTC(y, mo, 1))
  return next.toISOString().slice(0, 10)
}

const formatCompetenciaLabel = (raw: string): string => {
  const s = String(raw || '').trim()
  if (!s) return ''
  const m1 = s.match(/^(\d{4})-(\d{2})/)
  if (m1) return `${m1[2]}/${m1[1]}`
  const digits = s.replace(/\D/g, '')
  if (digits.length >= 6) {
    const y = digits.slice(0, 4)
    const mo = digits.slice(4, 6)
    if (y && mo) return `${mo}/${y}`
  }
  return s
}

function MultiSelect({
  label,
  placeholder,
  options,
  values,
  onChange,
}: {
  label: string
  placeholder: string
  options: Option[]
  values: string[]
  onChange: (next: string[]) => void
}) {
  const selectedSet = useMemo(() => new Set(values), [values])
  const selectedLabels = useMemo(() => {
    const map = new Map(options.map(o => [o.value, o.label]))
    return values.map(v => map.get(v) || v).filter(Boolean)
  }, [options, values])

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-gray-700">{label}</div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn('w-full justify-between bg-white', values.length === 0 && 'text-gray-500')}
          >
            <span className="truncate">
              {values.length === 0 ? placeholder : selectedLabels.join(', ')}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar..." />
            <CommandList>
              <CommandEmpty>Nenhum resultado.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => onChange([])}
                  className="cursor-pointer"
                >
                  <span className="text-sm">Limpar seleção</span>
                </CommandItem>
              </CommandGroup>
              <CommandGroup>
                {options.map((opt) => {
                  const isSelected = selectedSet.has(opt.value)
                  return (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      onSelect={() => {
                        const next = new Set(values)
                        if (isSelected) next.delete(opt.value)
                        else next.add(opt.value)
                        onChange(Array.from(next))
                      }}
                      className="cursor-pointer"
                    >
                      <Check className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                      <span className="text-sm">{opt.label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedLabels.slice(0, 6).map((t) => (
            <Badge key={t} variant="outline" className="text-[11px] bg-white text-black border-gray-300">
              {t}
            </Badge>
          ))}
          {selectedLabels.length > 6 && (
            <Badge variant="outline" className="text-[11px] bg-white text-black border-gray-300">
              +{selectedLabels.length - 6}
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

export default function AmbulatoryDashboard() {
  const [mode, setMode] = useState<AmbulatoryMode | null>(null)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [loadingResults, setLoadingResults] = useState(false)

  const [hospitalOptions, setHospitalOptions] = useState<Option[]>([])
  const [competenciaOptions, setCompetenciaOptions] = useState<Option[]>([])
  const [selectedCnes, setSelectedCnes] = useState<string[]>([])
  const [selectedCompetencias, setSelectedCompetencias] = useState<string[]>([])

  const [hospitalMap, setHospitalMap] = useState<Map<string, string>>(new Map())
  const [remoteCounts, setRemoteCounts] = useState<{ cnes: number; competencias: number }>({ cnes: 0, competencias: 0 })

  const [byHospital, setByHospital] = useState<HospitalAgg[]>([])
  const [byProcedure, setByProcedure] = useState<ProcedureAgg[]>([])

  const procedureSummary = useMemo(() => {
    const totalPresented = sum(byProcedure.map(p => p.valorApresentado))
    const totalApproved = sum(byProcedure.map(p => p.valorAprovado))
    const totalNotApproved = Math.max(0, totalPresented - totalApproved)
    const notApproved = byProcedure
      .filter(p => (p.valorApresentado > 0 || p.qtdApresentada > 0) && (p.valorAprovado === 0 || p.qtdAprovada === 0))
      .sort((a, b) => b.valorApresentado - a.valorApresentado)
    const notApprovedValue = sum(notApproved.map(p => p.valorApresentado))
    return {
      totalPresented,
      totalApproved,
      totalNotApproved,
      notApprovedCount: notApproved.length,
      notApprovedValue,
      notApprovedTop: notApproved.slice(0, 10),
      notApprovedRestCount: Math.max(0, notApproved.length - 10),
    }
  }, [byProcedure])

  useEffect(() => {
    let cancelled = false
    const loadHospitalMap = async () => {
      try {
        const { data, error } = await supabase
          .from('hospitals')
          .select('name,cnes')
          .eq('is_active', true)
          .order('name')
        if (error) throw error
        const m = new Map<string, string>()
        ;(data || []).forEach((h: any) => {
          const cnes = normalizeCnes(h?.cnes)
          const name = String(h?.name || '').trim()
          if (cnes && name) m.set(cnes, name)
        })
        if (!cancelled) setHospitalMap(m)
      } catch {
        if (!cancelled) setHospitalMap(new Map())
      }
    }
    loadHospitalMap()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    setSelectedCnes([])
    setSelectedCompetencias([])
    setByHospital([])
    setByProcedure([])
  }, [mode])

  useEffect(() => {
    setSelectedCompetencias([])
  }, [selectedCnes.join('|')])

  useEffect(() => {
    if (!mode) return
    if (!supabaseSih) return
    let cancelled = false

    const loadOptions = async () => {
      setLoadingOptions(true)
      try {
        const baseCnesScope = selectedCnes.map(normalizeCnes).filter(Boolean)
        const baseAllHospitals = Array.from(hospitalMap.keys()).map(normalizeCnes).filter(Boolean)
        const baseFilter = baseCnesScope.length > 0 ? baseCnesScope : baseAllHospitals
        const cnesFilter = expandCnesForRemoteFilter(baseFilter)

        const buildCompetenciaFirstRowQuery = (withType: boolean, cursorISO?: string) => {
          let q = supabaseSih
            .from(TABLE_NAME)
            .select('competencia')
            .order('competencia', { ascending: true })
            .limit(1)
            .in('cnes', cnesFilter)
          if (cursorISO) {
            q = (q as any).gte('competencia', cursorISO)
          }
          if (withType && mode !== 'Todos') {
            q = (q as any).eq('tipo', mode)
          }
          return q
        }

        const monthSet = new Set<string>()
        let cursorISO: string | undefined = undefined
        for (let i = 0; i < 240; i++) {
          let data: any[] | null = null
          let error: any = null

          ;({ data, error } = await buildCompetenciaFirstRowQuery(true, cursorISO))
          if (error) {
            const msg = String(error?.message || '')
            if (mode !== 'Todos' && msg.toLowerCase().includes('column') && msg.toLowerCase().includes('tipo')) {
              ;({ data, error } = await buildCompetenciaFirstRowQuery(false, cursorISO))
              if (!error && !cursorISO) {
                toast.error('Tabela SIH sem coluna "tipo"; filtro APAC/BPA não aplicado')
              }
            }
          }
          if (error) throw error

          const row = (data || [])[0]
          if (!row) break

          const monthKey = normalizeCompetenciaMonth(row?.competencia)
          if (!monthKey) break
          monthSet.add(monthKey)

          const nextISO = nextCompetenciaCursorISO(monthKey)
          if (!nextISO) break
          cursorISO = nextISO
        }

        const hospitals = Array.from(hospitalMap.keys())
          .map((cnes) => normalizeCnes(cnes))
          .filter(Boolean)
          .sort((a, b) => (hospitalMap.get(a) || a).localeCompare((hospitalMap.get(b) || b), 'pt-BR'))
          .map((cnes) => ({
            value: cnes,
            label: hospitalMap.get(cnes) || cnes
          }))

        const competencias = Array.from(monthSet)
          .sort((a, b) => a.localeCompare(b))
          .map((comp) => ({
            value: comp,
            label: formatCompetenciaLabel(comp)
          }))

        if (!cancelled) {
          setHospitalOptions(hospitals)
          setCompetenciaOptions(competencias)
          setRemoteCounts({ cnes: baseFilter.length, competencias: monthSet.size })
        }
      } catch (e: any) {
        if (!cancelled) {
          setHospitalOptions([])
          setCompetenciaOptions([])
          setRemoteCounts({ cnes: 0, competencias: 0 })
        }
        toast.error('Erro ao carregar opções do SIH')
      } finally {
        if (!cancelled) setLoadingOptions(false)
      }
    }

    loadOptions()
    return () => { cancelled = true }
  }, [mode, hospitalMap, selectedCnes.join('|')])

  const canConfirm = mode != null && selectedCnes.length > 0 && selectedCompetencias.length > 0

  const selectedHospitalsLabel = useMemo(() => {
    if (selectedCnes.length === 0) return ''
    return selectedCnes
      .map(c => hospitalMap.get(c) || c)
      .join(', ')
  }, [hospitalMap, selectedCnes])

  const selectedCompetenciasLabel = useMemo(() => {
    if (selectedCompetencias.length === 0) return ''
    return selectedCompetencias
      .map(c => formatCompetenciaLabel(c))
      .join(', ')
  }, [selectedCompetencias])

  const handleConfirm = async () => {
    if (!supabaseSih) {
      toast.error('Fonte SIH remota não configurada')
      return
    }
    if (!canConfirm || !mode) return

    setLoadingResults(true)
    try {
      const cnesBase = selectedCnes.map(normalizeCnes).filter(Boolean)
      const cnesFilter = expandCnesForRemoteFilter(cnesBase)
      const competenciaFilter = selectedCompetencias
        .map(v => normalizeCompetenciaMonth(v))
        .filter(Boolean)
        .map(m => `${m}-01`)

      const buildQuery = (withType: boolean) => {
        let q = supabaseSih
          .from(TABLE_NAME)
          .select('cnes,competencia,procedimento,qtd_apresentada,qtd_aprovada,valor_apresentado,valor_aprovado')
          .in('cnes', cnesFilter)
          .in('competencia', competenciaFilter)
          .limit(100000)
        if (withType && mode !== 'Todos') {
          q = (q as any).eq('tipo', mode)
        }
        return q
      }

      let data: any[] | null = null
      let error: any = null

      ;({ data, error } = await buildQuery(true))
      if (error) {
        const msg = String(error?.message || '')
        if (mode !== 'Todos' && msg.toLowerCase().includes('column') && msg.toLowerCase().includes('tipo')) {
          ;({ data, error } = await buildQuery(false))
        }
      }
      if (error) throw error

      const rows: SiaAggRow[] = (data || []).map((r: any) => ({
        cnes: normalizeCnes(r?.cnes),
        competencia: String(r?.competencia || '').trim(),
        procedimento: String(r?.procedimento || '').trim(),
        qtd_apresentada: r?.qtd_apresentada ?? null,
        qtd_aprovada: r?.qtd_aprovada ?? null,
        valor_apresentado: r?.valor_apresentado ?? null,
        valor_aprovado: r?.valor_aprovado ?? null,
      })).filter(r => r.cnes && r.competencia && r.procedimento)

      const byHospMap = new Map<string, HospitalAgg>()
      const byProcMap = new Map<string, Omit<ProcedureAgg, 'procedimentoNome'>>()

      rows.forEach(r => {
        const qtdAp = toNumber(r.qtd_apresentada)
        const qtdOk = toNumber(r.qtd_aprovada)
        const valAp = toNumber(r.valor_apresentado)
        const valOk = toNumber(r.valor_aprovado)

        const hosp = byHospMap.get(r.cnes) || {
          cnes: r.cnes,
          hospitalName: hospitalMap.get(r.cnes) || r.cnes,
          qtdApresentada: 0,
          qtdAprovada: 0,
          valorApresentado: 0,
          valorAprovado: 0,
        }
        hosp.qtdApresentada += qtdAp
        hosp.qtdAprovada += qtdOk
        hosp.valorApresentado += valAp
        hosp.valorAprovado += valOk
        byHospMap.set(r.cnes, hosp)

        const proc = byProcMap.get(r.procedimento) || {
          procedimento: r.procedimento,
          qtdApresentada: 0,
          qtdAprovada: 0,
          valorApresentado: 0,
          valorAprovado: 0,
        }
        proc.qtdApresentada += qtdAp
        proc.qtdAprovada += qtdOk
        proc.valorApresentado += valAp
        proc.valorAprovado += valOk
        byProcMap.set(r.procedimento, proc)
      })

      const activeVersion = await SigtapService.getActiveVersion()
      const procNameMap = new Map<string, string>()
      if (activeVersion) {
        const codes = Array.from(byProcMap.keys())
        const expandedCodes = Array.from(new Set(codes.flatMap(c => {
          const formatted = formatSigtapCode(c)
          return formatted && formatted !== c ? [c, formatted] : [c]
        })))

        const batchSize = 200
        for (let i = 0; i < expandedCodes.length; i += batchSize) {
          const batch = expandedCodes.slice(i, i + batchSize)
          const { data: procs, error: procsError } = await supabase
            .from('sigtap_procedures')
            .select('code,description')
            .eq('version_id', activeVersion.id)
            .in('code', batch)
          if (procsError) throw procsError
          ;(procs || []).forEach((p: any) => {
            const code = String(p?.code || '').trim()
            const desc = String(p?.description || '').trim()
            if (code && desc) procNameMap.set(code, desc)
          })
        }
      }

      const hospRows = Array.from(byHospMap.values())
        .sort((a, b) => a.hospitalName.localeCompare(b.hospitalName, 'pt-BR'))

      const procRows = Array.from(byProcMap.values())
        .map((p) => {
          const formatted = formatSigtapCode(p.procedimento)
          const name = procNameMap.get(p.procedimento) || (formatted ? procNameMap.get(formatted) : '') || ''
          return {
            ...p,
            procedimentoNome: name || 'Nome não encontrado'
          }
        })
        .sort((a, b) => (b.valorAprovado - a.valorAprovado) || a.procedimento.localeCompare(b.procedimento))

      setByHospital(hospRows)
      setByProcedure(procRows)
    } catch (e: any) {
      toast.error('Erro ao carregar dados do ambulatório')
      setByHospital([])
      setByProcedure([])
    } finally {
      setLoadingResults(false)
    }
  }

  const qtyChartOption = useMemo(() => {
    const labels = byHospital.map(h => h.hospitalName)
    const approved = byHospital.map(h => h.qtdAprovada)
    const notApproved = byHospital.map(h => Math.max(0, h.qtdApresentada - h.qtdAprovada))
    const totalsPresented = byHospital.map(h => h.qtdApresentada)

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const a = Array.isArray(params) ? params : []
          const name = a[0]?.axisValueLabel || a[0]?.name || ''
          const approvedV = Number(a.find((x: any) => x.seriesName === 'Qtd aprovada')?.value ?? 0) || 0
          const notApprovedV = Number(a.find((x: any) => x.seriesName === 'Qtd não aprovada')?.value ?? 0) || 0
          const total = approvedV + notApprovedV
          const pct = total > 0 ? (approvedV / total) * 100 : 0
          return [
            `<div style="font-weight:600;margin-bottom:4px">${name}</div>`,
            `Qtd apresentada: <b>${formatNumber(total)}</b>`,
            `Qtd aprovada: <b>${formatNumber(approvedV)}</b>`,
            `Qtd não aprovada: <b>${formatNumber(notApprovedV)}</b>`,
            `Aprovação: <b>${pct.toFixed(1)}%</b>`
          ].join('<br/>')
        }
      },
      legend: { data: ['Qtd aprovada', 'Qtd não aprovada'] },
      grid: { left: 36, right: 24, top: 56, bottom: 90 },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { rotate: labels.length > 6 ? 35 : 0, interval: 0 }
      },
      yAxis: { type: 'value' },
      series: [
        { name: 'Qtd aprovada', type: 'bar', data: approved, stack: 'total', itemStyle: { color: '#10b981' } },
        { name: 'Qtd não aprovada', type: 'bar', data: notApproved, stack: 'total', itemStyle: { color: '#ef4444' } },
      ]
    }
  }, [byHospital])

  const valueChartOption = useMemo(() => {
    const labels = byHospital.map(h => h.hospitalName)
    const approved = byHospital.map(h => h.valorAprovado)
    const notApproved = byHospital.map(h => Math.max(0, h.valorApresentado - h.valorAprovado))

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const a = Array.isArray(params) ? params : []
          const name = a[0]?.axisValueLabel || a[0]?.name || ''
          const approvedV = Number(a.find((x: any) => x.seriesName === 'Valor aprovado')?.value ?? 0) || 0
          const notApprovedV = Number(a.find((x: any) => x.seriesName === 'Valor não aprovado')?.value ?? 0) || 0
          const total = approvedV + notApprovedV
          const pct = total > 0 ? (approvedV / total) * 100 : 0
          return [
            `<div style="font-weight:600;margin-bottom:4px">${name}</div>`,
            `Valor apresentado: <b>${formatCurrency(total)}</b>`,
            `Valor aprovado: <b>${formatCurrency(approvedV)}</b>`,
            `Valor não aprovado: <b>${formatCurrency(notApprovedV)}</b>`,
            `Aprovação: <b>${pct.toFixed(1)}%</b>`
          ].join('<br/>')
        }
      },
      legend: { data: ['Valor aprovado', 'Valor não aprovado'] },
      grid: { left: 36, right: 24, top: 56, bottom: 90 },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { rotate: labels.length > 6 ? 35 : 0, interval: 0 }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v: any) => {
            const n = Number(v) || 0
            return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}k` : `${n}`
          }
        }
      },
      series: [
        { name: 'Valor aprovado', type: 'bar', data: approved, stack: 'total', itemStyle: { color: '#2563eb' } },
        { name: 'Valor não aprovado', type: 'bar', data: notApproved, stack: 'total', itemStyle: { color: '#ef4444' } },
      ]
    }
  }, [byHospital])

  if (!supabaseSih) {
    return (
      <Card className="border border-gray-200 bg-white">
        <CardHeader>
          <CardTitle className="text-black flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            SIH remoto não configurado
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700">
          Configure VITE_SIH_SUPABASE_URL e VITE_SIH_SUPABASE_ANON_KEY para habilitar esta aba.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border border-gray-200 bg-white">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl">
                <Activity className="h-6 w-6 text-black" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-black">Ambulatório</h3>
                <p className="text-sm text-neutral-700 mt-1">Produção ambulatorial (SIH remoto)</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['APAC', 'BPA', 'Todos'] as AmbulatoryMode[]).map((m) => (
              <Button
                key={m}
                variant={mode === m ? 'default' : 'outline'}
                className={cn(
                  mode === m ? 'bg-black text-white hover:bg-gray-900' : 'bg-white text-black border-gray-300 hover:bg-neutral-100'
                )}
                onClick={() => setMode(m)}
                type="button"
              >
                {m}
              </Button>
            ))}
          </div>

          {mode && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MultiSelect
                  label="Hospital"
                  placeholder={loadingOptions ? 'Carregando...' : 'Selecione um ou mais hospitais'}
                  options={hospitalOptions}
                  values={selectedCnes}
                  onChange={setSelectedCnes}
                />
                <MultiSelect
                  label="Competência"
                  placeholder={loadingOptions ? 'Carregando...' : 'Selecione uma ou mais competências'}
                  options={competenciaOptions}
                  values={selectedCompetencias}
                  onChange={setSelectedCompetencias}
                />
              </div>
              <div className="text-[11px] text-gray-600">
                Hospitais locais: {hospitalMap.size} · CNES no SIH: {remoteCounts.cnes} · Opções: {hospitalOptions.length} · Competências no SIH: {remoteCounts.competencias}
              </div>
            </div>
          )}

          {mode && canConfirm && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="text-xs text-gray-600">
                <span className="font-semibold text-gray-800">Hospitais:</span> {selectedHospitalsLabel || '—'}
                <span className="mx-2">·</span>
                <span className="font-semibold text-gray-800">Competências:</span> {selectedCompetenciasLabel || '—'}
              </div>
              <Button
                onClick={handleConfirm}
                disabled={loadingResults}
                className="bg-black text-white hover:bg-gray-900"
                type="button"
              >
                {loadingResults ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {loadingResults && (
        <Card className="border border-gray-200 bg-white">
          <CardContent className="p-8 flex items-center justify-center gap-2 text-sm text-gray-700">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando dados do SIH...
          </CardContent>
        </Card>
      )}

      {!loadingResults && byHospital.length > 0 && (
        <div className="space-y-6">
          <Card className="border border-gray-200 bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-black text-lg">Procedimentos</CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                <span>Totais agregados por procedimento (procedimento → SIGTAP).</span>
                <span className="mx-1">·</span>
                <span className="font-semibold text-gray-800">Valor apresentado:</span>
                <span>{formatCurrency(procedureSummary.totalPresented)}</span>
                <span className="mx-1">·</span>
                <span className="font-semibold text-gray-800">Valor aprovado:</span>
                <span>{formatCurrency(procedureSummary.totalApproved)}</span>
                <span className="mx-1">·</span>
                <span className="font-semibold text-gray-800">Não aprovado:</span>
                <span>{formatCurrency(procedureSummary.totalNotApproved)}</span>
              </div>
              {procedureSummary.notApprovedCount > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-gray-700">
                    <span className="font-semibold">Procedimentos não aprovados:</span> {procedureSummary.notApprovedCount} ·{' '}
                    <span className="font-semibold">Valor:</span> {formatCurrency(procedureSummary.notApprovedValue)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {procedureSummary.notApprovedTop.map((p) => (
                      <Badge key={p.procedimento} variant="outline" className="text-[11px] bg-white text-black border-gray-300">
                        {p.procedimento} · {formatCurrency(p.valorApresentado)}
                      </Badge>
                    ))}
                    {procedureSummary.notApprovedRestCount > 0 && (
                      <Badge variant="outline" className="text-[11px] bg-white text-black border-gray-300">
                        +{procedureSummary.notApprovedRestCount}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-auto border border-gray-200 rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Procedimento</TableHead>
                      <TableHead className="min-w-[420px]">Descrição</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Qtd Apresentada</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Qtd Aprovada</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Valor Apresentado</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Valor Aprovado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byProcedure.map((p) => (
                      <TableRow key={p.procedimento}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{p.procedimento}</TableCell>
                        <TableCell className="text-sm">{p.procedimentoNome}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatNumber(p.qtdApresentada)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatNumber(p.qtdAprovada)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatCurrency(p.valorApresentado)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatCurrency(p.valorAprovado)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-black text-lg">Quantidades por hospital</CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                {selectedHospitalsLabel && (
                  <>
                    <span className="font-semibold text-gray-800">Hospitais:</span> {selectedHospitalsLabel}
                    <span className="mx-1">·</span>
                  </>
                )}
                {selectedCompetenciasLabel && (
                  <>
                    <span className="font-semibold text-gray-800">Competências:</span> {selectedCompetenciasLabel}
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ReactECharts option={qtyChartOption as any} style={{ height: 420 }} />
            </CardContent>
          </Card>

          <Card className="border border-gray-200 bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-black text-lg">Valores por hospital</CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                {selectedHospitalsLabel && (
                  <>
                    <span className="font-semibold text-gray-800">Hospitais:</span> {selectedHospitalsLabel}
                    <span className="mx-1">·</span>
                  </>
                )}
                {selectedCompetenciasLabel && (
                  <>
                    <span className="font-semibold text-gray-800">Competências:</span> {selectedCompetenciasLabel}
                  </>
                )}
                <span className="mx-1">·</span>
                <span className="font-semibold text-gray-800">Valor não aprovado (procedimentos):</span>
                <span>{formatCurrency(procedureSummary.totalNotApproved)}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ReactECharts option={valueChartOption as any} style={{ height: 420 }} />
            </CardContent>
          </Card>
        </div>
      )}

      {!loadingResults && mode && canConfirm && byHospital.length === 0 && (
        <Card className="border border-gray-200 bg-white">
          <CardContent className="p-8 text-sm text-gray-700">
            Nenhum dado encontrado para os filtros selecionados.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
