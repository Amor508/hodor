import React, { useState } from "react";
import { CalendarRange, ClipboardList, Trash2, ShieldAlert, PlusCircle, Search, CheckSquare, Square } from "lucide-react";
import { Holiday, Student } from "../types";
import { motion } from "motion/react";

interface HolidaysPanelProps {
  holidays: Holiday[];
  students: Student[];
  onSaveHoliday: (holiday: Holiday) => Promise<void>;
  onDeleteHoliday: (id: string) => Promise<void>;
}

export function HolidaysPanel({
  holidays,
  students,
  onSaveHoliday,
  onDeleteHoliday
}: HolidaysPanelProps) {
  const [type, setType] = useState<"general" | "specific" | "class" | "group">("general");
  const [studentCode, setStudentCode] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudentCodes, setSelectedStudentCodes] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const [formError, setFormError] = useState("");
  const [successToast, setSuccessToast] = useState("");

  // Extract unique classes dynamically
  const classes = Array.from(new Set(students.map((s) => s.class))).filter(Boolean).sort();

  // Filter students for group selection
  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.code.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.class.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const handleResetForm = () => {
    setType("general");
    setStudentCode("");
    setSelectedClass("");
    setSelectedStudentCodes([]);
    setReason("");
    setStart("");
    setEnd("");
    setStudentSearch("");
    setFormError("");
  };

  const toggleStudentSelection = (code: string) => {
    setSelectedStudentCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredCodes = filteredStudents.map((s) => s.code);
    setSelectedStudentCodes((prev) => {
      const union = Array.from(new Set([...prev, ...filteredCodes]));
      return union;
    });
  };

  const handleDeselectAllFiltered = () => {
    const filteredCodes = filteredStudents.map((s) => s.code);
    setSelectedStudentCodes((prev) => prev.filter((c) => !filteredCodes.includes(c)));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!reason.trim() || !start || !end) {
      setFormError("الرجاء تحديد سبب الإجازة وفترات البداية والنهاية كلياً.");
      return;
    }

    if (type === "specific" && !studentCode) {
      setFormError("الرجاء اختيار اسم الطالب المستحق لهذه الإجازة الفردية.");
      return;
    }

    if (type === "class" && !selectedClass) {
      setFormError("الرجاء اختيار الصف الدراسي المستهدف كلياً.");
      return;
    }

    if (type === "group" && selectedStudentCodes.length === 0) {
      setFormError("الرجاء اختيار طالب واحد على الأقل في المجموعة.");
      return;
    }

    const compiledHoliday: Holiday = {
      type,
      reason: reason.trim(),
      start,
      end,
      studentCode: type === "specific" ? studentCode : null,
      studentCodes: type === "group" ? selectedStudentCodes : null,
      className: type === "class" ? selectedClass : null
    };

    try {
      await onSaveHoliday(compiledHoliday);
      setSuccessToast("تم تسجيل وحفظ الإجازة بنجاح بنظام السحاب");
      handleResetForm();
      setTimeout(() => setSuccessToast(""), 3000);
    } catch (err: any) {
      setFormError("فشل تسجيل الإجازة السحابية.");
    }
  };

  const handleDelete = async (id: string, reasonText: string) => {
    if (!id) return;
    if (!confirm(`هل أنت متأكد من مسح عطلة الإجازة (${reasonText})؟ سيعاد فتح عمليات الحضور لتواريخها.`)) return;
    try {
      await onDeleteHoliday(id);
    } catch (err) {
      alert("تعذر حذف العطلة من الخادم السحابي.");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Save Holiday form */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-6 h-fit space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <CalendarRange className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">إقرار إجازة جديدة</h3>
            <p className="text-xs text-slate-400">امنع الحضور خلال فترات العطل أو الأجازة المرضية</p>
          </div>
        </div>

        {formError && (
          <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold border border-rose-100 leading-relaxed">
            {formError}
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4 font-sans text-right">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 block mb-1">نوع الإجازة المطلوبة</label>
            <select
              value={type}
              onChange={(e: any) => {
                setType(e.target.value);
                setStudentCode("");
                setSelectedClass("");
                setSelectedStudentCodes([]);
              }}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm focus:outline-none font-bold text-slate-850"
            >
              <option value="general">إجازة عامة (تشمل جميع الطلاب والموظفين)</option>
              <option value="class">إجازة لصف دراسي كامل (جميع طلاب الصف)</option>
              <option value="group">إجازة لمجموعة طلاب مخصصة (تحديد متعدد)</option>
              <option value="specific">إجازة خاصة (لطالب محدد فقط)</option>
            </select>
          </div>

          {/* Type: SPECIFIC STUDENT */}
          {type === "specific" && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 block mb-1">اختر الطالب المستحق للإجازة</label>
              <select
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm focus:outline-none"
              >
                <option value="">اختر طالباً...</option>
                {students.map((st) => (
                  <option key={st.code} value={st.code}>
                    {st.name} ({st.class})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Type: CLASS-WIDE */}
          {type === "class" && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 block mb-1">اختر الصف الدراسي المستهدف</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm focus:outline-none font-bold text-slate-800"
              >
                <option value="">اختر صفاً...</option>
                {classes.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Type: GROUP-WIDE MULTI SELECT */}
          {type === "group" && (
            <div className="space-y-2 border border-slate-100 rounded-xl p-3 bg-slate-50/50">
              <label className="text-xs font-bold text-slate-700 block">اختر طلاب المجموعة ({selectedStudentCodes.length} محدد)</label>
              
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="ابحث بالاسم، الكود، أو الصف..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>

              {/* Selection helpers */}
              <div className="flex gap-2 justify-end text-[10px] font-bold text-indigo-600">
                <button type="button" onClick={handleSelectAllFiltered} className="hover:underline">
                  تحديد الكل الظاهر
                </button>
                <span className="text-slate-300">|</span>
                <button type="button" onClick={handleDeselectAllFiltered} className="hover:underline">
                  إلغاء تحديد الكل
                </button>
              </div>

              {/* Scrollable Checkbox List */}
              <div className="max-h-48 overflow-y-auto border border-slate-150 rounded-xl bg-white p-2.5 space-y-1.5 scrollbar-thin">
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-6 text-[10px] text-slate-400">لا يوجد طلاب يطابقون بحثك</div>
                ) : (
                  filteredStudents.map((st) => {
                    const isSelected = selectedStudentCodes.includes(st.code);
                    return (
                      <button
                        type="button"
                        key={st.code}
                        onClick={() => toggleStudentSelection(st.code)}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors ${
                          isSelected ? "bg-indigo-50/80 text-indigo-950 font-bold" : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">[{st.code}]</span>
                          <span>{st.name}</span>
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px]">{st.class}</span>
                        </div>
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 block mb-1">سبب وقضية الإجازة *</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: إجازة مرضية جماعية / عطلة رسمية"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 block mb-1">من تاريخ *</label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 block mb-1">إلى تاريخ *</label>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl transition-all shadow-sm text-sm inline-flex items-center justify-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              حفظ عطلة الإجازة
            </button>
            <button
              type="button"
              onClick={handleResetForm}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all text-sm"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>

      {/* Holiday Logs columns */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-md p-6 space-y-6">
        {successToast && (
          <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-100 animate-pulse">
            ✓ {successToast}
          </div>
        )}

        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <ClipboardList className="w-5 h-5 text-indigo-500" />
          <h4 className="text-sm font-bold text-slate-800">قائمة الإجازات المسجلة كلياً</h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 select-none">
                <th className="pb-3 text-xs font-bold">نوع الإجازة</th>
                <th className="pb-3 text-xs font-bold">المستفيد</th>
                <th className="pb-3 text-xs font-bold">السبب</th>
                <th className="pb-3 text-xs font-bold">تبدأ من</th>
                <th className="pb-3 text-xs font-bold">تنتهي في</th>
                <th className="pb-3 text-xs font-bold text-center">أدوات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {holidays.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                    لم يتم رصد أي إجازات أو عطل مدروسة بقاعدة البيانات حتى الساعة.
                  </td>
                </tr>
              ) : (
                holidays.map((h) => {
                  let beneficiaryStr = "";
                  let typeLabel = "";
                  let typeColor = "";

                  if (h.type === "general") {
                    beneficiaryStr = "كافة الطلاب والموظفين";
                    typeLabel = "إجازة عامة";
                    typeColor = "bg-amber-50 text-amber-750 border border-amber-200/50";
                  } else if (h.type === "class") {
                    beneficiaryStr = `جميع طلاب صف: ${h.className}`;
                    typeLabel = "إجازة لصف";
                    typeColor = "bg-sky-50 text-sky-750 border border-sky-200/50";
                  } else if (h.type === "group") {
                    beneficiaryStr = `مجموعة طلاب (${h.studentCodes?.length || 0} طالباً)`;
                    typeLabel = "إجازة مجموعة";
                    typeColor = "bg-teal-50 text-teal-750 border border-teal-200/50";
                  } else {
                    const student = h.studentCode ? students.find((s) => s.code === h.studentCode) : null;
                    beneficiaryStr = student ? `${student.name} (${student.class})` : `طالب بكود: ${h.studentCode}`;
                    typeLabel = "إجازة طالب";
                    typeColor = "bg-indigo-50 text-indigo-750 border border-indigo-200/50";
                  }

                  return (
                    <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${typeColor}`}>
                          {typeLabel}
                        </span>
                      </td>
                      <td className="py-3.5 font-bold text-slate-800 text-xs">{beneficiaryStr}</td>
                      <td className="py-3.5 text-slate-600 bg-slate-50/40 px-2 rounded-lg text-xs" title={h.reason}>
                        {h.reason}
                      </td>
                      <td className="py-3.5 font-mono text-xs text-slate-500">{h.start}</td>
                      <td className="py-3.5 font-mono text-xs text-slate-500">{h.end}</td>
                      <td className="py-3.5 text-center">
                        {h.id && (
                          <button
                            onClick={() => handleDelete(h.id!, h.reason)}
                            className="p-1 px-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="إلغاء الإجازة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
