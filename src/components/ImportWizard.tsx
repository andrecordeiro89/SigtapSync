import React, { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

type Row = Record<string, any>

export default function ImportWizard() {
  const [hospitalId, setHospitalId] = useState('')
  const [patientsRows, setPatientsRows] = useState<Row[]>([])
  const [aihsRows, setAihsRows] = useState<Row[]>([])
  const [procRows, setProcRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const parseFile = async (file: File, setRows: (rows: Row[]) => void) => {
    const data = await file.arrayBuffer()
    const wb = XLSX.read(data, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: null })
    setRows(rows)
  }

  const insertBatch = async (table: string, rows: Row[]) => {
    const size = 500
    for (let i = 0; i < rows.length; i += size) {
      const chunk = rows.slice(i, i + size).map(r => ({ ...r, hospital_id: hospitalId }))
      const { error } = await supabase.from(table).insert(chunk)
      if (error) throw error
    }
  }

  const handleUpload = async () => {
    if (!hospitalId) return
    setLoading(true)
    try {
      if (patientsRows.length) await insertBatch('staging_patients', patientsRows)
      if (aihsRows.length) await insertBatch('staging_aihs', aihsRows)
      if (procRows.length) await insertBatch('staging_procedure_records', procRows)
      const { data, error } = await supabase.rpc('merge_staging_to_core', { p_hospital_id: hospitalId })
      if (error) throw error
      setResult(data)
    } catch (e: any) {
      setResult({ error: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input className="border p-2" placeholder="hospital_id" value={hospitalId} onChange={e => setHospitalId(e.target.value)} />
        <button className="px-3 py-2 bg-blue-600 text-white rounded" disabled={loading} onClick={handleUpload}>{loading ? 'Processando...' : 'Enviar e Mesclar'}</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <div className="font-medium">Patients CSV</div>
          <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={e => e.target.files && parseFile(e.target.files[0], setPatientsRows)} />
          <div className="text-sm text-gray-600">{patientsRows.length ? `${patientsRows.length} linhas` : 'Nenhum arquivo selecionado'}</div>
        </div>
        <div className="space-y-2">
          <div className="font-medium">AIHs CSV</div>
          <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={e => e.target.files && parseFile(e.target.files[0], setAihsRows)} />
          <div className="text-sm text-gray-600">{aihsRows.length ? `${aihsRows.length} linhas` : 'Nenhum arquivo selecionado'}</div>
        </div>
        <div className="space-y-2">
          <div className="font-medium">Procedures CSV</div>
          <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={e => e.target.files && parseFile(e.target.files[0], setProcRows)} />
          <div className="text-sm text-gray-600">{procRows.length ? `${procRows.length} linhas` : 'Nenhum arquivo selecionado'}</div>
        </div>
      </div>
      <div className="text-sm">
        {result && typeof result === 'object' ? JSON.stringify(result) : ''}
      </div>
    </div>
  )
}
