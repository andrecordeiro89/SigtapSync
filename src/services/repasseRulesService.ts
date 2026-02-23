import { supabase } from '../lib/supabase'

export type RepasseRuleScope =
  | 'global'
  | 'hospital'
  | 'doctor'
  | 'specialty'
  | 'hospital_specialty'
  | 'doctor_hospital'
  | 'doctor_specialty'
  | 'doctor_hospital_specialty'

export interface RepasseRuleRow {
  id: string
  scope: RepasseRuleScope
  is_active: boolean
  priority: number
  hospital_id: string | null
  doctor_id: string | null
  specialty: string | null
  sigtap_code: string
  value_amb: number | null
  value_amb_total: number | null
  value_hosp: number | null
  value_prof: number | null
  value_hosp_total: number | null
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type RepasseRuleUpsert = Omit<
  RepasseRuleRow,
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
> & { id?: string }

export interface RepasseRuleFilters {
  hospitalId?: string
  doctorId?: string
  specialty?: string
  sigtapCode?: string
  isActive?: boolean | 'all'
}

export interface RepasseContext {
  hospitalId?: string
  doctorId?: string
  specialty?: string
}

const normalizeCode = (code: string): string =>
  String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[.\-\s]/g, '')

const scopeRank = (scope: RepasseRuleScope): number => {
  switch (scope) {
    case 'doctor_hospital_specialty':
      return 8
    case 'doctor_hospital':
      return 7
    case 'doctor_specialty':
      return 6
    case 'hospital_specialty':
      return 5
    case 'doctor':
      return 4
    case 'hospital':
      return 3
    case 'specialty':
      return 2
    case 'global':
    default:
      return 1
  }
}

const isApplicableToContext = (r: RepasseRuleRow, ctx: RepasseContext): boolean => {
  if (r.hospital_id && ctx.hospitalId && r.hospital_id !== ctx.hospitalId) return false
  if (r.hospital_id && !ctx.hospitalId) return false
  if (r.doctor_id && ctx.doctorId && r.doctor_id !== ctx.doctorId) return false
  if (r.doctor_id && !ctx.doctorId) return false
  if (r.specialty && ctx.specialty) {
    if (String(r.specialty).trim().toUpperCase() !== String(ctx.specialty).trim().toUpperCase()) return false
  }
  if (r.specialty && !ctx.specialty) return false
  return true
}

export const resolveBestRepasseRule = (
  rules: RepasseRuleRow[],
  ctx: RepasseContext,
  sigtapCode: string
): RepasseRuleRow | null => {
  const codeNorm = normalizeCode(sigtapCode)
  const active = (rules || []).filter((r) => r.is_active && normalizeCode(r.sigtap_code) === codeNorm)
  const applicable = active.filter((r) => isApplicableToContext(r, ctx))
  if (applicable.length === 0) return null

  const sorted = applicable.sort((a, b) => {
    const ra = scopeRank(a.scope)
    const rb = scopeRank(b.scope)
    if (ra !== rb) return rb - ra
    const pa = Number(a.priority || 0)
    const pb = Number(b.priority || 0)
    if (pa !== pb) return pb - pa
    const ua = new Date(a.updated_at || 0).getTime()
    const ub = new Date(b.updated_at || 0).getTime()
    if (ua !== ub) return ub - ua
    return String(b.id).localeCompare(String(a.id))
  })

  return sorted[0] || null
}

