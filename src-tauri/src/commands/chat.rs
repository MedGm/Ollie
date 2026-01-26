use serde::{Deserialize, Serialize};
use tauri::Emitter;
use futures_util::StreamExt;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use uuid::Uuid;
use crate::commands::monitoring;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    pub images: Option<Vec<String>>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatChunk {
    pub message: Option<ChatMessage>,
    pub done: bool,
    pub total_duration: Option<u64>,
    pub load_duration: Option<u64>,
    pub prompt_eval_count: Option<i32>,
    pub prompt_eval_duration: Option<u64>,
    pub eval_count: Option<i32>,
    pub eval_duration: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatResponse {
    pub success: bool,
    pub error: Option<String>,
}

// Global state to track active streams
lazy_static::lazy_static! {
    static ref ACTIVE_STREAMS: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>> = Arc::new(Mutex::new(HashMap::new()));
}

#[tauri::command]
pub async fn chat_stream(
    app: tauri::AppHandle,
    request: ChatRequest,
    server_url: Option<String>,
) -> Result<ChatResponse, String> {
    let url = server_url.unwrap_or_else(|| "http://localhost:11434".to_string());
    let endpoint = format!("{}/api/chat", url);
    
    // Generate unique stream ID
    let stream_id = Uuid::new_v4().to_string();
    let should_cancel = Arc::new(AtomicBool::new(false));
    
    // Register this stream for potential cancellation
    {
        let mut active_streams = ACTIVE_STREAMS.lock().await;
        active_streams.insert(stream_id.clone(), should_cancel.clone());
    }
    
    println!("Starting stream with ID: {}", stream_id);
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(1800)) // 30 minutes timeout
        .build()
        .map_err(|e| e.to_string())?;
    
    // Clone the model name for later use in performance tracking
    let model_name = request.model.clone();
    
    // Prepare the request payload
    let mut payload = HashMap::new();
    payload.insert("model", serde_json::Value::String(request.model));
    // Ensure there is at least one message; otherwise Ollama may return immediate done
    if request.messages.is_empty() {
        eprintln!("Warning: empty messages array; injecting placeholder to avoid empty stream");
        payload.insert("messages", serde_json::json!([
            {"role": "user", "content": ""}
        ]));
    } else {
        payload.insert("messages", serde_json::to_value(&request.messages).unwrap());
    }
    payload.insert("stream", serde_json::Value::Bool(true));
    
    if let Some(options) = request.options {
        let mut options_map = HashMap::new();
        if let Some(temp) = options.temperature {
            options_map.insert("temperature".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(temp).unwrap()));
        }
        if let Some(top_k) = options.top_k {
            options_map.insert("top_k".to_string(), serde_json::Value::Number(serde_json::Number::from(top_k)));
        }
        if let Some(top_p) = options.top_p {
            options_map.insert("top_p".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(top_p).unwrap()));
        }
        if let Some(max_tokens) = options.max_tokens {
            options_map.insert("num_predict".to_string(), serde_json::Value::Number(serde_json::Number::from(max_tokens)));
        }
        payload.insert("options", serde_json::Value::Object(options_map.into_iter().collect()));
    }
    // DEBUG: log outgoing payload (truncated to avoid huge logs)
    if let Ok(payload_json) = serde_json::to_string(&payload) {
        let preview = if payload_json.len() > 800 { &payload_json[..800] } else { &payload_json };
        println!("Outgoing chat payload: {}{}", preview, if payload_json.len() > 800 { "..." } else { "" });
    }
    
    // Make the streaming request
    println!("Posting to endpoint: {}", endpoint);
    let response = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to send request: {}", e))?;
    
    if !response.status().is_success() {
        let status = response.status();
        let body_text = response.text().await.unwrap_or_default();
        let error_msg = format!("HTTP error {}: {}", status, body_text);
        eprintln!("chat_stream error: {}", error_msg);

        // Emit error and completion so the frontend can clean up
        if let Err(emit_err) = app.emit("chat:error", &serde_json::json!({
            "stream_id": stream_id,
            "error": error_msg
        })) {
            eprintln!("Failed to emit error: {}", emit_err);
        }
        if let Err(emit_err) = app.emit("chat:complete", serde_json::json!({"completed": false, "stream_id": stream_id})) {
            eprintln!("Failed to emit completion signal: {}", emit_err);
        }

        // Clean up active stream registration
        {
            let mut active_streams = ACTIVE_STREAMS.lock().await;
            active_streams.remove(&stream_id);
        }

        return Ok(ChatResponse {
            success: false,
            error: Some(format!("HTTP error: {}", status)),
        });
    }
    
    // Handle streaming response
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut stream_completed = false;
    let mut last_chunk: Option<ChatChunk> = None;
    
    // Emit stream start event with ID
    if let Err(e) = app.emit("chat:stream-start", serde_json::json!({"stream_id": stream_id})) {
        eprintln!("Failed to emit stream start: {}", e);
    }
    
    while let Some(chunk) = stream.next().await {
        // Check for cancellation
        if should_cancel.load(Ordering::Relaxed) {
            println!("Stream {} was cancelled", stream_id);
            if let Err(e) = app.emit("chat:cancelled", serde_json::json!({"stream_id": stream_id})) {
                eprintln!("Failed to emit cancellation: {}", e);
            }
            break;
        }
        
        match chunk {
            Ok(bytes) => {
                let chunk_str = String::from_utf8_lossy(&bytes);
                buffer.push_str(&chunk_str);
                
                // Process complete lines using "\n" as delimiter (NDJSON standard).
                // This avoids matching on Option variants directly and keeps rust-analyzer quiet.
                loop {
                    if let Some(pos) = buffer.find('\n') {
                        let line = buffer[..pos].trim().to_string();
                        buffer = buffer[pos + 1..].to_string();

                        if !line.is_empty() {
                            // DEBUG: show each NDJSON line (truncate to 400 chars)
                            let preview = if line.len() > 400 { &line[..400] } else { &line };
                            println!("NDJSON line: {}{}", preview, if line.len() > 400 { "..." } else { "" });
                            match serde_json::from_str::<ChatChunk>(&line) {
                                Ok(chat_chunk) => {
                                    // Store the chunk for performance tracking
                                    last_chunk = Some(chat_chunk.clone());
                                    
                                    // Emit the chunk to the frontend with stream id
                                    if let Err(e) = app.emit("chat:chunk", &serde_json::json!({
                                        "stream_id": stream_id,
                                        "message": chat_chunk.message,
                                        "done": chat_chunk.done,
                                        "total_duration": chat_chunk.total_duration,
                                        "load_duration": chat_chunk.load_duration,
                                        "prompt_eval_count": chat_chunk.prompt_eval_count,
                                        "prompt_eval_duration": chat_chunk.prompt_eval_duration,
                                        "eval_count": chat_chunk.eval_count,
                                        "eval_duration": chat_chunk.eval_duration
                                    })) {
                                        eprintln!("Failed to emit chat chunk: {}", e);
                                    }

                                    // If done, mark as completed and break
                                    if chat_chunk.done {
                                        stream_completed = true;
                                        break;
                                    }
                                }
                                Err(e) => {
                                    eprintln!("Failed to parse chat chunk: {} - Line: {}", e, line);
                                    // Continue processing other lines instead of failing
                                }
                            }
                        }
                    } else {
                        break;
                    }
                }
                
                // If stream completed, break out of main loop
                if stream_completed {
                    break;
                }
            }
            Err(e) => {
                let error_msg = format!("Stream error: {}", e);
                eprintln!("Stream error: {}", error_msg);
                
                // Emit error but don't return immediately - let frontend handle it
                if let Err(emit_err) = app.emit("chat:error", &serde_json::json!({
                    "stream_id": stream_id,
                    "error": error_msg
                })) {
                    eprintln!("Failed to emit error: {}", emit_err);
                }
                break;
            }
        }
    }
    
    // CRITICAL FIX: Process any remaining data in buffer after stream ends
    if !buffer.trim().is_empty() && !stream_completed {
        let remaining_line = buffer.trim();
        println!("NDJSON (remaining buffer): {}", if remaining_line.len() > 400 { &remaining_line[..400] } else { remaining_line });
        match serde_json::from_str::<ChatChunk>(remaining_line) {
            Ok(chat_chunk) => {
                // Store the chunk for performance tracking
                last_chunk = Some(chat_chunk.clone());
                
                // Emit the final chunk
                if let Err(e) = app.emit("chat:chunk", &serde_json::json!({
                    "stream_id": stream_id,
                    "message": chat_chunk.message,
                    "done": chat_chunk.done,
                    "total_duration": chat_chunk.total_duration,
                    "load_duration": chat_chunk.load_duration,
                    "prompt_eval_count": chat_chunk.prompt_eval_count,
                    "prompt_eval_duration": chat_chunk.prompt_eval_duration,
                    "eval_count": chat_chunk.eval_count,
                    "eval_duration": chat_chunk.eval_duration
                })) {
                    eprintln!("Failed to emit final chat chunk: {}", e);
                }
                
                // Check if this final chunk marks completion
                if chat_chunk.done {
                    stream_completed = true;
                }
            }
            Err(e) => {
                eprintln!("Failed to parse final chunk: {} - Remaining: {}", e, remaining_line);
            }
        }
    }
    
    // Send completion signal to frontend
    println!("Stream processing finished. Completed: {} (ID: {})", stream_completed, stream_id);
    if let Err(e) = app.emit("chat:complete", serde_json::json!({"completed": stream_completed, "stream_id": stream_id})) {
        eprintln!("Failed to emit completion signal: {}", e);
    }
    
    // Track model performance metrics if stream completed successfully
    if stream_completed {
        if let Some(final_chunk) = &last_chunk {
            // Calculate token rate (tokens per second)
            let token_rate = if let (Some(eval_count), Some(eval_duration)) = (final_chunk.eval_count, final_chunk.eval_duration) {
                if eval_duration > 0 {
                    (eval_count as f32) / (eval_duration as f32 / 1_000_000_000.0) // Convert nanoseconds to seconds
                } else {
                    0.0
                }
            } else {
                0.0
            };
            
            // Calculate total response time (in milliseconds)
            let response_time = final_chunk.total_duration.unwrap_or(0) / 1_000_000; // Convert nanoseconds to milliseconds
            
            // Estimate memory usage (rough approximation based on model name)
            let memory_usage = match model_name.as_str() {
                m if m.contains("7b") => 4_000_000_000u64,   // ~4GB for 7B models
                m if m.contains("13b") => 8_000_000_000u64,  // ~8GB for 13B models  
                m if m.contains("70b") => 40_000_000_000u64, // ~40GB for 70B models
                _ => 2_000_000_000u64, // Default 2GB
            };
            
            // Track the performance
            monitoring::track_model_performance(
                &app,
                &model_name,
                token_rate,
                response_time,
                memory_usage,
            );
        }
    }
    
    // Clean up this stream from active streams
    {
        let mut active_streams = ACTIVE_STREAMS.lock().await;
        active_streams.remove(&stream_id);
    }
    
    Ok(ChatResponse {
        success: stream_completed,
        error: if stream_completed { None } else { Some("Stream incomplete".to_string()) },
    })
}

#[tauri::command]
pub async fn abort_chat() -> Result<(), String> {
    // Cancel all active streams
    let active_streams = ACTIVE_STREAMS.lock().await;
    let count = active_streams.len();
    
    for (stream_id, should_cancel) in active_streams.iter() {
        should_cancel.store(true, Ordering::Relaxed);
        println!("Cancelled stream: {}", stream_id);
    }
    
    println!("Cancelled {} active streams", count);
    Ok(())
}