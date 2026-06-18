# 📋 ملاحظات المطور — نظام إدارة المشرفين

## بيانات الاتصال

- **Supabase URL:** `https://hijmdaiwxhcrvxqmgxsy.supabase.co`
- **Supabase Anon Key:** `sb_publishable_np8rx4Ve9Rs0NN9Q6MbiEg_vUCVxlAe`
- **مجلد التطبيق:** `platform-admin/`
- **Workflow:** `cd platform-admin && npm run dev` — port 5000
- **السوبر أدمن:** username: `admin` / password: `Admin123`
- ⚠️ **قاعدة البيانات: Supabase فقط — لا تستخدم Replit PostgreSQL أبدًا**

---

## الجداول في Supabase

### جدول `users`
```
id, name (NOT NULL), full_name, username, password (bcrypt),
role (super_admin/admin), status (pending/approved/rejected),
phone, email, avatar_url, platform_id,
platform_uid, platform_nick, platform_avatar,
agency_id, device_fingerprint, ip_address,
approved_by, created_at, updated_at
```

### جدول `shifts`
```
id, user_id, shift_number (1-12), created_by, created_at
UNIQUE: (user_id, shift_number)
-- لا يوجد عمود date — الشيفتات ثابتة يومياً
```

### جدول `change_logs` ✅ موجود في Supabase
```
id (uuid), user_id (text FK→users.id), user_full_name (text),
change_type (text), old_value (text), new_value (text),
detected_at (timestamptz DEFAULT NOW())
```
- ⚠️ **مشكلة حالية:** RLS policy على `change_logs` تمنع الـ INSERT بالـ anon key
- **الخطأ:** `new row violates row-level security policy for table "change_logs"`
- **الحل المطلوب:** في Supabase SQL Editor شغّل:
```sql
ALTER TABLE public.change_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "change_logs_all" ON public.change_logs FOR ALL USING (true) WITH CHECK (true);
```

---

## الأدمن الـ17 وشيفتاتهم

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

## API المنصة الخارجية

- **URL:** `https://www.sayyouditto.com/pay/payermax/getInfo?no={platform_id}`
- **الحقول المهمة في الـ response:**
  - `uid` — ثابت، لا يتغير (هوية الشخص الحقيقي)
  - `erbanNo` — الرقم العام (platform_id) — يمكن لشخص آخر أخذه
  - `nick` — اسم المستخدم على المنصة (يتغير)
  - `avatar` — صورة الحساب (تتغير)
- ⚠️ الأرقام النصية (مثل `ghazal`) ترجع error 400 من الـ API — طبيعي

---

## الملفات الرئيسية

```
platform-admin/
├── server/
│   ├── routes.ts         ← كل الـ API endpoints
│   │   ├── fetchPlatformProfile()  ← جلب بيانات من API المنصة
│   │   ├── logChange()             ← تسجيل تغيير في change_logs
│   │   ├── runPlatformCheck()      ← فحص جميع الأدمن (مستقلة)
│   │   ├── GET /api/change-logs
│   │   ├── POST /api/change-logs/check-all
│   │   └── auto-check: setTimeout 10s + setInterval 60min
│   ├── storage.ts        ← SupabaseStorage class
│   └── index.ts          ← نقطة الدخول
├── client/src/
│   ├── pages/
│   │   ├── Admins.tsx          ← إدارة الأدمن + edit dialog
│   │   ├── ChangeLogs.tsx      ← سجل التغييرات (super admin only)
│   │   ├── Shifts.tsx
│   │   ├── MyShifts.tsx
│   │   └── Attendance.tsx
│   ├── components/
│   │   └── AppSidebar.tsx      ← "سجل التغييرات" في superAdminItems
│   ├── contexts/
│   │   └── LangContext.tsx     ← الترجمات
│   └── App.tsx                 ← الراوتينج
└── supabase/                   ← ملفات SQL (للمراجعة فقط، شغّلها في Supabase SQL Editor)
    ├── 01_initial_setup.sql
    ├── 02_add_missing_columns.sql
    ├── 03_seed_super_admin.sql
    ├── 04_add_username_password.sql
    ├── 05_seed_admins_and_shifts.sql
    ├── 06_remove_date_from_shifts.sql
    ├── 07_add_platform_id.sql
    └── 08_add_change_logs.sql  ← جدول change_logs + RLS (شغّله في Supabase SQL Editor)
```

---

## ما تم إنجازه ✅

1. **البنية الأساسية** — React + Express + TypeScript + Supabase + Arabic RTL
2. **نظام تسجيل الدخول** — JWT tokens، `auth_token` في localStorage
3. **إدارة الأدمن** — CRUD كامل، موافقة/رفض، تعديل البيانات
4. **ربط بالمنصة** — `platform_id` + جلب nick/avatar من API خارجي
5. **سجل التغييرات** (`change_logs`) — يسجل:
   - `name_change` — تغيير الاسم المحلي
   - `platform_id_change` — تغيير platform_id
   - `nick_change` — تغيير الاسم على المنصة
   - `avatar_change` — تغيير الصورة على المنصة
   - `uid_mismatch` — انتقال الرقم لشخص آخر
6. **فحص تلقائي** — كل 60 دقيقة + عند بدء السيرفر (10 ثوان)
7. **فحص يدوي** — زر "فحص الآن" في صفحة سجل التغييرات

---

## المشكلة الحالية 🔴 (آخر نقطة وقفنا عليها)

**RLS على جدول `change_logs` في Supabase تمنع الـ INSERT**

الـ check-all بيكتشف التغييرات (changesFound > 0) لكن الـ INSERT في Supabase بيفشل:
```
{"code":"42501","message":"new row violates row-level security policy for table \"change_logs\""}
```

**الحل (خطوة واحدة في Supabase SQL Editor):**
```sql
ALTER TABLE public.change_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "change_logs_all" ON public.change_logs FOR ALL USING (true) WITH CHECK (true);
```

بعد تشغيل هذا الـ SQL في Supabase → كل شيء هيشتغل تلقائيًا.

---

## ملاحظات تقنية مهمة

- `auth_token` هو المفتاح في localStorage (مش `token`)
- عمود `name` في جدول users هو NOT NULL — أي INSERT يجب أن يتضمنه
- `users_status_check` constraint — القيم: `pending/approved/rejected` فقط
- كلمات المرور مُشفّرة بـ bcrypt (10 rounds)
- `runPlatformCheck()` تتحقق من المستخدمين اللي عندهم `platform_id` أو `username` رقمي
- الـ `logChange()` يستخدم `const { error } = await supabase.insert(...)` (مش try-catch)
- ملفات SQL في `platform-admin/supabase/` للمراجعة فقط — شغّلها في Supabase SQL Editor يدويًا
