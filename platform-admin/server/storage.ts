import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

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

export class SupabaseStorage implements IStorage {
  public supabase: SupabaseClient;

  constructor() {
    // ثابت دائماً — لا يتغير بتغيير البيئة أو الأكونت
    const supabaseUrl = 'https://hijmdaiwxhcrvxqmgxsy.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhpam1kYWl3eGhjcnZ4cW1neHN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTQ3NjIsImV4cCI6MjA5Njg3MDc2Mn0.iPjxByKPCxuFR-UBPCSH56dMDPWQ3ZufBfZ3Z5dFHUs';

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.initializeSuperAdmin();
  }

  private async initializeSuperAdmin() {
    try {
      const { data: existingSuperAdmin } = await this.supabase
        .from("users")
        .select("*")
        .eq("role", "super_admin")
        .limit(1)
        .single();

      if (!existingSuperAdmin) {
        const hashedPassword = await bcrypt.hash("admin123", 10);
        const { error } = await this.supabase.from("users").insert({
          id: randomUUID(),
          username: "admin",
          password: hashedPassword,
          full_name: "المسؤول الرئيسي",
          name: "admin",
          role: "super_admin",
          status: "approved",
        });

        if (error) {
          console.error("Error creating super admin:", error.message);
        } else {
          console.log("Super admin created - Username: admin, Password: admin123");
        }
      } else {
        console.log("Super admin already exists");
      }
    } catch (error) {
      console.log("Waiting for users table to be created in Supabase...");
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const { data, error } = await this.supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return undefined;
    return data as User;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { data, error } = await this.supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !data) return undefined;
    return data as User;
  }

  async createUser(insertUser: InsertUser & {
    full_name: string;
    device_fingerprint?: string | null;
    ip_address?: string | null;
  }): Promise<User> {
    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);

    const newUser = {
      id,
      username: insertUser.username,
      password: hashedPassword,
      full_name: insertUser.full_name,
      name: insertUser.username,
      role: "admin",
      status: "pending",
    };

    const { data, error } = await this.supabase
      .from("users")
      .insert(newUser)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as User;
  }

  async getAllUsers(): Promise<User[]> {
    const { data, error } = await this.supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching users:", error.message);
      return [];
    }
    return data as User[];
  }

  async getPendingUsers(): Promise<User[]> {
    const { data, error } = await this.supabase
      .from("users")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching pending users:", error.message);
      return [];
    }
    return data as User[];
  }

  async approveUser(id: string, approvedBy: string): Promise<User | undefined> {
    const { data, error } = await this.supabase
      .from("users")
      .update({
        status: "approved",
        approved_by: approvedBy,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error approving user:", error.message);
      return undefined;
    }
    return data as User;
  }

  async rejectUser(id: string): Promise<User | undefined> {
    const { data, error } = await this.supabase
      .from("users")
      .update({
        status: "rejected",
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error rejecting user:", error.message);
      return undefined;
    }
    return data as User;
  }

  async updateUser(id: string, updateData: Partial<User>): Promise<User | undefined> {
    const { data, error } = await this.supabase
      .from("users")
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating user:", error.message);
      return undefined;
    }
    return data as User;
  }

  async deleteUser(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("users")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting user:", error.message);
      return false;
    }
    return true;
  }
}

export const storage = new SupabaseStorage();