export const applyRuleToProcedureValueReais = (baseValueReais: number, rule: RepasseRuleRow | null): number => {
  if (!rule) return baseValueReais
  const toNum = (v: any): number | null => {
    if (v === null || v === undefined) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const hospTotal = toNum((rule as any).value_hosp_total)
  if (hospTotal !== null) return hospTotal
  const hosp = toNum((rule as any).value_hosp)
  const prof = toNum((rule as any).value_prof)
  if (hosp !== null || prof !== null) return (hosp || 0) + (prof || 0)
  const ambTotal = toNum((rule as any).value_amb_total)
  if (ambTotal !== null) return ambTotal
  const amb = toNum((rule as any).value_amb)
  if (amb !== null) return amb
  return baseValueReais
}

export class RepasseRulesService {
  private static readonly SETTING_KEY = 'repasse.rules'

  private static async loadStore(): Promise<{ storeId?: string; rules: RepasseRuleRow[] }> {
    const { data, error } = await supabase
      .from('system_settings')
      .select('id,setting_value,updated_at')
      .eq('setting_key', RepasseRulesService.SETTING_KEY)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    const storeId = (data as any)?.id as string | undefined
    const raw = (data as any)?.setting_value
    const rules = Array.isArray(raw) ? (raw as any[]) : []
    return { storeId, rules: rules as any }
  }

  private static async saveStore(storeId: string | undefined, rules: RepasseRuleRow[]): Promise<void> {
    if (storeId) {
      const { error } = await supabase
        .from('system_settings')
        .update({
          setting_value: rules as any,
          setting_type: 'array',
          description: 'Regras de repasse por SIGTAP (camada configurável)',
          is_public: false,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', storeId)
      if (error) throw error
      return
    }

    const { error } = await supabase.from('system_settings').insert({
      setting_key: RepasseRulesService.SETTING_KEY,
      setting_value: rules as any,
      setting_type: 'array',
      description: 'Regras de repasse por SIGTAP (camada configurável)',
      is_public: false
    } as any)
    if (error) throw error
  }

  static async list(filters: RepasseRuleFilters = {}): Promise<RepasseRuleRow[]> {
    const { rules } = await RepasseRulesService.loadStore()
    const isActive = filters.isActive
    const sigtapTerm = String(filters.sigtapCode || '').trim()
    const specTerm = String(filters.specialty || '').trim()
    const filtered = (rules || []).filter((r) => {
      if (isActive !== undefined && isActive !== 'all') {
        if (!!r.is_active !== !!isActive) return false
      }
      if (filters.hospitalId && r.hospital_id !== filters.hospitalId) return false
      if (filters.doctorId && r.doctor_id !== filters.doctorId) return false
      if (specTerm) {
        const rs = String(r.specialty || '').trim()
        if (!rs || rs.toLowerCase() !== specTerm.toLowerCase()) return false
      }
      if (sigtapTerm) {
        const rc = String(r.sigtap_code || '')
        if (!rc.toLowerCase().includes(sigtapTerm.toLowerCase())) return false
      }
      return true
    })
    return filtered.sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
  }

  static async getActiveByCodes(codes: string[]): Promise<RepasseRuleRow[]> {
    const normalized = Array.from(new Set((codes || []).map((c) => String(c || '').trim()).filter(Boolean)))
    if (normalized.length === 0) return []
    const { rules } = await RepasseRulesService.loadStore()
    const wanted = new Set(normalized.map(normalizeCode))
    return (rules || []).filter((r) => r.is_active && wanted.has(normalizeCode(r.sigtap_code)))
  }

  static async create(rule: RepasseRuleUpsert): Promise<RepasseRuleRow> {
    const now = new Date().toISOString()
    const id = (rule as any).id || crypto.randomUUID()
    const row: RepasseRuleRow = {
      id,
      scope: rule.scope,
      is_active: !!rule.is_active,
      priority: Number(rule.priority || 0),
      hospital_id: rule.hospital_id ?? null,
      doctor_id: rule.doctor_id ?? null,
      specialty: rule.specialty ?? null,
      sigtap_code: String(rule.sigtap_code || '').trim(),
      value_amb: rule.value_amb ?? null,
      value_amb_total: rule.value_amb_total ?? null,
      value_hosp: rule.value_hosp ?? null,
      value_prof: rule.value_prof ?? null,
      value_hosp_total: rule.value_hosp_total ?? null,
      notes: rule.notes ?? null,
      created_at: now,
      updated_at: now,
      created_by: null,
      updated_by: null
    }
    const store = await RepasseRulesService.loadStore()
    const next = [...(store.rules || []), row]
    await RepasseRulesService.saveStore(store.storeId, next)
    return row
  }

  static async update(id: string, patch: Partial<RepasseRuleUpsert>): Promise<RepasseRuleRow> {
    const store = await RepasseRulesService.loadStore()
    const idx = (store.rules || []).findIndex((r) => r.id === id)
    if (idx === -1) throw new Error('Regra não encontrada')
    const now = new Date().toISOString()
    const prev = store.rules[idx] as RepasseRuleRow
    const nextRow: RepasseRuleRow = {
      ...prev,
      ...patch,
      id: prev.id,
      updated_at: now
    } as any
    const next = [...store.rules]
    next[idx] = nextRow
    await RepasseRulesService.saveStore(store.storeId, next)
    return nextRow
  }

  static async setActive(id: string, isActive: boolean): Promise<RepasseRuleRow> {
    return this.update(id, { is_active: isActive })
  }

  static async remove(id: string): Promise<void> {
    const store = await RepasseRulesService.loadStore()
    const next = (store.rules || []).filter((r) => r.id !== id)
    await RepasseRulesService.saveStore(store.storeId, next)
  }

  static async duplicate(id: string): Promise<RepasseRuleRow> {
    const store = await RepasseRulesService.loadStore()
    const row = (store.rules || []).find((r) => r.id === id)
    if (!row) throw new Error('Regra não encontrada')
    const now = new Date().toISOString()
    const copy: RepasseRuleRow = {
      ...row,
      id: crypto.randomUUID(),
      is_active: false,
      created_at: now,
      updated_at: now
    }
    const next = [...(store.rules || []), copy]
    await RepasseRulesService.saveStore(store.storeId, next)
    return copy
  }
}
