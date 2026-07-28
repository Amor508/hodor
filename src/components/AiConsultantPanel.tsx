import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Send, HelpCircle, RefreshCcw, Brain, MessageSquare, TrendingUp, AlertTriangle, ShieldCheck, Download } from "lucide-react";
import { Student, Employee, Attendance, Holiday, AcademicYear, Settings } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface AiConsultantPanelProps {
  students: Student[];
  employees: Employee[];
  attendance: Attendance[];
  holidays: Holiday[];
  years: AcademicYear[];
  settings: Settings | null;
}

interface ChatMessage {
  role: "user" | "model";
  text: string;
  timestamp: string;
}

export function AiConsultantPanel({
  students,
  employees,
  attendance,
  holidays,
  years,
  settings,
}: AiConsultantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Generate real stats context to send to Gemini
  const generateStatsPayload = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todaysAttendance = attendance.filter((a) => a.date === todayStr);

    const totalStudents = students.length;
    const activeStudents = students.filter((s) => !s.suspended).length;
    const suspendedStudents = students.filter((s) => s.suspended).length;
    const totalEmployees = employees.length;

    const todayPresentStudents = todaysAttendance.filter((a) => a.type === "student" && a.arrival).length;
    const todayLateStudents = todaysAttendance.filter(
      (a) => a.type === "student" && a.meta && typeof a.meta.late === "number" && a.meta.late > 0
    ).length;

    // Class breakdown stats
    const classMap: { [key: string]: { total: number; present: number } } = {};
    const presentTodayCodes = todaysAttendance
      .filter((a) => a.type === "student" && a.arrival)
      .map((a) => a.code);

    students.forEach((s) => {
      if (s.suspended) return;
      if (!classMap[s.class]) {
        classMap[s.class] = { total: 0, present: 0 };
      }
      classMap[s.class].total++;
      if (presentTodayCodes.includes(s.code)) {
        classMap[s.class].present++;
      }
    });

    const classAnalytics = Object.keys(classMap).map((cls) => {
      const info = classMap[cls];
      const ratio = info.total > 0 ? Math.round((info.present / info.total) * 100) : 0;
      return { className: cls, ...info, ratio };
    });

    // Lateness details
    const topLateStudents = students
      .map((s) => {
        const studentLogs = attendance.filter((a) => a.code === s.code && a.type === "student");
        const totalLates = studentLogs.filter((a) => a.meta && typeof a.meta.late === "number" && a.meta.late > 0).length;
        const totalMinutesLate = studentLogs.reduce((sum, a) => sum + (a.meta?.late || 0), 0);
        return { name: s.name, class: s.class, totalLates, totalMinutesLate };
      })
      .filter((s) => s.totalLates > 0)
      .sort((a, b) => b.totalLates - a.totalLates)
      .slice(0, 5);

    // Active holidays
    const activeHolidays = holidays.filter((h) => todayStr >= h.start && todayStr <= h.end).length;

    return {
      date: todayStr,
      schoolName: settings?.schoolName || "مدارس شمس الأهلية",
      timings: {
        studentDayStart: settings?.studentDayStart || "07:30",
        studentDayEnd: settings?.studentDayEnd || "14:00",
        attendanceDeadline: settings?.attendanceDeadline || "09:00",
        employeeDayStart: settings?.employeeDayStart || "07:30",
        employeeDayEnd: settings?.employeeDayEnd || "15:00",
      },
      metrics: {
        totalStudents,
        activeStudents,
        suspendedStudents,
        totalEmployees,
        todayPresentStudents,
        todayLateStudents,
        activeHolidays,
      },
      classAnalytics,
      topLateStudents,
    };
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      role: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setLoading(true);
    setError("");

    try {
      const stats = generateStatsPayload();
      const history = messages.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const response = await fetch("/api/ai/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: textToSend,
          stats,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error("فشل الخادم في الرد على استشارتك. يرجى التحقق من اتصال الإنترنت أو مفتاح الـ API.");
      }

      const data = await response.json();
      const aiMsg: ChatMessage = {
        role: "model",
        text: data.response || "عذراً، لم أستطع صياغة رد مناسب الآن.",
        timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "حدث خطأ غير متوقع أثناء الاتصال بالذكاء الاصطناعي.");
    } finally {
      setLoading(false);
    }
  };

  // Predefined quick diagnostic tasks
  const quickTriggers = [
    {
      title: "تحليل حركة حضور اليوم وتوصيات فورية",
      prompt: "قم بعمل تحليل شامل لحضور وغياب وتأخر اليوم بناءً على الأرقام الحالية، وأعطني أهم التوصيات والقرارات التي يجب على إدارة المدرسة اتخاذها فوراً لتحسين الانضباط في الفروع.",
      icon: <TrendingUp className="w-4 h-4 text-emerald-500" />,
    },
    {
      title: "دراسة ظاهرة التأخر الصباحي والطلاب المكررين",
      prompt: "أريد تقريراً استشارياً حول أكثر الطلاب تأخراً عن الدوام الصباحي وتوصيات تربوية وإدارية مناسبة للمدرسة للتواصل مع أولياء أمورهم والحد من هذه الظاهرة بشكل ودي وحازم.",
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    },
    {
      title: "خطة استراتيجية لتحسين الانضباط المدرسي العام",
      prompt: "اقترح خطة عمل متكاملة وحوافز ذكية لطلاب مدارس شمس الأهلية لتشجيعهم على الحضور المبكر وتقليص نسب الغياب العام، بناءً على طبيعة الدوام والإجازات المسجلة بالنظام.",
      icon: <Brain className="w-4 h-4 text-indigo-500" />,
    },
    {
      title: "صياغة رسائل واتساب ذكية ومحفزة لأولياء الأمور",
      prompt: "صغ لي 3 نماذج من الرسائل الدورية الودية والمؤثرة باللغة العربية لإرسالها لأولياء الأمور عبر الواتساب: نموذج لتحفيز الحاضرين الملتزمين، ونموذج لتنبيه الغائبين بلطف، ونموذج لمعالجة مشكلة التأخير المتكرر.",
      icon: <MessageSquare className="w-4 h-4 text-blue-500" />,
    },
  ];

  // Helper to render AI response beautifully in Arabic with structured layout
  const formatAiResponse = (text: string) => {
    // Basic text parsing to clean formatting
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      const trimmed = line.trim();

      // Header 3 or 4
      if (trimmed.startsWith("###") || trimmed.startsWith("####")) {
        return (
          <h4 key={idx} className="text-sm font-extrabold text-indigo-600 mt-4 mb-2 border-r-2 border-indigo-500 pr-2">
            {trimmed.replace(/^###*\s*/, "")}
          </h4>
        );
      }

      // Bold titles or key points
      if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
        return (
          <h5 key={idx} className="text-xs font-black text-slate-800 mt-3 mb-1">
            {trimmed.replace(/\*\*/g, "")}
          </h5>
        );
      }

      // Standard list items
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        const itemContent = trimmed.replace(/^[-*]\s*/, "");
        // Highlight bold subparts inside lists
        const parts = itemContent.split("**");
        return (
          <div key={idx} className="flex items-start gap-2 mr-3 my-1 text-xs text-slate-600 leading-relaxed">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
            <span className="flex-1">
              {parts.map((part, pIdx) =>
                pIdx % 2 === 1 ? (
                  <strong key={pIdx} className="text-slate-800 font-bold">
                    {part}
                  </strong>
                ) : (
                  part
                )
              )}
            </span>
          </div>
        );
      }

      // Regular paragraphs
      if (trimmed) {
        const parts = trimmed.split("**");
        return (
          <p key={idx} className="text-xs text-slate-600 leading-relaxed mb-2.5">
            {parts.map((part, pIdx) =>
              pIdx % 2 === 1 ? (
                <strong key={pIdx} className="text-slate-900 font-bold">
                  {part}
                </strong>
              ) : (
                part
              )
            )}
          </p>
        );
      }

      return <div key={idx} className="h-2" />;
    });
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Banner */}
      <div className="bg-gradient-to-l from-indigo-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-6 relative overflow-hidden shadow-xl border border-indigo-500/20">
        <div className="absolute -left-20 -top-20 w-52 h-52 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-full text-[10px] font-black uppercase">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              مستشار الذكاء الاصطناعي شمس
            </div>
            <h2 className="text-xl md:text-2xl font-black">المستشار السحابي الذكي لتحليل الانضباط</h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              قم بتحليل بياناتك، احصل على توصيات تربوية مخصصة، صغ رسائل ذكية لأولياء الأمور، وقارن أداء فروع مدارس شمس فورياً بالذكاء الاصطناعي من Google Gemini.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center text-amber-400">
              <Brain className="w-8 h-8 animate-bounce" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Quick Diagnostic Actions Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
              <ShieldCheck className="w-4.5 h-4.5 text-indigo-500" />
              <h3 className="text-xs font-bold text-slate-800">تحليلات كبسة زر فودية</h3>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              اختر أحد التحليلات الفورية وسيقوم مستشار شمس بقراءة قاعدة بيانات المدرسة وتحليل السجلات حالياً لخدمتك:
            </p>

            <div className="space-y-2">
              {quickTriggers.map((trig, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(trig.prompt)}
                  disabled={loading}
                  className="w-full p-3 bg-slate-50/70 hover:bg-indigo-50 hover:border-indigo-200 border border-slate-100 rounded-xl transition-all text-right text-xs font-bold text-slate-700 flex items-start gap-2.5 disabled:opacity-50 disabled:pointer-events-none group"
                >
                  <div className="p-1.5 bg-white rounded-lg border border-slate-100 group-hover:bg-indigo-100 group-hover:border-indigo-200 shrink-0 mt-0.5">
                    {trig.icon}
                  </div>
                  <span className="flex-1 leading-snug group-hover:text-indigo-950">{trig.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Core Analytics Quick Fact Check */}
          <div className="bg-slate-950 text-white rounded-2xl p-5 shadow-lg border border-slate-800 space-y-3 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl" />
            <h4 className="text-xs font-black text-amber-400 flex items-center gap-1">
              <Brain className="w-3.5 h-3.5" />
              البيانات الممررة للمستشار
            </h4>
            <div className="text-[10px] text-slate-400 space-y-2 leading-relaxed">
              <p>يتم تزويد المستشار الذكي آلياً بسجل الحضور المباشر اليوم وتفاصيل المدرسة لتكون تحليلاته دقيقة ومطابقة للواقع:</p>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-850">
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <span className="block text-white font-mono font-bold text-sm">{students.length}</span>
                  الطلاب المسجلين
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <span className="block text-white font-mono font-bold text-sm">{employees.length}</span>
                  إجمالي الموظفين
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 col-span-2 text-center">
                  <span className="block text-emerald-400 font-mono font-bold text-sm">
                    {attendance.filter(a => a.date === new Date().toISOString().split("T")[0] && a.arrival).length}
                  </span>
                  حاضرون اليوم بالسجل
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Workspace Section */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-md p-6 flex flex-col h-[600px]">
          <div className="flex items-center justify-between border-b border-slate-50 pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <h3 className="text-sm font-black text-slate-800">محادثة استشارية تفاعلية</h3>
                <p className="text-[10px] text-slate-400">ناقش المستشار في أي موضوع تربوي أو إداري يخص المدرسة</p>
              </div>
            </div>

            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-[10px] font-bold text-rose-600 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
              >
                مسح المحادثة
              </button>
            )}
          </div>

          {/* Message Area */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 scrollbar-thin">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 select-none">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center animate-pulse">
                  <HelpCircle className="w-7 h-7" />
                </div>
                <div className="max-w-md">
                  <h4 className="text-xs font-extrabold text-slate-700">مرحباً بك في مستشار شمس الذكي</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    يمكنك كتابة أي سؤال في الصندوق أدناه، مثل: "كيف يمكنني حصر أكثر الفصول غياباً اليوم؟" أو "اكتب لي رسالة بالعامية المصرية لأولياء أمور الطلاب المتأخرين صباحاً."
                  </p>
                </div>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "mr-auto flex-row-reverse" : "ml-auto text-right"}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white select-none shadow-sm ${
                      msg.role === "user" ? "bg-indigo-600" : "bg-gradient-to-tr from-amber-500 to-amber-400"
                    }`}
                  >
                    {msg.role === "user" ? "أنا" : "شمس"}
                  </div>
                  <div className="space-y-1">
                    <div
                      className={`p-4 rounded-2xl text-xs shadow-sm leading-relaxed border ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white border-indigo-700 rounded-tr-none"
                          : "bg-slate-50 text-slate-800 border-slate-100 rounded-tl-none"
                      }`}
                    >
                      {msg.role === "user" ? <p className="whitespace-pre-wrap">{msg.text}</p> : formatAiResponse(msg.text)}
                    </div>
                    <span className="text-[9px] text-slate-400 block px-1 text-left">{msg.timestamp}</span>
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex gap-3 max-w-[80%] ml-auto text-right">
                <div className="w-8 h-8 rounded-full shrink-0 bg-amber-400 flex items-center justify-center text-xs font-bold text-white animate-spin">
                  <RefreshCcw className="w-4 h-4" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl rounded-tl-none shadow-sm space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 animate-pulse">
                      <span>جاري التفكير وحصد السجلات ومطابقتها...</span>
                    </div>
                    <div className="space-y-1">
                      <div className="h-2 w-3/4 bg-slate-200/80 rounded animate-pulse" />
                      <div className="h-2 w-5/6 bg-slate-200/80 rounded animate-pulse" />
                      <div className="h-2 w-1/2 bg-slate-200/80 rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3.5 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-100 flex items-center gap-2 max-w-lg mx-auto">
                <span className="flex-1">{error}</span>
                <button
                  onClick={() => handleSendMessage(messages[messages.length - 1]?.text || "أعد المحاولة")}
                  className="px-2.5 py-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
                >
                  إعادة المحاولة
                </button>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Form input messaging box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputMessage);
            }}
            className="pt-3 border-t border-slate-100 flex gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={loading}
              placeholder="اكتب استشارتك للمستشار شمس هنا..."
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white text-xs disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !inputMessage.trim()}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
            >
              <Send className="w-4 h-4 shrink-0" />
              أرسل
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
