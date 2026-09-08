import { type User, type InsertUser } from "../shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & {
    full_name: string;
    name?: string | null;
  }): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getPendingUsers(): Promise<User[]>;
  getRejectedUsers(): Promise<User[]>;
  approveUser(id: string, approvedBy: string): Promise<User | undefined>;
  rejectUser(id: string): Promise<User | undefined>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getSavedRooms(): Promise<SavedRoom[]>;
  saveRoom(room: InsertSavedRoom): Promise<SavedRoom>;
  deleteSavedRoom(roomId: string): Promise<boolean>;
  getListenHistory(limit?: number): Promise<ListenHistory[]>;
  addListenHistory(entry: InsertListenHistory): Promise<ListenHistory>;
}

export interface SavedRoom {
  id: string;
  room_id: string;
  room_name: string | null;
  cover: string | null;
  host_uid: string | null;
  host_nick: string | null;
  erban_no: string | null;
  country_code: string | null;
  channel: string | null;
  note: string | null;
  saved_by: string | null;
  created_at: string | null;
}

export interface InsertSavedRoom {
  room_id: string;
  room_name?: string | null;
  cover?: string | null;
  host_uid?: string | null;
  host_nick?: string | null;
  erban_no?: string | null;
  country_code?: string | null;
  channel?: string | null;
  note?: string | null;
  saved_by?: string | null;
}

export interface ListenHistory {
  id: string;
  room_id: string;
  room_name: string | null;
  cover: string | null;
  host_uid: string | null;
  host_nick: string | null;
  erban_no: string | null;
  country_code: string | null;
  action: string;
  listened_by: string | null;
  created_at: string | null;
}

export interface InsertListenHistory {
  room_id: string;
  room_name?: string | null;
  cover?: string | null;
  host_uid?: string | null;
  host_nick?: string | null;
  erban_no?: string | null;
  country_code?: string | null;
  action?: string;
  listened_by?: string | null;
}

export class SupabaseStorage implements IStorage {
  public supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required");
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      realtime: { transport: ws as any }
    });
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
    name?: string | null;
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

  async getRejectedUsers(): Promise<User[]> {
    const { data, error } = await this.supabase
      .from("users")
      .select("*")
      .eq("status", "rejected")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching rejected users:", error.message);
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

  async getSavedRooms(): Promise<SavedRoom[]> {
    const { data, error } = await this.supabase
      .from("saved_rooms")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching saved rooms:", error.message);
      return [];
    }
    return data as SavedRoom[];
  }

  async saveRoom(room: InsertSavedRoom): Promise<SavedRoom> {
    const { data, error } = await this.supabase
      .from("saved_rooms")
      .upsert(room, { onConflict: "room_id" })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as SavedRoom;
  }

  async deleteSavedRoom(roomId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("saved_rooms")
      .delete()
      .eq("room_id", roomId);

    if (error) {
      console.error("Error deleting saved room:", error.message);
      return false;
    }
    return true;
  }

  async getListenHistory(limit = 200): Promise<ListenHistory[]> {
    const { data, error } = await this.supabase
      .from("listen_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data as ListenHistory[];
  }

  async addListenHistory(entry: InsertListenHistory): Promise<ListenHistory> {
    const { data, error } = await this.supabase
      .from("listen_history")
      .insert({ action: "listen", ...entry })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as ListenHistory;
  }
}

export const storage = new SupabaseStorage();
