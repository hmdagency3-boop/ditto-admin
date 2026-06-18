import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "admindesk-secret-key-change-in-production";

interface JWTPayload {
  userId: string;
  username: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "غير مصرح - يرجى تسجيل الدخول" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "الجلسة منتهية - يرجى تسجيل الدخول مرة أخرى" });
    }
    req.user = decoded as JWTPayload;
    next();
  });
}

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "super_admin") {
    return res.status(403).json({ message: "غير مصرح - يتطلب صلاحيات المسؤول الأعلى" });
  }
  next();
}

async function fetchPlatformProfile(identifier: string): Promise<{ uid: string; nick: string; avatar: string } | null> {
  try {
    const response = await fetch(
      `https://www.sayyouditto.com/pay/payermax/getInfo?no=${encodeURIComponent(identifier)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) return null;
    const result = await response.json();
    if (result.code === 200 && result.data) {
      return {
        uid: String(result.data.uid || ''),
        nick: result.data.nick || '',
        avatar: result.data.avatar || ''
      };
    }
    return null;
  } catch { return null; }
}

async function logChange(
  userId: string,
  userFullName: string,
  changeType: string,
  oldValue: string | null,
  newValue: string | null
) {
  try {
    await storage.query(
      `INSERT INTO change_logs (user_id, user_full_name, change_type, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, userFullName, changeType, oldValue, newValue]
    );
  } catch (error) {
    console.error('Error inserting change log:', error);
  }
}

