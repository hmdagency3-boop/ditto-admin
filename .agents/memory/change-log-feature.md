---
name: Change log feature
description: سجل التغييرات — ما تم تنفيذه وكيف يعمل النظام
---

## كل شيء مكتمل ✅

### Server (platform-admin/server/routes.ts)
- Helper `fetchPlatformProfile(identifier)` — يستدعي API الخارجي ويعيد {uid, nick, avatar}
- Helper `logChange(supabase, userId, userFullName, changeType, oldValue, newValue)` — يحفظ سطر في change_logs
- PATCH /api/users/:id محسّن: يجلب بيانات المستخدم قبل التعديل، يكتشف ويسجّل: name_change، platform_id_change، nick_change، avatar_change
- GET /api/change-logs — يجيب كل السجلات (super admin فقط)
- POST /api/change-logs/check-all — يفحص كل الأدمن لديهم platform_id، يقارن uid/nick/avatar المحفوظ بالمُعاد من API ويسجّل أي فرق

### DB Migration (platform-admin/supabase/08_add_change_logs.sql)
- ALTER TABLE users ADD COLUMN platform_uid TEXT
- ALTER TABLE users ADD COLUMN platform_nick TEXT
- ALTER TABLE users ADD COLUMN platform_avatar TEXT
- CREATE TABLE change_logs (id, user_id, user_full_name, change_type, old_value, new_value, detected_at)

**⚠️ لازم يتنفّذ في Supabase SQL Editor قبل ما الفيتشر يشتغل**

### Client
- صفحة ChangeLogs.tsx ✅
- Route /change-logs في App.tsx ✅
- بند "سجل التغييرات" في superAdminItems بـ AppSidebar.tsx ✅
- ترجمة 'nav.changeLogs' في LangContext.tsx (عربي + إنجليزي) ✅

## منطق كشف تغيير الـ ID
- uid من API ثابت للشخص — erbanNo (platform_id) قابل للتغيير
- لما يُخزَّن platform_uid مع كل أدمن، فلو جاب نفس platform_id بـ uid مختلف → معناها شخص آخر أخد الرقم ده (uid_mismatch)

## أنواع التغييرات
- name_change: تغيير full_name المحلي (يحصل عند التعديل)
- platform_id_change: تغيير رقم المنصة (erbanNo)
- nick_change: تغيير الاسم على المنصة (يُكتشف عند التعديل أو الفحص)
- avatar_change: تغيير الصورة — يُعرض بصورتين قبل/بعد
- uid_mismatch: الرقم الثابت تغيّر → الأدمن غيّر رقمه (يُكتشف فقط عبر check-all)
