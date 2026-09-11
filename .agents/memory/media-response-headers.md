---
name: Media response headers
description: قيد أمان واستقرار عند عرض ملفات واتساب
---

أسماء الملفات القادمة من رسائل واتساب قد تحتوي Unicode أو محارف تحكم؛ لا يجوز وضعها مباشرة في `Content-Disposition`.

**Why:** قيمة header غير الصالحة قد ترمي `ERR_INVALID_CHAR` وتُنهي عملية Node بدل رفض الطلب فقط.

**How to apply:** استخدم fallback ASCII آمنًا مع `filename*` بترميز RFC 5987، ونظّف CR/LF وعلامات الاقتباس قبل إرسال أي اسم ملف في response header.