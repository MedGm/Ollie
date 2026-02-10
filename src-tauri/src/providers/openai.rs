//! OpenAI-compatible API provider

use async_trait::async_trait;
use futures::{stream::BoxStream, Stream};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{HashMap, VecDeque};
use std::pin::Pin;
use std::task::{Context, Poll};
use crate::providers::traits::{LLMProvider, ProviderEvent, Usage};
use crate::providers::{ChatMessage, ProviderConfig, ChatOptions};

#[derive(Debug, Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<OpenAIMessage>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_p: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OpenAIMessage {
    role: String,
    content: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_calls: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_call_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAIStreamChunk {
    choices: Vec<OpenAIChoice>,
    usage: Option<OpenAIUsage>,
}

#[derive(Debug, Deserialize)]
struct OpenAIChoice {
    delta: OpenAIDelta,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAIDelta {
    content: Option<String>,
    tool_calls: Option<Vec<serde_json::Value>>,
    #[allow(dead_code)]
    role: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAIUsage {
    prompt_tokens: Option<i32>,
    completion_tokens: Option<i32>,
    total_tokens: Option<i32>,
}

pub struct OpenAIProvider;

#[async_trait]
impl LLMProvider for OpenAIProvider {
    async fn stream_chat(
        &self,
        config: &ProviderConfig,
        model: &str,
        messages: &[ChatMessage],
        tools: Option<Vec<serde_json::Value>>,
        options: Option<ChatOptions>,
    ) -> anyhow::Result<BoxStream<'static, ProviderEvent>> {
        let api_key = config.api_key.as_ref().unwrap_or(&"".to_string()).clone();
        
        // If api_key is empty we might fail, but let's proceed (maybe local proxy doesn't need it)
        
        let base_url = config.get_base_url();
        let endpoint = if base_url.ends_with("/v1") {
            format!("{}/chat/completions", base_url)
        } else {
            format!("{}/v1/chat/completions", base_url)
        };

        let mut headers = HeaderMap::new();
        if !api_key.is_empty() {
            headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}", api_key))?);
        }
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        // Detect if the model supports vision based on common naming patterns
        let model_lower = model.to_lowercase();
        let supports_vision = model_lower.contains("vision") 
            || model_lower.contains("gpt-4o")
            || model_lower.contains("gpt-4-turbo")
            || model_lower.contains("claude-3")
            || model_lower.contains("gemini")
            || model_lower.contains("llava")
            || model_lower.contains("moondream");

        let mut converted_messages = convert_messages(messages, supports_vision);
        
        // Inject system prompt for tool usage if tools are provided
        // This helps Llama models on Groq use proper tool call format
        if tools.is_some() {
            let tool_system_prompt = OpenAIMessage {
                role: "system".to_string(),
                content: serde_json::Value::String(
                    "You have access to tools. When you need to use a tool, you MUST use the proper function calling format. \
                    Do NOT use XML-style tags like <function=...>. Instead, respond with tool_calls in your response. \
                    The system will execute the tool and provide the result.".to_string()
                ),
                tool_calls: None,
                tool_call_id: None,
            };
            // Insert at the beginning if no system message, or after existing system messages
            let first_non_system = converted_messages.iter().position(|m| m.role != "system").unwrap_or(converted_messages.len());
            converted_messages.insert(first_non_system, tool_system_prompt);
        }
        
        let mut request_body = OpenAIRequest {
            model: model.to_string(),
            messages: converted_messages,
            stream: true,
            tools: tools.clone(),
            temperature: None,
            max_tokens: None,
            top_p: None,
        };
        
        if let Some(opts) = options {
            request_body.temperature = opts.temperature;
            request_body.max_tokens = opts.max_tokens;
            request_body.top_p = opts.top_p;
        }

        let client = reqwest::Client::new();
        let response = client
            .post(&endpoint)
            .headers(headers)
            .json(&request_body)
            .send()
            .await?;

        if !response.status().is_success() {
             let status = response.status();
             let text = response.text().await.unwrap_or_default();
             return Err(anyhow::anyhow!("OpenAI API error {}: {}", status, text));
        }

        let stream = response.bytes_stream();
        Ok(Box::pin(OpenAIStream::new(Box::pin(stream))))
    }
}

