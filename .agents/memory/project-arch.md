---
name: Project architecture
description: نظرة عامة على البنية التقنية لنظام إدارة المشرفين
---

## Stack
- Backend: Express + TypeScript في `platform-admin/server/`
- Frontend: React + Vite + TypeScript في `platform-admin/client/`
- DB: Supabase PostgreSQL
- Routing: wouter
- Auth: JWT في localStorage key "token"
- CSS: Tailwind + shadcn/ui

## مهم
- SUPABASE_URL و SUPABASE_ANON_KEY في environment variables (fallback في storage.ts)
- Super admin login: admin / Admin123
- الـ workflow: `cd platform-admin && npm run dev` على port 5000
- الـ external API: `https://www.sayyouditto.com/pay/payermax/getInfo?no={platform_id}` — uid ثابت، erbanNo قابل للتغيير
- الـ proxy: GET /api/platform-profile/:identifier (بدون auth) في routes.ts

## ProtectedRoute
- `superAdminOnly` prop → يمنع الدخول إلا للـ super_admin
- superAdminItems في AppSidebar.tsx هي قائمة الـ super admin

## SQL Migrations
في `platform-admin/supabase/` — تُشغَّل يدويًا في Supabase SQL Editor
آخر ملف: 08_add_change_logs.sql (يضيف platform_uid/nick/avatar + جدول change_logs)
