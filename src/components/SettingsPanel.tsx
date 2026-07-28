import React, { useState } from "react";
import { Settings as LucideSettings, CalendarDays, Key, Bell, Shield, Download, Upload, Trash2, Plus, Check } from "lucide-react";
import { AcademicYear, Settings } from "../types";
import { writeBatch, doc, collection } from "firebase/firestore";
import { db } from "../firebase";

interface SettingsPanelProps {
  years: AcademicYear[];
  settings: Settings | null;
  onSaveSettings: (settings: Settings) => Promise<void>;
  onAddYear: (year: AcademicYear) => Promise<void>;
  onSetActiveYear: (id: string) => Promise<void>;
  onDeleteYear: (id: string) => Promise<void>;
  fullBackupTrigger: () => {
    students: any[];
    employees: any[];
    attendance: any[];
    holidays: any[];
    academicYears: any[];
    settings: any;
  };
  onBatchRestore: (payload: {
    students: any[];
    employees: any[];
    attendance: any[];
    holidays: any[];
    academicYears: any[];
    settings: any;
  }) => Promise<void>;
}

const WEEKDAYS = [
  { value: 0, label: "الأحد (Sun)" },
  { value: 1, label: "الاثنين (Mon)" },
  { value: 2, label: "الثلاثاء (Tue)" },
  { value: 3, label: "الأربعاء (Wed)" },
  { value: 4, label: "الخميس (Thu)" },
  { value: 5, label: "الجمعة (Fri)" },
  { value: 6, label: "السبت (Sat)" }
];

