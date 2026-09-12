---
name: WhatsApp AI incoming images
description: عقد تمرير الصور الواردة من واتساب إلى سيرفر الذكاء الاصطناعي الخارجي
---

رسائل الصور الواردة تُحفظ مؤقتًا في Supabase Storage، ويحتوي `context.incoming_images` على رابط موقّع مؤقت ونوع الملف واسم الملف وcaption. الرسالة تحمل `message_type: image`.

**Why:** تمرير رابط موقّع بدل Base64 يحافظ على حجم طابور Supabase ويتيح لسيرفر الـAI استخدام الصورة كمدخل رؤية، مع حذف الملف بعد إرسال الرد.

**How to apply:** يجب على العامل الخارجي استخدام `incoming_images[].image_url` كمدخل صورة للنموذج. شغّل migration `28_whatsapp_ai_incoming_images.sql`، ولا تعتمد على الرابط بعد انتهاء الطلب لأنه صالح لساعتين فقط.