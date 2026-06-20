import { schedule } from "@netlify/functions";
import { runPlatformCheck } from "../../platform-admin/server/routes";
import { storage } from "../../platform-admin/server/storage";

const handler = schedule("* * * * *", async () => {
  try {
    console.log("[scheduled-check] بدء الفحص الدوري...");
    const n = await runPlatformCheck(storage.supabase);
    console.log(`[scheduled-check] اكتمل — ${n} تغيير`);
  } catch (e) {
    console.error("[scheduled-check] خطأ:", e);
  }
  return { statusCode: 200 };
});

export { handler };
