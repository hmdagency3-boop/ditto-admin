---
name: Nested app dependencies
description: قاعدة تشغيل المشاريع المستوردة التي تحتوي تطبيق Node داخل مجلد فرعي
---

يجب أن يحتوي مجلد التطبيق الذي يشغله الـ workflow على package.json و lockfile واعتمادياته كاملة؛ اعتماديات package.json في جذر المستودع لا تُحل تلقائيًا من imports داخل التطبيق المتداخل.

**Why:** حلّ Node يعتمد على أقرب node_modules من الملف المستورد، لذلك قد ينجح تثبيت الجذر بينما يفشل workflow الخاص بالتطبيق الفرعي بحزم مفقودة.

**How to apply:** قبل تشغيل workflow لتطبيق متداخل، ثبّت من lockfile داخل مجلد التطبيق وافحص imports الخارجية غير المدرجة في manifest الخاص به.