import React from "react";
import { LogOut, UserCheck, UserX, Clock, CalendarDays, ClipboardCheck, ArrowLeftRight, MessageCircle } from "lucide-react";
import { Attendance } from "../types";
import { AppSession } from "../App";

interface StudentPortalProps {
  session: AppSession;
  attendance: Attendance[];
  onLogout: () => void;
  timeStr: string;
  dateStr: string;
  schoolName?: string;
  branchPhone?: string;
}

export function StudentPortal({
  session,
  attendance,
  onLogout,
  timeStr,
  dateStr,
  schoolName,
  branchPhone
}: StudentPortalProps) {
  // Filter attendance matching this student code
  const myLogs = attendance
    .filter(a => a.code === session.code && a.type === "student")
    .sort((a, b) => b.date.localeCompare(a.date));

  // Metrics
  const totalDays = myLogs.filter(log => log.arrival).length; // only count days they were actually present
  const absentDays = myLogs.filter(log => !log.arrival).length; // count absent days
  const totalLate = myLogs.reduce((acc, curr) => acc + (curr.meta?.late || 0), 0);
  const todaysLog = myLogs.find(a => a.date === new Date().toISOString().split("T")[0]);
  const isAbsentToday = todaysLog ? !todaysLog.arrival : false;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-12" dir="rtl">
      {/* Portal Header */}
      <header className="bg-slate-950 text-white py-4 shadow-lg border-b border-slate-900">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-550 rounded-xl text-slate-950 font-black flex items-center justify-center text-lg shadow-inner">
              {schoolName ? schoolName.charAt(0) : "ش"}
            </div>
            <div>
              <h1 className="text-sm font-black text-amber-400">بوابة الطالب الإلكترونية</h1>
              <span className="text-[10px] text-slate-400 block font-semibold">
                {schoolName || "مدارس شمس الأهلية"} — نظام متابعة الانضباط
              </span>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-rose-950/70 text-slate-350 hover:text-rose-450 rounded-xl text-xs font-bold transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            خروج من حساب الطالب
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 w-full mt-6 space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-tr from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/15 rounded-full blur-xl" />
          <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-500/15 rounded-full blur-xl" />

          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2">
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 font-bold border border-amber-500/25 rounded-md text-[10px]">
                {session.branch || "فرع أول فيصل"}
              </span>
              <h2 className="text-xl font-black">أهلاً بك، {session.name} 👋</h2>
              <p className="text-xs text-slate-300">
                مرحباً بك في لوحة متابعة حضورك الشخصية. رقم قيدك المركزي هو <span className="font-mono text-amber-400 font-bold">{session.id}</span>
              </p>
            </div>

            <div className="text-left bg-white/5 border border-white/10 p-3 rounded-2xl select-none leading-none min-w-[140px] text-right md:text-left self-stretch md:self-auto flex flex-col justify-center">
              <span className="text-[11px] text-slate-400 font-semibold block">{dateStr}</span>
              <span className="text-sm font-bold text-amber-400 mt-1 block tracking-wider">{timeStr}</span>
            </div>
          </div>
        </div>

        {/* Dashboard Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Card 1: Today state */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${todaysLog ? (isAbsentToday ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600') : 'bg-rose-50 text-rose-500'}`}>
              {todaysLog && !isAbsentToday ? <UserCheck className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">حالة اليوم</span>
              <h3 className="text-xs font-black text-slate-800 mt-0.5">
                {todaysLog ? (
                  !isAbsentToday ? (
                    <span className="text-emerald-600 font-extrabold font-mono">حضر (بتمام {todaysLog.arrival})</span>
                  ) : (
                    <span className="text-rose-650 font-extrabold">غائب (غياب مسجل)</span>
                  )
                ) : (
                  <span className="text-rose-500 font-bold">لم يسجل وصول بعد</span>
                )}
              </h3>
            </div>
          </div>

          {/* Card 2: Total presence */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-5 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">أيام الحضور الفعلي</span>
              <h3 className="text-md font-bold text-slate-800 mt-0.5 font-mono">
                {totalDays} <span className="text-xs text-slate-400 font-sans">أيام حضور</span>
              </h3>
            </div>
          </div>

          {/* Card 3: Total Absence */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-5 flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-650 rounded-xl">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">أيام الغياب المسجلة</span>
              <h3 className="text-md font-bold text-slate-805 mt-0.5 font-mono text-rose-600">
                {absentDays} <span className="text-xs text-slate-400 font-sans">أيام غياب</span>
              </h3>
            </div>
          </div>

          {/* Card 4: Delayed minutes */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-5 flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">إجمالي دقائق التأخير</span>
              <h3 className={`text-md font-bold mt-0.5 font-mono ${totalLate > 0 ? "text-amber-650" : "text-emerald-600"}`}>
                {totalLate} <span className="text-xs text-slate-400 font-sans">دقائق</span>
              </h3>
            </div>
          </div>
        </div>

        {/* WhatsApp Branch Contact Widget */}
        {branchPhone && (
          <div className="bg-emerald-50 border border-emerald-100/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-fade-in">
            <div className="flex items-center gap-3 text-right">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-inner">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-emerald-950">تواصل سريع مع إدارة الفرع عبر الواتساب</h4>
                <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">هل تود إرسال استفسار أو إجازة عاجلة؟ تواصل مع مشرف فرعك ({session.branch || "فرع أول فيصل"}) مباشرة</p>
              </div>
            </div>
            <a
              href={`https://wa.me/${branchPhone.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all shadow hover:shadow-md shrink-0 duration-150"
            >
              <MessageCircle className="w-4 h-4" />
              مراسلة الفرع مباشرة
            </a>
          </div>
        )}

        {/* Detailed History logs of standard attendance */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-6 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
            <CalendarDays className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">سجل حركة حضورك وانصرافك المفصل</h3>
              <p className="text-[10px] text-slate-400">كافة بيانات الدخول والخروج المسجلة باسمك</p>
            </div>
          </div>

          {myLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              لم يقم النظام برصد أي بيانات حضور لك في العام الدراسي النشط بعد.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold select-none">
                    <th className="pb-3 text-xs">اليوم والتاريخ</th>
                    <th className="pb-3 text-xs">وقت الحضور</th>
                    <th className="pb-3 text-xs">وقت الانصراف</th>
                    <th className="pb-3 text-xs">مذكرة التوقيت</th>
                    <th className="pb-3 text-xs text-center">أيقونة الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {myLogs.map((log, index) => {
                    const isAbsent = !log.arrival;
                    return (
                      <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 font-semibold text-slate-800 font-mono">{log.date}</td>
                        <td className={`py-3 font-bold font-mono ${isAbsent ? 'text-rose-500' : 'text-emerald-600'}`}>
                          {log.arrival || "غائب"}
                        </td>
                        <td className="py-3 font-medium text-slate-500 font-mono">
                          {log.departure || (log.arrival ? "لم يسجل انصراف" : "—")}
                        </td>
                        <td className="py-3 text-slate-500 text-xs">
                          {isAbsent ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600">
                              {log.meta?.note || "غياب مسجل"}
                            </span>
                          ) : log.meta?.note ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600">
                              {log.meta.note}
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600">
                              منتظم بالوقت
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          <span className={`inline-flex py-1 px-1 rounded-lg ${isAbsent ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {isAbsent ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <footer className="text-center text-[10px] text-slate-400 mt-12 py-3 border-t border-slate-200/50">
        شمس DBMS — بوابة الطالب الإلكترونية الآمنة
      </footer>
    </div>
  );
}
