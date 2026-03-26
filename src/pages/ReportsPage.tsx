import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, BarChart3 } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground text-sm mt-1">Indicadores e relatórios gerenciais</p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <BarChart3 className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-sm font-medium">Em desenvolvimento</p>
          <p className="text-xs mt-1">Os relatórios com indicadores estarão disponíveis em breve</p>
        </CardContent>
      </Card>
    </div>
  );
}
