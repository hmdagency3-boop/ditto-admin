# 📋 ملاحظات المطور — نظام إدارة المشرفين

## بيانات الاتصال

- **Supabase URL:** `https://hijmdaiwxhcrvxqmgxsy.supabase.co`
- **Supabase Anon Key:** موجود في Replit Secrets بمفتاح `SUPABASE_ANON_KEY`
- **JWT Secret:** موجود في Replit Secrets بمفتاح `JWT_SECRET`
- **مجلد التطبيق:** `platform-admin/`
- **Workflow (dev):** `cd platform-admin && npm run dev` — port 5000
- **Workflow (production):** Build: `cd platform-admin && npm run build` / Run: `cd platform-admin && npm run start`
- **نوع الـ Deployment:** VM (مش static) — ضروري لأن setInterval يحتاج سيرفر دائم
- **السوبر أدمن:** username: `admin` / password: `Admin123`
- ⚠️ **قاعدة البيانات: Supabase فقط — لا تستخدم Replit PostgreSQL أو executeSql أبداً**

---

## الجداول في Supabase

### جدول `users`
```
id, name (NOT NULL), full_name, username, password (bcrypt),
role (super_admin/admin), status (pending/approved/rejected),
employment_status (active/dismissed DEFAULT 'active'),
phone, email, avatar_url, platform_id,
platform_uid, platform_nick, platform_avatar,
platform_extra (JSONB DEFAULT '{}'),  ← ⚠️ يحتاج تشغيل SQL رقم 09
agency_id, device_fingerprint, ip_address,
approved_by, created_at, updated_at
```

### جدول `shifts`
```
id, user_id, shift_number (1-12), created_by, created_at
UNIQUE: (user_id, shift_number)
-- لا يوجد عمود date — الشيفتات ثابتة يومياً
```

### جدول `change_logs`
```
id (uuid), user_id (text FK→users.id), user_full_name (text),
change_type (text), old_value (text), new_value (text),
detected_at (timestamptz DEFAULT NOW())
```

---

## ⚠️ SQL لازم يتشغّل في Supabase SQL Editor (مرة واحدة فقط)

```sql
-- 1. إضافة عمود platform_extra (للـ noble/vip/charm/exp/fans/country)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS platform_extra JSONB DEFAULT '{}'::jsonb;

-- 2. RLS policy لجدول change_logs (بدونها الـ INSERT بيفشل بـ error 42501)
ALTER TABLE public.change_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "change_logs_all" ON public.change_logs FOR ALL USING (true) WITH CHECK (true);
```

> الملف موجود في: `platform-admin/supabase/09_add_platform_extra.sql`

---

## الأدمن وشيفتاتهم

| الاسم | username | shift | platform_id |
|-------|----------|-------|-------------|
| غزل | ghazal | 4 | — |
| همس | hams | 5 | — |
| فراشة | farasha | 6 | — |
| أميرة | amira | 7 | — |
| يزن | yazan | 7 | — |
| نغم | nagham | 8 | — |
| جوهرة شرق | jowhara | 9 | — |
| سمكة | samaka | 9 | — |
| مزيكا | muzika | 9 | — |
| توتا | tota | 10 | — |
| أحمد | ahmed | 10 | — |
| وردة | warda | 11 | — |
| لولو | lolo | 11 | — |
| يوسف | youssef | 12 | 6038733 (uid=1266825) |
| خفاش | khuffash | 1 | — |
| روسي | russi | 2 | — |
| مساعدين | musa3deen | 3 | — |
| (بدون اسم) | 7364093 | — | username رقمي = platform_id (uid=281268) |

---

## APIs المنصة الخارجية

### بدون authentication (تعمل مباشرة)
| الـ Endpoint | الاستخدام |
|---|---|
| `GET https://www.sayyouditto.com/pay/payermax/getInfo?no={erbanNo}` | بيانات المستخدم الكاملة |
| `GET https://www.sayyouditto.com/user/v4/get?uid={uid}` | حالة الأونلاين + الحظر |
| نفس الاتنين يشتغلوا على dittoparty.com | — |

**الحقول المهمة في getInfo:**
- `uid` — ثابت، لا يتغير (هوية الشخص الحقيقي)
- `erbanNo` — الرقم العام (platform_id) — يمكن لشخص آخر أخذه
- `nick` — اسم المستخدم على المنصة (يتغير)
- `avatar` — صورة الحساب (تتغير)
- `nobleId/nobleName` — رتبة النبالة (null لمعظم المستخدمين)
- `vipId, charmLevel, experLevel, fansNum` — null لمعظم المستخدمين العاديين

### تحتاج Bearer Token من التطبيق
```
/level/getIdInfoV2     ← معلومات المستوى
/allrank/getLast       ← الترتيب
/svip/info             ← معلومات SVIP
/vip/list              ← قائمة VIP
/room/fans/club/getFansClubRankInfo  ← نادي المعجبين
/activity/invite/user/search         ← بحث مستخدمين
```
**كيف تحصل على الـ Token:**
- نصّب HTTP Toolkit على الكمبيوتر من `httptoolkit.com`
- وصّل الموبايل (Android) على نفس الـ WiFi
- اضغط "Android Device via QR Code" وامسح الـ QR من الموبايل
- افتح تطبيق sayyouditto وسجّل دخول
- شوف الـ token في tab Response لأي request

