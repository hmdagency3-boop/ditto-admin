import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("[SECURITY] JWT_SECRET environment variable is required but not set. Set it in Replit Secrets.");
}

interface JWTPayload {
  userId: string;
  username: string;
  role: string;
}

// ── Simple in-memory rate limiter for login ──────────────────────────────────
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX     = 10;   // max attempts
const RATE_LIMIT_WINDOW  = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_LOCKOUT = 15 * 60 * 1000; // 15 minutes lockout after max

function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

function resetLoginRateLimit(ip: string) {
  loginAttempts.delete(ip);
}
// ─────────────────────────────────────────────────────────────────────────────

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

  jwt.verify(token, JWT_SECRET!, (err, decoded) => {
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

interface PlatformProfile {
  uid: string;
  nick: string;
  avatar: string;
  noble: string;      // nobleName
  vip: string;        // vipId
  charm: string;      // charmLevel
  exp: string;        // experLevel
  fans: string;       // fansNum
  country: string;
}

async function fetchPlatformProfile(identifier: string): Promise<PlatformProfile | null> {
  try {
    const response = await fetch(
      `https://www.sayyouditto.com/pay/payermax/getInfo?no=${encodeURIComponent(identifier)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) return null;
    const result = await response.json();
    if (result.code === 200 && result.data) {
      const d = result.data;
      return {
        uid:     String(d.uid || ''),
        nick:    d.nick     || '',
        avatar:  d.avatar   || '',
        noble:   d.nobleName ? String(d.nobleName) : '',
        vip:     d.vipId    ? String(d.vipId)    : '',
        charm:   d.charmLevel != null ? String(d.charmLevel) : '',
        exp:     d.experLevel != null ? String(d.experLevel) : '',
        fans:    d.fansNum  != null ? String(d.fansNum)  : '',
        country: d.country  || '',
      };
    }
    return null;
  } catch { return null; }
}

async function logChange(
  supabase: any,
  userId: string,
  userFullName: string,
  changeType: string,
  oldValue: string | null,
  newValue: string | null
) {
  const { error } = await supabase.from('change_logs').insert({
    user_id: userId,
    user_full_name: userFullName,
    change_type: changeType,
    old_value: oldValue,
    new_value: newValue
  });
  if (error) {
    console.error('Error inserting change log:', JSON.stringify(error));
  }
}

async function runPlatformCheck(supabase: any): Promise<number> {
  const { data: allUsers, error } = await supabase
    .from('users')
    .select('id, full_name, username, platform_id, platform_uid, platform_nick, platform_avatar, platform_extra');

  if (error) throw error;

  const users = (allUsers || []).filter((u: any) => {
    const pid = u.platform_id || (u.username && /^\d+$/.test(u.username) ? u.username : null);
    return !!pid;
  });

  let changesFound = 0;

  for (const user of users) {
    const identifier = user.platform_id || user.username;
    const profile = await fetchPlatformProfile(String(identifier));
    if (!profile) continue;

    const profileUpdates: Record<string, any> = {};
    const extra: Record<string, string> = user.platform_extra || {};

    // uid mismatch — someone else took this erbanNo
    if (user.platform_uid && profile.uid && profile.uid !== user.platform_uid) {
      await logChange(
        supabase, user.id, user.full_name, 'uid_mismatch',
        `uid: ${user.platform_uid} (رقم: ${identifier})`,
        `uid: ${profile.uid} — الرقم ${identifier} انتقل لشخص آخر`
      );
      changesFound++;
      profileUpdates.platform_uid = profile.uid;
    } else if (!user.platform_uid && profile.uid) {
      profileUpdates.platform_uid = profile.uid;
    }

    // nick change
    if (user.platform_nick && profile.nick && profile.nick !== user.platform_nick) {
      await logChange(supabase, user.id, user.full_name, 'nick_change', user.platform_nick, profile.nick);
      changesFound++;
      profileUpdates.platform_nick = profile.nick;
    } else if (!user.platform_nick && profile.nick) {
      profileUpdates.platform_nick = profile.nick;
    }

    // avatar change
    if (user.platform_avatar && profile.avatar && profile.avatar !== user.platform_avatar) {
      await logChange(supabase, user.id, user.full_name, 'avatar_change', user.platform_avatar, profile.avatar);
      changesFound++;
      profileUpdates.platform_avatar = profile.avatar;
    } else if (!user.platform_avatar && profile.avatar) {
      profileUpdates.platform_avatar = profile.avatar;
    }

    // noble change
    if (extra.noble !== undefined && profile.noble !== extra.noble) {
      await logChange(supabase, user.id, user.full_name, 'noble_change', extra.noble || '(بدون رتبة)', profile.noble || '(بدون رتبة)');
      changesFound++;
    }

    // vip change
    if (extra.vip !== undefined && profile.vip !== extra.vip) {
      await logChange(supabase, user.id, user.full_name, 'vip_change', extra.vip || '(بدون VIP)', profile.vip || '(بدون VIP)');
      changesFound++;
    }

    // charm level change
    if (extra.charm !== undefined && profile.charm !== extra.charm) {
      await logChange(supabase, user.id, user.full_name, 'charm_change', extra.charm || '0', profile.charm || '0');
      changesFound++;
    }

    // exp level change
    if (extra.exp !== undefined && profile.exp !== extra.exp) {
      await logChange(supabase, user.id, user.full_name, 'exp_change', extra.exp || '0', profile.exp || '0');
      changesFound++;
    }

    // fans count change
    if (extra.fans !== undefined && profile.fans !== extra.fans) {
      await logChange(supabase, user.id, user.full_name, 'fans_change', extra.fans || '0', profile.fans || '0');
      changesFound++;
    }

    // country change
    if (extra.country !== undefined && profile.country && profile.country !== extra.country) {
      await logChange(supabase, user.id, user.full_name, 'country_change', extra.country || '(غير محدد)', profile.country);
      changesFound++;
    }

    // Always update platform_extra with latest values
    const newExtra: Record<string, string> = {
      ...extra,
      noble:   profile.noble,
      vip:     profile.vip,
      charm:   profile.charm,
      exp:     profile.exp,
      fans:    profile.fans,
      country: profile.country,
    };
    profileUpdates.platform_extra = newExtra;

    if (Object.keys(profileUpdates).length > 0) {
      await supabase.from('users').update(profileUpdates).eq('id', user.id);
    }
  }

  return changesFound;
}

export { runPlatformCheck };

export async function registerRoutes(
  httpServer: Server,
  app: Express,
  options: { enableScheduler?: boolean } = { enableScheduler: true }
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
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || 'unknown';
    const rateCheck = checkLoginRateLimit(ip);
    if (!rateCheck.allowed) {
      const minutesLeft = Math.ceil(rateCheck.retryAfterMs / 60000);
      return res.status(429).json({
        message: `تم تجاوز الحد الأقصى لمحاولات الدخول. حاول مجدداً بعد ${minutesLeft} دقيقة.`
      });
    }

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

      // Reset rate limit on successful login
      resetLoginRateLimit(ip);

      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        JWT_SECRET!,
        { expiresIn: "24h" }
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

  // Logout (client should discard token; server-side for future blacklist extension)
  app.post("/api/auth/logout", authenticateToken, (req, res) => {
    res.json({ message: "تم تسجيل الخروج بنجاح" });
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

  // Proxy endpoint for external platform profile API (avoids CORS)
  app.get("/api/platform-profile/:identifier", authenticateToken, async (req, res) => {
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

  app.get("/api/users", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
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
          employment_status: u.employment_status || 'active',
        }))
      );
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.patch("/api/users/:id/employment-status", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { employment_status } = req.body;
      if (!employment_status || !['active', 'dismissed'].includes(employment_status)) {
        return res.status(400).json({ message: "قيمة غير صالحة" });
      }
      console.log(`[employment-status] تحديث المستخدم ${id} إلى ${employment_status}`);
      const { data, error } = await storage.supabase
        .from('users')
        .update({ employment_status })
        .eq('id', id)
        .select('id, employment_status')
        .single();
      if (error) {
        console.error('[employment-status] خطأ سوبابيز:', error);
        throw error;
      }
      console.log(`[employment-status] نجح: ${JSON.stringify(data)}`);
      res.json({ message: "تم التحديث", data });
    } catch (error) {
      console.error("Employment status error:", error);
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

  app.get("/api/users/rejected", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const users = await storage.getRejectedUsers();
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
      console.error("Get rejected users error:", error);
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
      const { full_name, phone, platform_id, password, employment_status } = req.body;

      const { data: currentUser } = await storage.supabase
        .from('users')
        .select('id, full_name, platform_id, platform_uid, platform_nick, platform_avatar')
        .eq('id', id)
        .single();

      const updates: Record<string, any> = {};
      if (full_name         !== undefined) { updates.full_name = full_name; updates.name = full_name; }
      if (phone             !== undefined)   updates.phone = phone;
      if (platform_id       !== undefined)   updates.platform_id = platform_id;
      if (employment_status !== undefined)   updates.employment_status = employment_status;

      if (password && password.trim().length > 0) {
        const bcryptLib = await import('bcryptjs');
        updates.password = await bcryptLib.hash(password, 10);
      }

      updates.updated_at = new Date().toISOString();

      if (currentUser) {
        const displayName = (full_name !== undefined ? full_name : currentUser.full_name) || '';

        if (full_name !== undefined && full_name !== currentUser.full_name) {
          await logChange(storage.supabase, id, displayName, 'name_change', currentUser.full_name, full_name);
        }

        if (platform_id !== undefined && String(platform_id || '') !== String(currentUser.platform_id || '')) {
          await logChange(storage.supabase, id, displayName, 'platform_id_change', currentUser.platform_id || null, platform_id || null);

          if (platform_id) {
            const profile = await fetchPlatformProfile(String(platform_id));
            if (profile) {
              if (currentUser.platform_nick && profile.nick && profile.nick !== currentUser.platform_nick) {
                await logChange(storage.supabase, id, displayName, 'nick_change', currentUser.platform_nick, profile.nick);
              }
              if (currentUser.platform_avatar && profile.avatar && profile.avatar !== currentUser.platform_avatar) {
                await logChange(storage.supabase, id, displayName, 'avatar_change', currentUser.platform_avatar, profile.avatar);
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

      const { data, error } = await storage.supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select('id, username, full_name, phone, platform_id, role, status')
        .single();

      if (error) throw error;
      res.json({ message: "تم تحديث البيانات بنجاح", data });
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
      const { data, error } = await storage.supabase
        .from('shifts')
        .select('*')
        .order('shift_number', { ascending: true });

      if (error) throw error;
      res.json(data || []);
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

      const { data: existing } = await storage.supabase
        .from('shifts')
        .select('*')
        .eq('shift_number', shift_number)
        .eq('user_id', user_id);

      if (existing && existing.length > 0) {
        return res.status(400).json({ message: "هذا المشرف مسجل بالفعل في هذا الشيفت" });
      }

      const { data, error } = await storage.supabase
        .from('shifts')
        .insert({
          user_id,
          shift_number,
          created_by: req.user!.userId,
        })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ message: "تمت إضافة المشرف للشيفت بنجاح", data });
    } catch (error) {
      console.error("Create shift error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.delete("/api/shifts/:id", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const { error } = await storage.supabase
        .from('shifts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      res.json({ message: "تم حذف المشرف من الشيفت بنجاح" });
    } catch (error) {
      console.error("Delete shift error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  // Attendance endpoints
  app.get("/api/attendance", authenticateToken, async (req, res) => {
    try {
      const { data, error } = await storage.supabase
        .from('attendance')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      console.error("Get attendance error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/attendance", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { user_id, check_in, date, status } = req.body;

      const { data, error } = await storage.supabase
        .from('attendance')
        .insert({ user_id, check_in, date, status })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ message: "تم تسجيل الحضور", data });
    } catch (error) {
      console.error("Create attendance error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.patch("/api/attendance/:id", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { check_out } = req.body;

      const { data, error } = await storage.supabase
        .from('attendance')
        .update({ check_out })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json({ message: "تم تحديث الحضور", data });
    } catch (error) {
      console.error("Update attendance error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  // Ratings endpoints
  app.get("/api/ratings", authenticateToken, async (req, res) => {
    try {
      const { data, error } = await storage.supabase
        .from('ratings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      console.error("Get ratings error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/ratings", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { user_id, score, comment } = req.body;

      const { data, error } = await storage.supabase
        .from('ratings')
        .insert({ user_id, score, comment, rated_by: req.user!.userId })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ message: "تم إضافة التقييم", data });
    } catch (error) {
      console.error("Create rating error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  // Warnings endpoints
  app.get("/api/warnings", authenticateToken, async (req, res) => {
    try {
      const { data, error } = await storage.supabase
        .from('warnings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      console.error("Get warnings error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/warnings", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { user_id, severity, reason } = req.body;

      const { data, error } = await storage.supabase
        .from('warnings')
        .insert({ user_id, severity, reason, issued_by: req.user!.userId })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ message: "تم إصدار التحذير", data });
    } catch (error) {
      console.error("Create warning error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.delete("/api/ratings/:id", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await storage.supabase.from('ratings').delete().eq('id', id);
      if (error) throw error;
      res.json({ message: "تم حذف التقييم بنجاح" });
    } catch (error) {
      console.error("Delete rating error:", error);
      res.status(500).json({ message: "حدث خطأ أثناء الحذف" });
    }
  });

  app.delete("/api/warnings/:id", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await storage.supabase.from('warnings').delete().eq('id', id);
      if (error) throw error;
      res.json({ message: "تم حذف الإنذار بنجاح" });
    } catch (error) {
      console.error("Delete warning error:", error);
      res.status(500).json({ message: "حدث خطأ أثناء الحذف" });
    }
  });

  app.patch("/api/auth/change-password", authenticateToken, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "كلمة المرور الحالية والجديدة مطلوبتان" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" });
      }
      const { data: userData, error: fetchErr } = await storage.supabase
        .from('users').select('password').eq('id', req.user!.userId).single();
      if (fetchErr || !userData) return res.status(404).json({ message: "المستخدم غير موجود" });

      // Verify against bcrypt hash
      const valid = await bcrypt.compare(currentPassword, userData.password);
      if (!valid) {
        return res.status(400).json({ message: "كلمة المرور الحالية غير صحيحة" });
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      const { error: updateErr } = await storage.supabase
        .from('users').update({ password: hashed }).eq('id', req.user!.userId);
      if (updateErr) throw updateErr;
      res.json({ message: "تم تغيير كلمة المرور بنجاح" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "حدث خطأ أثناء تغيير كلمة المرور" });
    }
  });

  // ── /api/me/* — user-scoped endpoints (for regular admins) ──────────────────

  // Own attendance only — no data leakage to other users
  app.get("/api/me/attendance", authenticateToken, async (req, res) => {
    try {
      const { data, error } = await storage.supabase
        .from('attendance')
        .select('*')
        .eq('user_id', req.user!.userId)
        .order('date', { ascending: false });
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      console.error("Get my attendance error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  // Own shifts only
  app.get("/api/me/shifts", authenticateToken, async (req, res) => {
    try {
      const { data, error } = await storage.supabase
        .from('shifts')
        .select('*')
        .eq('user_id', req.user!.userId)
        .order('shift_number', { ascending: true });
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      console.error("Get my shifts error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  // Own ratings only
  app.get("/api/me/ratings", authenticateToken, async (req, res) => {
    try {
      const { data, error } = await storage.supabase
        .from('ratings')
        .select('*')
        .eq('user_id', req.user!.userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      console.error("Get my ratings error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  // Own warnings only
  app.get("/api/me/warnings", authenticateToken, async (req, res) => {
    try {
      const { data, error } = await storage.supabase
        .from('warnings')
        .select('*')
        .eq('user_id', req.user!.userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      console.error("Get my warnings error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });
  // ────────────────────────────────────────────────────────────────────────────

  // ── Admin Notes endpoints ────────────────────────────────────────────────────

  // GET all notes for a specific admin (super admin only)
  app.get("/api/users/:id/notes", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await storage.supabase
        .from('admin_notes')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data ?? []);
    } catch (error: any) {
      console.error("Get notes error:", error);
      res.status(500).json({ message: error?.message || "حدث خطأ أثناء جلب الملاحظات" });
    }
  });

  // POST create a new note for an admin (super admin only)
  app.post("/api/users/:id/notes", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      if (!content || !content.trim()) {
        return res.status(400).json({ message: "محتوى الملاحظة مطلوب" });
      }
      const { data, error } = await storage.supabase
        .from('admin_notes')
        .insert({
          user_id: id,
          content: content.trim(),
          created_by: req.user!.userId,
        })
        .select()
        .single();
      if (error) throw error;
      res.status(201).json({ message: "تم إضافة الملاحظة", data });
    } catch (error) {
      console.error("Create note error:", error);
      res.status(500).json({ message: "حدث خطأ أثناء إضافة الملاحظة" });
    }
  });

  // DELETE a note (super admin only)
  app.delete("/api/notes/:noteId", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { noteId } = req.params;
      const { error } = await storage.supabase
        .from('admin_notes')
        .delete()
        .eq('id', noteId);
      if (error) throw error;
      res.json({ message: "تم حذف الملاحظة" });
    } catch (error) {
      console.error("Delete note error:", error);
      res.status(500).json({ message: "حدث خطأ أثناء حذف الملاحظة" });
    }
  });

  // PATCH edit a note (super admin only)
  app.patch("/api/notes/:noteId", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { noteId } = req.params;
      const { content } = req.body;
      if (!content || !content.trim()) {
        return res.status(400).json({ message: "محتوى الملاحظة مطلوب" });
      }
      const { data, error } = await storage.supabase
        .from('admin_notes')
        .update({ content: content.trim(), updated_at: new Date().toISOString() })
        .eq('id', noteId)
        .select()
        .single();
      if (error) throw error;
      res.json({ message: "تم تعديل الملاحظة", data });
    } catch (error) {
      console.error("Update note error:", error);
      res.status(500).json({ message: "حدث خطأ أثناء تعديل الملاحظة" });
    }
  });

  // ── File Upload endpoint ────────────────────────────────────────────────────

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('يُسمح بالصور فقط'));
    },
  });

  app.post("/api/upload/event-image", authenticateToken, requireSuperAdmin, upload.single('image'), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "لم يتم إرسال صورة" });
      const ext = req.file.mimetype.split('/')[1] || 'jpg';
      const filename = `events/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await storage.supabase.storage
        .from('event-images')
        .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
      if (error) throw error;
      const { data: urlData } = storage.supabase.storage.from('event-images').getPublicUrl(data.path);
      res.json({ url: urlData.publicUrl });
    } catch (error: any) {
      console.error("Upload event image error:", error);
      res.status(500).json({ message: error?.message || "حدث خطأ أثناء رفع الصورة" });
    }
  });

  // ── Tasks endpoints ─────────────────────────────────────────────────────────

  app.get("/api/tasks", authenticateToken, async (req, res) => {
    try {
      const { data, error } = await storage.supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      console.error("Get tasks error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/tasks", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { title, description, assigned_to, priority, due_date } = req.body;
      if (!title || !assigned_to) {
        return res.status(400).json({ message: "العنوان والمشرف المكلّف مطلوبان" });
      }
      const insertPayload = {
        title,
        description: description || null,
        assigned_to,
        assigned_by: req.user!.userId,
        priority: priority || 'medium',
        due_date: due_date || null,
        status: 'pending',
      };
      console.log('[tasks] INSERT payload:', JSON.stringify(insertPayload));
      const { error } = await storage.supabase.from('tasks').insert(insertPayload);
      console.log('[tasks] INSERT error:', error);
      if (error) {
        console.error('[tasks] INSERT failed:', JSON.stringify(error));
        return res.status(500).json({ message: error.message || "حدث خطأ أثناء الإضافة" });
      }
      res.status(201).json({ message: "تم إضافة المهمة" });
    } catch (error: any) {
      console.error("Create task error:", error);
      res.status(500).json({ message: error?.message || "حدث خطأ" });
    }
  });

  app.patch("/api/tasks/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, assigned_to, priority, due_date, status } = req.body;
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (status !== undefined) updates.status = status;
      if (req.user?.role === 'super_admin') {
        if (assigned_to !== undefined) updates.assigned_to = assigned_to;
        if (priority !== undefined) updates.priority = priority;
        if (due_date !== undefined) updates.due_date = due_date || null;
      }
      const { error } = await storage.supabase.from('tasks').update(updates).eq('id', id);
      if (error) {
        console.error('[tasks] UPDATE failed:', JSON.stringify(error));
        return res.status(500).json({ message: error.message || "حدث خطأ أثناء التحديث" });
      }
      res.json({ message: "تم تحديث المهمة" });
    } catch (error: any) {
      console.error("Update task error:", error);
      res.status(500).json({ message: error?.message || "حدث خطأ" });
    }
  });

  app.delete("/api/tasks/:id", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await storage.supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      res.json({ message: "تم حذف المهمة" });
    } catch (error) {
      console.error("Delete task error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  // ── Events endpoints ─────────────────────────────────────────────────────────

  app.get("/api/events", authenticateToken, async (req, res) => {
    try {
      const { data, error } = await storage.supabase
        .from('events')
        .select('*')
        .order('start_date', { ascending: false });
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      console.error("Get events error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/events", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { title, description, color, image_url, start_date, end_date } = req.body;
      if (!title || !start_date || !end_date) {
        return res.status(400).json({ message: "العنوان وتاريخي البداية والنهاية مطلوبة" });
      }
      const insertPayload = {
        title,
        description: description || null,
        color: color || 'blue',
        image_url: image_url || null,
        start_date,
        end_date,
        is_active: true,
        created_by: req.user!.userId,
      };
      console.log('[events] INSERT payload:', JSON.stringify(insertPayload));
      const { error } = await storage.supabase.from('events').insert(insertPayload);
      console.log('[events] INSERT error:', error);
      if (error) {
        console.error('[events] INSERT failed:', JSON.stringify(error));
        return res.status(500).json({ message: error.message || "حدث خطأ أثناء الإنشاء" });
      }
      res.status(201).json({ message: "تم إنشاء الإيفنت" });
    } catch (error: any) {
      console.error("Create event error:", error);
      res.status(500).json({ message: error?.message || "حدث خطأ" });
    }
  });

  app.patch("/api/events/:id", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      const fields = ['title', 'description', 'color', 'image_url', 'start_date', 'end_date', 'is_active'];
      for (const f of fields) { if (req.body[f] !== undefined) updates[f] = req.body[f]; }
      const { error } = await storage.supabase.from('events').update(updates).eq('id', id);
      if (error) {
        console.error('[events] UPDATE failed:', JSON.stringify(error));
        return res.status(500).json({ message: error.message || "حدث خطأ أثناء التحديث" });
      }
      res.json({ message: "تم تحديث الإيفنت" });
    } catch (error: any) {
      console.error("Update event error:", error);
      res.status(500).json({ message: error?.message || "حدث خطأ" });
    }
  });

  app.delete("/api/events/:id", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await storage.supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      res.json({ message: "تم حذف الإيفنت" });
    } catch (error) {
      console.error("Delete event error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  // ── Change Logs endpoints ────────────────────────────────────────────────────

  // Change Logs endpoints
  app.get("/api/change-logs", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { data, error } = await storage.supabase
        .from('change_logs')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      console.error("Get change logs error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/change-logs/check-all", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const changesFound = await runPlatformCheck(storage.supabase);
      res.json({ message: `تم الفحص بنجاح — تم اكتشاف ${changesFound} تغيير`, changesFound });
    } catch (error) {
      console.error("Check all error:", error);
      res.status(500).json({ message: "حدث خطأ أثناء الفحص" });
    }
  });

  // ── Work Management: Agencies & Supporters ────────────────────────────────

  app.get("/api/agencies", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { admin_id } = req.query;
      let query = storage.supabase.from('agencies').select('*').order('created_at', { ascending: false });
      if (admin_id) query = (query as any).eq('admin_id', admin_id);
      const { data, error } = await query;
      if (error) throw error;
      res.json(data || []);
    } catch (error: any) {
      console.error('Get agencies error:', error);
      res.status(500).json({ message: error?.message || 'حدث خطأ' });
    }
  });

  app.post("/api/agencies", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { agent_id, agency_name, admin_id, country, agent_whatsapp, source_platform, creation_date, opening_date, notes } = req.body;
      if (!agent_id || !admin_id) return res.status(400).json({ message: 'أيدي الوكيل والمشرف مطلوبان' });
      const status = opening_date ? 'opened' : 'activated';
      const { error } = await storage.supabase.from('agencies').insert({
        agent_id: agent_id.trim(), agency_name: agency_name || null, admin_id,
        country: country || null, agent_whatsapp: agent_whatsapp || null,
        source_platform: source_platform || null,
        creation_date: creation_date || null, opening_date: opening_date || null,
        status, notes: notes || null,
      });
      if (error) { console.error('[agencies] INSERT failed:', JSON.stringify(error)); return res.status(500).json({ message: error.message }); }
      res.status(201).json({ message: 'تم إضافة الوكالة' });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || 'حدث خطأ' });
    }
  });

  app.patch("/api/agencies/:id", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const allowed = ['agent_id','agency_name','country','agent_whatsapp','source_platform','creation_date','opening_date','status','notes'];
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      for (const f of allowed) { if (req.body[f] !== undefined) updates[f] = req.body[f] || null; }
      if (req.body.opening_date) updates.status = 'opened';
      if (req.body.status) updates.status = req.body.status;
      const { error } = await storage.supabase.from('agencies').update(updates).eq('id', id);
      if (error) return res.status(500).json({ message: error.message });
      res.json({ message: 'تم التحديث' });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || 'حدث خطأ' });
    }
  });

  app.delete("/api/agencies/:id", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await storage.supabase.from('agencies').delete().eq('id', id);
      if (error) return res.status(500).json({ message: error.message });
      res.json({ message: 'تم الحذف' });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || 'حدث خطأ' });
    }
  });

  app.get("/api/supporters", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { admin_id } = req.query;
      let query = storage.supabase.from('supporters').select('*').order('created_at', { ascending: false });
      if (admin_id) query = (query as any).eq('admin_id', admin_id);
      const { data, error } = await query;
      if (error) throw error;
      res.json(data || []);
    } catch (error: any) {
      console.error('Get supporters error:', error);
      res.status(500).json({ message: error?.message || 'حدث خطأ' });
    }
  });

  app.post("/api/supporters", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { supporter_id, source_platform, level, management, admin_id, notes } = req.body;
      if (!supporter_id || !admin_id) return res.status(400).json({ message: 'أيدي الداعم والمشرف مطلوبان' });
      const { error } = await storage.supabase.from('supporters').insert({
        supporter_id: supporter_id.trim(), admin_id,
        source_platform: source_platform || null, level: level || null,
        management: management || null, notes: notes || null,
      });
      if (error) { console.error('[supporters] INSERT failed:', JSON.stringify(error)); return res.status(500).json({ message: error.message }); }
      res.status(201).json({ message: 'تم إضافة الداعم' });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || 'حدث خطأ' });
    }
  });

  app.patch("/api/supporters/:id", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const allowed = ['supporter_id','source_platform','level','management','notes'];
      const updates: Record<string, any> = {};
      for (const f of allowed) { if (req.body[f] !== undefined) updates[f] = req.body[f] || null; }
      const { error } = await storage.supabase.from('supporters').update(updates).eq('id', id);
      if (error) return res.status(500).json({ message: error.message });
      res.json({ message: 'تم التحديث' });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || 'حدث خطأ' });
    }
  });

  app.delete("/api/supporters/:id", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await storage.supabase.from('supporters').delete().eq('id', id);
      if (error) return res.status(500).json({ message: error.message });
      res.json({ message: 'تم الحذف' });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || 'حدث خطأ' });
    }
  });

  // توليد التقرير
  app.get("/api/work-report", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
      const { admin_id, year, month, period } = req.query;
      if (!admin_id || !year || !month || !period) return res.status(400).json({ message: 'البيانات غير مكتملة' });
      const y = parseInt(year as string);
      const m = parseInt(month as string);
      const p = parseInt(period as string);
      const startDay = p === 1 ? 1 : p === 2 ? 11 : 21;
      const endDay   = p === 1 ? 10 : p === 2 ? 20 : 31;
      const startDate = new Date(y, m - 1, startDay, 0, 0, 0).toISOString();
      const endDate   = new Date(y, m - 1, endDay, 23, 59, 59).toISOString();

      const [agenciesRes, supportersRes, adminRes] = await Promise.all([
        storage.supabase.from('agencies').select('*').eq('admin_id', admin_id).gte('created_at', startDate).lte('created_at', endDate).order('created_at', { ascending: true }),
        storage.supabase.from('supporters').select('*').eq('admin_id', admin_id).gte('created_at', startDate).lte('created_at', endDate).order('created_at', { ascending: true }),
        storage.supabase.from('users').select('id, username, full_name, platform_id').eq('id', admin_id as string).maybeSingle(),
      ]);

      if (agenciesRes.error) throw agenciesRes.error;
      if (supportersRes.error) throw supportersRes.error;

      const allAgencies  = agenciesRes.data || [];
      const agenciesOpened = allAgencies.filter((a: any) => a.status === 'opened');
      const supporters   = supportersRes.data || [];
      const admin        = adminRes.data;

      res.json({ agencies_activated: allAgencies, agencies_opened: agenciesOpened, supporters, admin });
    } catch (error: any) {
      console.error('Work report error:', error);
      res.status(500).json({ message: error?.message || 'حدث خطأ' });
    }
  });

  if (options.enableScheduler !== false) {
    // Auto-check on startup after 10 seconds
    setTimeout(async () => {
      try {
        console.log('[platform-check] بدء الفحص التلقائي الأول...');
        const n = await runPlatformCheck(storage.supabase);
        console.log(`[platform-check] اكتمل — ${n} تغيير`);
      } catch (e) {
        console.error('[platform-check] خطأ في الفحص الأول:', e);
      }
    }, 10_000);

    // Auto-check every 30 seconds
    setInterval(async () => {
      try {
        const n = await runPlatformCheck(storage.supabase);
        if (n > 0) console.log(`[platform-check] ${n} تغيير جديد`);
      } catch (e) {
        console.error('[platform-check] خطأ في الفحص الدوري:', e);
      }
    }, 30 * 1000);
  }

  return httpServer;
}
