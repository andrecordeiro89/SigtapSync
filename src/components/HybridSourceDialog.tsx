import React, { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Card, CardContent, CardHeader } from './ui/card'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Input } from './ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Badge } from './ui/badge'
import { Building, Calendar, Check, FileSpreadsheet, FileText, Loader2, Stethoscope, X } from 'lucide-react'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { supabaseSih } from '../lib/sihSupabase'
import { DoctorsCrudService } from '../services/doctorsCrudService'
import { formatSigtapCode } from '../utils/formatters'
import { getSigtapLocalMap } from '../utils/sigtapLocal'
import { getCalculableProcedures } from '../utils/anesthetistLogic'
import { calculateDoctorPayment, calculateFixedPayment, isFixedMonthlyPayment, ALL_HOSPITAL_RULES } from '../config/doctorPaymentRules'

type HospitalOption = { id: string; name: string; cnes?: string }
type DoctorOption = { cns: string; name: string; specialty: string }

export type HybridSourceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const formatDateRangeLabel = (from?: string, to?: string) => {
  const f = from ? from.split('-').reverse().join('/') : '—'
  const t = to ? to.split('-').reverse().join('/') : '—'
  return `${f} — ${t}`
}

const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return 'R$ 0,00'
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const normalizeAih = (s: unknown): string => String(s ?? '').replace(/\D/g, '').replace(/^0+/, '')

const parseISODateToLocal = (isoString: string | undefined | null): string => {
  if (!isoString) return ''
  const s = String(isoString).trim()
  if (!s) return ''
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const [, year, month, day] = match
    return `${day}/${month}/${year}`
  }
  try {
    const parts = s.split(/[-T]/)
    if (parts.length >= 3) {
      const [year, month, day] = parts
      if (year && month && day) {
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
      }
    }
  } catch { }
  return ''
}

