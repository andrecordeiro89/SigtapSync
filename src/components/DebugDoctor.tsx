import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DoctorsRevenueService } from '../services/doctorsRevenueService'

type DebugResult = Awaited<ReturnType<typeof DoctorsRevenueService.debugDoctorPaymentsPeriod>>

const DebugDoctor: React.FC = () => {
  const [params] = useSearchParams()
  const [data, setData] = useState<DebugResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const doctorName = params.get('doctorName') || ''
        const doctorCns = params.get('doctorCns') || ''
        const hospitalId = params.get('hospitalId') || ''
        const from = params.get('from') || ''
        const to = params.get('to') || ''
        const res = await DoctorsRevenueService.debugDoctorPaymentsPeriod({
          doctorName,
          doctorCns,
          hospitalId,
          from,
          to
        })
        setData(res)
      } catch (e: any) {
        setError(e?.message || 'Erro ao executar diagnóstico')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [params])

  if (loading) return <div className="p-4">Carregando diagnóstico...</div>
  if (error) return <div className="p-4 text-red-600">Erro: {error}</div>
  if (!data) return <div className="p-4">Sem dados</div>

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Debug Pagamentos por Médico</h1>
      <div className="text-sm">
        <div>Médico: <strong>{data.doctorName}</strong></div>
        <div>Hospital: <strong>{data.hospitalId}</strong></div>
        <div>Período: <strong>{data.period.from}</strong> a <strong>{data.period.to}</strong></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded border p-2">
          <div className="text-xs text-gray-500">Total AIHs</div>
          <div className="font-bold">{data.totals.totalAIHs}</div>
        </div>
        <div className="bg-white rounded border p-2">
          <div className="text-xs text-gray-500">Procedimentos “04”</div>
          <div className="font-bold">{data.totals.totalProcedures04}</div>
        </div>
        <div className="bg-white rounded border p-2">
          <div className="text-xs text-gray-500">Total calculado (R$)</div>
          <div className="font-bold">{data.totals.totalCalculatedPayment.toFixed(2)}</div>
        </div>
      </div>
      <div className="space-y-3">
        {data.aihrs.map((a) => (
          <div key={a.aihId} className="bg-gray-50 rounded border p-3">
            <div className="flex justify-between">
              <div>
                <div className="text-xs text-gray-500">AIH</div>
                <div className="font-mono text-sm">{a.aihNumber}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Regra aplicada</div>
                <div className="text-sm font-medium">{a.appliedRule}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total (R$)</div>
                <div className="text-sm font-bold">{a.totalPayment.toFixed(2)}</div>
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xs font-medium">HON por sequência</div>
              <div className="text-xs">
                {a.honAssignments.length === 0 ? (
                  <span>N/A</span>
                ) : (
                  a.honAssignments.map(h => (
                    <span key={`${h.code}-${h.position}`} className="inline-block mr-2 mb-1 px-2 py-1 bg-green-100 border border-green-200 rounded">
                      <span className="font-mono">{h.code}</span> • pos {h.position} • R$ {h.payment.toFixed(2)}
                    </span>
                  ))
                )}
              </div>
            </div>
            {a.ignoredCodes.length > 0 && (
              <div className="mt-2">
                <div className="text-xs font-medium">Ignorados (sem HON)</div>
                <div className="text-xs">
                  {a.ignoredCodes.map(code => (
                    <span key={code} className="inline-block mr-2 mb-1 px-2 py-1 bg-yellow-100 border border-yellow-200 rounded font-mono">
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default DebugDoctor

