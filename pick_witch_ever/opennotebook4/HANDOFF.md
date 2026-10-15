# OpenNotebookLM — Session Handoff Document

**File Location:** `/home/atharva/projects/openotebbook/HANDOFF.md`  
**Date:** September 13, 2026  
**Project:** OpenNotebookLM  
**Repository Path:** `/home/atharva/projects/openotebbook`  
**Dev Server:** `http://localhost:3000/` (`pnpm run dev` or `pnpm run preview`)  
**Production Build Status:** Verified passing (`pnpm run build` exits with code 0, 0 warnings)  
**Docker Status:** Container-ready (`docker-compose up -d` or `pnpm run docker:compose`)

---

## 1. Goal

Build **OpenNotebookLM**, a fully featured, self-hosted, 100% faithful open-source replica of **Google NotebookLM** with Bring-Your-Own-Key (BYOK) support for all major LLM, search, voice, and visual media generation providers.

### Core Deliverables
1. **Google NotebookLM 3-Column Workspace**:
   - Left: **Sources Panel** with multi-source upload (PDF, text, web links, YouTube, audio), inline Fast Research, and full Deep Research.
   - Center: **Chat & Grounded Synthesis** with Markdown, KaTeX LaTeX math support, citation popups/excerpts, response styling (Default, Concise, Detailed), and "Save to Note".
   - Right: **Studio Panel** with 9 AI artifact generators, saved output library, and note management.
2. **All 9 Studio Artifact Generators & Viewers**:
   - 🎙️ **Audio Overview**: 2-host conversational podcast with multi-language support (English + 9 Indic languages), waveform player, synchronized transcript, and audio/subtitle export.
   - 📑 **Slide Deck**: Structured presentation generator with slide layout presets, presenter mode, thumbnail navigator, and standalone HTML slideshow export.
   - 🎬 **Video Overview**: AI video generator with kinetic text, scene prompts, and Sora/Runway/Kling export.
   - 🧠 **Mind Map**: Interactive zoomable, pannable visual tree graph with collapsible nodes, auto-layout, search, and SVG/PNG/Markdown/JSON export.
   - 📄 **Reports**: Multi-format reports with 4 defaults + 4 dynamic AI suggestions, LaTeX math, and PDF/HTML/MD/TXT export.
   - 🗂️ **Flashcards**: Interactive study cards with 3D flip animation, mastery tracking, and Anki/Quizlet TSV/CSV/MD/JSON export.
   - ❓ **Quiz**: Interactive multiple-choice & multi-format tests with instant feedback, explanations citing sources, and printable test sheet HTML/MD/JSON/CSV export.
   - 📊 **Infographic**: Visual infographic designer with 10 visual styles, AI prompt pipeline, PNG image, and Data Canvas summary export.
   - 📋 **Data Table**: Tabular data extraction with search, column inspection, and CSV/TSV/JSON/MD export.
3. **Themes**:
   - Full parity **Light Mode** and **Dark Mode** matching Google NotebookLM's exact aesthetic:
     - Light canvas `#f0f4f9`, surface cards `#ffffff`, borders `#dadce0`/`#e0e2ec`.
     - Dark canvas `#0f1117`, surface cards `#1e222b`, borders `#282f3d`.
     - Sun/Moon quick switcher in Header.
4. **Local-First Architecture**:
   - Pure local running app with no Google accounts, external auth, or telemetry.
   - Client-side storage with JSON backup export and restore in Settings.
5. **Model & Provider Ecosystem (BYOK)**:
   - **14 LLM Engines**: Gemini, OpenAI, Anthropic, DeepSeek, Groq, Mistral, xAI, Cohere, Perplexity, OpenRouter, Together AI, Cerebras, Ollama, LM Studio. Live dynamic model fetching from `/api/models`.
   - **Search Providers**: DuckDuckGo, Tavily, Firecrawl, Brave, Exa, Perplexity.
   - **TTS Providers**: Dual-speaker Web Speech API, OpenAI TTS, Edge-TTS, ElevenLabs.

---

## 2. Recent Accomplishments

### A. Comprehensive Multi-Modal Export Suite
Added export capabilities across all Studio artifact viewers using a unified, accessible `ExportDropdown` component and `src/utils/exportUtils.ts`:
1. **Audio Overview**:
   - **Studio Audio Track (.wav)**: Synthesizes a standard 16-bit PCM 44.1kHz Stereo `.wav` file with harmonic podcast intro jingles and acoustic modulation, or downloads MP3 via configured OpenAI TTS.
   - **WebVTT Subtitles (.vtt)**: Timed subtitle cues with speaker voice tags.
   - **SubRip Subtitles (.srt)**: Standard media player subtitle format.
   - **Dialogue Transcript (.md)**: Formatted markdown transcript with timestamps.
   - **Podcast Script (.txt)**: Clean plain text speaker script.
2. **Slide Deck**:
   - **Presentation Slideshow (.html)**: Self-contained interactive presentation with keyboard navigation (Left/Right/Space/PageUp/PageDown), fullscreen support (F), speaker notes drawer, and responsive slide sizing.
   - **Slide Deck Markdown (.md)**: Full slide deck with titles, callouts, and notes.
   - **Slides Schema (.json)**: Structured slide data.
   - **Speaker Notes Script (.txt)**: Teleprompter talk tracks.
3. **Flashcards**:
   - **Anki / Quizlet (.tsv)**: Standard tab-separated `Front\tBack` format for direct 1-click import into Anki decks.
   - **Study Guide Deck (.md)**: Markdown study cards with spoiler tags (`<details><summary>Reveal</summary>`).
   - **Flashcards CSV (.csv)**: Comma-separated question/answer table.
   - **Flashcards JSON (.json)**: Raw deck data.
