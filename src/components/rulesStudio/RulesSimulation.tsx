import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Switch } from '../ui/switch'
import { Textarea } from '../ui/textarea'
import { Badge } from '../ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { DoctorsHierarchyV2Service } from '../../services/doctorsHierarchyV2'
import { getCalculableProcedures } from '../../utils/anesthetistLogic'
import { calculateDoctorPayment, calculateFixedPayment, calculatePercentagePayment, formatCurrency, withDoctorPaymentRulesOverrides, getBaseHospitalRules, type DoctorPaymentRule, type DoctorPaymentRulesOverrides } from '../../config/doctorPaymentRules'
import { computeIncrementForProcedures, isDoctorCoveredForOperaParana } from '../../config/operaParana'
import { supabase } from '../../lib/supabase'
import { DoctorPaymentRulesOverridesService } from '../../services/doctorPaymentRulesOverridesService'
import { HOSPITAL_MAPPINGS } from '../../config/doctorPaymentRules/utils'

type DoctorCard = any

const normalizeDoctorKey = (s: string): string => String(s || '').trim().toUpperCase()

const buildSingleDoctorOverride = (hospitalKey: string, doctorNameUpper: string, rule: DoctorPaymentRule): DoctorPaymentRulesOverrides => ({
  hospitals: {
    [hospitalKey]: {
      [doctorNameUpper]: rule
    }
  }
})

const getHospitalKeyFromId = (hospitalId?: string): string | null => {
  if (!hospitalId) return null
  const m = (HOSPITAL_MAPPINGS as any[]).find((x) => x.id === hospitalId)
  return m?.key || null
}

const computePatientProcedures04 = (patient: any) => {
  const raw = Array.isArray(patient?.procedures) ? patient.procedures : []
  const calculable = getCalculableProcedures(
    raw.map((p: any) => ({
      procedure_code: p.procedure_code,
      procedure_description: p.procedure_description,
      value_reais: Number(p.value_reais || 0),
      cbo: p.cbo,
      sequence: (p as any).sequence,
      aih_id: p.aih_id
    }))
  )
  return calculable.filter((p: any) => String(p.procedure_code || '').trim().startsWith('04'))
}

const computePatientPayment = (doctorName: string, procedures04: any[], hospitalId: string | undefined, percentageBase: number) => {
  const fixed = calculateFixedPayment(doctorName, hospitalId)
  if (fixed.hasFixedRule) {
    return { total: fixed.calculatedPayment, appliedRule: fixed.appliedRule, mode: 'fixo' as const }
  }
  const perc = calculatePercentagePayment(doctorName, percentageBase, hospitalId)
  if (perc.hasPercentageRule) {
    return { total: perc.calculatedPayment, appliedRule: perc.appliedRule, mode: 'percentual' as const }
  }
  const calc = calculateDoctorPayment(doctorName, procedures04 as any, hospitalId)
  return { total: calc.totalPayment, appliedRule: calc.appliedRule, mode: 'procedimentos' as const }
}

