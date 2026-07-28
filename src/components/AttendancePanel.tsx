import React, { useState } from "react";
import {
  Search,
  Calendar,
  ClipboardList,
  Printer,
  Trash2,
  ShieldCheck,
  Clock,
  Users,
  FileSpreadsheet,
  Download,
  Filter,
  GraduationCap,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  AlertCircle
} from "lucide-react";
import { Attendance, Student, Employee, Holiday } from "../types";
import { motion } from "motion/react";

interface AttendancePanelProps {
  attendance: Attendance[];
  onDeleteAttendanceRecord: (id: string) => Promise<void>;
  settings: any;
  currentUserRole?: string;
  currentUserBranch?: string;
  students?: Student[];
  employees?: Employee[];
  holidays?: Holiday[];
}

const ARABIC_MONTHS = [
  { value: 1, label: "يناير (01)" },
  { value: 2, label: "فبراير (02)" },
  { value: 3, label: "مارس (03)" },
  { value: 4, label: "أبريل (04)" },
  { value: 5, label: "مايو (05)" },
  { value: 6, label: "يونيو (06)" },
  { value: 7, label: "يوليو (07)" },
  { value: 8, label: "أغسطس (08)" },
  { value: 9, label: "سبتمبر (09)" },
  { value: 10, label: "أكتوبر (10)" },
  { value: 11, label: "نوفمبر (11)" },
  { value: 12, label: "ديسمبر (12)" }
];

const YEARS = [2025, 2026, 2027, 2028];

