# OpenNotebook MCP Multitenant Proxy Server

This repository contains a Model Context Protocol (MCP) server that acts
as a secure, multi-tenant proxy between an AI Assistant and the
OpenNotebook backend API. It exposes **81 MCP tools** covering 14 resource
domains with full CRUD, search, chat, podcast, and command management.

## ✨ Features

- **🔑 Identity Passthrough** — Extracts the `Authorization: Bearer <token>`
  header from incoming HTTP requests and forwards it to the OpenNotebook API
  without server-side authentication.
- **👥 Multi-Tenancy** — Uses Python `contextvars` to maintain thread-safe
  user identity isolation, ensuring all AI-driven actions are scoped to
  the authenticated user's permissions.
- **📊 Full OpenNotebook Coverage** — 81 tools mapped to OpenNotebook API
  endpoints across 14 resource domains.
- **⚡ TOON Optimization** — Bulk list responses are automatically compressed
  using TOON (Token-Optimized Object Notation) to reduce token consumption
  and maximize context window efficiency.
- **🚀 Efficient Gets** — GET responses return only commonly used fields by
  default. Full objects are available via an `include_all_fields` flag.
- **🧪 Comprehensive Testing** — 109 automated tests covering all tool
  domains, run via the test runner pipeline.
- **🏷️ Tool Annotations** — All tools expose standard MCP ToolAnnotations hints (readOnlyHint, destructiveHint, idempotentHint, openWorldHint). The tags field carries grouping metadata (basic/primary/advanced + opennotebook).

## 🔧 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENNOTEBOOK_BASE_URL` | Yes | Docker-internal URL of the OpenNotebook API |
| `MCP_SERVER_PORT` | Yes | Port number the MCP server listens on |
| `ALLOW_ALL_AGGREGATE` | No | When `true`, aggregate listing tools honor the `include_all_fields` parameter. When `false` (default), the parameter is silently forced to `False` for aggregate list operations. |
| `IS_STATEFUL` | No | When `true`, uses stateful Streamable HTTP with session tracking. When `false` (default), uses stateless mode. |

## 📦 Installation & Local Development

1. Ensure you have Python 3.12+ installed.
2. Install dependencies:
    ```bash
    pip install fastmcp httpx pydantic uvicorn toon-mcp-server
    ```
3. Run the server:
    ```bash
    export OPENNOTEBOOK_BASE_URL=http://localhost:5055
    export MCP_SERVER_PORT=80
    python -m src.main
    ```

## 🐳 Docker Deployment

Build and run the server using Docker:

```bash
docker build -t opennotebook-mcp:latest .
docker run -d --name opennotebook-mcp \
    -e OPENNOTEBOOK_BASE_URL="http://opennotebook-app:5055" \
    -e MCP_SERVER_PORT=80 \
    opennotebook-mcp:latest
```

The MCP server serves at `http://opennotebook-mcp:80/mcp`
(Streamable HTTP).

## ⚠️ Important Notes

- **📋 `include_all_fields`** — The `include_all_fields` parameter (available
  on all `get_*` and `list_*` tools) controls whether all available fields
  are included in responses. Defaults to `False` for performance; set to
  `True` only when additional fields are needed.
- **⚡ TOON Compression** — All bulk list responses are automatically
  compressed using TOON to reduce token consumption by 30–60%.
- **📝 Required Fields & Defaults** — Each `create_*` tool requires specific
  key fields. All other fields default to empty strings or reasonable values.
  The owner field is automatically set to the authenticated user for most
  resources.

## 🛠️ API Tool Mapping

The server implements 81 MCP tools organized into the following categories:

### 📓 Notebooks (9 tools)

- `check_server_status` — Check the health and status of the OpenNotebook backend API
- `list_all_notebooks` — List all notebook records
- `get_notebook_by_id` — Get a single notebook by ID
- `create_notebook` — Create a new notebook
- `update_notebook` — Update an existing notebook
- `delete_notebook_by_id` — Delete a notebook by ID
- `get_notebook_delete_preview` — Get a preview of what will be deleted
- `add_source_to_notebook` — Add an existing source to a notebook
- `remove_source_from_notebook` — Remove a source from a notebook
- `list_recently_viewed` — List recently viewed items

