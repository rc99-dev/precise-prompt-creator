import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";

export default function PendingApprovalPage() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-warning/20 p-4">
              <Clock className="h-10 w-10 text-warning" />
            </div>
          </div>
          <CardTitle className="text-xl">Aguardando Aprovação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground text-sm">
            Seu acesso está sendo revisado pelo administrador. Aguarde a aprovação para utilizar o sistema.
          </p>
          <Button variant="outline" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" />Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
