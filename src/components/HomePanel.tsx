import React, { useState, useEffect, useRef } from "react";
import { QrCode, Search, FileSpreadsheet, Send, HelpCircle, Users, CheckCircle2, CalendarDays, TrendingUp, BarChart3, PieChart as PieIcon, AlertTriangle, ArrowUpRight, ArrowDownRight, GraduationCap, Sparkles, Clock, ShieldAlert } from "lucide-react";
import { Student, Employee, Attendance, Holiday, AcademicYear, Settings } from "../types";
import { motion, AnimatePresence } from "motion/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

interface HomePanelProps {
  students: Student[];
  employees: Employee[];
  attendance: Attendance[];
  holidays: Holiday[];
  years: AcademicYear[];
  settings: Settings | null;
  onRecordStudent: (code: string) => void;
  onRecordEmployee: (code: string) => void;
  currentUserRole?: string;
  currentUserBranch?: string;
}

export function HomePanel({
  students,
  employees,
  attendance,
  holidays,
  years,
  settings,
  onRecordStudent,
  onRecordEmployee,
  currentUserRole,
  currentUserBranch
}: HomePanelProps) {
  const [scanCode, setScanCode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [daySearchDate, setDaySearchDate] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" | "warning" } | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"scanner" | "analytics">("scanner");
  const audioContextRef = useRef<AudioContext | null>(null);

  // Restrict receptionists to their own branch
  const filteredAttendanceByRole = currentUserRole === "receptionist" && currentUserBranch
    ? attendance.filter(a => {
        if (a.branch) {
          return a.branch === currentUserBranch;
        }
        // Fallbacks
        const matchesStudent = students.find(s => s.code === a.code);
        if (matchesStudent) return matchesStudent.branch === currentUserBranch;
        const matchesEmployee = employees.find(e => e.code === a.code);
        if (matchesEmployee) return matchesEmployee.branch === currentUserBranch;
        return false;
      })
    : attendance;

  const filteredStudentsByRole = currentUserRole === "receptionist" && currentUserBranch
    ? students.filter(s => s.branch === currentUserBranch)
    : students;

  const filteredEmployeesByRole = currentUserRole === "receptionist" && currentUserBranch
    ? employees.filter(e => e.branch === currentUserBranch)
    : employees;

  const filteredHolidaysByRole = currentUserRole === "receptionist" && currentUserBranch
    ? holidays.filter(h => {
        if (h.type === "general") return true;
        if (h.type === "specific" && h.studentCode) {
          const s = students.find(x => x.code === h.studentCode);
          return s && s.branch === currentUserBranch;
        }
        return false;
      })
    : holidays;

  // Play synthesized retro check-in beep
  const playBeep = (type: "success" | "warning" | "error") => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "success") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === "warning") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(330, ctx.currentTime);
        osc.frequency.setValueAtTime(220, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.type = "square";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      console.warn("Audio Context beep initialization failed", e);
    }
  };

  // Timed dismiss for scanner notifications
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(t);
  }, [feedback]);

  // Handle manual Enter submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanCode.trim()) return;
    const clean = scanCode.trim();

    const s = filteredStudentsByRole.find(x => x.code === clean);
    const em = filteredEmployeesByRole.find(x => x.code === clean);
    const todayStr = new Date().toISOString().split("T")[0];

    if (s) {
      if (s.suspended) {
        playBeep("warning");
        setFeedback({ text: `🚫 الطالب موقوف: ${s.name} (${s.suspendReason || "لا يوجد سبب مذكور"})`, type: "warning" });
      } else {
        // Enforce settings config time limits
        const dayStart = settings?.studentDayStart || "07:30";
        const deadline = settings?.attendanceDeadline || "09:00";
        const now = new Date();
        const currMin = now.getHours() * 60 + now.getMinutes();

        const [startH, startM] = dayStart.split(":").map(Number);
        const startMin = startH * 60 + startM;

        const [deadH, deadM] = deadline.split(":").map(Number);
        const deadMin = deadH * 60 + deadM;

        if (currMin < startMin) {
          playBeep("warning");
          setFeedback({
            text: `🚫 الطلب مرفوض: وقت تسجيل حضور الطلاب لم يبدأ بعد بتمام الساعة ${dayStart}`,
            type: "warning"
          });
          return;
        }

        if (currMin > deadMin) {
          playBeep("warning");
          setFeedback({
            text: `🚫 الدخول مرفوض: انتهى الوقت المخصص لتسجيل حضور الطلاب اليوم (موعد الغياب: ${deadline})`,
            type: "warning"
          });
          return;
        }

        // Prevent duplicate attendance
        const alreadyCheckedIn = attendance.find(a => a.code === clean && a.date === todayStr && a.arrival);
        if (alreadyCheckedIn) {
          playBeep("warning");
          setFeedback({
            text: `⚠️ تنبيه: الطالب (${s.name}) مسجل حضور مسبقاً اليوم بتمام الساعة ${alreadyCheckedIn.arrival}`,
            type: "warning"
          });
        } else {
          playBeep("success");
          setFeedback({ text: `✅ تم حضور الطالب ${s.name}`, type: "success" });
          onRecordStudent(clean);
        }
      }
    } else if (em) {
      // Enforce settings config time limits
      const existing = attendance.find(a => a.code === clean && a.date === todayStr);
      const empStart = settings?.employeeDayStart || "07:30";
      const empEnd = settings?.employeeDayEnd || "15:00";
      const now = new Date();
      const currMin = now.getHours() * 60 + now.getMinutes();

      const [startH, startM] = empStart.split(":").map(Number);
      const startMin = startH * 60 + startM;

      const [endH, endM] = empEnd.split(":").map(Number);
      const endMin = endH * 60 + endM;

      if (!existing) { // Arrival checkin
        if (currMin < startMin) {
          playBeep("warning");
          setFeedback({
            text: `🚫 الطلب مرفوض: وقت تسجيل حضور الموظفين لم يبدأ بعد بتمام الساعة ${empStart}`,
            type: "warning"
          });
          return;
        }
        if (currMin > endMin) {
          playBeep("warning");
          setFeedback({
            text: `🚫 الدخول مرفوض: انتهى دوام الموظفين اليوم ولا يمكن حضور جديد بعد نهاية الدوام (${empEnd})`,
            type: "warning"
          });
          return;
        }
      }

      playBeep("success");
      setFeedback({ text: `✅ تم حضور/انصراف الموظف ${em.name}`, type: "success" });
      onRecordEmployee(clean);
    } else {
      playBeep("error");
      setFeedback({ text: `❌ الكود "${clean}" غير مسجل بقاعدة البيانات.`, type: "error" });
    }
    setScanCode("");
  };

  // Real-time calculations:
  const todayStr = new Date().toISOString().split("T")[0];

  const registeredTodayCount = filteredAttendanceByRole.filter(a => a.date === todayStr && a.arrival).length;
  
  // Calculate active holiday count
  const activeHolidays = filteredHolidaysByRole.filter(h => {
    return todayStr >= h.start && todayStr <= h.end;
  }).length;

  // Last 7 days & Month Stats count
  const last7DaysKeys = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split("T")[0];
  });
  const sevenDaysLogCount = filteredAttendanceByRole.filter(a => last7DaysKeys.includes(a.date)).length;
  const thisMonthPrefix = todayStr.substring(0, 7);
  const monthlyLogCount = filteredAttendanceByRole.filter(a => a.date.startsWith(thisMonthPrefix)).length;

  // Active general academy year matching
  const activeYear = years.find(y => y.active);
  const activeYearLabel = activeYear ? `${activeYear.start} الى ${activeYear.end}` : "لا يوجد عام نشط";

  // Filtered list of registered attendance for today
  const todaysAttendance = filteredAttendanceByRole.filter(a => a.date === todayStr);

  // Home search results matching students or logs
  const getSearchResults = () => {
    if (!searchQuery.trim()) return null;
    const cleanQuery = searchQuery.trim().toLowerCase();

    const matchedStudents = filteredStudentsByRole.filter(s =>
      s.name.toLowerCase().includes(cleanQuery) ||
      s.code.toLowerCase().includes(cleanQuery) ||
      s.id.toLowerCase().includes(cleanQuery)
    );

    const matchedRecords = filteredAttendanceByRole.filter(a =>
      a.name.toLowerCase().includes(cleanQuery) ||
      a.code.toLowerCase().includes(cleanQuery) ||
      a.date.includes(cleanQuery)
    );

    return { matchedStudents, matchedRecords };
  };

  const searchResults = getSearchResults();

  // Filtered by selected arbitrary date:
  const selectedDateAttendance = daySearchDate
    ? filteredAttendanceByRole.filter(a => a.date === daySearchDate)
    : [];

  // 1. Calculate weekly trend
  const weeklyTrendData = last7DaysKeys.map(dateKey => {
    const studentPresentCount = filteredAttendanceByRole.filter(a => a.date === dateKey && a.arrival && a.type === "student").length;
    const empPresentCount = filteredAttendanceByRole.filter(a => a.date === dateKey && a.arrival && a.type === "employee").length;
    const totalCount = filteredStudentsByRole.length || 1;
    const rate = Math.min(100, Math.round((studentPresentCount / totalCount) * 100));
    
    // Format date beautifully (e.g. Day)
    const dParts = dateKey.split("-");
    const d = dParts[2];
    const m = dParts[1];
    return {
      date: dateKey,
      dayLabel: d ? `${m}/${d}` : dateKey,
      "حضور الطلاب": studentPresentCount,
      "حضور الموظفين": empPresentCount,
      "نسبة الحضور (%)": rate
    };
  }).reverse(); // chronological order

  // 2. Today's status breakdown for PieChart
  const studentsPresentCount = filteredAttendanceByRole.filter(a => a.date === todayStr && a.arrival && a.type === "student" && (!a.meta?.late || a.meta.late === 0)).length;
  const studentsLateCount = filteredAttendanceByRole.filter(a => a.date === todayStr && a.arrival && a.type === "student" && a.meta?.late && a.meta.late > 0).length;
  const studentsAbsentCount = Math.max(0, filteredStudentsByRole.length - (studentsPresentCount + studentsLateCount));

  const todayDistributionData = [
    { name: "حضور مبكر", value: studentsPresentCount, color: "#10b981" }, // Emerald-500
    { name: "متأخر", value: studentsLateCount, color: "#f59e0b" },      // Amber-500
    { name: "غائب", value: studentsAbsentCount, color: "#ef4444" }       // Red-500
  ].filter(item => item.value > 0);

  // 3. Classes Performance Ranking (Bar Chart)
  const distinctClasses = Array.from(new Set(filteredStudentsByRole.map(s => s.class))).filter(Boolean);
  const classPerformanceData = distinctClasses.map(cls => {
    const total = filteredStudentsByRole.filter(s => s.class === cls).length;
    const present = filteredAttendanceByRole.filter(a => 
      a.date === todayStr && 
      a.arrival && 
      a.type === "student" && 
      filteredStudentsByRole.some(s => s.code === a.code && s.class === cls)
    ).length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return {
      name: cls,
      "نسبة الانضباط (%)": rate,
      "حاضر": present,
      "إجمالي الطلاب": total
    };
  }).sort((a, b) => b["نسبة الانضباط (%)"] - a["نسبة الانضباط (%)"]).slice(0, 6);

  // 4. AI-Powered Smart Anomaly Alerts & Insights
  const getSmartInsights = () => {
    const insights: { type: "info" | "warning" | "success"; text: string; title: string }[] = [];

    // 1. Worst performing class
    if (classPerformanceData.length > 0) {
      const worst = [...classPerformanceData].sort((a, b) => a["نسبة الانضباط (%)"] - b["نسبة الانضباط (%)"])[0];
      if (worst && worst["نسبة الانضباط (%)"] < 70) {
        insights.push({
          type: "warning",
          title: "تنبيه غياب مرتفع",
          text: `يسجل الصف (${worst.name}) أدنى نسبة انضباط اليوم بلغت ${worst["نسبة الانضباط (%)"]}% فقط. نوصي بالتواصل مع أولياء أمور الغائبين.`
        });
      } else if (worst) {
        insights.push({
          type: "info",
          title: "الصف الأكثر تحدياً",
          text: `الصف (${worst.name}) يسجل نسبة انضباط اليوم بلغت ${worst["نسبة الانضباط (%)"]}%.`
        });
      }
    }

    // 2. High lateness alert
    const totalLatesToday = filteredAttendanceByRole.filter(a => a.date === todayStr && a.arrival && a.type === "student" && a.meta?.late && a.meta.late > 0).length;
    if (totalLatesToday > 3) {
      insights.push({
        type: "warning",
        title: "رصد تأخر جماعي",
        text: `تم رصد ${totalLatesToday} حالات تأخير صباحي اليوم. يوصى بمراجعة توقيت فتح البوابة وتوجيه إشعار توعية لأولياء الأمور.`
      });
    }

    // 3. Branches comparison
    const femaleBranchStudents = filteredStudentsByRole.filter(s => s.branch === "فرع الطالبة");
    const maleBranchStudents = filteredStudentsByRole.filter(s => s.branch !== "فرع الطالبة");
    if (femaleBranchStudents.length > 0 && maleBranchStudents.length > 0) {
      const femalePresent = filteredAttendanceByRole.filter(a => a.date === todayStr && a.arrival && a.type === "student" && femaleBranchStudents.some(s => s.code === a.code)).length;
      const malePresent = filteredAttendanceByRole.filter(a => a.date === todayStr && a.arrival && a.type === "student" && maleBranchStudents.some(s => s.code === a.code)).length;
      
      const femaleRate = Math.round((femalePresent / femaleBranchStudents.length) * 100);
      const maleRate = Math.round((malePresent / maleBranchStudents.length) * 100);

      if (Math.abs(femaleRate - maleRate) > 5) {
        insights.push({
          type: "info",
          title: "مقارنة أداء الفروع",
          text: femaleRate > maleRate 
            ? `فرع الطالبات يسجل حضوراً أعلى اليوم بنسبة ${femaleRate}% مقارنة بفرع الذكور ${maleRate}%.`
            : `فرع الذكور يسجل حضوراً أعلى اليوم بنسبة ${maleRate}% مقارنة بفرع الطالبات ${femaleRate}%.`
        });
      }
    }

    // 4. Perfect attendance class
    const perfectClass = classPerformanceData.find(c => c["نسبة الانضباط (%)"] === 100);
    if (perfectClass) {
      insights.push({
        type: "success",
        title: "لوحة الشرف اليومية",
        text: `🎉 هنيئاً لـ (${perfectClass.name})! انضباط تام بنسبة 100% وحضور كامل لكافة طلاب الصف اليوم.`
      });
    }

    // Fallback if empty
    if (insights.length === 0) {
      insights.push({
        type: "success",
        title: "مؤشرات انضباط ممتازة",
        text: "تسير مؤشرات الحضور والالتزام لليوم ضمن النطاقات الممتازة والآمنة بكافة الصفوف والفروع."
      });
    }

    return insights;
  };

  const smartInsights = getSmartInsights();

  return (
    <div className="space-y-6">
      {/* Upper Terminal Scan row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-md p-6 space-y-4">
          {/* Modern Tab Switcher */}
          <div className="flex border-b border-slate-100 pb-3 items-center justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveSubTab("scanner")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === "scanner"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <QrCode className="w-4 h-4" />
                جهاز الحضور السريع
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab("analytics")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === "analytics"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                التحليلات والمخططات الذكية
              </button>
            </div>
            <div className="hidden sm:block text-[10px] text-slate-400 font-bold select-none">
              نظام إدارة الانضباط شمس
            </div>
          </div>

          <AnimatePresence mode="wait">
            {activeSubTab === "scanner" ? (
              <motion.div
                key="scanner"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-50 rounded-xl text-amber-500">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">جهاز تسجيل الحضور السريع</h3>
                    <p className="text-xs text-slate-400">وجه الماسح الضوئي لرمز الباركود أو اكتب الكود يدوياً</p>
                  </div>
                </div>

                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">اكتب الكود يدوياً أو وجه جهاز الباركورد</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          autoFocus
                          value={scanCode}
                          onChange={(e) => setScanCode(e.target.value)}
                          placeholder="أدخل رقم الكود يدوياً أو بواسطة القارئ..."
                          className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all text-center tracking-widest text-lg font-bold"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs select-none">
                          [SCAN]
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="px-6 py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        تسجيل الحضور
                      </button>
                    </div>
                  </div>
                </form>

                {/* Scanner Notifications */}
                <AnimatePresence mode="popLayout">
                  {feedback && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm transition-all ${
                        feedback.type === "success"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : feedback.type === "warning"
                          ? "bg-amber-50 text-amber-700 border border-amber-100"
                          : "bg-rose-50 text-rose-700 border border-rose-100"
                      }`}
                    >
                      <span>{feedback.text}</span>
                      <span className="text-xs opacity-60">الآن</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 text-right"
                dir="rtl"
              >
                {/* Smart Analytics Dashboard content */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Chart 1: Last 7 Days Area chart */}
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-4 h-4 text-indigo-650" />
                      <h4 className="text-xs font-bold text-slate-700">معدل حضور الطلاب آخر 7 أيام</h4>
                    </div>
                    <div className="h-[180px] w-full text-xs">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={weeklyTrendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="dayLabel" stroke="#94a3b8" />
                          <YAxis domain={[0, 100]} stroke="#94a3b8" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", color: "#fff", border: "none" }}
                            labelStyle={{ fontWeight: "bold" }}
                          />
                          <Area type="monotone" dataKey="نسبة الحضور (%)" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorRate)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 2: Top Classes Performance Bar Chart */}
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <GraduationCap className="w-4 h-4 text-emerald-650" />
                      <h4 className="text-xs font-bold text-slate-700">ترتيب الفصول الملتزمة اليوم</h4>
                    </div>
                    {classPerformanceData.length === 0 ? (
                      <div className="h-[180px] flex items-center justify-center text-xs text-slate-400">لا توجد صفوف كافية لعرض الترتيب</div>
                    ) : (
                      <div className="h-[180px] w-full text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={classPerformanceData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" stroke="#94a3b8" />
                            <YAxis domain={[0, 100]} stroke="#94a3b8" />
                            <Tooltip 
                              contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", color: "#fff", border: "none" }}
                            />
                            <Bar dataKey="نسبة الانضباط (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub row with Pie Distribution and Smart Insight Board */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Today Distribution Pie Chart */}
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 space-y-2 flex flex-col justify-between">
                    <div className="flex items-center gap-2">
                      <PieIcon className="w-4 h-4 text-amber-500" />
                      <h4 className="text-xs font-bold text-slate-700">توزيع الحضور اليوم</h4>
                    </div>
                    {todayDistributionData.length === 0 ? (
                      <div className="h-[100px] flex items-center justify-center text-[10px] text-slate-400">لا توجد بيانات اليوم</div>
                    ) : (
                      <div className="flex items-center gap-2 h-[100px]">
                        <div className="w-[80px] h-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={todayDistributionData}
                                innerRadius={18}
                                outerRadius={32}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {todayDistributionData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex-1 space-y-1 text-[9px]">
                          {todayDistributionData.map((d, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span className="flex items-center gap-1 font-bold text-slate-600">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                                {d.name}
                              </span>
                              <span className="font-mono font-bold text-slate-800">{d.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AI & Smart Insights Board */}
                  <div className="md:col-span-2 bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-md space-y-2 relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 left-0 p-1 bg-indigo-500/10 rounded-br-2xl text-[7px] font-mono text-indigo-400 tracking-wider">
                      ANALYTICS ENGINE
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                      <h4 className="text-xs font-bold text-slate-200">لوحة التنبيهات الإدارية الذكية</h4>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[90px] space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                      {smartInsights.map((insight, idx) => (
                        <div 
                          key={idx} 
                          className={`p-2 rounded-xl border flex items-start gap-1.5 text-[10px] leading-relaxed transition-all ${
                            insight.type === "warning"
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
                              : insight.type === "success"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                              : "bg-blue-500/10 border-blue-500/20 text-blue-300"
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                          <div className="flex-1 text-right">
                            <span className="font-bold block mb-0.5">{insight.title}</span>
                            <span className="font-medium opacity-90">{insight.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live synchronized stats Widget */}
        <div className="bg-slate-950 text-white rounded-2xl shadow-xl p-6 relative overflow-hidden flex flex-col justify-between">
          {/* Accent decoration */}
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl" />
          
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <span className="text-xs font-bold tracking-wider text-slate-400">إحصائيات سريعة متزامنة</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                سحابي مباشر
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <span className="text-xs text-slate-400 block mb-1">الطلاب المسجلين</span>
                <span className="text-2xl font-black text-amber-400">{filteredStudentsByRole.length}</span>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <span className="text-xs text-slate-400 block mb-1">الموظفين</span>
                <span className="text-2xl font-black text-amber-400">{filteredEmployeesByRole.length}</span>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <span className="text-xs text-slate-400 block mb-1">حاضرون اليوم</span>
                <span className="text-2xl font-black text-emerald-400">{registeredTodayCount}</span>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <span className="text-xs text-slate-400 block mb-1">إجازات نشطة</span>
                <span className="text-2xl font-black text-rose-400">{activeHolidays}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-[10px] text-slate-400">
            <div>
              <span className="block font-bold text-white text-xs">{sevenDaysLogCount}</span>
              آخر 7 أيام
            </div>
            <div>
              <span className="block font-bold text-white text-xs">{monthlyLogCount}</span>
              هذا الشهر
            </div>
            <div>
              <span className="block font-bold text-white text-xs truncate overflow-hidden max-w-full" title={activeYearLabel}>
                {activeYear ? `${activeYear.start.split("-")[0]}` : "—"}
              </span>
              العام الدراسي
            </div>
          </div>
        </div>
      </div>

      {/* Advanced search controls */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick search input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500">بحث سريع وفوري (بالاسم، الكود، أو كود الفرع)</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابدأ بالكتابة للبحث التلقائي..."
                className="w-full pl-4 pr-11 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all text-sm"
              />
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            </div>
          </div>

          {/* Historical date filter */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500">عرض حضور يوم محدد</label>
            <input
              type="date"
              value={daySearchDate}
              onChange={(e) => setDaySearchDate(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all text-sm text-slate-700"
            />
          </div>
        </div>

        {/* Live Search Results */}
        {searchResults && (
          <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-4">
            <h4 className="text-xs font-bold text-slate-400 border-b border-slate-200/60 pb-2">نتائج البحث الفورية</h4>
            
            {searchResults.matchedStudents.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-indigo-600 block">الطلاب المطابقين ({searchResults.matchedStudents.length})</span>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 select-none">
                        <th className="pb-2">اسم الطالب</th>
                        <th className="pb-2">الصف</th>
                        <th className="pb-2">الكود</th>
                        <th className="pb-2">حالة القيد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {searchResults.matchedStudents.map(s => (
                        <tr key={s.code} className="hover:bg-slate-50">
                          <td className="py-2.5 font-semibold text-slate-800">{s.name}</td>
                          <td className="py-2.5">{s.class}</td>
                          <td className="py-2.5 font-mono">{s.code}</td>
                          <td className="py-2.5">
                            {s.suspended ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold">موقوف</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">نشط</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {searchResults.matchedRecords.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200/60">
                <span className="text-xs font-bold text-indigo-600 block">سجلات المطابقة ({searchResults.matchedRecords.length})</span>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400">
                        <th className="pb-2">الاسم</th>
                        <th className="pb-2">التاريخ</th>
                        <th className="pb-2">حضور</th>
                        <th className="pb-2">انصراف</th>
                        <th className="pb-2">الملاحظات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {searchResults.matchedRecords.slice(0, 10).map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 font-semibold text-slate-800">{r.name}</td>
                          <td className="py-2.5 font-mono">{r.date}</td>
                          <td className="py-2.5 font-mono text-emerald-600 font-semibold">{r.arrival || "—"}</td>
                          <td className="py-2.5 font-mono text-slate-500">{r.departure || (r.arrival ? "لم يتم تسجيل الطالب انصراف" : "—")}</td>
                          <td className="py-2.5 text-slate-400">{r.meta?.note || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {searchResults.matchedStudents.length === 0 && searchResults.matchedRecords.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-400 font-medium">
                لا توجد نتائج مطابقة لبحثك.
              </div>
            )}
          </div>
        )}

        {/* Selected date log list */}
        {daySearchDate && (
          <div className="p-4 bg-amber-50/20 border border-amber-100/50 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-amber-800 select-none">سجل حضور الحصاد ليوم: <span className="font-mono font-bold text-slate-900 bg-amber-100 px-2 py-0.5 rounded">{daySearchDate}</span></h4>
            {selectedDateAttendance.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">لا توجد أي بيانات مسجلة لهذا اليوم المختار.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="border-b border-amber-200/50 text-slate-500 select-none">
                      <th className="pb-2">النوع</th>
                      <th className="pb-2">الاسم الكامِل</th>
                      <th className="pb-2">الكود</th>
                      <th className="pb-2">وقت الحضور</th>
                      <th className="pb-2">وقت الانصراف</th>
                      <th className="pb-2">ملاحظة تأخير</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100/40 text-slate-700">
                    {selectedDateAttendance.map((a, i) => (
                      <tr key={i} className="hover:bg-amber-100/10">
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${a.type === "student" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {a.type === "student" ? "طالب" : "موظف"}
                          </span>
                        </td>
                        <td className="py-2 font-semibold text-slate-800">{a.name}</td>
                        <td className="py-2 font-mono">{a.code}</td>
                        <td className="py-2 font-mono text-emerald-600 font-semibold">{a.arrival || "غائب/موقوف"}</td>
                        <td className="py-2 font-mono">{a.departure || (a.arrival ? "لم يتم تسجيل الطالب انصراف" : "—")}</td>
                        <td className="py-2 text-slate-500">{a.meta?.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Primary Log of Today (Moved to end per requirements) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-sm font-bold text-slate-800">حركة حُضور اليوم ({todayStr})</h3>
          </div>
          <span className="text-xs text-slate-400 select-none">تحديث سحابي مباشر متزامن</span>
        </div>

        {todaysAttendance.length === 0 ? (
          <div className="text-center py-10 bg-slate-50/50 rounded-xl">
            <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-medium">لم يتلقَّ النظام أي إشعار حضور بعد لليوم.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 select-none">
                  <th className="pb-3 text-xs font-bold font-mono">الجهة</th>
                  <th className="pb-3 text-xs font-bold">الاسم</th>
                  <th className="pb-3 text-xs font-bold">الفرع</th>
                  <th className="pb-3 text-xs font-bold">الكود</th>
                  <th className="pb-3 text-xs font-bold">الحضور</th>
                  <th className="pb-3 text-xs font-bold">الانصراف</th>
                  <th className="pb-3 text-xs font-bold">حالة الالتزام</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {todaysAttendance.map((a, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${a.type === "student" ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"}`}>
                        {a.type === "student" ? "طالب" : "موظف"}
                      </span>
                    </td>
                    <td className="py-3 font-semibold text-slate-800">{a.name}</td>
                    <td className="py-3 text-xs font-semibold">
                      {a.branch === "فرع الطالبة" ? (
                        <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded bg-rose-50 text-[9px] text-rose-700 border border-rose-100/60 shadow-sm leading-none">
                          🌸 فرع الطالبة
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded bg-blue-50 text-[9px] text-blue-700 border border-blue-100/60 shadow-sm leading-none">
                          🏛️ فرع أول فيصل
                        </span>
                      )}
                    </td>
                    <td className="py-3 font-mono text-slate-500 text-xs">{a.code}</td>
                    <td className="py-3 font-mono text-emerald-600 font-bold text-sm">
                      {a.arrival || "—"}
                    </td>
                    <td className="py-3 font-mono text-slate-500 text-sm">
                      {a.departure || (a.arrival ? "لم يتم تسجيل الطالب انصراف" : "—")}
                    </td>
                    <td className="py-3">
                      {a.meta?.note ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600">
                          {a.meta.note}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600">
                          منتظم
                        </span>
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