const isMedicalProcedure = (procedureCode: string): boolean => {
  if (!procedureCode) return false
  return String(procedureCode).trim().startsWith('04')
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const cleanProcedureDescription = (procedureCode: string, rawDesc: string): string => {
  const code = String(procedureCode || '').trim()
  const digits = code.replace(/\D/g, '')
  let desc = String(rawDesc || '').trim()
  if (!desc) return ''
  if (code) {
    desc = desc.replace(new RegExp(`^\\s*${escapeRegExp(code)}\\s*[-–—:]?\\s*`, 'i'), '')
    desc = desc.replace(new RegExp(`\\b${escapeRegExp(code)}\\b`, 'gi'), '')
  }
  if (digits) {
    desc = desc.replace(new RegExp(`^\\s*${escapeRegExp(digits)}\\s*[-–—:]?\\s*`, 'i'), '')
    desc = desc.replace(new RegExp(`\\b${escapeRegExp(digits)}\\b`, 'gi'), '')
  }
  desc = desc.replace(/\s+/g, ' ').trim()
  return desc
}

const buildProceduresDisplay = (proceduresWithPayment: any[]): string => {
  const seen = new Set<string>()
  const labels = (proceduresWithPayment || [])
    .map((m: any) => {
      const code = String(m?.procedure_code || '').trim()
      const raw = String(m?.procedure_description || '').trim()
      const cleaned = cleanProcedureDescription(code, raw)
      const out = cleaned || (code ? `Procedimento ${code}` : 'Procedimento')
      const key = out.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()
      if (!key) return null
      if (seen.has(key)) return null
      seen.add(key)
      return out
    })
    .filter(Boolean) as string[]
  return labels.length > 0 ? labels.join(' + ') : 'Sem procedimentos 04.*'
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

const endExclusiveISODate = (isoDate: string): string => {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) {
    const d = new Date(isoDate)
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }
  const y = Number(m[1])
  const mo = Number(m[2])
  const day = Number(m[3])
  const next = new Date(Date.UTC(y, mo - 1, day))
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

import { checkCboCompatibility, isSurgicalProcedure } from '../utils/cboCompatibility'
import { getSpecialtyName } from '../utils/aihLookups'
import { CareCharacterUtils } from '../config/careCharacterCodes'

export default function HybridSourceDialog({ open, onOpenChange }: HybridSourceDialogProps) {
  type PreviewRow = {
    id: string
    isRemote: boolean
    hasAih: boolean
    hasProcedures04: boolean
    repasseValue: number
    cells: string[]
    isDivergent?: boolean
  }

  const [hospitals, setHospitals] = useState<HospitalOption[]>([])
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [selectedHospital, setSelectedHospital] = useState<string>('all')
  const [selectedDoctor, setSelectedDoctor] = useState<string>('all')
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all')
  const [dischargeFrom, setDischargeFrom] = useState<string>('')
  const [dischargeTo, setDischargeTo] = useState<string>('')
  const [inputDischargeFrom, setInputDischargeFrom] = useState<string>('')
  const [inputDischargeTo, setInputDischargeTo] = useState<string>('')
  const [selectedCompetencias, setSelectedCompetencias] = useState<string[]>([])
  const [availableCompetencias, setAvailableCompetencias] = useState<string[]>([])
  const [loadingCompetencias, setLoadingCompetencias] = useState(false)
  const [loadingHospitals, setLoadingHospitals] = useState(false)
  const [loadingDoctors, setLoadingDoctors] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [previewInfo, setPreviewInfo] = useState<null | {
    hospitalLabel: string
    doctorLabel: string
    specialtyLabel: string
    dischargeFrom: string
    dischargeTo: string
    remoteAihFoundCount: number
    localAihFilledCount: number
    missingInRemoteCount: number
    localNoAihCount: number
    competenciasLabel: string
  }>(null)

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
      } catch {
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
      } catch {
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
    if (!open) return
    setSelectedDoctor('all')
    setSelectedSpecialty('all')
    setSelectedCompetencias([])
    setDischargeFrom('')
    setDischargeTo('')
    setInputDischargeFrom('')
    setInputDischargeTo('')
    setPreviewMode(false)
    setPreviewRows([])
    setPreviewInfo(null)
  }, [open])

  // Carregar competências disponíveis do sih_rd (paginado para cobrir toda a tabela)
  useEffect(() => {
    if (!open || !supabaseSih) return
    let cancelled = false
    const loadCompetencias = async () => {
      setLoadingCompetencias(true)
      try {
        const set = new Set<string>()
        const pageSize = 1000
        let offset = 0
        for (; ;) {
          let q = supabaseSih
            .from('sih_rd')
            .select('ano_cmpt, mes_cmpt')
            .range(offset, offset + pageSize - 1)
          if (selectedHospital !== 'all') q = q.eq('hospital_id', selectedHospital)
          const { data, error } = await q
          if (error) throw error
          const batch = (data || []) as any[]
          if (batch.length === 0) break
          batch.forEach((r: any) => {
            const y = Number(r.ano_cmpt)
            const m = Number(r.mes_cmpt)
            if (y && m) set.add(`${String(y).padStart(4, '0')}${String(m).padStart(2, '0')}`)
          })
          if (batch.length < pageSize) break
          offset += pageSize
        }
        const sorted = Array.from(set).sort((a, b) => b.localeCompare(a))
        if (!cancelled) {
          setAvailableCompetencias(sorted)
          setSelectedCompetencias(prev => prev.filter(c => sorted.includes(c)))
        }
      } catch {
        if (!cancelled) setAvailableCompetencias([])
      } finally {
        if (!cancelled) setLoadingCompetencias(false)
      }
    }
    loadCompetencias()
    return () => { cancelled = true }
  }, [open, selectedHospital])

  const specialties = useMemo(() => {
    const set = new Set<string>()
    doctors.forEach(d => {
      const s = String(d.specialty || '').trim()
      if (s) set.add(s)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [doctors])

  const filteredDoctors = useMemo(() => {
    if (selectedSpecialty === 'all') return doctors
    return doctors.filter(d => String(d.specialty || '').trim() === selectedSpecialty)
  }, [doctors, selectedSpecialty])

  useEffect(() => {
    if (selectedDoctor === 'all') return
    const exists = filteredDoctors.some(d => d.cns === selectedDoctor)
    if (!exists) setSelectedDoctor('all')
  }, [filteredDoctors, selectedDoctor])

  const hospitalLabel = useMemo(() => {
    if (selectedHospital === 'all') return 'Todos os hospitais'
    return hospitals.find(h => h.id === selectedHospital)?.name || 'Hospital'
  }, [hospitals, selectedHospital])

  const doctorLabel = useMemo(() => {
    if (selectedDoctor === 'all') return 'Todos os médicos'
    return doctors.find(d => d.cns === selectedDoctor)?.name || 'Médico'
  }, [doctors, selectedDoctor])

  const specialtyLabel = useMemo(() => {
    if (selectedSpecialty === 'all') return 'Todas as especialidades'
    return selectedSpecialty
  }, [selectedSpecialty])

  const competenciasLabel = useMemo(() => {
    if (selectedCompetencias.length === 0) return 'Todas'
    return selectedCompetencias
      .map(c => `${c.slice(4, 6)}/${c.slice(0, 4)}`)
      .join(', ')
  }, [selectedCompetencias])

  const formatCompetenciaDisplay = (c: string) => `${c.slice(4, 6)}/${c.slice(0, 4)}`

  const savePdfReport = (rows: PreviewRow[], info: NonNullable<typeof previewInfo>) => {
    const globalTotal = rows.reduce((s, r) => s + (r.repasseValue || 0), 0)
    const totalLines = rows.length
    const body = rows.map((r, idx) => [String(idx + 1), ...r.cells])

    const doc = new jsPDF('landscape')
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 51, 102)
    doc.text('RELATÓRIO DE REPASSE MÉDICO (REPASSE SIH)', pageWidth / 2, 24, { align: 'center' })

    const nowLabel = new Date().toLocaleString('pt-BR')
    const isDoctorHeader = info.doctorLabel && info.doctorLabel !== 'Todos os médicos' && info.doctorLabel !== 'Médico'

    const drawSegments = (segments: Array<{ label: string; value: string; bold?: boolean }>, y: number, fontSize = 10) => {
      doc.setFontSize(fontSize)
      doc.setTextColor(60, 60, 60)
      const separator = '  |  '
      let totalWidth = 0
      segments.forEach((seg, idx) => {
        totalWidth += doc.getTextWidth(seg.label) + doc.getTextWidth(seg.value)
        if (idx < segments.length - 1) totalWidth += doc.getTextWidth(separator)
      })
      let x = (pageWidth / 2) - (totalWidth / 2)
      segments.forEach((seg, idx) => {
        doc.setFont('helvetica', 'normal')
        doc.text(seg.label, x, y)
        x += doc.getTextWidth(seg.label)
        doc.setFont('helvetica', seg.bold ? 'bold' : 'normal')
        doc.text(seg.value, x, y)
        x += doc.getTextWidth(seg.value)
        if (idx < segments.length - 1) {
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(100, 100, 100)
          doc.text(separator, x, y)
          doc.setTextColor(60, 60, 60)
          x += doc.getTextWidth(separator)
        }
      })
    }

    let startY = 110
    if (isDoctorHeader) {
      let y = 34
      drawSegments([
        { label: 'Médico: ', value: info.doctorLabel, bold: true },
        { label: 'Hospital: ', value: info.hospitalLabel }
      ], y, 11)
      y += 6
      drawSegments([
        { label: 'Data Alta: ', value: formatDateRangeLabel(info.dischargeFrom, info.dischargeTo) },
        { label: 'Gerado em: ', value: nowLabel }
      ], y, 10)
      y += 8
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.5)
      doc.line(20, y, pageWidth - 20, y)
      const metricY = y + 7
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text('Linhas:', 20, metricY)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 51, 102)
      doc.text(String(totalLines), 45, metricY)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text('Valor Total:', pageWidth - 90, metricY)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 102, 0)
      doc.text(formatCurrency(globalTotal), pageWidth - 20, metricY, { align: 'right' })
      startY = y + 16
    } else {
      const leftX = 20
      const rightX = pageWidth - 20
      const y0 = 38
      const lh = 8

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text(`Unidade Hospitalar: ${info.hospitalLabel}`, leftX, y0)
      doc.text(`Especialidade: ${info.specialtyLabel}`, leftX, y0 + lh)
      doc.text(`Médico: ${info.doctorLabel}`, leftX, y0 + lh * 2)
      doc.text(`Data Alta: ${formatDateRangeLabel(info.dischargeFrom, info.dischargeTo)}`, leftX, y0 + lh * 3)
      doc.text(`Competência: ${info.competenciasLabel}`, leftX, y0 + lh * 4)
      doc.text(`Gerado em: ${nowLabel}`, leftX, y0 + lh * 5)

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 102, 0)
      doc.text(`Valor Total: ${formatCurrency(globalTotal)}`, rightX, y0, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text(`AIHs no SIH (encontradas): ${info.remoteAihFoundCount}`, rightX, y0 + lh, { align: 'right' })
      doc.text(`AIHs no local (preenchidas): ${info.localAihFilledCount}`, rightX, y0 + lh * 2, { align: 'right' })
      doc.text(`AIHs não encontradas no SIH: ${info.missingInRemoteCount}`, rightX, y0 + lh * 3, { align: 'right' })
      doc.text(`Registros locais sem nº AIH: ${info.localNoAihCount}`, rightX, y0 + lh * 4, { align: 'right' })
      doc.text(`Total de linhas no relatório: ${totalLines}`, rightX, y0 + lh * 5, { align: 'right' })

      startY = y0 + lh * 7 + 6
    }

    autoTable(doc, {
      head: [['#', 'Nº da AIH', 'Médico', 'Prontuário', 'Nome do Paciente', 'Procedimentos', 'Data Alta', 'Caráter', 'Competência', 'Valor de Repasse']],
      body,
      startY,
      theme: 'striped',
      headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, halign: 'center', cellPadding: 2 },
      bodyStyles: { fontSize: 8, textColor: [50, 50, 50], cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 'auto', halign: 'center' },
        1: { cellWidth: 'auto', halign: 'center' },
        2: { cellWidth: 'auto', halign: 'left' },
        3: { cellWidth: 'auto', halign: 'center' },
        4: { cellWidth: 'auto', halign: 'left' },
        5: { cellWidth: 'auto', halign: 'left', fontSize: 7 },
        6: { cellWidth: 'auto', halign: 'center' },
        7: { cellWidth: 'auto', halign: 'center', fontSize: 7 },
        8: { cellWidth: 'auto', halign: 'center' },
        9: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold', textColor: [0, 102, 0] }
      },
      styles: { overflow: 'linebreak', cellPadding: 2, fontSize: 8 },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const rowIndex = data.row.index
          const originalRow = rows[rowIndex] as PreviewRow
          if (originalRow && originalRow.isDivergent) {
            data.cell.styles.textColor = [255, 0, 0] // Vermelho
          }
        }
      },
      margin: { left: 20, right: 20 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    })

    doc.save(`Repasse_SIH_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const saveExcelReport = (rows: PreviewRow[], info: NonNullable<typeof previewInfo>) => {
    const body = rows.map((r, idx) => [...[idx + 1, ...r.cells], r.isDivergent ? 'DIVERGÊNCIA ESPECIALIDADE' : ''])
    const header = ['#', 'Nº da AIH', 'Médico', 'Prontuário', 'Nome do Paciente', 'Procedimentos', 'Data Alta', 'Caráter', 'Competência', 'Valor de Repasse', 'Obs']
    const globalTotal = rows.reduce((s, r) => s + (r.repasseValue || 0), 0)
    const nowLabel = new Date().toLocaleString('pt-BR')

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([header, ...body])
      ; (ws as any)['!cols'] = [
        { wch: 6 }, // #
        { wch: 18 }, // Nº da AIH
        { wch: 28 }, // Médico
        { wch: 16 }, // Prontuário
        { wch: 36 }, // Nome do Paciente
        { wch: 70 }, // Procedimentos
        { wch: 14 }, // Data Alta
        { wch: 25 }, // Caráter
        { wch: 12 }, // Competência
        { wch: 18 }, // Valor de Repasse
        { wch: 25 }  // Obs
      ]
    XLSX.utils.book_append_sheet(wb, ws, 'Repasse SIH')

    const wsSummary = XLSX.utils.aoa_to_sheet([
      ['Hospital', info.hospitalLabel],
      ['Especialidade', info.specialtyLabel],
      ['Médico', info.doctorLabel],
      ['Data Alta', formatDateRangeLabel(info.dischargeFrom, info.dischargeTo)],
      ['Gerado em', nowLabel],
      ['Linhas', rows.length],
      ['Valor Total', globalTotal],
      ['AIHs no SIH (encontradas)', info.remoteAihFoundCount],
      ['AIHs no local (preenchidas)', info.localAihFilledCount],
      ['AIHs não encontradas no SIH', info.missingInRemoteCount],
      ['Registros locais sem nº AIH', info.localNoAihCount],
      ['Competência', info.competenciasLabel],
    ])
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo')

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
    XLSX.writeFile(wb, `Repasse_SIH_${stamp}.xlsx`)
  }

  const handleGeneratePdf = async (format: 'pdf' | 'excel' = 'pdf') => {
    try {
      const hasDateFilter = !!(dischargeFrom && dischargeTo)
      const hasCompFilter = selectedCompetencias.length > 0
      if (!hasDateFilter && !hasCompFilter) {
        toast.error('Selecione um período de alta ou pelo menos uma competência.')
        return
      }

      setGenerating(true)
      if (!supabaseSih) {
        toast.error('Fonte SIH remota não configurada')
        return
      }

      const endExclusive = dischargeTo ? endExclusiveISODate(dischargeTo) : ''

      // Helper: extrair pares ano/mês das competências selecionadas
      const compPairs = selectedCompetencias.map(c => ({
        year: Number(c.slice(0, 4)),
        month: Number(c.slice(4, 6))
      }))
      const compYears = Array.from(new Set(compPairs.map(p => p.year)))
      const compMonths = Array.from(new Set(compPairs.map(p => p.month)))

      const applyCompFilter = (q: any) => {
        if (compPairs.length === 0) return q
        if (compYears.length === 1 && compMonths.length === 1) {
          q = q.eq('ano_cmpt', compYears[0]).eq('mes_cmpt', compMonths[0])
        } else if (compYears.length === 1) {
          q = q.eq('ano_cmpt', compYears[0]).in('mes_cmpt', compMonths)
        } else {
          q = q.in('ano_cmpt', compYears).in('mes_cmpt', compMonths)
        }
        return q
      }
      const hospitalNameById = new Map((hospitals || []).map(h => [String(h.id), String(h.name || '')]))

      const localRows: Array<{ aih: string; patient_name?: string; data_saida?: string; hospital_id?: string; prontuario?: string }> = []
      const pageSize = 1000
      let offset = 0
      for (; ;) {
        let q = supabase
          .from('gsus_aihs_patients')
          .select('aih, patient_name, data_saida, hospital_id, prontuario')
        if (hasDateFilter) {
          q = q.gte('data_saida', dischargeFrom).lt('data_saida', endExclusive)
        }
        q = q.range(offset, offset + pageSize - 1)
        if (selectedHospital !== 'all') q = q.eq('hospital_id', selectedHospital)
        const { data, error } = await q
        if (error) throw error
        const batch = (data || []) as any[]
        if (batch.length === 0) break
        batch.forEach((r: any) => {
          localRows.push({
            aih: String(r.aih || ''),
            patient_name: r.patient_name ? String(r.patient_name) : undefined,
            data_saida: r.data_saida ? String(r.data_saida) : undefined,
            hospital_id: r.hospital_id ? String(r.hospital_id) : undefined,
            prontuario: r.prontuario ? String(r.prontuario) : undefined,
          })
        })
        if (batch.length < pageSize) break
        offset += pageSize
      }

      const localAihFilledKeys = localRows.map(r => normalizeAih(r.aih)).filter(Boolean)
      const aihKeys = Array.from(new Set(localAihFilledKeys))
      const localNoAihCount = localRows.filter(r => !normalizeAih(r.aih)).length
      const localAihFilledCount = aihKeys.length

      const chunk = <T,>(arr: T[], size = 80): T[][] => {
        const out: T[][] = []
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
        return out
      }

      const normalizeCnes = (cnes: unknown): string => String(cnes ?? '').replace(/\D/g, '').padStart(7, '0')
      const selectedHospitalCnes = selectedHospital !== 'all'
        ? (hospitals.find(h => String(h.id) === String(selectedHospital))?.cnes || '')
        : ''
      const cnesDigits = normalizeCnes(selectedHospitalCnes)
      const cnesVariants = Array.from(new Set([cnesDigits, cnesDigits.replace(/^0+/, ''), cnesDigits.padStart(7, '0')].filter(Boolean)))

      const rdRows: Array<{ n_aih: string; dt_saida?: string; hospital_id?: string; cnes?: string; competencia?: string; espec?: string; car_int?: string; diag_princ?: string }> = []
      const remoteRdByAih = new Map<string, { dtSaida: string; hospitalId?: string; competencia?: string; espec?: string; car_int?: string; diag_princ?: string }>()

      if (selectedHospital !== 'all') {
        const pageSizeRd = 1000
        let rdOffset = 0
        for (; ;) {
          let q = supabaseSih
            .from('sih_rd')
            .select('n_aih, dt_saida, hospital_id, cnes, ano_cmpt, mes_cmpt, espec, car_int, diag_princ')
            .eq('hospital_id', selectedHospital)
          if (hasDateFilter) {
            q = q.not('dt_saida', 'is', null).gte('dt_saida', dischargeFrom).lt('dt_saida', endExclusive)
          }
          q = applyCompFilter(q)
          q = q.order('dt_saida', { ascending: true })
            .range(rdOffset, rdOffset + pageSizeRd - 1)

          const { data, error } = await q
          if (error) throw error
          const batch = (data || []) as any[]
          if (batch.length === 0) break
          batch.forEach((r: any) => rdRows.push({
            n_aih: String(r?.n_aih || ''),
            dt_saida: r?.dt_saida ? String(r.dt_saida) : undefined,
            hospital_id: r?.hospital_id ? String(r.hospital_id) : undefined,
            cnes: r?.cnes ? String(r.cnes) : undefined,
            competencia: (r?.ano_cmpt && r?.mes_cmpt) ? `${String(r.ano_cmpt).padStart(4, '0')}${String(r.mes_cmpt).padStart(2, '0')}` : undefined,
            espec: r?.espec ? String(r.espec) : undefined,
            car_int: r?.car_int ? String(r.car_int) : undefined,
            diag_princ: r?.diag_princ ? String(r.diag_princ) : undefined,
          }))
          if (batch.length < pageSizeRd) break
          rdOffset += pageSizeRd
        }

        if (rdRows.length === 0 && cnesVariants.length > 0) {
          rdOffset = 0
          for (; ;) {
            let q = supabaseSih
              .from('sih_rd')
              .select('n_aih, dt_saida, hospital_id, cnes, ano_cmpt, mes_cmpt, espec, car_int, diag_princ')
              .in('cnes', cnesVariants)
            if (hasDateFilter) {
              q = q.not('dt_saida', 'is', null).gte('dt_saida', dischargeFrom).lt('dt_saida', endExclusive)
            }
            q = applyCompFilter(q)
            q = q.order('dt_saida', { ascending: true })
              .range(rdOffset, rdOffset + pageSizeRd - 1)

            const { data, error } = await q
            if (error) throw error
            const batch = (data || []) as any[]
            if (batch.length === 0) break
            batch.forEach((r: any) => rdRows.push({
            n_aih: String(r?.n_aih || ''),
            dt_saida: r?.dt_saida ? String(r.dt_saida) : undefined,
            hospital_id: r?.hospital_id ? String(r.hospital_id) : undefined,
            cnes: r?.cnes ? String(r.cnes) : undefined,
            competencia: (r?.ano_cmpt && r?.mes_cmpt) ? `${String(r.ano_cmpt).padStart(4, '0')}${String(r.mes_cmpt).padStart(2, '0')}` : undefined,
            espec: r?.espec ? String(r.espec) : undefined,
            car_int: r?.car_int ? String(r.car_int) : undefined,
            diag_princ: r?.diag_princ ? String(r.diag_princ) : undefined,
          }))
            if (batch.length < pageSizeRd) break
            rdOffset += pageSizeRd
          }
        }

        rdRows.forEach((r) => {
          const key = normalizeAih(r?.n_aih)
          if (!key) return
          if (!remoteRdByAih.has(key)) {
            remoteRdByAih.set(key, { 
              dtSaida: String(r?.dt_saida || '').trim(), 
              hospitalId: r?.hospital_id, 
              competencia: r?.competencia,
              espec: r?.espec,
              car_int: r?.car_int,
              diag_princ: r?.diag_princ
            })
          }
        })
      }

      if (selectedDoctor !== 'all') {
        const doctorAihRawSet = new Set<string>()
        const pageSizeDoctor = 1000
        let spOffset = 0
        for (; ;) {
          const q = supabaseSih
            .from('sih_sp')
            .select('sp_naih')
            .eq('sp_pf_doc', selectedDoctor)
            .not('sp_dtsaida', 'is', null)
            .gte('sp_dtsaida', dischargeFrom)
            .lt('sp_dtsaida', endExclusive)
            .range(spOffset, spOffset + pageSizeDoctor - 1)

          const { data, error } = await q
          if (error) throw error
          const batch = (data || []) as any[]
          if (batch.length === 0) break
          batch.forEach((r: any) => {
            const raw = String(r?.sp_naih || '').trim()
            if (raw) doctorAihRawSet.add(raw)
          })
          if (batch.length < pageSizeDoctor) break
          spOffset += pageSizeDoctor
        }

        const doctorAihRaw = Array.from(doctorAihRawSet)
        if (doctorAihRaw.length > 0) {
          for (const ch of chunk(doctorAihRaw, 80)) {
            let q = supabaseSih
              .from('sih_rd')
              .select('n_aih, dt_saida, hospital_id, cnes, ano_cmpt, mes_cmpt, espec, car_int, diag_princ')
              .in('n_aih', ch)
            if (hasDateFilter) {
              q = q.not('dt_saida', 'is', null).gte('dt_saida', dischargeFrom).lt('dt_saida', endExclusive)
            }
            q = applyCompFilter(q)
            q = q.order('dt_saida', { ascending: true })
            if (selectedHospital !== 'all') q = q.eq('hospital_id', selectedHospital)

            const { data, error } = await q
            if (error) throw error
              ; (data || []).forEach((r: any) => {
                const row = {
                  n_aih: String(r?.n_aih || ''),
                  dt_saida: r?.dt_saida ? String(r.dt_saida) : undefined,
                  hospital_id: r?.hospital_id ? String(r.hospital_id) : undefined,
                  cnes: r?.cnes ? String(r.cnes) : undefined,
                  competencia: (r?.ano_cmpt && r?.mes_cmpt) ? `${String(r.ano_cmpt).padStart(4, '0')}${String(r.mes_cmpt).padStart(2, '0')}` : undefined,
                  espec: r?.espec ? String(r.espec) : undefined,
                  car_int: r?.car_int ? String(r.car_int) : undefined,
                  diag_princ: r?.diag_princ ? String(r.diag_princ) : undefined,
                }
                rdRows.push(row)
                const key = normalizeAih(row.n_aih)
                if (!key) return
                if (!remoteRdByAih.has(key)) {
                  remoteRdByAih.set(key, { 
                    dtSaida: String(row.dt_saida || '').trim(), 
                    hospitalId: row.hospital_id, 
                    competencia: row.competencia,
                    espec: row.espec,
                    car_int: row.car_int,
                    diag_princ: row.diag_princ
                  })
                }
              })
          }
        }
      }

      const remoteRdAihKeys = Array.from(remoteRdByAih.keys())
      const aihKeysForRemote = Array.from(new Set([...aihKeys, ...remoteRdAihKeys]))

      const spRows: any[] = []
      if (aihKeysForRemote.length > 0) {
        for (const ch of chunk(aihKeysForRemote, 80)) {
          let spQuery = supabaseSih
            .from('sih_sp')
            .select('sp_naih, sp_atoprof, sp_qt_proc, sp_qtd_ato, sp_valato, sp_ptsp, sp_pf_doc, sp_pf_cbo, sp_mm, sp_aa')
            .in('sp_naih', ch)
          const { data, error } = await spQuery
          if (error) throw error
          if (data && data.length > 0) spRows.push(...data)
        }
      }

      const spByAih = new Map<string, any[]>()
      spRows.forEach((r) => {
        const key = normalizeAih(r?.sp_naih)
        if (!key) return
        if (!spByAih.has(key)) spByAih.set(key, [])
        spByAih.get(key)!.push(r)
      })

      const isZeroCns = (cns: string) => /^0+$/.test(String(cns || '').trim())

      const candidateCnsByAih = new Map<string, string[]>()
      for (const [aihKey, rows] of spByAih.entries()) {
        const perCns = new Map<string, { sumPtsp: number; hasNonAnesth: boolean; hasAnyPtsp: boolean }>()
        rows.forEach((r: any) => {
          const cns = String(r?.sp_pf_doc || '').trim()
          if (!cns) return
          const cbo = String(r?.sp_pf_cbo || '').trim()
          const ptsRaw = r?.sp_ptsp
          const ptsp = Number(ptsRaw)
          const hasPtsp = Number.isFinite(ptsp) && ptsp > 0
          const prev = perCns.get(cns) || { sumPtsp: 0, hasNonAnesth: false, hasAnyPtsp: false }
          perCns.set(cns, {
            sumPtsp: prev.sumPtsp + (hasPtsp ? ptsp : 0),
            hasNonAnesth: prev.hasNonAnesth || (cbo !== '225151'),
            hasAnyPtsp: prev.hasAnyPtsp || hasPtsp
          })
        })
        if (perCns.size === 0) continue
        const entries = Array.from(perCns.entries())
        const candidates = entries
          .filter(([, v]) => v.hasNonAnesth && v.hasAnyPtsp)
          .filter(([cns]) => !isZeroCns(cns))
          .sort((a, b) => {
            const diffPtsp = (b[1].sumPtsp || 0) - (a[1].sumPtsp || 0)
            if (diffPtsp !== 0) return diffPtsp
            return a[0].localeCompare(b[0])
          })
          .map(([cns]) => cns)
        candidateCnsByAih.set(aihKey, candidates)
      }

      const chooseBetterLocalRow = (
        a: { aih: string; patient_name?: string; data_saida?: string; hospital_id?: string; prontuario?: string },
        b: { aih: string; patient_name?: string; data_saida?: string; hospital_id?: string; prontuario?: string }
      ) => {
        const aName = String(a.patient_name || '').trim()
        const bName = String(b.patient_name || '').trim()
        if (!aName && bName) return b
        if (aName && !bName) return a
        const aHosp = String(a.hospital_id || '').trim()
        const bHosp = String(b.hospital_id || '').trim()
        if (!aHosp && bHosp) return b
        if (aHosp && !bHosp) return a
        const ad = String(a.data_saida || '').trim()
        const bd = String(b.data_saida || '').trim()
        if (ad && bd && bd > ad) return b
        const ap = String(a.prontuario || '').trim()
        const bp = String(b.prontuario || '').trim()
        if (!ap && bp) return b
        if (ap && !bp) return a
        return a
      }

      const uniqueLocalByAih = new Map<string, { aih: string; patient_name?: string; data_saida?: string; hospital_id?: string; prontuario?: string }>()
      localRows.forEach((r) => {
        const k = normalizeAih(r.aih)
        if (!k) return
        const prev = uniqueLocalByAih.get(k)
        uniqueLocalByAih.set(k, prev ? chooseBetterLocalRow(prev, r) : r)
      })

      const reportEntries: Array<{
        aihKey: string
        aihNumber: string
        prontuario: string
        patientName: string
        dischargeISO: string
        competencia?: string
        hospitalId?: string
        doctorCns?: string
        espec?: string
        car_int?: string
        diag_princ?: string
      }> = []

      const combinedAihKeys = Array.from(new Set([...Array.from(uniqueLocalByAih.keys()), ...remoteRdAihKeys]))
      for (const aihKey of combinedAihKeys) {
        const r = uniqueLocalByAih.get(aihKey)
        const rd = remoteRdByAih.get(aihKey)
        reportEntries.push({
          aihKey,
          aihNumber: aihKey,
          prontuario: String(r?.prontuario || '').trim(),
          patientName: (r?.patient_name || '').trim() || 'Paciente',
          dischargeISO: String((r?.data_saida || rd?.dtSaida || '')).trim(),
          competencia: rd?.competencia,
          hospitalId: r?.hospital_id || rd?.hospitalId,
          doctorCns: undefined,
          espec: rd?.espec,
          car_int: rd?.car_int,
          diag_princ: rd?.diag_princ
        })
      }

      const localRowsWithoutAih = localRows.filter(r => !normalizeAih(r.aih))
      localRowsWithoutAih.forEach((r) => {
        reportEntries.push({
          aihKey: '',
          aihNumber: '',
          prontuario: String(r.prontuario || '').trim(),
          patientName: (r.patient_name || '').trim() || 'Paciente',
          dischargeISO: (r.data_saida || '').trim(),
          hospitalId: r.hospital_id,
          doctorCns: undefined,
        })
      })

      if (reportEntries.length === 0) {
        toast.warning('Nenhum registro encontrado no banco local para os filtros selecionados')
        return
      }

      {
        const needsEnrichKeys = Array.from(new Set(
          reportEntries
            .filter(e => e.aihKey && !uniqueLocalByAih.has(e.aihKey) && (!e.prontuario || e.patientName === 'Paciente'))
            .map(e => e.aihKey)
        ))

        const aihVariants = (k: string): string[] => {
          const raw = String(k || '').replace(/\D/g, '').replace(/^0+/, '')
          if (!raw) return []
          const out = new Set<string>()
          out.add(raw)
          out.add(raw.padStart(12, '0'))
          out.add(raw.padStart(13, '0'))
          return Array.from(out)
        }

        const variantsFlat = Array.from(new Set(needsEnrichKeys.flatMap(aihVariants)))
        if (variantsFlat.length > 0) {
          const enrichedByKey = new Map<string, { aih: string; patient_name?: string; data_saida?: string; hospital_id?: string; prontuario?: string }>()
          for (const ch of chunk(variantsFlat, 80)) {
            const { data, error } = await supabase
              .from('gsus_aihs_patients')
              .select('aih, patient_name, data_saida, hospital_id, prontuario')
              .in('aih', ch)
            if (error) throw error
              ; (data || []).forEach((r: any) => {
                const key = normalizeAih(r?.aih)
                if (!key) return
                const row = {
                  aih: String(r.aih || ''),
                  patient_name: r.patient_name ? String(r.patient_name) : undefined,
                  data_saida: r.data_saida ? String(r.data_saida) : undefined,
                  hospital_id: r.hospital_id ? String(r.hospital_id) : undefined,
                  prontuario: r.prontuario ? String(r.prontuario) : undefined,
                }
                const prev = enrichedByKey.get(key)
                enrichedByKey.set(key, prev ? chooseBetterLocalRow(prev, row) : row)
              })
          }

          if (enrichedByKey.size > 0) {
            for (let i = 0; i < reportEntries.length; i++) {
              const e = reportEntries[i]
              if (!e.aihKey || uniqueLocalByAih.has(e.aihKey)) continue
              const rr = enrichedByKey.get(e.aihKey)
              if (!rr) continue
              reportEntries[i] = {
                ...e,
                prontuario: e.prontuario || String(rr.prontuario || '').trim(),
                patientName: (e.patientName && e.patientName !== 'Paciente') ? e.patientName : ((rr.patient_name || '').trim() || e.patientName),
                dischargeISO: e.dischargeISO || String(rr.data_saida || '').trim(),
                hospitalId: e.hospitalId || rr.hospital_id,
              }
            }
          }
        }
      }

      const allCandidateCns = Array.from(new Set(Array.from(candidateCnsByAih.values()).flat().filter(Boolean)))
      const cnsSet = Array.from(new Set(allCandidateCns.filter(cns => cns && !isZeroCns(cns))))
      const doctorByCns = new Map<string, { name: string; specialty: string }>()
      if (cnsSet.length > 0) {
        const { data: doctorRows, error: doctorErr } = await supabase
          .from('doctors')
          .select('name,cns,specialty')
          .in('cns', cnsSet)
        if (doctorErr) throw doctorErr
          ; (doctorRows || []).forEach((d: any) => {
            const cns = String(d.cns || '').trim()
            if (!cns) return
            doctorByCns.set(cns, { name: String(d.name || '').trim(), specialty: String(d.specialty || '').trim() })
          })
      }

      const chooseBestDoctorCnsForAih = (aihKey: string): string | null => {
        const list = candidateCnsByAih.get(aihKey) || []
        const withName = list.find(cns => {
          const nm = doctorByCns.get(cns)?.name || ''
          return !!String(nm).trim()
        })
        if (withName) return withName
        return list.length > 0 ? list[0] : null
      }

      const chooseDoctorCnsForAih = (aihKey: string, preferredCns?: string): string | null => {
        const list = candidateCnsByAih.get(aihKey) || []
        if (preferredCns && list.includes(preferredCns)) return preferredCns
        return chooseBestDoctorCnsForAih(aihKey)
      }

      const filteredEntries = reportEntries.filter((e) => {
        if (e.aihKey && selectedDoctor !== 'all') {
          const cns = chooseDoctorCnsForAih(e.aihKey, selectedDoctor)
          if (!cns || cns !== selectedDoctor) return false
        }
        if (selectedSpecialty === 'all') return true
        const cns = e.aihKey ? (chooseDoctorCnsForAih(e.aihKey, selectedDoctor !== 'all' ? selectedDoctor : undefined) || '') : ''
        const spec = cns ? (doctorByCns.get(cns)?.specialty || '') : ''
        return String(spec).trim() === selectedSpecialty
      })

      if (filteredEntries.length === 0) {
        toast.warning('Nenhum registro encontrado após aplicar os filtros de médico/especialidade')
        return
      }

      const sigtapLocalMap = await getSigtapLocalMap()
      const codesRaw = Array.from(new Set(spRows.map(r => String(r?.sp_atoprof || '')).filter(Boolean)))
      const codes = codesRaw.map(formatSigtapCode).filter(Boolean)
      const codesPlain = codes.map(c => c.replace(/\D/g, ''))
      const remoteDescMap = new Map<string, string>()
      const remoteCbosMap = new Map<string, string[]>()
      try {
        const { data: procRows } = await supabaseSih
          .from('sigtap_procedimentos')
          .select('code, description, cbo')
          .in('code', Array.from(new Set([...codes, ...codesPlain])))
          ; (procRows || []).forEach((p: any) => {
            const code = String(p.code || '').trim()
            const desc = String(p.description || '').trim()
            const cbos = Array.isArray(p.cbo) ? p.cbo.map(String) : []
            if (code && desc) {
              remoteDescMap.set(code, desc)
              remoteCbosMap.set(code, cbos)
            }
          })
      } catch { }

      const rowsDetailed: PreviewRow[] = []
      const totalsByDoctorHospital = new Map<string, { total: number; isMonthly: boolean; fixed: number; fixedRule: string; hospitalId?: string; hospitalName?: string; doctorName: string }>()
      const remoteFoundAihKeys = new Set<string>(Array.from(spByAih.keys()))
      const doctorCboMap = new Map<string, string[]>()
      if (cnsSet.length > 0) {
        const { data: doctorCboRows } = await supabase
          .from('doctors')
          .select('cns, cbo_codes')
          .in('cns', cnsSet)
        ;(doctorCboRows || []).forEach((d: any) => {
          const cns = String(d.cns || '').trim()
          if (cns) {
            doctorCboMap.set(cns, Array.isArray(d.cbo_codes) ? d.cbo_codes.map(String) : [])
          }
        })
      }

      filteredEntries.forEach((entry) => {
        const chosenCns = entry.aihKey ? (chooseDoctorCnsForAih(entry.aihKey, selectedDoctor !== 'all' ? selectedDoctor : undefined) || '') : ''
        const knownDoctorName = chosenCns ? (doctorByCns.get(chosenCns)?.name || '') : ''
        const doctorDisplay = (() => {
          const nm = String(knownDoctorName || '').trim()
          if (nm) return nm
          const cns = String(chosenCns || '').trim()
          if (cns && !isZeroCns(cns)) return `Dr(a). CNS ${cns}`
          return 'Médico não encontrado'
        })()
        const hospitalId = entry.hospitalId
        const isMonthly = knownDoctorName ? isFixedMonthlyPayment(knownDoctorName, hospitalId, ALL_HOSPITAL_RULES) : false
        const fixedCalc = knownDoctorName ? calculateFixedPayment(knownDoctorName, hospitalId, ALL_HOSPITAL_RULES) : { hasFixedRule: false, calculatedPayment: 0, appliedRule: '' } as any

        const spAll = entry.aihKey ? (spByAih.get(entry.aihKey) || []) : []
        const sp = chosenCns ? spAll.filter((r: any) => String(r?.sp_pf_doc || '').trim() === chosenCns) : spAll
        
        // Verifica divergência CBO
        const doctorCbos = chosenCns ? (doctorCboMap.get(chosenCns) || []) : []
        let hasDivergentProcedure = false

        const procedureList = sp.map((r: any, idx: number) => {
          const code = formatSigtapCode(String(r?.sp_atoprof || ''))
          const digits = code.replace(/\D/g, '')
          const desc =
            remoteDescMap.get(code) ||
            remoteDescMap.get(digits) ||
            sigtapLocalMap.get(code) ||
            sigtapLocalMap.get(digits) ||
            ''
          const qty = Number(r?.sp_qtd_ato ?? r?.sp_qt_proc ?? 1) || 1
          const val = Number(r?.sp_valato || 0) * qty
          const ptsp = Number(r?.sp_ptsp || 0)
          
          // Validação CBO
          if (isSurgicalProcedure(code) && doctorCbos.length > 0) {
            const allowedCbos = remoteCbosMap.get(code) || remoteCbosMap.get(digits)
            if (allowedCbos && allowedCbos.length > 0) {
              const isCompatible = checkCboCompatibility(doctorCbos, allowedCbos)
              if (!isCompatible) {
                hasDivergentProcedure = true
              }
            }
          }

          return {
            procedure_code: code,
            procedure_description: desc,
            value_reais: Number.isFinite(val) ? val : 0,
            cbo: String(r?.sp_pf_cbo || ''),
            sequence: idx + 1,
            sp_ptsp: Number.isFinite(ptsp) ? ptsp : undefined,
            aih_id: entry.aihKey,
          }
        })

        const baseProcedures = getCalculableProcedures(procedureList as any)
        const proceduresWithPayment = (baseProcedures as any[])
          .filter((p: any) => isMedicalProcedure(p.procedure_code))
          .sort((a: any, b: any) => {
            const sa = typeof a.sequence === 'number' ? a.sequence : 9999
            const sb = typeof b.sequence === 'number' ? b.sequence : 9999
            if (sa !== sb) return sa - sb
            const va = typeof a.value_reais === 'number' ? a.value_reais : 0
            const vb = typeof b.value_reais === 'number' ? b.value_reais : 0
            return vb - va
          })
          .map((p: any) => ({
            procedure_code: p.procedure_code,
            procedure_description: p.procedure_description,
            value_reais: p.value_reais || 0,
            cbo: p.cbo,
            sequence: p.sequence,
          }))

        // Se não tiver procedimentos cirúrgicos (04.*) e tivermos info remota, tentar exibir procedimento principal
        let proceduresDisplay = buildProceduresDisplay(proceduresWithPayment)
        if (proceduresWithPayment.length === 0 && (entry.diag_princ || spAll.length > 0)) {
           // Tentar pegar do diag_princ ou do primeiro procedimento SP
           let mainDesc = ''
           if (spAll.length > 0) {
             // Tentar achar o principal no SP (geralmente seq 1 ou maior valor)
             const mainSp = spAll.reduce((prev: any, curr: any) => {
               const vPrev = Number(prev?.sp_ptsp || 0)
               const vCurr = Number(curr?.sp_ptsp || 0)
               return vCurr > vPrev ? curr : prev
             }, spAll[0])
             const code = formatSigtapCode(String(mainSp?.sp_atoprof || ''))
             const digits = code.replace(/\D/g, '')
             mainDesc = remoteDescMap.get(code) || remoteDescMap.get(digits) || sigtapLocalMap.get(code) || sigtapLocalMap.get(digits) || ''
             if (mainDesc) proceduresDisplay = `(Clínico) ${cleanProcedureDescription(code, mainDesc)}`
           }
           if (!mainDesc && entry.diag_princ) {
             proceduresDisplay = `(CID Principal) ${entry.diag_princ}`
           }
        }

        let repasseValue = 0
        if (knownDoctorName && proceduresWithPayment.length > 0) {
          const paymentResult = calculateDoctorPayment(knownDoctorName, proceduresWithPayment as any, hospitalId)
          repasseValue = isMonthly ? 0 : (paymentResult.totalPayment || 0)
        }

        const hospName = hospitalId ? (hospitalNameById.get(String(hospitalId)) || '') : ''
        const dhKey = `${chosenCns || 'NO_CNS'}||${String(hospitalId || '')}`
        const prev = totalsByDoctorHospital.get(dhKey) || { total: 0, isMonthly, fixed: fixedCalc.calculatedPayment || 0, fixedRule: fixedCalc.appliedRule || '', hospitalId, hospitalName: hospName, doctorName: doctorDisplay }
        totalsByDoctorHospital.set(dhKey, {
          total: prev.total + repasseValue,
          isMonthly,
          fixed: fixedCalc.calculatedPayment || prev.fixed || 0,
          fixedRule: fixedCalc.appliedRule || prev.fixedRule || '',
          hospitalId,
          hospitalName: hospName || prev.hospitalName,
          doctorName: doctorDisplay
        })

        {
          const hasAih = normalizeAih(entry.aihNumber).length > 0
          const isRemote = hasAih ? remoteRdByAih.has(entry.aihKey) : false
          const hasProcedures04 = proceduresWithPayment.length > 0
          const id = `${entry.aihKey || 'NOAIH'}::${chosenCns || 'NOCNS'}::${rowsDetailed.length}`
          
          // Formatar coluna Caráter
          const specName = getSpecialtyName(entry.espec)
          const carName = CareCharacterUtils.getDescription(String(entry.car_int || '').replace(/^0+/, ''))
          const caraterDisplay = (entry.espec || entry.car_int) 
            ? `${specName} / ${carName}`
            : '-'

          rowsDetailed.push({
            id,
            isRemote,
            hasAih,
            hasProcedures04,
            repasseValue,
            isDivergent: hasDivergentProcedure,
            cells: [
              entry.aihNumber || '-',
              doctorDisplay,
              entry.prontuario || '-',
              entry.patientName || 'Paciente',
              proceduresDisplay,
              parseISODateToLocal(entry.dischargeISO),
              caraterDisplay,
              entry.competencia ? formatCompetenciaDisplay(entry.competencia) : '-',
              formatCurrency(repasseValue),
            ]
          })
        }
      })

      Array.from(totalsByDoctorHospital.entries()).forEach(([, t]) => {
        if (t.isMonthly && t.fixed > 0) {
          const name = t.doctorName
          const labelHosp = t.hospitalName ? ` (${t.hospitalName})` : ''
          const id = `FIXO::${name}::${rowsDetailed.length}`
          rowsDetailed.push({
            id,
            isRemote: false,
            hasAih: false,
            hasProcedures04: false,
            repasseValue: t.fixed,
            cells: [
              '-',
              name,
              '-',
              `PAGAMENTO FIXO MENSAL${labelHosp}`,
              t.fixedRule || 'Valor Fixo',
              '-',
              '-',
              formatCurrency(t.fixed),
            ]
          })
        }
      })

      const remoteAihFoundCount = selectedHospital !== 'all' ? remoteRdByAih.size : remoteFoundAihKeys.size
      const missingInRemoteCount = Math.max(localAihFilledCount - remoteAihFoundCount, 0)
      const info = {
        hospitalLabel,
        doctorLabel,
        specialtyLabel,
        dischargeFrom,
        dischargeTo,
        remoteAihFoundCount,
        localAihFilledCount,
        missingInRemoteCount,
        localNoAihCount,
        competenciasLabel,
      }

      const sorted = [...rowsDetailed].sort((a, b) => {
        const rank = (r: PreviewRow) => {
          if (!r.hasAih) return 3
          if (!r.hasProcedures04) return 2
          return r.isRemote ? 0 : 1
        }
        const ra = rank(a)
        const rb = rank(b)
        if (ra !== rb) return ra - rb
        if (ra === 2) {
          if (a.isRemote !== b.isRemote) return a.isRemote ? -1 : 1
        }
        if (a.repasseValue !== b.repasseValue) return (b.repasseValue || 0) - (a.repasseValue || 0)
        const docA = (a.cells[1] || '').toString().localeCompare((b.cells[1] || '').toString(), 'pt-BR')
        if (docA !== 0) return docA
        return (a.cells[3] || '').toString().localeCompare((b.cells[3] || '').toString(), 'pt-BR')
      })

      if (selectedDoctor !== 'all') {
        setPreviewRows(sorted)
        setPreviewInfo(info)
        setPreviewMode(true)
        return
      }

      if (format === 'pdf') savePdfReport(sorted, info)
      else saveExcelReport(sorted, info)
      toast.success('Relatório gerado com sucesso!')
    } catch (e: any) {
      console.error('Erro ao gerar relatório (Fonte Híbrida):', e)
      const msg = String(e?.message || e?.error_description || e?.details || e || '').trim()
      toast.error(msg ? `Erro ao gerar relatório: ${msg}` : 'Erro ao gerar relatório')
    } finally {
      setGenerating(false)
    }
  }

  const previewTotal = useMemo(() => {
    return (previewRows || []).reduce((s, r) => s + (r.repasseValue || 0), 0)
  }, [previewRows])

  const handleConfirmPreview = async (format: 'pdf' | 'excel') => {
    if (!previewInfo) return
    try {
      setGenerating(true)
      if (format === 'pdf') savePdfReport(previewRows, previewInfo)
      else saveExcelReport(previewRows, previewInfo)
      toast.success('Relatório gerado com sucesso!')
      setPreviewMode(false)
      setPreviewRows([])
      setPreviewInfo(null)
      onOpenChange(false)
    } catch (e: any) {
      const msg = String(e?.message || e || '').trim()
      toast.error(msg ? `Erro ao gerar relatório: ${msg}` : 'Erro ao gerar relatório')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Fonte Híbrida</DialogTitle>
        </DialogHeader>

        {!previewMode ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-center gap-2 text-lg font-semibold text-black">
                    <Building className="h-5 w-5" />
                    Unidade Hospitalar
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select value={selectedHospital} onValueChange={setSelectedHospital} disabled={loadingHospitals || generating}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingHospitals ? 'Carregando...' : 'Selecione'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Hospitais</SelectItem>
                      {(hospitals || []).map(h => (
                        <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {loadingHospitals && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Carregando hospitais...
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-center gap-2 text-lg font-semibold text-black">
                    <Stethoscope className="h-5 w-5" />
                    Médico
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty} disabled={loadingDoctors || generating}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingDoctors ? 'Carregando...' : 'Especialidade'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as especialidades</SelectItem>
                      {specialties.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedDoctor} onValueChange={setSelectedDoctor} disabled={loadingDoctors || generating}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingDoctors ? 'Carregando...' : 'Selecione'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Médicos</SelectItem>
                      {filteredDoctors.map(d => (
                        <SelectItem key={d.cns} value={d.cns}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {loadingDoctors && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Carregando médicos...
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-center gap-2 text-lg font-semibold text-black">
                    <Calendar className="h-5 w-5" />
                    Data de Alta (Início/Fim)
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-neutral-700">Início (Altas)</div>
                    <Input
                      type="date"
                      value={inputDischargeFrom}
                      onChange={(e) => {
                        const v = e.target.value
                        setInputDischargeFrom(v)
                        setDischargeFrom(v)
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
                      disabled={generating}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-neutral-700">Fim (Altas)</div>
                    <Input
                      type="date"
                      value={inputDischargeTo}
                      onChange={(e) => {
                        const v = e.target.value
                        setInputDischargeTo(v)
                        setDischargeTo(v)
                        setDischargeFrom(inputDischargeFrom || '')
                      }}
                      disabled={generating}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-center gap-2 text-lg font-semibold text-black">
                    <Calendar className="h-5 w-5" />
                    Competência SIH
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingCompetencias ? (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Carregando competências...
                    </div>
                  ) : availableCompetencias.length === 0 ? (
                    <div className="text-xs text-gray-500">Nenhuma competência disponível{selectedHospital !== 'all' ? ' para este hospital' : ''}.</div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setSelectedCompetencias(selectedCompetencias.length === availableCompetencias.length ? [] : [...availableCompetencias])}
                          disabled={generating}
                        >
                          {selectedCompetencias.length === availableCompetencias.length ? 'Limpar' : 'Selecionar Todas'}
                        </Button>
                        {selectedCompetencias.length > 0 && (
                          <span className="text-xs text-gray-600">{selectedCompetencias.length} selecionada(s)</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {availableCompetencias.map(c => {
                          const isSelected = selectedCompetencias.includes(c)
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setSelectedCompetencias(prev =>
                                  isSelected ? prev.filter(x => x !== c) : [...prev, c]
                                )
                              }}
                              disabled={generating}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${isSelected
                                ? 'bg-black text-white border-black'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                                }`}
                            >
                              {isSelected && <Check className="h-3.5 w-3.5" />}
                              {formatCompetenciaDisplay(c)}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
                Fechar
              </Button>
              <Button
                variant="default"
                onClick={() => handleGeneratePdf('pdf')}
                disabled={generating}
                className="bg-black hover:bg-neutral-800 text-white inline-flex items-center gap-2"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Repasse SIH (PDF)
              </Button>
              <Button
                variant="default"
                onClick={() => handleGeneratePdf('excel')}
                disabled={generating}
                className="bg-[#0b1736] hover:bg-[#09122a] text-white inline-flex items-center gap-2"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                Repasse SIH (Excel)
              </Button>
            </div>
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <div className="text-lg font-semibold text-black">Pré-visualização do relatório</div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-700">
                <div>Linhas: <span className="font-semibold text-black">{previewRows.length}</span></div>
                <div>Valor Total: <span className="font-semibold text-green-700">{formatCurrency(previewTotal)}</span></div>
              </CardContent>
            </Card>

            <div className="border rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="w-24">AIH</TableHead>
                    <TableHead>Médico</TableHead>
                    <TableHead className="w-28">Prontuário</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Procedimentos</TableHead>
                    <TableHead className="w-24">Alta</TableHead>
                    <TableHead className="w-24">Competência</TableHead>
                    <TableHead className="w-28 text-right">Repasse</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((r, idx) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-center">{idx + 1}</TableCell>
                      <TableCell className="text-center">{r.cells[0]}</TableCell>
                      <TableCell>{r.cells[1]}</TableCell>
                      <TableCell className="text-center">{r.cells[2]}</TableCell>
                      <TableCell>{r.cells[3]}</TableCell>
                      <TableCell className="text-xs">{r.cells[4]}</TableCell>
                      <TableCell className="text-center">{r.cells[5]}</TableCell>
                      <TableCell className="text-center">{r.cells[6]}</TableCell>
                      <TableCell className="text-right font-semibold">{r.cells[7]}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewRows(prev => prev.filter(x => x.id !== r.id))}
                          disabled={generating}
                          className="h-7 w-7 p-0"
                          title="Apagar linha"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setPreviewMode(false)
                  setPreviewRows([])
                  setPreviewInfo(null)
                }}
                disabled={generating}
              >
                Voltar
              </Button>
              <Button
                variant="default"
                onClick={() => handleConfirmPreview('pdf')}
                disabled={generating || previewRows.length === 0}
                className="bg-black hover:bg-neutral-800 text-white inline-flex items-center gap-2"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                PDF
              </Button>
              <Button
                variant="default"
                onClick={() => handleConfirmPreview('excel')}
                disabled={generating || previewRows.length === 0}
                className="bg-[#0b1736] hover:bg-[#09122a] text-white inline-flex items-center gap-2"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                Excel
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
