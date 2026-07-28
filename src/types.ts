export interface Student {
  id: string; // Registration ID
  name: string;
  class: string;
  code: string; // Scan code
  parentPhone?: string;
  suspended?: boolean;
  suspendReason?: string;
  scheduledTime?: string; // e.g., "07:30"
  branch?: string; // School Branch (e.g., "فرع أول فيصل" | "فرع الطالبات" / "فرع الطالبة")
  createdAt?: string;
  updatedAt?: string;
}

export interface Employee {
  code: string; // Unique scan code
  name: string;
  attendanceTime: string; // Scheduled check-in time, e.g. "08:00"
  role?: "employee" | "receptionist"; // Role of employee
  branch?: string; // Associated branch
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceMeta {
  note?: string;
  late?: number; // Minutes delayed
  exception?: boolean; // Whether checked in under exception mode
}

export interface Attendance {
  id?: string; // Firestore document ID
  type: "student" | "employee";
  code: string;
  name: string;
  date: string; // YYYY-MM-DD
  arrival: string | null; // HH:MM
  departure: string | null; // HH:MM
  year: string; // Active academic year key (start_end)
  branch?: string; // Recorded branch for report filters
  meta?: AttendanceMeta;
  createdAt?: string;
  updatedAt?: string;
}

export interface Holiday {
  id?: string;
  type: "general" | "specific" | "class" | "group";
  studentCode?: string | null;
  studentCodes?: string[] | null; // For bulk group leave
  className?: string | null; // For bulk class leave
  reason: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  createdAt?: string;
  updatedAt?: string;
}

export interface AcademicYear {
  id?: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Settings {
  id?: string;
  parentMessage: string;
  sendWhatsapp: "enabled" | "disabled";
  provider: "ultramsg" | "twilio";
  ultraInstance?: string;
  ultraToken?: string;
  twilioFrom?: string;
  twilioEndpoint?: string;
  studentDayStart?: string;
  studentDayEnd?: string;
  employeeDayStart?: string;
  employeeDayEnd?: string;
  attendanceDeadline?: string;
  adminPassword?: string;
  schoolName?: string;
  branchPasswords?: Record<string, string>;
  branchPhones?: Record<string, string>;
  branchWhatsappInstances?: Record<string, string>;
  branchWhatsappTokens?: Record<string, string>;
  sendMode?: "auto" | "manual";
  sendOnRegister?: "yes" | "no";
  weekendDays?: number[]; // indices of weekend days e.g. [4, 5] for Thursday/Friday
  updatedAt?: string;
}
