import { pgTable, text, timestamp, boolean, integer, jsonb, varchar, index } from "drizzle-orm/pg-core"

// --- better-auth required tables ---
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// --- app tables ---
export const identity = pgTable("identity", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
  companyName: text("company_name"),
  logoUrl: text("logo_url"),
  logoStorageKey: text("logo_storage_key"),
  // top-left | top-center | top-right | footer-left | footer-center | footer-right | none
  logoPosition: varchar("logo_position", { length: 20 }).notNull().default("none"),
  // footerText kept in DB but no longer used in UI (image footer replaces it)
  footerText: text("footer_text"),
  footerVariants: jsonb("footer_variants").$type<{ id: string; brief: string; createdAt: string }[]>().notNull().default([]),
  activeFooterVariantId: text("active_footer_variant_id"),
  website: text("website"),
  tagline: text("tagline"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const footerImage = pgTable("footer_image", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  storageKey: text("storage_key").notNull(),
  brief: text("brief"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("footer_image_user_idx").on(t.userId),
])

export const userSettings = pgTable("user_settings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
  byokApiKey: text("byok_api_key"),
  byokBaseUrl: text("byok_base_url"),
  byokModel: text("byok_model"),       // image model
  byokChatModel: text("byok_chat_model"), // chat/caption model
  plan: varchar("plan", { length: 20 }).notNull().default("free"), // free | byok | pro
  freeGenerationsUsed: integer("free_generations_used").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const subscription = pgTable("subscription", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  midtransOrderId: text("midtrans_order_id").unique(),
  midtransTransactionId: text("midtrans_transaction_id"),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | active | expired | cancelled
  planName: text("plan_name").notNull().default("pro"),
  amount: integer("amount").notNull().default(0),
  currency: varchar("currency", { length: 5 }).notNull().default("IDR"),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("subscription_user_idx").on(t.userId),
])

export const post = pgTable("post", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  title: text("title"),
  brief: text("brief").notNull(),
  aspectRatio: varchar("aspect_ratio", { length: 10 }).notNull().default("1:1"), // 1:1 | 4:5 | 9:16 | 16:9
  language: varchar("language", { length: 5 }).notNull().default("id"), // id | en
  slideCount: integer("slide_count").notNull().default(3),
  withSubject: boolean("with_subject").notNull().default(false),
  vibe: text("vibe").notNull().default("professional"),
  designStyle: varchar("design_style", { length: 30 }).notNull().default("realistic"),
  captionMode: varchar("caption_mode", { length: 10 }).notNull().default("raw_brief"), // text_ready | raw_brief
  slideBriefs: jsonb("slide_briefs").$type<string[]>().notNull().default([]),
  showFooter: boolean("show_footer").notNull().default(true),
  colorPalette: jsonb("color_palette").$type<string[]>().notNull().default([]),
  textPosition: varchar("text_position", { length: 20 }).notNull().default("auto"), // auto | left | center | right
  typographyStyle: varchar("typography_style", { length: 30 }).notNull().default("auto"), // auto | bold | serif | sans | handwritten | decorative
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | generating | done | error
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("post_user_idx").on(t.userId),
])

export const slide = pgTable("slide", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull().references(() => post.id, { onDelete: "cascade" }),
  order: integer("order").notNull().default(0),
  imageUrl: text("image_url"),
  imagePrompt: text("image_prompt"),
  caption: text("caption"),
  hashtags: text("hashtags"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("slide_post_idx").on(t.postId),
])

import { relations } from "drizzle-orm"

export const postRelations = relations(post, ({ many }) => ({
  slides: many(slide),
}))

export const slideRelations = relations(slide, ({ one }) => ({
  post: one(post, { fields: [slide.postId], references: [post.id] }),
}))

export type User = typeof user.$inferSelect
export type Identity = typeof identity.$inferSelect
export type UserSettings = typeof userSettings.$inferSelect
export type Post = typeof post.$inferSelect
export type Slide = typeof slide.$inferSelect
export type Subscription = typeof subscription.$inferSelect
export type FooterImage = typeof footerImage.$inferSelect
