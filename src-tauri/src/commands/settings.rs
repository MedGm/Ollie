use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DefaultParams {
    pub temperature: Option<f64>,
    pub top_k: Option<i32>,
    pub top_p: Option<f64>,
    pub max_tokens: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub server_url: String,
    pub default_model: Option<String>,
    pub default_params: Option<DefaultParams>,
    pub theme: Option<String>,
}

fn config_dir() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|e| format!("Cannot read HOME: {}", e))?;
    let dir = PathBuf::from(home).join(".config").join("ollie");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config dir: {}", e))?;
    }
    Ok(dir)
}

fn settings_path() -> Result<PathBuf, String> { Ok(config_dir()?.join("settings.json")) }

#[tauri::command]
pub async fn settings_get() -> Result<Settings, String> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok(Settings {
            server_url: "http://localhost:11434".to_string(),
            default_model: None,
            default_params: None,
            theme: Some("light".to_string()),
        });
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read settings: {}", e))?;
    serde_json::from_str::<Settings>(&content).map_err(|e| format!("Invalid settings JSON: {}", e))
}

#[tauri::command]
pub async fn settings_set(settings: Settings) -> Result<Settings, String> {
    let path = settings_path()?;
    let content = serde_json::to_string_pretty(&settings).map_err(|e| format!("Serialize settings failed: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write settings: {}", e))?;
    Ok(settings)
}
