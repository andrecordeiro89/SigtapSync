import React, { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Card, CardContent, CardHeader } from './ui/card'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Input } from './ui/input'
import { Building, Calendar, FileSpreadsheet, Loader2, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { DoctorsCrudService } from '../services/doctorsCrudService'
import { SihTabwinReportService } from '../services/sihTabwinReportService'

type HospitalOption = { id: string; name: string; cnes?: string }
type DoctorOption = { cns: string; name: string; specialty: string }

export type TabwinConferenceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const formatDateRangeLabel = (from?: string, to?: string) => {
  const f = from ? from.split('-').reverse().join('/') : '—'
  const t = to ? to.split('-').reverse().join('/') : '—'
  return `${f} — ${t}`
}

const endOfMonthISO = (isoDate: string): string => {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  const year = Number(m[1])
  const month = Number(m[2])
  if (!year || !month) return ''
  const end = new Date(year, month, 0)
  const y = end.getFullYear()
  const mm = String(end.getMonth() + 1).padStart(2, '0')
  const dd = String(end.getDate()).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

export default function TabwinConferenceDialog({ open, onOpenChange }: TabwinConferenceDialogProps) {
  const [hospitals, setHospitals] = useState<HospitalOption[]>([])
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [selectedHospital, setSelectedHospital] = useState<string>('all')
  const [selectedDoctor, setSelectedDoctor] = useState<string>('all')
  const [dischargeFrom, setDischargeFrom] = useState<string>('')
  const [dischargeTo, setDischargeTo] = useState<string>('')
  const [inputDischargeFrom, setInputDischargeFrom] = useState<string>('')
  const [inputDischargeTo, setInputDischargeTo] = useState<string>('')
  const [loadingHospitals, setLoadingHospitals] = useState(false)
  const [loadingDoctors, setLoadingDoctors] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const loadHospitals = async () => {
      setLoadingHospitals(true)
      try {
        const { data, error } = await supabase
          .from('hospitals')
          .select('id,name,cnes')
          .eq('is_active', true)
          .order('name')
        if (error) throw error
        if (!cancelled) setHospitals((data || []).map((h: any) => ({ id: h.id, name: h.name, cnes: h.cnes })))
      } catch (e: any) {
        toast.error('Erro ao carregar hospitais')
      } finally {
        if (!cancelled) setLoadingHospitals(false)
      }
    }
    loadHospitals()
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (!open) return
    setInputDischargeFrom(dischargeFrom || '')
    setInputDischargeTo(dischargeTo || '')
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const loadDoctors = async () => {
      setLoadingDoctors(true)
      try {
        const hospitalIds = selectedHospital !== 'all' ? [selectedHospital] : undefined
        const res = await DoctorsCrudService.getAllDoctors({ hospitalIds, isActive: true } as any)
        if (!res.success) throw new Error(res.error || 'Erro ao carregar médicos')
        const opts: DoctorOption[] = (res.data || [])
          .map((d: any) => ({
            cns: String(d.cns || ''),
            name: String(d.name || ''),
            specialty: String(d.speciality || d.specialty || '').trim()
          }))
          .filter(d => d.cns && d.name)
          .sort((a, b) => a.name.localeCompare(b.name))
        if (!cancelled) setDoctors(opts)
      } catch (e: any) {
        toast.error('Erro ao carregar médicos')
        if (!cancelled) setDoctors([])
      } finally {
        if (!cancelled) setLoadingDoctors(false)
      }
    }
    loadDoctors()
    return () => { cancelled = true }
  }, [open, selectedHospital])

  useEffect(() => {
    if (selectedDoctor !== 'all' && selectedHospital !== 'all') return
    if (selectedDoctor === 'all') return
    const exists = doctors.some(d => d.cns === selectedDoctor)
    if (!exists) setSelectedDoctor('all')
  }, [doctors, selectedDoctor, selectedHospital])

  const hospitalLabel = useMemo(() => {
    if (selectedHospital === 'all') return 'Todos os hospitais'
    return hospitals.find(h => h.id === selectedHospital)?.name || 'Hospital'
  }, [hospitals, selectedHospital])

  const doctorLabel = useMemo(() => {
    if (selectedDoctor === 'all') return 'Todos os médicos'
    return doctors.find(d => d.cns === selectedDoctor)?.name || 'Médico'
  }, [doctors, selectedDoctor])

  const buildTable = async () => {
    const report = await SihTabwinReportService.fetchReport({
      hospitalId: selectedHospital,
      dischargeFrom: dischargeFrom || undefined,
      dischargeTo: dischargeTo || undefined,
      doctorCns: selectedDoctor
    })
    const rows = report.rows

    if (rows.length === 0) {
      if (selectedDoctor !== 'all') {
        toast.error(`Nenhum dado encontrado. RD(SIH): ${report.stats.aihsRd} | com SP: ${report.stats.aihsWithSp}`)
        if (report.stats.aihsRd > 0 && report.stats.aihsWithSp === 0) {
          toast.warning('Possível causa: SIH_SP não tem vínculo de médico (SP_PF_DOC) para essas AIHs')
        } else if (report.stats.aihsRd > 0 && report.stats.aihsWithSp > 0) {
          toast.warning('Possível causa: CNS selecionado não casa com SP_PF_DOC ou vínculo está incompleto')
        }
      } else {
        toast.error('Nenhum dado encontrado para os filtros selecionados')
      }
      return null
    }

    if (selectedDoctor !== 'all' && report.stats.aihsRd > 0) {
      const matched = rows.length
      const total = report.stats.aihsRd
      if (matched < total) {
        toast.warning(`No SIH, ${matched}/${total} AIH(s) casaram com o médico selecionado`)
      }
    }

    const missingHospitalName = rows.filter(r => !String(r.hospitalName || '').trim()).length
    if (missingHospitalName > 0) {
      toast.warning(`Atenção: ${missingHospitalName} AIH(s) sem hospital identificado`)
    }

    const totalAIHs = rows.length
    const includeHospital = selectedHospital === 'all'
    const includeDoctor = selectedDoctor === 'all'

    const headers = [
      'Nº AIH',
      'Internação / Alta',
      'Competência',
      ...(includeHospital ? ['Hospital'] : []),
      ...(includeDoctor ? ['Médico'] : [])
    ]

    const body = rows.map(r => ([
      r.aihNumber,
      `${r.dtInter || ''} → ${r.dtSaida || ''}`,
      r.competencia || '',
      ...(includeHospital ? [r.hospitalName || ''] : []),
      ...(includeDoctor ? [r.doctorName || ''] : [])
    ]))

    return { headers, body, totalAIHs, stats: report.stats }
  }

  const handleGeneratePdf = async () => {
    try {
      setGenerating(true)
      const table = await buildTable()
      if (!table) return

      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      doc.setFontSize(14)
      doc.text('Conferência Tabwin (SIH)', 40, 32)
      doc.setFontSize(10)
      doc.text(`Unidade Hospitalar: ${hospitalLabel}`, 40, 50)
      doc.text(`Data Alta: ${formatDateRangeLabel(dischargeFrom || undefined, dischargeTo || undefined)}`, 40, 64)
      doc.text(`Médicos: ${doctorLabel}`, 40, 78)
      doc.text(`Total de AIHs: ${table.totalAIHs}`, 40, 92)
      if (selectedDoctor !== 'all') {
        doc.text(
          `AIHs RD: ${table.stats.aihsRd} | com SP: ${table.stats.aihsWithSp} | por SP: ${table.stats.aihsMatchedDoctorBySp} | por local: ${table.stats.aihsMatchedDoctorByLocal}`,
          40,
          106
        )
      }

      autoTable(doc, {
        head: [table.headers],
        body: table.body,
        startY: selectedDoctor !== 'all' ? 120 : 106,
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [79, 70, 229] }
      })

      const fileName = `Conferencia_Tabwin_${new Date().toISOString().slice(0, 10)}.pdf`
      doc.save(fileName)
      toast.success('Relatório PDF gerado com sucesso')
    } catch (e: any) {
      toast.error('Erro ao gerar relatório PDF')
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateExcel = async () => {
    try {
      setGenerating(true)
      const table = await buildTable()
      if (!table) return

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet([table.headers, ...table.body])
      XLSX.utils.book_append_sheet(wb, ws, 'Tabwin')
      const fileName = `Conferencia_Tabwin_${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, fileName)
      toast.success('Relatório Excel gerado com sucesso')
    } catch (e: any) {
      toast.error('Erro ao gerar relatório Excel')
    } finally {
      setGenerating(false)
    }
  }

  const disabled = generating || loadingHospitals || loadingDoctors

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[97vw] text-lg">
        <DialogHeader>
          <DialogTitle className="text-3xl">Conferência Tabwin</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border border-gray-200">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-black">
                <Building className="h-4 w-4" />
                Unidade Hospitalar
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select value={selectedHospital} onValueChange={(v) => { setSelectedHospital(v); setSelectedDoctor('all') }}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecione o hospital" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os hospitais</SelectItem>
                  {hospitals.map(h => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loadingHospitals && (
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Carregando hospitais...
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader className="pb-2">
              <div className="text-center text-xl font-semibold text-black">
                Data Alta
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-black uppercase tracking-wide mb-2">
                    <Calendar className="h-3.5 w-3.5 text-black" />
                    Início
                  </label>
                  <input
                    type="date"
                    value={inputDischargeFrom}
                    onChange={(e) => {
                      const v = e.target.value
                      setInputDischargeFrom(v)
                      if (!v) {
                        setInputDischargeTo('')
                        setDischargeTo('')
                        return
                      }
                      const end = endOfMonthISO(v)
                      if (end) {
                        setInputDischargeTo(end)
                        setDischargeTo(end)
                      }
                    }}
                    onBlur={() => setDischargeFrom(inputDischargeFrom || '')}
                    disabled={disabled}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg bg-white text-base focus:outline-none focus:border-black hover:border-gray-300 transition-colors h-11"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-black uppercase tracking-wide mb-2">
                    <Calendar className="h-3.5 w-3.5 text-black" />
                    Fim
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={inputDischargeTo}
                      onChange={(e) => {
                        const v = e.target.value
                        setInputDischargeTo(v)
                        setDischargeFrom(inputDischargeFrom || '')
                        setDischargeTo(v || '')
                      }}
                      disabled={disabled}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg bg-white text-base focus:outline-none focus:border-black hover:border-gray-300 transition-colors h-11"
                    />
                    {(dischargeFrom || dischargeTo) && (
                      <button
                        onClick={() => {
                          setInputDischargeFrom('')
                          setInputDischargeTo('')
                          setDischargeFrom('')
                          setDischargeTo('')
                        }}
                        className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0"
                        title="Limpar filtro de alta"
                        type="button"
                        disabled={disabled}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {formatDateRangeLabel(dischargeFrom || undefined, dischargeTo || undefined)}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-black">
                <Stethoscope className="h-4 w-4" />
                Médicos
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecione o médico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os médicos</SelectItem>
                  {doctors.map(d => (
                    <SelectItem key={d.cns} value={d.cns}>{d.name} ({d.specialty || '—'})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loadingDoctors && (
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Carregando médicos...
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <Button
            type="button"
            onClick={handleGeneratePdf}
            disabled={disabled}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-9 px-3 rounded-md text-sm w-auto min-w-[180px]"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Gerar Relatório PDF
          </Button>
          <Button
            type="button"
            onClick={handleGenerateExcel}
            disabled={disabled}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-9 px-3 rounded-md text-sm w-auto min-w-[180px]"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Gerar Relatório Excel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
