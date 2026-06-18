import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { full_name: string }): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getPendingUsers(): Promise<User[]>;
  approveUser(id: string, approvedBy: string): Promise<User | undefined>;
  rejectUser(id: string): Promise<User | undefined>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
}

export class PgStorage implements IStorage {
  public pool: pg.Pool;

  constructor() {
    this.pool = pool;
    this.initializeSuperAdmin();
  }

  async query(text: string, params?: any[]) {
    return this.pool.query(text, params);
  }

  private async initializeSuperAdmin() {
    try {
      const { rows } = await this.pool.query(
        "SELECT * FROM users WHERE role = 'super_admin' LIMIT 1"
      );

      if (rows.length === 0) {
        const hashedPassword = await bcrypt.hash("admin123", 10);
        await this.pool.query(
          `INSERT INTO users (id, username, password, full_name, name, role, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [randomUUID(), "admin", hashedPassword, "المسؤول الرئيسي", "admin", "super_admin", "approved"]
        );
        console.log("Super admin created - Username: admin, Password: admin123");
      } else {
        console.log("Super admin already exists");
      }
    } catch (error: any) {
      console.log("Waiting for users table...", error.message);
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const { rows } = await this.pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return rows[0] as User | undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { rows } = await this.pool.query("SELECT * FROM users WHERE username = $1", [username]);
    return rows[0] as User | undefined;
  }

  async createUser(insertUser: InsertUser & {
    full_name: string;
    device_fingerprint?: string | null;
    ip_address?: string | null;
  }): Promise<User> {
    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);

    const { rows } = await this.pool.query(
      `INSERT INTO users (id, username, password, full_name, name, role, status, device_fingerprint, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        insertUser.username,
        hashedPassword,
        insertUser.full_name,
        insertUser.username,
        "admin",
        "pending",
        insertUser.device_fingerprint || null,
        insertUser.ip_address || null,
      ]
    );

    return rows[0] as User;
  }

  async getAllUsers(): Promise<User[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM users ORDER BY created_at DESC"
    );
    return rows as User[];
  }

  async getPendingUsers(): Promise<User[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM users WHERE status = 'pending' ORDER BY created_at DESC"
    );
    return rows as User[];
  }

  async approveUser(id: string, approvedBy: string): Promise<User | undefined> {
    const { rows } = await this.pool.query(
      `UPDATE users SET status = 'approved', approved_by = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [approvedBy, id]
    );
    return rows[0] as User | undefined;
  }

  async rejectUser(id: string): Promise<User | undefined> {
    const { rows } = await this.pool.query(
      `UPDATE users SET status = 'rejected', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0] as User | undefined;
  }

  async updateUser(id: string, updateData: Partial<User>): Promise<User | undefined> {
    const keys = Object.keys(updateData).filter(k => k !== 'id');
    if (keys.length === 0) return this.getUser(id);

    const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
    const values = keys.map(k => (updateData as any)[k]);
    values.push(id);

    const { rows } = await this.pool.query(
      `UPDATE users SET ${setClauses}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values
    );
    return rows[0] as User | undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query("DELETE FROM users WHERE id = $1", [id]);
    return (rowCount ?? 0) > 0;
  }
}

export const storage = new PgStorage();
