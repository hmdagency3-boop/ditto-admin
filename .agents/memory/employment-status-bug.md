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

## الحل النهائي ✅
المشكلة اتحلت بعد restart السيرفر مع الكود الجديد.

**السبب الجذري:** السيرفر كان بيشغّل كود قديم (tsx --watch لم يُعد تحميل التعديلات تلقائياً) — الـ PATCH كان بيرجع 200 في 6ms بدون console.log وده الدليل.

**الإصلاحات الفعّالة:**
- استبدال publishable key بالـ anon key الحقيقي (JWT)
- إنشاء endpoint مخصص `PATCH /api/users/:id/employment-status`
- Cache-Control: no-store على GET /api/users
- Optimistic UI update في Admins.tsx
- إعادة تشغيل السيرفر يدوياً

## الملفات الرئيسية
- `platform-admin/server/routes.ts` — endpoint مخصص في السطر ~345
- `platform-admin/server/storage.ts` — anon key محدّث
- `platform-admin/client/src/pages/Admins.tsx` — toggleEmploymentStatus يستخدم /employment-status
