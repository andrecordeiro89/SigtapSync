import { createClient } from '@supabase/supabase-js'
import { ENV_CONFIG } from '../config/env'

export const supabaseSih = (() => {
  const url = ENV_CONFIG.SIH_SUPABASE_URL
  const key = ENV_CONFIG.SIH_SUPABASE_ANON_KEY
  if (!url || !key) {
    return null as any
  }
  return createClient(url, key)
})()

