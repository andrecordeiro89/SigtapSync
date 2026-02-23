import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Textarea } from '../ui/textarea'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import { getBaseHospitalRules, setDoctorPaymentRulesOverrides, type DoctorPaymentRule } from '../../config/doctorPaymentRules'
import { HOSPITAL_MAPPINGS } from '../../config/doctorPaymentRules/utils'
import { DoctorPaymentRulesOverridesService, type DoctorPaymentRulesOverridesStore } from '../../services/doctorPaymentRulesOverridesService'

const hospitalLabel = (key: string): string => {
  const m = HOSPITAL_MAPPINGS.find((x) => x.key === key)
  return m?.name ? `${m.name} (${key})` : key
}

const summarizeRuleTypes = (rule: DoctorPaymentRule | null): string[] => {
  if (!rule) return []
  const out: string[] = []
  if (rule.fixedPaymentRule) out.push('Fixo')
  if (rule.percentageRule) out.push('Percentual')
  if (rule.onlyMainProcedureRule?.enabled) out.push('Apenas principal')
  if (Array.isArray(rule.rules) && rule.rules.length > 0) out.push('Por procedimento')
  if (Array.isArray(rule.multipleRules) && rule.multipleRules.length > 0) out.push('Combos (múltiplos)')
  if (rule.multipleRule) out.push('Combo (único)')
  if (!out.length) out.push('Vazio')
  return out
}

const safeStringify = (v: any): string => {
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return ''
  }
}

