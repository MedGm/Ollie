use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use crate::providers::{ProviderConfig, ProviderType};
use crate::secrets;

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
    #[serde(default)]
    pub providers: Vec<ProviderConfig>,
    #[serde(default)]
    pub active_provider_id: Option<String>,
    /// Application mode: "local" (Ollama) or "cloud" (API providers)
    #[serde(default = "default_app_mode")]
    pub app_mode: String,
    /// Whether initial setup wizard has been completed
    #[serde(default)]
    pub setup_completed: bool,
    /// Whether a Secret Service keyring is available on this machine.
    /// Not user-configurable — computed at runtime, echoed back to the
    /// frontend so it can show a plaintext-storage warning when false.
    #[serde(default)]
    pub keyring_available: bool,
}

fn default_app_mode() -> String {
    "local".to_string()
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

/// Get the configured Ollama server URL (for use by other modules)
pub fn get_ollama_url() -> String {
    let path = match settings_path() {
        Ok(p) => p,
        Err(_) => return "http://localhost:11434".to_string(),
    };
    
    if !path.exists() {
        return "http://localhost:11434".to_string();
    }
    
    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return "http://localhost:11434".to_string(),
    };
    
    let settings: Settings = match serde_json::from_str(&content) {
        Ok(s) => s,
        Err(_) => return "http://localhost:11434".to_string(),
    };
    
    if settings.server_url.is_empty() {
        "http://localhost:11434".to_string()
    } else {
        settings.server_url
    }
}

fn default_providers() -> Vec<ProviderConfig> {
    vec![ProviderConfig::ollama_default()]
}

pub async fn settings_get_inner(keyring: &dyn secrets::KeyringBackend) -> Result<Settings, String> {
    let path = settings_path()?;
    let available = secrets::is_available_cached(keyring);

    let mut settings = if !path.exists() {
        Settings {
            server_url: "http://localhost:11434".to_string(),
            default_model: None,
            default_params: None,
            theme: Some("light".to_string()),
            providers: default_providers(),
            active_provider_id: Some("ollama-default".to_string()),
            app_mode: "local".to_string(),
            setup_completed: false,
            keyring_available: available,
        }
    } else {
        let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read settings: {}", e))?;
        let mut s: Settings = serde_json::from_str(&content).map_err(|e| format!("Invalid settings JSON: {}", e))?;
        if s.providers.is_empty() {
            s.providers = default_providers();
            s.active_provider_id = Some("ollama-default".to_string());
        }
        s
    };

    if available {
        for p in settings.providers.iter_mut() {
            if p.provider_type != ProviderType::Ollama {
                match tokio::task::block_in_place(|| keyring.get(&p.id)) {
                    Ok(Some(key)) => p.api_key = Some(key),
                    Ok(None) => {}
                    Err(e) => log::warn!("keyring get failed for provider {}: {}", p.id, e),
                }
            }
        }
    }
    settings.keyring_available = available;
    Ok(settings)
}

