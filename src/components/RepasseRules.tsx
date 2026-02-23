import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Switch } from './ui/switch'
import { Textarea } from './ui/textarea'
import { Alert, AlertDescription } from './ui/alert'
import { toast } from 'sonner'
import { Copy, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import {
  RepasseRulesService,
  resolveBestRepasseRule,
  type RepasseRuleRow,
  type RepasseRuleScope,
  type RepasseRuleUpsert,
} from '../services/repasseRulesService'

type HospitalRow = { id: string; name: string }
type DoctorRow = { id: string; name: string; specialty?: string | null; cns?: string | null; is_active?: boolean | null }

const scopeLabel: Record<RepasseRuleScope, string> = {
  doctor_hospital_specialty: 'Médico+Hospital+Especialidade',
  doctor_hospital: 'Médico+Hospital',
  doctor_specialty: 'Médico+Especialidade',
  hospital_specialty: 'Hospital+Especialidade',
  doctor: 'Médico',
  hospital: 'Hospital',
  specialty: 'Especialidade',
  global: 'Geral',
}

const requiredTargetsByScope: Record<RepasseRuleScope, Array<'hospital' | 'doctor' | 'specialty'>> = {
  global: [],
  hospital: ['hospital'],
  doctor: ['doctor'],
  specialty: ['specialty'],
  hospital_specialty: ['hospital', 'specialty'],
  doctor_hospital: ['doctor', 'hospital'],
  doctor_specialty: ['doctor', 'specialty'],
  doctor_hospital_specialty: ['doctor', 'hospital', 'specialty'],
}

const toMoney = (v: any): string => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const parseMoney = (v: string): number | null => {
  const raw = String(v || '').trim()
  if (!raw) return null
  const normalized = raw.replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

const isValidSigtapCode = (code: string): boolean => /^\d{2}\.\d{2}\.\d{2}\.\d{3}-\d$/.test(String(code || '').trim())

const RepasseRules: React.FC = () => {
  const { user, isAdmin, isDirector, isCoordinator, isTI, hasPermission } = useAuth()
  const canManage = isAdmin() || isDirector() || isCoordinator() || isTI() || hasPermission('generate_reports')

  const [hospitals, setHospitals] = useState<HospitalRow[]>([])
  const [doctors, setDoctors] = useState<DoctorRow[]>([])
  const [rules, setRules] = useState<RepasseRuleRow[]>([])
  const [loading, setLoading] = useState(false)

  const [filterHospitalId, setFilterHospitalId] = useState<string>('all')
  const [filterDoctorId, setFilterDoctorId] = useState<string>('all')
  const [filterSpecialty, setFilterSpecialty] = useState<string>('')
  const [filterSigtapCode, setFilterSigtapCode] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<RepasseRuleRow | null>(null)

  const [editorScope, setEditorScope] = useState<RepasseRuleScope>('global')
  const [editorActive, setEditorActive] = useState(true)
  const [editorPriority, setEditorPriority] = useState<string>('0')
  const [editorHospitalId, setEditorHospitalId] = useState<string>('none')
  const [editorDoctorId, setEditorDoctorId] = useState<string>('none')
  const [editorSpecialty, setEditorSpecialty] = useState<string>('')
  const [editorCodes, setEditorCodes] = useState<string[]>([])
  const [codeSearch, setCodeSearch] = useState<string>('')
  const [codeSearchResults, setCodeSearchResults] = useState<Array<{ code: string; description: string }>>([])
  const [editorValueAmb, setEditorValueAmb] = useState<string>('')
  const [editorValueAmbTotal, setEditorValueAmbTotal] = useState<string>('')
  const [editorValueHosp, setEditorValueHosp] = useState<string>('')
  const [editorValueProf, setEditorValueProf] = useState<string>('')
  const [editorValueHospTotal, setEditorValueHospTotal] = useState<string>('')
  const [editorNotes, setEditorNotes] = useState<string>('')

  const [overwriteWarning, setOverwriteWarning] = useState<string[]>([])

  const specialties = useMemo(() => {
    const set = new Set<string>()
    for (const d of doctors) {
      const s = String(d.specialty || '').trim()
      if (s) set.add(s)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [doctors])

  const doctorsById = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors])
  const hospitalsById = useMemo(() => new Map(hospitals.map((h) => [h.id, h])), [hospitals])

  const reloadRules = async () => {
    setLoading(true)
    try {
      const data = await RepasseRulesService.list({
        hospitalId: filterHospitalId !== 'all' ? filterHospitalId : undefined,
        doctorId: filterDoctorId !== 'all' ? filterDoctorId : undefined,
        specialty: filterSpecialty ? filterSpecialty : undefined,
        sigtapCode: filterSigtapCode ? filterSigtapCode : undefined,
        isActive: filterStatus === 'all' ? 'all' : filterStatus === 'active',
      })
      setRules(data)
    } catch (e: any) {
      toast.error(`Falha ao carregar regras: ${String(e?.message || e)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        const [hRes, dRes] = await Promise.all([
          supabase.from('hospitals').select('id,name').order('name'),
          supabase.from('doctors').select('id,name,specialty,cns,is_active').order('name'),
        ])
        if (hRes.error) throw hRes.error
        if (dRes.error) throw dRes.error
        setHospitals((hRes.data || []) as any)
        setDoctors((dRes.data || []) as any)
      } catch (e: any) {
        toast.error(`Falha ao carregar listas: ${String(e?.message || e)}`)
      }
    })()
  }, [])

  useEffect(() => {
    reloadRules()
  }, [filterHospitalId, filterDoctorId, filterSpecialty, filterSigtapCode, filterStatus])

  const searchSigtapCodes = async (term: string) => {
    const t = String(term || '').trim()
    if (t.length < 2) {
      setCodeSearchResults([])
      return
    }
    try {
      const q = supabase
        .from('sigtap_procedures')
        .select('code,description')
        .limit(20)
        .order('code', { ascending: true })
      const { data, error } = isValidSigtapCode(t)
        ? await q.eq('code', t)
        : await q.or(`code.ilike.%${t}%,description.ilike.%${t}%`)
      if (error) throw error
      setCodeSearchResults((data || []) as any)
    } catch (e: any) {
      setCodeSearchResults([])
    }
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      searchSigtapCodes(codeSearch)
    }, 250)
    return () => clearTimeout(handle)
  }, [codeSearch])

  const resetEditor = () => {
    setEditingRule(null)
    setEditorScope('global')
    setEditorActive(true)
    setEditorPriority('0')
    setEditorHospitalId('none')
    setEditorDoctorId('none')
    setEditorSpecialty('')
    setEditorCodes([])
    setEditorValueAmb('')
    setEditorValueAmbTotal('')
    setEditorValueHosp('')
    setEditorValueProf('')
    setEditorValueHospTotal('')
    setEditorNotes('')
    setOverwriteWarning([])
  }

  const openCreate = () => {
    resetEditor()
    setEditorOpen(true)
  }

  const openEdit = (r: RepasseRuleRow) => {
    setEditingRule(r)
    setEditorScope(r.scope)
    setEditorActive(!!r.is_active)
    setEditorPriority(String(r.priority ?? 0))
    setEditorHospitalId(r.hospital_id || 'none')
    setEditorDoctorId(r.doctor_id || 'none')
    setEditorSpecialty(r.specialty || '')
    setEditorCodes([r.sigtap_code])
    setEditorValueAmb(r.value_amb != null ? String(r.value_amb) : '')
    setEditorValueAmbTotal(r.value_amb_total != null ? String(r.value_amb_total) : '')
    setEditorValueHosp(r.value_hosp != null ? String(r.value_hosp) : '')
    setEditorValueProf(r.value_prof != null ? String(r.value_prof) : '')
    setEditorValueHospTotal(r.value_hosp_total != null ? String(r.value_hosp_total) : '')
    setEditorNotes(r.notes || '')
    setOverwriteWarning([])
    setEditorOpen(true)
  }

  const validateEditor = (): string | null => {
    const required = requiredTargetsByScope[editorScope] || []
    if (required.includes('hospital') && editorHospitalId === 'none') return 'Selecione um hospital para este escopo.'
    if (required.includes('doctor') && editorDoctorId === 'none') return 'Selecione um médico para este escopo.'
    if (required.includes('specialty') && !editorSpecialty.trim()) return 'Selecione uma especialidade para este escopo.'
    if (!editorCodes.length) return 'Selecione ao menos 1 código SIGTAP.'
    const invalid = editorCodes.find((c) => !isValidSigtapCode(c))
    if (invalid) return `Código SIGTAP inválido: ${invalid}`
    const anyValue =
      parseMoney(editorValueHospTotal) !== null ||
      parseMoney(editorValueHosp) !== null ||
      parseMoney(editorValueProf) !== null ||
      parseMoney(editorValueAmbTotal) !== null ||
      parseMoney(editorValueAmb) !== null
    if (!anyValue) return 'Informe ao menos um valor (ex.: Hosp Total, Hosp, Prof, Amb Total ou Amb).'
    return null
  }

  const computeOverwriteWarnings = async (candidateCodes: string[]) => {
    try {
      const existing = await RepasseRulesService.getActiveByCodes(candidateCodes)
      const ctx = {
        hospitalId: editorHospitalId === 'none' ? undefined : editorHospitalId,
        doctorId: editorDoctorId === 'none' ? undefined : editorDoctorId,
        specialty: editorSpecialty ? editorSpecialty : undefined,
      }
      const warnings: string[] = []
      for (const code of candidateCodes) {
        const best = resolveBestRepasseRule(existing, ctx, code)
        const isEditingSame = editingRule && best && best.id === editingRule.id
        if (!best || isEditingSame) continue
        warnings.push(`${code} sobrescreve "${scopeLabel[best.scope]}" (regra ativa existente)`)
      }
      setOverwriteWarning(warnings)
    } catch {
      setOverwriteWarning([])
    }
  }

  useEffect(() => {
    if (!editorOpen) return
    if (!editorCodes.length) {
      setOverwriteWarning([])
      return
    }
    computeOverwriteWarnings(editorCodes)
  }, [editorOpen, editorScope, editorHospitalId, editorDoctorId, editorSpecialty, editorCodes.join('|')])

  const saveEditor = async () => {
    const err = validateEditor()
    if (err) {
      toast.error(err)
      return
    }
    try {
      const patchBase: Omit<RepasseRuleUpsert, 'sigtap_code'> = {
        scope: editorScope,
        is_active: editorActive,
        priority: Number(editorPriority || 0),
        hospital_id: editorHospitalId === 'none' ? null : editorHospitalId,
        doctor_id: editorDoctorId === 'none' ? null : editorDoctorId,
        specialty: editorSpecialty ? editorSpecialty.trim() : null,
        value_amb: parseMoney(editorValueAmb),
        value_amb_total: parseMoney(editorValueAmbTotal),
        value_hosp: parseMoney(editorValueHosp),
        value_prof: parseMoney(editorValueProf),
        value_hosp_total: parseMoney(editorValueHospTotal),
        notes: editorNotes ? editorNotes.trim() : null,
      } as any

      if (editingRule) {
        const updated = await RepasseRulesService.update(editingRule.id, {
          ...patchBase,
          sigtap_code: editorCodes[0],
        } as any)
        toast.success(`Regra atualizada: ${updated.sigtap_code}`)
      } else {
        const codes = Array.from(new Set(editorCodes))
        const created: string[] = []
        for (const code of codes) {
          const inserted = await RepasseRulesService.create({
            ...patchBase,
            sigtap_code: code,
          } as any)
          created.push(inserted.sigtap_code)
        }
        toast.success(`Regras criadas: ${created.join(', ')}`)
      }
      setEditorOpen(false)
      await reloadRules()
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${String(e?.message || e)}`)
    }
  }

  const onDuplicate = async (r: RepasseRuleRow) => {
    try {
      await RepasseRulesService.duplicate(r.id)
      toast.success('Regra duplicada (inativa)')
      await reloadRules()
    } catch (e: any) {
      toast.error(`Falha ao duplicar: ${String(e?.message || e)}`)
    }
  }

  const onToggleActive = async (r: RepasseRuleRow) => {
    try {
      await RepasseRulesService.setActive(r.id, !r.is_active)
      await reloadRules()
    } catch (e: any) {
      toast.error(`Falha ao atualizar status: ${String(e?.message || e)}`)
    }
  }

  const onDelete = async (r: RepasseRuleRow) => {
    if (!confirm(`Excluir regra ${r.sigtap_code} (${scopeLabel[r.scope]})?`)) return
    try {
      await RepasseRulesService.remove(r.id)
      toast.success('Regra excluída')
      await reloadRules()
    } catch (e: any) {
      toast.error(`Falha ao excluir: ${String(e?.message || e)}`)
    }
  }

  const renderTargets = (r: RepasseRuleRow): string => {
    const parts: string[] = []
    if (r.hospital_id) parts.push(hospitalsById.get(r.hospital_id)?.name || r.hospital_id)
    if (r.doctor_id) parts.push(doctorsById.get(r.doctor_id)?.name || r.doctor_id)
    if (r.specialty) parts.push(r.specialty)
    return parts.length ? parts.join(' • ') : '—'
  }

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Regras Repasse</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>Sem permissão para gerenciar regras de repasse.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Regras Repasse</CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={reloadRules} variant="outline" disabled={loading}>
              Recarregar
            </Button>
            <Button onClick={openCreate} disabled={loading}>
              <Plus className="w-4 h-4 mr-2" />
              Nova regra
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Hospital</div>
              <Select value={filterHospitalId} onValueChange={setFilterHospitalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {hospitals.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Médico</div>
              <Select value={filterDoctorId} onValueChange={setFilterDoctorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {doctors
                    .filter((d) => d.is_active !== false)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Especialidade</div>
              <Select value={filterSpecialty || 'all'} onValueChange={(v) => setFilterSpecialty(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {specialties.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Código SIGTAP</div>
              <Input value={filterSigtapCode} onChange={(e) => setFilterSigtapCode(e.target.value)} placeholder="Ex: 04.08..." />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Status</div>
              <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="inactive">Inativas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Escopo</TableHead>
                <TableHead>Alvos</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Valores</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{scopeLabel[r.scope] || r.scope}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{renderTargets(r)}</TableCell>
                  <TableCell className="font-mono text-sm">{r.sigtap_code}</TableCell>
                  <TableCell className="text-sm">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <div>Hosp Total: {toMoney(r.value_hosp_total)}</div>
                      <div>Prof: {toMoney(r.value_prof)}</div>
                      <div>Hosp: {toMoney(r.value_hosp)}</div>
                      <div>Amb Total: {toMoney(r.value_amb_total)}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.is_active ? 'default' : 'secondary'}>{r.is_active ? 'Ativa' : 'Inativa'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onDuplicate(r)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onToggleActive(r)}>
                        <Power className="w-4 h-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => onDelete(r)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!rules.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma regra encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={(v) => setEditorOpen(v)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Editar regra' : 'Nova regra'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Escopo</div>
              <Select value={editorScope} onValueChange={(v: any) => setEditorScope(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      'doctor_hospital_specialty',
                      'doctor_hospital',
                      'doctor_specialty',
                      'hospital_specialty',
                      'doctor',
                      'hospital',
                      'specialty',
                      'global',
                    ] as RepasseRuleScope[]
                  ).map((s) => (
                    <SelectItem key={s} value={s}>
                      {scopeLabel[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Ativa</div>
              <div className="h-10 flex items-center gap-3 px-2 rounded-md border">
                <Switch checked={editorActive} onCheckedChange={setEditorActive} />
                <span className="text-sm">{editorActive ? 'Sim' : 'Não'}</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Prioridade</div>
              <Input value={editorPriority} onChange={(e) => setEditorPriority(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Hospital</div>
              <Select value={editorHospitalId} onValueChange={setEditorHospitalId} disabled={!requiredTargetsByScope[editorScope].includes('hospital')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {hospitals.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Médico</div>
              <Select value={editorDoctorId} onValueChange={setEditorDoctorId} disabled={!requiredTargetsByScope[editorScope].includes('doctor')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {doctors
                    .filter((d) => d.is_active !== false)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Especialidade</div>
              <Select
                value={editorSpecialty || 'none'}
                onValueChange={(v) => setEditorSpecialty(v === 'none' ? '' : v)}
                disabled={!requiredTargetsByScope[editorScope].includes('specialty')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {specialties.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Código(s) SIGTAP</div>
            <Input value={codeSearch} onChange={(e) => setCodeSearch(e.target.value)} placeholder="Buscar por código ou descrição..." />
            {!!codeSearchResults.length && (
              <div className="border rounded-md max-h-48 overflow-auto">
                {codeSearchResults.map((r) => (
                  <button
                    type="button"
                    key={r.code}
                    className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between gap-3"
                    onClick={() => {
                      const code = String(r.code || '').trim()
                      if (!code) return
                      if (editingRule) {
                        setEditorCodes([code])
                      } else {
                        setEditorCodes((prev) => (prev.includes(code) ? prev : [...prev, code]))
                      }
                      setCodeSearch('')
                      setCodeSearchResults([])
                    }}
                  >
                    <span className="font-mono text-sm">{r.code}</span>
                    <span className="text-xs text-muted-foreground line-clamp-1">{r.description}</span>
                  </button>
                ))}
              </div>
            )}
            {editorCodes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {editorCodes.map((c) => (
                  <Badge
                    key={c}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => {
                      if (editingRule) return
                      setEditorCodes((prev) => prev.filter((x) => x !== c))
                    }}
                  >
                    {c}
                  </Badge>
                ))}
              </div>
            )}
            {editingRule && <div className="text-xs text-muted-foreground">Edição limita a 1 código. Para múltiplos, use duplicar.</div>}
          </div>

          {!!overwriteWarning.length && (
            <Alert>
              <AlertDescription>
                <div className="space-y-1">
                  <div className="font-medium">Atenção: esta regra pode sobrescrever outras</div>
                  <ul className="list-disc pl-4">
                    {overwriteWarning.slice(0, 6).map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Hosp Total</div>
              <Input value={editorValueHospTotal} onChange={(e) => setEditorValueHospTotal(e.target.value)} placeholder="Ex: 1234,56" />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Hosp</div>
              <Input value={editorValueHosp} onChange={(e) => setEditorValueHosp(e.target.value)} placeholder="Ex: 1000,00" />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Prof</div>
              <Input value={editorValueProf} onChange={(e) => setEditorValueProf(e.target.value)} placeholder="Ex: 200,00" />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Amb Total</div>
              <Input value={editorValueAmbTotal} onChange={(e) => setEditorValueAmbTotal(e.target.value)} placeholder="Ex: 0,00" />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Amb</div>
              <Input value={editorValueAmb} onChange={(e) => setEditorValueAmb(e.target.value)} placeholder="Ex: 0,00" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Observações</div>
            <Textarea value={editorNotes} onChange={(e) => setEditorNotes(e.target.value)} placeholder="Opcional" />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditorOpen(false)
              }}
            >
              Cancelar
            </Button>
            <Button onClick={saveEditor}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default RepasseRules