export function AttendancePanel({
  attendance,
  onDeleteAttendanceRecord,
  settings,
  currentUserRole,
  currentUserBranch,
  students = [],
  employees = [],
  holidays = []
}: AttendancePanelProps) {
  // Panel Modes: "archive" (existing raw list) or "monthly" (official monthly statements matrix)
  const [panelMode, setPanelMode] = useState<"archive" | "monthly">("archive");

  // State for raw archive view
  const [filterType, setFilterType] = useState<"all" | "student" | "employee">("all");
  const [searchDate, setSearchDate] = useState("");
  const [keywordQuery, setKeywordQuery] = useState("");

  // State for Monthly Statement generator
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [monthlyCategory, setMonthlyCategory] = useState<"student" | "employee">("student");
  const [monthlyClass, setMonthlyClass] = useState<string>("all");
  const [monthlyBranch, setMonthlyBranch] = useState<string>("all");

  const handleDeleteRecord = async (id: string, name: string) => {
    if (!id) return;
    if (!confirm(`هل أنت متأكد من حذف حركة الحضور هذه الخاصّة بـ (${name})؟ لا يمكن إعادة الملفات المحذوفة.`)) return;
    try {
      await onDeleteAttendanceRecord(id);
    } catch (e) {
      alert("تعذر حذف الملف السحابي.");
    }
  };

  const handlePrintAttendanceList = () => {
    const tableElement = document.getElementById("historic-attendance-print-table");
    if (!tableElement) return;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;

    w.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>سجل حضور وانصراف — مدرسة شمس النموذجية</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
            body { font-family: 'Cairo', Tahoma, sans-serif; text-align: center; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
            th, td { border: 1px solid #64748b; padding: 10px; text-align: center; }
            th { background-color: #f1f5f9; color: #0f172a; }
            h2 { color: #1e293b; margin-bottom: 5px; }
            .date-label { font-size: 12px; color: #64748b; margin-bottom: 15px; }
          </style>
        </head>
        <body>
          <h2>سجل الحضور والانصراف الموحد</h2>
          <div class="date-label">تلقائي من نظام شمس السحابي المتكامل</div>
          ${tableElement.outerHTML}
        </body>
      </html>
    `);
    w.document.close();
    w.print();
  };

  // Pre-filter records for receptionists by branch (Archive view)
  const filteredAttendanceByRole = currentUserRole === "receptionist" && currentUserBranch
    ? attendance.filter(a => a.branch === currentUserBranch)
    : attendance;

  // Perform search matching (Archive view)
  const filteredRecords = filteredAttendanceByRole.filter(rec => {
    const matchesType = filterType === "all" ? true : rec.type === filterType;
    const matchesDate = searchDate ? rec.date === searchDate : true;
    const matchesKeyword = keywordQuery.trim()
      ? rec.name.toLowerCase().includes(keywordQuery.toLowerCase()) ||
        rec.code.toLowerCase().includes(keywordQuery.toLowerCase()) ||
        (rec.meta && rec.meta.note && rec.meta.note.toLowerCase().includes(keywordQuery.toLowerCase()))
      : true;

    return matchesType && matchesDate && matchesKeyword;
  });

  // Export raw filtered records to CSV
  const handleExportRawCSV = () => {
    if (filteredRecords.length === 0) {
      alert("لا توجد سجلات حضور لتصديرها.");
      return;
    }

    try {
      const csvRows = [
        ["النوع", "الاسم الكامل", "كود الباركود", "تاريخ المعاملة", "موعد الحضور", "موعد الانصراف", "توضيحات التأخر / الملاحظات", "الفرع"]
      ];

      filteredRecords.forEach((a) => {
        csvRows.push([
          a.type === "student" ? "طالب" : "موظف",
          a.name,
          a.code,
          a.date,
          a.arrival || "غائب",
          a.departure || "—",
          a.meta?.note || "منتظم بالكامل",
          a.branch || "غير محدد"
        ]);
      });

      const csvContent = "\uFEFF" + csvRows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `shams_attendance_archive_${filterType}_${searchDate || "all"}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("تعذر تصدير أرشيف الحضور.");
    }
  };


  // ==========================================
  // MONTHLY STATEMENTS COMPILER (NEW FEATURE)
  // ==========================================

  // Extract classes dynamically
  const classesList = Array.from(new Set(students.map(s => s.class))).filter(Boolean).sort();

  // Extract branches dynamically
  const branchesList = Array.from(
    new Set([
      ...Object.keys(settings?.branchPasswords || {}),
      ...students.map((s) => s.branch).filter(Boolean),
      ...employees.map((e) => e.branch).filter(Boolean)
    ])
  );

  // Determine effective branch based on user role (Locked if receptionist)
  const effectiveMonthlyBranch = currentUserRole === "receptionist" && currentUserBranch
    ? currentUserBranch
    : monthlyBranch;

  // Filter list of target people to compile
  const monthlyPeople = monthlyCategory === "student"
    ? students.filter(s => {
        const matchesBranch = effectiveMonthlyBranch === "all" ? true : s.branch === effectiveMonthlyBranch;
        const matchesClass = monthlyClass === "all" ? true : s.class === monthlyClass;
        return matchesBranch && matchesClass;
      })
    : employees.filter(e => {
        const matchesBranch = effectiveMonthlyBranch === "all" ? true : e.branch === effectiveMonthlyBranch;
        return matchesBranch;
      });

  // Calculate days array for selected month/year
  const numDays = new Date(selectedYear, selectedMonth, 0).getDate();
  const daysArray = Array.from({ length: numDays }, (_, i) => i + 1);

  // Compile monthly matrix data
  const monthlyMatrix = monthlyPeople.map(person => {
    const daysData: Record<number, string> = {};
    const dayDetails: Record<number, { arrival: string; departure: string; note: string; late: number }> = {};
    let presentCount = 0;
    let absentCount = 0;
    let lateDaysCount = 0;
    let totalLateMinutes = 0;
    let holidayCount = 0;
    let weekendCount = 0;

    daysArray.forEach(d => {
      const dStr = String(d).padStart(2, "0");
      const mStr = String(selectedMonth).padStart(2, "0");
      const dateStr = `${selectedYear}-${mStr}-${dStr}`;

      const dateObj = new Date(dateStr);
      const dayOfWeek = dateObj.getDay(); // 0: Sun, 1: Mon, ...

      // 1. Check Weekend Day (Dynamic based on settings)
      const isWeekend = settings?.weekendDays?.includes(dayOfWeek);

      // 2. Check Holiday Range
      const isOnHoliday = holidays.some(h => {
        if (dateStr < h.start || dateStr > h.end) return false;
        if (h.type === "general") return true;
        if (h.type === "specific" && h.studentCode === person.code) return true;
        if (h.type === "class" && h.className === (person as any).class) return true;
        if (h.type === "group" && h.studentCodes?.includes(person.code)) return true;
        return false;
      });

      // 3. Find attendance record
      const record = attendance.find(a => a.code === person.code && a.date === dateStr);

      let status = "—";
      let arrival = "";
      let departure = "";
      let note = "";
      let late = 0;

      const todayStr = new Date().toISOString().split("T")[0];

      if (record) {
        arrival = record.arrival || "";
        departure = record.departure || "";
        note = record.meta?.note || "";
        late = record.meta?.late || 0;

        if (record.arrival) {
          if (late > 0) {
            status = "ت"; // Late
            lateDaysCount++;
            totalLateMinutes += late;
          } else {
            status = "ح"; // Present on-time
          }
          presentCount++;
        } else if (record.meta?.note === "غائب") {
          status = "غ"; // Marked absent
          absentCount++;
        } else {
          status = "ح";
          presentCount++;
        }
      } else {
        // No attendance record found
        if (isWeekend) {
          status = "ع"; // Weekend
          weekendCount++;
        } else if (isOnHoliday) {
          status = "إ"; // Scheduled Holiday
          holidayCount++;
        } else if (dateStr > todayStr) {
          status = "—"; // Future day
        } else {
          // Past school day with no record in DB = Absent
          status = "غ";
          absentCount++;
        }
      }

      daysData[d] = status;
      dayDetails[d] = { arrival, departure, note, late };
    });

    return {
      id: person.code,
      name: person.name,
      code: person.code,
      class: (person as any).class || "كادر إداري",
      branch: person.branch || "غير محدد",
      days: daysData,
      dayDetails,
      totals: {
        present: presentCount,
        absent: absentCount,
        lateDays: lateDaysCount,
        lateMinutes: totalLateMinutes,
        holiday: holidayCount,
        weekend: weekendCount
      }
    };
  });

  const getMonthNameArabic = (m: number) => {
    const match = ARABIC_MONTHS.find(item => item.value === m);
    return match ? match.label.split(" ")[0] : `${m}`;
  };

  const currentMonthLabelArabic = `${getMonthNameArabic(selectedMonth)} - ${selectedYear}`;

  // Export Matrix to Excel/CSV
  const handleExportMonthlyMatrixCSV = () => {
    if (monthlyMatrix.length === 0) {
      alert("لا توجد بيانات لتوليد كشف شهري.");
      return;
    }

    try {
      const csvRows = [
        [`كشف الحضور والغياب الشهري الرسمي - مدارس شمس الأهلية النموذجية`],
        [`الفترة الزمنية: ${currentMonthLabelArabic} | الفئة: ${monthlyCategory === "student" ? "الطلاب" : "الموظفين"} | الفرع: ${effectiveMonthlyBranch === "all" ? "جميع الفروع" : effectiveMonthlyBranch}`],
        [`تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')}`],
        [],
        ["الاسم الكامل", "كود الباركود", "الصف / الوظيفة", "الفرع", ...daysArray.map(d => `يوم ${d}`), "أيام الحضور", "أيام الغياب", "أيام التأخير", "مجموع دقائق التأخير"]
      ];

      monthlyMatrix.forEach((row) => {
        csvRows.push([
          row.name,
          row.code,
          row.class,
          row.branch,
          ...daysArray.map(d => row.days[d] || "—"),
          row.totals.present.toString(),
          row.totals.absent.toString(),
          row.totals.lateDays.toString(),
          row.totals.lateMinutes.toString()
        ]);
      });

      const csvContent = "\uFEFF" + csvRows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `كشف_شهري_رسمي_${monthlyCategory}_${selectedYear}_${selectedMonth}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("فشل تصدير كشف الحضور الشهري.");
    }
  };

  const handlePrintMonthlyReport = () => {
    if (monthlyMatrix.length === 0) {
      alert("لا توجد بيانات لطباعتها في الكشف المختار.");
      return;
    }

    const title = `كشف الحضور الشهري الرسمي - ${currentMonthLabelArabic}`;
    const categoryLabel = monthlyCategory === "student" ? "الطلاب" : "الموظفين";
    const classLabel = monthlyCategory === "student" && monthlyClass !== "all" ? `الصف: ${monthlyClass}` : "كافة الصفوف";
    const branchLabel = currentUserRole === "receptionist" && currentUserBranch
      ? `فرع: ${currentUserBranch}`
      : monthlyBranch === "all" ? "جميع الفروع" : `فرع: ${monthlyBranch}`;

    const headersHtml = `
      <tr>
        <th style="position: sticky; right:0; background: #f8fafc; z-index:2; text-align: right; min-width: 150px; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px;">الاسم الكامل</th>
        <th style="min-width: 50px; font-weight: bold; border: 1px solid #cbd5e1;">الكود</th>
        ${daysArray.map(d => `<th style="width: 22px; font-size: 9px; padding: 4px 2px; border: 1px solid #cbd5e1;">${d}</th>`).join("")}
        <th style="width: 35px; font-size: 9px; background: #f0fdf4; font-weight: bold; border: 1px solid #cbd5e1;">حضور</th>
        <th style="width: 35px; font-size: 9px; background: #fef2f2; font-weight: bold; border: 1px solid #cbd5e1;">غياب</th>
        <th style="width: 35px; font-size: 9px; background: #fffbeb; font-weight: bold; border: 1px solid #cbd5e1;">تأخر</th>
        <th style="width: 45px; font-size: 9px; background: #fff5f5; font-weight: bold; border: 1px solid #cbd5e1;">دقائق</th>
      </tr>
    `;

    const rowsHtml = monthlyMatrix.map((row, idx) => {
      const cellsHtml = daysArray.map(d => {
        const val = row.days[d] || "—";
        let color = "#334155";
        let bg = "transparent";
        let weight = "normal";
        if (val === "ح") { color = "#16a34a"; bg = "#f0fdf4"; weight = "bold"; }
        else if (val === "ت") { color = "#d97706"; bg = "#fffbeb"; weight = "bold"; }
        else if (val === "غ") { color = "#dc2626"; bg = "#fef2f2"; weight = "bold"; }
        else if (val === "إ") { color = "#0284c7"; bg = "#f0f9ff"; }
        else if (val === "ع") { color = "#64748b"; bg = "#f8fafc"; }

        return `<td style="font-size: 10px; padding: 4px 2px; text-align: center; background-color: ${bg}; color: ${color}; font-weight: ${weight}; border: 1px solid #e2e8f0;">${val}</td>`;
      }).join("");

      return `
        <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="position: sticky; right:0; background: inherit; font-weight: bold; text-align: right; padding: 6px 10px; font-size: 11px; border: 1px solid #e2e8f0; white-space: nowrap;">${row.name}</td>
          <td style="font-family: monospace; font-size: 10px; text-align: center; border: 1px solid #e2e8f0;">${row.code}</td>
          ${cellsHtml}
          <td style="text-align: center; font-weight: bold; color: #16a34a; background: #f0fdf4; border: 1px solid #e2e8f0; font-size: 10px;">${row.totals.present}</td>
          <td style="text-align: center; font-weight: bold; color: #dc2626; background: #fef2f2; border: 1px solid #e2e8f0; font-size: 10px;">${row.totals.absent}</td>
          <td style="text-align: center; font-weight: bold; color: #d97706; background: #fffbeb; border: 1px solid #e2e8f0; font-size: 10px;">${row.totals.lateDays}</td>
          <td style="text-align: center; font-family: monospace; color: #b45309; background: #fff5f5; border: 1px solid #e2e8f0; font-size: 10px;">${row.totals.lateMinutes}</td>
        </tr>
      `;
    }).join("");

    const w = window.open("", "_blank");
    if (!w) return;

    w.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
            @page {
              size: A4 landscape;
              margin: 8mm;
            }
            body {
              font-family: 'Cairo', sans-serif;
              color: #1e293b;
              background-color: #ffffff;
              padding: 10px;
              direction: rtl;
              margin: 0;
            }
            .header-table {
              width: 100%;
              margin-bottom: 20px;
              border-collapse: collapse;
            }
            .header-table td {
              border: none !important;
              padding: 0;
            }
            .school-title {
              font-size: 16px;
              font-weight: 800;
              color: #0f172a;
            }
            .report-title {
              font-size: 18px;
              font-weight: 800;
              text-align: center;
              color: #1e3a8a;
            }
            .meta-info {
              font-size: 11px;
              font-weight: bold;
              color: #475569;
              background: #f1f5f9;
              padding: 6px 12px;
              border-radius: 6px;
              margin-bottom: 12px;
              display: flex;
              justify-content: space-between;
            }
            .legend-bar {
              font-size: 10px;
              margin-bottom: 12px;
              display: flex;
              gap: 15px;
              font-weight: bold;
            }
            .legend-item {
              display: flex;
              align-items: center;
              gap: 4px;
            }
            .legend-box {
              width: 14px;
              height: 14px;
              border-radius: 3px;
              display: inline-block;
              text-align: center;
              line-height: 14px;
              font-size: 10px;
              color: #fff;
              font-weight: bold;
            }
            table.main-report {
              width: 100%;
              border-collapse: collapse;
              page-break-inside: auto;
            }
            table.main-report tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            table.main-report th {
              background-color: #f8fafc;
              color: #0f172a;
              font-weight: bold;
              border: 1px solid #cbd5e1;
              padding: 5px 3px;
              font-size: 10px;
            }
            .signatures-section {
              margin-top: 30px;
              width: 100%;
              border-collapse: collapse;
            }
            .signatures-section td {
              border: none !important;
              text-align: center;
              font-size: 11px;
              font-weight: bold;
              color: #475569;
              width: 33.33%;
              padding: 15px 0;
            }
            .signature-line {
              margin-top: 30px;
              border-top: 1px dashed #cbd5e1;
              width: 60%;
              margin-left: auto;
              margin-right: auto;
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td style="text-align: right; width: 33%;">
                <div class="school-title">مجموعة مدارس شمس الأهلية</div>
                <div style="font-size: 10px; color: #64748b; font-weight: bold;">نظام شمس السحابي المتكامل للحضور والغياب</div>
              </td>
              <td style="text-align: center; width: 34%;">
                <div class="report-title">كشف الحضور والغياب الشهري الرسمي</div>
              </td>
              <td style="text-align: left; width: 33%; font-size: 10px; font-weight: bold; color: #64748b;">
                <div>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
                <div>المستند رقم: SHAMS-ATT-${selectedYear}-${selectedMonth}</div>
              </td>
            </tr>
          </table>

          <div class="meta-info">
            <span>الفترة الزمنية: ${currentMonthLabelArabic}</span>
            <span>الفئة المستهدفة: ${categoryLabel}</span>
            <span>الفرع المدرسـي: ${branchLabel}</span>
            <span>تصفية الصفوف: ${classLabel}</span>
            <span>إجمالي المقيدين بالكشف: ${monthlyMatrix.length}</span>
          </div>

          <div class="legend-bar">
            <span>رموز وحالات الكشف:</span>
            <div class="legend-item"><span class="legend-box" style="background-color: #16a34a;">ح</span> حاضر</div>
            <div class="legend-item"><span class="legend-box" style="background-color: #d97706;">ت</span> متأخر</div>
            <div class="legend-item"><span class="legend-box" style="background-color: #dc2626;">غ</span> غائب</div>
            <div class="legend-item"><span class="legend-box" style="background-color: #0284c7;">إ</span> إجازة رسمية</div>
            <div class="legend-item"><span class="legend-box" style="background-color: #64748b;">ع</span> عطلة أسبوعية</div>
          </div>

          <table class="main-report">
            <thead>
              ${headersHtml}
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <table class="signatures-section">
            <tr>
              <td>
                توقيع رئيس القسم / المشرف العام
                <div class="signature-line"></div>
              </td>
              <td>
                توقيع مدير المدرسة والفرع
                <div class="signature-line"></div>
              </td>
              <td>
                ختم الإدارة المدرسية الرسمي
                <div class="signature-line" style="margin-top: 35px; width: 30px; height: 30px; border: 2px dashed #cbd5e1; border-radius: 50%;"></div>
              </td>
            </tr>
          </table>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    w.document.close();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-6 space-y-6 text-right" dir="rtl">
      
      {/* Upper Segmented Tab Switcher */}
      <div className="flex bg-slate-100 p-1 rounded-2xl max-w-md ml-auto">
        <button
          onClick={() => setPanelMode("archive")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            panelMode === "archive"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          الأرشيف الموحد الشامل
        </button>
        <button
          onClick={() => setPanelMode("monthly")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            panelMode === "monthly"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <CalendarRange className="w-4 h-4" />
          الكشوفات الشهرية الرسمية
        </button>
      </div>

      {panelMode === "archive" ? (
        <>
          {/* ======================================= */}
          {/* ARCHIVE MODE: RAW LOGS VIEW (EXISTING)  */}
          {/* ======================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            <div className="flex items-center gap-3 lg:col-span-2">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">أرشيف سجل الحضور الموحد</h3>
                <p className="text-xs text-slate-400">تابع تحليلات الحضور ومعدلات الساعات والملاحظات لأي تاريخ</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={handleExportRawCSV}
                className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
                تصدير الأرشيف كـ CSV
              </button>
              <button
                onClick={handlePrintAttendanceList}
                className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                طباعة الكشف الحالي
              </button>
            </div>
          </div>

          {/* Advanced Filters Column */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-slate-100">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 block mb-1">مستوى فلترة الصفوف والأفراد</label>
              <select
                value={filterType}
                onChange={(e: any) => setFilterType(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs focus:outline-none"
              >
                <option value="all">الكل (طُلاب وموظفين)</option>
                <option value="student">الطلاب فقط</option>
                <option value="employee">الموظفين فقط</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 block mb-1">حصر التاريخ واليوم</label>
              <input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 block mb-1">ابحث باسم الشخص أو كود تتبع الباركود</label>
              <div className="relative">
                <input
                  type="text"
                  value={keywordQuery}
                  onChange={(e) => setKeywordQuery(e.target.value)}
                  placeholder="اكتب اسم أو كود..."
                  className="w-full pl-4 pr-11 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs focus:outline-none"
                />
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Synchronized results list */}
          <div className="overflow-x-auto">
            <table
              id="historic-attendance-print-table"
              className="w-full text-sm text-right border-collapse"
            >
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 select-none">
                  <th className="pb-3 text-xs font-bold">الجهة</th>
                  <th className="pb-3 text-xs font-bold">اسم الفرد الكامل</th>
                  <th className="pb-3 text-xs font-bold">كود الباركود</th>
                  <th className="pb-3 text-xs font-bold">تاريخ المعاملة</th>
                  <th className="pb-3 text-xs font-bold">موعد تسجيل الحضور</th>
                  <th className="pb-3 text-xs font-bold">موعد تسجيل الانصراف</th>
                  <th className="pb-3 text-xs font-bold">توضيحات التأخر</th>
                  <th className="pb-3 text-xs font-bold text-center printing-hide">أدوات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400 text-xs">
                      لا توجد أي سجلات حضور سحابية متزامنة تطابق المعايير المختارة.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((a, i) => (
                    <tr key={a.id || i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                            a.type === "student"
                              ? "bg-indigo-50 text-indigo-700 font-bold"
                              : "bg-emerald-50 text-emerald-700 font-bold"
                          }`}
                        >
                          {a.type === "student" ? "طالب" : "موظف"}
                        </span>
                      </td>
                      <td className="py-3.5 font-bold text-slate-800">{a.name}</td>
                      <td className="py-3.5 font-mono text-xs">{a.code}</td>
                      <td className="py-3.5 font-mono text-xs font-semibold text-slate-500">{a.date}</td>
                      <td className="py-3.5 font-mono font-bold text-sm text-emerald-600">
                        {a.arrival || "غائب/موقوف"}
                      </td>
                      <td className="py-3.5 font-mono text-sm text-slate-500">
                        {a.departure || (a.arrival ? "لم يتم تسجيل الطالب انصراف" : "—")}
                      </td>
                      <td className="py-3.5">
                        {a.meta?.note ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">
                            {a.meta.note}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">
                            منتظم بالكامل
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 text-center printing-hide">
                        {a.id && (
                          <button
                            onClick={() => handleDeleteRecord(a.id!, a.name)}
                            className="p-1 px-2 bg-rose-50 hover:bg-rose-100 rounded-lg text-rose-600 transition-all"
                            title="حذف هذا السجل الخاص فقط"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* ========================================== */}
          {/* MONTHLY STATEMENT COMPILER VIEW (NEW DEV)  */}
          {/* ========================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            <div className="flex items-center gap-3 lg:col-span-2">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CalendarRange className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">أداة استخراج الكشوفات الشهرية الرسمية</h3>
                <p className="text-xs text-slate-400">قم بتوليد وتصدير كشف حضور شبكي تفصيلي لأي شهر لطباعته وتقديمه للإدارة</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={handleExportMonthlyMatrixCSV}
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <FileSpreadsheet className="w-4 h-4" />
                تصدير الكشف كـ Excel / CSV
              </button>
              <button
                onClick={handlePrintMonthlyReport}
                className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <Printer className="w-4 h-4" />
                طباعة الكشف الرسمي
              </button>
            </div>
          </div>

          {/* Compilation controls configuration panel */}
          <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
              <Filter className="w-4 h-4 text-slate-500" />
              <h4 className="text-xs font-extrabold text-slate-700">خيارات توليد الكشف الشهري والمطابقة السحابية</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              
              {/* Month Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 block mb-1">الشهر الدراسي المستهدف</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-850 focus:outline-none"
                >
                  {ARABIC_MONTHS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Year Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 block mb-1">السنة الميلادية</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-850 focus:outline-none"
                >
                  {YEARS.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Category Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 block mb-1">الفئة المستهدفة</label>
                <select
                  value={monthlyCategory}
                  onChange={(e: any) => {
                    setMonthlyCategory(e.target.value);
                    setMonthlyClass("all");
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-850 focus:outline-none"
                >
                  <option value="student">الطلاب المقيدين</option>
                  <option value="employee">الموظفين والكادر</option>
                </select>
              </div>

              {/* Class Filter (only for students) */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 block mb-1">تصفية الصفوف الدراسية</label>
                <select
                  value={monthlyClass}
                  onChange={(e) => setMonthlyClass(e.target.value)}
                  disabled={monthlyCategory !== "student"}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-850 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="all">كافة الفصول والصفوف</option>
                  {classesList.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>

              {/* Branch Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 block mb-1">الفرع المدرسـي</label>
                {currentUserRole === "receptionist" && currentUserBranch ? (
                  <div className="w-full px-3 py-2 bg-slate-150 border border-slate-200 rounded-xl text-xs font-black text-slate-600 select-none">
                    {currentUserBranch} (مؤمن)
                  </div>
                ) : (
                  <select
                    value={monthlyBranch}
                    onChange={(e) => setMonthlyBranch(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-850 focus:outline-none"
                  >
                    <option value="all">جميع الفروع المتاحة</option>
                    {branchesList.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                )}
              </div>

            </div>
          </div>

          {/* Grid Indicators Legend */}
          <div className="flex flex-wrap items-center gap-4 bg-indigo-50/50 border border-indigo-100/50 p-3.5 rounded-xl text-xs">
            <span className="font-extrabold text-indigo-950 flex items-center gap-1">
              <AlertCircle className="w-4 h-4 text-indigo-600" />
              رموز حالات الكشف الشبكي:
            </span>
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <span className="w-5 h-5 rounded bg-emerald-50 text-emerald-600 font-black inline-flex items-center justify-center border border-emerald-200 text-[10px]">ح</span>
              حاضر (في الوقت)
            </span>
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <span className="w-5 h-5 rounded bg-amber-50 text-amber-600 font-black inline-flex items-center justify-center border border-amber-200 text-[10px]">ت</span>
              متأخر صباحياً
            </span>
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <span className="w-5 h-5 rounded bg-rose-50 text-rose-600 font-black inline-flex items-center justify-center border border-rose-200 text-[10px]">غ</span>
              غائب
            </span>
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <span className="w-5 h-5 rounded bg-sky-50 text-sky-600 font-black inline-flex items-center justify-center border border-sky-200 text-[10px]">إ</span>
              إجازة مبرمجة
            </span>
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <span className="w-5 h-5 rounded bg-slate-100 text-slate-500 font-black inline-flex items-center justify-center border border-slate-200 text-[10px]">ع</span>
              عطلة أسبوعية
            </span>
          </div>

          {/* Large Matrix Render */}
          <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white shadow-inner">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-right border-collapse select-none">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-150 text-[10px] font-extrabold">
                    {/* Sticky Name on RTL right */}
                    <th className="p-3 sticky right-0 bg-slate-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-width-[180px] text-right font-black">الاسم الكامل للفرد</th>
                    <th className="p-3 text-center border-l border-slate-200 font-mono">الكود</th>
                    {daysArray.map(d => (
                      <th key={d} className="p-1.5 text-center border-l border-slate-100 min-w-[28px] font-mono">{d}</th>
                    ))}
                    {/* Totals columns */}
                    <th className="p-3 text-center border-l border-slate-200 bg-emerald-50/50 text-emerald-800 min-w-[50px]">حضور</th>
                    <th className="p-3 text-center border-l border-slate-100 bg-rose-50/50 text-rose-800 min-w-[50px]">غياب</th>
                    <th className="p-3 text-center border-l border-slate-100 bg-amber-50/50 text-amber-800 min-w-[50px]">تأخر</th>
                    <th className="p-3 text-center border-l border-slate-100 bg-red-50/50 text-red-800 min-w-[65px]">دقائق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  {monthlyMatrix.length === 0 ? (
                    <tr>
                      <td colSpan={daysArray.length + 6} className="text-center py-16 text-slate-400 font-semibold">
                        لا يوجد طلاب أو موظفين يطابقون هذه الفئات والمعايير في الفرع لتوليد الكشف.
                      </td>
                    </tr>
                  ) : (
                    monthlyMatrix.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                        
                        {/* Sticky Name column to support horizontal scrolling */}
                        <td className="p-3 font-bold text-slate-850 sticky right-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap text-right">
                          <div className="flex flex-col">
                            <span className="text-slate-900 font-black">{row.name}</span>
                            <span className="text-[9px] text-slate-400 font-semibold mt-0.5">{row.class} • {row.branch}</span>
                          </div>
                        </td>

                        <td className="p-3 text-center font-mono text-[10px] text-slate-500 border-l border-slate-150">{row.code}</td>

                        {/* Days matrices */}
                        {daysArray.map(d => {
                          const val = row.days[d] || "—";
                          let badgeClass = "text-slate-400";
                          if (val === "ح") badgeClass = "bg-emerald-50 text-emerald-700 border border-emerald-100 font-black";
                          if (val === "ت") badgeClass = "bg-amber-50 text-amber-700 border border-amber-100 font-black";
                          if (val === "غ") badgeClass = "bg-rose-50 text-rose-700 border border-rose-100 font-black";
                          if (val === "إ") badgeClass = "bg-sky-50 text-sky-600 border border-sky-100 font-bold";
                          if (val === "ع") badgeClass = "bg-slate-50 text-slate-400 border border-slate-100 font-medium";

                          // Display tooltip containing arrival details on hover
                          const details = row.dayDetails[d];
                          const tooltipTitle = details && details.arrival 
                            ? `الحضور: ${details.arrival}\nالانصراف: ${details.departure || '—'}\nالملاحظة: ${details.note || '—'}`
                            : val === "غ" ? "غائب تماماً" : val === "ع" ? "عطلة نهاية أسبوع" : val === "إ" ? "إجازة معتمدة" : "";

                          return (
                            <td key={d} className="p-1 text-center border-l border-slate-100" title={tooltipTitle}>
                              <span className={`w-6 h-6 rounded flex items-center justify-center mx-auto text-[10px] leading-none ${badgeClass}`}>
                                {val}
                              </span>
                            </td>
                          );
                        })}

                        {/* Totals displays */}
                        <td className="p-3 text-center border-l border-slate-200 bg-emerald-50/40 text-emerald-700 font-black text-sm">{row.totals.present}</td>
                        <td className="p-3 text-center border-l border-slate-100 bg-rose-50/40 text-rose-700 font-black text-sm">{row.totals.absent}</td>
                        <td className="p-3 text-center border-l border-slate-100 bg-amber-50/40 text-amber-700 font-bold text-sm">{row.totals.lateDays}</td>
                        <td className="p-3 text-center border-l border-slate-100 bg-red-50/40 text-red-700 font-mono text-[11px] font-bold">{row.totals.lateMinutes} د</td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <style>{`
        @media print {
          .printing-hide {
            display: none !important;
          }
        }
        
        /* Thin beautiful scrollbar */
        .scrollbar-thin::-webkit-scrollbar {
          height: 6px;
          width: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 8px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 8px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}