---

## ✅ ما تم إنجازه بالكامل

1. **البنية الأساسية** — React 18 + Express + TypeScript + Vite + Supabase + Arabic RTL
2. **نظام تسجيل الدخول** — JWT tokens، `auth_token` في localStorage
3. **إدارة الأدمن** — CRUD كامل، موافقة/رفض، تعديل البيانات، فصل/تفعيل (employment_status)
4. **ربط بالمنصة** — `platform_id` + جلب nick/avatar/country/noble من API خارجي
5. **سجل التغييرات (ChangeLogs)** — يسجّل:
   - `nick_change` — تغيير الاسم على المنصة
   - `avatar_change` — تغيير الصورة على المنصة
   - `uid_mismatch` — انتقال الرقم لشخص آخر
   - وأيضاً: noble, vip, charm, exp, fans, country عبر `platform_extra`
6. **فحص تلقائي** — كل **30 ثانية** + بعد 10 ثوان من بدء السيرفر
7. **فحص يدوي** — زر "فحص الآن" في صفحة سجل التغييرات
8. **خط خاص** — `.platform-nick` CSS class بـ Noto Sans Symbols 2 لعرض أسماء المنصة
9. **صفحة البحث** — بحث فردي + جماعي بـ vipId/charmLevel/experLevel/fansNum/nobleName
10. **ChangeLogs أيقونات** — Crown/Star/Zap/TrendingUp/Users/Globe لكل نوع تغيير

---

## 🔲 ما لم يُكتمل بعد

1. **SQL رقم 09** — تشغيل `ALTER TABLE users ADD COLUMN platform_extra` في Supabase
2. **RLS policy** — تشغيل policy على change_logs في Supabase (الـ INSERT بيفشل بدونها)
3. **Token المنصة** — ربط Bearer token للوصول للـ APIs المتقدمة (ranking/VIP/level)

---

## الملفات الرئيسية

```
platform-admin/
├── server/
│   ├── routes.ts         ← كل الـ API endpoints
│   │   ├── fetchPlatformProfile()  ← جلب بيانات من API المنصة (nick/avatar/noble/vip...)
│   │   ├── logChange()             ← تسجيل تغيير في change_logs
│   │   ├── runPlatformCheck()      ← فحص جميع الأدمن (كل 30 ثانية)
│   │   ├── GET /api/change-logs
│   │   ├── POST /api/change-logs/check-all
│   │   └── auto-check: setTimeout 10s + setInterval 30s
│   ├── storage.ts        ← SupabaseStorage class (Supabase client هنا)
│   └── index.ts          ← نقطة الدخول
├── client/src/
│   ├── pages/
│   │   ├── Admins.tsx            ← إدارة الأدمن + employment_status
│   │   ├── ChangeLogs.tsx        ← سجل التغييرات (super admin only)
│   │   ├── Search.tsx            ← بحث فردي/جماعي بـ API المنصة
│   │   ├── Ratings.tsx
│   │   ├── Warnings.tsx
│   │   ├── Shifts.tsx
│   │   ├── Attendance.tsx
│   │   └── SuperAdminDashboard.tsx
│   ├── components/
│   │   └── AppSidebar.tsx        ← "سجل التغييرات" في superAdminItems
│   ├── index.css                 ← .platform-nick class (Noto Sans Symbols 2)
│   └── App.tsx                   ← الراوتينج
├── client/index.html             ← Google Fonts (Noto Sans Symbols 2 مضاف هنا)
└── supabase/                     ← ملفات SQL (شغّلها يدوياً في Supabase SQL Editor)
    ├── 01_initial_setup.sql
    ├── 02_add_missing_columns.sql
    ├── 03_seed_super_admin.sql
    ├── 04_add_username_password.sql
    ├── 05_seed_admins_and_shifts.sql
    ├── 06_remove_date_from_shifts.sql
    ├── 07_add_platform_id.sql
    ├── 08_add_change_logs.sql
    └── 09_add_platform_extra.sql  ← ⚠️ لم يُشغَّل بعد
```

---

## ملاحظات تقنية مهمة

- `auth_token` هو المفتاح في localStorage (مش `token`)
- عمود `name` في جدول users هو NOT NULL — أي INSERT يجب أن يتضمنه
- `users_status_check` constraint — القيم المسموحة: `pending/approved/rejected` فقط
- كلمات المرور مُشفّرة بـ bcrypt (10 rounds)
- `runPlatformCheck()` تفحص المستخدمين اللي عندهم `platform_id` أو `username` رقمي
- كل جدول جديد في Supabase يحتاج RLS policy وإلا الـ anon key لن يستطيع INSERT
- الأرقام النصية (مثل `ghazal`) ترجع error 400 من API المنصة — طبيعي ومتوقع
- ملفات SQL في `platform-admin/supabase/` للمراجعة فقط — شغّلها في Supabase SQL Editor يدوياً
