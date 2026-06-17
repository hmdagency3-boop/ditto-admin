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
        ip_address,
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
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.get("/api/users", authenticateToken, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(
        users.map((u) => ({
          id: u.id,
          username: u.username,
          full_name: u.full_name,
          role: u.role,
          status: u.status,
          phone: u.phone,
          avatar_url: u.avatar_url,
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

      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;

      if (full_name !== undefined) {
        setClauses.push(`full_name = $${paramIdx++}`, `name = $${paramIdx++}`);
        values.push(full_name, full_name);
      }
      if (phone !== undefined) {
        setClauses.push(`phone = $${paramIdx++}`);
        values.push(phone);
      }
      if (platform_id !== undefined) {
        setClauses.push(`platform_id = $${paramIdx++}`);
        values.push(platform_id);
      }
      if (password && password.trim().length > 0) {
        const hashed = await bcrypt.hash(password, 10);
        setClauses.push(`password = $${paramIdx++}`);
        values.push(hashed);
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(id);

      const result = await storage.query(
        `UPDATE users SET ${setClauses.join(", ")} WHERE id = $${paramIdx} RETURNING id, username, full_name, phone, platform_id, role, status`,
        values
      );

      if (!result[0]) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }

      res.json({ message: "تم تحديث البيانات بنجاح", data: result[0] });
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
      const rows = await storage.query("SELECT * FROM shifts ORDER BY shift_number ASC");
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

      const existing = await storage.query(
        "SELECT id FROM shifts WHERE shift_number = $1 AND user_id = $2",
        [shift_number, user_id]
      );

      if (existing.length > 0) {
        return res.status(400).json({ message: "هذا المشرف مسجل بالفعل في هذا الشيفت" });
      }

      const rows = await storage.query(
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
      await storage.query("DELETE FROM shifts WHERE id = $1", [id]);
      res.json({ message: "تم حذف المشرف من الشيفت بنجاح" });
    } catch (error) {
      console.error("Delete shift error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  // Attendance endpoints
  app.get("/api/attendance", authenticateToken, async (req, res) => {
    try {
      const rows = await storage.query("SELECT * FROM attendance ORDER BY date DESC");
      res.json(rows);
    } catch (error) {
      console.error("Get attendance error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/attendance", authenticateToken, async (req, res) => {
    try {
      const { user_id, check_in, date, status } = req.body;

      const rows = await storage.query(
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

      const rows = await storage.query(
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
      const rows = await storage.query("SELECT * FROM ratings ORDER BY created_at DESC");
      res.json(rows);
    } catch (error) {
      console.error("Get ratings error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/ratings", authenticateToken, async (req, res) => {
    try {
      const { user_id, score, comment } = req.body;

      const rows = await storage.query(
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
      const rows = await storage.query("SELECT * FROM warnings ORDER BY created_at DESC");
      res.json(rows);
    } catch (error) {
      console.error("Get warnings error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  app.post("/api/warnings", authenticateToken, async (req, res) => {
    try {
      const { user_id, severity, reason } = req.body;

      const rows = await storage.query(
        `INSERT INTO warnings (user_id, severity, reason, issued_by) VALUES ($1, $2, $3, $4) RETURNING *`,
        [user_id, severity, reason, req.user!.userId]
      );

      res.status(201).json({ message: "تم إصدار التحذير", data: rows[0] });
    } catch (error) {
      console.error("Create warning error:", error);
      res.status(500).json({ message: "حدث خطأ" });
    }
  });

  return httpServer;
}
