import React, { useState, useEffect } from "react";
import { UserPlus, Search, Printer, Edit, Trash2, ShieldAlert, CheckCircle2, UserCheck, Eye, EyeOff, FileSpreadsheet, Upload, X, FileText, AlertTriangle } from "lucide-react";
import { Student } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface StudentsPanelProps {
  students: Student[];
  onSaveStudent: (student: Student) => Promise<void>;
  onDeleteStudent: (code: string) => Promise<void>;
  onMergeStudents?: (keepCode: string, deleteCode: string) => Promise<void>;
  currentUserRole?: string;
  currentUserBranch?: string;
}

export function StudentsPanel({
  students,
  onSaveStudent,
  onDeleteStudent,
  onMergeStudents,
  currentUserRole,
  currentUserBranch
}: StudentsPanelProps) {
  // CRUD states
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [code, setCode] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [branch, setBranch] = useState("فرع أول فيصل");
  const [editingCode, setEditingCode] = useState<string | null>(null);

  // Sync branches locks for receptionists
  useEffect(() => {
    if (currentUserRole === "receptionist" && currentUserBranch) {
      setBranch(currentUserBranch);
    }
  }, [currentUserRole, currentUserBranch]);

  // Filter/search states
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");

  // Suspension helper modal state
  const [suspensionTarget, setSuspensionTarget] = useState<Student | null>(null);
  const [suspendReasonInput, setSuspendReasonInput] = useState("");

  // Viewing detailed record
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Form error
  const [formError, setFormError] = useState("");
  const [successToast, setSuccessToast] = useState("");

  // Duplicate students states and detector
  const [showDuplicateResolver, setShowDuplicateResolver] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<{
    type: "same_id" | "same_name_phone" | "same_name_class";
    key: string;
    students: Student[];
  }[]>([]);

  // CSV Batch Importer states
  const [showCsvImporter, setShowCsvImporter] = useState(false);
  const [csvTextInput, setCsvTextInput] = useState("");
  const [parsedCsvStudents, setParsedCsvStudents] = useState<Student[]>([]);
  const [csvParseError, setCsvParseError] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const detectDuplicates = () => {
    const groups: {
      type: "same_id" | "same_name_phone" | "same_name_class";
      key: string;
      students: Student[];
    }[] = [];

    // Group by ID
    const byId: Record<string, Student[]> = {};
    students.forEach(s => {
      if (!s.id) return;
      const cleanId = s.id.trim();
      if (!byId[cleanId]) byId[cleanId] = [];
      byId[cleanId].push(s);
    });
    Object.entries(byId).forEach(([studentId, list]) => {
      if (list.length > 1) {
        groups.push({
          type: "same_id",
          key: studentId,
          students: list
        });
      }
    });

    // Group by Name + Parent Phone (Family Duplicate)
    const byNamePhone: Record<string, Student[]> = {};
    students.forEach(s => {
      if (!s.name || !s.parentPhone) return;
      const cleanName = s.name.trim();
      const cleanPhone = s.parentPhone.replace(/\D/g, "");
      if (!cleanPhone) return;
      const key = `${cleanName}_${cleanPhone}`;
      if (!byNamePhone[key]) byNamePhone[key] = [];
      byNamePhone[key].push(s);
    });
    Object.entries(byNamePhone).forEach(([key, list]) => {
      if (list.length > 1) {
        groups.push({
          type: "same_name_phone",
          key: `${list[0].name} (${list[0].parentPhone})`,
          students: list
        });
      }
    });

    // Group by Name + Class
    const byNameClass: Record<string, Student[]> = {};
    students.forEach(s => {
      if (!s.name || !s.class) return;
      const key = `${s.name.trim()}_${s.class.trim()}`;
      if (!byNameClass[key]) byNameClass[key] = [];
      byNameClass[key].push(s);
    });
    Object.entries(byNameClass).forEach(([key, list]) => {
      if (list.length > 1) {
        const phoneKey = `${list[0].name} (${list[0].parentPhone})`;
        const alreadyInPhone = groups.some(g => g.type === "same_name_phone" && g.key === phoneKey);
        if (!alreadyInPhone) {
          groups.push({
            type: "same_name_class",
            key: `${list[0].name} (${list[0].class})`,
            students: list
          });
        }
      }
    });

    setDuplicateGroups(groups);
  };

  useEffect(() => {
    if (showDuplicateResolver) {
      detectDuplicates();
    }
  }, [students, showDuplicateResolver]);

  const handleParseCsv = () => {
    setCsvParseError("");
    setParsedCsvStudents([]);

    if (!csvTextInput.trim()) {
      setCsvParseError("الرجاء إدخال نص CSV أو نسخ البيانات من إكسل أولاً.");
      return;
    }

    const lines = csvTextInput.split(/\r?\n/);
    const result: Student[] = [];
    const localCodes = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Split by comma, semicolon, or tab (for excel paste support!)
      let parts = line.split(/[,\t;]/);
      parts = parts.map(p => p.trim().replace(/^["']|["']$/g, "")); // remove surrounding quotes

      // Skip header line if it contains known text
      if (i === 0 && (line.includes("الاسم") || line.includes("الكود") || line.includes("اسم") || line.includes("كود"))) {
        continue;
      }

      // Expected format: الكود, الاسم, الهوية الوطنية, الهاتف, الصف, الفرع, التوقيت المجدول
      // Minimum columns needed: Code, Name.
      if (parts.length < 2) {
        continue; // skip malformed lines
      }

      const stCode = parts[0];
      const stName = parts[1];

      if (!stCode || !stName) {
        continue; // skip lines without code or name
      }

      // Validate code unique in this import
      if (localCodes.has(stCode)) {
        setCsvParseError(`خطأ في السطر ${i + 1}: الكود المكرر "${stCode}" متكرر في نفس قائمة الاستيراد.`);
        return;
      }

      // Validate code unique against database
      const dbDup = students.find(s => s.code === stCode);
      if (dbDup) {
        setCsvParseError(`خطأ في السطر ${i + 1}: الكود "${stCode}" مسجل بالفعل للطالب (${dbDup.name}) في النظام.`);
        return;
      }

      const stId = parts[2] || `B-${stCode}`;
      const stPhone = (parts[3] || "").replace(/\D/g, "");
      const stClass = parts[4] || "الصف الأول";
      const stBranch = parts[5] || currentUserBranch || "فرع أول فيصل";
      const stTime = parts[6] || "07:30";

      localCodes.add(stCode);

      result.push({
        code: stCode,
        name: stName,
        id: stId,
        parentPhone: stPhone,
        class: stClass,
        branch: stBranch,
        scheduledTime: stTime,
        suspended: false,
        suspendReason: ""
      });
    }

    if (result.length === 0) {
      setCsvParseError("لم يتم العثور على أي أسطر صالحة للاستيراد. يرجى التحقق من التنسيق.");
    } else {
      setParsedCsvStudents(result);
    }
  };

  const handleExecuteImport = async () => {
    if (parsedCsvStudents.length === 0) return;
    setIsImporting(true);
    try {
      // Save all parsed students
      for (const st of parsedCsvStudents) {
        await onSaveStudent(st);
      }
      setSuccessToast(`تم استيراد ${parsedCsvStudents.length} طلاب بنجاح!`);
      setShowCsvImporter(false);
      setCsvTextInput("");
      setParsedCsvStudents([]);
      setTimeout(() => setSuccessToast(""), 3000);
    } catch (err) {
      setCsvParseError("فشل حفظ بعض الطلاب على الخادم السحابي المباشر. يرجى المحاولة لاحقاً.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleResetForm = () => {
    setName("");
    setId("");
    setStudentClass("");
    setCode("");
    setParentPhone("");
    setScheduledTime("");
    setBranch(currentUserRole === "receptionist" && currentUserBranch ? currentUserBranch : "فرع أول فيصل");
    setEditingCode(null);
    setFormError("");
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!name.trim() || !id.trim() || !studentClass || !code.trim()) {
      setFormError("الرجاء تعبئة جميع الحقول الإلزامية مميزة بعلامة (*).");
      return;
    }

    // Check code and ID duplication only if registering a new student
    if (!editingCode) {
      const codeExists = students.some(s => s.code === code.trim());
      if (codeExists) {
        setFormError("كود الباركود المدخل مستخدم بالفعل لطالب آخر.");
        return;
      }

      const idExists = students.some(s => s.id.trim() === id.trim());
      if (idExists) {
        setFormError("كود القيد المدخل مستخدم بالفعل لطالب آخر.");
        return;
      }

      const cleanPhone = parentPhone.replace(/\D/g, "");
      if (cleanPhone) {
        const namePhoneExists = students.some(s => 
          s.name.trim() === name.trim() && 
          s.parentPhone?.replace(/\D/g, "") === cleanPhone
        );
        if (namePhoneExists) {
          setFormError("تم العثور على طالب بنفس الاسم ورقم هاتف العائلة في النظام بالفعل. لتفادي التكرار، يرجى تعديل الحساب السابق أو إدخال اسم مختلف.");
          return;
        }
      }
    } else {
      const idExists = students.some(s => s.id.trim() === id.trim() && s.code !== editingCode);
      if (idExists) {
        setFormError("كود القيد المدخل مستخدم بالفعل لطالب آخر.");
        return;
      }
    }

    const compiledStudent: Student = {
      name: name.trim(),
      id: id.trim(),
      class: studentClass,
      code: code.trim(),
      parentPhone: parentPhone.replace(/\D/g, ""), // Keep numbers only
      scheduledTime: scheduledTime || "07:30",
      branch: branch || "فرع أول فيصل",
      suspended: editingCode ? students.find(s => s.code === editingCode)?.suspended || false : false,
      suspendReason: editingCode ? students.find(s => s.code === editingCode)?.suspendReason || "" : ""
    };

    try {
      await onSaveStudent(compiledStudent);
      setSuccessToast(editingCode ? "تم تحديث بيانات الطالب بنجاح" : "تم تسجيل الطالب بنجاح في النظام");
      handleResetForm();
      setTimeout(() => setSuccessToast(""), 3000);
    } catch (err: any) {
      setFormError("فشل حفظ البيانات بالشبكة المباشرة.");
    }
  };

  const startEdit = (st: Student) => {
    setName(st.name);
    setId(st.id);
    setStudentClass(st.class);
    setCode(st.code);
    setParentPhone(st.parentPhone || "");
    setScheduledTime(st.scheduledTime || "07:30");
    setBranch(st.branch || "فرع أول فيصل");
    setEditingCode(st.code);
    setFormError("");
  };

  const handleDelete = async (stCode: string, stName: string) => {
    if (!confirm(`هل أنت متأكد من حذف الطالب (${stName}) نهائياً من قاعدة البيانات السحابية؟ سيتم إزالة جميع سجلات حضوره أيضاً.`)) {
      return;
    }
    try {
      await onDeleteStudent(stCode);
      setSuccessToast("تم حذف ملف الطالب بنجاح");
      setTimeout(() => setSuccessToast(""), 3000);
    } catch (err) {
      alert("فشل الحذف من الخادم.");
    }
  };

  const triggerSuspension = (st: Student) => {
    setSuspensionTarget(st);
    setSuspendReasonInput(st.suspendReason || "");
  };

  const saveSuspension = async () => {
    if (!suspensionTarget) return;

    const updated: Student = {
      ...suspensionTarget,
      suspended: true,
      suspendReason: suspendReasonInput.trim()
    };

    await onSaveStudent(updated);
    setSuspensionTarget(null);
    setSuspendReasonInput("");
    setSuccessToast("تم إيقاف الطالب عن الحضور بنجاح");
    setTimeout(() => setSuccessToast(""), 3000);
  };

  const removeSuspension = async (st: Student) => {
    const updated: Student = {
      ...st,
      suspended: false,
      suspendReason: ""
    };

    await onSaveStudent(updated);
    setSuccessToast("تم إلغاء إيقاف الطالب بنجاح");
    setTimeout(() => setSuccessToast(""), 3000);
  };

  // Printable student A6 ID Card
  const printIDCard = (st: Student) => {
    const printWindow = window.open("", "_blank", "width=480,height=600");
    if (!printWindow) return;

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>بطاقة هوية طالب — نظام شمس</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
            body {
              font-family: 'Cairo', sans-serif;
              direction: rtl;
              margin: 0;
              padding: 20px;
              background-color: #f8fafc;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
            }
            .card-outer {
              width: 105mm;
              height: 148mm;
              background: #ffffff;
              border: 3px solid #1e293b;
              border-radius: 12px;
              box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
              overflow: hidden;
              box-sizing: border-box;
              display: flex;
              flex-col: column;
              flex-direction: column;
              justify-content: space-between;
              padding: 15px;
              text-align: center;
              position: relative;
            }
            .brand-header {
              font-size: 16px;
              font-weight: 700;
              color: #f59e0b;
              background: #1e293b;
              margin: -15px -15px 15px -15px;
              padding: 12px;
            }
            .barcode-visual {
              margin: 15px auto;
              width: 80%;
              height: 50px;
              background: repeating-linear-gradient(90deg, #000 0px, #000 3px, #fff 3px, #fff 7px);
              border: 1px solid #ddd;
            }
            .data-grid {
              text-align: right;
              margin-top: 15px;
              line-height: 1.8;
              font-size: 13px;
              color: #334155;
            }
            .data-grid div {
              margin-bottom: 8px;
              border-bottom: 1px dashed #e2e8f0;
              padding-bottom: 4px;
            }
            .data-grid strong {
              color: #0f172a;
            }
            .card-footer {
              font-size: 10px;
              color: #94a3b8;
              margin-top: 15px;
              border-top: 1px solid #e2e8f0;
              padding-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="card-outer">
            <div class="brand-header">مدرسة شمس النموذجية</div>
            <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-top:5px;">بطاقة حضور الباركود للطلاب</div>
            
            <div class="barcode-visual"></div>
            <div style="font-family: monospace; font-size: 16px; font-weight: bold; letter-spacing: 3px; color: #1e293b;">${st.code}</div>

            <div class="data-grid">
              <div><strong>اسم الطالب:</strong> ${st.name}</div>
              <div><strong>كود الفرع:</strong> ${st.id}</div>
              <div><strong>الصف:</strong> ${st.class}</div>
              <div><strong>موعد الحضور اليومي:</strong> ${st.scheduledTime || "07:30"}</div>
              <div><strong>هاتف الطوارئ:</strong> ${st.parentPhone || "—"}</div>
            </div>

            <div class="card-footer">
              سجل دائماً حضورك بوضع الرمز أمام جهاز الاستشعار المدرسي.
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter implementation
  const filteredStudents = students.filter(st => {
    const matchesBranch = currentUserRole === "receptionist" && currentUserBranch
      ? st.branch === currentUserBranch
      : (branchFilter ? st.branch === branchFilter : true);

    const matchesSearch =
      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.code.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesClass = classFilter ? st.class === classFilter : true;

    return matchesBranch && matchesSearch && matchesClass;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Registration Form Column */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-6 h-fit space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              {editingCode ? "تعديل بيانات الطالب" : "تسجيل طالب جديد"}
            </h3>
            <p className="text-xs text-slate-400">أدخل البيانات الأساسية لإثبات قيد الطالب</p>
          </div>
        </div>

        {formError && (
          <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold border border-rose-100">
            {formError}
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500">اسم الطالب الكامل *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: أحمد عبد الله الشمري"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">كود الفرع *</label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="مثال: BR-01"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">الصف الدراسي *</label>
              <select
                value={studentClass}
                onChange={(e) => setStudentClass(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm focus:outline-none"
                required
              >
                <option value="">اختر الصف...</option>
                <option value="KG1">KG1</option>
                <option value="KG2">KG2</option>
                <option value="الصف الأول">الصف الأول</option>
                <option value="الصف الثاني">الصف الثاني</option>
                <option value="الصف الثالث">الصف الثالث</option>
                <option value="الصف الرابع">الصف الرابع</option>
                <option value="الصف الخامس">الصف الخامس</option>
                <option value="الصف السادس">الصف السادس</option>
                <option value="الأول المتوسط">الأول المتوسط</option>
                <option value="الثاني المتوسط">الثاني المتوسط</option>
                <option value="الثالث المتوسط">الثالث المتوسط</option>
                <option value="الأول الثانوي">الأول الثانوي</option>
                <option value="الثاني الثانوي">الثاني الثانوي</option>
                <option value="الثالث الثانوي">الثالث الثانوي</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">كود الباركود الفريد *</label>
              <input
                type="text"
                value={code}
                disabled={!!editingCode}
                onChange={(e) => setCode(e.target.value)}
                placeholder="رقم البطاقة الممسوحة"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 disabled:opacity-60 rounded-xl text-sm font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">موعد الحضور المعتمد</label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500">رقم واتساب ولي الأمر (للتنبيهات)</label>
            <input
              type="text"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              placeholder="مثال: 966500000000"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-mono text-left"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500">الفرع الدراسي *</label>
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

          <div className="pt-2 flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition-all shadow-sm hover:shadow text-sm"
            >
              {editingCode ? "تحديث البيانات" : "حفظ الطالب"}
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

      {/* List Column */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-md p-6 space-y-6">
        {/* Alerts / Success Banners */}
        <AnimatePresence>
          {successToast && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-100 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>{successToast}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800">قائمة الطلاب المسجلين</h3>
            <p className="text-xs text-slate-400">إدارة وعرض الطلاب المسجلين وتفاصيل قيدهم</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <button
              type="button"
              onClick={() => setShowCsvImporter(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-400" />
              استيراد جماعي (CSV)
            </button>
            <button
              type="button"
              onClick={() => {
                detectDuplicates();
                setShowDuplicateResolver(true);
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 text-slate-950" />
              فحص مكررات طلاب الأسرة
            </button>
          </div>
        </div>

        {/* Filters bar */}
        <div className={`grid grid-cols-1 ${currentUserRole === "receptionist" ? "md:grid-cols-2" : "md:grid-cols-3"} gap-4 pb-4 border-b border-slate-100`}>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث طلاب بالاسم، الكود، القيد..."
              className="w-full pl-4 pr-11 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:bg-white transition-all text-xs"
            />
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-600"
          >
            <option value="">جميع الصفوف المدرسية</option>
            <option value="KG1">KG1</option>
            <option value="KG2">KG2</option>
            <option value="الصف الأول">الصف الأول</option>
            <option value="الصف الثاني">الصف الثاني</option>
            <option value="الصف الثالث flex">الصف الثالث</option>
            <option value="الصف الثالث">الصف الثالث</option>
            <option value="الصف الرابع">الصف الرابع</option>
            <option value="الصف الخامس">الصف الخامس</option>
            <option value="الصف السادس">الصف السادس</option>
            <option value="الأول المتوسط">الأول المتوسط</option>
            <option value="الثاني المتوسط">الثاني المتوسط</option>
            <option value="الثالث المتوسط">الثالث المتوسط</option>
            <option value="الأول الثانوي">الأول الثانوي</option>
            <option value="الثاني الثانوي">الثاني الثانوي</option>
            <option value="الثالث الثانوي">الثالث الثانوي</option>
          </select>

          {currentUserRole !== "receptionist" && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-600 font-semibold"
            >
              <option value="">جميع فروع المدرسة (الكل)</option>
              <option value="فرع أول فيصل">🏛️ فرع أول فيصل</option>
              <option value="فرع الطالبة">🌸 فرع الطالبة</option>
            </select>
          )}
        </div>

        {/* Students Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 select-none">
                <th className="pb-3 text-xs font-bold">اسم الطالب</th>
                <th className="pb-3 text-xs font-bold">الكود</th>
                <th className="pb-3 text-xs font-bold">كود الفرع</th>
                <th className="pb-3 text-xs font-bold">الصف</th>
                <th className="pb-3 text-xs font-bold">الفرع</th>
                <th className="pb-3 text-xs font-bold">واتساب ولي الأمر</th>
                <th className="pb-3 text-xs font-bold">الحالة</th>
                <th className="pb-3 text-xs font-bold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400 text-xs">
                    لم يجد النظام أي نتيجة تتوافق مع مدخلات البحث.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => (
                  <tr
                    key={st.code}
                    className={`hover:bg-slate-50/55 transition-colors ${
                      st.suspended ? "bg-rose-50/20 text-rose-900" : ""
                    }`}
                  >
                    <td className="py-3.5 font-bold text-slate-900 truncate max-w-[150px]" title={st.name}>
                      {st.suspended && "🚫 "}
                      {st.name}
                    </td>
                    <td className="py-3.5 font-mono text-xs">{st.code}</td>
                    <td className="py-3.5 font-mono text-slate-500 text-xs">{st.id}</td>
                    <td className="py-3.5 text-xs font-semibold">{st.class}</td>
                    <td className="py-3.5 text-xs font-semibold">
                      {st.branch === "فرع الطالبة" ? (
                        <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded bg-rose-50 text-[10px] text-rose-700 border border-rose-100/60 shadow-sm leading-none">
                          🌸 فرع الطالبة
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded bg-blue-50 text-[10px] text-blue-700 border border-blue-100/60 shadow-sm leading-none">
                          🏛️ فرع أول فيصل
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 font-mono text-xs">{st.parentPhone || "—"}</td>
                    <td className="py-3.5">
                      {st.suspended ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700" title={st.suspendReason}>
                          موقوف
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          نشط
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 whitespace-nowrap">
                      <div className="flex gap-1.5 justify-center">
                        <button
                          onClick={() => setSelectedStudent(st)}
                          className="p-1 px-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                          title="استعراض البطاقة الكاملة"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => printIDCard(st)}
                          className="p-1 px-1.5 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                          title="طباعة بطاقة الهوية (A6)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => startEdit(st)}
                          className="p-1 px-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                          title="تعديل الحساب"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {st.suspended ? (
                          <button
                            onClick={() => removeSuspension(st)}
                            className="p-1 px-1.5 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                            title="إلغاء التوقيف"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => triggerSuspension(st)}
                            className="p-1 px-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                            title="إيقاف الطالب"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(st.code, st.name)}
                          className="p-1 px-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
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

      {/* Suspension explanation modal */}
      {suspensionTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md border border-slate-100 space-y-4">
            <div>
              <h3 className="text-md font-bold text-slate-800">إقرار إيقاف الطالب عن الحضور</h3>
              <p className="text-xs text-slate-400">سيمنع النظام تسجيل حضور هذا الطالب ويرسل جرس تنبيه للمشرفين</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">سبب الإيقاف عن الحضور اليومي</label>
              <textarea
                value={suspendReasonInput}
                onChange={(e) => setSuspendReasonInput(e.target.value)}
                placeholder="اكتب سبب التوقيف هنا بالتفصيل لتقديمه لولي الأمر..."
                rows={3}
                className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs focus:outline-none"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={saveSuspension}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all"
              >
                تطبيق الإيقاف
              </button>
              <button
                onClick={() => setSuspensionTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student complete detail card modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 text-sm font-bold">
                {selectedStudent.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">{selectedStudent.name}</h3>
                <span className="text-[10px] text-slate-400 font-mono">{selectedStudent.code}</span>
              </div>
            </div>

            <div className="text-xs space-y-2.5 text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span>كود الفرع:</span>
                <span className="font-bold text-slate-800">{selectedStudent.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span>الصف الدراسي:</span>
                <span className="font-bold text-slate-800">{selectedStudent.class}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span>الفرع الدراسي:</span>
                <span className="font-bold text-slate-800 text-indigo-700">{selectedStudent.branch || "فرع أول فيصل"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span>واتساب ولي الأمر:</span>
                <span className="font-bold text-slate-800 font-mono">{selectedStudent.parentPhone || "غير مسجل"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span>المعلم المشرف:</span>
                <span className="text-indigo-600 font-bold">معلم الصف الأساسي</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span>موعد الحضور اليومي:</span>
                <span className="font-mono font-bold text-slate-800">{selectedStudent.scheduledTime || "07:30"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span>الحالة المركزية:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedStudent.suspended ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {selectedStudent.suspended ? "موقوف" : "منتسب نشط"}
                </span>
              </div>
              {selectedStudent.suspended && (
                <div className="p-3 bg-rose-50 text-rose-800 rounded-xl">
                  <strong>سبب التوقيف المدون:</strong> {selectedStudent.suspendReason || "لم يدون سبب للوقف مسبقاً."}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Resolver Modal */}
      {showDuplicateResolver && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto p-6 space-y-6 relative text-right"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">مدير تنظيف وفحص مكررات طلاب الأسرة</h3>
                  <p className="text-xs text-slate-400 font-medium">يساعدك على العثور على حسابات الطلاب المكررة بالخطأ وتوحيد سجلاتها</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDuplicateResolver(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Duplicate List */}
            {duplicateGroups.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">النظام سليم ومكتمل بنسبة 100%</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">
                  لم يتم العثور على أي طلاب مكررين بنفس كود القيد أو بنفس الاسم ورقم العائلة في قاعدة البيانات السحابية.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-100 text-xs leading-relaxed font-semibold">
                  ⚠️ تنبيه هام: دمج الحسابات يقوم بإبقاء حساب واحد (الأول) وحذف الحسابات المكررة الأخرى مع نقل وإعادة توجيه كافة سجلات حضور الطالب المكرر تلقائياً لضمان عدم ضياع أي كشوفات حضور أو غياب سابقة.
                </div>

                <div className="space-y-4">
                  {duplicateGroups.map((group, groupIdx) => (
                    <div key={groupIdx} className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-slate-50/30">
                      {/* Group Header */}
                      <div className="bg-slate-100/80 px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            group.type === "same_id" 
                              ? "bg-indigo-100 text-indigo-700" 
                              : group.type === "same_name_phone" 
                              ? "bg-amber-100 text-amber-700" 
                              : "bg-purple-100 text-purple-700"
                          }`}>
                            {group.type === "same_id" 
                              ? "تكرار كود القيد الأكاديمي" 
                              : group.type === "same_name_phone" 
                              ? "تكرار الاسم ورقم العائلة (أخوة مكررين)" 
                              : "تكرار الاسم والصف الدراسي"}
                          </span>
                          <span className="text-xs font-bold text-slate-700 font-mono">{group.key}</span>
                        </div>
                        <span className="text-xs text-slate-500 font-bold">مجموع مكرر: {group.students.length} طلاب</span>
                      </div>

                      {/* Group Members Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-right border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 text-slate-400 border-b border-slate-100 font-semibold select-none">
                              <th className="p-3 text-right">اسم الطالب</th>
                              <th className="p-3 text-right">الصف الدراسي</th>
                              <th className="p-3 text-right">الكود الباركود</th>
                              <th className="p-3 text-right">كود القيد/الفرع</th>
                              <th className="p-3 text-right">جوال ولي الأمر</th>
                              <th className="p-3 text-right">الفرع</th>
                              <th className="p-3 text-center">الإجراء</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-600">
                            {group.students.map((student, sIdx) => {
                              const isFirst = sIdx === 0;
                              return (
                                <tr key={student.code} className={`hover:bg-slate-50 ${isFirst ? "bg-emerald-50/20" : ""}`}>
                                  <td className="p-3 font-semibold text-slate-800 flex items-center gap-1.5">
                                    {student.name}
                                    {isFirst && (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black leading-none">
                                        السجل الرئيسي (سيُحفظ)
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3">{student.class}</td>
                                  <td className="p-3 font-mono">{student.code}</td>
                                  <td className="p-3 font-mono">{student.id}</td>
                                  <td className="p-3 font-mono">{student.parentPhone || "—"}</td>
                                  <td className="p-3">{student.branch}</td>
                                  <td className="p-3 text-center">
                                    {isFirst ? (
                                      <span className="text-emerald-600 font-bold text-xs">رئيسي</span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (confirm(`هل تود بالتأكيد دمج الطالب المكرر (${student.name}) مع السجل الرئيسي؟ سيتم دمج كافة سجلات حضور الطالب المكرر وحذف هذا الحساب الإضافي نهائياً.`)) {
                                            if (onMergeStudents) {
                                              await onMergeStudents(group.students[0].code, student.code);
                                              setSuccessToast("تم دمج مكرر الطالب بنجاح ونقل جميع سجلات الحضور الخاصة به.");
                                              setTimeout(() => setSuccessToast(""), 4000);
                                            } else {
                                              alert("وظيفة الدمج غير متوفرة حالياً بالخادم الرئيسي.");
                                            }
                                          }
                                        }}
                                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-[10px] transition-all shadow-sm cursor-pointer"
                                      >
                                        دمج مع الرئيسي
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

              {/* Bottom bar */}
              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDuplicateResolver(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  إغلاق النافذة
                </button>
              </div>
          </motion.div>
        </div>
      )}

      {/* CSV Batch Importer Modal */}
      {showCsvImporter && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto p-6 space-y-6 relative text-right"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">استيراد جماعي مجمع للطلاب (Excel / CSV)</h3>
                  <p className="text-xs text-slate-400 font-medium">قم بنسخ ولصق جدول الطلاب مباشرة من إكسل أو ملف نصي مفرق بفواصل لتسجيلهم دفعة واحدة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCsvImporter(false);
                  setCsvTextInput("");
                  setParsedCsvStudents([]);
                  setCsvParseError("");
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Instruction Banner */}
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl space-y-2 text-xs leading-relaxed text-indigo-900">
              <div className="font-bold flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                تنسيق الأعمدة المعتمد (بالترتيب من اليسار إلى اليمين):
              </div>
              <p className="font-semibold text-slate-700">
                الكود الباركود <span className="text-indigo-600 font-bold">(إلزامي)</span> ، الاسم الكامل <span className="text-indigo-600 font-bold">(إلزامي)</span> ، كود القيد <span className="text-slate-400">(اختياري)</span> ، جوال ولي الأمر <span className="text-slate-400">(اختياري)</span> ، الصف الدراسي <span className="text-slate-400">(اختياري)</span> ، الفرع <span className="text-slate-400">(اختياري)</span> ، موعد الحضور اليومي <span className="text-slate-400">(اختياري)</span>
              </p>
              <div className="pt-1.5 font-mono text-[10px] bg-white/60 p-2.5 rounded-lg border border-indigo-100/50 text-slate-600 select-all">
                1001, أحمد محمد علي, B-1001, 0554321098, الصف الأول, {currentUserBranch || "فرع أول فيصل"}, 07:30
                <br />
                1002, سارة يوسف أحمد, B-1002, 0551112223, الصف الثاني, {currentUserBranch || "فرع أول فيصل"}, 07:30
              </div>
            </div>

            {/* Paste Textbox */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">ألصق البيانات هنا (ادعم الفواصل أو الفواصل المنقوطة أو علامات Tab للأعمدة المستوردة من Excel):</label>
              <textarea
                value={csvTextInput}
                onChange={(e) => setCsvTextInput(e.target.value)}
                placeholder="أدخل البيانات سطر بسطر هنا..."
                className="w-full h-36 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white text-xs font-mono leading-relaxed resize-none text-right"
                dir="rtl"
              />
            </div>

            {/* Actions for parse */}
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <button
                type="button"
                onClick={handleParseCsv}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                تحليل البيانات ومعاينتها
              </button>

              {parsedCsvStudents.length > 0 && !csvParseError && (
                <div className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  تم العثور على {parsedCsvStudents.length} طلاب جاهزين ومطابقين للمعايير!
                </div>
              )}
            </div>

            {/* Parse Errors or Results list */}
            {csvParseError && (
              <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{csvParseError}</span>
              </div>
            )}

            {parsedCsvStudents.length > 0 && !csvParseError && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 border-r-2 border-indigo-600 pr-2">معاينة قائمة الطلاب قبل الاستيراد الفعلي</h4>
                <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-[220px]">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 border-b border-slate-100 font-bold select-none">
                        <th className="p-2.5 text-right">الكود الباركود</th>
                        <th className="p-2.5 text-right">الاسم كامل</th>
                        <th className="p-2.5 text-right">كود القيد</th>
                        <th className="p-2.5 text-right">جوال ولي الأمر</th>
                        <th className="p-2.5 text-right">الصف الدراسي</th>
                        <th className="p-2.5 text-right">الفرع الدراسي</th>
                        <th className="p-2.5 text-right">موعد الحضور</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-600">
                      {parsedCsvStudents.map((st, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-mono font-bold text-slate-800">{st.code}</td>
                          <td className="p-2.5 font-semibold text-indigo-950">{st.name}</td>
                          <td className="p-2.5 font-mono text-slate-500">{st.id}</td>
                          <td className="p-2.5 font-mono">{st.parentPhone || "—"}</td>
                          <td className="p-2.5">{st.class}</td>
                          <td className="p-2.5 text-slate-500">{st.branch}</td>
                          <td className="p-2.5 font-mono text-slate-400">{st.scheduledTime}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Bottom buttons */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowCsvImporter(false);
                  setCsvTextInput("");
                  setParsedCsvStudents([]);
                  setCsvParseError("");
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                إلغاء وإغلاق
              </button>

              <button
                type="button"
                disabled={parsedCsvStudents.length === 0 || !!csvParseError || isImporting}
                onClick={handleExecuteImport}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-40 text-white font-black rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    جاري الاستيراد والتسجيل بالسحاب...
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    تأكيد واستيراد ({parsedCsvStudents.length}) طلاب دفعة واحدة
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
