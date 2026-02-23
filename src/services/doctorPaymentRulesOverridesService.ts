import { supabase } from '../lib/supabase'
import type { DoctorPaymentRule } from '../config/doctorPaymentRules'
import type { DoctorPaymentRulesOverrides } from '../config/doctorPaymentRules'

export type DoctorPaymentRulesOverridesStore = {
  version: 1
  hospitals: Record<string, Record<string, DoctorPaymentRule>>
}

const DEFAULT_STORE: DoctorPaymentRulesOverridesStore = { version: 1, hospitals: {} }

export class DoctorPaymentRulesOverridesService {
  static readonly SETTING_KEY = 'doctorPaymentRules.overrides.v1'

  static async load(): Promise<DoctorPaymentRulesOverridesStore> {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value,updated_at')
      .eq('setting_key', DoctorPaymentRulesOverridesService.SETTING_KEY)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    const raw = (data as any)?.setting_value
    if (!raw) return DEFAULT_STORE
    if (typeof raw !== 'object') return DEFAULT_STORE
    if ((raw as any).version !== 1) return DEFAULT_STORE
    const hospitals = (raw as any).hospitals
    if (!hospitals || typeof hospitals !== 'object') return DEFAULT_STORE
    return { version: 1, hospitals } as any
  }

  static async save(store: DoctorPaymentRulesOverridesStore): Promise<void> {
    const payload = { version: 1, hospitals: store.hospitals || {} }
    const { data: existing, error: readErr } = await supabase
      .from('system_settings')
      .select('id')
      .eq('setting_key', DoctorPaymentRulesOverridesService.SETTING_KEY)
      .limit(1)
      .maybeSingle()
    if (readErr) throw readErr
    if (existing?.id) {
      const { error } = await supabase
        .from('system_settings')
        .update({
          setting_value: payload as any,
          setting_type: 'object',
          description: 'Overrides dinâmicos para doctorPaymentRules (por hospital/médico)',
          is_public: false,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', existing.id)
      if (error) throw error
      return
    }

    const { error } = await supabase.from('system_settings').insert({
      setting_key: DoctorPaymentRulesOverridesService.SETTING_KEY,
      setting_value: payload as any,
      setting_type: 'object',
      description: 'Overrides dinâmicos para doctorPaymentRules (por hospital/médico)',
      is_public: false
    } as any)
    if (error) throw error
  }

  static toOverrides(store: DoctorPaymentRulesOverridesStore): DoctorPaymentRulesOverrides {
    return { hospitals: store.hospitals || {} }
  }
}