export function SettingsPanel({
  years,
  settings,
  onSaveSettings,
  onAddYear,
  onSetActiveYear,
  onDeleteYear,
  fullBackupTrigger,
  onBatchRestore
}: SettingsPanelProps) {
  // Years state
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");

  // Settings states
  const [parentMessage, setParentMessage] = useState(settings?.parentMessage || "نتمنى له يوماً موفقاً");
  const [sendWhatsapp, setSendWhatsapp] = useState<"enabled" | "disabled">(settings?.sendWhatsapp || "disabled");
  const [provider, setProvider] = useState<"ultramsg" | "twilio">(settings?.provider || "ultramsg");
  const [ultraInstance, setUltraInstance] = useState(settings?.ultraInstance || "");
  const [ultraToken, setUltraToken] = useState(settings?.ultraToken || "");
  const [twilioFrom, setTwilioFrom] = useState(settings?.twilioFrom || "");
  const [twilioEndpoint, setTwilioEndpoint] = useState(settings?.twilioEndpoint || "");

  const [studentDayStart, setStudentDayStart] = useState(settings?.studentDayStart || "07:30");
  const [studentDayEnd, setStudentDayEnd] = useState(settings?.studentDayEnd || "14:00");
  const [employeeDayStart, setEmployeeDayStart] = useState(settings?.employeeDayStart || "07:30");
  const [employeeDayEnd, setEmployeeDayEnd] = useState(settings?.employeeDayEnd || "15:00");
  const [attendanceDeadline, setAttendanceDeadline] = useState(settings?.attendanceDeadline || "09:00");
  const [weekendDays, setWeekendDays] = useState<number[]>(settings?.weekendDays || [4, 5]);
  const [adminPassword, setAdminPassword] = useState(settings?.adminPassword || "123456789");
  const [schoolName, setSchoolName] = useState(settings?.schoolName || "مدارس شمس الأهلية");
  const [branchPasswords, setBranchPasswords] = useState<Record<string, string>>(() => {
    return settings?.branchPasswords || {
      "فرع أول فيصل": "faisal123",
      "فرع الطالبة": "taleba123"
    };
  });
  const [branchPhones, setBranchPhones] = useState<Record<string, string>>(() => {
    return settings?.branchPhones || {};
  });
  const [branchWhatsappInstances, setBranchWhatsappInstances] = useState<Record<string, string>>(() => {
    return settings?.branchWhatsappInstances || {};
  });
  const [branchWhatsappTokens, setBranchWhatsappTokens] = useState<Record<string, string>>(() => {
    return settings?.branchWhatsappTokens || {};
  });
  const [sendMode, setSendMode] = useState<"auto" | "manual">(settings?.sendMode || "manual");
  const [sendOnRegister, setSendOnRegister] = useState<"yes" | "no">(settings?.sendOnRegister || "no");

  const [successToast, setSuccessToast] = useState("");
  const [errorToast, setErrorToast] = useState("");

  // Sync props dynamically when loaded from cloud
  React.useEffect(() => {
    if (settings) {
      if (settings.parentMessage) setParentMessage(settings.parentMessage);
      if (settings.sendWhatsapp) setSendWhatsapp(settings.sendWhatsapp);
      if (settings.provider) setProvider(settings.provider);
      setUltraInstance(settings.ultraInstance || "");
      setUltraToken(settings.ultraToken || "");
      setTwilioFrom(settings.twilioFrom || "");
      setTwilioEndpoint(settings.twilioEndpoint || "");
      if (settings.studentDayStart) setStudentDayStart(settings.studentDayStart);
      if (settings.studentDayEnd) setStudentDayEnd(settings.studentDayEnd);
      if (settings.employeeDayStart) setEmployeeDayStart(settings.employeeDayStart);
      if (settings.employeeDayEnd) setEmployeeDayEnd(settings.employeeDayEnd);
      if (settings.attendanceDeadline) setAttendanceDeadline(settings.attendanceDeadline);
      if (settings.adminPassword) setAdminPassword(settings.adminPassword);
      if (settings.schoolName) setSchoolName(settings.schoolName);
      if (settings.sendMode) setSendMode(settings.sendMode);
      if (settings.sendOnRegister) setSendOnRegister(settings.sendOnRegister);
      if (settings.weekendDays) setWeekendDays(settings.weekendDays);
      if (settings.branchPasswords) setBranchPasswords(settings.branchPasswords);
      if (settings.branchPhones) setBranchPhones(settings.branchPhones);
      if (settings.branchWhatsappInstances) setBranchWhatsappInstances(settings.branchWhatsappInstances);
      if (settings.branchWhatsappTokens) setBranchWhatsappTokens(settings.branchWhatsappTokens);
    }
  }, [settings]);

  // Save general settings
  const handleSaveAllConfigs = async () => {
    setSuccessToast("");
    setErrorToast("");

    const updated: Settings = {
      parentMessage,
      sendWhatsapp,
      provider,
      ultraInstance,
      ultraToken,
      twilioFrom,
      twilioEndpoint,
      studentDayStart,
      studentDayEnd,
      employeeDayStart,
      employeeDayEnd,
      attendanceDeadline,
      adminPassword,
      schoolName,
      branchPasswords,
      branchPhones,
      branchWhatsappInstances,
      branchWhatsappTokens,
      sendMode,
      sendOnRegister,
      weekendDays,
      updatedAt: new Date().toISOString()
    };

    try {
      await onSaveSettings(updated);
      setSuccessToast("تم حفظ وتحديث إعدادات النظام وتوقيتات الدوام والمزود السحابي.");
      setTimeout(() => setSuccessToast(""), 3000);
    } catch (err: any) {
      let msg = "فشل الحفظ بقاعدة بيانات السحاب.";
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed && parsed.error) {
            msg += ` (${parsed.error})`;
          } else {
            msg += ` (${err.message})`;
          }
        } catch {
          msg += ` (${err.message})`;
        }
      }
      setErrorToast(msg);
    }
  };

  // Add new school semester/year
  const handleYearSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yearStart || !yearEnd) {
      alert("الطلب غير مكتمل: يرجى تحديد بداية ونهاية التقويم.");
      return;
    }

    const ny: AcademicYear = {
      start: yearStart,
      end: yearEnd,
      active: false
    };

    try {
      await onAddYear(ny);
      setYearStart("");
      setYearEnd("");
      setSuccessToast("تم تسجيل العام المالي الدراسي الجديد.");
      setTimeout(() => setSuccessToast(""), 3000);
    } catch (e) {
      alert("فشل إضافة السنة.");
    }
  };

  // Backup downloader
  const downloadJSONBackup = () => {
    try {
      const data = fullBackupTrigger();
      const str = JSON.stringify(data, null, 2);
      const blob = new Blob([str], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shams_cloud_backup_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
    } catch (err) {
      alert("فشل تجميع البيانات.");
    }
  };

  // File uploader & parser
  const handleJSONFileRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setSuccessToast("");
    setErrorToast("");

    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("تحذير هام: استرجاع نسخة احتياطية محلية سيقوم بتهيئة قاعدة البيانات السحابية وإملاء الفصول بالبيانات المرفوعة. هل تريد المتابعة؟")) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Basic verification
        if (!parsed.students && !parsed.employees && !parsed.attendance) {
          setErrorToast("هيكل الملف المرفوع غير مطابق لمواصفات نظام شمس.");
          return;
        }

        await onBatchRestore(parsed);
        setSuccessToast("تهانينا! تم استرجاع وترقية كافة بيانات الكشف السحابي ومزامنتها بنجاح مع الفصول والطلاب.");
        setTimeout(() => setSuccessToast(""), 4000);
      } catch (err: any) {
        setErrorToast("خطأ أثناء قراءة ملف النسخة الاحتياطية: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Toast feeds */}
      {successToast && (
        <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-100 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-500" />
          <span>{successToast}</span>
        </div>
      )}
      {errorToast && (
        <div className="p-4 bg-rose-50 text-rose-800 rounded-xl text-xs font-semibold border border-rose-100 mb-4">
          ⚠ {errorToast}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
        {/* Academic Years Column */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-55 pb-3">
            <CalendarDays className="w-5 h-5 text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-800">السنة الفنية الدراسية</h3>
          </div>
          <p className="text-xs text-slate-400">تحكم بمدير الكشافات، حدد تقويماً دراسياً يلتزم به النظام مباشرة.</p>

          <form onSubmit={handleYearSubmit} className="space-y-1.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">تاريخ البداية</label>
                <input
                  type="date"
                  value={yearStart}
                  onChange={(e) => setYearStart(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">تاريخ النهاية</label>
                <input
                  type="date"
                  value={yearEnd}
                  onChange={(e) => setYearEnd(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-250 rounded-lg text-xs"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 rounded-lg text-xs transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              إضافة سنة جديدة
            </button>
          </form>

          {/* Existing list */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 block mb-2">السنوات المسجلة:</span>
            {years.length === 0 ? (
              <p className="text-[10px] text-slate-400">لا يوجد بيانات للسنوات المالية حتى الآن.</p>
            ) : (
              years.map((y) => (
                <div
                  key={y.id}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs ${
                    y.active ? "bg-amber-50 border border-amber-200 text-amber-900" : "bg-slate-50 border border-slate-100"
                  }`}
                >
                  <span className="font-mono text-[11px] font-bold">
                    {y.start} — {y.end}
                  </span>
                  <div className="flex gap-1">
                    {!y.active && (
                      <button
                        onClick={() => onSetActiveYear(y.id!)}
                        className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white font-sans font-extrabold rounded text-[9px] transition-colors"
                      >
                        تنشيط
                      </button>
                    )}
                    {y.active && (
                      <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[9px] font-bold">
                        نشط حالياً
                      </span>
                    )}
                    <button
                      onClick={() => onDeleteYear(y.id!)}
                      className="text-rose-600 p-0.5 hover:bg-rose-100/50 rounded transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Configurations parameters timings Columns */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-55 pb-3">
            <Key className="w-5 h-5 text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-800">توقيتات اليوم الدراسي</h3>
          </div>
          <p className="text-xs text-slate-400">يمنع النظام تسجيل الحضور الفردي خارج التوقيتات المحددة أدناه.</p>

          <div className="space-y-3 text-xs leading-relaxed">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500">بداية دوام الطلاب</label>
                <input
                  type="time"
                  value={studentDayStart}
                  onChange={(e) => setStudentDayStart(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-center"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500">نهاية دوام الطلاب</label>
                <input
                  type="time"
                  value={studentDayEnd}
                  onChange={(e) => setStudentDayEnd(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-center"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <label className="text-[10px] font-bold text-slate-500">بداية دوام الموظفين</label>
                <input
                  type="time"
                  value={employeeDayStart}
                  onChange={(e) => setEmployeeDayStart(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-center"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500">نهاية دوام الموظفين</label>
                <input
                  type="time"
                  value={employeeDayEnd}
                  onChange={(e) => setEmployeeDayEnd(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-center"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="text-[10px] font-bold text-slate-500">الوقت النهائي لتسجيل الحضور للطلاب (موعد الغياب)</label>
              <input
                type="time"
                value={attendanceDeadline}
                onChange={(e) => setAttendanceDeadline(e.target.value)}
                className="w-full mt-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-center"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-1.5 text-right" dir="rtl">
              <label className="text-[10px] font-extrabold text-slate-500 block">تحديد أيام الإجازة الأسبوعية للطلاب</label>
              <div className="flex flex-wrap gap-1">
                {WEEKDAYS.map((day) => {
                  const isSelected = weekendDays.includes(day.value);
                  return (
                    <button
                      type="button"
                      key={day.value}
                      onClick={() => {
                        setWeekendDays(prev =>
                          prev.includes(day.value)
                            ? prev.filter(v => v !== day.value)
                            : [...prev, day.value]
                        );
                      }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                        isSelected
                          ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {day.label.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
              <p className="text-[9px] text-slate-400">سيقوم النظام بتعليق التسجيل والغياب التلقائي خلال هذه الأيام المختارة.</p>
            </div>
          </div>
        </div>

        {/* WhatsApp Service alerts Gateway Column */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-55 pb-3">
            <Bell className="w-5 h-5 text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-800">إعدادات إنذارات الواتساب</h3>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="text-[10px] font-bold text-slate-500">تفعيل إرسال حركة الحضور</label>
              <select
                value={sendWhatsapp}
                onChange={(e: any) => setSendWhatsapp(e.target.value)}
                className="w-full mt-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="disabled">معطل</option>
                <option value="enabled">مفعل</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500">وضع الإرسال بالتسجيل</label>
              <select
                value={sendMode}
                onChange={(e: any) => setSendMode(e.target.value)}
                className="w-full mt-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="auto">تلقائي فوري (عبر الخادم)</option>
                <option value="manual">يدوي (يفتح نافذة لنسخ النص)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500">مزود خدمة واتساب المعتمد</label>
              <select
                value={provider}
                onChange={(e: any) => setProvider(e.target.value)}
                className="w-full mt-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="ultramsg">UltraMsg (فوري مباشر)</option>
                <option value="twilio">Twilio (عبر خادم وسيط)</option>
              </select>
            </div>

            {provider === "ultramsg" ? (
              <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
                <div>
                  <label className="text-[10px] font-bold text-slate-400">UltraMsg Instance ID</label>
                  <input
                    type="text"
                    value={ultraInstance}
                    onChange={(e) => setUltraInstance(e.target.value)}
                    placeholder="E.g. instance1234"
                    className="w-full mt-0.5 p-1 bg-white border border-slate-200 rounded text-xs text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400">UltraMsg Token</label>
                  <input
                    type="password"
                    value={ultraToken}
                    onChange={(e) => setUltraToken(e.target.value)}
                    placeholder="UltraMsg Secret Token"
                    className="w-full mt-0.5 p-1 bg-white border border-slate-200 rounded text-xs text-center font-mono"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
                <div>
                  <label className="text-[10px] font-bold text-slate-400">Twilio From (whatsapp:+...)</label>
                  <input
                    type="text"
                    value={twilioFrom}
                    onChange={(e) => setTwilioFrom(e.target.value)}
                    placeholder="whatsapp:+14155238886"
                    className="w-full mt-0.5 p-1 bg-white border border-slate-200 rounded text-xs text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400">نقطة نهاية الخادم الوسيط</label>
                  <input
                    type="text"
                    value={twilioEndpoint}
                    onChange={(e) => setTwilioEndpoint(e.target.value)}
                    placeholder="https://yourserver.com/send-whatsapp"
                    className="w-full mt-0.5 p-1 bg-white border border-slate-200 rounded text-xs"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-500">نص الرسالة الإضافي لولي الأمر</label>
              <input
                type="text"
                value={parentMessage}
                onChange={(e) => setParentMessage(e.target.value)}
                placeholder="نتمنى له يوماً دراسياً موفقاً..."
                className="w-full mt-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500">تنبيه فوري لكل الحاضرين</label>
              <select
                value={sendOnRegister}
                onChange={(e: any) => setSendOnRegister(e.target.value)}
                className="w-full mt-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="no">لا</option>
                <option value="yes">نعم</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Security Password & Cloud Backups Management Block */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white rounded-2xl border border-slate-100 shadow-md p-6 font-sans">
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
            <Shield className="w-5 h-5 text-indigo-500" />
            <h4 className="text-xs font-bold text-slate-800">أمن وبوابة الإدارة العامة</h4>
          </div>
          <p className="text-xs text-slate-400 font-medium">اضبط كلمة سر لقسم الإدارة لحماية حركة حضور الطلاب ومفاتيح الباكود الحساسة.</p>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500">اسم المدرسة / المنشأة التعليمية</label>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="مثال: مدارس شمس الأهلية..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-center font-bold focus:bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500">كلمة سر لوحة الإدارة</label>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="اكتب كلمة سر للمسؤول..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-center font-mono focus:bg-white"
            />
          </div>

          <div className="space-y-4 pt-3 border-t border-slate-100">
            <h5 className="text-[11px] font-extrabold text-slate-700 block">🏪 ملفات وإعدادات الفروع النشطة للواتساب:</h5>
            {Object.keys(branchPasswords).map((branchName) => (
              <div key={branchName} className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-3 text-right">
                <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                  <span className="text-xs font-black text-slate-800">{branchName}</span>
                  <span className="text-[9px] font-bold text-slate-400">إعدادات الفرع</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 block text-right">كلمة مرور استقبال الفرع</label>
                    <input
                      type="text"
                      value={branchPasswords[branchName] || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBranchPasswords((prev) => ({ ...prev, [branchName]: val }));
                      }}
                      placeholder="رمز الاستقبال"
                      className="w-full px-3 py-2 bg-white border border-slate-200/80 rounded-xl text-xs font-mono text-center focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 block text-right">رقم واتساب تواصل الفرع</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={branchPhones[branchName] || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBranchPhones((prev) => ({ ...prev, [branchName]: val }));
                      }}
                      placeholder="مثال: +201011223344"
                      className="w-full px-3 py-2 bg-white border border-slate-200/80 rounded-xl text-xs font-mono text-center focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {/* Optional branch-specific sender credentials for UltraMsg */}
                <div className="p-2.5 bg-indigo-50/40 rounded-xl border border-indigo-100/40 space-y-1.5">
                  <div className="flex items-center justify-between flex-row-reverse">
                    <span className="text-[9px] font-extrabold text-indigo-700">بوابة وببيانات إرسال رسائل الفرع مستقلة (اختياري)</span>
                    <span className="text-[8px] font-semibold text-slate-400">إذا تركته فارغاً سيتم استخدام الإعداد العام</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[8px] font-bold text-slate-500 block text-right">UltraMsg Instance ID</label>
                      <input
                        type="text"
                        value={branchWhatsappInstances[branchName] || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBranchWhatsappInstances((prev) => ({ ...prev, [branchName]: val }));
                        }}
                        placeholder="E.g. instance1234"
                        className="w-full text-right p-1.5 bg-white border border-slate-200 rounded text-[10px]"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-bold text-slate-500 block text-right">UltraMsg Token</label>
                      <input
                        type="password"
                        value={branchWhatsappTokens[branchName] || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBranchWhatsappTokens((prev) => ({ ...prev, [branchName]: val }));
                        }}
                        placeholder="UltraMsg Token"
                        className="w-full text-right p-1.5 bg-white border border-slate-200 rounded text-[10px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 border-t md:border-t-0 md:border-r border-slate-100 md:pr-6">
          <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
            <Download className="w-5 h-5 text-indigo-500" />
            <h4 className="text-xs font-bold text-slate-800">نسخ احتياطي واسترجاع فوري سحابي</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed font-semibold text-slate-500">
            أدوات الترحيل المباشر: يمكنك تنزيل النسخة بالكامل كملف JSON، أو ترحيل البيانات وتنزيلها بالكامل إلى السيرفر دفعة واحدة.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={downloadJSONBackup}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-slate-500" />
              تنزيل نسخة احتياطية
            </button>

            <label className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              ترحيل واستيراد نسخة Backup
              <input
                type="file"
                accept=".json"
                onChange={handleJSONFileRestore}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleSaveAllConfigs}
          className="px-8 py-3 bg-indigo-600 text-white font-black hover:bg-indigo-700 rounded-2xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-2"
        >
          <LucideSettings className="w-4 h-4" />
          حفظ جميع إعدادات النظام المركب
        </button>
      </div>
    </div>
  );
}
