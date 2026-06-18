---
name: Supabase-only rule
description: قاعدة البيانات الوحيدة المسموح استخدامها هي Supabase — لا Replit PostgreSQL أبدًا
---

# قاعدة: Supabase فقط

**القاعدة:** لا تستخدم `executeSql` أو `DATABASE_URL` أو Replit PostgreSQL أبدًا في هذا المشروع.

**Why:** المشروع يستخدم Supabase JS client (`https://hijmdaiwxhcrvxqmgxsy.supabase.co`). أداة `executeSql` في Replit تتصل بـ Replit PostgreSQL منفصل تمامًا — أي migration تشغّلها هناك لن تؤثر على الـ DB الحقيقي.

**How to apply:**
- للـ migrations: شغّل SQL يدويًا في **Supabase SQL Editor** (dashboard.supabase.com)
- للاستعلامات من الكود: استخدم `storage.supabase.from(...)` دائمًا
- للتحقق من الـ DB: استخدم `node -e` مع `require('@supabase/supabase-js')` من مجلد `platform-admin/`
