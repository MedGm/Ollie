use sqlx::{SqlitePool, sqlite::SqlitePoolOptions};
use std::path::PathBuf;
use std::fs;
use tokio::sync::Mutex;

lazy_static::lazy_static! {
	static ref POOL: Mutex<Option<SqlitePool>> = Mutex::new(None);
}

fn data_dir() -> Result<PathBuf, String> {
	let home = std::env::var("HOME").map_err(|e| format!("Cannot read HOME env var: {}", e))?;
	let dir = PathBuf::from(home).join(".config").join("ollie");
	if !dir.exists() {
		fs::create_dir_all(&dir).map_err(|e| format!("Failed to create data dir {}: {}", dir.display(), e))?;
	}
	Ok(dir)
}

// DB file path: ~/.config/ollama-gui/app.db
fn db_path() -> Result<PathBuf, String> { Ok(data_dir()?.join("app.db")) }

pub async fn get_pool() -> Result<SqlitePool, String> {
	let mut guard = POOL.lock().await;
	if let Some(pool) = &*guard {
		return Ok(pool.clone());
	}
	let path = db_path()?;
	// Ensure DB file exists to avoid SQLITE_CANTOPEN (code 14)
	if !path.exists() {
		fs::File::create(&path).map_err(|e| format!("Failed to create db file: {}", e))?;
	}
	// Use proper SQLite URL and open mode (read/write/create)
	let conn_str = format!("sqlite://{}?mode=rwc", path.to_string_lossy());
	let pool = SqlitePoolOptions::new()
		.max_connections(5)
		.connect(&conn_str)
		.await
		.map_err(|e| format!("DB connect failed: {}", e))?;

	// Apply minimal schema (execute statements individually for SQLite)
	// Enable WAL and foreign keys
	sqlx::query("PRAGMA journal_mode=WAL;")
		.execute(&pool)
		.await
		.map_err(|e| format!("DB pragma failed: {}", e))?;
	sqlx::query("PRAGMA foreign_keys=ON;")
		.execute(&pool)
		.await
		.map_err(|e| format!("DB pragma foreign_keys failed: {}", e))?;
	sqlx::query(
		r#"CREATE TABLE IF NOT EXISTS chats (
			id TEXT PRIMARY KEY,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			model TEXT,
			system_prompt TEXT,
			params_json TEXT,
			title TEXT
		)"#
	).execute(&pool).await.map_err(|e| format!("DB migrate chats failed: {}", e))?;
	
	// Migration: Attempt to add title column for existing databases (silently fail if exists)
	let _ = sqlx::query("ALTER TABLE chats ADD COLUMN title TEXT").execute(&pool).await;
	sqlx::query(
		r#"CREATE TABLE IF NOT EXISTS messages (
			id TEXT PRIMARY KEY,
			chat_id TEXT NOT NULL,
			role TEXT NOT NULL,
			content TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			meta_json TEXT,
			FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
		)"#
	).execute(&pool).await.map_err(|e| format!("DB migrate messages failed: {}", e))?;

	*guard = Some(pool.clone());
	Ok(pool)
}

pub async fn touch_chat_updated(pool: &SqlitePool, chat_id: &str) -> Result<(), String> {
	let now = chrono::Utc::now().timestamp_millis();
	sqlx::query("UPDATE chats SET updated_at=? WHERE id=?")
		.bind(now)
		.bind(chat_id)
		.execute(pool)
		.await
		.map_err(|e| format!("Failed to update chat: {}", e))?;
	Ok(())
}
