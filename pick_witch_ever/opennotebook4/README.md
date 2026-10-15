# OpenNotebookLM 🪐

A complete, fully open-source clone of **Google NotebookLM** featuring the modern 3-column Studio interface, designed for 100% local and self-hosted execution with Bring Your Own Key (BYOK) support for all major LLMs, Search engines, TTS, Image, and Video models.

---

## 🌟 Key Features

* **Pixel-Accurate Carbon Copy UI & Full Light / Dark Theme:**
  * **Sources Panel (Left):** File upload (PDFs, Markdown, Text, Audio), YouTube transcript extraction, Website ingestion, and embedded Web Research with `🌐 Web` scope and `⚡ Fast Research` vs `🔬 Deep Research` toggles.
  * **Chat & Canvas (Center):** Grounded Q&A with live active-source counter (`X sources`), prompt onboarding pills, and in-line clickable citations linking directly to source excerpts.
  * **Creation Studio (Right):**
    * **Multilingual Audio Overview:** Instant 2-host podcast generation in English and Indic languages (Hindi, Bengali, Gujarati, Kannada, Malayalam, Marathi, Punjabi, Tamil, Telugu).
    * **The 9 Studio Tools (3x3 Grid):** Audio Overview, Slide Deck, Video Overview, Mind Map, Reports, Flashcards, Quiz, Infographic, Data Table.
    * **Studio Output Gallery & Note Editor:** Persistent pinned notes and generated deliverables.
  * **Google NotebookLM Theming:** Full parity light and dark modes with high-contrast slate surfaces, Google typography, and smooth transitions.
  * **100% Local & Private:** No external Google accounts, sign-ins, or telemetry required.

* **Comprehensive Multi-Modal Export Suite:**
  * **🎙️ Audio Overviews:** Export as **Playable Audio Track (.wav)**, **WebVTT Subtitles (.vtt)**, **SubRip Subtitles (.srt)**, **Dialogue Transcript (.md)**, and **Script (.txt)**.
  * **📊 Slide Decks:** Export as **Standalone HTML Slideshow Presentation (.html)**, **Slide Deck (.md)**, **Slides Schema (.json)**, and **Speaker Notes Teleprompter (.txt)**.
  * **🗂️ Flashcards:** Export to **Anki & Quizlet (.tsv)**, **Study Guide Deck (.md)**, **Spreadsheet Table (.csv)**, and **Flashcard Dataset (.json)**.
  * **📝 Quizzes:** Export as **Printable Examination Sheet (HTML/Print)**, **Quiz with Answer Key (.md)**, **Quiz Dataset (.json)**, and **Questions Table (.csv)**.
  * **🧠 Mind Maps:** Export as **Scalable Vector Graphic (.svg)**, **Retina 2x Image (.png)**, **Outline (.md)**, and **Mind Map Tree (.json)**.
  * **🎬 Video Overviews:** Export as **AI Video Prompts (.json)** for Sora / Runway / Kling / Luma / Pika, **Director Script (.md)**, **Production Shotlist (.csv)**, and **Storyboard (.txt)**.
  * **📋 Data Tables:** Export as **CSV (.csv)**, **TSV (.tsv)** for Excel/Sheets copy-paste, **Table JSON (.json)**, and **GitHub-Flavored Markdown Table (.md)**.
  * **📑 Reports:** Export as **Direct PDF (.pdf)**, **Vector Print PDF (.pdf)**, **Markdown (.md)**, **Standalone HTML (.html)**, and **Plain Text (.txt)**.
  * **🎨 Infographics:** Export as **AI Artwork (.png)**, **Data Canvas Summary (.md)**, **Art Director Prompts (.json)**, and **Print Layout**.

* **BYOK (Bring Your Own Key) & Local Self-Hosting:**
  * **LLM Engine:** Google Gemini (1M–2M context), OpenAI (GPT-4o), Anthropic (Claude 3.7), DeepSeek, Groq, or **100% Local Ollama / LM Studio**.
  * **Search & Ingestion:** DuckDuckGo (`ddgs` - 100% Free, zero keys needed), **Firecrawl** (Local Docker at `http://localhost:3002` or Cloud), Tavily, Brave Search, Exa.ai, Perplexity Sonar.
  * **Audio Overview (TTS):** Dual-speaker Web Speech synthesis, OpenAI TTS, Edge-TTS, ElevenLabs.
  * **Visual Assets & Video:** FLUX, Imagen, DALL-E 3, Luma Dream Machine, Runway Gen-3.

---

## 🐳 Running with Docker

OpenNotebookLM is container-ready with a multi-stage production build and integrated proxy backend.

### Quick Start with Docker Compose (Recommended)

```bash
docker-compose up -d
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To stop the container:
```bash
docker-compose down
```

### Direct Docker CLI

Build the container image:
```bash
docker build -t opennotebooklm .
```

Run the container on port 3000:
```bash
docker run -d -p 3000:3000 --name opennotebooklm --restart unless-stopped opennotebooklm
```

---

## 🚀 Local Development

### 1. Install dependencies
```bash
pnpm install
# or npm install
```

### 2. Start the development server
```bash
pnpm run dev
# or npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Production Build & Preview
```bash
pnpm run build
pnpm run preview
```

---

## 🛠️ Architecture

* **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide Icons, KaTeX Math, React Markdown.
* **Backend:** Embedded Connect proxy in Vite preview / server for CORS-free RAG processing, web scraping, PDF parsing, model fetching, and research pipelines.
* **Storage:** Fast client-side local storage with data backup export and import.
* **Context Engine:** Full-context prompt orchestration designed for modern 1M–1.5M+ token frontier models.