async function runPlatformCheck(): Promise<number> {
  const { rows: allUsers } = await storage.query(
    `SELECT id, full_name, username, platform_id, platform_uid, platform_nick, platform_avatar FROM users`
  );

  const users = allUsers.filter((u: any) => {
    const pid = u.platform_id || (u.username && /^\d+$/.test(u.username) ? u.username : null);
    return !!pid;
  });

  let changesFound = 0;

  for (const user of users) {
    const identifier = user.platform_id || user.username;
    const profile = await fetchPlatformProfile(String(identifier));
    if (!profile) continue;

    const profileUpdates: Record<string, any> = {};

    if (user.platform_uid && profile.uid && profile.uid !== user.platform_uid) {
      await logChange(
        user.id, user.full_name, 'uid_mismatch',
        `uid: ${user.platform_uid} (رقم: ${identifier})`,
        `uid: ${profile.uid} — الرقم ${identifier} انتقل لشخص آخر`
      );
      changesFound++;
      profileUpdates.platform_uid = profile.uid;
    } else if (!user.platform_uid && profile.uid) {
      profileUpdates.platform_uid = profile.uid;
    }

    if (user.platform_nick && profile.nick && profile.nick !== user.platform_nick) {
      await logChange(user.id, user.full_name, 'nick_change', user.platform_nick, profile.nick);
      changesFound++;
      profileUpdates.platform_nick = profile.nick;
    } else if (!user.platform_nick && profile.nick) {
      profileUpdates.platform_nick = profile.nick;
    }

    if (user.platform_avatar && profile.avatar && profile.avatar !== user.platform_avatar) {
      await logChange(user.id, user.full_name, 'avatar_change', user.platform_avatar, profile.avatar);
      changesFound++;
      profileUpdates.platform_avatar = profile.avatar;
    } else if (!user.platform_avatar && profile.avatar) {
      profileUpdates.platform_avatar = profile.avatar;
    }

    if (Object.keys(profileUpdates).length > 0) {
      const keys = Object.keys(profileUpdates);
      const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
      const values = keys.map(k => profileUpdates[k]);
      values.push(user.id);
      await storage.query(
        `UPDATE users SET ${setClauses} WHERE id = $${values.length}`,
        values
      );
    }
  }

  return changesFound;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, full_name, device_fingerprint } = req.body;
      const ip_address = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || 'unknown';

      if (!username || !password || !full_name) {
        return res.status(400).json({ message: "جميع الحقول مطلوبة" });
      }

      if (username.length < 3) {
        return res.status(400).json({ message: "اسم المستخدم يجب أن يكون 3 أحرف على الأقل" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "اسم المستخدم موجود مسبقاً" });
      }

      const user = await storage.createUser({
        username,
        password,
        full_name,
        device_fingerprint: device_fingerprint || null,
        ip_address: ip_address,
      });

      res.status(201).json({
        message: "تم إرسال طلب التسجيل بنجاح. يرجى انتظار موافقة المسؤول.",
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          status: user.status,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "حدث خطأ أثناء التسجيل" });
    }
  });

  app.post("/api/auth/check-status", async (req, res) => {
    try {
      const { username } = req.body;

      if (!username) {
        return res.status(400).json({ status: "not_found" });
      }

      const user = await storage.getUserByUsername(username);

      if (!user) {
        return res.json({ status: "not_found" });
      }

      res.json({
        status: user.status,
        username: user.username,
      });
    } catch (error) {
      console.error("Check status error:", error);
      res.status(500).json({ status: "error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "اسم المستخدم وكلمة المرور مطلوبان" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }

      if (user.status === "pending") {
        return res.status(403).json({
          message: "حسابك قيد المراجعة. يرجى انتظار موافقة المسؤول.",
          status: "pending"
        });
      }

      if (user.status === "rejected") {
        return res.status(403).json({
          message: "تم رفض طلب حسابك. يرجى التواصل مع المسؤول.",
          status: "rejected"
        });
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
          status: user.status,
          phone: user.phone,
          avatar_url: user.avatar_url,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "حدث خطأ أثناء تسجيل الدخول" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }

      res.json({
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        status: user.status,
        phone: user.phone,
        avatar_url: user.avatar_url,
        platform_id: (user as any).platform_id || null,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.get("/api/platform-profile/:identifier", async (req, res) => {
    const { identifier } = req.params;
    if (!identifier) return res.status(400).json({ message: "identifier required" });
    try {
      const response = await fetch(
        `https://www.sayyouditto.com/pay/payermax/getInfo?no=${encodeURIComponent(identifier)}`,
        { headers: { Accept: "application/json" } }
      );
      if (!response.ok) return res.status(502).json({ message: "External API error" });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Platform profile proxy error:", error);
      res.status(502).json({ message: "Failed to reach external API" });
    }
  });

  app.get("/api/users", authenticateToken, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(
        users.map((u: any) => ({
          id: u.id,
          username: u.username,
          full_name: u.full_name,
          role: u.role,
          status: u.status,
          phone: u.phone,
          avatar_url: u.avatar_url,
          platform_id: u.platform_id || null,
          created_at: u.created_at,
        }))
      );
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.get("/api/users/pending", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const users = await storage.getPendingUsers();
      res.json(
        users.map((u: any) => ({
          id: u.id,
          username: u.username,
          full_name: u.full_name,
          created_at: u.created_at,
          device_fingerprint: u.device_fingerprint || null,
          ip_address: u.ip_address || null,
        }))
      );
    } catch (error) {
      console.error("Get pending users error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/users/:id/approve", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.approveUser(id, req.user!.userId);

      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }

      res.json({
        message: "تمت الموافقة على الحساب بنجاح",
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          status: user.status,
        },
      });
    } catch (error) {
      console.error("Approve user error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/users/:id/reject", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.rejectUser(id);

      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }

      res.json({
        message: "تم رفض الحساب",
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          status: user.status,
        },
      });
    } catch (error) {
      console.error("Reject user error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.patch("/api/users/:id", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { full_name, phone, platform_id, password } = req.body;

      const { rows: currentRows } = await storage.query(
        `SELECT id, full_name, platform_id, platform_uid, platform_nick, platform_avatar FROM users WHERE id = $1`,
        [id]
      );
      const currentUser = currentRows[0];

      const updates: Record<string, any> = {};
      if (full_name  !== undefined) { updates.full_name = full_name; updates.name = full_name; }
      if (phone      !== undefined)   updates.phone = phone;
      if (platform_id !== undefined)  updates.platform_id = platform_id;

      if (password && password.trim().length > 0) {
        const bcryptLib = await import('bcryptjs');
        updates.password = await bcryptLib.hash(password, 10);
      }

      if (currentUser) {
        const displayName = (full_name !== undefined ? full_name : currentUser.full_name) || '';

        if (full_name !== undefined && full_name !== currentUser.full_name) {
          await logChange(id, displayName, 'name_change', currentUser.full_name, full_name);
        }

        if (platform_id !== undefined && String(platform_id || '') !== String(currentUser.platform_id || '')) {
          await logChange(id, displayName, 'platform_id_change', currentUser.platform_id || null, platform_id || null);

          if (platform_id) {
            const profile = await fetchPlatformProfile(String(platform_id));
            if (profile) {
              if (currentUser.platform_nick && profile.nick && profile.nick !== currentUser.platform_nick) {
                await logChange(id, displayName, 'nick_change', currentUser.platform_nick, profile.nick);
              }
              if (currentUser.platform_avatar && profile.avatar && profile.avatar !== currentUser.platform_avatar) {
                await logChange(id, displayName, 'avatar_change', currentUser.platform_avatar, profile.avatar);
              }
              updates.platform_uid    = profile.uid;
              updates.platform_nick   = profile.nick;
              updates.platform_avatar = profile.avatar;
            }
          } else {
            updates.platform_uid    = null;
            updates.platform_nick   = null;
            updates.platform_avatar = null;
          }
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.json({ message: "لا توجد تغييرات", data: currentUser });
      }

      const keys = Object.keys(updates);
      const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
      const values = keys.map(k => updates[k]);
      values.push(id);

      const { rows } = await storage.query(
        `UPDATE users SET ${setClauses}, updated_at = NOW() WHERE id = $${values.length}
         RETURNING id, username, full_name, phone, platform_id, role, status`,
        values
      );

      if (rows.length === 0) throw new Error("User not found");
      res.json({ message: "تم تحديث البيانات بنجاح", data: rows[0] });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.delete("/api/users/:id", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      if (id === req.user!.userId) {
        return res.status(400).json({ message: "لا يمكنك حذف حسابك الخاص" });
      }

      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }

      res.json({ message: "تم حذف المستخدم بنجاح" });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  // Shifts endpoints
  app.get("/api/shifts", authenticateToken, async (req, res) => {
    try {
      const { rows } = await storage.query(
        'SELECT * FROM shifts ORDER BY shift_number ASC'
      );
      res.json(rows);
    } catch (error) {
      console.error("Get shifts error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/shifts", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { user_id, shift_number } = req.body;

      if (!shift_number || shift_number < 1 || shift_number > 12) {
        return res.status(400).json({ message: "رقم الشيفت يجب أن يكون بين 1 و 12" });
      }

      const { rows: existing } = await storage.query(
        'SELECT * FROM shifts WHERE shift_number = $1 AND user_id = $2',
        [shift_number, user_id]
      );

      if (existing.length > 0) {
        return res.status(400).json({ message: "هذا المشرف مسجل بالفعل في هذا الشيفت" });
      }

      const { rows } = await storage.query(
        `INSERT INTO shifts (user_id, shift_number, created_by) VALUES ($1, $2, $3) RETURNING *`,
        [user_id, shift_number, req.user!.userId]
      );

      res.status(201).json({ message: "تمت إضافة المشرف للشيفت بنجاح", data: rows[0] });
    } catch (error) {
      console.error("Create shift error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.delete("/api/shifts/:id", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.query('DELETE FROM shifts WHERE id = $1', [id]);
      res.json({ message: "تم حذف المشرف من الشيفت بنجاح" });
    } catch (error) {
      console.error("Delete shift error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  // Attendance endpoints
  app.get("/api/attendance", authenticateToken, async (req, res) => {
    try {
      const { rows } = await storage.query(
        'SELECT * FROM attendance ORDER BY date DESC'
      );
      res.json(rows);
    } catch (error) {
      console.error("Get attendance error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/attendance", authenticateToken, async (req, res) => {
    try {
      const { user_id, check_in, date, status } = req.body;

      const { rows } = await storage.query(
        `INSERT INTO attendance (user_id, check_in, date, status) VALUES ($1, $2, $3, $4) RETURNING *`,
        [user_id, check_in, date, status]
      );

      res.status(201).json({ message: "تم تسجيل الحضور", data: rows[0] });
    } catch (error) {
      console.error("Create attendance error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.patch("/api/attendance/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { check_out } = req.body;

      const { rows } = await storage.query(
        `UPDATE attendance SET check_out = $1 WHERE id = $2 RETURNING *`,
        [check_out, id]
      );

      res.json({ message: "تم تحديث الحضور", data: rows[0] });
    } catch (error) {
      console.error("Update attendance error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  // Ratings endpoints
  app.get("/api/ratings", authenticateToken, async (req, res) => {
    try {
      const { rows } = await storage.query(
        'SELECT * FROM ratings ORDER BY created_at DESC'
      );
      res.json(rows);
    } catch (error) {
      console.error("Get ratings error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/ratings", authenticateToken, async (req, res) => {
    try {
      const { user_id, score, comment } = req.body;

      const { rows } = await storage.query(
        `INSERT INTO ratings (user_id, score, comment, rated_by) VALUES ($1, $2, $3, $4) RETURNING *`,
        [user_id, score, comment, req.user!.userId]
      );

      res.status(201).json({ message: "تم إضافة التقييم", data: rows[0] });
    } catch (error) {
      console.error("Create rating error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  // Warnings endpoints
  app.get("/api/warnings", authenticateToken, async (req, res) => {
    try {
      const { rows } = await storage.query(
        'SELECT * FROM warnings ORDER BY created_at DESC'
      );
      res.json(rows);
    } catch (error) {
      console.error("Get warnings error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/warnings", authenticateToken, async (req, res) => {
    try {
      const { user_id, severity, reason } = req.body;

      const { rows } = await storage.query(
        `INSERT INTO warnings (user_id, severity, reason, issued_by) VALUES ($1, $2, $3, $4) RETURNING *`,
        [user_id, severity, reason, req.user!.userId]
      );

      res.status(201).json({ message: "تم إصدار التحذير", data: rows[0] });
    } catch (error) {
      console.error("Create warning error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  // Change Logs endpoints
  app.get("/api/change-logs", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { rows } = await storage.query(
        'SELECT * FROM change_logs ORDER BY detected_at DESC LIMIT 500'
      );
      res.json(rows);
    } catch (error) {
      console.error("Get change logs error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/change-logs/check-all", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const changesFound = await runPlatformCheck();
      res.json({ message: `تم الفحص بنجاح — تم اكتشاف ${changesFound} تغيير`, changesFound });
    } catch (error) {
      console.error("Check all error:", error);
      res.status(500).json({ message: "حدث خطأ أثناء الفحص" });
    }
  });

  // Auto-check on startup after 10 seconds
  setTimeout(async () => {
    try {
      console.log('[platform-check] بدء الفحص التلقائي الأول...');
      const n = await runPlatformCheck();
      console.log(`[platform-check] اكتمل — ${n} تغيير`);
    } catch (e) {
      console.error('[platform-check] خطأ في الفحص الأول:', e);
    }
  }, 10_000);

  // Auto-check every 60 minutes
  setInterval(async () => {
    try {
      console.log('[platform-check] فحص دوري...');
      const n = await runPlatformCheck();
      console.log(`[platform-check] اكتمل — ${n} تغيير`);
    } catch (e) {
      console.error('[platform-check] خطأ في الفحص الدوري:', e);
    }
  }, 60 * 60 * 1000);

  return httpServer;
}
