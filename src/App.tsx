import React, { useState, useEffect } from "react";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  writeBatch
} from "firebase/firestore";
import { onAuthStateChanged, User, signInAnonymously } from "firebase/auth";
import {
  db,
  auth,
  authenticateWithGoogle,
  exitAuthentication,
  handleFirestoreError,
  OperationType
} from "./firebase";
import {
  Student,
  Employee,
  Attendance,
  Holiday,
  AcademicYear,
  Settings
} from "./types";
import { HomePanel } from "./components/HomePanel";
import { StudentsPanel } from "./components/StudentsPanel";
import { EmployeesPanel } from "./components/EmployeesPanel";
import { AttendancePanel } from "./components/AttendancePanel";
import { HolidaysPanel } from "./components/HolidaysPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { AdminPanel } from "./components/AdminPanel";
import { StudentPortal } from "./components/StudentPortal";
import { EmployeePortal } from "./components/EmployeePortal";
import { AiConsultantPanel } from "./components/AiConsultantPanel";
import {
  QrCode,
  Users,
  GraduationCap,
  Calendar,
  Lock,
  Contact,
  ClipboardCheck,
  Building,
  Power,
  ChevronRight,
  Shield,
  HelpCircle,
  BellRing,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface AppSession {
  role: "admin" | "receptionist" | "student" | "employee";
  code: string;
  name: string;
  branch?: string;
  id?: string; // registration central ID for students
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Custom persistent login session
  const [session, setSession] = useState<AppSession | null>(() => {
    const saved = sessionStorage.getItem("shams_school_session");
    return saved ? JSON.parse(saved) : null;
  });

  const [loginCode, setLoginCode] = useState("");
  const [loginError, setLoginError] = useState("");

  // Firestore Synchronized States
  const [students, setStudents] = useState<Student[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  // UI Navigation states
  const [activeTab, setActiveTab] = useState<string>("home");
  const [adminPasswordPrompt, setAdminPasswordPrompt] = useState(false);
  const [enteredAdminPassword, setEnteredAdminPassword] = useState("");
  const [adminPasswordError, setAdminPasswordError] = useState("");

  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");

  // Track state of global error banners
  const [globalError, setGlobalError] = useState("");

  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const isStudentOnWeekend = (dateStr: string) => {
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay(); // Sunday is 0, Monday is 1, Tuesday is 2, Wednesday is 3, Thursday is 4, Friday is 5, Saturday is 6
    const weekendDays = settings?.weekendDays || [4, 5]; // Default Thursday, Friday
    return weekendDays.includes(dayOfWeek);
  };

  const isStudentOnHoliday = (student: Student, dateStr: string) => {
    return holidays.some(h => {
      if (dateStr < h.start || dateStr > h.end) return false;
      if (h.type === "general") return true;
      if (h.type === "specific" && h.studentCode === student.code) return true;
      if (h.type === "class" && h.className === student.class) return true;
      if (h.type === "group" && h.studentCodes?.includes(student.code)) return true;
      return false;
    });
  };

  // Automatically sync selectedBranch when user session triggers or logs out
  useEffect(() => {
    if (session?.role === "receptionist" && session?.branch) {
      setSelectedBranch(session.branch);
    } else if (session?.role === "employee" && session?.branch) {
      setSelectedBranch(session.branch);
    } else if (session?.role === "student" && session?.branch) {
      setSelectedBranch(session.branch);
    } else {
      setSelectedBranch("all");
    }
  }, [session]);

  // Automatic student absent registration upon passing the attendance deadline
  useEffect(() => {
    if (!settings || students.length === 0) return;

    const checkAndMarkAbsences = () => {
      const todayStr = new Date().toISOString().split("T")[0];
      const savedDate = localStorage.getItem("shams_last_checked_absence_date");
      if (savedDate === todayStr) return; // Already triggered today

      // Parse deadline
      const deadline = settings.attendanceDeadline || "09:00";
      const [deadH, deadM] = deadline.split(":").map(Number);
      const now = new Date();
      const currMin = now.getHours() * 60 + now.getMinutes();
      const deadMin = deadH * 60 + deadM;

      if (currMin >= deadMin) {
        console.log("Automatic attendance deadline reached. Driving absence registrations...");
        markAbsencesForToday().then(() => {
          localStorage.setItem("shams_last_checked_absence_date", todayStr);
        }).catch(err => {
          console.error("Failed to automatically mark absences:", err);
        });
      }
    };

    // Run first check right after mount/data loads
    checkAndMarkAbsences();

    const timer = setInterval(checkAndMarkAbsences, 30000); // Check every 30 seconds
    return () => clearInterval(timer);
  }, [settings, students, attendance]);

  // Real-time clock and calendar updates (Arabic formatted)
  useEffect(() => {
    const updateTimeAndCalendar = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
      setDateStr(now.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
    };
    updateTimeAndCalendar();
    const interval = setInterval(updateTimeAndCalendar, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync authentication context state with silent anonymous sign in fallback
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currUser) => {
      if (!currUser) {
        signInAnonymously(auth)
          .then((cred) => {
            setUser(cred.user);
            setAuthLoading(false);
          })
          .catch((err) => {
            console.info("Silent anonymous registration bypassed, using guest profile: ", err.message);
            // Fallback to local guest user representation if anonymous authentication is disabled on the console
            setUser({ uid: "anonymous_guest_shams", isAnonymous: true } as any);
            setAuthLoading(false);
          });
      } else {
        setUser(currUser);
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Attach dynamic real-time Firestore listeners
  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, "students"), (snapshot) => {
      const list: Student[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as Student);
      });
      setStudents(list);
    }, (err) => {
      setGlobalError("خطأ مزامنة الطلاب السحابي: " + err.message);
    });

    const unsubEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
      const list: Employee[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as Employee);
      });
      setEmployees(list);
    }, (err) => {
      setGlobalError("خطأ مزامنة الموظفين السحابي: " + err.message);
    });

    const unsubAttendance = onSnapshot(collection(db, "attendance"), (snapshot) => {
      const list: Attendance[] = [];
      snapshot.forEach(d => {
        list.push({ ...d.data() as Attendance, id: d.id });
      });
      setAttendance(list);
    }, (err) => {
      setGlobalError("خطأ مزامنة سجل الحضور السحابي: " + err.message);
    });

    const unsubHolidays = onSnapshot(collection(db, "holidays"), (snapshot) => {
      const list: Holiday[] = [];
      snapshot.forEach(doc => {
        list.push({ ...doc.data() as Holiday, id: doc.id });
      });
      setHolidays(list);
    }, (err) => {
      setGlobalError("خطأ مزامنة الأجازات السحابي: " + err.message);
    });

    const unsubYears = onSnapshot(collection(db, "academicYears"), (snapshot) => {
      const list: AcademicYear[] = [];
      snapshot.forEach(doc => {
        list.push({ ...doc.data() as AcademicYear, id: doc.id });
      });
      setYears(list);
    }, (err) => {
      setGlobalError("خطأ مزامنة السنوات السحابي: " + err.message);
    });

    // settings singleton loader
    const unsubSettings = onSnapshot(doc(db, "settings", "global"), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as Settings);
      } else {
        const defaultSettings: Settings = {
          parentMessage: "نتمنى له يوماً موفقاً ويبعث البهجة بقلبنا",
          sendWhatsapp: "disabled",
          provider: "ultramsg",
          adminPassword: "123456789",
          branchPasswords: {
            "فرع أول فيصل": "faisal123",
            "فرع الطالبة": "taleba123"
          },
          studentDayStart: "07:30",
          studentDayEnd: "14:00",
          employeeDayStart: "07:30",
          employeeDayEnd: "15:00",
          attendanceDeadline: "09:00",
          sendMode: "manual",
          sendOnRegister: "no"
        };
        setDoc(doc(db, "settings", "global"), defaultSettings).catch(e => {
          setGlobalError("خطأ إنشاء الإعدادات الافتراضية: " + e.message);
        });
      }
    }, (err) => {
      setGlobalError("خطأ مزامنة الإعدادات السحابية: " + err.message);
    });

    return () => {
      unsubStudents();
      unsubEmployees();
      unsubAttendance();
      unsubHolidays();
      unsubYears();
      unsubSettings();
    };
  }, []);

  // Custom database single-code credential resolver
  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    const code = loginCode.trim();
    if (!code) {
      setLoginError("الرجاء إدخال كود الدخول الخاص بك الأول.");
      return;
    }

    // 1. General System Manager (Admin Control) Check
    const adminPass = settings?.adminPassword || "123456789";
    if (code === adminPass) {
      const adminSess: AppSession = {
        role: "admin",
        code: code,
        name: "مدير النظام العام"
      };
      setSession(adminSess);
      sessionStorage.setItem("shams_school_session", JSON.stringify(adminSess));
      setActiveTab("home");
      sessionStorage.setItem("shams_active_tab", "home");
      setLoginCode("");
      setLoginError("");
      return;
    }

    // 1.5. Branch Reception Password Check
    const branchPasswords = settings?.branchPasswords || {
      "فرع أول فيصل": "faisal123",
      "فرع الطالبة": "taleba123"
    };

    const matchedBranchName = Object.keys(branchPasswords).find(
      (bName) => branchPasswords[bName] === code
    );

    if (matchedBranchName) {
      const recepSess: AppSession = {
        role: "receptionist",
        code: code,
        name: `استقبال ${matchedBranchName}`,
        branch: matchedBranchName
      };
      setSession(recepSess);
      sessionStorage.setItem("shams_school_session", JSON.stringify(recepSess));
      setActiveTab("home");
      setLoginCode("");
      setLoginError("");
      return;
    }

    // 2. Central Students ID or Barcode matching Check
    const foundStudent = students.find(s => s.id === code || s.code === code);
    if (foundStudent) {
      if (foundStudent.suspended) {
        setLoginError(`🚫 الدخول مرفوض: تم إيقاف حساب هذا الطالب مؤقتاً. مبرر القرار: ${foundStudent.suspendReason || "غير محدد"}`);
        return;
      }
      const studentSess: AppSession = {
        role: "student",
        code: foundStudent.code,
        name: foundStudent.name,
        branch: foundStudent.branch || "فرع أول فيصل",
        id: foundStudent.id
      };
      setSession(studentSess);
      sessionStorage.setItem("shams_school_session", JSON.stringify(studentSess));
      setActiveTab("home");
      setLoginCode("");
      setLoginError("");
      return;
    }

    // 3. Central Employee Database Code Check
    const foundEmployee = employees.find(e => e.code === code);
    if (foundEmployee) {
      if (foundEmployee.role === "receptionist") {
        const recepSess: AppSession = {
          role: "receptionist",
          code: foundEmployee.code,
          name: foundEmployee.name,
          branch: foundEmployee.branch || "فرع أول فيصل"
        };
        setSession(recepSess);
        sessionStorage.setItem("shams_school_session", JSON.stringify(recepSess));
        setActiveTab("home");
        setLoginCode("");
        setLoginError("");
        return;
      } else {
        const empSess: AppSession = {
          role: "employee",
          code: foundEmployee.code,
          name: foundEmployee.name,
          branch: foundEmployee.branch || "فرع أول فيصل"
        };
        setSession(empSess);
        sessionStorage.setItem("shams_school_session", JSON.stringify(empSess));
        setActiveTab("home");
        setLoginCode("");
        setLoginError("");
        return;
      }
    }

    setLoginError("كود الدخول المدخل غير صحيح أو غير مسجل في الكشوف العامة لدينا.");
  };

  const handleLogout = async () => {
    sessionStorage.removeItem("shams_school_session");
    setSession(null);
    setActiveTab("home");
  };

  // Helper: check if a date is within active academic year range
  const getActiveYearAndValidate = () => {
    const active = years.find(y => y.active);
    if (!active) return null;
    const todayStr = new Date().toISOString().split("T")[0];
    if (todayStr >= active.start && todayStr <= active.end) {
      return active;
    }
    return null;
  };

  // Trigger dispatch to WhatsApp microservice Proxy
  const sendWhatsAppMessageProxy = async (phone: string, text: string, branchName?: string) => {
    if (!settings || settings.sendWhatsapp !== "enabled" || !phone) return;

    let finalInstance = settings.ultraInstance || "";
    let finalToken = settings.ultraToken || "";

    if (branchName) {
      if (settings.branchWhatsappInstances?.[branchName]) {
        finalInstance = settings.branchWhatsappInstances[branchName];
      }
      if (settings.branchWhatsappTokens?.[branchName]) {
        finalToken = settings.branchWhatsappTokens[branchName];
      }
    }

    try {
      const response = await fetch("/api/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.provider,
          to: phone,
          body: text,
          ultraInstance: finalInstance,
          ultraToken: finalToken,
          twilioFrom: settings.twilioFrom || "",
          twilioEndpoint: settings.twilioEndpoint || ""
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Network error");
      }
      console.log(`[Shams Whatsapp API] successfully routed notification to ${phone}`);
    } catch (e: any) {
      console.error("Failed sending WhatsApp Proxy notification:", e);
      setGlobalError("فشل إرسال إشعار ولي الأمر: " + e.message);
    }
  };

  // Core Mutation triggers synced immediately with Firestore
  const saveStudentToCloud = async (st: Student) => {
    try {
      await setDoc(doc(db, "students", st.code), st);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `students/${st.code}`);
    }
  };

  const deleteStudentFromCloud = async (code: string) => {
    try {
      await deleteDoc(doc(db, "students", code));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `students/${code}`);
    }
  };

  const mergeStudentsInCloud = async (keepCode: string, deleteCode: string) => {
    try {
      const batch = writeBatch(db);
      
      // 1. Find all attendance logs for the student to be deleted
      const deleteStudentLogs = attendance.filter(a => a.code === deleteCode);
      
      // 2. For each attendance log, update its code to keepCode, or delete it if keepCode already has one on the same date
      deleteStudentLogs.forEach(log => {
        const keepStudentHasLog = attendance.some(a => a.code === keepCode && a.date === log.date && a.type === log.type);
        if (log.id) {
          const logRef = doc(db, "attendance", log.id);
          if (keepStudentHasLog) {
            batch.delete(logRef);
          } else {
            batch.update(logRef, { code: keepCode });
          }
        }
      });
      
      // 3. Find and update holidays for deleteCode to keepCode
      const deleteHolidays = holidays.filter(h => h.studentCode === deleteCode);
      deleteHolidays.forEach(h => {
        if (h.id) {
          const holidayRef = doc(db, "holidays", h.id);
          batch.update(holidayRef, { studentCode: keepCode });
        }
      });
      
      // 4. Delete the student to be removed
      const studentToDeleteRef = doc(db, "students", deleteCode);
      batch.delete(studentToDeleteRef);
      
      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `students/merge/${keepCode}/${deleteCode}`);
    }
  };

  const saveEmployeeToCloud = async (emp: Employee) => {
    try {
      await setDoc(doc(db, "employees", emp.code), emp);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `employees/${emp.code}`);
    }
  };

  const deleteEmployeeFromCloud = async (code: string) => {
    try {
      await deleteDoc(doc(db, "employees", code));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `employees/${code}`);
    }
  };

  const deleteAttendanceFromCloud = async (id: string) => {
    try {
      await deleteDoc(doc(db, "attendance", id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `attendance/${id}`);
    }
  };

  const saveHolidayToCloud = async (hl: Holiday) => {
    try {
      await addDoc(collection(db, "holidays"), hl);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, "holidays");
    }
  };

  const deleteHolidayFromCloud = async (id: string) => {
    try {
      await deleteDoc(doc(db, "holidays", id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `holidays/${id}`);
    }
  };

  const addAcademicYearToCloud = async (yr: AcademicYear) => {
    try {
      await addDoc(collection(db, "academicYears"), yr);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, "academicYears");
    }
  };

  const setYearActiveInCloud = async (id: string) => {
    try {
      const batch = writeBatch(db);
      years.forEach((y) => {
        const ref = doc(db, "academicYears", y.id!);
        batch.update(ref, { active: y.id === id });
      });
      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `academicYears/${id}`);
    }
  };

  const deleteYearFromCloud = async (id: string) => {
    try {
      await deleteDoc(doc(db, "academicYears", id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `academicYears/${id}`);
    }
  };

  const saveSettingsToCloud = async (st: Settings) => {
    try {
      await setDoc(doc(db, "settings", "global"), st);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, "settings/global");
    }
  };

  // Perform Student attendance checkin register directly in Firestore
  const recordStudentAttendance = async (code: string, forceWithException: boolean = false) => {
    const s = students.find(item => item.code === code);
    if (!s) return;

    const todayStr = new Date().toISOString().split("T")[0];
    const hourStr = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: false });
    
    // Check if within active year
    const activeY = getActiveYearAndValidate();
    if (!activeY) {
      alert("الطلب معطل: تاريخ اليوم خارج مدى العام الدراسي النشط. راجع لوحة الإعدادات.");
      return;
    }

    // Verify holidays and weekends
    const isWeekend = isStudentOnWeekend(todayStr);
    const isOnHoliday = isStudentOnHoliday(s, todayStr);

    if ((isWeekend || isOnHoliday) && !forceWithException) {
      const msg = isWeekend 
        ? "اليوم يوم إجازة أسبوعية للطلاب. هل تود تسجيل الحضور كاستثناء للعمل أيام الإجازات؟ قم بتفعيل (وضع الاستثناءات) ثم المسح مرة أخرى." 
        : "اليوم مدرج كإجازة/عطلة رسمية للطالب. هل تود تسجيل حضور استثنائي؟ قم بتفعيل (وضع الاستثناءات) ثم المسح مرة أخرى.";
      alert(msg);
      return;
    }

    // Block scanning duplicate arrival registries
    const alreadyRegistered = attendance.find(a => a.code === s.code && a.date === todayStr && a.arrival);
    if (alreadyRegistered) {
      console.log(`[Shams App] student "${s.name}" already checked in today.`);
      return;
    }

    // Check attendance deadline limit (late arrivals exception)
    const deadline = settings?.attendanceDeadline || "09:00";
    const [deadH, deadM] = deadline.split(":").map(Number);
    const [cH, cM] = hourStr.split(":").map(Number);
    const minutesDeadline = deadH * 60 + deadM;
    const minutesCurrent = cH * 60 + cM;

    // If they arrived after deadline and exception mode is NOT enabled
    if (minutesCurrent > minutesDeadline && !forceWithException) {
      alert("تنبيه: لقد تجاوزت الموعد الأقصى المحدد لتسجيل الحضور اليومي للطلاب. يرجى مراجعة الإدارة أو تفعيل (وضع الاستثناءات) لتسجيل المتأخرين.");
      return;
    }

    // Calculate delay factor
    const baseline = s.scheduledTime || settings?.studentDayStart || "07:30";
    const [bH, bM] = baseline.split(":").map(Number);
    const minutesBaseline = bH * 60 + bM;
    const delta = minutesCurrent - minutesBaseline;
    const delay = delta > 0 ? delta : 0;

    let delayMsg = "";
    if (delay > 0) {
      delayMsg = `تأخير ${delay} دقيقة`;
    }

    if (forceWithException) {
      if (isWeekend) {
        delayMsg = "حضور استثنائي في يوم إجازة أسبوعية";
      } else if (isOnHoliday) {
        delayMsg = "حضور استثنائي في فترة عطلة";
      } else if (minutesCurrent > minutesDeadline) {
        delayMsg = `حضور متأخر باستثناء (${delay} دقيقة)`;
      } else {
        delayMsg = "حضور مسجل تحت وضع الاستثناءات";
      }
    }

    const docId = `${s.code}_${todayStr}`;
    const payload: Attendance = {
      type: "student",
      code: s.code,
      name: s.name,
      date: todayStr,
      arrival: hourStr,
      departure: null,
      year: `${activeY.start}_${activeY.end}`,
      branch: s.branch || session?.branch || "فرع أول فيصل",
      meta: {
        note: delayMsg || "منتظم بالوقت",
        late: delay,
        exception: forceWithException ? true : false
      }
    };

    try {
      await setDoc(doc(db, "attendance", docId), payload);
      
      // Auto whatsapp message alerts trigger
      if (settings?.sendWhatsapp === "enabled" && s.parentPhone) {
        const noticeText = `نحيطكم علماً بحضور الطالب/الطالبة (${s.name}) إلى المدرسة بتمام الساعة: ${hourStr}. ${settings.parentMessage}`;

        if (settings.sendMode === "manual") {
          // Manual prompt setup
          alert(`رقم ولي الأمر: ${s.parentPhone}\nنص رسالة المتلقي:\n${noticeText}`);
        } else {
          // Auto route on cloud thread
          await sendWhatsAppMessageProxy(s.parentPhone, noticeText, s.branch);
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `attendance/${docId}`);
    }
  };

  // Perform Employee attendance checkin/checkout triggers in Firestore
  const recordEmployeeAttendance = async (code: string) => {
    const e = employees.find(item => item.code === code);
    if (!e) return;

    const todayStr = new Date().toISOString().split("T")[0];
    const hourStr = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: false });

    const activeY = getActiveYearAndValidate();
    if (!activeY) {
      alert("الطلب معطل: لا يوجد عام دراسي نشط لليوم الجاري.");
      return;
    }

    const docId = `${e.code}_${todayStr}`;
    const existing = attendance.find(a => a.code === e.code && a.date === todayStr);

    if (!existing) {
      // Create first checkin register
      const baseline = e.attendanceTime || settings?.employeeDayStart || "08:00";
      const [bH, bM] = baseline.split(":").map(Number);
      const [cH, cM] = hourStr.split(":").map(Number);
      const delta = (cH * 60 + cM) - (bH * 60 + bM);
      const delay = delta > 0 ? delta : 0;
      
      const payload: Attendance = {
        type: "employee",
        code: e.code,
        name: e.name,
        date: todayStr,
        arrival: hourStr,
        departure: null,
        year: `${activeY.start}_${activeY.end}`,
        branch: e.branch || session?.branch || "فرع أول فيصل",
        meta: delay > 0 ? { note: `تأخير ${delay} دقيقة`, late: delay } : {}
      };

      try {
        await setDoc(doc(db, "attendance", docId), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `attendance/${docId}`);
      }
    } else {
      // If checked in, trigger checkout
      if (!existing.departure) {
        try {
          await setDoc(doc(db, "attendance", docId), {
            ...existing,
            departure: hourStr
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `attendance/${docId}`);
        }
      } else {
        if (confirm("الموظف مسجل حضور وانصراف من قبل اليوم. هل تود حذف الانصراف وتحديث الوصول بالوقت الحالي؟")) {
          try {
            await setDoc(doc(db, "attendance", docId), {
              ...existing,
              arrival: hourStr,
              departure: null
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `attendance/${docId}`);
          }
        }
      }
    }
  };

  // Run absences registers for all remaining student seats
  const markAbsencesForToday = async () => {
    const activeY = getActiveYearAndValidate();
    if (!activeY) return;

    const todayStr = new Date().toISOString().split("T")[0];

    // If today is a weekend, skip marking any automated absences
    if (isStudentOnWeekend(todayStr)) {
      console.log("[Shams App] Skip automatic absence generation: Today is a weekend day.");
      return;
    }

    const registeredCodes = attendance
      .filter(a => a.date === todayStr && a.arrival)
      .map(a => a.code);

    const absentStudents = students.filter(s => {
      // Exclude suspended students, already registered students, and students currently on holiday/leave
      return !s.suspended && !registeredCodes.includes(s.code) && !isStudentOnHoliday(s, todayStr);
    });

    if (absentStudents.length === 0) {
      console.log("[Shams App] No absent students to mark today.");
      return;
    }

    const batch = writeBatch(db);
    absentStudents.forEach((st) => {
      const docId = `${st.code}_${todayStr}`;
      const ref = doc(db, "attendance", docId);
      
      batch.set(ref, {
        type: "student",
        code: st.code,
        name: st.name,
        date: todayStr,
        arrival: null,
        departure: null,
        year: `${activeY.start}_${activeY.end}`,
        branch: st.branch || "فرع أول فيصل",
        meta: { note: "غائب" }
      });
    });

    await batch.commit();
  };

  // Bulk absences Dispatch WhatsApp alerts
  const sendBulkAbsenceMessages = async (absents: Student[]) => {
    const todayStr = new Date().toISOString().split("T")[0];
    for (const st of absents) {
      if (st.parentPhone) {
        const text = `تنبيه من إدارة المدرسة: نود إشعاركم بغياب الطالب/الطالبة (${st.name}) لليوم المكتوب الموافق ${todayStr}. نرجو إبداء المسببات للإشراف.`;
        await sendWhatsAppMessageProxy(st.parentPhone, text, st.branch);
      }
    }
  };

  // Clear school states
  const clearAllCollections = async () => {
    try {
      const collectionsToWipe = ["students", "employees", "attendance", "holidays", "academicYears"];
      
      for (const colName of collectionsToWipe) {
        const snap = await getDocs(collection(db, colName));
        const docsArray = snap.docs;
        
        // Process in chunks of 400 docs to avoid Firestore batch size limits (max 500)
        for (let i = 0; i < docsArray.length; i += 400) {
          const chunk = docsArray.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach((d) => {
            batch.delete(doc(db, colName, d.id));
          });
          await batch.commit();
        }
      }
    } catch (e: any) {
      console.error("Wipe failed:", e);
      throw new Error(`تعذر إنهاء التصفية الفورية بالسيرفر: ${e.message || e}`);
    }
  };

  // Construct structured data JSON download payload
  const compileBackupPayload = () => {
    return {
      students,
      employees,
      attendance,
      holidays,
      academicYears: years,
      settings: settings || {}
    };
  };

  // Batch restore of uploaded backups directly into Firestore
  const restoreDatabaseBackup = async (payload: any) => {
    try {
      // 1. Flush any prior registers in chunks to avoid size limits
      const collectionsToFlush = ["students", "employees", "attendance", "holidays", "academicYears"];
      for (const colName of collectionsToFlush) {
        const snap = await getDocs(collection(db, colName));
        const docsArray = snap.docs;
        for (let i = 0; i < docsArray.length; i += 400) {
          const chunk = docsArray.slice(i, i + 400);
          const deleteBatch = writeBatch(db);
          chunk.forEach((d) => {
            deleteBatch.delete(doc(db, colName, d.id));
          });
          await deleteBatch.commit();
        }
      }

      // 2. Add uploaded registers in chunked batched operations
      const writeOps: Array<{ ref: any; data: any }> = [];

      if (Array.isArray(payload.students)) {
        payload.students.forEach((st: any) => {
          const ref = doc(db, "students", st.code);
          writeOps.push({ ref, data: st });
        });
      }

      if (Array.isArray(payload.employees)) {
        payload.employees.forEach((emp: any) => {
          const ref = doc(db, "employees", emp.code);
          writeOps.push({ ref, data: emp });
        });
      }

      if (Array.isArray(payload.attendance)) {
        payload.attendance.forEach((att: any) => {
          const randId = att.id || `${att.code}_${att.date}`;
          const ref = doc(db, "attendance", randId);
          writeOps.push({ ref, data: att });
        });
      }

      if (Array.isArray(payload.holidays)) {
        payload.holidays.forEach((hl: any) => {
          const ref = doc(collection(db, "holidays"));
          writeOps.push({ ref, data: hl });
        });
      }

      if (Array.isArray(payload.academicYears)) {
        payload.academicYears.forEach((yr: any) => {
          const ref = yr.id ? doc(db, "academicYears", yr.id) : doc(collection(db, "academicYears"));
          writeOps.push({ ref, data: yr });
        });
      }

      if (payload.settings) {
        const ref = doc(db, "settings", "global");
        writeOps.push({ ref, data: payload.settings });
      }

      // Execute sets in batches of 400
      for (let i = 0; i < writeOps.length; i += 400) {
        const chunk = writeOps.slice(i, i + 400);
        const setBatch = writeBatch(db);
        chunk.forEach((op) => {
          setBatch.set(op.ref, op.data);
        });
        await setBatch.commit();
      }
    } catch (e: any) {
      throw new Error(`تعذر حفظ الدفعة بقاعدة الخادم: ${e.message}`);
    }
  };

  // Nav security check gating
  const verifyTabSecurity = (tabName: string) => {
    if (tabName === "admin") {
      setAdminPasswordPrompt(true);
      setEnteredAdminPassword("");
      setAdminPasswordError("");
    } else {
      setActiveTab(tabName);
    }
  };

  const handleAdminVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const correct = settings?.adminPassword || "123456789";
    if (enteredAdminPassword === correct) {
      setActiveTab("admin");
      setAdminPasswordPrompt(false);
      setEnteredAdminPassword("");
      setAdminPasswordError("");
    } else {
      setAdminPasswordError("كلمة السِر التي أدخلتها خاطئة. يرجى المحاولة بحرص.");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-500 font-sans">جاري مزامنة نظام شمس مع الخادم السحابي...</p>
        </div>
      </div>
    );
  }

  // Beautiful single-input custom session login gate
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans select-none" dir="rtl">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-xl p-8 text-center space-y-6 relative overflow-hidden">
          {/* Decorative halo */}
          <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/10 rounded-full blur-xl" />
          <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-indigo-500/10 rounded-full blur-xl" />

          <div className="space-y-2 relative">
            <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-amber-400 rounded-2xl mx-auto flex items-center justify-center shadow-lg text-white font-black text-2xl">
              {settings?.schoolName ? settings.schoolName.charAt(0) : "ش"}
            </div>
            <h1 className="text-xl font-black text-slate-800">{settings?.schoolName || "مجموعة مدارس شمس التعليمية"}</h1>
            <p className="text-xs text-slate-400 leading-relaxed px-4">
              نظام جرد وضبط حضور الطلاب والموظفين الموحد لكافة الفروع
            </p>
          </div>

          <form onSubmit={handleCustomLogin} className="space-y-4 relative text-right">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 mr-1">كلمة المرور / كود الدخول</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  autoFocus
                  dir="ltr"
                  placeholder="أدخل كلمة المرور أو كود الدخول..."
                  value={loginCode}
                  onChange={(e) => {
                    setLoginCode(e.target.value);
                    if (loginError) setLoginError("");
                  }}
                  className="w-full py-3.5 px-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-center text-sm font-bold font-mono text-slate-800 placeholder:text-slate-400 placeholder:font-sans focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none shadow-inner"
                />
              </div>
            </div>

            {loginError && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold border border-rose-100 leading-relaxed"
              >
                {loginError}
              </motion.div>
            )}

            <button
              type="submit"
              className="w-full py-4 bg-indigo-600 font-extrabold hover:bg-indigo-700 text-white rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
            >
              تسجيل الدخول للنظام
            </button>
          </form>

          <p className="text-[10px] text-slate-400 select-none font-mono">
            Shams DBMS — Multi-Branch Edition v2026.1
          </p>
          </div>
      </div>
    );
  }

  // Standalone portals for Students and standard Employees
  if (session.role === "student") {
    return (
      <StudentPortal
        session={session}
        attendance={attendance}
        onLogout={handleLogout}
        timeStr={timeStr}
        dateStr={dateStr}
        schoolName={settings?.schoolName}
        branchPhone={settings?.branchPhones?.[session.branch || "فرع أول فيصل"]}
      />
    );
  }

  if (session.role === "employee") {
    return (
      <EmployeePortal
        session={session}
        attendance={attendance}
        onLogout={handleLogout}
        timeStr={timeStr}
        dateStr={dateStr}
        branchPhone={settings?.branchPhones?.[session.branch || "فرع أول فيصل"]}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-12">
      {/* Global alert bar */}
      <AnimatePresence>
        {globalError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-rose-650 text-white p-3.5 text-center text-xs font-bold leading-relaxed flex items-center justify-between px-6 border-b border-rose-700"
          >
            <span>🚨 تنبيه حرج الخادم: {globalError}</span>
            <button
              onClick={() => setGlobalError("")}
              className="px-2.5 py-0.5 bg-rose-800 hover:bg-rose-900 font-sans rounded text-[10px]"
            >
              موافق
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header bar */}
      <header className="bg-slate-900 text-white py-4 shadow-lg sticky top-0 z-40 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-amber-500 to-amber-400 rounded-xl text-white font-black text-lg flex items-center justify-center">
              {settings?.schoolName ? settings.schoolName.charAt(0) : "ش"}
            </div>
            <div>
              <h1 className="text-md font-black tracking-tight text-amber-400">
                {settings?.schoolName || "شَمْس — نِظَام إِدَارَة المَدْرَسَة"}
              </h1>
              <span className="text-[10px] text-slate-400 block tracking-normal">
                ضبط فوري للطلاب والموظفين متزامن سحابياً
              </span>
            </div>
          </div>

          {/* DateTime Display */}
          <div className="hidden lg:flex items-center gap-6 text-xs text-slate-350 select-none">
            <div className="text-right">
              <span className="text-amber-400 font-bold block">{timeStr}</span>
              <span className="text-[10px] text-slate-400">{dateStr}</span>
            </div>
          </div>

          {/* Custom Branch Selector / Indicator */}
          <div className="flex items-center gap-2">
            {session && (
              <div className="flex items-center gap-2 bg-slate-850 py-1.5 px-3 rounded-full border border-slate-800 text-xs">
                <Building className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">الفرع:</span>
                {session.role === "admin" ? (
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="bg-transparent text-white font-black text-[11px] border-none focus:outline-none cursor-pointer pr-4 font-sans focus:ring-0"
                  >
                    <option value="all" className="bg-slate-900 text-slate-200">كل الفروع</option>
                    {Array.from(
                      new Set([
                        ...Object.keys(settings?.branchPasswords || {}),
                        ...students.map((s) => s.branch).filter(Boolean),
                        ...employees.map((e) => e.branch).filter(Boolean)
                      ])
                    ).map((b) => (
                      <option key={b} value={b} className="bg-slate-900 text-slate-200">
                        {b}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-white font-black text-[11px]">
                    {session.branch || "غير محدد"}
                  </span>
                )}
              </div>
            )}

            {/* Custom Session User Info */}
            <div className="flex items-center gap-3 bg-slate-850 py-1.5 px-3 rounded-full border border-slate-800">
            <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold leading-none ${session?.role === 'admin' ? 'bg-amber-500' : 'bg-indigo-600'}`}>
              {session?.role === 'admin' ? 'م' : 'س'}
            </div>
            <div className="text-right leading-none max-w-[150px] hidden md:block">
              <span className="text-[10px] font-bold text-slate-200 block truncate">{session?.name}</span>
              <span className="text-[9px] text-amber-400 block truncate mt-0.5 font-bold">
                {session?.role === 'admin' ? 'مدير النظام (جميع الفروع)' : `استقبال: ${session?.branch}`}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 px-2.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
              title="تسجيل الخروج"
            >
              <Power className="w-3 h-3 text-rose-500" />
              خروج
            </button>
          </div>
          </div>
        </div>
      </header>

      {/* Tabs navigation panel menu */}
      <nav className="bg-white border-b border-slate-200/80 sticky top-[73px] z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-2 overflow-x-auto py-2.5 scrollbar-none">
            <button
              onClick={() => verifyTabSecurity("home")}
              className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "home" ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <QrCode className="w-4 h-4" />
              الرئيسية
            </button>

            <button
              onClick={() => verifyTabSecurity("student")}
              className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "student" ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              الطلاب ({
                session?.role === "receptionist" && session?.branch
                  ? students.filter(s => s.branch === session.branch).length
                  : students.length
              })
            </button>

            <button
              onClick={() => verifyTabSecurity("employee")}
              className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "employee" ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Users className="w-4 h-4" />
              الموظفين ({
                session?.role === "receptionist" && session?.branch
                  ? employees.filter(e => e.branch === session.branch).length
                  : employees.length
              })
            </button>

            <button
              onClick={() => verifyTabSecurity("attendance")}
              className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "attendance" ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              سجل الحضور ({
                session?.role === "receptionist" && session?.branch
                  ? attendance.filter(a => a.branch === session.branch).length
                  : attendance.length
              })
            </button>

            {session?.role === "admin" && (
              <>
                <button
                  onClick={() => verifyTabSecurity("holidays")}
                  className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                    activeTab === "holidays" ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  الإجازات ({holidays.length})
                </button>

                <button
                  onClick={() => verifyTabSecurity("ai")}
                  className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                    activeTab === "ai" ? "bg-amber-500 text-slate-950 font-black shadow-sm" : "bg-amber-50 text-amber-800 hover:bg-amber-100/80"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  مستشار شمس الذكي (AI)
                </button>

                <button
                  onClick={() => verifyTabSecurity("settings")}
                  className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                    activeTab === "settings" ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  الإعدادات
                </button>

                <button
                  onClick={() => verifyTabSecurity("admin")}
                  className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                    activeTab === "admin" ? "bg-rose-650 text-white shadow-sm" : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  لوحة الإدارة
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main workspace container wrapper */}
      <main className="max-w-7xl mx-auto px-4 mt-6 flex-1 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === "home" && (
              <HomePanel
                students={students}
                employees={employees}
                attendance={attendance}
                holidays={holidays}
                years={years}
                settings={settings}
                onRecordStudent={recordStudentAttendance}
                onRecordEmployee={recordEmployeeAttendance}
                currentUserRole={session?.role}
                currentUserBranch={session?.role === "admin" ? selectedBranch : (session?.branch || "all")}
              />
            )}

            {activeTab === "student" && (
              <StudentsPanel
                students={students}
                onSaveStudent={saveStudentToCloud}
                onDeleteStudent={deleteStudentFromCloud}
                onMergeStudents={mergeStudentsInCloud}
                currentUserRole={session?.role}
                currentUserBranch={session?.role === "admin" ? selectedBranch : (session?.branch || "all")}
              />
            )}

            {activeTab === "employee" && (
              <EmployeesPanel
                employees={employees}
                onSaveEmployee={saveEmployeeToCloud}
                onDeleteEmployee={deleteEmployeeFromCloud}
                onRecordEmployeeAttendance={recordEmployeeAttendance}
                currentUserRole={session?.role}
                currentUserBranch={session?.role === "admin" ? selectedBranch : (session?.branch || "all")}
              />
            )}

            {activeTab === "attendance" && (
              <AttendancePanel
                attendance={attendance}
                onDeleteAttendanceRecord={deleteAttendanceFromCloud}
                settings={settings}
                currentUserRole={session?.role}
                currentUserBranch={session?.branch}
                students={students}
                employees={employees}
                holidays={holidays}
              />
            )}

            {activeTab === "holidays" && (
              <HolidaysPanel
                holidays={holidays}
                students={students}
                onSaveHoliday={saveHolidayToCloud}
                onDeleteHoliday={deleteHolidayFromCloud}
              />
            )}

            {activeTab === "ai" && (
              <AiConsultantPanel
                students={students}
                employees={employees}
                attendance={attendance}
                holidays={holidays}
                years={years}
                settings={settings}
              />
            )}

            {activeTab === "settings" && (
              <SettingsPanel
                years={years}
                settings={settings}
                onSaveSettings={saveSettingsToCloud}
                onAddYear={addAcademicYearToCloud}
                onSetActiveYear={setYearActiveInCloud}
                onDeleteYear={deleteYearFromCloud}
                fullBackupTrigger={compileBackupPayload}
                onBatchRestore={restoreDatabaseBackup}
              />
            )}

            {activeTab === "admin" && (
              <AdminPanel
                students={students}
                employees={employees}
                attendance={attendance}
                holidays={holidays}
                years={years}
                settings={settings}
                selectedBranch={selectedBranch}
                setSelectedBranch={setSelectedBranch}
                onClearAllData={clearAllCollections}
                onMarkAbsencesForToday={markAbsencesForToday}
                onSendBulkAbsenceMessages={sendBulkAbsenceMessages}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Admin Password verification Modal Gate */}
      {adminPasswordPrompt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-sm border border-slate-100 text-center space-y-4 font-sans">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full mx-auto flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-md font-bold text-slate-800">بوابة الدخول لقسم الإدارة العامة</h3>
              <p className="text-[10px] text-slate-400">يرجى كتابة رمز المرور السري للدخول للقسم المحمي</p>
            </div>

            {adminPasswordError && (
              <div className="p-2.5 bg-rose-50 text-rose-700 rounded-xl text-[10px] font-bold border border-rose-100">
                {adminPasswordError}
              </div>
            )}

            <form onSubmit={handleAdminVerify} className="space-y-3">
              <input
                type="password"
                required
                autoFocus
                value={enteredAdminPassword}
                onChange={(e) => setEnteredAdminPassword(e.target.value)}
                placeholder="أدخل كلمة مرور المسؤول..."
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono focus:bg-white text-xs"
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors"
                >
                  تحقق ودخول
                </button>
                <button
                  type="button"
                  onClick={() => setAdminPasswordPrompt(false)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
