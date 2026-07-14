-- Starter schema + seed data for the advanced example.
-- Apply this to your D1 database before running the admin UI.

DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS posts;

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  is_featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO users (email, is_admin) VALUES
  ('admin@example.com', 1),
  ('user@example.com', 0);

INSERT INTO posts (user_id, title, body, status, is_featured) VALUES
  (1, 'Hello World', 'First post body', 'published', 1),
  (2, 'Draft Post', 'Work in progress', 'draft', 0);

