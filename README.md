<div align="center">

<table>
  <tr>
    <td align="center" width="150">
      <img src="docs/logo.png" alt="Ollie Logo" width="120" />
    </td>
    <td align="center">
      <img src="docs/ascii-art.png" alt="Ollie Text" width="100%" />
    </td>
  </tr>
</table>

<h3> Your Friendly Local AI Companion </h3>

</div>

**Ollie** (formerly OllamaGUI) is a personal AI assistant you run on your own Linux machine. It provides a polished, modern interface for chatting with local LLMs via Ollama—no CLI required.

If you want a personal, single-user assistant that feels premium, fast, and always-on, this is it.

![Overview](docs/screenshots/overview.png)

## Install (Linux AppImage)

No configuration needed. Just download and run.

```bash
# Download the AppImage (v0.2.10)
wget https://github.com/MedGm/Ollie/releases/download/v0.2.10/Ollie_0.2.10_amd64.AppImage

# Make it executable
chmod +x Ollie_0.2.10_amd64.AppImage

# Run it
./Ollie_0.2.10_amd64.AppImage
```

*Requirements: [Ollama](https://ollama.com) installed and running.*

**Arch Linux (AUR):** community-maintained by [Razgak](https://aur.archlinux.org/account/Razgak) —
```bash
yay -S ollie-appimage-bin
```

## Highlights

**Local-First Experience**
Ollie runs entirely on your machine. Your chats, data, and models stay private. No cloud dependencies, no tracking.

**Modern Chat Interface**
A clean, distraction-free UI built with React and Tailwind. Supports full Markdown rendering, code highlighting, tables, and math equations.

**Model Management**
Pull, delete, and manage your Ollama models directly from the app. No need to drop to the terminal.

**Vision & File Analysis**
Drag and drop images to analyze them with vision models like LLaVA. Upload PDFs and text files to chat with your documents instantly.

**Monitoring Dashboard**
Real-time tracking of system resources (CPU, Memory), running models with VRAM usage, and the ability to stop/unload models directly from the dashboard.

**Dark Theme**
Full dark mode with a light/dark/system toggle. System mode follows your OS preference automatically.

## Gallery

| Models | Settings |
|:---:|:---:|
| ![Models](docs/screenshots/models.png) | ![Settings](docs/screenshots/settings.png) |

| Monitoring | Vision |
|:---:|:---:|
| ![Monitoring](docs/screenshots/monitoring.png) | ![Vision](docs/screenshots/vision-model.png) |

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4
- **Backend**: Tauri v2 (Rust)
- **Database**: SQLite (local persistence)

## Data & Configuration

- **Local Database**: `~/.config/ollie/app.db`
- **Settings**: `~/.config/ollie/settings.json`

## Roadmap

### ✅ Recently Completed

- **Smart Streaming**: Render-throttled drip queue (10fps push to React) + dual markdown pipeline — streaming uses GFM tables only, syntax highlight and KaTeX deferred post-stream via `useTransition`. Eliminates lag with ultra-fast cloud providers.
- **Keyboard Shortcuts**: `Ctrl+N` new chat, `Ctrl+K` model switch, `Ctrl+/` focus input, `Ctrl+B` toggle sidebar.
- **Export Conversations**: Download any chat as a Markdown file.
- **Context Window Management**: Automatic token budget — oldest messages trimmed before hitting provider limits.
- **MCP Support**: Full Model Context Protocol integration for extensible tool access (filesystem, web, code execution, etc.).
- **Cloud API Support**: Unified provider system supporting OpenAI, Anthropic, Google Gemini, and GroqCloud alongside local Ollama models.
- **Startup Wizard**: Choosing between Local and Cloud modes.
- **Think Mode**: Toggle visibility for reasoning models' thought processes.
- **Real-time HTML Preview**: Instant rendering of HTML/SVG artifacts directly in chat, with fullscreen expand.
- **Message Editing**: Edit sent messages and regenerate responses from any point.
- **Graceful Error Handling**: Auto-fallback for models without tool support, truncation for large tool outputs.

### 🚀 Upcoming Features

**Core & Chat**
- **Export/Import Conversations**: Import from ChatGPT/Claude formats; export to JSON or PDF.
- **Structured Outputs**: Support for JSON schemas and advanced tool calling patterns.
- **Conversation Branching**: Fork conversations from any point.
- **Multi-Model Comparison**: Send same prompt to multiple models, compare responses side-by-side.
- **Prompt Templates Library**: Pre-built and user-created templates with variables.

**Developer Tools**
- **RAG / Document Memory**: Index local folders, chat with your codebase using embeddings.
- **Local Code Sandbox**: Run Python/JavaScript code blocks in isolated environment with inline output.
- **GitHub Integration**: Fetch repos for context, analyze PRs, export code to Gists.

**Agents & Models**
- **Custom Agents**: Configure specific system prompts and behaviors per chat.
- **Model Factory**: Create and push custom Modelfiles directly from the UI.

**Platform & Integration**
- **Ollama Server Discovery**: Auto-detect and connect to Ollama instances on local network.
- **Windows & MacOS Support**: Cross-platform builds.
- **Voice Mode**: Hands-free voice interaction.
- **Internationalization**: Multi-language UI support.

## Contributors

- [@MedGm](https://github.com/MedGm) — creator & maintainer
- [@leoniv](https://github.com/leoniv) — dark theme & UI polish

## License

MIT License. Created by @MedGm.
