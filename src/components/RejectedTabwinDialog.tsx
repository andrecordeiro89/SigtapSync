import React, { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Card, CardContent, CardHeader } from './ui/card'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Calendar, FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { SihTabwinReportService, TabwinReportFilters } from '../services/sihTabwinReportService'

type HospitalOption = { id: string; name: string; cnes?: string }

export type RejectedTabwinDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const formatDateRangeLabel = (from?: string, to?: string) => {
  const f = from ? from.split('-').reverse().join('/') : '—'
  const t = to ? to.split('-').reverse().join('/') : '—'
  return `${f} — ${t}`
}

const endOfMonthISO = (isoDate: string): string => {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  const year = Number(m[1])
  const month = Number(m[2])
  if (!year || !month) return ''
  const end = new Date(year, month, 0)
  const y = end.getFullYear()
  const mm = String(end.getMonth() + 1).padStart(2, '0')
  const dd = String(end.getDate()).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

export default function RejectedTabwinDialog({ open, onOpenChange }: RejectedTabwinDialogProps) {
  const [hospitals, setHospitals] = useState<HospitalOption[]>([])
  const [selectedHospital, setSelectedHospital] = useState<string>('all')
  const [excludedHospitalIds, setExcludedHospitalIds] = useState<string[]>([])
  const [dischargeFrom, setDischargeFrom] = useState<string>('')
  const [dischargeTo, setDischargeTo] = useState<string>('')
  const [inputDischargeFrom, setInputDischargeFrom] = useState<string>('')
  const [inputDischargeTo, setInputDischargeTo] = useState<string>('')
  const [loadingHospitals, setLoadingHospitals] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const loadHospitals = async () => {
      setLoadingHospitals(true)
      try {
        const { data, error } = await supabase
          .from('hospitals')
          .select('id,name,cnes')
          .eq('is_active', true)
          .order('name')
        if (error) throw error
        if (!cancelled) setHospitals((data || []).map((h: any) => ({ id: h.id, name: h.name, cnes: h.cnes })))
      } catch (e: any) {
        toast.error('Erro ao carregar hospitais')
      } finally {
        if (!cancelled) setLoadingHospitals(false)
      }
    }
    loadHospitals()
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (!open) return
    setInputDischargeFrom(dischargeFrom || '')
    setInputDischargeTo(dischargeTo || '')
  }, [open])

  useEffect(() => {
    if (!open) return
    setExcludedHospitalIds([])
  }, [open])

  const hospitalLabel = useMemo(() => {
    if (selectedHospital === 'all') return 'Todos os hospitais'
    return hospitals.find(h => h.id === selectedHospital)?.name || 'Hospital'
  }, [hospitals, selectedHospital])

  const handleGeneratePdf = async () => {
    try {
      if (!dischargeFrom || !dischargeTo) {
        toast.error('Por favor, selecione um período de alta.')
        return
      }

      setGenerating(true)
      
      const filters: TabwinReportFilters = {
          hospitalId: selectedHospital,
          dischargeFrom: dischargeFrom,
          dischargeTo: dischargeTo,
          doctorCns: 'all',
          excludedHospitalIds: selectedHospital === 'all' ? excludedHospitalIds : []
      }

      const data = await SihTabwinReportService.fetchRejectedReport(filters)
      
      if (data.length === 0) {
        toast.info('Nenhuma AIH rejeitada encontrada para os filtros selecionados.')
        return
      }

      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      doc.setFontSize(14)
      doc.text('Relatório de AIHs Rejeitadas (Tabwin SIH)', 40, 40)
      doc.setFontSize(10)
      doc.text(`Unidade Hospitalar: ${hospitalLabel}`, 40, 60)
      doc.text(`Período: ${formatDateRangeLabel(dischargeFrom, dischargeTo)}`, 40, 75)
      doc.text(`Total de AIHs: ${data.length}`, 40, 90)
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 40, 105)

      const headers = [
        'AIH', 'Paciente', 'Hospital', 'Alta', 'Comp.', 'Valor Total', 'Procedimento', 'CID'
      ]

      const body = data.map(r => [
        r.aihNumber,
        r.patientName || '—',
        r.hospitalName || '—',
        r.dtSaida || '—',
        r.competencia || '—',
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.valorTotal || 0),
        r.procedimento || '—',
        r.cid || '—'
      ])

      autoTable(doc, {
        head: [headers],
        body: body,
        startY: 125,
        styles: { fontSize: 7, cellPadding: 3 },
        headStyles: { fillColor: [220, 38, 38] }, // Vermelho para rejeitados
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 40, right: 40 }
      })

      // Calcular totais
      const totalsByHospital = data.reduce((acc, curr) => {
        const hosp = curr.hospitalName || 'Hospital não identificado'
        acc[hosp] = (acc[hosp] || 0) + (curr.valorTotal || 0)
        return acc
      }, {} as Record<string, number>)

      const countsByHospital = data.reduce((acc, curr) => {
        const hosp = curr.hospitalName || 'Hospital não identificado'
        acc[hosp] = (acc[hosp] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const grandTotal = data.reduce((sum, curr) => sum + (curr.valorTotal || 0), 0)

      // Adicionar resumo na última página
      let finalY = (doc as any).lastAutoTable.finalY + 30
      
      // Verificar se cabe na página, senão cria nova
      if (finalY > doc.internal.pageSize.height - 100) {
          doc.addPage()
          finalY = 40
      }

      doc.setFontSize(12)
      doc.setTextColor(0, 0, 0)
      doc.text('Resumo por Hospital:', 40, finalY)
      finalY += 20

      doc.setFontSize(10)
      Object.entries(totalsByHospital).sort((a, b) => a[0].localeCompare(b[0])).forEach(([hosp, total]) => {
          if (finalY > doc.internal.pageSize.height - 50) {
              doc.addPage()
              finalY = 40
          }
          const val = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)
          const cnt = countsByHospital[hosp] || 0
          doc.text(`${hosp}: ${cnt} AIH(s) | ${val}`, 40, finalY)
          finalY += 15
      })

      finalY += 10
      if (finalY > doc.internal.pageSize.height - 40) {
          doc.addPage()
          finalY = 40
      }

      doc.setFontSize(14)
      doc.setTextColor(220, 38, 38) // Red
      doc.setFont('helvetica', 'bold')
      const totalVal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(grandTotal)
      doc.text(`Total Geral de Rejeições: ${data.length} AIH(s) | ${totalVal}`, 40, finalY)

      doc.save(`AIHs_Rejeitadas_${new Date().toISOString().slice(0, 10)}.pdf`)
      toast.success('Relatório de rejeitados gerado com sucesso')
    } catch (e: any) {
      console.error('Erro ao gerar relatório de rejeitados:', e)
      toast.error('Erro ao gerar relatório: ' + (e.message || 'Erro desconhecido'))
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateExcel = async () => {
    try {
      if (!dischargeFrom || !dischargeTo) {
        toast.error('Por favor, selecione um período de alta.')
        return
      }

      setGenerating(true)

      const filters: TabwinReportFilters = {
        hospitalId: selectedHospital,
        dischargeFrom: dischargeFrom,
        dischargeTo: dischargeTo,
        doctorCns: 'all',
        excludedHospitalIds: selectedHospital === 'all' ? excludedHospitalIds : []
      }

      const data = await SihTabwinReportService.fetchRejectedReport(filters)
      if (data.length === 0) {
        toast.info('Nenhuma AIH rejeitada encontrada para os filtros selecionados.')
        return
      }

      const headers = ['AIH', 'Paciente', 'Hospital', 'Alta', 'Comp.', 'Valor Total', 'Procedimento', 'CID']
      const body = data.map(r => [
        r.aihNumber,
        r.patientName || '—',
        r.hospitalName || '—',
        r.dtSaida || '—',
        r.competencia || '—',
        r.valorTotal || 0,
        r.procedimento || '—',
        r.cid || '—'
      ])

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet([headers, ...body])
      XLSX.utils.book_append_sheet(wb, ws, 'Rejeitados')
      const fileName = `AIHs_Rejeitadas_${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, fileName)
      toast.success('Relatório Excel gerado com sucesso')
    } catch (e: any) {
      toast.error('Erro ao gerar relatório Excel')
    } finally {
      setGenerating(false)
    }
  }

  const disabled = generating || loadingHospitals

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[97vw] text-lg">
        <DialogHeader>
          <DialogTitle className="text-3xl text-red-600">Relatório de Rejeitados Tabwin</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* 1. Unidade Hospitalar */}
          <Card className="border border-gray-200 w-full">
            <CardHeader className="pb-2">
              <div className="text-center text-xl font-semibold text-black">
                Unidade Hospitalar
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select value={selectedHospital} onValueChange={(v) => { setSelectedHospital(v); setExcludedHospitalIds([]) }}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecione o hospital" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os hospitais</SelectItem>
                  {hospitals.map(h => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedHospital === 'all' && hospitals.length > 0 && (
                <div className="pt-2">
                  <div className="text-sm font-semibold text-black mb-2">
                    Excluir hospitais do relatório
                  </div>
                  <div className="max-h-40 overflow-auto border border-gray-200 rounded-md p-2 space-y-2">
                    {hospitals.map(h => {
                      const checked = excludedHospitalIds.includes(h.id)
                      return (
                        <label key={h.id} className="flex items-center gap-2 text-sm text-black">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? Array.from(new Set([...excludedHospitalIds, h.id]))
                                : excludedHospitalIds.filter(id => id !== h.id)
                              setExcludedHospitalIds(next)
                            }}
                          />
                          <span>{h.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
              {loadingHospitals && (
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Carregando hospitais...
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. Filtros de Data */}
          <Card className="border border-gray-200 w-full">
            <CardHeader className="pb-2">
              <div className="text-center text-xl font-semibold text-black">
                Filtros de Data (Alta)
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <div className="w-full space-y-3">
                 <div className="grid grid-cols-2 gap-4 items-end">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-bold text-black uppercase tracking-wide mb-2">
                        <Calendar className="h-3.5 w-3.5 text-black" />
                        Início
                      </label>
                      <input
                        type="date"
                        value={inputDischargeFrom}
                        onChange={(e) => {
                          const v = e.target.value
                          setInputDischargeFrom(v)
                          if (!v) {
                            setInputDischargeTo('')
                            setDischargeTo('')
                            return
                          }
                          const end = endOfMonthISO(v)
                          if (end) {
                            setInputDischargeTo(end)
                            setDischargeTo(end)
                          }
                        }}
                        onBlur={() => setDischargeFrom(inputDischargeFrom || '')}
                        disabled={disabled}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg bg-white text-base focus:outline-none focus:border-black hover:border-gray-300 transition-colors h-11"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-bold text-black uppercase tracking-wide mb-2">
                        <Calendar className="h-3.5 w-3.5 text-black" />
                        Fim
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={inputDischargeTo}
                          onChange={(e) => {
                            const v = e.target.value
                            setInputDischargeTo(v)
                          }}
                          onBlur={() => setDischargeTo(inputDischargeTo || '')}
                          disabled={disabled}
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg bg-white text-base focus:outline-none focus:border-black hover:border-gray-300 transition-colors h-11"
                        />
                        {(dischargeFrom || dischargeTo) && (
                          <button
                            onClick={() => {
                              setInputDischargeFrom('')
                              setInputDischargeTo('')
                              setDischargeFrom('')
                              setDischargeTo('')
                            }}
                            className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0"
                            title="Limpar filtro de alta"
                            type="button"
                            disabled={disabled}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                 </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <Button
            type="button"
            onClick={handleGeneratePdf}
            disabled={disabled}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white shadow-sm h-9 px-3 rounded-md text-sm w-auto min-w-[180px]"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Gerar Relatório PDF
          </Button>
          <Button
            type="button"
            onClick={handleGenerateExcel}
            disabled={disabled}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white shadow-sm h-9 px-3 rounded-md text-sm w-auto min-w-[180px]"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Gerar Relatório Excel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