fn convert_messages(messages: &[ChatMessage], supports_vision: bool) -> Vec<OpenAIMessage> {
    messages.iter().map(|msg| {
        // Handle tool responses
        if msg.role == "tool" {
            return OpenAIMessage {
                role: "tool".to_string(),
                content: serde_json::Value::String(msg.content.clone()),
                tool_calls: None,
                tool_call_id: msg.tool_call_id.clone(),
            };
        }

        // Handle images/content - only send images if model supports vision
        let content = if supports_vision {
            if let Some(images) = &msg.images {
                if !images.is_empty() {
                    let mut parts = vec![json!({"type": "text", "text": msg.content})];
                    for img in images {
                        parts.push(json!({
                            "type": "image_url",
                            "image_url": { "url": format!("data:image/jpeg;base64,{}", img) }
                        }));
                    }
                    serde_json::Value::Array(parts)
                } else {
                    serde_json::Value::String(msg.content.clone())
                }
            } else {
                serde_json::Value::String(msg.content.clone())
            }
        } else {
            // Non-vision model: always use string content, ignore images
            serde_json::Value::String(msg.content.clone())
        };

        OpenAIMessage {
            role: msg.role.clone(),
            content,
            tool_calls: msg.tool_calls.clone(),
            tool_call_id: None,
        }
    }).collect()
}

struct OpenAIStream {
    inner: Pin<Box<dyn Stream<Item = reqwest::Result<bytes::Bytes>> + Send>>,
    buffer: String,
    queue: VecDeque<ProviderEvent>,
    tool_call_accumulator: HashMap<u64, serde_json::Value>,
}

impl OpenAIStream {
    fn new(inner: Pin<Box<dyn Stream<Item = reqwest::Result<bytes::Bytes>> + Send>>) -> Self {
        Self {
            inner,
            buffer: String::new(),
            queue: VecDeque::new(),
            tool_call_accumulator: HashMap::new(),
        }
    }

    fn process_data_line(&mut self, data: &str) {
        if data == "[DONE]" {
            self.flush_tool_calls();
            return;
        }

        // Check for Groq's tool_use_failed error with failed_generation
        // Format: <function=name{json_args}></function>
        if let Ok(error_response) = serde_json::from_str::<serde_json::Value>(data) {
            if let Some(error) = error_response.get("error") {
                if error.get("code").and_then(|c| c.as_str()) == Some("tool_use_failed") {
                    if let Some(failed_gen) = error.get("failed_generation").and_then(|f| f.as_str()) {
                        if let Some(tool_call) = self.parse_groq_xml_tool_call(failed_gen) {
                            self.queue.push_back(ProviderEvent::ToolCall(tool_call));
                            return;
                        }
                    }
                }
            }
        }

        if let Ok(chunk) = serde_json::from_str::<OpenAIStreamChunk>(data) {
             if let Some(usage) = chunk.usage {
                 self.queue.push_back(ProviderEvent::Usage(Usage {
                     prompt_tokens: usage.prompt_tokens,
                     completion_tokens: usage.completion_tokens,
                     total_tokens: usage.total_tokens,
                 }));
             }
             
             for choice in chunk.choices {
                 // 1. Content
                 if let Some(content) = choice.delta.content {
                     if !content.is_empty() {
                         self.queue.push_back(ProviderEvent::Content(content));
                     }
                 }
                 
                 // 2. Tool Calls (Delta Merging)
                 if let Some(tool_calls) = choice.delta.tool_calls {
                     for call in tool_calls {
                         if let Some(index) = call.get("index").and_then(|v| v.as_u64()) {
                             let entry = self.tool_call_accumulator.entry(index).or_insert_with(|| json!({
                                 "type": "function",
                                 "function": {"name": "", "arguments": ""},
                                 "id": ""
                             }));
                             
                             if let Some(obj) = call.as_object() {
                                 if let Some(id) = obj.get("id").and_then(|v| v.as_str()) {
                                     entry["id"] = json!(id);
                                 }
                                 if let Some(t) = obj.get("type").and_then(|v| v.as_str()) {
                                     entry["type"] = json!(t);
                                 }
                                 if let Some(func) = obj.get("function") {
                                      if let Some(name) = func.get("name").and_then(|v| v.as_str()) {
                                          let current = entry["function"]["name"].as_str().unwrap_or("").to_string();
                                          entry["function"]["name"] = json!(current + name);
                                      }
                                      if let Some(args) = func.get("arguments").and_then(|v| v.as_str()) {
                                          let current = entry["function"]["arguments"].as_str().unwrap_or("").to_string();
                                          entry["function"]["arguments"] = json!(current + args);
                                      }
                                 }
                             }
                         }
                     }
                 }
                 
                 // 3. Finish Reason
                 if choice.finish_reason.is_some() {
                     self.flush_tool_calls();
                 }
             }
        }
    }
    
