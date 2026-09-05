mod commands;
mod db;
mod mcp;
mod providers;
mod secrets;

use tauri::Manager;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::sync::atomic::AtomicBool;
use tokio::sync::Mutex as TokioMutex;

pub struct AppStreams(pub Arc<TokioMutex<HashMap<String, Arc<AtomicBool>>>>);
pub struct MonitoringState(pub Arc<AtomicBool>);
pub struct McpClients(pub Arc<Mutex<HashMap<String, Arc<mcp::McpClient>>>>);

impl Default for AppStreams {
    fn default() -> Self { Self(Arc::new(TokioMutex::new(HashMap::new()))) }
}
impl Default for MonitoringState {
    fn default() -> Self { Self(Arc::new(AtomicBool::new(false))) }
}
impl Default for McpClients {
    fn default() -> Self { Self(Arc::new(Mutex::new(HashMap::new()))) }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![
      commands::sys::server_health,
      commands::sys::detect_ollama,
      commands::sys::start_ollama_service,
      commands::sys::stop_ollama_service,
      commands::chat::chat_stream,
      commands::chat::chat_cancel,
      commands::models::models_list,
      commands::models::model_pull,
      commands::models::model_pull_cancel,
      commands::models::model_delete,
      commands::models::model_show,
      commands::settings::settings_get,
      commands::settings::settings_set,
      commands::db::db_create_chat,
      commands::db::db_append_message,
      commands::db::db_list_chats,
      commands::db::db_list_messages,
      commands::db::db_delete_chat,
      commands::db::db_update_message,
      commands::db::db_delete_messages_after,
      commands::db::db_set_chat_model,
      commands::db::db_set_chat_title,
      commands::db::db_set_chat_system_prompt,
      commands::db::db_list_chats_with_flags,
      commands::db::db_list_chats_with_preview,
      commands::monitoring::start_system_monitoring,
      commands::monitoring::stop_system_monitoring,
      commands::monitoring::get_system_metrics,
      commands::monitoring::get_model_metrics,
      commands::monitoring::get_ollama_status,
      commands::monitoring::ollama_ps,
      commands::monitoring::stop_model,
      commands::mcp::connect_mcp_server,
      commands::mcp::connect_mcp_http,
      commands::mcp::list_mcp_servers,
      commands::mcp::list_tools,
      commands::settings::provider_add,
      commands::settings::provider_update,
      commands::settings::provider_delete,
      commands::settings::provider_set_active,
      commands::settings::provider_list,
      commands::settings::provider_get_active
    ])
    .setup(|app| {
      app.manage(AppStreams::default());
      app.manage(MonitoringState::default());
      app.manage(McpClients::default());

      // Disable GPU/hardware acceleration at the WebKit API level.
      // Prevents EGL initialization entirely — fixes Ubuntu 26.04 / Mesa 25+
      // crash where eglGetDisplay(EGL_DEFAULT_DISPLAY) returns EGL_BAD_PARAMETER.
      #[cfg(target_os = "linux")]
      {
        use webkit2gtk::{SettingsExt, WebViewExt};
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.with_webview(|wv| {
            if let Some(settings) = wv.inner().settings() {
              settings.set_hardware_acceleration_policy(
                webkit2gtk::HardwareAccelerationPolicy::Never,
              );
            }
          });
        }
      }

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
