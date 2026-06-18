---
name: Employment Status Bug
description: مشكلة حفظ حالة التوظيف (متواجد/مفصول) في Supabase
---

## الميزة
حقل `employment_status` (active/dismissed) على جدول users — يُعدّل من صفحة Admins.tsx بزر فصل/تفعيل.

## ما تم بناؤه
- عمود `employment_status TEXT NOT NULL DEFAULT 'active'` موجود في Supabase ✅
- Endpoint مخصص: `PATCH /api/users/:id/employment-status` في routes.ts ✅
- Optimistic UI update في Admins.tsx ✅
- `Cache-Control: no-store` على GET /api/users ✅
- Supabase key محدّث من publishable إلى anon key الحقيقي ✅

## المشكلة المعلّقة
التغيير يظهر لحظياً (optimistic) لكن بعد refresh يرجع active.
- الـ PATCH يصل للسيرفر ويرجع 200 في 6ms فقط (بدون console.log!) — يشير أن السيرفر لسه بيشغّل كود قديم
- Supabase update يعمل بشكل مباشر من node scripts ✅
- GET /api/users لا يزال يرجع 304 رغم Cache-Control: no-store — نفس إشارة كود قديم
- آخر محاولة: restart الـ workflow لتحميل الكود الجديد

## الأسباب المحتملة المتبقية
1. الـ tsx --watch لم يُعد تحميل routes.ts بعد التعديلات — تم عمل restart
2. هناك RLS policy في Supabase تمنع UPDATE من الـ anon role رغم policy "FOR ALL USING (true)"

## الملفات الرئيسية
- `platform-admin/server/routes.ts` — endpoint مخصص في السطر ~345
- `platform-admin/server/storage.ts` — anon key محدّث
- `platform-admin/client/src/pages/Admins.tsx` — toggleEmploymentStatus يستخدم /employment-status
