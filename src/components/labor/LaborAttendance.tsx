import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, Save, ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addReportHeader } from "@/utils/pdfHeader";
import { fetchCompanyInfo } from "@/utils/exportWithHeader";

const ABSENCE_TYPES = [
  { value: "", label: "—" },
  { value: "falta", label: "Falta" },
  { value: "atestado", label: "Atestado" },
  { value: "folga", label: "Folga" },
  { value: "feriado", label: "Feriado" },
  { value: "ferias", label: "Férias" },
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const inputClass = "w-full px-2 py-1.5 rounded border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring text-xs";

function getDaysInMonth(year: number, month: number) {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function fmtDate(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function LaborAttendance({ laborId, laborName, companyId }: { laborId: string; laborName: string; companyId?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [editingRows, setEditingRows] = useState<Record<string, any>>({});

  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const monthLabel = new Date(year, month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["labor_attendance", laborId, year, month],
    queryFn: async () => {
      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const endDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("labor_attendance" as any)
        .select("*")
        .eq("labor_id", laborId)
        .gte("attendance_date", startDate)
        .lte("attendance_date", endDate)
        .order("attendance_date");
      if (error) throw error;
      return data as any[];
    },
  });

  const itemsByDate = useMemo(() => {
    const map: Record<string, any> = {};
    items.forEach(i => { map[i.attendance_date] = i; });
    return map;
  }, [items]);

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      const existing = itemsByDate[values.attendance_date];
      if (existing) {
        const { error } = await supabase.from("labor_attendance" as any).update(values).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("labor_attendance" as any).insert({ ...values, labor_id: laborId, user_id: user!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["labor_attendance", laborId, year, month] }); toast.success("Salvo!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("labor_attendance" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["labor_attendance", laborId, year, month] }); toast.success("Removido!"); },
  });

  const handleSaveRow = (dateStr: string) => {
    const row = editingRows[dateStr];
    if (!row) return;
    saveMutation.mutate({
      attendance_date: dateStr,
      entry_time: row.entry_time || null,
      exit_time: row.exit_time || null,
      extra_hours: row.extra_hours ? Number(row.extra_hours) : 0,
      worked: row.worked ?? true,
      absence_type: row.absence_type || null,
      notes: row.notes || null,
    });
    setEditingRows(p => { const n = { ...p }; delete n[dateStr]; return n; });
  };

  const getRow = (dateStr: string) => {
    if (editingRows[dateStr]) return editingRows[dateStr];
    const existing = itemsByDate[dateStr];
    if (existing) return { entry_time: existing.entry_time || "", exit_time: existing.exit_time || "", extra_hours: existing.extra_hours || "", worked: existing.worked, absence_type: existing.absence_type || "", notes: existing.notes || "" };
    return { entry_time: "", exit_time: "", extra_hours: "", worked: true, absence_type: "", notes: "" };
  };

  const setRowField = (dateStr: string, field: string, value: any) => {
    const current = getRow(dateStr);
    setEditingRows(p => ({ ...p, [dateStr]: { ...current, [field]: value } }));
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Stats
  const totalWorked = items.filter(i => i.worked).length;
  const totalAbsences = items.filter(i => !i.worked).length;
  const totalExtra = items.reduce((sum, i) => sum + (Number(i.extra_hours) || 0), 0);

  // Generate PDF
  const generatePDF = async () => {
    const doc = new jsPDF("portrait", "mm", "a4");
    const companyInfo = user ? await fetchCompanyInfo(user.id) : null;
    const startY = await addReportHeader(doc, companyInfo, `Folha de Frequência - ${laborName}`, `Período: ${monthLabel}`);

    const tableData = days.map(d => {
      const dateStr = fmtDate(d);
      const row = itemsByDate[dateStr];
      const weekday = WEEKDAYS[d.getDay()];
      const dayNum = String(d.getDate()).padStart(2, "0");
      if (!row) return [dayNum, weekday, "", "", "", "", ""];
      return [
        dayNum,
        weekday,
        row.entry_time || "",
        row.exit_time || "",
        row.extra_hours ? String(row.extra_hours) : "",
        row.worked ? "Sim" : (ABSENCE_TYPES.find(a => a.value === row.absence_type)?.label || "Não"),
        row.notes || "",
      ];
    });

    autoTable(doc, {
      startY: startY + 16,
      head: [["Dia", "Sem", "Entrada", "Saída", "H.E.", "Presença", "Obs."]],
      body: tableData,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [180, 83, 9], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 12 }, 2: { cellWidth: 18 }, 3: { cellWidth: 18 }, 4: { cellWidth: 14 }, 5: { cellWidth: 22 } },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 200;
    doc.setFontSize(8);
    doc.text(`Dias trabalhados: ${totalWorked} | Faltas/Ausências: ${totalAbsences} | Horas extras: ${totalExtra.toFixed(1)}h`, 14, finalY + 6);
    doc.text("_______________________________", 14, finalY + 20);
    doc.text("Assinatura do colaborador", 14, finalY + 24);
    doc.text("_______________________________", 120, finalY + 20);
    doc.text("Assinatura do responsável", 120, finalY + 24);

    doc.save(`frequencia_${laborName.replace(/\s+/g, "_")}_${year}_${String(month + 1).padStart(2, "0")}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
          <h4 className="text-sm font-semibold text-foreground capitalize min-w-[160px] text-center">{monthLabel}</h4>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <button onClick={generatePDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90">
          <FileSpreadsheet className="h-3.5 w-3.5" /> Gerar PDF
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs">
        <span className="px-3 py-1.5 rounded bg-primary/10 text-primary font-medium">Dias trabalhados: {totalWorked}</span>
        <span className="px-3 py-1.5 rounded bg-destructive/10 text-destructive font-medium">Ausências: {totalAbsences}</span>
        <span className="px-3 py-1.5 rounded bg-accent text-accent-foreground font-medium">Horas extras: {totalExtra.toFixed(1)}h</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <div className="overflow-auto max-h-[45vh]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-amber-700 text-white">
                <th className="text-left px-2 py-2 font-semibold w-10">Dia</th>
                <th className="text-left px-2 py-2 font-semibold w-10">Sem</th>
                <th className="text-left px-2 py-2 font-semibold w-20">Entrada</th>
                <th className="text-left px-2 py-2 font-semibold w-20">Saída</th>
                <th className="text-left px-2 py-2 font-semibold w-16">H.E.</th>
                <th className="text-center px-2 py-2 font-semibold w-12">Pres.</th>
                <th className="text-left px-2 py-2 font-semibold w-24">Tipo ausência</th>
                <th className="text-left px-2 py-2 font-semibold">Obs.</th>
                <th className="text-center px-2 py-2 font-semibold w-16">Ações</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d, idx) => {
                const dateStr = fmtDate(d);
                const weekday = WEEKDAYS[d.getDay()];
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const row = getRow(dateStr);
                const hasData = !!itemsByDate[dateStr];
                const isEditing = !!editingRows[dateStr];

                return (
                  <tr key={dateStr} className={`${isWeekend ? "bg-muted/60" : idx % 2 === 0 ? "bg-background" : "bg-muted/30"} hover:bg-primary/5`}>
                    <td className="px-2 py-1 font-medium text-foreground">{String(d.getDate()).padStart(2, "0")}</td>
                    <td className={`px-2 py-1 ${isWeekend ? "text-destructive font-medium" : "text-foreground"}`}>{weekday}</td>
                    <td className="px-1 py-1">
                      <input type="time" value={row.entry_time || ""} onChange={e => setRowField(dateStr, "entry_time", e.target.value)} className={inputClass} />
                    </td>
                    <td className="px-1 py-1">
                      <input type="time" value={row.exit_time || ""} onChange={e => setRowField(dateStr, "exit_time", e.target.value)} className={inputClass} />
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" step="0.5" min="0" value={row.extra_hours || ""} onChange={e => setRowField(dateStr, "extra_hours", e.target.value)} className={inputClass} placeholder="0" />
                    </td>
                    <td className="px-1 py-1 text-center">
                      <input type="checkbox" checked={row.worked ?? true} onChange={e => setRowField(dateStr, "worked", e.target.checked)} className="accent-primary" />
                    </td>
                    <td className="px-1 py-1">
                      <select value={row.absence_type || ""} onChange={e => setRowField(dateStr, "absence_type", e.target.value)} className={inputClass} disabled={row.worked}>
                        {ABSENCE_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <input value={row.notes || ""} onChange={e => setRowField(dateStr, "notes", e.target.value)} className={inputClass} />
                    </td>
                    <td className="px-1 py-1">
                      <div className="flex gap-0.5 justify-center">
                        {isEditing && (
                          <button onClick={() => handleSaveRow(dateStr)} className="p-1 rounded hover:bg-primary/10 text-primary" title="Salvar"><Save className="h-3.5 w-3.5" /></button>
                        )}
                        {hasData && (
                          <button onClick={() => { if (confirm("Remover registro?")) deleteMutation.mutate(itemsByDate[dateStr].id); }} className="p-1 rounded hover:bg-destructive/10 text-destructive" title="Remover"><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
