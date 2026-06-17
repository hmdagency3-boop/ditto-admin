-- ============================================================
-- 05_useful_queries.sql
-- استعلامات مفيدة للإدارة اليومية
-- ============================================================

-- ── إحصائيات عامة ─────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'approved') AS admins_count,
  (SELECT COUNT(*) FROM users WHERE status = 'pending')                      AS pending_count,
  (SELECT COUNT(*) FROM attendance WHERE date = CURRENT_DATE)                AS today_attendance,
  (SELECT COUNT(*) FROM shifts WHERE date = CURRENT_DATE)                    AS today_shifts,
  (SELECT COUNT(*) FROM ratings)                                             AS total_ratings,
  (SELECT COUNT(*) FROM warnings)                                            AS total_warnings;

-- ── حضور اليوم ────────────────────────────────────────────────
SELECT
  u.full_name,
  u.username,
  a.check_in,
  a.check_out,
  a.status,
  CASE
    WHEN a.check_out IS NOT NULL
    THEN EXTRACT(EPOCH FROM (a.check_out - a.check_in)) / 3600
    ELSE NULL
  END AS hours_worked
FROM attendance a
JOIN users u ON u.id = a.user_id
WHERE a.date = CURRENT_DATE
ORDER BY a.check_in;

-- ── أفضل المشرفين بالتقييمات ──────────────────────────────────
SELECT
  u.full_name,
  u.username,
  COUNT(r.id)              AS ratings_count,
  ROUND(AVG(r.score), 2)  AS avg_score
FROM users u
LEFT JOIN ratings r ON r.user_id = u.id
WHERE u.role = 'admin' AND u.status = 'approved'
GROUP BY u.id, u.full_name, u.username
ORDER BY avg_score DESC NULLS LAST;

-- ── المشرفون الذين لديهم إنذارات ──────────────────────────────
SELECT
  u.full_name,
  u.username,
  COUNT(w.id)    AS warnings_count,
  MAX(w.severity) AS max_severity,
  MAX(w.created_at) AS last_warning
FROM users u
JOIN warnings w ON w.user_id = u.id
WHERE u.status = 'approved'
GROUP BY u.id, u.full_name, u.username
ORDER BY warnings_count DESC;

-- ── جدول الشيفت الحالي (اليوم) ────────────────────────────────
SELECT
  s.shift_number,
  u.full_name,
  u.username
FROM shifts s
JOIN users u ON u.id = s.user_id
WHERE s.date = CURRENT_DATE
ORDER BY s.shift_number, u.full_name;

-- ── حذف بيانات تجريبية (استخدم بحذر!) ────────────────────────
-- TRUNCATE TABLE warnings, ratings, shifts, attendance CASCADE;
-- DELETE FROM users WHERE role = 'admin';

-- ── تغيير رقم الحساب الرئيسي (super_admin) ───────────────────
-- UPDATE users SET password = 'NEW_BCRYPT_HASH' WHERE username = 'admin';
