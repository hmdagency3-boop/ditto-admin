# 📋 ملاحظات المطور — نظام إدارة المشرفين

## ما تم إنجازه حتى الآن

### 1. البنية العامة
- تطبيق React + Express.js + TypeScript
- قاعدة بيانات: Supabase (PostgreSQL)
- مجلد التطبيق: `platform-admin/`
- الـ workflow: `cd platform-admin && npm run dev` على بورت 5000

### 2. بيانات الاتصال بـ Supabase
- SUPABASE_URL و SUPABASE_ANON_KEY موجودين كـ secrets في Replit
- الـ fallback موجود في `platform-admin/server/storage.ts`
- Supabase project URL: `https://hijmdaiwxhcrvxqmgxsy.supabase.co`

### 3. ملفات SQL المنجزة (في `platform-admin/supabase/`)
| الملف | الوصف | تم تشغيله؟ |
|-------|-------|-----------|
| `01_initial_setup.sql` | إنشاء الجداول الأساسية | ✅ |
| `02_add_missing_columns.sql` | إضافة أعمدة ناقصة | ✅ |
| `03_seed_super_admin.sql` | إنشاء حساب السوبر أدمن | ✅ |
| `04_add_username_password.sql` | إضافة أعمدة username/password | ✅ |
| `05_seed_admins_and_shifts.sql` | إضافة الأدمن الـ17 وشيفتاتهم | ✅ |
| `06_remove_date_from_shifts.sql` | حذف عمود التاريخ من الشيفتات | ✅ |
| `07_add_platform_id.sql` | إضافة عمود platform_id | ❌ **لم يُشغَّل بعد** |

### 4. بيانات تسجيل الدخول
- **السوبر أدمن:** username: `admin` / password: `Admin123`
- **الأدمن العاديون:** كلمة المرور الافتراضية: `Admin123`

### 5. schema جدول users
```
id, name (NOT NULL), full_name, username, password (bcrypt),
role (super_admin/admin), status (pending/approved/rejected),
phone, email, avatar_url, platform_id (مضاف في 07),
agency_id, device_fingerprint, ip_address,
approved_by, created_at, updated_at
```

### 6. schema جدول shifts (بعد تعديل 06)
```
id, user_id, shift_number (1-12), created_by, created_at
-- لا يوجد عمود date — الشيفتات ثابتة يومياً
UNIQUE: (user_id, shift_number)
```

### 7. الأدمن الـ17 وشيفتاتهم
| الاسم | username | shift_number | الوقت |
|-------|----------|-------------|-------|
| غزل | ghazal | 4 | 6-8 ص |
| همس | hams | 5 | 8-10 ص |
| فراشة | farasha | 6 | 10-12 ص |
| أميرة | amira | 7 | 12-2 م |
| يزن | yazan | 7 | 12-2 م |
| نغم | nagham | 8 | 2-4 م |
| جوهرة شرق | jowhara | 9 | 4-6 م |
| سمكة | samaka | 9 | 4-6 م |
| مزيكا | muzika | 9 | 4-6 م |
| توتا | tota | 10 | 6-8 م |
| أحمد | ahmed | 10 | 6-8 م |
| وردة | warda | 11 | 8-10 م |
| لولو | lolo | 11 | 8-10 م |
| يوسف | youssef | 12 | 10-12 ل |
| خفاش | khuffash | 1 | 12-2 ص |
| روسي | russi | 2 | 2-4 ص |
| مساعدين | musa3deen | 3 | 4-6 ص |

---

## ما كان يُنفَّذ لحظة انقطاع الكريديت

### المهمة: ربط الأدمن بحساباتهم في المنصة الخارجية

**المطلوب:**
1. كل أدمن يملك `platform_id` — وهو الـ ID الخاص بحسابه في المنصة (sayyouditto.com)
2. هذا الـ ID يُستخدم لجلب صورته واسمه من API: `https://www.sayyouditto.com/pay/payermax/getInfo?no={platform_id}`
3. السوبر أدمن يقدر يعدل بيانات أي أدمن من لوحة التحكم

**ما تم:**
- ✅ ملف SQL `07_add_platform_id.sql` جاهز (يضيف عمود `platform_id` لجدول users)
- ✅ Backend: إضافة endpoint `PATCH /api/users/:id` في `platform-admin/server/routes.ts` (السطر ~290)
  - يقبل: `full_name`, `phone`, `platform_id`, `password` (اختياري)
  - يتطلب: token + super_admin role

**ما لم يتم بعد (المتبقي):**
- ❌ تشغيل `07_add_platform_id.sql` في Supabase SQL Editor
- ❌ تعديل `platform-admin/client/src/pages/Admins.tsx`:
  - إضافة `platform_id` للـ `UserInfo` interface
  - إضافة زر "تعديل" بجانب زر "حذف" في DropdownMenu
  - إنشاء Dialog لتعديل البيانات بحقول: full_name, phone, platform_id, password (اختياري)
  - استدعاء `PATCH /api/users/:id`
- ❌ تعديل `fetchUserProfile` في Admins.tsx و Shifts.tsx:
  - استبدال `admin.username` بـ `admin.platform_id || admin.username`
  - الملف: `platform-admin/client/src/lib/userProfileService.ts`

---

## الملفات الرئيسية

```
platform-admin/
├── server/
│   ├── routes.ts          ← كل الـ API endpoints
│   ├── storage.ts         ← SupabaseStorage class + supabase client
│   └── index.ts           ← نقطة الدخول
├── client/src/
│   ├── pages/
│   │   ├── Admins.tsx     ← صفحة إدارة الأدمن (تحتاج تعديل)
│   │   ├── Shifts.tsx     ← جدول الشيفتات (يعمل)
│   │   ├── MyShifts.tsx   ← شيفتات الأدمن (يعمل)
│   │   ├── AdminDashboard.tsx
│   │   └── SuperAdminDashboard.tsx
│   ├── lib/
│   │   ├── userProfileService.ts  ← fetchUserProfile() تحتاج تعديل
│   │   └── supabase.ts            ← Supabase client + types
│   └── contexts/AuthContext.tsx
├── supabase/              ← ملفات SQL
└── shared/schema.ts
```

## خطوات الاستكمال

1. **في Supabase SQL Editor:** شغّل `07_add_platform_id.sql`
2. **في `Admins.tsx`:** أضف edit dialog مع حقل `platform_id`
3. **في `userProfileService.ts`:** استخدم `platform_id` للـ fetch
4. **اختبار:** أدخل platform_id لأحد الأدمن وتحقق أن صورته تظهر

---

## ملاحظات تقنية مهمة

- كلمات المرور مُشفّرة بـ **bcrypt** (10 rounds) — متوافقة مع pgcrypto
- جدول `users` فيه constraint اسمه `users_status_check` — القيم المسموحة: `pending/approved/rejected`
- عمود `name` في جدول users هو NOT NULL — أي INSERT يجب أن يتضمنه
- الـ Supabase hardcoded fallback موجود في `storage.ts` كـ backup لو env vars فشلت
- API المنصة الخارجية: `https://www.sayyouditto.com/pay/payermax/getInfo?no={ID}`
  - الـ response: `{ code: 200, data: { nick, avatar, ... } }`
