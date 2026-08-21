# CromaX IDE

**CromaX** is an ultra-fast, open-source AI-native Code Editor built on VS Code foundation, engineered for seamless pair programming, autonomous agent execution, and deep codebase intelligence.

---

##  Features & Highlights

###  1. Cursor-Class AI Chat & Agentic Capabilities
- **`@` Symbol Context Mentions**: Attach `@File`, `@Folder`, `@Codebase`, `@Terminal`, `@Web`, and `@Docs` context directly into chat prompts.
- **Instant Code Apply & Inline Diffs**: Preview AI-generated code changes with live accept/reject inline diffs.
- **Autonomous Tool Execution (`Agent Mode`)**: Auto-edits files, executes terminal commands, and resolves lint errors autonomously.

###  2. Specialized Chat Modes
-  **Agent Mode**: Full tool usage, autonomous file modifications, and multi-step task execution.
-  **Normal Mode**: Conversational assistant for code explanation, quick answers, and snippet generation.
-  **Gather Mode**: Search, reference, and read workspace files without altering code.
-  **Research Mode**: Deep architectural analysis, literature/documentation review, and step-by-step technical trade-off evaluation.
-  **Debug Mode**: Root-cause diagnostic engine, stack trace analysis, and targeted fix generation.

###  3.Modern UI & Micro-Animations
- **Glassmorphism Design**: Blur backdrops (`backdrop-filter: blur(14px)`), soft glows, and sleek translucent layers.
- **Spring Micro-Transitions**: High-FPS cubic-bezier transitions (`0.16, 1, 0.3, 1`) for interactive pill toggles, dropdowns, and streaming responses.
- **Modern Typography & Dynamic Theme Adaptation**: Harmonious dark/light mode palette with high contrast readability.

### 4. Universal LLM & Local Model Support
- Support for **Anthropic Claude**, **OpenAI GPT-4o / O3**, **DeepSeek V3 / R1**, **Google Gemini**, **Ollama**, **LM Studio**, and custom OpenAI-compatible API endpoints.
- Reasoning Effort Controls & Step-by-Step Thinking visualizations.

---

##  Architecture

- **Editor (`/editor`)**: High-performance VS Code fork integrated with custom React AI sidebar and diff widgets.
- **Orchestrator (`/orchestrator`)**: Python-based WebSocket server managing background agents, search indexers, and local model dispatching.

---

##  Quick Start

### 1. Setup Environment (Fresh Clone)
If you are cloning CromaX for the first time, run the setup script to fetch the editor shell components:

```powershell
# Fetch required editor shell resources
.\scripts\download_repos.ps1
```

### 2. Launch CromaX IDE

```cmd
:: Run the launch script on Windows
Launch-CromaX.bat
```

### 3. Build React UI Components

```bash
cd editor
npm run buildreact
```

---

##  License

Licensed under the Apache-2.0 & MIT Licenses.
