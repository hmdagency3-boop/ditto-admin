import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  full_name: text("full_name").notNull(),
  role: text("role").notNull().default("admin"),
  status: text("status").notNull().default("pending"),
  phone: text("phone"),
  avatar_url: text("avatar_url"),
  device_fingerprint: text("device_fingerprint"),
  ip_address: text("ip_address"),
  approved_by: varchar("approved_by"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const attendance = pgTable("attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: varchar("user_id").notNull().references(() => users.id),
  check_in: timestamp("check_in").notNull(),
  check_out: timestamp("check_out"),
  date: text("date").notNull(),
  status: text("status").notNull().default("present"),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow(),
});

export const shifts = pgTable("shifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: varchar("user_id").notNull().references(() => users.id),
  date: text("date").notNull(),
  shift_number: integer("shift_number").notNull(), // 1-12 for 12 shifts per day
  created_by: varchar("created_by").notNull().references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
});

// Define the 12 fixed shift time slots
export const SHIFT_SLOTS = [
  { number: 1, start: "00:00", end: "02:00", label: "12:00 AM - 2:00 AM" },
  { number: 2, start: "02:00", end: "04:00", label: "2:00 AM - 4:00 AM" },
  { number: 3, start: "04:00", end: "06:00", label: "4:00 AM - 6:00 AM" },
  { number: 4, start: "06:00", end: "08:00", label: "6:00 AM - 8:00 AM" },
  { number: 5, start: "08:00", end: "10:00", label: "8:00 AM - 10:00 AM" },
  { number: 6, start: "10:00", end: "12:00", label: "10:00 AM - 12:00 PM" },
  { number: 7, start: "12:00", end: "14:00", label: "12:00 PM - 2:00 PM" },
  { number: 8, start: "14:00", end: "16:00", label: "2:00 PM - 4:00 PM" },
  { number: 9, start: "16:00", end: "18:00", label: "4:00 PM - 6:00 PM" },
  { number: 10, start: "18:00", end: "20:00", label: "6:00 PM - 8:00 PM" },
  { number: 11, start: "20:00", end: "22:00", label: "8:00 PM - 10:00 PM" },
  { number: 12, start: "22:00", end: "00:00", label: "10:00 PM - 12:00 AM" },
];

export const ratings = pgTable("ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: varchar("user_id").notNull().references(() => users.id),
  score: integer("score").notNull(),
  comment: text("comment"),
  rated_by: varchar("rated_by").notNull().references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
});

export const warnings = pgTable("warnings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: varchar("user_id").notNull().references(() => users.id),
  severity: text("severity").notNull(),
  reason: text("reason").notNull(),
  issued_by: varchar("issued_by").notNull().references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  full_name: true,
});

export const loginSchema = z.object({
  username: z.string().min(3, "اسم المستخدم يجب أن يكون 3 أحرف على الأقل"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
});

export const registerSchema = z.object({
  username: z.string().min(3, "اسم المستخدم يجب أن يكون 3 أحرف على الأقل"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  full_name: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UserRole = "super_admin" | "admin";
export type UserStatus = "pending" | "approved" | "rejected";
