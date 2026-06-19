import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Factory } from "lucide-react";
import PcpCrudTab from "@/components/pcp/PcpCrudTab";
import PcpDashboard from "@/components/pcp/PcpDashboard";
import { PCP_TABS } from "@/lib/pcpConfig";

export default function PcpPage() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Factory className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">PCP — Planejamento e Controle de Produção</h1>
          <p className="text-sm text-muted-foreground">
            Central de Distribuição de Proteínas · Compras, rendimento, validades e CMV
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="dashboard">Visão Geral</TabsTrigger>
          {PCP_TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard"><PcpDashboard /></TabsContent>
        {PCP_TABS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            <PcpCrudTab config={t.config} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
