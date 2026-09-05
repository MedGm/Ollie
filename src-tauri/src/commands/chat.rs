use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use uuid::Uuid;
use crate::commands::settings::{settings_get_inner, provider_get_active_inner};
use crate::secrets;
use crate::providers::{ProviderType, ChatMessage as ProviderChatMessage, ChatOptions as ProviderChatOptions};
use crate::providers::traits::LLMProvider;
use crate::providers::orchestrator::ChatOrchestrator;
use crate::providers::ollama::OllamaProvider;
use crate::providers::openai::OpenAIProvider;
use crate::providers::anthropic::AnthropicProvider;
use crate::providers::google::GoogleProvider;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    pub images: Option<Vec<String>>,
    pub tool_calls: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub stream: Option<bool>,
    pub options: Option<ChatOptions>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatOptions {
    pub temperature: Option<f64>,
    pub top_k: Option<i32>,
    pub top_p: Option<f64>,
    pub max_tokens: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatResponse {
    pub success: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn chat_stream(
    app: tauri::AppHandle,
    request: ChatRequest,
    _server_url: Option<String>,
    provider_id: Option<String>,
    streams: tauri::State<'_, crate::AppStreams>,
    mcp_clients: tauri::State<'_, crate::McpClients>,
    keyring: tauri::State<'_, secrets::KeyringState>,
) -> Result<ChatResponse, String> {
    
    // 1. Resolve Provider Configuration
    let provider_config = if let Some(pid) = provider_id {
        let settings = settings_get_inner(keyring.0.as_ref()).await?;
        settings.providers.into_iter()
            .find(|p| p.id == pid)
            .ok_or_else(|| format!("Provider '{}' not found", pid))?
    } else {
        provider_get_active_inner(keyring.0.as_ref()).await?
    };

    println!("Using provider: {} ({:?})", provider_config.name, provider_config.provider_type);

    // 2. Instantiate correct Provider Adapter
    let provider: Box<dyn LLMProvider + Send + Sync> = match provider_config.provider_type {
        ProviderType::Ollama => Box::new(OllamaProvider),
        ProviderType::OpenAI | ProviderType::Other => Box::new(OpenAIProvider),
        ProviderType::Anthropic => Box::new(AnthropicProvider),
        ProviderType::Google => Box::new(GoogleProvider),
    };

    // 3. Register Stream for Cancellation
    let stream_id = Uuid::new_v4().to_string();
    let should_cancel = Arc::new(AtomicBool::new(false));
    {
        let mut active_streams = streams.0.lock().await;
        active_streams.insert(stream_id.clone(), should_cancel.clone());
    }

    // 4. Transform Data Types (Command -> Provider)
    let messages: Vec<ProviderChatMessage> = request.messages.iter().map(|m| {
        ProviderChatMessage {
            role: m.role.clone(),
            content: m.content.clone(),
            images: m.images.clone(),
            tool_calls: m.tool_calls.clone(),
            tool_call_id: None, // Frontend messages don't usually send IDs back unless it's a tool result?
                                // If it's a tool result, m.role would be tool.
                                // But `tool_call_id` is usually needed for `tool` messages.
                                // Our `ChatMessage` struct in `chat.rs` doesn't have `tool_call_id`.
                                // We might need to look into content or handle it if we want to support history with tool results correctly.
                                // For now, let's assume `tool_calls` handles the assistant side, and we might be missing `tool_call_id` for tool output messages if frontend doesn't send it.
                                // However, `orchestrator` handles new messages.
                                // If `history` is passed from frontend, we trust it.
        }
    }).collect();

    let options = request.options.map(|o| ProviderChatOptions {
        temperature: o.temperature,
        top_k: o.top_k,
        top_p: o.top_p,
        max_tokens: o.max_tokens,
    });

    // 5. Initialize Orchestrator
    let orchestrator = ChatOrchestrator::new(app.clone(), provider, mcp_clients.0.clone());

    // 6. Run Conversation Loop
    let result = orchestrator.run_conversation(
        &provider_config,
        &request.model,
        messages,
        options,
        &stream_id,
        should_cancel
    ).await;

    // 7. Cleanup
    {
        let mut active_streams = streams.0.lock().await;
        active_streams.remove(&stream_id);
    }

    match result {
        Ok(_) => Ok(ChatResponse { success: true, error: None }),
        Err(e) => {
            eprintln!("Chat error: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn chat_cancel(
    stream_id: Option<String>,
    streams: tauri::State<'_, crate::AppStreams>,
) -> Result<(), String> {
    let active_streams = streams.0.lock().await;
    match stream_id {
        Some(sid) => {
            if let Some(should_cancel) = active_streams.get(&sid) {
                should_cancel.store(true, std::sync::atomic::Ordering::Release);
                println!("Cancelling stream {}", sid);
            }
        }
        None => {
            for should_cancel in active_streams.values() {
                should_cancel.store(true, std::sync::atomic::Ordering::Release);
            }
            println!("Cancelling all active streams");
        }
    }
    Ok(())
}