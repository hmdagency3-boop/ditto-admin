---
name: ما تم إنجازه وما تبقى
description: ملخص شامل لحالة المشروع — يُقرأ عند التبديل لأكونت جديد
---

# نظام إدارة المشرفين — حالة المشروع

## 🎯 الهدف العام
نظام ويب لإدارة مشرفي منصة sayyouditto.com — يشمل الحضور، الورديات، التحذيرات، التقييمات، ومراقبة تغييرات البروفايل على المنصة. يعمل 24/7 على Replit VM.

---

## ✅ ما تم إنجازه بالكامل

### 1. البنية الأساسية
- Express.js + React 18 + TypeScript + Vite في `platform-admin/`
- Supabase PostgreSQL كقاعدة بيانات
- Auth بـ JWT (bcryptjs + jsonwebtoken) — super admin: `admin / Admin123`
- Tailwind + shadcn/ui للتصميم
- RTL عربي كامل

### 2. الصفحات المكتملة
- **Admins** — إضافة/تعديل/فصل/تفعيل المشرفين + employment_status
- **Attendance** — تسجيل الحضور والغياب
- **Shifts** — إدارة الورديات
- **Warnings** — التحذيرات
- **Ratings** — التقييمات
- **Search** — البحث بالرقم أو الاسم عبر API المنصة
- **ChangeLogs** — سجل تغييرات البروفايل على المنصة
- **SuperAdminDashboard** — لوحة تحكم الـ super admin

### 3. مراقبة المنصة (Platform Check)
- `runPlatformCheck()` في `routes.ts` تشتغل كل **30 ثانية** + 10 ثوان عند البدء
- تفحص: تغيير الاسم (nick_change)، تغيير الصورة (avatar_change)، تغيير الرقم لشخص آخر (uid_mismatch)
- تفحص أيضاً: noble، vip، charm، exp، fans، country عبر عمود `platform_extra` (JSONB)
- API المنصة: `GET https://www.sayyouditto.com/pay/payermax/getInfo?no={platform_id}`
- API ثانوي: `GET https://www.sayyouditto.com/user/v4/get?uid={uid}` — يرجع onLine + ban

### 4. عرض بيانات المنصة
- CSS class `.platform-nick` بخط Noto Sans Symbols 2 لعرض أسماء المنصة بشكل صحيح
- مطبّق على: Ratings, Warnings, Attendance, Admins, SuperAdminDashboard, Shifts, ChangeLogs
- ChangeLogs بيعرض أيقونات مخصصة لكل نوع تغيير (Crown, Star, Zap, TrendingUp, Users, Globe)

### 5. صفحة البحث (Search)
- بحث فردي + بحث جماعي (batch)
- يجلب من sayyouditto.com: vipId, charmLevel, experLevel, fansNum, nobleName
- يجلب من dittoparty.com: onLine, ban, chatGift
- عرض بادجات ملونة للـ VIP ⭐، charm ⚡، exp 📈، noble 👑

### 6. Deployment
- نوع VM (مش static) — لأن setInterval يحتاج سيرفر دائم
- Build: `cd platform-admin && npm run build`
- Run: `cd platform-admin && npm run start`
- تم إصلاح مشكلة `publicDir = "admin-panel/dist"` القديمة في `.replit`

---

## ⚠️ ما يحتاج تشغيل يدوي في Supabase SQL Editor

### SQL لازم يتشغّل (مرة واحدة فقط)

```sql
-- 1. إضافة عمود platform_extra (للـ noble/vip/charm/exp/fans/country)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS platform_extra JSONB DEFAULT '{}'::jsonb;

-- 2. RLS policy لجدول change_logs
ALTER TABLE public.change_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "change_logs_all" ON public.change_logs FOR ALL USING (true) WITH CHECK (true);
```

الملف موجود في: `platform-admin/supabase/09_add_platform_extra.sql`

---

## 🔲 ما لم يُكتمل بعد

### Token المنصة
- كل الـ APIs على sayyouditto.com اللي بتعطي بيانات تفصيلية (ranking, level, VIP info, fans) تطلب **Bearer token** مستخدم مسجّل
- الـ token يتحصل من: HTTP Toolkit على Android + نفس الـ WiFi مع الكمبيوتر
- بعد الحصول على الـ token: يُضاف في environment variable ويُستخدم في routes.ts
- **الـ APIs المكتشفة اللي تحتاج token:**
  - `/level/getIdInfoV2?no=` — معلومات المستوى
  - `/allrank/getLast` — الترتيب
  - `/svip/info` — معلومات SVIP
  - `/vip/list` — قائمة VIP
  - `/room/fans/club/getFansClubRankInfo` — ترتيب نادي المعجبين
  - `/activity/invite/user/search` — بحث مستخدمين

### حقول platform_extra
- الحقول (noble, vip, charm, exp, fans, country) بترجع `null` لمعظم المستخدمين العاديين
- ستكون مفيدة فقط بعد ربط الـ token (بيانات حقيقية)
- قرار: إبقاؤها في الكود حالياً دون حذف

---

## 📁 الملفات الرئيسية

| الملف | الوصف |
|-------|-------|
| `platform-admin/server/routes.ts` | كل الـ API endpoints + runPlatformCheck |
| `platform-admin/server/storage.ts` | Supabase client + CRUD operations |
| `platform-admin/client/src/pages/` | كل صفحات الواجهة |
| `platform-admin/client/src/index.css` | `.platform-nick` CSS class |
| `platform-admin/supabase/` | SQL migrations (01 → 09) |
| `platform-admin/client/index.html` | Google Fonts (Noto Sans Symbols 2) |

---

## 🔑 Environment Variables (في Replit Secrets)
- `SUPABASE_URL` — رابط مشروع Supabase
- `SUPABASE_ANON_KEY` — مفتاح anon (JWT)
- `JWT_SECRET` — سر تشفير JWT للـ admin auth

---

## 🌐 APIs المتاحة بدون token

| الـ Endpoint | الاستخدام |
|---|---|
| `GET /pay/payermax/getInfo?no={erbanNo}` | بيانات المستخدم الأساسية |
| `GET /user/v4/get?uid={uid}` | حالة الأونلاين + الحظر |

كلاهما يعمل على sayyouditto.com وdittoparty.com
