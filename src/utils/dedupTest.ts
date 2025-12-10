export const normalizeAih = (s: string): string => s.replace(/\D/g, '').replace(/^0+/, '')

export const dedupPatientsByAIH = (patients: any[]): any[] => {
  const map = new Map<string, any>()
  for (const p of patients || []) {
    const k = normalizeAih(String(p?.aih_info?.aih_number || '').trim())
    if (!k) continue
    if (!map.has(k)) { map.set(k, p); continue }
    const curr = map.get(k)
    const currScore = ((curr?.procedures || []).length || 0) + (curr?.patient_info?.name ? 1 : 0) + (curr?.aih_info?.discharge_date ? 1 : 0)
    const newScore = ((p?.procedures || []).length || 0) + (p?.patient_info?.name ? 1 : 0) + (p?.aih_info?.discharge_date ? 1 : 0)
    if (newScore >= currScore) map.set(k, p)
  }
  return Array.from(map.values())
}

export const summarizeDedup = (patients: any[], approvedSet?: Set<string>) => {
  const seen = new Set<string>()
  let dupCount = 0
  let approved = 0
  let total = 0
  for (const p of patients || []) {
    const k = normalizeAih(String(p?.aih_info?.aih_number || '').trim())
    if (!k) continue
    total++
    if (seen.has(k)) dupCount++
    else seen.add(k)
    if (approvedSet && approvedSet.has(k)) approved++
  }
  const aiHsLocais = seen.size
  const notApproved = Math.max(aiHsLocais - approved, 0)
  return { aiHsLocais, approved, notApproved, dupCount }
}
