---
name: Change logs RLS blocker
description: جدول change_logs في Supabase يمنع INSERT بسبب RLS — الحل معروف لكن يحتاج تشغيل يدوي
---

# مشكلة RLS على change_logs

**المشكلة:** الـ Supabase anon key لا يستطيع INSERT في جدول `change_logs`:
```
{"code":"42501","message":"new row violates row-level security policy for table \"change_logs\""}
```

**الحل (يشغّله المستخدم في Supabase SQL Editor):**
```sql
ALTER TABLE public.change_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "change_logs_all" ON public.change_logs FOR ALL USING (true) WITH CHECK (true);
```

**Why:** جدول `change_logs` اتعمل بدون RLS policy. Supabase بيمنع الـ INSERT بالـ anon key على أي جدول بدون policy صريحة.

**ملاحظة:** نفس المشكلة موجودة في كل الجداول الجديدة — تأكد من إضافة policy لأي جدول جديد في Supabase.

**الحالة:** لم يُحل بعد — ينتظر تشغيل SQL في Supabase dashboard.
