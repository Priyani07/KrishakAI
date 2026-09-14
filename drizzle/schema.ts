import { AnyMySqlColumn, bigint, datetime, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const communityUsers = mysqlTable("community_users", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  farmName: varchar("farm_name", { length: 160 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["farmer", "admin"]).default("farmer").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const communitySessions = mysqlTable("community_sessions", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  jti: varchar("jti", { length: 36 }).notNull().unique(),
  expiresAt: datetime("expires_at").notNull(),
  revokedAt: datetime("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const communityDiscussions = mysqlTable("community_discussions", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  problemType: varchar("problem_type", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const communityComments = mysqlTable("community_comments", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  discussionId: bigint("discussion_id", { mode: "number", unsigned: true }).notNull().references(() => communityDiscussions.id, { onDelete: "cascade" }),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => communityUsers.id, { onDelete: "cascade" }),
  parentCommentId: bigint("parent_comment_id", { mode: "number", unsigned: true }).references((): AnyMySqlColumn => communityComments.id, { onDelete: "restrict" }),
  text: text("text").notNull(),
  deletedAt: datetime("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("community_comments_discussion_created_idx").on(table.discussionId, table.createdAt),
  index("community_comments_parent_created_idx").on(table.parentCommentId, table.createdAt),
  index("community_comments_user_idx").on(table.userId),
]);

export const communityComplaints = mysqlTable("community_complaints", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  subject: varchar("subject", { length: 200 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  description: text("description").notNull(),
  location: varchar("location", { length: 200 }).notNull(),
  status: mysqlEnum("status", ["submitted", "in_review", "resolved"]).default("submitted").notNull(),
  solution: text("solution"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type CommunityUser = typeof communityUsers.$inferSelect;
export type CommunitySession = typeof communitySessions.$inferSelect;
export type CommunityDiscussion = typeof communityDiscussions.$inferSelect;
export type CommunityComment = typeof communityComments.$inferSelect;
export type CommunityComplaint = typeof communityComplaints.$inferSelect;
