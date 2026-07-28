import React, { useState } from "react";
import { Users, UserPlus, Search, Edit, Trash2, CheckSquare, Clock } from "lucide-react";
import { Employee } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface EmployeesPanelProps {
  employees: Employee[];
  onSaveEmployee: (employee: Employee) => Promise<void>;
  onDeleteEmployee: (code: string) => Promise<void>;
  onRecordEmployeeAttendance: (code: string) => void;
  currentUserRole?: string;
  currentUserBranch?: string;
}

export function EmployeesPanel({
  employees,
  onSaveEmployee,
  onDeleteEmployee,
  onRecordEmployeeAttendance,
  currentUserRole,
  currentUserBranch
}: EmployeesPanelProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [attendanceTime, setAttendanceTime] = useState("08:00");
  const [role, setRole] = useState<"employee" | "receptionist">("employee");
  const [branch, setBranch] = useState("فرع أول فيصل");
  const [editingCode, setEditingCode] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [formError, setFormError] = useState("");
  const [successToast, setSuccessToast] = useState("");

  const handleResetForm = () => {
    setName("");
    setCode("");
    setAttendanceTime("08:00");
    setRole("employee");
    setBranch(currentUserRole === "receptionist" && currentUserBranch ? currentUserBranch : "فرع أول فيصل");
    setEditingCode(null);
    setFormError("");
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!name.trim() || !code.trim() || !attendanceTime) {
      setFormError("الرجاء اكمال كافة الخلايا الإلزامية مميزة بنفس النجمة (*).");
      return;
    }

    if (!editingCode) {
      if (employees.some(emp => emp.code === code.trim())) {
        setFormError("كود الباركود المدخل مستخدم بالفعل لموظف آخر.");
        return;
      }
    }

    const compiledEmployee: Employee = {
      name: name.trim(),
      code: code.trim(),
      attendanceTime: attendanceTime,
      role: role,
      branch: branch || "فرع أول فيصل"
    };

    try {
      await onSaveEmployee(compiledEmployee);
      setSuccessToast(editingCode ? "تم تحديث بيانات الموظف بنجاح" : "تم إضافة الموظف الجديد لقاعدة البيانات بنجاح");
      handleResetForm();
      setTimeout(() => setSuccessToast(""), 3000);
    } catch (err) {
      setFormError("تعذر حفظ تعديلات الموظف السحابية.");
    }
  };

  const startEdit = (emp: Employee) => {
    setName(emp.name);
    setCode(emp.code);
    setAttendanceTime(emp.attendanceTime);
    setRole(emp.role || "employee");
    setBranch(emp.branch || "فرع أول فيصل");
    setEditingCode(emp.code);
    setFormError("");
  };

  const handleDelete = async (empCode: string, empName: string) => {
    if (!confirm(`هل أنت متأكد من حذف الموظف (${empName}) كلياً وسحب كافة ممتلكات حضوره السابقة؟`)) return;
    try {
      await onDeleteEmployee(empCode);
      setSuccessToast("تم حذف ملف الموظف بنجاح");
      setTimeout(() => setSuccessToast(""), 3000);
    } catch (err) {
      alert("تعذر إنهاء التدمير الفوري بالسيرفر.");
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesBranch = currentUserRole === "receptionist" && currentUserBranch
      ? emp.branch === currentUserBranch
      : (branchFilter ? emp.branch === branchFilter : true);

    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.code.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesBranch && matchesSearch;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* CRUD Side */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-6 h-fit space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              {editingCode ? "تعديل الموظف" : "تسجيل موظف جديد"}
            </h3>
            <p className="text-xs text-slate-400">سجل كوادر العمل لتأكيد حركة الانضباط</p>
          </div>
        </div>

        {formError && (
          <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold border border-rose-100">
            {formError}
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500">اسم الموظف الكامل *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: د. عبد الرحمن عسيري"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">الباركود الفريد *</label>
              <input
                type="text"
                value={code}
                disabled={!!editingCode}
                onChange={(e) => setCode(e.target.value)}
                placeholder="كود المسح"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 disabled:opacity-60 rounded-xl text-sm font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">موعد الدوام المطلوب *</label>
              <input
                type="time"
                value={attendanceTime}
                onChange={(e) => setAttendanceTime(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">الدور الوظيفي *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm text-right focus:outline-none focus:bg-white"
              >
                <option value="employee">موظف عادي</option>
                <option value="receptionist">موظف استقبال</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">الفرع *</label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                disabled={currentUserRole === "receptionist"}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm text-right focus:outline-none disabled:opacity-75 focus:bg-white"
              >
                <option value="فرع أول فيصل">فرع أول فيصل</option>
                <option value="فرع الطالبة">فرع الطالبة</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-all shadow-sm hover:shadow text-sm"
            >
              {editingCode ? "تحديث البيانات" : "حفظ الموظف"}
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

      {/* Checklist Grid Side */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-md p-6 space-y-6">
        <AnimatePresence>
          {successToast && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-100"
            >
              ✓ {successToast}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-b border-slate-100 pb-4 items-center">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث الفوري عن الموظفين..."
              className="w-full pl-4 pr-11 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:bg-white transition-all text-xs"
            />
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>

          {currentUserRole !== "receptionist" ? (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-600 font-semibold"
            >
              <option value="">جميع فروع المدرسة (الكل)</option>
              <option value="فرع أول فيصل">🏛️ فرع أول فيصل</option>
              <option value="فرع الطالبة">🌸 فرع الطالبة</option>
            </select>
          ) : (
            <div />
          )}

          <span className="text-xs text-slate-400 font-medium text-left">العدد الكلي: {filteredEmployees.length}</span>
        </div>

        {/* Reception Table Checklist */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 select-none">
                <th className="pb-3 text-xs font-bold">اسم الموظف</th>
                <th className="pb-3 text-xs font-bold">كود الموظف</th>
                <th className="pb-3 text-xs font-bold">موعد الدوام</th>
                <th className="pb-3 text-xs font-bold">الدور</th>
                <th className="pb-3 text-xs font-bold">الفرع</th>
                <th className="pb-3 text-xs font-bold text-center">أدوات إثبات الحضور</th>
                <th className="pb-3 text-xs font-bold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 text-xs">
                    لا يوجد أي موظفين مسجلين يتطابقون مع كلمة البحث.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.code} className="hover:bg-slate-50/55 transition-colors">
                    <td className="py-3.5 font-bold text-slate-800">{emp.name}</td>
                    <td className="py-3.5 font-mono text-xs">{emp.code}</td>
                    <td className="py-3.5 font-mono text-xs text-slate-500 font-semibold">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {emp.attendanceTime}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${emp.role === "receptionist" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
                        {emp.role === "receptionist" ? "موظف استقبال" : "موظف عادي"}
                      </span>
                    </td>
                    <td className="py-3.5 text-xs font-semibold">
                      {emp.branch === "فرع الطالبة" ? (
                        <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded bg-rose-50 text-[10px] text-rose-700 border border-rose-100/60 shadow-sm leading-none">
                          🌸 فرع الطالبة
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded bg-blue-50 text-[10px] text-blue-700 border border-blue-100/60 shadow-sm leading-none">
                          🏛️ فرع أول فيصل
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 text-center">
                      <button
                        onClick={() => onRecordEmployeeAttendance(emp.code)}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-xs transition-all inline-flex items-center gap-1.5"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        تشغيل حضور وانصراف نقري
                      </button>
                    </td>
                    <td className="py-3.5 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => startEdit(emp)}
                          className="p-1 px-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                          title="تعديل"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(emp.code, emp.name)}
                          className="p-1 px-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                          title="حذف كلي"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
