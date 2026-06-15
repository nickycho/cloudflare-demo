// apps/api/src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  password_hash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'student'] }).notNull().default('student'),
  created_at: integer('created_at').notNull(),
})

export const courses = sqliteTable('courses', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  thumbnail_key: text('thumbnail_key'),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull(),
})

export const videos = sqliteTable('videos', {
  id: text('id').primaryKey(),
  course_id: text('course_id').notNull().references(() => courses.id),
  title: text('title').notNull(),
  order: integer('order').notNull().default(0),
  stream_video_id: text('stream_video_id'),
  status: text('status', { enum: ['processing', 'ready'] }).notNull().default('processing'),
  summary: text('summary'),
  transcript: text('transcript'),
  created_at: integer('created_at').notNull(),
})

export const enrollments = sqliteTable('enrollments', {
  user_id: text('user_id').notNull().references(() => users.id),
  course_id: text('course_id').notNull().references(() => courses.id),
  enrolled_at: integer('enrolled_at').notNull(),
})

export const watchProgress = sqliteTable('watch_progress', {
  user_id: text('user_id').notNull().references(() => users.id),
  video_id: text('video_id').notNull().references(() => videos.id),
  progress_sec: integer('progress_sec').notNull().default(0),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  last_watched_at: integer('last_watched_at').notNull(),
})