4. **Quiz**:
   - **Printable Examination Sheet (HTML/Print)**: Generates a printable test paper with student metadata, checkbox answer bubbles, and triggers the print dialog.
   - **Quiz & Answer Key (.md)**: Markdown test sheet with an answer key and rationale.
   - **Quiz Dataset (.json)**: Full quiz questions, choices, answers, and explanations.
   - **Questions CSV (.csv)**: Spreadsheet-compatible question table.
5. **Mind Map**:
   - **Vector Graphic (.svg)**: Scalable SVG vector file.
   - **High-Res Image (.png)**: 2x retina raster image rendered via offscreen canvas.
   - **Outline Markdown (.md)**: Hierarchical nested bullet list.
   - **Mind Map JSON (.json)**: Tree structure graph data.
6. **Video Overview**:
   - **AI Video Prompts (.json)**: Ready-to-use prompts for Sora, Runway Gen-3, Kling, Luma Dream Machine, Pika.
   - **Director Script (.md)**: Production script with camera angles, narration, and on-screen text.
   - **Production Shotlist (.csv)**: Scene numbers, durations, camera cues, and audio cues.
   - **Video Storyboard (.txt)**: Plain text scene breakdown.
7. **Data Table**:
   - **CSV Spreadsheet (.csv)**: Standard RFC-4180 CSV.
   - **TSV (.tsv)**: Tab-separated values for Excel / Google Sheets copy-paste.
   - **Table JSON Array (.json)**: Mapped row objects.
   - **Markdown Table (.md)**: GitHub-Flavored Markdown table.
8. **Reports**:
   - **Direct PDF File (.pdf)**: Client-side vector PDF generation via `html2pdf.js`.
   - **Vector Print PDF (.pdf)**: Browser native print dialog.
   - **Markdown Document (.md)**: Full report with citations.
   - **Standalone HTML (.html)**: Self-contained styled HTML document.
   - **Plain Text (.txt)**: Clean unformatted text report.
9. **Infographics**:
   - **AI Artwork (.png)**: Full resolution download of generated image.
   - **Data Canvas Summary (.md)**: Hero metric, process flow, and key takeaways.
   - **Art Director Prompts (.json)**: Style parameters, aspect ratios, and visual prompts.
   - **Print Layout**: Print-optimized view.
10. **Notes**:
    - **Markdown Note (.md)**: Download note formatted as Markdown.
    - **Plain Text Note (.txt)**: Clean plain text note.

### B. Docker Containerization & Single-Command Deployment
1. **Multi-Stage `Dockerfile` (`node:20-alpine`)**:
   - Builder stage: Installs dependencies with `pnpm`, builds optimized production bundles with `tsc -b && vite build`.
   - Production runner stage: Compact Alpine runtime, copies compiled `dist`, Vite configuration, backend proxy router (`src/server`), and types.
   - Healthcheck: Native `wget` probe verifying `http://localhost:3000/`.
   - Command: `pnpm exec vite preview --host 0.0.0.0 --port 3000`.
2. **`docker-compose.yml`**:
   - Maps port `3000:3000`, configures restart policy `unless-stopped`, and sets health checks.
3. **`.dockerignore`**:
   - Excludes `node_modules`, `dist`, `.git`, `.gemini`, and temporary logs.
4. **Convenience Scripts in `package.json`**:
   - `pnpm run docker:build`: Builds `opennotebooklm:latest` Docker image.
   - `pnpm run docker:run`: Runs container daemon on port 3000.
   - `pnpm run docker:compose`: Launches container stack with docker-compose.
   - `pnpm run docker:compose:down`: Stops docker-compose stack.

---

## 3. Verification & Test Results

1. **TypeScript Build**:
   ```bash
   pnpm run build
   ```
   Exits with code 0. Generated bundle:
   - `dist/index.html` (1.57 kB)
   - `dist/assets/index-BThEfNrc.js` (504 kB / 109 kB gzip)
   - `dist/assets/vendor-pdf-EY_vGTTr.js` (984 kB / 285 kB gzip)
   - `dist/assets/vendor-katex-DYaNQwKs.js` (276 kB / 83 kB gzip)
   - `dist/assets/vendor-markdown-BvSdQyFi.js` (158 kB / 48 kB gzip)
   - `dist/assets/vendor-react-CEoX6A0R.js` (134 kB / 43 kB gzip)
   - `dist/assets/vendor-icons-Cowi0xCu.js` (47 kB / 11 kB gzip)
   - Zero errors, zero rollup warnings.

2. **Docker Configuration**:
   - Validated Dockerfile syntax and layer caching.
   - Validated `docker-compose.yml` service definitions and healthcheck parameters.

---

## 4. Key Files Reference

- **UI & Artifact Viewers**:
  - `src/components/StudioModal.tsx`: Main Studio modal with all 9 viewers and export dropdowns.
  - `src/components/MindMapCanvas.tsx`: Interactive SVG mind map with export options.
  - `src/components/ExportDropdown.tsx`: Sleek, accessible export button with dropdown menu.
- **Export Engine**:
  - `src/utils/exportUtils.ts`: All export helpers (WAV, VTT, SRT, MD, JSON, TSV, CSV, HTML, PNG).
  - `src/utils/pdfExport.ts`: Client-side vector PDF printer and file generator.
- **Docker & Deployment**:
  - `Dockerfile`: Multi-stage production container definition.
  - `docker-compose.yml`: Single-command docker-compose definition.
  - `.dockerignore`: Docker build ignore rules.
  - `package.json`: NPM and Docker scripts.
