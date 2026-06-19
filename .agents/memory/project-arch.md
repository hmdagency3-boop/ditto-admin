---
name: Project architecture
description: نظرة عامة على البنية التقنية لنظام إدارة المشرفين
---

## Stack
- Backend: Express + TypeScript في `platform-admin/server/`
- Frontend: React 18 + Vite + TypeScript في `platform-admin/client/`
- DB: Supabase PostgreSQL (لا تستخدم Replit DB أو executeSql أبداً)
- Routing: wouter
- Auth: JWT في localStorage key "token"
- CSS: Tailwind + shadcn/ui + RTL عربي

## مهم جداً
- SUPABASE_URL و SUPABASE_ANON_KEY و JWT_SECRET في Replit Secrets
- Super admin login: `admin / Admin123`
- الـ workflow: `cd platform-admin && npm run dev` على port 5000
- Deployment type: **VM** (مش static) — لأن setInterval يحتاج سيرفر دائم
- Build command: `cd platform-admin && npm run build`
- Run command: `cd platform-admin && npm run start`

## APIs المنصة
- الرئيسي (بدون auth): `GET https://www.sayyouditto.com/pay/payermax/getInfo?no={platform_id}`
  - يرجع: uid, erbanNo, nick, avatar, country, nobleId, nobleName, vipId, charmLevel, experLevel, fansNum (معظمها null للمستخدمين العاديين)
- الثانوي (بدون auth): `GET https://www.sayyouditto.com/user/v4/get?uid={uid}`
  - يرجع: onLine, ban, gender, chatGift
- نفس الاتنين يشتغلوا على dittoparty.com

## Platform Check
- الدالة: `runPlatformCheck(supabase)` في `routes.ts`
- تشتغل: كل 30 ثانية + بعد 10 ثوان من البدء
- تفحص: nick_change, avatar_change, uid_mismatch
- تفحص أيضاً: noble/vip/charm/exp/fans/country عبر `platform_extra` JSONB column

## SQL Migrations
في `platform-admin/supabase/` — تُشغَّل يدويًا في Supabase SQL Editor
- 01 → 08: جداول أساسية + change_logs
- 09_add_platform_extra.sql: يضيف عمود `platform_extra JSONB` — **لم يُشغَّل بعد**

## RLS مهم
- كل جدول جديد في Supabase يحتاج RLS policy وإلا الـ anon key لن يستطيع INSERT
- نموذج الـ policy:
  ```sql
  ALTER TABLE public.TABLE_NAME ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "allow_all" ON public.TABLE_NAME FOR ALL USING (true) WITH CHECK (true);
  ```

## ProtectedRoute
- `superAdminOnly` prop → يمنع الدخول إلا للـ super_admin
- superAdminItems في AppSidebar.tsx هي قائمة صفحات الـ super admin فقط

## Font خاص
- `.platform-nick` class في `index.css` تستخدم Noto Sans Symbols 2
- مطبّق على كل عناصر عرض أسماء المنصة في 8 صفحات
