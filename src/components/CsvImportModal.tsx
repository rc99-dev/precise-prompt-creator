import { useState, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, CheckCircle2, XCircle, FileSpreadsheet, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export type CsvColumnDef = {
  csvHeader: string;
  dbField: string;
  required: boolean;
  label: string;
  validate?: (value: string) => string | null; // returns error message or null
  transform?: (value: string) => unknown;
};

export type CsvImportConfig = {
  title: string;
  templateFilename: string;
  columns: CsvColumnDef[];
  onImport: (validRows: Record<string, unknown>[]) => Promise<{ success: number; errors: string[] }>;
};

type ParsedRow = {
  index: number;
  raw: Record<string, string>;
  data: Record<string, unknown>;
  errors: string[];
  valid: boolean;
};

function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if ((ch === ',' || ch === ';') && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_àáâãéêíóôõúç]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''));
  const rows = lines.slice(1).map(line => {
    const values = parseRow(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
  return { headers, rows };
}

function generateTemplateCsv(columns: CsvColumnDef[]): string {
  return columns.map(c => c.csvHeader).join(";");
}

export default function CsvImportModal({ config, open, onOpenChange, onComplete }: {
  config: CsvImportConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);

  const reset = useCallback(() => {
    setStep(1);
    setFileHeaders([]);
    setParsedRows([]);
    setImporting(false);
    setResult(null);
  }, []);

  const handleClose = useCallback((v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  }, [onOpenChange, reset]);

  const columnMap = useMemo(() => {
    const map: Record<string, CsvColumnDef> = {};
    config.columns.forEach(c => {
      const variations = [c.csvHeader.toLowerCase(), c.dbField.toLowerCase()];
      variations.forEach(v => { map[v] = c; });
    });
    return map;
  }, [config.columns]);

  const foundColumns = useMemo(() => {
    return config.columns.filter(c =>
      fileHeaders.some(h => h === c.csvHeader.toLowerCase() || h === c.dbField.toLowerCase())
    );
  }, [config.columns, fileHeaders]);

  const missingRequired = useMemo(() => {
    return config.columns.filter(c => c.required && !foundColumns.includes(c));
  }, [config.columns, foundColumns]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCsvText(text);
      setFileHeaders(headers);

      const parsed: ParsedRow[] = rows.map((raw, index) => {
        const errors: string[] = [];
        const data: Record<string, unknown> = {};

        config.columns.forEach(col => {
          const headerKey = headers.find(h => h === col.csvHeader.toLowerCase() || h === col.dbField.toLowerCase());
          const value = headerKey ? raw[headerKey]?.trim() || "" : "";

          if (col.required && !value) {
            errors.push(`"${col.label}" é obrigatório`);
          } else if (value && col.validate) {
            const err = col.validate(value);
            if (err) errors.push(err);
          }

          data[col.dbField] = col.transform ? col.transform(value) : (value || null);
        });

        return { index: index + 2, raw, data, errors, valid: errors.length === 0 };
      });

      setParsedRows(parsed);
      setStep(2);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  }, [config.columns]);

  const validRows = useMemo(() => parsedRows.filter(r => r.valid), [parsedRows]);
  const invalidRows = useMemo(() => parsedRows.filter(r => !r.valid), [parsedRows]);

  const handleConfirm = useCallback(async () => {
    if (validRows.length === 0) { toast.error("Nenhum registro válido para importar."); return; }
    setImporting(true);
    try {
      const res = await config.onImport(validRows.map(r => r.data));
      setResult(res);
      setStep(3);
    } catch (err: unknown) {
      toast.error("Erro na importação: " + (err instanceof Error ? err.message : String(err)));
    }
    setImporting(false);
  }, [validRows, config]);

  const downloadTemplate = useCallback(() => {
    const csv = generateTemplateCsv(config.columns);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = config.templateFilename;
    a.click();
    URL.revokeObjectURL(url);
  }, [config]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {config.title}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Faça o upload do arquivo CSV para iniciar a importação."}
            {step === 2 && "Revise os dados antes de confirmar a importação."}
            {step === 3 && "Resultado da importação."}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 text-xs">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex items-center gap-1 ${step >= s ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${step >= s ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                {s}
              </div>
              <span className="hidden sm:inline">{s === 1 ? 'Upload' : s === 2 ? 'Pré-visualização' : 'Resultado'}</span>
              {s < 3 && <ArrowRight className="h-3 w-3 mx-1" />}
            </div>
          ))}
        </div>

        {/* STEP 1 - Upload */}
        {step === 1 && (
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">Selecione um arquivo CSV (separado por vírgula ou ponto-e-vírgula)</p>
              <label className="cursor-pointer">
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
                <Button type="button" asChild><span>Selecionar Arquivo</span></Button>
              </label>
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/30">
              <div>
                <p className="text-sm font-medium">Modelo CSV</p>
                <p className="text-xs text-muted-foreground">Baixe o modelo com as colunas corretas</p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1" />Baixar Modelo
              </Button>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Colunas obrigatórias:</p>
              <div className="flex flex-wrap gap-1">
                {config.columns.filter(c => c.required).map(c => (
                  <Badge key={c.dbField} variant="outline" className="text-xs">{c.csvHeader}</Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 - Preview */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Column detection summary */}
            <div className="flex flex-wrap gap-2">
              {config.columns.map(c => {
                const found = foundColumns.includes(c);
                return (
                  <Badge key={c.dbField} variant={found ? "default" : "destructive"} className="text-xs">
                    {found ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    {c.csvHeader} {c.required ? '*' : ''}
                  </Badge>
                );
              })}
            </div>

            {missingRequired.length > 0 && (
              <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                Colunas obrigatórias não encontradas: {missingRequired.map(c => c.csvHeader).join(", ")}
              </div>
            )}

            {/* Stats */}
            <div className="flex gap-4 text-sm">
              <span className="text-green-400">{validRows.length} válidos</span>
              <span className="text-destructive">{invalidRows.length} com erro</span>
              <span className="text-muted-foreground">{parsedRows.length} total</span>
            </div>

            {/* Preview table */}
            <div className="overflow-x-auto border rounded-lg max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b">
                    <th className="py-2 px-3 text-left text-muted-foreground font-medium">Linha</th>
                    {config.columns.map(c => (
                      <th key={c.dbField} className="py-2 px-3 text-left text-muted-foreground font-medium">{c.label}</th>
                    ))}
                    <th className="py-2 px-3 text-left text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 10).map(row => (
                    <tr key={row.index} className={`border-b ${row.valid ? 'bg-green-500/5' : 'bg-destructive/10'}`}>
                      <td className="py-2 px-3 text-muted-foreground">{row.index}</td>
                      {config.columns.map(c => (
                        <td key={c.dbField} className="py-2 px-3 max-w-[150px] truncate">
                          {String(row.data[c.dbField] ?? '—')}
                        </td>
                      ))}
                      <td className="py-2 px-3">
                        {row.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                        ) : (
                          <span className="text-destructive text-xs">{row.errors.join('; ')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {parsedRows.length > 10 && (
                    <tr><td colSpan={config.columns.length + 2} className="py-2 px-3 text-center text-muted-foreground">
                      ... e mais {parsedRows.length - 10} registros
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => { reset(); }}>
                <ArrowLeft className="h-4 w-4 mr-1" />Voltar
              </Button>
              <Button onClick={handleConfirm} disabled={importing || validRows.length === 0}>
                {importing ? "Importando..." : `Importar ${validRows.length} registro(s)`}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3 - Result */}
        {step === 3 && result && (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-400" />
              <p className="text-lg font-semibold">{result.success} registros importados com sucesso</p>
              {result.errors.length > 0 && (
                <p className="text-sm text-destructive">{result.errors.length} erro(s) durante a importação</p>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="bg-destructive/10 rounded-lg p-3 max-h-[200px] overflow-y-auto space-y-1">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">{err}</p>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => { handleClose(false); onComplete(); }}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
