import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Trash2,
  FileSpreadsheet,
  BarChart3,
  Mail,
  RefreshCcw,
  AlertCircle,
  Sparkles,
  UserX,
  Building2,
  Users,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Award,
  Calendar,
  AlertTriangle,
  FileText,
  Printer
} from "lucide-react";
import { Student, Employee, Attendance, Holiday, AcademicYear, Settings } from "../types";
import { motion, AnimatePresence } from "motion/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar
} from "recharts";

interface AdminPanelProps {
  students: Student[];
  employees: Employee[];
  attendance: Attendance[];
  holidays: Holiday[];
  years: AcademicYear[];
  settings: Settings | null;
  selectedBranch: string;
  setSelectedBranch: (branch: string) => void;
  onClearAllData: () => Promise<void>;
  onMarkAbsencesForToday: () => Promise<void>;
  onSendBulkAbsenceMessages: (absentStudents: Student[]) => Promise<void>;
}

export function AdminPanel({
  students,
  employees,
  attendance,
  holidays,
  years,
  settings,
  selectedBranch,
  setSelectedBranch,
  onClearAllData,
  onMarkAbsencesForToday,
  onSendBulkAbsenceMessages
}: AdminPanelProps) {
  const [absenteesReport, setAbsenteesReport] = useState<Student[] | null>(null);
  const [absentSearchLoading, setAbsentSearchLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const todayStr = new Date().toISOString().split("T")[0];

  // Derive unique branches from settings, students, and employees dynamically
  const branchesInSystem = Array.from(
    new Set([
      ...Object.keys(settings?.branchPasswords || {}),
      ...students.map((s) => s.branch).filter(Boolean),
      ...employees.map((e) => e.branch).filter(Boolean)
    ])
  );

  // Filter core datasets based on selected branch
  const filteredStudents = selectedBranch === "all"
    ? students
    : students.filter((s) => s.branch === selectedBranch);

  const filteredEmployees = selectedBranch === "all"
    ? employees
    : employees.filter((e) => e.branch === selectedBranch);

  const filteredAttendance = selectedBranch === "all"
    ? attendance
    : attendance.filter((a) => {
        if (a.branch) {
          return a.branch === selectedBranch;
        }
        // Fallback checks
        const matchesStudent = students.find((s) => s.code === a.code);
        if (matchesStudent) return matchesStudent.branch === selectedBranch;
        const matchesEmployee = employees.find((e) => e.code === a.code);
        if (matchesEmployee) return matchesEmployee.branch === selectedBranch;
        return false;
      });

  const filteredHolidays = selectedBranch === "all"
    ? holidays
    : holidays.filter((h) => {
        if (h.type === "general") return true;
        const matchesStudent = students.find((s) => s.code === h.studentCode);
        return matchesStudent && matchesStudent.branch === selectedBranch;
      });

  // Calculate high-fidelity metrics for the selected branch
  const totalStudentsCount = filteredStudents.length;
  const activeStudentsCount = filteredStudents.filter(s => !s.suspended).length;
  const suspendedStudentsCount = filteredStudents.filter(s => s.suspended).length;

  const totalEmployeesCount = filteredEmployees.length;

  const todaysBranchAttendance = filteredAttendance.filter((a) => a.date === todayStr);
  const todayPresentStudentsCount = todaysBranchAttendance.filter((a) => a.type === "student" && a.arrival).length;
  
  // Exclude suspended students and students on active holiday from the expected count
  const expectedTodayCount = filteredStudents.filter((s) => {
    if (s.suspended) return false;
    const onLeave = filteredHolidays.some((h) => {
      const inRange = todayStr >= h.start && todayStr <= h.end;
      if (!inRange) return false;
      if (h.type === "general") return true;
      return h.type === "specific" && h.studentCode === s.code;
    });
    return !onLeave;
  }).length;

  const todayAbsentStudentsCount = Math.max(0, expectedTodayCount - todayPresentStudentsCount);
  const studentAttendanceRate = expectedTodayCount > 0 
    ? Math.round((todayPresentStudentsCount / expectedTodayCount) * 100) 
    : 100;

  const todayLateStudentsCount = todaysBranchAttendance.filter(
    (a) => a.type === "student" && a.meta && typeof a.meta.late === "number" && a.meta.late > 0
  ).length;

  // Reactively auto-generate absentees report whenever selected branch or attendance files update
  useEffect(() => {
    setAbsentSearchLoading(true);
    const timer = setTimeout(() => {
      // 1. Get codes of checked-in individuals
      const checkedInCodes = todaysBranchAttendance
        .filter((a) => a.type === "student" && a.arrival)
        .map((a) => a.code);

      // 2. Filter students in this branch who did not check in
      const absents = filteredStudents.filter((s) => {
        if (s.suspended) return false;
        if (checkedInCodes.includes(s.code)) return false;

        // Check active leaves/holidays
        const onLeave = filteredHolidays.some((h) => {
          const inRange = todayStr >= h.start && todayStr <= h.end;
          if (!inRange) return false;
          if (h.type === "general") return true;
          return h.type === "specific" && h.studentCode === s.code; // Specific student
        });

        return !onLeave;
      });

      setAbsenteesReport(absents);
      setAbsentSearchLoading(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [selectedBranch, students, attendance, holidays]);

  // CSV Export scoped to filtered selection
  const handleExportCSV = () => {
    try {
      const csvRows = [
        ["النوع", "الاسم", "الكود", "الفرع", "التاريخ", "وقت الحضور", "وقت الانصراف", "دقائق التأخير", "الملاحظات"]
      ];

      filteredAttendance.forEach((a) => {
        csvRows.push([
          a.type === "student" ? "طالب" : "موظف",
          a.name,
          a.code,
          a.branch || "غير محدد",
          a.date,
          a.arrival || "غائب",
          a.departure || "—",
          a.meta?.late?.toString() || "0",
          a.meta?.note || ""
        ]);
      });

      const csvContent = "\uFEFF" + csvRows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `shams_attendance_${selectedBranch === "all" ? "all_branches" : selectedBranch}_${todayStr}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("تعذر تصدير الملف.");
    }
  };

  const handleMarkAbsences = async () => {
    const targetLabel = selectedBranch === "all" ? "جميع الفروع" : selectedBranch;
    if (!confirm(`هل أنت متأكد من رصد وتثبيت "غياب" لكافة الطلاب الذين لم يسجلوا حضوراً حتى هذه اللحظة بفرع (${targetLabel})؟`)) {
      return;
    }
    await onMarkAbsencesForToday();
    setSuccessMessage(`تم تثبيت كشف الغياب بنجاح بفرع (${targetLabel}) للمتأخرين اليوم.`);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const handleDispatchAbsenceAlerts = async () => {
    if (!absenteesReport || absenteesReport.length === 0) return;
    if (!confirm(`تحذير: هل أنت متأكد من إرسال إشعارات الغياب فورياً إلى هواتف أولياء الأمور للطلاب الغائبين وعددهم (${absenteesReport.length}) بالفرع؟`)) {
      return;
    }

    try {
      await onSendBulkAbsenceMessages(absenteesReport);
      setSuccessMessage("تم تشغيل مهام الإرسال المباشر لرسائل الغياب بنجاح.");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (e) {
      alert("فشل تنفيذ إرسال الإشعار.");
    }
  };

  const handlePrintAbsentees = () => {
    if (!absenteesReport || absenteesReport.length === 0) return;
    
    const targetBranchLabel = selectedBranch === "all" ? "جميع الفروع" : selectedBranch;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("الرجاء السماح بفتح النوافذ المنبثقة لطباعة التقرير.");
      return;
    }
    
    const todayDate = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const rowsHtml = absenteesReport.map((s, index) => {
      const parentPhoneStr = s.parentPhone || "—";
      const branchStr = s.branch || "—";
      return `
        <tr>
          <td style="text-align: center; font-weight: bold;">${index + 1}</td>
          <td style="font-weight: bold; color: #0f172a;">${s.name}</td>
          <td>${s.class}</td>
          <td>${branchStr}</td>
          <td style="font-family: monospace; letter-spacing: 0.5px; font-weight: 600;">${parentPhoneStr}</td>
        </tr>
      `;
    }).join("");

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>تقرير الغياب اليومي - فرع ${targetBranchLabel}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
            body {
              font-family: 'Cairo', sans-serif;
              margin: 40px;
              color: #1e293b;
              background-color: #ffffff;
              direction: rtl;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 3px double #cbd5e1;
              padding-bottom: 20px;
            }
            .title {
              font-size: 22px;
              font-weight: 800;
              color: #0f172a;
              margin: 0;
            }
            .subtitle {
              font-size: 13px;
              color: #64748b;
              margin-top: 5px;
              font-weight: 600;
            }
            .info-sec {
              display: flex;
              justify-content: space-between;
              margin-bottom: 20px;
              font-size: 12px;
              color: #475569;
              font-weight: 700;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th {
              background-color: #f8fafc;
              color: #0f172a;
              font-weight: 700;
              font-size: 13px;
              border: 1px solid #cbd5e1;
              padding: 12px 10px;
              text-align: right;
            }
            td {
              border: 1px solid #cbd5e1;
              padding: 10px;
              font-size: 12px;
              color: #334155;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .footer {
              margin-top: 40px;
              text-align: left;
              font-size: 10px;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
            }
            @media print {
              body { margin: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">تقرير غياب الطلاب اليومي تفصيلي</h1>
            <div class="subtitle">مجموعة مدارس شمس التعليمية</div>
          </div>
          
          <div class="info-sec">
            <span>الفرع الاستعلامي: ${targetBranchLabel}</span>
            <span>التاريخ: ${todayDate}</span>
            <span>إجمالي الغائبين: ${absenteesReport.length} طالب</span>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 5%">#</th>
                <th>الاسم الكامل</th>
                <th style="width: 25%">الصف الدراسي</th>
                <th style="width: 25%">الفرع</th>
                <th style="width: 25%">رقم التواصل (ولي الأمر)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          
          <div class="footer">
            تم طباعة هذا المستند تلقائياً من نظام شمس لإدارة جرد وحضور الفروع
          </div>
          
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleWipeDatabase = async () => {
    if (!confirm("تحذير قاطع وسري للغاية ومحمي:\nأنْتَ على وشك مسح جميع البيانات (الطلاب، الموظفين، سجلات الحضور، والأجازات) بالكامل من السيرفر.\nهل تود الاستمرار بالمسح؟")) {
      return;
    }
    const doubleCheck = prompt("أدخل كلمة تأكيد المسح للأمن السحابي (اكتب كلمة: 'مسح')");
    if (doubleCheck !== "مسح") {
      alert("تم إلغاء عملية التهيئة حرصاً على البيانات.");
      return;
    }

    try {
      await onClearAllData();
      setSuccessMessage("تم تصفية وتهيئة الخادم السحابي بالكامل بنجاح.");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (e) {
      alert("حدث خطأ أثناء تصفية قواعد البيانات.");
    }
  };

  // Compute classroom health metrics ratio
  const computeClassAnalytics = () => {
    const classMap: { [key: string]: { total: number; present: number } } = {};
    const presentTodayCodes = todaysBranchAttendance
      .filter((a) => a.type === "student" && a.arrival)
      .map((a) => a.code);

    filteredStudents.forEach((s) => {
      if (s.suspended) return;
      if (!classMap[s.class]) {
        classMap[s.class] = { total: 0, present: 0 };
      }
      classMap[s.class].total++;
      if (presentTodayCodes.includes(s.code)) {
        classMap[s.class].present++;
      }
    });

    return Object.keys(classMap)
      .map((cls) => {
        const info = classMap[cls];
        const ratio = info.total > 0 ? Math.round((info.present / info.total) * 100) : 0;
        return { className: cls, ...info, ratio };
      })
      .sort((a, b) => b.ratio - a.ratio);
  };

  const classAnalytics = computeClassAnalytics();

  // ADDITIONAL PREMIUM FEATURES:
  // 1. Top 5 Persistent Latecomers in the branch (Academic year totals)
  const topLateStudents = filteredStudents
    .map((s) => {
      const studentLogs = filteredAttendance.filter((a) => a.code === s.code && a.type === "student");
      const totalLates = studentLogs.filter((a) => a.meta && typeof a.meta.late === "number" && a.meta.late > 0).length;
      const totalMinutesLate = studentLogs.reduce((sum, a) => sum + (a.meta?.late || 0), 0);
      return { student: s, totalLates, totalMinutesLate };
    })
    .filter((s) => s.totalLates > 0)
    .sort((a, b) => b.totalLates - a.totalLates)
    .slice(0, 5);

  // 2. Staff Attendance/Lateness exceptions dashboard
  const staffExceptionsToday = filteredEmployees.map((emp) => {
    const log = todaysBranchAttendance.find((a) => a.code === emp.code && a.type === "employee");
    return {
      employee: emp,
      checkedIn: !!log,
      arrivalTime: log?.arrival || null,
      departureTime: log?.departure || null,
      lateMinutes: log?.meta?.late || 0
    };
  });

  const staffAbsentCount = staffExceptionsToday.filter(e => !e.checkedIn).length;
  const staffLateCount = staffExceptionsToday.filter(e => e.checkedIn && e.lateMinutes > 0).length;

  // Generate last 7 days metrics
  const getAttendanceTrendData = () => {
    const list = [];
    const today = new Date();
    // Translate date names to Arabic names
    const arabicDays = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dayName = arabicDays[d.getDay()];
      const dateKey = d.toISOString().split("T")[0];
      
      // Filter attendance records by date
      const dateLogs = attendance.filter((a) => a.date === dateKey);
      
      // Match branch filters
      let studentsPresent = 0;
      let employeesPresent = 0;
      
      dateLogs.forEach((a) => {
        // Resolve branch of the record
        let recordBranch = a.branch;
        if (!recordBranch) {
          const s = students.find((sub) => sub.code === a.code);
          if (s) recordBranch = s.branch;
          else {
            const emp = employees.find((e) => e.code === a.code);
            if (emp) recordBranch = emp.branch;
          }
        }
        
        const branchMatch = selectedBranch === "all" || recordBranch === selectedBranch;
        
        if (branchMatch && a.arrival) {
          if (a.type === "student") {
            studentsPresent++;
          } else {
            employeesPresent++;
          }
        }
      });
      
      list.push({
        dayName: `${dayName} (${d.getDate()}/${d.getMonth() + 1})`,
        "طلاب": studentsPresent,
        "موظفون": employeesPresent,
        "إجمالي الحضور": studentsPresent + employeesPresent
      });
    }
    return list;
  };

  const attendanceTrendData = getAttendanceTrendData();

  // Branch comparisons for active branch rates
  const getBranchComparison = () => {
    return branchesInSystem.map((bName) => {
      // let's compute current attendance rate for active students in this branch
      const brStudents = students.filter((s) => s.branch === bName);
      const brActiveStudents = brStudents.filter((s) => !s.suspended);
      const brPresentToday = attendance.filter(
        (a) => a.date === todayStr && a.type === "student" && a.arrival && (a.branch === bName || students.find(s => s.code === a.code)?.branch === bName)
      ).length;
      
      const activeCount = brActiveStudents.length;
      const rate = activeCount > 0 ? Math.round((brPresentToday / activeCount) * 100) : 100;
      return {
        name: bName || "غير محدد",
        "نشط": activeCount,
        "حاضر": brPresentToday,
        "نسبة الحضور %": rate
      };
    });
  };

  const branchComparisonData = getBranchComparison();

  return (
    <div className="space-y-6 font-sans antialiased text-slate-800">
      
      {/* Dynamic Success Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 p-4 bg-emerald-600 text-white rounded-2xl text-xs font-bold shadow-xl border border-emerald-500/30 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-bounce" />
            <span>{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Branch Controller Banner */}
      <div className="bg-slate-900 border border-slate-850 rounded-3xl p-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -right-24 -top-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-[11px] font-extrabold mb-1">
              <Building2 className="w-3 h-3" />
              لوحة التحكم الشاملة للفرقة
            </div>
            <h2 className="text-xl md:text-2xl font-black">إدارة وتدقيق الفروع المدرسية</h2>
            <p className="text-xs text-slate-400">تابع حركة الانضباط والحضور، ونسب الشفافية والمواظبة في الفروع الدراسية لمدارس شمس الأهلية</p>
          </div>

          {/* Core Branch Selector */}
          <div className="flex items-center gap-3 bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700/60 max-w-sm w-full md:w-auto self-start md:self-auto">
            <Building2 className="w-4 h-4 text-amber-400 shrink-0 select-none" />
            <div className="flex-1">
              <label className="block text-[9px] font-bold text-slate-400 mb-1 select-none">حدد فرع المدرسة للتصفية:</label>
              <select
                value={selectedBranch}
                onChange={(e) => {
                  setSelectedBranch(e.target.value);
                  setAbsenteesReport(null); // Reset absentees report so it matches the newly selected branch
                }}
                className="bg-transparent text-white font-bold text-xs focus:outline-none w-full border-none cursor-pointer pr-4"
              >
                <option value="all" className="bg-slate-900 text-slate-100 font-bold">جميع الفروع المتاحة</option>
                {branchesInSystem.map((bName) => (
                  <option key={bName} value={bName} className="bg-slate-900 text-slate-100 font-semibold">
                    {bName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Scope Performance Analytics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Students */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-400 text-[10px] font-extrabold block">إجمالي الطلاب بالفرع</span>
            <span className="text-2xl font-black block font-mono text-slate-900">{totalStudentsCount}</span>
            <div className="flex gap-2 text-[10px] text-slate-400 leading-none">
              <span className="text-emerald-600 font-medium">نشط: {activeStudentsCount}</span>
              <span>•</span>
              <span className="text-rose-600 font-medium">موقوف: {suspendedStudentsCount}</span>
            </div>
          </div>
          <div className="p-3 bg-slate-50 text-slate-500 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Presence */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-400 text-[10px] font-extrabold block">حاضرون اليوم</span>
            <span className="text-2xl font-black block font-mono text-emerald-600">{todayPresentStudentsCount}</span>
            <span className="text-[10px] text-slate-400 block leading-none">
              النسبة العامة: <strong className="text-emerald-600">{studentAttendanceRate}%</strong>
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Absentees */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-400 text-[10px] font-extrabold block">غياب اليوم بالفرع</span>
            <span className="text-2xl font-black block font-mono text-rose-600">{todayAbsentStudentsCount}</span>
            <span className="text-[10px] text-slate-400 block leading-none">
              المستهدف بالتحضير: <strong>{expectedTodayCount}</strong>
            </span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <UserX className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Daily Lates */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-400 text-[10px] font-extrabold block">حالات تأخير اليوم</span>
            <span className="text-2xl font-black block font-mono text-amber-500">{todayLateStudentsCount}</span>
            <span className="text-[10px] text-slate-400 block leading-none">
              تجاوزوا مواعيد الوصول
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Dynamic Recharts Performance & Trend Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart for the last 7 Days */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-50 pb-3">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">7 أيام المنقضية</span>
              <h4 className="text-sm font-black text-slate-800">مخطط حركة الحضور اليومية المتراكمة</h4>
              <p className="text-[10px] text-slate-400">توزيع منضبط لكل من الطلاب والموظفين المشتركين بالفرع المحدد</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-bold text-slate-600 select-none">
                <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full inline-block" />
                الطلاب
              </span>
              <span className="flex items-center gap-1.5 font-bold text-slate-600 select-none">
                <span className="w-2.5 h-2.5 bg-amber-400 rounded-full inline-block" />
                الموظفون
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceTrendData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorStaff" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="dayName" stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none", color: "#fff", direction: "rtl", textAlign: "right" }}
                  labelStyle={{ fontWeight: "bold", fontSize: "11px", color: "#fbbf24", marginBottom: "4px" }}
                  itemStyle={{ fontSize: "11px" }}
                />
                <Area type="monotone" dataKey="طلاب" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorStudents)" />
                <Area type="monotone" dataKey="موظفون" stroke="#fbbf24" strokeWidth={3} fillOpacity={1} fill="url(#colorStaff)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Branch rate comparison BarChart */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-50 pb-3 space-y-1">
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">مقارنة فروع المدرسة</span>
            <h4 className="text-sm font-black text-slate-800">نسب حضور الفروع اليومية</h4>
            <p className="text-[10px] text-slate-400">معدل الانضباط والحضور الفعلي اليوم لكل فرع متاح</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchComparisonData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none", color: "#fff", direction: "rtl", textAlign: "right" }}
                  labelStyle={{ fontWeight: "bold", fontSize: "11px", color: "#34d399", marginBottom: "4px" }}
                  itemStyle={{ fontSize: "11px" }}
                />
                <Bar dataKey="نسبة الحضور %" fill="#0ea5e9" radius={[8, 8, 0, 0]} barSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Core Functions and Absentees Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Operations Sidebar Tools */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 h-fit space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">إجراءات الحصاد والتصدير</h3>
              <p className="text-[10px] text-slate-400">مهام الجرد اليومية السريعة والتحكم بقاعدة الخادم</p>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            <button
              onClick={handleMarkAbsences}
              className="w-full py-3 bg-amber-500 text-white font-bold hover:bg-amber-600 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <AlertCircle className="w-4 h-4" />
              تثبيت غياب فوري للغائبين اليوم
            </button>

            <button
              onClick={handleExportCSV}
              className="w-full py-3 bg-slate-900 text-white font-bold hover:bg-slate-800 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              تصدير حركة حضور فرعك كـ CSV
            </button>

            <button
              onClick={handleWipeDatabase}
              className="w-full py-3 bg-rose-50 text-rose-700 border border-rose-100 font-semibold hover:bg-rose-100 rounded-xl text-xs transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              تصفية وتهيئة الخادم السحابي بالكامل
            </button>
          </div>
        </div>

        {/* Absentees generated Report layout - scoped list */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="space-y-0.5">
              <h4 className="text-xs font-black text-slate-800">تقارير حركة غياب الفصول المدرسية اليومية</h4>
              <p className="text-[10px] text-slate-400">فرع: <span className="font-bold text-slate-700">{selectedBranch === "all" ? "جميع الفروع" : selectedBranch}</span></p>
            </div>
            <span className="text-[9px] bg-slate-100 text-slate-600 font-extrabold px-2.5 py-0.5 rounded-full select-none font-mono">
              {todayStr}
            </span>
          </div>

          {absentSearchLoading && (
            <div className="text-center py-12 space-y-2">
              <RefreshCcw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
              <p className="text-xs text-slate-400 font-semibold">يقوم الخادم الآن بحصد ومطابقة السجلات بالطلاب والتقويمات الدراسية للفرع المختار...</p>
            </div>
          )}

          {absenteesReport && !absentSearchLoading && (
            <div className="space-y-4 animate-fade-in text-right">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-amber-50 border border-amber-100 text-amber-900 rounded-xl text-xs gap-3">
                <span className="font-semibold text-slate-700">عدد الطلاب الغائبين الفعليين بالفرع: <strong className="text-amber-800 text-lg font-black">{absenteesReport.length}</strong></span>
                {absenteesReport.length > 0 && (
                  <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                    <button
                      onClick={handlePrintAbsentees}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      طباعة كشف الغياب الحالي
                    </button>
                    <button
                      onClick={handleDispatchAbsenceAlerts}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      إرسال إنذار لواتساب أولياء الأمور
                    </button>
                  </div>
                )}
              </div>

              {absenteesReport.length === 0 ? (
                <div className="text-center py-8 text-emerald-600 text-xs font-black">
                  ✓ رائع! جميع طلاب هذا الفرع الحضور مسجلين بالكامل اليوم. التزام فريد 100%.
                </div>
              ) : (
                <div className="overflow-y-auto max-h-64 border border-slate-100 rounded-xl p-2 bg-slate-50/30">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 select-none">
                        <th className="pb-2 text-slate-500">اسم الطالب الغائب</th>
                        <th className="pb-2 text-slate-500">الصف</th>
                        <th className="pb-2 text-slate-500">الفرع</th>
                        <th className="pb-2 text-slate-500 font-mono">الكود</th>
                        <th className="pb-2 text-slate-500">جوال ولي الأمر</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {absenteesReport.map((s) => (
                        <tr key={s.code} className="hover:bg-slate-50">
                          <td className="py-2.5 font-bold text-slate-800">{s.name}</td>
                          <td className="py-2.5 text-indigo-700 font-bold">{s.class}</td>
                          <td className="py-2.5 text-slate-500 text-[11px]">{s.branch || "—"}</td>
                          <td className="py-2.5 font-mono text-slate-700 font-semibold">{s.code}</td>
                          <td className="py-2.5 font-mono text-slate-500">{s.parentPhone || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Classroom stats and Premium Insights Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Dynamic Classroom Attendance Analytics charts */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            <div>
              <h4 className="text-xs font-black text-slate-800">جدول ومؤشرات انضباط صفوف الفرقة</h4>
              <p className="text-[10px] text-slate-400">سجل الانضباط والمواظبة للحصاد اليومي لصفوف الفرع</p>
            </div>
          </div>

          {classAnalytics.length === 0 ? (
            <p className="text-center py-10 text-slate-400 text-xs font-medium">لا توجد صفوف دراسية لفرزها في الفرع المحدد.</p>
          ) : (
            <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
              {classAnalytics.map((item) => (
                <div key={item.className} className="bg-slate-50/60 p-3 rounded-xl border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-800">{item.className}</span>
                    <span className="font-bold text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded">
                      {item.present} حضور / {item.total} طالب
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="w-full bg-slate-200/80 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          item.ratio >= 85
                            ? "bg-emerald-500"
                            : item.ratio >= 60
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${item.ratio}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-extrabold">
                      <span>نسبة مواظبة الفصل اليوم:</span>
                      <span className="font-mono text-slate-700">{item.ratio}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Premium Insight 1: Students with Persistent Late Arrivals Warning */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock className="w-5 h-5 text-amber-500" />
            <div>
              <h4 className="text-xs font-black text-slate-800">أكثر الطلاب تأخراً في الفرع المختار</h4>
              <p className="text-[10px] text-slate-400">أرقام قياسية لأكثر الطلاب تأخراً عن الموعد هذا الفصل</p>
            </div>
          </div>

          {topLateStudents.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/40 rounded-xl">
              <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-medium">لم يتلقَّ النظام أي إشعار تأخير مسجل لطلاب الفرع هذا العام.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 select-none">
                    <th className="pb-2 font-bold text-slate-500">الطالب</th>
                    <th className="pb-2 font-bold text-slate-500">الصف</th>
                    <th className="pb-2 font-bold text-slate-500 text-center">مرات التأخير</th>
                    <th className="pb-2 font-bold text-slate-500 text-center">مجموع الدقائق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {topLateStudents.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 font-bold text-slate-800">
                        <span className="inline-block w-4 text-[10px] text-slate-400 font-mono">#{idx+1}</span>
                        {item.student.name}
                      </td>
                      <td className="py-2.5 text-slate-600">{item.student.class}</td>
                      <td className="py-2.5 text-center font-black font-mono text-rose-600 bg-rose-50/30 rounded">
                        {item.totalLates}
                      </td>
                      <td className="py-2.5 text-center font-mono text-amber-600 font-bold">
                        {item.totalMinutesLate} د
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Staff daily exceptions panel - Scoped */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-500" />
            <div>
              <h4 className="text-xs font-black text-slate-800">مراقبة انضباط موظفي ودفاع الاستقبال بالفرع</h4>
              <p className="text-[10px] text-slate-400 font-medium text-slate-400">تابع وقت وصول وانصراف موظفي الاستقبال والمعلمين للفرع المختار اليوم</p>
            </div>
          </div>
          <div className="flex gap-2 text-[10px] text-slate-500">
            <span className="bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-600">إجمالي الموظفين بالفرع: {totalEmployeesCount}</span>
            <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded font-bold">غائب اليوم: {staffAbsentCount}</span>
            <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded font-bold">متأخر اليوم: {staffLateCount}</span>
          </div>
        </div>

        {staffExceptionsToday.length === 0 ? (
          <p className="text-center py-10 text-slate-400 text-xs font-semibold">لا يوجد أي موظف أو استقبال مسجل لهذا الفرع.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-150 text-slate-400">
                  <th className="pb-2 text-slate-500">الموظف</th>
                  <th className="pb-2 text-slate-500">الدور/الرتبة</th>
                  <th className="pb-2 text-slate-500">الفرع المطلوب</th>
                  <th className="pb-2 text-slate-500 text-center">الحالة</th>
                  <th className="pb-2 text-slate-500 text-center">الوصول</th>
                  <th className="pb-2 text-slate-500 text-center">الانصراف</th>
                  <th className="pb-2 text-slate-500 text-center">التأخر الصباحي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {staffExceptionsToday.map((item) => (
                  <tr key={item.employee.code} className="hover:bg-slate-50/55">
                    <td className="py-2.5 font-bold text-slate-800">{item.employee.name}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${item.employee.role === 'receptionist' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-50 text-slate-600'}`}>
                        {item.employee.role === "receptionist" ? "موظف استقبال" : "معلم / كادر إداري"}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-500 text-[11px]">{item.employee.branch || "فرع أول فيصل"}</td>
                    <td className="py-2.5 text-center">
                      {item.checkedIn ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold">حاضر</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[9px] font-bold">غـائب</span>
                      )}
                    </td>
                    <td className="py-2.5 text-center font-mono font-bold">{item.arrivalTime || "—"}</td>
                    <td className="py-2.5 text-center font-mono text-slate-500">{item.departureTime || "—"}</td>
                    <td className="py-2.5 text-center">
                      {item.lateMinutes > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 font-mono font-bold">
                          {item.lateMinutes} دقيقة تأخير
                        </span>
                      ) : item.checkedIn ? (
                        <span className="text-emerald-600 font-bold">في الموعد</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
