---
name: WhatsApp AI media codes
description: اتفاقية ربط صور ردود واتساب بالـ AI عبر أكواد وصور مخزنة في Supabase Storage
---

يستخدم رد الـ AI الصيغة `[[IMAGE:CODE]]` لطلب صورة من مكتبة الصور؛ التطبيق يزيل الكود من النص، يطابقه بمالك الحساب، وينزّل الصورة من Supabase Storage ويرسلها عبر واتساب.

**Why:** تخزين الصورة في Storage والبيانات الوصفية في جدول يحافظ على الصور بعد إعادة تشغيل السيرفر، ويمنع وضع ملفات Base64 كبيرة داخل طابور الرسائل.

**How to apply:** يجب أن يقرأ سيرفر الـ AI قائمة `context.available_images` (وتتضمن روابط موقعة مؤقتة) ويعيد الأكواد كما هي. شغّل migration `27_whatsapp_ai_media.sql` في Supabase SQL Editor قبل رفع الصور أو اختبار الإرسال.