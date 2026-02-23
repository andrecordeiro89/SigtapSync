import React, { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Card, CardContent, CardHeader } from './ui/card'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Input } from './ui/input'
import { Building, Calendar, FileText, Loader2, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import { supabase } from '../lib/supabase'
import { DoctorsCrudService } from '../services/doctorsCrudService'

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
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      doc.setFontSize(14)
      doc.text('Repasse Médico (Fonte Híbrida)', 40, 40)
      doc.setFontSize(10)
      doc.text(`Unidade Hospitalar: ${hospitalLabel}`, 40, 60)
      doc.text(`Especialidade: ${specialtyLabel}`, 40, 74)
      doc.text(`Médico: ${doctorLabel}`, 40, 88)
      doc.text(`Data Alta: ${formatDateRangeLabel(dischargeFrom, dischargeTo)}`, 40, 102)
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 40, 116)
      doc.setFontSize(10)
      doc.text('Relatório em construção: a lógica de busca e cálculo será adicionada em seguida.', 40, 140)
      doc.save(`Repasse_Medico_Fonte_Hibrida_${new Date().toISOString().slice(0, 10)}.pdf`)
      toast.success('PDF gerado (modelo inicial)')
    } catch (e: any) {
      toast.error('Erro ao gerar PDF')
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
