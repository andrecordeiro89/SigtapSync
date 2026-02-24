import React, { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Card, CardContent, CardHeader } from './ui/card'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Input } from './ui/input'
import { Building, Calendar, FileText, Loader2, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
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

export default function HybridSourceDialog({ open, onOpenChange }: HybridSourceDialogProps) {
  const [hospitals, setHospitals] = useState<HospitalOption[]>([])
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [selectedHospital, setSelectedHospital] = useState<string>('all')
  const [selectedDoctor, setSelectedDoctor] = useState<string>('all')
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all')
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
    setDischargeFrom('')
    setDischargeTo('')
    setInputDischargeFrom('')
    setInputDischargeTo('')
  }, [open])

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

  const handleGeneratePdf = async () => {
    try {
      if (!dischargeFrom || !dischargeTo) {
        toast.error('Por favor, selecione um período de alta.')
        return
      }

      setGenerating(true)
      if (!supabaseSih) {
        toast.error('Fonte SIH remota não configurada')
        return
      }

      const endExclusive = (() => {
        const d = new Date(dischargeTo)
        d.setDate(d.getDate() + 1)
        return d.toISOString().slice(0, 10)
      })()

      const localRows: Array<{ aih: string; patient_name?: string; data_saida?: string; hospital_id?: string }> = []
      const pageSize = 1000
      let offset = 0
      for (; ;) {
        let q = supabase
          .from('gsus_aihs_patients')
          .select('aih, patient_name, data_saida, hospital_id')
          .gte('data_saida', dischargeFrom)
          .lt('data_saida', endExclusive)
          .range(offset, offset + pageSize - 1)
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
          })
        })
        if (batch.length < pageSize) break
        offset += pageSize
      }

      const aihKeys = Array.from(new Set(localRows.map(r => normalizeAih(r.aih)).filter(Boolean)))
      if (aihKeys.length === 0) {
        toast.warning('Nenhuma AIH encontrada no banco local para os filtros selecionados')
        return
      }

      const compFilter = (() => {
        try {
          const from = new Date(dischargeFrom)
          const to = new Date(dischargeTo)
          const same =
            from.getUTCFullYear() === to.getUTCFullYear() &&
            from.getUTCMonth() === to.getUTCMonth()
          if (!same) return null
          return { year: from.getUTCFullYear(), month: from.getUTCMonth() + 1 }
        } catch {
          return null
        }
      })()

      const chunk = <T,>(arr: T[], size = 80): T[][] => {
        const out: T[][] = []
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
        return out
      }

      const spRows: any[] = []
      for (const ch of chunk(aihKeys, 80)) {
        let spQuery = supabaseSih
          .from('sih_sp')
          .select('sp_naih, sp_atoprof, sp_qt_proc, sp_qtd_ato, sp_valato, sp_pf_doc, sp_pf_cbo, sp_mm, sp_aa')
          .in('sp_naih', ch)
        if (compFilter) {
          spQuery = spQuery.eq('sp_aa', compFilter.year).eq('sp_mm', compFilter.month)
        }
        const { data, error } = await spQuery
        if (error) throw error
        if (data && data.length > 0) spRows.push(...data)
      }

      const spByAih = new Map<string, any[]>()
      spRows.forEach((r) => {
        const key = normalizeAih(r?.sp_naih)
        if (!key) return
        if (!spByAih.has(key)) spByAih.set(key, [])
        spByAih.get(key)!.push(r)
      })

      const responsibleCnsByAih = new Map<string, string>()
      for (const [aihKey, rows] of spByAih.entries()) {
        const perCns = new Map<string, { sum: number; hasNonAnesth: boolean }>()
        rows.forEach((r: any) => {
          const cns = String(r?.sp_pf_doc || '').trim()
          if (!cns) return
          const qty = Number(r?.sp_qtd_ato ?? r?.sp_qt_proc ?? 1) || 1
          const val = Number(r?.sp_valato || 0) * qty
          const cbo = String(r?.sp_pf_cbo || '').trim()
          const prev = perCns.get(cns) || { sum: 0, hasNonAnesth: false }
          perCns.set(cns, { sum: prev.sum + (Number.isFinite(val) ? val : 0), hasNonAnesth: prev.hasNonAnesth || (cbo && cbo !== '225151') })
        })
        if (perCns.size === 0) continue
        const entries = Array.from(perCns.entries())
        const preferred = entries.filter(([, v]) => v.hasNonAnesth)
        const candidates = preferred.length > 0 ? preferred : entries
        candidates.sort((a, b) => {
          const diff = (b[1].sum || 0) - (a[1].sum || 0)
          if (diff !== 0) return diff
          return a[0].localeCompare(b[0])
        })
        responsibleCnsByAih.set(aihKey, candidates[0][0])
      }

      const uniqueLocalByAih = new Map<string, { aih: string; patient_name?: string; data_saida?: string; hospital_id?: string }>()
      localRows.forEach((r) => {
        const k = normalizeAih(r.aih)
        if (!k) return
        if (!uniqueLocalByAih.has(k)) uniqueLocalByAih.set(k, r)
      })

      const reportEntries: Array<{
        aihKey: string
        aihNumber: string
        patientName: string
        dischargeISO: string
        hospitalId?: string
        doctorCns: string
      }> = []

      for (const [aihKey, r] of uniqueLocalByAih.entries()) {
        const doctorCns = responsibleCnsByAih.get(aihKey) || ''
        if (selectedDoctor !== 'all' && doctorCns !== selectedDoctor) continue
        reportEntries.push({
          aihKey,
          aihNumber: normalizeAih(r.aih),
          patientName: (r.patient_name || '').trim() || 'Paciente',
          dischargeISO: (r.data_saida || '').trim(),
          hospitalId: r.hospital_id,
          doctorCns: doctorCns || 'NAO_IDENTIFICADO',
        })
      }

      if (reportEntries.length === 0) {
        toast.warning('Nenhum registro encontrado para os filtros selecionados')
        return
      }

      const cnsSet = Array.from(new Set(reportEntries.map(e => e.doctorCns).filter(cns => cns && cns !== 'NAO_IDENTIFICADO')))
      const doctorByCns = new Map<string, { name: string; specialty: string }>()
      if (cnsSet.length > 0) {
        const { data: doctorRows, error: doctorErr } = await supabase
          .from('doctors')
          .select('name,cns,specialty')
          .in('cns', cnsSet)
        if (doctorErr) throw doctorErr
        ;(doctorRows || []).forEach((d: any) => {
          const cns = String(d.cns || '').trim()
          if (!cns) return
          doctorByCns.set(cns, { name: String(d.name || '').trim(), specialty: String(d.specialty || '').trim() })
        })
      }

      const filteredEntries = reportEntries.filter((e) => {
        if (selectedSpecialty === 'all') return true
        const spec = doctorByCns.get(e.doctorCns)?.specialty || ''
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
      try {
        const { data: procRows } = await supabaseSih
          .from('sigtap_procedimentos')
          .select('code, description')
          .in('code', Array.from(new Set([...codes, ...codesPlain])))
        ;(procRows || []).forEach((p: any) => {
          const code = String(p.code || '').trim()
          const desc = String(p.description || '').trim()
          if (code && desc) remoteDescMap.set(code, desc)
        })
      } catch { }

      const rowsOut: Array<Array<string>> = []
      const totalsByDoctor = new Map<string, { total: number; isMonthly: boolean; fixed: number; fixedRule: string }>()

      filteredEntries.forEach((entry) => {
        const doctorName =
          entry.doctorCns === 'NAO_IDENTIFICADO'
            ? '⚠️ Médico Não Identificado'
            : (doctorByCns.get(entry.doctorCns)?.name || `Dr(a). CNS ${entry.doctorCns}`)
        const hospitalId = entry.hospitalId
        const isMonthly = isFixedMonthlyPayment(doctorName, hospitalId, ALL_HOSPITAL_RULES)
        const fixedCalc = calculateFixedPayment(doctorName, hospitalId, ALL_HOSPITAL_RULES)

        const sp = spByAih.get(entry.aihKey) || []
        const procRows = sp.filter((r: any) => String(r?.sp_pf_doc || '').trim() === entry.doctorCns)
        const procedureList = procRows.map((r: any, idx: number) => {
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
          return {
            procedure_code: code,
            procedure_description: desc,
            value_reais: Number.isFinite(val) ? val : 0,
            cbo: String(r?.sp_pf_cbo || ''),
            sequence: idx + 1,
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

        const proceduresDisplay = (() => {
          const labels = proceduresWithPayment
            .map((m: any) => String(m.procedure_description || '').trim() || (m.procedure_code ? `Procedimento ${m.procedure_code}` : 'Procedimento'))
            .filter(Boolean)
          return labels.length > 0 ? labels.join(' + ') : 'Sem procedimentos 04.*'
        })()

        let repasseValue = 0
        if (proceduresWithPayment.length > 0) {
          const paymentResult = calculateDoctorPayment(doctorName, proceduresWithPayment as any, hospitalId)
          repasseValue = isMonthly ? 0 : (paymentResult.totalPayment || 0)
        }

        const prev = totalsByDoctor.get(entry.doctorCns) || { total: 0, isMonthly, fixed: fixedCalc.calculatedPayment || 0, fixedRule: fixedCalc.appliedRule || '' }
        totalsByDoctor.set(entry.doctorCns, {
          total: prev.total + repasseValue,
          isMonthly,
          fixed: fixedCalc.calculatedPayment || prev.fixed || 0,
          fixedRule: fixedCalc.appliedRule || prev.fixedRule || '',
        })

        rowsOut.push([
          '',
          doctorName,
          entry.aihNumber || '-',
          entry.patientName,
          proceduresDisplay,
          parseISODateToLocal(entry.dischargeISO),
          formatCurrency(repasseValue),
        ])
      })

      Array.from(totalsByDoctor.entries()).forEach(([cns, t]) => {
        if (t.isMonthly && t.fixed > 0) {
          const name =
            cns === 'NAO_IDENTIFICADO'
              ? '⚠️ Médico Não Identificado'
              : (doctorByCns.get(cns)?.name || `Dr(a). CNS ${cns}`)
          rowsOut.push([
            '',
            name,
            '',
            'PAGAMENTO FIXO MENSAL',
            t.fixedRule || 'Valor Fixo',
            '-',
            formatCurrency(t.fixed),
          ])
        }
      })

      const parseBrCurrency = (s: unknown): number => {
        const raw = (s ?? '').toString()
        const cleaned = raw
          .replace(/[^\d,.-]/g, '')
          .replace(/\./g, '')
          .replace(/,/, '.')
        const n = Number(cleaned)
        return Number.isFinite(n) ? n : 0
      }

      rowsOut.sort((a, b) => {
        const repA = parseBrCurrency(a[6])
        const repB = parseBrCurrency(b[6])
        if (repA !== repB) return repB - repA
        const docA = (a[1] || '').toString().localeCompare((b[1] || '').toString(), 'pt-BR')
        if (docA !== 0) return docA
        return (a[3] || '').toString().localeCompare((b[3] || '').toString(), 'pt-BR')
      })
      rowsOut.forEach((r, idx) => { r[0] = String(idx + 1) })

      const globalTotal = Array.from(totalsByDoctor.values()).reduce((acc, t) => {
        if (t.isMonthly && t.fixed > 0) return acc + t.fixed
        return acc + (t.total || 0)
      }, 0)

      const doc = new jsPDF('landscape')
      const pageWidth = doc.internal.pageSize.getWidth()
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 51, 102)
      doc.text('RELATÓRIO DE REPASSE MÉDICO (FONTE HÍBRIDA)', pageWidth / 2, 24, { align: 'center' })
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text(`Unidade Hospitalar: ${hospitalLabel}`, 20, 40)
      doc.text(`Especialidade: ${specialtyLabel}`, 20, 54)
      doc.text(`Médico: ${doctorLabel}`, 20, 68)
      doc.text(`Data Alta: ${formatDateRangeLabel(dischargeFrom, dischargeTo)}`, 20, 82)
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 20, 96)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 102, 0)
      doc.text(`Valor Total: ${formatCurrency(globalTotal)}`, pageWidth - 20, 40, { align: 'right' })

      autoTable(doc, {
        head: [['#', 'Médico', 'Nº da AIH', 'Nome do Paciente', 'Procedimentos', 'Data Alta', 'Valor de Repasse']],
        body: rowsOut,
        startY: 110,
        theme: 'striped',
        headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, halign: 'center', cellPadding: 2 },
        bodyStyles: { fontSize: 8, textColor: [50, 50, 50], cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 'auto', halign: 'center' },
          1: { cellWidth: 'auto', halign: 'left' },
          2: { cellWidth: 'auto', halign: 'center' },
          3: { cellWidth: 'auto', halign: 'left' },
          4: { cellWidth: 'auto', halign: 'left', fontSize: 7 },
          5: { cellWidth: 'auto', halign: 'center' },
          6: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold', textColor: [0, 102, 0] }
        },
        styles: { overflow: 'linebreak', cellPadding: 2, fontSize: 8 },
        margin: { left: 20, right: 20 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      })

      doc.save(`Repasse_Medico_Fonte_Hibrida_${new Date().toISOString().slice(0, 10)}.pdf`)
      toast.success('Relatório gerado com sucesso!')
    } catch (e: any) {
      console.error('Erro ao gerar PDF (Fonte Híbrida):', e)
      const msg = String(e?.message || e?.error_description || e?.details || e || '').trim()
      toast.error(msg ? `Erro ao gerar PDF: ${msg}` : 'Erro ao gerar PDF')
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
                  onChange={(e) => setInputDischargeFrom(e.target.value)}
                  onBlur={() => setDischargeFrom(inputDischargeFrom)}
                  disabled={generating}
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-neutral-700">Fim (Altas)</div>
                <Input
                  type="date"
                  value={inputDischargeTo}
                  onChange={(e) => setInputDischargeTo(e.target.value)}
                  onBlur={() => setDischargeTo(inputDischargeTo)}
                  disabled={generating}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Fechar
          </Button>
          <Button
            variant="default"
            onClick={handleGeneratePdf}
            disabled={generating}
            className="bg-black hover:bg-neutral-800 text-white inline-flex items-center gap-2"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Repasse Médico (PDF)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
