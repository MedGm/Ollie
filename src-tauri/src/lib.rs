mod commands;
mod db;
mod mcp;
mod providers;

use tauri::Manager;

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
      commands::db::db_list_chats_with_flags,
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
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      app.manage(std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::<String, std::sync::Arc<std::sync::atomic::AtomicBool>>::new())));
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
