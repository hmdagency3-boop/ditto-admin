import { type User, type InsertUser, users, attendance, shifts, ratings, warnings } from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc } from "drizzle-orm";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { full_name: string; device_fingerprint?: string | null; ip_address?: string | null }): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getPendingUsers(): Promise<User[]>;
  approveUser(id: string, approvedBy: string): Promise<User | undefined>;
  rejectUser(id: string): Promise<User | undefined>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    this.initializeSuperAdmin();
  }

  private async initializeSuperAdmin() {
    try {
      const existing = await db.select().from(users).where(eq(users.role, "super_admin")).limit(1);
      if (existing.length === 0) {
        const hashedPassword = await bcrypt.hash("admin123", 10);
        await db.insert(users).values({
          id: randomUUID(),
          username: "admin",
          password: hashedPassword,
          full_name: "المسؤول الرئيسي",
          role: "super_admin",
          status: "approved",
        });
        console.log("Super admin created - Username: admin, Password: admin123");
      } else {
        console.log("Super admin already exists");
      }
    } catch (error) {
      console.log("Waiting for database tables to be ready...", error);
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser & {
    full_name: string;
    device_fingerprint?: string | null;
    ip_address?: string | null;
  }): Promise<User> {
    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);

    const result = await db.insert(users).values({
      id,
      username: insertUser.username,
      password: hashedPassword,
      full_name: insertUser.full_name,
      role: "admin",
      status: "pending",
      device_fingerprint: insertUser.device_fingerprint ?? null,
      ip_address: insertUser.ip_address ?? null,
    }).returning();

    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.created_at));
  }

  async getPendingUsers(): Promise<User[]> {
    return db.select().from(users).where(eq(users.status, "pending")).orderBy(desc(users.created_at));
  }

  async approveUser(id: string, approvedBy: string): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ status: "approved", approved_by: approvedBy, updated_at: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async rejectUser(id: string): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ status: "rejected", updated_at: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async updateUser(id: string, updateData: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ ...updateData, updated_at: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
export { db as supabase };
