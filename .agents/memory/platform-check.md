---
name: Platform check setup
description: نظام الفحص التلقائي لتغييرات المنصة — كيف يعمل وأين هو في الكود
---

# نظام الفحص التلقائي للمنصة

**الدالة:** `runPlatformCheck(supabase)` في `platform-admin/server/routes.ts`

**متى تشتغل:**
- عند بدء السيرفر: بعد 10 ثوان (setTimeout)
- كل 60 دقيقة: (setInterval)
- عند الضغط على زر "فحص الآن": POST `/api/change-logs/check-all`

**ما تفحصه:**
- كل المستخدمين اللي عندهم `platform_id` مضبوط
- كل المستخدمين اللي `username` بتاعهم رقمي (يُعامَل كـ platform_id)

**أنواع التغييرات المكتشفة:**
- `nick_change` — تغيير الاسم على المنصة
- `avatar_change` — تغيير الصورة
- `uid_mismatch` — الرقم انتقل لشخص آخر

**منطق المقارنة:**
- لو مافيش قيمة محفوظة (`platform_nick = null`) → يحفظ القيمة الحالية بدون تسجيل (init)
- لو في قيمة محفوظة وتغيّرت → يسجّل في `change_logs` ويحدّث القيمة المحفوظة

**API المنصة:** `https://www.sayyouditto.com/pay/payermax/getInfo?no={platform_id}`
- `uid` ثابت، `erbanNo` = platform_id قابل للتغيير، `nick` و `avatar` يتغيران