export default function DoctorPaymentRulesManager() {
  const base = useMemo(() => getBaseHospitalRules(), [])
  const hospitalKeys = useMemo(() => Object.keys(base).sort((a, b) => a.localeCompare(b)), [base])

  const [store, setStore] = useState<DoctorPaymentRulesOverridesStore>({ version: 1, hospitals: {} })
  const [loading, setLoading] = useState(false)

  const [hospitalKey, setHospitalKey] = useState<string>(hospitalKeys[0] || '')
  const [doctorKey, setDoctorKey] = useState<string>('')
  const [doctorSearch, setDoctorSearch] = useState<string>('')

  const doctorsInHospital = useMemo(() => {
    const map = base[hospitalKey] || {}
    return Object.keys(map).sort((a, b) => a.localeCompare(b))
  }, [base, hospitalKey])

  useEffect(() => {
    if (!doctorKey && doctorsInHospital.length > 0) setDoctorKey(doctorsInHospital[0])
  }, [hospitalKey, doctorsInHospital.length])

  const baseRule = useMemo(() => {
    const h = base[hospitalKey] || {}
    const key = String(doctorKey || '').trim().toUpperCase()
    return (h as any)[key] as DoctorPaymentRule | undefined
  }, [base, hospitalKey, doctorKey])

  const overrideRule = useMemo(() => {
    const h = store.hospitals[hospitalKey] || {}
    const key = String(doctorKey || '').trim().toUpperCase()
    return (h as any)[key] as DoctorPaymentRule | undefined
  }, [store, hospitalKey, doctorKey])

  const effectiveRule = overrideRule || baseRule || null

  const [draftText, setDraftText] = useState<string>('')
  const [draftError, setDraftError] = useState<string | null>(null)

  useEffect(() => {
    setDraftText(safeStringify(effectiveRule))
    setDraftError(null)
  }, [hospitalKey, doctorKey, overrideRule ? `${overrideRule.doctorName}::ov` : baseRule ? `${baseRule.doctorName}::base` : 'none'])

  const filteredDoctors = useMemo(() => {
    const q = String(doctorSearch || '').trim().toUpperCase()
    if (!q) return doctorsInHospital
    return doctorsInHospital.filter((d) => d.toUpperCase().includes(q))
  }, [doctorsInHospital, doctorSearch])

  const parseDraft = (): DoctorPaymentRule | null => {
    const t = String(draftText || '').trim()
    if (!t) return null
    try {
      const obj = JSON.parse(t)
      setDraftError(null)
      return obj as DoctorPaymentRule
    } catch (e: any) {
      setDraftError(String(e?.message || e))
      return null
    }
  }

  const reload = async () => {
    setLoading(true)
    try {
      const s = await DoctorPaymentRulesOverridesService.load()
      setStore(s)
      setDoctorPaymentRulesOverrides(DoctorPaymentRulesOverridesService.toOverrides(s))
    } catch (e: any) {
      toast.error(`Falha ao carregar overrides: ${String(e?.message || e)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  const applyOverride = async () => {
    const parsed = parseDraft()
    if (!parsed) {
      toast.error('JSON inválido ou vazio')
      return
    }
    const doctorNameUpper = String(doctorKey || parsed.doctorName || '').trim().toUpperCase()
    if (!hospitalKey || !doctorNameUpper) {
      toast.error('Selecione hospital e médico')
      return
    }
    const next: DoctorPaymentRulesOverridesStore = {
      version: 1,
      hospitals: {
        ...store.hospitals,
        [hospitalKey]: {
          ...(store.hospitals[hospitalKey] || {}),
          [doctorNameUpper]: { ...parsed, doctorName: doctorNameUpper }
        }
      }
    }
    setLoading(true)
    try {
      await DoctorPaymentRulesOverridesService.save(next)
      setStore(next)
      setDoctorPaymentRulesOverrides(DoctorPaymentRulesOverridesService.toOverrides(next))
      toast.success('Override aplicado')
    } catch (e: any) {
      toast.error(`Falha ao salvar override: ${String(e?.message || e)}`)
    } finally {
      setLoading(false)
    }
  }

  const removeOverride = async () => {
    const doctorNameUpper = String(doctorKey || '').trim().toUpperCase()
    if (!hospitalKey || !doctorNameUpper) return
    const prevHospital = { ...(store.hospitals[hospitalKey] || {}) }
    if (!prevHospital[doctorNameUpper]) {
      toast.info('Nenhum override para remover')
      return
    }
    delete prevHospital[doctorNameUpper]
    const nextHospitals = { ...store.hospitals, [hospitalKey]: prevHospital }
    const next: DoctorPaymentRulesOverridesStore = { version: 1, hospitals: nextHospitals }
    setLoading(true)
    try {
      await DoctorPaymentRulesOverridesService.save(next)
      setStore(next)
      setDoctorPaymentRulesOverrides(DoctorPaymentRulesOverridesService.toOverrides(next))
      toast.success('Override removido')
    } catch (e: any) {
      toast.error(`Falha ao remover: ${String(e?.message || e)}`)
    } finally {
      setLoading(false)
    }
  }

  const loadFromBase = () => {
    setDraftText(safeStringify(baseRule || null))
    setDraftError(null)
  }

  const loadFromOverride = () => {
    setDraftText(safeStringify(overrideRule || null))
    setDraftError(null)
  }

  const ruleTypes = summarizeRuleTypes(effectiveRule)
  const hasOverride = !!overrideRule

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Regras de Pagamento Médico</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={reload} disabled={loading}>
              Recarregar
            </Button>
            <Button onClick={applyOverride} disabled={loading}>
              Salvar override
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Hospital (contexto)</div>
              <Select value={hospitalKey} onValueChange={setHospitalKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {hospitalKeys.map((k) => (
                    <SelectItem key={k} value={k}>
                      {hospitalLabel(k)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Buscar médico (nome upper)</div>
              <Input value={doctorSearch} onChange={(e) => setDoctorSearch(e.target.value)} placeholder="Ex: JOAO" />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Médico</div>
              <Select value={doctorKey} onValueChange={setDoctorKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {filteredDoctors.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={hasOverride ? 'default' : 'secondary'}>{hasOverride ? 'Override ativo' : 'Somente código'}</Badge>
            {ruleTypes.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
            <div className="flex-1" />
            <Button variant="outline" onClick={loadFromBase} disabled={loading}>
              Carregar do código
            </Button>
            <Button variant="outline" onClick={loadFromOverride} disabled={loading}>
              Carregar override
            </Button>
            <Button variant="destructive" onClick={removeOverride} disabled={loading}>
              Remover override
            </Button>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Regra efetiva (JSON)</div>
              <Textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} className="min-h-[420px] font-mono text-xs" />
              {draftError && <div className="text-xs text-destructive">{draftError}</div>}
            </div>
            <div className="space-y-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Ajuda rápida</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Fixo:</span> fixedPaymentRule.amount / description
                  </div>
                  <div>
                    <span className="font-medium">Percentual:</span> percentageRule.percentage / description
                  </div>
                  <div>
                    <span className="font-medium">Por procedimento:</span> rules[].procedureCode / standardValue / specialValue
                  </div>
                  <div>
                    <span className="font-medium">Combos:</span> multipleRules[].codes / totalValue
                  </div>
                  <div className="text-xs text-muted-foreground">
                    O motor usa o nome do médico em uppercase como chave. Salvar override aplica no frontend e persiste em system_settings.
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Fonte</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Código-fonte:</span> {baseRule ? 'Encontrado' : 'Não encontrado'}
                  </div>
                  <div>
                    <span className="font-medium">Override:</span> {overrideRule ? 'Encontrado' : 'Não encontrado'}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

