import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import DoctorPaymentRulesManager from './DoctorPaymentRulesManager'
import RulesSimulation from './RulesSimulation'
import SigtapAdmin from './SigtapAdmin'
import RepasseRules from '../RepasseRules'

export default function RulesStudio() {
  const [tab, setTab] = useState<'pagamento' | 'repasse' | 'simulacao' | 'sigtap'>('pagamento')

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v: any) => setTab(v)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="pagamento">Pagamento Médico</TabsTrigger>
          <TabsTrigger value="repasse">Repasse (SIGTAP)</TabsTrigger>
          <TabsTrigger value="simulacao">Simulação</TabsTrigger>
          <TabsTrigger value="sigtap">SIGTAP</TabsTrigger>
        </TabsList>
        <TabsContent value="pagamento">
          <DoctorPaymentRulesManager />
        </TabsContent>
        <TabsContent value="repasse">
          <RepasseRules />
        </TabsContent>
        <TabsContent value="simulacao">
          <RulesSimulation />
        </TabsContent>
        <TabsContent value="sigtap">
          <SigtapAdmin />
        </TabsContent>
      </Tabs>
    </div>
  )
}