    fn flush_tool_calls(&mut self) {
        if self.tool_call_accumulator.is_empty() { return; }
        
        let mut indices: Vec<u64> = self.tool_call_accumulator.keys().cloned().collect();
        indices.sort();
        
        for i in indices {
            if let Some(call) = self.tool_call_accumulator.remove(&i) {
                self.queue.push_back(ProviderEvent::ToolCall(call));
            }
        }
    }
    
    /// Parse Groq's XML-style tool call format: <function=name{json_args}></function>
    fn parse_groq_xml_tool_call(&self, input: &str) -> Option<serde_json::Value> {
        // Pattern: <function=tool_name{...json...}></function>
        // Can also be: <function=tool_name{"arg": "value"}></function>
        
        let start_marker = "<function=";
        let end_marker = "</function>";
        
        let start = input.find(start_marker)?;
        let end = input.find(end_marker)?;
        
        if end <= start {
            return None;
        }
        
        let inner = &input[start + start_marker.len()..end];
        // inner should be like: list_directory{"path": "./"}> or list_directory{"path":"./"}
        // Remove trailing > if present
        let inner = inner.trim_end_matches('>');
        
        // Find where the function name ends and JSON begins
        let json_start = inner.find('{')?;
        let function_name = inner[..json_start].trim(); // Trim whitespace from function name
        let json_str = &inner[json_start..];
        
        // Parse the JSON arguments to validate
        let _args: serde_json::Value = serde_json::from_str(json_str).ok()?;
        
        // Generate a unique ID
        let call_id = format!("groq_call_{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0"));
        
        Some(json!({
            "id": call_id,
            "type": "function",
            "function": {
                "name": function_name,
                "arguments": json_str
            }
        }))
    }
}

impl Stream for OpenAIStream {
    type Item = ProviderEvent;
    
    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        if let Some(event) = self.queue.pop_front() {
            return Poll::Ready(Some(event));
        }

         loop {
            match self.inner.as_mut().poll_next(cx) {
                Poll::Ready(Some(Ok(bytes))) => {
                    let s = String::from_utf8_lossy(&bytes);
                    self.buffer.push_str(&s);

                    let mut processed = false;
                    while let Some(pos) = self.buffer.find('\n') {
                        let line = self.buffer[..pos].trim().to_string();
                        self.buffer = self.buffer[pos+1..].to_string();
                        
                        if line.starts_with("data: ") {
                            let data = &line[6..];
                            self.process_data_line(data);
                            processed = true;
                        }
                    }
                    
                    if processed && !self.queue.is_empty() {
                         return Poll::Ready(Some(self.queue.pop_front().unwrap()));
                    }
                }
                Poll::Ready(Some(Err(e))) => {
                    return Poll::Ready(Some(ProviderEvent::Error(e.to_string())));
                }
                Poll::Ready(None) => {
                    // Check buffer for loose ends? usually SSE ends with newline.
                    return Poll::Ready(None);
                }
                Poll::Pending => return Poll::Pending,
            }
        }
    }
}
