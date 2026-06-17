import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

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
  query(sql: string, params?: any[]): Promise<any[]>;
}

export class PostgresStorage implements IStorage {
  public pool: Pool;

  constructor() {
    this.pool = pool;
    this.initializeSchema();
  }

  async query(sql: string, params?: any[]): Promise<any[]> {
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  private async initializeSchema() {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          full_name TEXT NOT NULL,
          name TEXT,
          role TEXT NOT NULL DEFAULT 'admin',
          status TEXT NOT NULL DEFAULT 'pending',
          phone TEXT,
          avatar_url TEXT,
          platform_id TEXT,
          device_fingerprint TEXT,
          ip_address TEXT,
          approved_by VARCHAR,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS attendance (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
          user_id VARCHAR NOT NULL REFERENCES users(id),
          check_in TIMESTAMPTZ NOT NULL,
          check_out TIMESTAMPTZ,
          date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'present',
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS shifts (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
          user_id VARCHAR NOT NULL REFERENCES users(id),
          date TEXT NOT NULL DEFAULT '',
          shift_number INTEGER NOT NULL,
          created_by VARCHAR NOT NULL REFERENCES users(id),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS ratings (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
          user_id VARCHAR NOT NULL REFERENCES users(id),
          score INTEGER NOT NULL,
          comment TEXT,
          rated_by VARCHAR NOT NULL REFERENCES users(id),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS warnings (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
          user_id VARCHAR NOT NULL REFERENCES users(id),
          severity TEXT NOT NULL,
          reason TEXT NOT NULL,
          issued_by VARCHAR NOT NULL REFERENCES users(id),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await this.initializeSuperAdmin();
    } catch (error) {
      console.error("Error initializing schema:", error);
    }
  }

  private async initializeSuperAdmin() {
    try {
      const result = await this.pool.query(
        "SELECT id FROM users WHERE role = 'super_admin' LIMIT 1"
      );

      if (result.rows.length === 0) {
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
    } catch (error) {
      console.error("Error initializing super admin:", error);
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await this.pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return result.rows[0] as User | undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.pool.query("SELECT * FROM users WHERE username = $1", [username]);
    return result.rows[0] as User | undefined;
  }

  async createUser(insertUser: InsertUser & {
    full_name: string;
    device_fingerprint?: string | null;
    ip_address?: string | null;
  }): Promise<User> {
    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);

    const result = await this.pool.query(
      `INSERT INTO users (id, username, password, full_name, name, role, status, device_fingerprint, ip_address)
       VALUES ($1, $2, $3, $4, $5, 'admin', 'pending', $6, $7)
       RETURNING *`,
      [id, insertUser.username, hashedPassword, insertUser.full_name, insertUser.username,
       insertUser.device_fingerprint || null, insertUser.ip_address || null]
    );

    return result.rows[0] as User;
  }

  async getAllUsers(): Promise<User[]> {
    const result = await this.pool.query("SELECT * FROM users ORDER BY created_at DESC");
    return result.rows as User[];
  }

  async getPendingUsers(): Promise<User[]> {
    const result = await this.pool.query(
      "SELECT * FROM users WHERE status = 'pending' ORDER BY created_at DESC"
    );
    return result.rows as User[];
  }

  async approveUser(id: string, approvedBy: string): Promise<User | undefined> {
    const result = await this.pool.query(
      `UPDATE users SET status = 'approved', approved_by = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [approvedBy, id]
    );
    return result.rows[0] as User | undefined;
  }

  async rejectUser(id: string): Promise<User | undefined> {
    const result = await this.pool.query(
      `UPDATE users SET status = 'rejected', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] as User | undefined;
  }

  async updateUser(id: string, updateData: Partial<User>): Promise<User | undefined> {
    const fields = Object.keys(updateData)
      .filter(k => k !== 'id')
      .map((k, i) => `${k} = $${i + 2}`)
      .join(", ");
    const values = Object.values(updateData).filter((_, i) => Object.keys(updateData)[i] !== 'id');

    if (!fields) return this.getUser(id);

    const result = await this.pool.query(
      `UPDATE users SET ${fields}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0] as User | undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    await this.pool.query("DELETE FROM ratings WHERE user_id = $1 OR rated_by = $1", [id]);
    await this.pool.query("DELETE FROM warnings WHERE user_id = $1 OR issued_by = $1", [id]);
    await this.pool.query("DELETE FROM attendance WHERE user_id = $1", [id]);
    await this.pool.query("DELETE FROM shifts WHERE user_id = $1 OR created_by = $1", [id]);
    const result = await this.pool.query("DELETE FROM users WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

export const storage = new PostgresStorage();
