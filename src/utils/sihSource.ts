export function isSihSourceActive(): boolean {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem('useSihSource') : null
    if (v === 'true') return true
    if (v === 'false') return false
  } catch {}
  try {
    const { ENV_CONFIG } = require('../config/env')
    return !!ENV_CONFIG.USE_SIH_SOURCE
  } catch {}
  return false
}