export default function RulesSimulation() {
  const [hospitals, setHospitals] = useState<Array<{ id: string; name: string }>>([])
  const [hospitalId, setHospitalId] = useState<string>('')
  const [dateFromISO, setDateFromISO] = useState<string>('')
  const [dateToISO, setDateToISO] = useState<string>('')
  const [careCharacter, setCareCharacter] = useState<string>('all')

  const [loading, setLoading] = useState(false)
  const [cards, setCards] = useState<DoctorCard[]>([])
  const [doctorKey, setDoctorKey] = useState<string>('')
  const [patientKey, setPatientKey] = useState<string>('')

  const [draftRuleText, setDraftRuleText] = useState<string>('')
  const [draftError, setDraftError] = useState<string | null>(null)
  const [includeOperaParanaInBase, setIncludeOperaParanaInBase] = useState(false)

  const loadHospitals = async () => {
    try {
      const { data, error } = await supabase.from('hospitals').select('id,name').order('name')
      if (error) throw error
      setHospitals((data || []) as any)
      if (!hospitalId && data && data.length > 0) setHospitalId(data[0].id)
    } catch (e: any) {
      toast.error(`Falha ao carregar hospitais: ${String(e?.message || e)}`)
    }
  }

  useEffect(() => {
    if (!hospitals.length) loadHospitals()
  }, [hospitals.length])

  const loadData = async () => {
    if (!hospitalId) {
      toast.error('Selecione um hospital')
      return
    }
    setLoading(true)
    try {
      const res = await DoctorsHierarchyV2Service.getDoctorsHierarchyV2({
        hospitalIds: [hospitalId],
        dateFromISO: dateFromISO || undefined,
        dateToISO: dateToISO || undefined,
        careCharacter: careCharacter || 'all'
      })
      setCards(res as any)
      const first = res?.[0]
      const dk = first ? normalizeDoctorKey(first?.doctor_info?.name || '') : ''
      setDoctorKey(dk)
      const firstPatient = first?.patients?.[0]
      setPatientKey(firstPatient ? String(firstPatient?.aih_id || firstPatient?.patient_id || '') : '')
      toast.success(`Carregado: ${res?.length || 0} médicos`)
    } catch (e: any) {
      toast.error(`Falha ao carregar dados: ${String(e?.message || e)}`)
    } finally {
      setLoading(false)
    }
  }

  const selectedDoctor = useMemo(() => {
    const key = normalizeDoctorKey(doctorKey)
    return cards.find((c: any) => normalizeDoctorKey(c?.doctor_info?.name || '') === key) || null
  }, [cards, doctorKey])

  const selectedPatient = useMemo(() => {
    const list = selectedDoctor?.patients || []
    return list.find((p: any) => String(p?.aih_id || p?.patient_id || '') === String(patientKey)) || null
  }, [selectedDoctor, patientKey])

  const procedures04 = useMemo(() => (selectedPatient ? computePatientProcedures04(selectedPatient) : []), [selectedPatient])
  const proceduresForIncrement = useMemo(() => {
    if (!selectedPatient) return []
    const raw = Array.isArray(selectedPatient?.procedures) ? selectedPatient.procedures : []
    return getCalculableProcedures(
      raw.map((p: any) => ({
        procedure_code: p.procedure_code,
        value_reais: Number(p.value_reais || 0),
        cbo: p.cbo,
        sequence: (p as any).sequence,
        aih_id: p.aih_id
      }))
    )
  }, [selectedPatient])

  const care = (selectedPatient as any)?.aih_info?.care_character
  const increment = useMemo(() => {
    if (!selectedDoctor || !hospitalId) return 0
    const doctorName = selectedDoctor?.doctor_info?.name || ''
    const covered = isDoctorCoveredForOperaParana(doctorName, hospitalId)
    if (!covered) return 0
    return computeIncrementForProcedures(proceduresForIncrement as any, care, doctorName, hospitalId) || 0
  }, [selectedDoctor, hospitalId, proceduresForIncrement.length, care])

  const baseSum = procedures04.reduce((s: number, p: any) => s + Number(p.value_reais || 0), 0)
  const baseSumEffective = includeOperaParanaInBase ? baseSum + increment : baseSum

  const parseDraftRule = (): DoctorPaymentRule | null => {
    const t = String(draftRuleText || '').trim()
    if (!t) {
      setDraftError(null)
      return null
    }
    try {
      const obj = JSON.parse(t)
      setDraftError(null)
      return obj as any
    } catch (e: any) {
      setDraftError(String(e?.message || e))
      return null
    }
  }

  const currentResult = useMemo(() => {
    if (!selectedDoctor || !selectedPatient) return null
    const doctorName = selectedDoctor?.doctor_info?.name || ''
    const out = computePatientPayment(doctorName, procedures04 as any, hospitalId || undefined, baseSumEffective)
    return { ...out, baseSum }
  }, [selectedDoctor, selectedPatient, procedures04.length, hospitalId, baseSum, baseSumEffective])

  const draftResult = useMemo(() => {
    if (!selectedDoctor || !selectedPatient) return null
    const draft = parseDraftRule()
    if (!draft) return null
    const doctorName = selectedDoctor?.doctor_info?.name || ''
    const doctorNameUpper = normalizeDoctorKey(doctorName)
    const hospitalKey = getHospitalKeyFromId(hospitalId)
    if (!hospitalKey) return null
    const overrides = buildSingleDoctorOverride(hospitalKey, doctorNameUpper, { ...draft, doctorName: doctorNameUpper })
    const res = withDoctorPaymentRulesOverrides(overrides, () =>
      computePatientPayment(doctorName, procedures04 as any, hospitalId || undefined, baseSumEffective)
    )
    return { ...res, baseSum: baseSumEffective }
  }, [selectedDoctor, selectedPatient, procedures04.length, hospitalId, draftRuleText, includeOperaParanaInBase, baseSumEffective])

  const loadCurrentAsDraft = async () => {
    if (!selectedDoctor) return
    try {
      const store = await DoctorPaymentRulesOverridesService.load()
      const hospitalKey = getHospitalKeyFromId(hospitalId)
      const doctorNameUpper = normalizeDoctorKey(selectedDoctor?.doctor_info?.name || '')
      const fromOverride = store.hospitals?.[hospitalKey || '']?.[doctorNameUpper]
      if (fromOverride) {
        setDraftRuleText(JSON.stringify(fromOverride, null, 2))
        return
      }
      const baseRules = getBaseHospitalRules()
      const baseRule = (baseRules as any)?.[hospitalKey || '']?.[doctorNameUpper]
      setDraftRuleText(JSON.stringify(baseRule || { doctorName: doctorNameUpper, rules: [] }, null, 2))
    } catch {
      setDraftRuleText('')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Simulação (mesmo cenário da aba Profissionais)</CardTitle>
          <Button onClick={loadData} disabled={loading}>
            Carregar dados reais
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Hospital</div>
              <Select value={hospitalId} onValueChange={setHospitalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {hospitals.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Admissão (de)</div>
              <Input value={dateFromISO} onChange={(e) => setDateFromISO(e.target.value)} placeholder="YYYY-MM-DD" />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Alta (até)</div>
              <Input value={dateToISO} onChange={(e) => setDateToISO(e.target.value)} placeholder="YYYY-MM-DD" />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Caráter</div>
              <Select value={careCharacter} onValueChange={setCareCharacter}>
                <SelectTrigger>
                  <SelectValue placeholder="all" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="1">Eletivo</SelectItem>
                  <SelectItem value="2">Urgência</SelectItem>
                  <SelectItem value="3">Acidente no local de trabalho</SelectItem>
                  <SelectItem value="4">Acidente no trajeto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Médico</div>
              <Select value={doctorKey} onValueChange={setDoctorKey} disabled={!cards.length}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {cards.map((c: any) => {
                    const name = String(c?.doctor_info?.name || '').trim()
                    const key = normalizeDoctorKey(name)
                    return (
                      <SelectItem key={key} value={key}>
                        {name}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Paciente (AIH)</div>
              <Select value={patientKey} onValueChange={setPatientKey} disabled={!selectedDoctor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(selectedDoctor?.patients || []).slice(0, 200).map((p: any) => {
                    const key = String(p?.aih_id || p?.patient_id || '')
                    const label = `${p?.patient_info?.name || 'Paciente'} • AIH ${(p?.aih_info?.aih_number || '').toString()}`
                    return (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedPatient && (
            <div className="flex items-center gap-3">
              <Badge variant="secondary">Procedimentos 04 calculáveis: {procedures04.length}</Badge>
              <Badge variant="secondary">Base (R$): {formatCurrency(baseSum)}</Badge>
              <Badge variant="secondary">Incremento Opera Paraná: {formatCurrency(increment)}</Badge>
              <div className="flex items-center gap-2 ml-auto">
                <Switch checked={includeOperaParanaInBase} onCheckedChange={setIncludeOperaParanaInBase} />
                <span className="text-sm">Incluir incremento na base percentual</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Regra em rascunho (não salva)</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadCurrentAsDraft} disabled={!selectedDoctor}>
              Carregar regra atual
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea value={draftRuleText} onChange={(e) => setDraftRuleText(e.target.value)} className="min-h-[240px] font-mono text-xs" placeholder="Cole aqui uma DoctorPaymentRule em JSON para simular." />
          {draftError && <div className="text-xs text-destructive">{draftError}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comparação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Atual (aplicado)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {currentResult ? (
                  <>
                    <div className="text-sm">
                      <span className="font-medium">Total:</span> {formatCurrency(currentResult.total)}
                    </div>
                    <div className="text-xs text-muted-foreground">{currentResult.appliedRule}</div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">Selecione médico e paciente.</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Rascunho</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {draftResult ? (
                  <>
                    <div className="text-sm">
                      <span className="font-medium">Total:</span> {formatCurrency(draftResult.total)}
                    </div>
                    <div className="text-xs text-muted-foreground">{draftResult.appliedRule}</div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">Cole um JSON válido para simular.</div>
                )}
              </CardContent>
            </Card>
          </div>

          {selectedPatient && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {procedures04.slice(0, 60).map((p: any, idx: number) => (
                  <TableRow key={`${p.procedure_code}-${idx}`}>
                    <TableCell className="font-mono text-xs">{p.procedure_code}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.procedure_description || '—'}</TableCell>
                    <TableCell className="text-right text-xs">{formatCurrency(Number(p.value_reais || 0))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
