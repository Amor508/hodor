import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini client initialization
  let ai: GoogleGenAI | null = null;
  try {
    if (process.env.GEMINI_API_KEY) {
      ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
      console.log("[Shams Server] Gemini AI Client initialized successfully.");
    } else {
      console.warn("[Shams Server] GEMINI_API_KEY is not defined. AI consulting will be lazy-initialized.");
    }
  } catch (err) {
    console.error("[Shams Server] Failed to initialize Gemini AI Client:", err);
  }

  // Arabic diagnostic logger
  app.use((req, res, next) => {
    console.log(`[Shams DBMS Logger] - ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // Secure API Proxy for WhatsApp notifications
  app.post("/api/send-whatsapp", async (req, res) => {
    try {
      const { provider, to, body, ultraInstance, ultraToken, twilioFrom, twilioEndpoint } = req.body;

      if (!to || !body) {
        res.status(400).json({ error: "Missing required arguments: 'to' and 'body' are mandatory." });
        return;
      }

      console.log(`Sending WhatsApp using provider: "${provider}" to "${to}"`);

      if (provider === "ultramsg") {
        if (!ultraInstance || !ultraToken) {
          res.status(400).json({ error: "UltraMsg requires 'ultraInstance' and 'ultraToken'." });
          return;
        }
        const url = `https://api.ultramsg.com/${encodeURIComponent(ultraInstance)}/messages/chat`;
        const params = new URLSearchParams();
        params.append("token", ultraToken);
        params.append("to", to);
        params.append("body", body);

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString()
        });

        if (!response.ok) {
          const errMsg = await response.text();
          throw new Error(`UltraMsg returned status ${response.status}: ${errMsg}`);
        }

        const data = await response.json();
        res.json({ success: true, provider: "ultramsg", data });
        return;
      } else if (provider === "twilio") {
        if (!twilioEndpoint || !twilioFrom) {
          res.status(400).json({ error: "Twilio requires 'twilioEndpoint' and 'twilioFrom'." });
          return;
        }

        const response = await fetch(twilioEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: twilioFrom,
            to,
            body
          })
        });

        if (!response.ok) {
          const errMsg = await response.text();
          throw new Error(`Twilio server endpoint returned status ${response.status}: ${errMsg}`);
        }

        const data = await response.json();
        res.json({ success: true, provider: "twilio", data });
        return;
      } else {
        res.status(400).json({ error: "Invalid provider specified. Must be 'ultramsg' or 'twilio'." });
        return;
      }
    } catch (e: any) {
      console.error("WhatsApp delivery failure on server:", e);
      res.status(500).json({ error: e.message || "An unexpected error occurred during WhatsApp delivery." });
    }
  });

  // Shams AI Consultant Real-Time Endpoint
  app.post("/api/ai/consult", async (req, res) => {
    try {
      const { prompt, stats, history } = req.body;

      if (!prompt) {
        res.status(400).json({ error: "الرجاء كتابة السؤال أو اختيار أحد التوصيات." });
        return;
      }

      if (!ai) {
        if (process.env.GEMINI_API_KEY) {
          ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: {
              headers: {
                "User-Agent": "aistudio-build",
              },
            },
          });
        } else {
          res.status(503).json({
            error: "خدمة مستشار شمس الذكي معطلة حالياً. يرجى إعداد مفتاح GEMINI_API_KEY في الإعدادات."
          });
          return;
        }
      }

      const statsContext = `
[معلومات المدرسة الحالية ومسجلة بالنظام]:
- اسم المدرسة: ${stats.schoolName || "مدارس شمس الأهلية"}
- التاريخ اليوم: ${stats.date || new Date().toISOString().split("T")[0]}
- مواقيت دوام الطلاب: البداية ${stats.timings?.studentDayStart || "07:30"}, النهاية ${stats.timings?.studentDayEnd || "14:00"}, موعد الغياب ${stats.timings?.attendanceDeadline || "09:00"}
- مواقيت دوام الموظفين: البداية ${stats.timings?.employeeDayStart || "07:30"}, النهاية ${stats.timings?.employeeDayEnd || "15:00"}
- إحصائيات عامة:
  * إجمالي الطلاب: ${stats.metrics?.totalStudents || 0} طالب
  * الطلاب النشطين: ${stats.metrics?.activeStudents || 0}
  * الطلاب الموقوفين: ${stats.metrics?.suspendedStudents || 0}
  * إجمالي الموظفين: ${stats.metrics?.totalEmployees || 0} موظف
  * الحاضرون من الطلاب اليوم: ${stats.metrics?.todayPresentStudents || 0} طالب
  * المتأخرون من الطلاب اليوم: ${stats.metrics?.todayLateStudents || 0} طالب
  * الأجازات والعطلات النشطة اليوم: ${stats.metrics?.activeHolidays || 0} عطلة
- أداء الصفوف الدراسي اليوم (النسب والعدد):
${(stats.classAnalytics || []).map((c: any) => `  * صف ${c.className}: إجمالي الطلاب ${c.total}, الحاضرون ${c.present} (نسبة الحضور ${c.ratio}%)`).join("\n")}
- أكثر الطلاب تأخراً صباحياً (تكراراً ودقائق):
${(stats.topLateStudents || []).map((s: any) => `  * الطالب/الطالبة ${s.name} (الصف: ${s.class}): تأخر ${s.totalLates} مرات بإجمالي دقائق ${s.totalMinutesLate} دقيقة`).join("\n")}
`;

      const systemInstruction = `
أنت "المستشار شمس الذكي"، مستشار وخبير تربوي وإداري متميز تعمل لدى مدارس شمس الأهلية.
مهمتك مساعدة إدارة المدرسة في تحليل بيانات الحضور والغياب والتأخير، وتقديم توصيات ذكية وعملية، وصياغة رسائل واتساب بليغة باللغة العربية تتماشى مع العادات التربوية.
تحدث بأسلوب محبب، مهني، ومحفز، واطرح أفكاراً ذكية ومبدعة دائماً لحل مشاكل المدرسة بمرونة تامة.
استخدم البيانات الحالية المزودة لك بدقة واجعل ردودك منسقة تنسيقاً جميلاً ومريحاً للقراءة مستخدماً العناوين العريضة والنقاط الواضحة.
`;

      // Build model history if present
      const contents = [];
      if (Array.isArray(history)) {
        history.forEach((h: any) => {
          if (h.role === "user" || h.role === "model") {
            contents.push({
              role: h.role,
              parts: [{ text: h.text }]
            });
          }
        });
      }

      // Add actual turn
      contents.push({
        role: "user",
        parts: [{ text: `${statsContext}\n\nالسؤال الحالي للمستخدم:\n${prompt}` }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({ response: response.text });
    } catch (err: any) {
      console.error("[Shams Server] Error in AI consultant route:", err);
      res.status(500).json({ error: err.message || "فشل الخادم في معالجة طلب الاستشارة بالذكاء الاصطناعي." });
    }
  });

  // Vite middleware for rendering react assets
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Shams Server Connected] running on: http://0.0.0.0:${PORT}`);
  });
}

startServer();