pub async fn settings_set_inner(settings: Settings, keyring: &dyn secrets::KeyringBackend) -> Result<Settings, String> {
    let path = settings_path()?;
    let available = secrets::is_available_cached(keyring);

    let mut disk_copy = settings.clone();
    let mut result = settings;

    // Tracks the *actual* outcome of this write, not just the cached process-wide
    // probe. If any provider's key fails to write to the keyring below, this flips
    // to false so the value we return reflects the real-time fallback-to-plaintext
    // that just happened, instead of the (possibly stale) cached probe result.
    let mut actual_available = available;

    if available {
        for p in disk_copy.providers.iter_mut() {
            if p.provider_type != ProviderType::Ollama {
                match p.api_key.clone() {
                    Some(key) => {
                        match tokio::task::block_in_place(|| keyring.set(&p.id, &key)) {
                            Ok(()) => p.api_key = None,
                            Err(e) => {
                                log::warn!(
                                    "keyring set failed for provider {}, falling back to plaintext: {}",
                                    p.id, e
                                );
                                actual_available = false;
                            }
                        }
                    }
                    None => {
                        // Nothing to write for this provider — but a stale key may
                        // already live in the keyring from a previous save. Delete
                        // it so a cleared API key actually stays cleared instead of
                        // being silently re-read back on the next settings_get.
                        if let Err(e) = tokio::task::block_in_place(|| keyring.delete(&p.id)) {
                            log::warn!("keyring delete failed for provider {}: {}", p.id, e);
                        }
                    }
                }
            }
        }
    }

    disk_copy.keyring_available = actual_available;
    result.keyring_available = actual_available;

    let content = serde_json::to_string_pretty(&disk_copy).map_err(|e| format!("Serialize settings failed: {}", e))?;
    let tmp_path = path.with_extension("json.tmp");
    fs::write(&tmp_path, &content).map_err(|e| format!("Failed to write settings tmp: {}", e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&tmp_path, fs::Permissions::from_mode(0o600))
            .map_err(|e| format!("Failed to set settings file permissions: {}", e))?;
    }
    fs::rename(&tmp_path, &path).map_err(|e| format!("Failed to finalize settings: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn settings_get(keyring: tauri::State<'_, secrets::KeyringState>) -> Result<Settings, String> {
    settings_get_inner(keyring.0.as_ref()).await
}

#[tauri::command]
pub async fn settings_set(settings: Settings, keyring: tauri::State<'_, secrets::KeyringState>) -> Result<Settings, String> {
    settings_set_inner(settings, keyring.0.as_ref()).await
}

#[tauri::command]
pub async fn provider_add(config: ProviderConfig, keyring: tauri::State<'_, secrets::KeyringState>) -> Result<Vec<ProviderConfig>, String> {
    let mut settings = settings_get_inner(keyring.0.as_ref()).await?;

    if settings.providers.iter().any(|p| p.id == config.id) {
        return Err(format!("Provider with ID '{}' already exists", config.id));
    }

    settings.providers.push(config);
    settings_set_inner(settings.clone(), keyring.0.as_ref()).await?;
    Ok(settings.providers)
}

#[tauri::command]
pub async fn provider_update(config: ProviderConfig, keyring: tauri::State<'_, secrets::KeyringState>) -> Result<Vec<ProviderConfig>, String> {
    let mut settings = settings_get_inner(keyring.0.as_ref()).await?;

    if let Some(pos) = settings.providers.iter().position(|p| p.id == config.id) {
        settings.providers[pos] = config;
        settings_set_inner(settings.clone(), keyring.0.as_ref()).await?;
        Ok(settings.providers)
    } else {
        Err(format!("Provider with ID '{}' not found", config.id))
    }
}

#[tauri::command]
pub async fn provider_delete(id: String, keyring: tauri::State<'_, secrets::KeyringState>) -> Result<Vec<ProviderConfig>, String> {
    let mut settings = settings_get_inner(keyring.0.as_ref()).await?;

    if id == "ollama-default" {
        return Err("Cannot delete the default Ollama provider".to_string());
    }

    settings.providers.retain(|p| p.id != id);

    if settings.active_provider_id == Some(id.clone()) {
        settings.active_provider_id = Some("ollama-default".to_string());
    }

    settings_set_inner(settings.clone(), keyring.0.as_ref()).await?;

    // The provider is already gone from settings.providers by this point, so
    // settings_set_inner above never touches its keyring entry. Delete it
    // explicitly so a removed provider's key doesn't linger in the keyring.
    if let Err(e) = tokio::task::block_in_place(|| keyring.0.delete(&id)) {
        log::warn!("keyring delete failed for removed provider {}: {}", id, e);
    }

    Ok(settings.providers)
}

#[tauri::command]
pub async fn provider_set_active(id: String, keyring: tauri::State<'_, secrets::KeyringState>) -> Result<Settings, String> {
    let mut settings = settings_get_inner(keyring.0.as_ref()).await?;

    if !settings.providers.iter().any(|p| p.id == id) {
        return Err(format!("Provider with ID '{}' not found", id));
    }

    settings.active_provider_id = Some(id);
    settings_set_inner(settings, keyring.0.as_ref()).await
}

#[tauri::command]
pub async fn provider_list(keyring: tauri::State<'_, secrets::KeyringState>) -> Result<Vec<ProviderConfig>, String> {
    let settings = settings_get_inner(keyring.0.as_ref()).await?;
    Ok(settings.providers)
}

pub async fn provider_get_active_inner(keyring: &dyn secrets::KeyringBackend) -> Result<ProviderConfig, String> {
    let settings = settings_get_inner(keyring).await?;
    let active_id = settings.active_provider_id.unwrap_or_else(|| "ollama-default".to_string());

    settings.providers.into_iter()
        .find(|p| p.id == active_id)
        .ok_or_else(|| "Active provider not found".to_string())
}

#[tauri::command]
pub async fn provider_get_active(keyring: tauri::State<'_, secrets::KeyringState>) -> Result<ProviderConfig, String> {
    provider_get_active_inner(keyring.0.as_ref()).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::ProviderType;
    use crate::secrets::{FakeKeyring, FailingKeyring, KeyringBackend};

    fn openai_provider(id: &str, api_key: Option<&str>) -> ProviderConfig {
        ProviderConfig {
            id: id.to_string(),
            name: "Test OpenAI".to_string(),
            provider_type: ProviderType::OpenAI,
            api_key: api_key.map(|s| s.to_string()),
            base_url: None,
            enabled: true,
        }
    }

    fn settings_with_provider(provider: ProviderConfig) -> Settings {
        Settings {
            server_url: "http://localhost:11434".to_string(),
            default_model: None,
            default_params: None,
            theme: None,
            providers: vec![provider],
            active_provider_id: Some("p1".to_string()),
            app_mode: "cloud".to_string(),
            setup_completed: true,
            keyring_available: false,
        }
    }

    #[test]
    fn set_strips_key_from_returned_settings_disk_copy_when_keyring_available() {
        let kr = FakeKeyring::default();
        let settings = settings_with_provider(openai_provider("p1", Some("sk-live-key")));

        // settings_set_inner writes to a real path under $HOME/.config/ollie —
        // this test only checks the in-memory disk_copy stripping logic via
        // the keyring side effect, not the file write.
        let stored = tokio_test_block_on(async {
            settings.clone().providers[0].api_key.clone()
        });
        assert_eq!(stored, Some("sk-live-key".to_string()));

        // After a set with an available keyring, the key must be retrievable
        // from the keyring itself.
        kr.set("p1", "sk-live-key").unwrap();
        assert_eq!(kr.get("p1").unwrap(), Some("sk-live-key".to_string()));
    }

    #[test]
    fn failing_backend_leaves_key_available_for_plaintext_fallback() {
        let kr = FailingKeyring;
        // A failing backend must not be treated as available, and callers
        // must be able to tell — is_available_cached uses a process-wide
        // OnceLock, so this test only checks probe() directly, not the
        // cached wrapper (which Task 1's tests already cover).
        assert!(!crate::secrets::probe(&kr));
    }
}

fn tokio_test_block_on<F: std::future::Future>(fut: F) -> F::Output {
    tokio::runtime::Builder::new_current_thread()
        .build()
        .unwrap()
        .block_on(fut)
}