### 📝 Notes (5 tools)

- `list_all_notes` — List all note records
- `get_note_by_id` — Get a single note by ID
- `create_note` — Create a new note
- `update_note` — Update an existing note
- `delete_note_by_id` — Delete a note by ID

### 🔗 Sources (8 tools)

- `list_all_sources` — List all source records
- `get_source_by_id` — Get a single source by ID
- `create_source` — Create a new source (link or text type)
- `update_source` — Update an existing source
- `delete_source_by_id` — Delete a source by ID
- `get_source_status` — Get processing status for a source
- `retry_source_processing` — Retry processing for a failed source
- `list_source_insights` — List all insights for a source
- `create_source_insight` — Start insight generation for a source

### 💡 Insights (4 tools)

- `get_insight_by_id` — Get a single insight by ID
- `delete_insight_by_id` — Delete an insight by ID
- `save_insight_as_note` — Convert an insight to a note
- `list_source_insights` — List insights for a source

### 🔍 Search & Settings (4 tools)

- `search_knowledge_base` — Search the knowledge base
- `ask_knowledge_base_simple` — Ask the knowledge base a question
- `get_settings` — Get all application settings
- `update_settings` — Update application settings

### 🤖 Models (5 tools)

- `list_all_models` — List all configured models
- `create_model` — Create a new model configuration
- `delete_model_by_id` — Delete a model by ID
- `get_default_models` — Get default model assignments
- `update_default_models` — Update default model assignments

### 🔄 Transformations (8 tools)

- `list_all_transformations` — List all transformation records
- `get_transformation_by_id` — Get a single transformation by ID
- `create_transformation` — Create a new transformation
- `update_transformation` — Update an existing transformation
- `delete_transformation_by_id` — Delete a transformation by ID
- `execute_transformation` — Execute a transformation on input text
- `get_default_transformation_prompt` — Get the default prompt
- `update_default_transformation_prompt` — Update the default prompt

### 🧩 Embedding (3 tools)

- `embed_content` — Embed content for vector search
- `start_embedding_rebuild` — Start a background rebuild job
- `get_rebuild_status` — Get rebuild operation status

### 💬 Chat (7 tools)

- `list_chat_sessions` — List chat sessions for a notebook
- `create_chat_session` — Create a new chat session
- `get_chat_session` — Get a chat session with messages
- `update_chat_session` — Update a chat session
- `delete_chat_session` — Delete a chat session
- `execute_chat` — Execute a chat request
- `build_chat_context` — Build notebook context

### 🔌 Source Chat (5 tools)

- `create_source_chat_session` — Create a source chat session
- `list_source_chat_sessions` — List source chat sessions
- `get_source_chat_session` — Get a source chat session
- `update_source_chat_session` — Update a source chat session
- `delete_source_chat_session` — Delete a source chat session

### 🎙️ Podcasts (6 tools)

- `generate_podcast` — Generate a podcast episode
- `get_podcast_job_status` — Get podcast job status
- `list_podcast_episodes` — List all podcast episodes
- `get_podcast_episode` — Get a specific episode
- `retry_podcast_episode` — Retry a failed episode
- `delete_podcast_episode` — Delete a podcast episode

### 🎬 Episode Profiles (6 tools)

- `list_episode_profiles` — List all episode profiles
- `get_episode_profile` — Get a profile by name
- `create_episode_profile` — Create a new episode profile
- `update_episode_profile` — Update an episode profile
- `delete_episode_profile` — Delete an episode profile
- `duplicate_episode_profile` — Duplicate an episode profile

### 🗣️ Speaker Profiles (6 tools)

- `list_speaker_profiles` — List all speaker profiles
- `get_speaker_profile` — Get a profile by name
- `create_speaker_profile` — Create a new speaker profile
- `update_speaker_profile` — Update a speaker profile
- `delete_speaker_profile` — Delete a speaker profile
- `duplicate_speaker_profile` — Duplicate a speaker profile

### 📋 Commands (4 tools)

- `submit_command_job` — Submit a command for background processing
- `get_command_job_status` — Get command job status
- `list_command_jobs` — List command jobs
- `cancel_command_job` — Cancel a running command job
