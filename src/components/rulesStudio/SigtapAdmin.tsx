import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Textarea } from '../ui/textarea'
import { supabase, centavosToReais, reaisToCentavos } from '../../lib/supabase'
import { SigtapService } from '../../services/supabaseService'
import { useSigtapContext } from '../../contexts/SigtapContext'

type DbProc = any

const parseMoney = (s: string): number => {
  const raw = String(s || '').trim()
  if (!raw) return 0
  const normalized = raw.replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

export default function SigtapAdmin() {
  const { forceReload } = useSigtapContext()
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<DbProc[]>([])
  const [loading, setLoading] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [valueHosp, setValueHosp] = useState('')
  const [valueProf, setValueProf] = useState('')
  const [valueAmb, setValueAmb] = useState('')
  const [valueHospTotal, setValueHospTotal] = useState('')
  const [valueAmbTotal, setValueAmbTotal] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    ;(async () => {
      const v = await SigtapService.getActiveVersion()
      setActiveVersionId(v?.id || null)
    })()
  }, [])

  const doSearch = async () => {
    if (!activeVersionId) {
      toast.error('Nenhuma versão SIGTAP ativa encontrada')
      return
    }
    const term = String(search || '').trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const q = supabase
        .from('sigtap_procedures')
        .select('id,code,description,value_hosp,value_prof,value_amb,value_hosp_total,value_amb_total')
        .eq('version_id', activeVersionId)
        .order('code', { ascending: true })
        .limit(50)
      const { data, error } = await q.or(`code.ilike.%${term}%,description.ilike.%${term}%`)
      if (error) throw error
      setResults((data || []) as any)
    } catch (e: any) {
      toast.error(`Falha ao buscar: ${String(e?.message || e)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const h = setTimeout(() => {
      doSearch()
    }, 250)
    return () => clearTimeout(h)
  }, [search, activeVersionId])

  const resetForm = () => {
    setEditingId(null)
    setCode('')
    setDescription('')
    setValueHosp('')
    setValueProf('')
    setValueAmb('')
    setValueHospTotal('')
    setValueAmbTotal('')
    setNotes('')
  }

  const selectProc = (p: DbProc) => {
    setEditingId(p.id)
    setCode(String(p.code || ''))
    setDescription(String(p.description || ''))
    setValueHosp(String(centavosToReais(p.value_hosp || 0)))
    setValueProf(String(centavosToReais(p.value_prof || 0)))
    setValueAmb(String(centavosToReais(p.value_amb || 0)))
    setValueHospTotal(String(centavosToReais(p.value_hosp_total || 0)))
    setValueAmbTotal(String(centavosToReais(p.value_amb_total || 0)))
  }

  const save = async () => {
    if (!activeVersionId) {
      toast.error('Nenhuma versão SIGTAP ativa encontrada')
      return
    }
    const codeTrim = String(code || '').trim()
    const descTrim = String(description || '').trim()
    if (!codeTrim || !descTrim) {
      toast.error('Código e descrição são obrigatórios')
      return
    }
    setLoading(true)
    try {
      const payload = {
        version_id: activeVersionId,
        code: codeTrim,
        description: descTrim,
        value_hosp: reaisToCentavos(parseMoney(valueHosp)),
        value_prof: reaisToCentavos(parseMoney(valueProf)),
        value_amb: reaisToCentavos(parseMoney(valueAmb)),
        value_hosp_total: reaisToCentavos(parseMoney(valueHospTotal)),
        value_amb_total: reaisToCentavos(parseMoney(valueAmbTotal))
      } as any

      if (editingId) {
        const { error } = await supabase.from('sigtap_procedures').update(payload).eq('id', editingId)
        if (error) throw error
        toast.success('Procedimento atualizado')
      } else {
        const { data: existing, error: readErr } = await supabase
          .from('sigtap_procedures')
          .select('id')
          .eq('version_id', activeVersionId)
          .eq('code', codeTrim)
          .limit(1)
          .maybeSingle()
        if (readErr) throw readErr
        if (existing?.id) {
          const { error } = await supabase.from('sigtap_procedures').update(payload).eq('id', existing.id)
          if (error) throw error
          toast.success('Procedimento atualizado (já existia)')
        } else {
          const { error } = await supabase.from('sigtap_procedures').insert(payload)
          if (error) throw error
          toast.success('Procedimento criado')
        }
      }

      try {
        await forceReload()
      } catch {}
      await doSearch()
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${String(e?.message || e)}`)
    } finally {
      setLoading(false)
    }
  }

  const activeVersionLabel = useMemo(() => (activeVersionId ? activeVersionId : 'Nenhuma'), [activeVersionId])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Gestão SIGTAP</CardTitle>
          <div className="text-xs text-muted-foreground">Versão ativa: {activeVersionLabel}</div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Buscar</div>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Código ou descrição" />
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={doSearch} disabled={loading}>
                Buscar
              </Button>
              <Button variant="outline" onClick={resetForm} disabled={loading}>
                Novo
              </Button>
              <Button onClick={save} disabled={loading}>
                Salvar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">SH</TableHead>
                    <TableHead className="text-right">SP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((p) => (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => selectProc(p)}>
                      <TableCell className="font-mono text-xs">{p.code}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.description}</TableCell>
                      <TableCell className="text-right text-xs">{centavosToReais(p.value_hosp || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-xs">{centavosToReais(p.value_prof || 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Código</div>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex: 04.08.05.089-6" />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Descrição</div>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">SH</div>
                  <Input value={valueHosp} onChange={(e) => setValueHosp(e.target.value)} placeholder="0,00" />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">SP</div>
                  <Input value={valueProf} onChange={(e) => setValueProf(e.target.value)} placeholder="0,00" />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">SA</div>
                  <Input value={valueAmb} onChange={(e) => setValueAmb(e.target.value)} placeholder="0,00" />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">SH Total</div>
                  <Input value={valueHospTotal} onChange={(e) => setValueHospTotal(e.target.value)} placeholder="0,00" />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">SA Total</div>
                  <Input value={valueAmbTotal} onChange={(e) => setValueAmbTotal(e.target.value)} placeholder="0,00" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Notas</div>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

