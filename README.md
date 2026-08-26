# CromaX IDE

**CromaX** is an ultra-fast, open-source AI-native Code Editor built on a high-performance VS Code foundation with integrated Void AI capabilities. It is engineered for seamless pair programming, context-aware AI assistance, and agentic workspace editing.

---

## Key Implemented Features

### 1. AI Sidebar Chat & Multi-Thread Conversations
- **Multi-Thread Chat Management**: Create, switch, rename, and clear independent chat threads.
- **Provider & Model Selection**: Switch between LLM providers on the fly:
  - **Anthropic** (Claude 3.5 Sonnet, Claude 3 Opus)
  - **OpenAI** (GPT-4o, o1, o3-mini)
  - **Google Gemini** (Gemini 2.0 Flash, Gemini 1.5 Pro)
  - **DeepSeek** (DeepSeek V3, R1)
  - **Ollama & LM Studio** (Local LLM execution)
  - **OpenRouter & Groq**
  - Custom **OpenAI-Compatible** API endpoints
- **Reasoning Controls & System Prompts**: Adjust model temperature, reasoning effort, and custom system prompts.

### 2. Context Mentions (`@` Symbol)
Seamlessly reference project context inside chat prompts using `@`:
- `@File`: Attach specific files.
- `@Folder`: Reference entire directory structures.
- `@Codebase`: Search and reference the full workspace index.
- `@Terminal`: Attach terminal output and logs.
- `@Docs`: Include documentation resources.
- `@Web`: Fetch web content and search queries.

### 3. Inline Quick Edit (`Ctrl+K` / `Cmd+K`)
- Select any block of code and press `Ctrl+K` (or `Cmd+K` on macOS) to trigger the inline prompt bar.
- Generates inline code edits with live, color-coded diff overlays.
- Quickly **Accept** (`Ctrl+Enter`) or **Reject** (`Escape`) changes directly within the editor.

### 4. Real-Time AI Autocomplete
- Inline ghost-text code completions as you type.
- Powered by configurable local models (e.g. Ollama) or cloud API endpoints.
- Custom trigger delays, max token limits, and toggle hotkeys.

### 5. Agentic Workspace Tools & Autonomous Execution
- Autonomous tool execution capabilities:
  - Workspace search & file system indexing
  - Reading and editing project files
  - Executing terminal commands
  - Reading compiler markers and lint error diagnostics

### 6. Model Context Protocol (MCP) Integration
- Built-in support for connecting Model Context Protocol (MCP) servers to extend AI context and capabilities.

### 7. Floating Selection Helper
- Contextual selection widget that pops up when highlighting code for 1-click "Edit with AI" or "Send to Chat".

### 8. 1-Click Settings & Extension Importer
- Import settings, keybindings, and extensions from standard VS Code, Cursor, or Windsurf installations during onboarding or from the CromaX settings panel.

---

## Installation & Setup Guide

### Prerequisites
- **Node.js**: `v20.18.1` or later (Node 20+ / Node 24 supported)
- **npm**: `v10.0.0` or later
- **Windows Build Tools** (Windows users only):
  - Visual Studio 2022 / 2026 or **Visual Studio Build Tools** with the **"Desktop development with C++"** workload installed (required for native C++ Node addons like `spdlog`, `sqlite3`, and `windows-mutex`).

---

### Step-by-Step Build & Run

#### 1. Clone the Repository
```bash
git clone https://github.com/DarkKingTg/CromaX.git
cd CromaX
```

#### 2. Install Dependencies
Run `npm install` to install all dependencies and run the preinstall check for native Node header tools:
```bash
npm install
```
*(Note: If preinstall native headers check was missed, run `node build/npm/postinstall.js` manually).*

#### 3. Build React UI Components
Build the CromaX React components for the sidebar chat, settings, and diff widgets:
```bash
npm run buildreact
```

#### 4. Compile the TypeScript Source
Compile the CromaX editor source code:
```bash
npm run compile
```

*For active development with hot-reloading:*
```bash
npm run watch
```

#### 5. Launch CromaX IDE
Launch the CromaX Electron application:
```bash
npm run electron
```

*On Windows, you can also launch using the batch script:*
```cmd
Launch-CromaX.bat
```

---

##  License

Licensed under the Apache-2.0 & MIT Licenses.
