import os
import sys
from contextvars import ContextVar
from typing import Any, Optional

from fastmcp import FastMCP, Context
from mcp.types import ToolAnnotations
from pydantic import BaseModel, Field
from toon_mcp import json_to_toon

from .client import OpenNotebookClient

_current_user_token: ContextVar[Optional[str]] = ContextVar("current_user_token", default=None)


class AuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            auth_header = headers.get(b"authorization", b"").decode()
            if auth_header.startswith("Bearer "):
                _current_user_token.set(auth_header[7:])
        await self.app(scope, receive, send)


mcp = FastMCP("OpenNotebook-mcp-server")

_client: Optional[OpenNotebookClient] = None


def get_client() -> OpenNotebookClient:
    global _client
    if _client is None:
        _client = OpenNotebookClient()
    return _client


def get_user_token() -> Optional[str]:
    return _current_user_token.get()


ALLOW_ALL_AGGREGATE = os.getenv("ALLOW_ALL_AGGREGATE", "false").lower() in ("true", "1", "yes")
IS_STATEFUL = os.getenv("IS_STATEFUL", "false").lower() in ("true", "1", "yes")


# =============================================================================
# Pydantic Contract Models
# =============================================================================


class CreateNotebookParam(BaseModel):
    name: str = Field(..., description='Name of the notebook (e.g. "My Research Notebook").')
    description: str = Field("", description="Description of the notebook.")


class UpdateNotebookParam(BaseModel):
    name: Optional[str] = Field(None, description="New name for the notebook.")
    description: Optional[str] = Field(None, description="New description for the notebook.")
    archived: Optional[bool] = Field(None, description="Whether the notebook is archived: true or false.")


class CreateNoteParam(BaseModel):
    content: str = Field(..., description='Markdown content of the note (e.g. "# Title\\n\\nBody text.").')
    title: Optional[str] = Field(None, description="Title of the note.")
    note_type: str = Field("human", description="Type of note: human or ai (Default: human).")
    notebook_id: str = Field(..., description='Notebook ID to add the note to (e.g. "notebook:rcxuqr34bn7y30unh8pw").')


class UpdateNoteParam(BaseModel):
    title: Optional[str] = Field(None, description="New title for the note.")
    content: Optional[str] = Field(None, description="New content for the note.")
    note_type: Optional[str] = Field(None, description="New note type: human or ai.")


class SourceCreateParam(BaseModel):
    type: str = Field(..., description="Source type: link or text (upload not supported via MCP because it requires a file).")
    url: Optional[str] = Field(None, description='URL for link type sources (e.g. "https://example.com/article").')
    content: Optional[str] = Field(None, description="Text content for text type sources.")
    title: Optional[str] = Field(None, description="Optional source title.")
    notebooks: Optional[list[str]] = Field(None, description='List of notebook IDs to add the source to (e.g. ["notebook:rcxuqr34bn7y30unh8pw"]).')
    embed: bool = Field(False, description="Whether to embed content for vector search: true or false (Default: false).")
    delete_source: bool = Field(False, description="Whether to delete the uploaded file after processing: true or false (Default: false).")
    async_processing: bool = Field(False, description="Whether to process the source asynchronously: true or false (Default: false).")
    transformations: list[str] = Field(default_factory=list, description='List of transformation IDs to apply (e.g. ["transformation:abcd1234"]).')


class SourceUpdateParam(BaseModel):
    title: Optional[str] = Field(None, description="New title for the source.")
    topics: Optional[list[str]] = Field(None, description='New list of topics for the source (e.g. ["AI", "Research"]).')


class CreateSourceInsightParam(BaseModel):
    transformation_id: str = Field(..., description='ID of the transformation to apply (e.g. "transformation:abcd1234").')
    model_id: Optional[str] = Field(None, description='Model ID to use for insight generation; uses the default if not provided (e.g. "model:abcd1234").')


class SaveAsNoteParam(BaseModel):
    notebook_id: Optional[str] = Field(None, description='Notebook ID to add the note to (e.g. "notebook:rcxuqr34bn7y30unh8pw"). Optional.')


class SearchKnowledgeBaseParam(BaseModel):
    query: str = Field(..., description='Search keyword or phrase (e.g. "quantum computing").')
    type: str = Field("text", description="Search type: text or vector (Default: text).")
    limit: int = Field(100, description="Maximum number of results (1-1000) (Default: 100).")
    search_sources: bool = Field(True, description="Include sources in search: true or false (Default: true).")
    search_notes: bool = Field(True, description="Include notes in search: true or false (Default: true).")
    minimum_score: float = Field(0.2, description="Minimum score for vector search (0-1) (Default: 0.2).")


class AskKnowledgeBaseParam(BaseModel):
    question: str = Field(..., description='Question to ask the knowledge base (e.g. "What is the main thesis?").')
    strategy_model: str = Field(..., description='Model ID for query strategy (e.g. "model:abcd1234").')
    answer_model: str = Field(..., description='Model ID for individual answers (e.g. "model:abcd1234").')
    final_answer_model: str = Field(..., description='Model ID for final answer (e.g. "model:abcd1234").')


class CreateModelParam(BaseModel):
    name: str = Field(..., description='Model name (e.g. "gpt-5-mini", "claude", "gemini").')
    provider: str = Field(..., description='Provider name (e.g. "openai", "anthropic", "gemini").')
    type: str = Field(..., description="Model type: language, embedding, text_to_speech, or speech_to_text.")
    credential: Optional[str] = Field(None, description='Credential ID to link this model to (e.g. "credential:abcd1234"). Optional.')


class CreateTransformationParam(BaseModel):
    name: str = Field(..., description='Transformation name (e.g. "summary").')
    title: str = Field(..., description='Display title for the transformation (e.g. "Summary").')
    description: str = Field(..., description="Description of what this transformation does.")
    prompt: str = Field(..., description="The transformation prompt template.")
    apply_default: bool = Field(False, description="Whether to apply this transformation by default: true or false (Default: false).")
    model_id: Optional[str] = Field(None, description='Model ID to use by default for this transformation (e.g. "model:abcd1234"). Optional.')


class UpdateTransformationParam(BaseModel):
    name: Optional[str] = Field(None, description="New name for the transformation.")
    title: Optional[str] = Field(None, description="New display title.")
    description: Optional[str] = Field(None, description="New description.")
    prompt: Optional[str] = Field(None, description="New transformation prompt.")
    apply_default: Optional[bool] = Field(None, description="Whether to apply by default: true or false.")
    model_id: Optional[str] = Field(None, description='Model ID to use by default (e.g. "model:abcd1234").')


class ExecuteTransformationParam(BaseModel):
    transformation_id: str = Field(..., description='ID of the transformation to execute (e.g. "transformation:abcd1234").')
    input_text: str = Field(..., description='Text to transform (e.g. "The quick brown fox jumps over the lazy dog.").')
    model_id: Optional[str] = Field(None, description='Model ID to use for this transformation run (e.g. "model:abcd1234"). Optional.')


class DefaultPromptUpdateParam(BaseModel):
    transformation_instructions: str = Field(..., description='Default transformation instructions (e.g. "Summarize the key points in bullet form.").')


class EmbedContentParam(BaseModel):
    item_id: str = Field(..., description='ID of the item to embed (e.g. "source:abcd1234").')
    item_type: str = Field(..., description="Type of item: source or note.")
    async_processing: bool = Field(False, description="Process asynchronously in background: true or false (Default: false).")


class StartEmbeddingRebuildParam(BaseModel):
    mode: str = Field("existing", description="Rebuild mode: existing (re-embeds items with embeddings) or all (embeds everything) (Default: existing).")
    include_sources: bool = Field(True, description="Include sources in rebuild: true or false (Default: true).")
    include_notes: bool = Field(True, description="Include notes in rebuild: true or false (Default: true).")
    include_insights: bool = Field(True, description="Include insights in rebuild: true or false (Default: true).")


class UpdateSettingsParam(BaseModel):
    default_content_processing_engine_doc: Optional[str] = Field(None, description="Default engine for doc processing: auto, docling, or simple.")
    default_content_processing_engine_url: Optional[str] = Field(None, description="Default engine for URL processing: auto, firecrawl, jina, crawl4ai, or simple.")
    default_embedding_option: Optional[str] = Field(None, description="Default embedding option: ask, always, or never.")
    auto_delete_files: Optional[str] = Field(None, description="Auto-delete files after processing: yes or no.")
    docling_ocr: Optional[bool] = Field(None, description="Enable Docling OCR: true or false.")
    docling_formulas: Optional[bool] = Field(None, description="Enable Docling formulas: true or false.")
    docling_vision: Optional[bool] = Field(None, description="Enable Docling vision: true or false.")
    youtube_preferred_languages: Optional[list[str]] = Field(None, description='Preferred YouTube languages as ISO 639-1 codes (e.g. ["en", "es"]).')


class CreateChatSessionParam(BaseModel):
    notebook_id: str = Field(..., description='Notebook ID to create the session for (e.g. "notebook:rcxuqr34bn7y30unh8pw").')
    title: Optional[str] = Field(None, description="Optional session title.")
    model_override: Optional[str] = Field(None, description='Optional model override for this session (e.g. "model:abcd1234").')


class UpdateChatSessionParam(BaseModel):
    title: Optional[str] = Field(None, description="New title for the session.")
    model_override: Optional[str] = Field(None, description='Model override for this session (e.g. "model:abcd1234").')


class ChatContextItem(BaseModel):
    """A single source or note entry inside a chat context payload.

    Sources may include ``full_text``; notes may include ``content``.
    Unknown keys are preserved and passed through to the backend.
    """
    id: str = Field(..., description='ID of the source or note (e.g. "source:abcd1234").')
    title: Optional[str] = Field(None, description="Title of the source or note.")
    content: Optional[str] = Field(None, description="Text content (present for notes).")
    full_text: Optional[str] = Field(None, description="Full text (present for sources).")
    insights: list["SourceInsightItem"] = Field(default_factory=list, description="Insights attached to a source.")


class SourceInsightItem(BaseModel):
    id: str = Field(..., description='ID of the insight (e.g. "source_insight:abcd1234").')
    insight_type: str = Field(..., description='Type of the insight (e.g. "summary", "key_takeaways").')
    content: str = Field(..., description="Insight content text.")


class ChatContext(BaseModel):
    sources: list[ChatContextItem] = Field(default_factory=list, description="Sources to include in the chat context.")
    notes: list[ChatContextItem] = Field(default_factory=list, description="Notes to include in the chat context.")


class ExecuteChatParam(BaseModel):
    session_id: str = Field(..., description='Chat session ID (e.g. "chat_session:abcd1234").')
    message: str = Field(..., description='User message content (e.g. "Summarize the attached sources.").')
    context: ChatContext = Field(..., description="Chat context with sources and notes. Pass the output of build_chat_context.")
    model_override: Optional[str] = Field(None, description='Optional model override for this message (e.g. "model:abcd1234").')


class ContextConfigItem(BaseModel):
    sources: dict[str, str] = Field(default_factory=dict, description='Source ID to inclusion status. Status: not in, insights, or full content. e.g. {"source:abcd1234": "full content"}.')
    notes: dict[str, str] = Field(default_factory=dict, description='Note ID to inclusion status. Status: not in or full content. e.g. {"note:abcd1234": "full content"}.')


class BuildChatContextParam(BaseModel):
    notebook_id: str = Field(..., description='Notebook ID (e.g. "notebook:rcxuqr34bn7y30unh8pw").')
    context_config: ContextConfigItem = Field(default_factory=ContextConfigItem, description="Context configuration. Empty {} includes everything with short context.")


class CreateSourceChatSessionParam(BaseModel):
    source_id: str = Field(..., description='Source ID to create the chat session for (e.g. "source:abcd1234").')
    title: Optional[str] = Field(None, description="Optional session title.")
    model_override: Optional[str] = Field(None, description='Optional model override for this session (e.g. "model:abcd1234").')


class UpdateSourceChatSessionParam(BaseModel):
    title: Optional[str] = Field(None, description="New title for the session.")
    model_override: Optional[str] = Field(None, description='Model override for this session (e.g. "model:abcd1234").')


class GeneratePodcastParam(BaseModel):
    episode_profile: str = Field(..., description='Episode profile name (e.g. "tech_experts"). A record ID (e.g. "episode_profile:abcd1234") is also accepted and resolved automatically to its name.')
    speaker_profile: str = Field(..., description='Speaker profile name (e.g. "tech_experts"). A record ID (e.g. "speaker_profile:abcd1234") is also accepted and resolved automatically to its name.')
    episode_name: str = Field(..., description='Name for the episode (e.g. "Episode 1: AI in 2026").')
    content: Optional[str] = Field(None, description="Content to discuss in the podcast. Required if notebook_id is not provided.")
    notebook_id: Optional[str] = Field(None, description='Notebook ID to pull content from (e.g. "notebook:rcxuqr34bn7y30unh8pw"). Required if content is not provided.')
    briefing_suffix: Optional[str] = Field(None, description="Optional briefing suffix appended to the episode briefing.")


class CreateEpisodeProfileParam(BaseModel):
    name: str = Field(..., description='Unique profile name (e.g. "tech_experts").')
    description: str = Field("", description="Profile description.")
    speaker_config: str = Field(..., description='Speaker profile record ID (e.g. "speaker_profile:abcd1234").')
    outline_llm: Optional[str] = Field(None, description='Model record ID for outline generation (e.g. "model:abcd1234"). Optional.')
    transcript_llm: Optional[str] = Field(None, description='Model record ID for transcript generation (e.g. "model:abcd1234"). Optional.')
    language: Optional[str] = Field(None, description='Podcast language code (e.g. "en-US"). Optional.')
    default_briefing: str = Field(..., description='Default briefing template (e.g. "Discuss the latest AI research.").')
    num_segments: int = Field(5, description="Number of podcast segments (1-20) (Default: 5).")
    max_tokens: Optional[int] = Field(None, description="Max output tokens for outline/transcript generation (e.g. 4096). Optional.")


class SpeakerConfig(BaseModel):
    name: str = Field(..., description='Speaker name (e.g. "Alice").')
    voice_id: str = Field(..., description='Voice ID for TTS (e.g. "en-US-1").')
    backstory: str = Field(..., description='Speaker backstory (e.g. "AI researcher for 10 years").')
    personality: str = Field(..., description='Speaker personality (e.g. "Engaging").')


class CreateSpeakerProfileParam(BaseModel):
    name: str = Field(..., description='Unique profile name (e.g. "tech_experts").')
    description: str = Field("", description="Profile description.")
    voice_model: Optional[str] = Field(None, description='Model record ID for TTS (e.g. "model:abcd1234"). Optional.')
    speakers: list[SpeakerConfig] = Field(..., description="Array of speaker configurations, each with name, voice_id, backstory, and personality.")


class UpdateDefaultModelsParam(BaseModel):
    default_chat_model: Optional[str] = Field(None, description='Default chat model ID (e.g. "model:abcd1234"). Optional.')
    default_transformation_model: Optional[str] = Field(None, description='Default transformation model ID (e.g. "model:abcd1234"). Optional.')
    large_context_model: Optional[str] = Field(None, description='Large context model ID (e.g. "model:abcd1234"). Optional.')
    default_text_to_speech_model: Optional[str] = Field(None, description='Default text-to-speech model ID (e.g. "model:abcd1234"). Optional.')
    default_speech_to_text_model: Optional[str] = Field(None, description='Default speech-to-text model ID (e.g. "model:abcd1234"). Optional.')
    default_embedding_model: Optional[str] = Field(None, description='Default embedding model ID (e.g. "model:abcd1234"). Optional.')
    default_tools_model: Optional[str] = Field(None, description='Default tools model ID (e.g. "model:abcd1234"). Optional.')


class SubmitCommandParam(BaseModel):
    command: str = Field(..., description='Command function name: generate_podcast or rebuild_embeddings (e.g. "rebuild_embeddings").')
    app: str = Field("open_notebook", description='Application name (Default: "open_notebook").')
    input: dict[str, Any] = Field(default_factory=dict, description='Arguments to pass to the command as a dict. For generate_podcast ALL of these are required: {"episode_profile": "<NAME>", "speaker_profile": "<NAME>", "episode_name": "...", "content": "..."}. NOTE: unlike the generate_podcast tool, this raw-command path does NOT fetch content from notebook_id and does NOT resolve profile names/IDs - profile values must be NAMES and content must be provided explicitly. For rebuild_embeddings: {"mode": "existing", "include_sources": true, "include_notes": true, "include_insights": true}.')


# =============================================================================
# Health Tool
# =============================================================================


@mcp.tool(
    tags={"basic", "opennotebook"}, annotations=ToolAnnotations(title="Check Server Status", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def check_server_status(
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Check the health and status of the OpenNotebook backend API.

    Returns connectivity and version info. No arguments required.

    Args:
        include_all_fields: Default False (common fields only). Set True for all fields.
    """
    return await get_client().check_server_status(
        get_user_token(), include_all_fields=include_all_fields
    )


# =============================================================================
# Notebook Tools
# =============================================================================


@mcp.tool(
    tags={"basic", "opennotebook"}, annotations=ToolAnnotations(title="List All Notebooks", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def list_all_notebooks(
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """List all notebook records.

    Args:
        include_all_fields: Default False (common fields only). Set True for all fields.
    """
    data = await get_client().list_all_notebooks(
        get_user_token(),
        include_all_fields=include_all_fields if ALLOW_ALL_AGGREGATE else False
    )
    return {"items": json_to_toon(data)}


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Create Notebook", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def create_notebook(
    name: str,
    description: str = "",
    ctx: Context = None,
) -> dict[str, Any]:
    """Create a new notebook.

Args:
    name: Name of the notebook (e.g. "My Research Notebook").
    description: Description of the notebook.
    """
    params = CreateNotebookParam(name=name, description=description)
    return await get_client().create_notebook(
        params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"basic", "opennotebook"}, annotations=ToolAnnotations(title="Get Notebook By Id", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def get_notebook_by_id(
    id: str,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Get a single notebook by ID.

    Args:
        id: The unique ID of the notebook (e.g. "notebook:rcxuqr34bn7y30unh8pw"). Get the notebook id from list_all_notebooks.
        include_all_fields: Default False (common fields only). Set True for all fields.
    """
    return await get_client().get_notebook_by_id(
        id, get_user_token(), include_all_fields=include_all_fields
    )


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Update Notebook", readOnlyHint=False, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def update_notebook(
    id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    archived: Optional[bool] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Update an existing notebook.

Args:
    id: The unique ID of the notebook to update (e.g. "notebook:rcxuqr34bn7y30unh8pw"). Get the notebook id from list_all_notebooks.
    name: New name for the notebook.
    description: New description for the notebook.
    archived: Whether the notebook is archived: true or false.
    """
    params = UpdateNotebookParam(name=name, description=description, archived=archived)
    return await get_client().update_notebook(
        id, params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"basic", "opennotebook"}, annotations=ToolAnnotations(title="Delete Notebook By Id", readOnlyHint=False, destructiveHint=True, idempotentHint=True, openWorldHint=False)
)
async def delete_notebook_by_id(
    id: str,
    ctx: Context = None,
) -> dict[str, Any]:
    """Delete a notebook by ID.

Args:
    id: The unique ID of the notebook to delete (e.g. "notebook:rcxuqr34bn7y30unh8pw"). Get the notebook id from list_all_notebooks.
    """
    await get_client().delete_notebook_by_id(id, get_user_token())
    return {"deleted": True, "id": id}


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Get Notebook Delete Preview", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def get_notebook_delete_preview(
    id: str,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Get a preview of what will be deleted when deleting a notebook.

Args:
    id: The unique ID of the notebook (e.g. "notebook:rcxuqr34bn7y30unh8pw"). Get the notebook id from list_all_notebooks.
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    return await get_client().get_notebook_delete_preview(
        id, get_user_token(), include_all_fields=include_all_fields
    )


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Add Source To Notebook", readOnlyHint=False, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def add_source_to_notebook(
    notebook_id: str,
    source_id: str,
    ctx: Context = None,
) -> dict[str, Any]:
    """Add an existing source to a notebook.

Args:
    notebook_id: The unique ID of the notebook (e.g. "notebook:rcxuqr34bn7y30unh8pw"). Get the notebook id from list_all_notebooks.
    source_id: The unique ID of the source to add (e.g. "source:abcd1234").
    """
    return await get_client().add_source_to_notebook(notebook_id, source_id, get_user_token(), include_all_fields=ALLOW_ALL_AGGREGATE)


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Remove Source From Notebook", readOnlyHint=False, destructiveHint=True, idempotentHint=True, openWorldHint=False)
)
async def remove_source_from_notebook(
    notebook_id: str,
    source_id: str,
    ctx: Context = None,
) -> dict[str, Any]:
    """Remove a source from a notebook.

Args:
    notebook_id: The unique ID of the notebook (e.g. "notebook:rcxuqr34bn7y30unh8pw"). Get the notebook id from list_all_notebooks.
    source_id: The unique ID of the source to remove (e.g. "source:abcd1234").
    """
    return await get_client().remove_source_from_notebook(notebook_id, source_id, get_user_token(), include_all_fields=ALLOW_ALL_AGGREGATE)


# =============================================================================
# Recently Viewed
# =============================================================================


@mcp.tool(
    tags={"basic", "opennotebook"}, annotations=ToolAnnotations(title="List Recently Viewed", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def list_recently_viewed(
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """List recently viewed notebooks and sources.

    Args:
        include_all_fields: Default False (common fields only). Set True for all fields.
    """
    data = await get_client().list_recently_viewed(
        get_user_token(),
        include_all_fields=include_all_fields if ALLOW_ALL_AGGREGATE else False
    )
    return {"items": json_to_toon(data)}


# =============================================================================
# Note Tools
# =============================================================================


@mcp.tool(
    tags={"basic", "opennotebook"}, annotations=ToolAnnotations(title="List All Notes", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def list_all_notes(
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """List all note records.

    Args:
        include_all_fields: Default False (common fields only). Set True for all fields.
    """
    data = await get_client().list_all_notes(
        get_user_token(),
        include_all_fields=include_all_fields if ALLOW_ALL_AGGREGATE else False
    )
    return {"items": json_to_toon(data)}


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Create Note", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def create_note(
    content: str,
    notebook_id: str,
    title: Optional[str] = None,
    note_type: str = "human",
    ctx: Context = None,
) -> dict[str, Any]:
    """Create a new note.

Args:
    content: Markdown content of the note.
    title: Title of the note.
    note_type: Type of note: human or ai (Default: human).
    notebook_id: Notebook ID to add the note to (e.g. "notebook:rcxuqr34bn7y30unh8pw"). Get the notebook id from list_all_notebooks.
    """
    params = CreateNoteParam(content=content, title=title, note_type=note_type, notebook_id=notebook_id)
    return await get_client().create_note(
        params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"basic", "opennotebook"}, annotations=ToolAnnotations(title="Get Note By Id", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def get_note_by_id(
    id: str,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Get a single note by ID.

Args:
    id: The unique ID of the note (e.g. "note:abcd1234"). Get the note id from list_all_notes.
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    return await get_client().get_note_by_id(
        id, get_user_token(), include_all_fields=include_all_fields
    )


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Update Note", readOnlyHint=False, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def update_note(
    id: str,
    title: Optional[str] = None,
    content: Optional[str] = None,
    note_type: Optional[str] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Update an existing note.

Args:
    id: The unique ID of the note to update (e.g. "note:abcd1234"). Get the note id from list_all_notes.
    title: New title for the note.
    content: New content for the note.
    note_type: New note type: human or ai.
    """
    params = UpdateNoteParam(title=title, content=content, note_type=note_type)
    return await get_client().update_note(
        id, params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"basic", "opennotebook"}, annotations=ToolAnnotations(title="Delete Note By Id", readOnlyHint=False, destructiveHint=True, idempotentHint=True, openWorldHint=False)
)
async def delete_note_by_id(
    id: str,
    ctx: Context = None,
) -> dict[str, Any]:
    """Delete a note by ID.

Args:
    id: The unique ID of the note to delete (e.g. "note:abcd1234"). Get the note id from list_all_notes.
    """
    await get_client().delete_note_by_id(id, get_user_token())
    return {"deleted": True, "id": id}


# =============================================================================
# Source Tools
# =============================================================================


@mcp.tool(
    tags={"basic", "opennotebook"}, annotations=ToolAnnotations(title="List All Sources", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def list_all_sources(
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """List all source records.

    Args:
        include_all_fields: Default False (common fields only). Set True for all fields.
    """
    data = await get_client().list_all_sources(
        get_user_token(),
        include_all_fields=include_all_fields if ALLOW_ALL_AGGREGATE else False
    )
    return {"items": json_to_toon(data)}


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Create Source", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def create_source(
    type: str,
    url: Optional[str] = None,
    content: Optional[str] = None,
    title: Optional[str] = None,
    notebooks: Optional[list[str]] = None,
    embed: bool = False,
    delete_source: bool = False,
    async_processing: bool = False,
    transformations: list[str] = [],
    ctx: Context = None,
) -> dict[str, Any]:
    """Create a new source (link or text type via JSON endpoint).

Args:
    type: Source type: link or text. Upload type is not supported via MCP because it requires a file.
    url: URL for link type sources (e.g. "https://example.com/article").
    content: Text content for text type sources.
    title: Optional source title.
    notebooks: List of notebook IDs to add the source to (e.g. ["notebook:rcxuqr34bn7y30unh8pw"]).
    embed: Whether to embed content for vector search: true or false (Default: false).
    delete_source: Whether to delete the uploaded file after processing: true or false (Default: false).
    async_processing: Whether to process the source asynchronously: true or false (Default: false).
    transformations: List of transformation IDs to apply (e.g. ["transformation:abcd1234"]).
    """
    params = SourceCreateParam(type=type, url=url, content=content, title=title, notebooks=notebooks, embed=embed, delete_source=delete_source, async_processing=async_processing, transformations=transformations)
    return await get_client().create_source(
        params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"basic", "opennotebook"}, annotations=ToolAnnotations(title="Get Source By Id", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def get_source_by_id(
    id: str,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Get a single source by ID.

Args:
    id: The unique ID of the source (e.g. "source:abcd1234"). Get the source id from list_all_sources.
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    return await get_client().get_source_by_id(
        id, get_user_token(), include_all_fields=include_all_fields
    )


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Update Source", readOnlyHint=False, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def update_source(
    id: str,
    title: Optional[str] = None,
    topics: Optional[list[str]] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Update an existing source.

Args:
    id: The unique ID of the source to update (e.g. "source:abcd1234"). Get the source id from list_all_sources.
    title: New title for the source.
    topics: New list of topics for the source (e.g. ["AI", "Research"]).
    """
    params = SourceUpdateParam(title=title, topics=topics)
    return await get_client().update_source(
        id, params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"basic", "opennotebook"}, annotations=ToolAnnotations(title="Delete Source By Id", readOnlyHint=False, destructiveHint=True, idempotentHint=True, openWorldHint=False)
)
async def delete_source_by_id(
    id: str,
    ctx: Context = None,
) -> dict[str, Any]:
    """Delete a source by ID.

Args:
    id: The unique ID of the source to delete (e.g. "source:abcd1234"). Get the source id from list_all_sources.
    """
    await get_client().delete_source_by_id(id, get_user_token())
    return {"deleted": True, "id": id}


# =============================================================================
# Source Status & Retry
# =============================================================================


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Get Source Status", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def get_source_status(
    id: str,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Get processing status for a source.

Args:
    id: The unique ID of the source (e.g. "source:abcd1234"). Get the source id from list_all_sources.
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    return await get_client().get_source_status(
        id, get_user_token(), include_all_fields=include_all_fields
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Retry Source Processing", readOnlyHint=False, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def retry_source_processing(
    id: str,
    ctx: Context = None,
) -> dict[str, Any]:
    """Retry processing for a failed or stuck source.

Args:
    id: The unique ID of the source to retry (e.g. "source:abcd1234"). Get the source id from list_all_sources.
    """
    return await get_client().retry_source_processing(id, get_user_token(), include_all_fields=ALLOW_ALL_AGGREGATE)


# =============================================================================
# Source Insights
# =============================================================================


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="List Source Insights", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def list_source_insights(
    source_id: str,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """List all insights for a source.

Args:
    source_id: The unique ID of the source (e.g. "source:abcd1234"). Get the source id from list_all_sources.
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    data = await get_client().list_source_insights(
        source_id, get_user_token(),
        include_all_fields=include_all_fields if ALLOW_ALL_AGGREGATE else False
    )
    return {"items": json_to_toon(data)}


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Create Source Insight", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def create_source_insight(
    source_id: str,
    transformation_id: str,
    model_id: Optional[str] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Start insight generation for a source by running a transformation.

Args:
    source_id: The unique ID of the source (e.g. "source:abcd1234"). Get the source id from list_all_sources.
    transformation_id: ID of the transformation to apply (e.g. "transformation:abcd1234"). Get the transformation id from list_all_transformations.
    model_id: Model ID to use for insight generation; uses the default if not provided (e.g. "model:abcd1234"). Optional.
    """
    params = CreateSourceInsightParam(transformation_id=transformation_id, model_id=model_id)
    return await get_client().create_source_insight(
        source_id, params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


# =============================================================================
# Insight Tools
# =============================================================================


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Get Insight By Id", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def get_insight_by_id(
    id: str,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Get a single insight by ID.

Args:
    id: The unique ID of the insight (e.g. "source_insight:abcd1234"). Get the insight id from list_source_insights.
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    return await get_client().get_insight_by_id(
        id, get_user_token(), include_all_fields=include_all_fields
    )


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Delete Insight By Id", readOnlyHint=False, destructiveHint=True, idempotentHint=True, openWorldHint=False)
)
async def delete_insight_by_id(
    id: str,
    ctx: Context = None,
) -> dict[str, Any]:
    """Delete an insight by ID.

Args:
    id: The unique ID of the insight to delete (e.g. "source_insight:abcd1234"). Get the insight id from list_source_insights.
    """
    await get_client().delete_insight_by_id(id, get_user_token())
    return {"deleted": True, "id": id}


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Save Insight As Note", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def save_insight_as_note(
    id: str,
    notebook_id: Optional[str] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Convert an insight to a note.

Args:
    id: The unique ID of the insight (e.g. "source_insight:abcd1234"). Get the insight id from list_source_insights.
    notebook_id: Notebook ID to add the note to (e.g. "notebook:rcxuqr34bn7y30unh8pw"). Optional.
    """
    params = SaveAsNoteParam(notebook_id=notebook_id)
    return await get_client().save_insight_as_note(
        id, params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


# =============================================================================
# Search Tools
# =============================================================================


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Search Knowledge Base", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def search_knowledge_base(
    query: str,
    type: str = "text",
    limit: int = 100,
    search_sources: bool = True,
    search_notes: bool = True,
    minimum_score: float = 0.2,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Search the knowledge base using text or vector search.

Args:
    query: Search keyword or phrase (e.g. "quantum computing").
    type: Search type: text or vector (Default: text).
    limit: Maximum number of results (1-1000) (Default: 100).
    search_sources: Include sources in search: true or false (Default: true).
    search_notes: Include notes in search: true or false (Default: true).
    minimum_score: Minimum score for vector search (0-1) (Default: 0.2).
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    params = SearchKnowledgeBaseParam(query=query, type=type, limit=limit, search_sources=search_sources, search_notes=search_notes, minimum_score=minimum_score)
    return await get_client().search_knowledge_base(
        params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=include_all_fields
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Ask Knowledge Base Simple", readOnlyHint=True, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def ask_knowledge_base_simple(
    question: str,
    strategy_model: str,
    answer_model: str,
    final_answer_model: str,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Ask the knowledge base a question and return a simple response (non-streaming).

Requires three configured models (strategy, answer, final_answer).

Args:
    question: Question to ask the knowledge base (e.g. "What is the main thesis?").
    strategy_model: Model ID for query strategy (e.g. "model:abcd1234").
    answer_model: Model ID for individual answers (e.g. "model:abcd1234").
    final_answer_model: Model ID for final answer (e.g. "model:abcd1234").
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    params = AskKnowledgeBaseParam(question=question, strategy_model=strategy_model, answer_model=answer_model, final_answer_model=final_answer_model)
    return await get_client().ask_knowledge_base_simple(
        params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=include_all_fields
    )


# =============================================================================
# Model Tools
# =============================================================================


@mcp.tool(
    tags={"basic", "opennotebook"}, annotations=ToolAnnotations(title="List All Models", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def list_all_models(
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """List all configured model records.

    Args:
        include_all_fields: Default False (common fields only). Set True for all fields.
    """
    data = await get_client().list_all_models(
        get_user_token(),
        include_all_fields=include_all_fields if ALLOW_ALL_AGGREGATE else False
    )
    return {"items": json_to_toon(data)}


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Create Model", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def create_model(
    name: str,
    provider: str,
    type: str,
    credential: Optional[str] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Create a new model configuration.

Args:
    name: Model name (e.g. gpt-5-mini, claude, gemini).
    provider: Provider name (e.g. openai, anthropic, gemini).
    type: Model type: language, embedding, text_to_speech, or speech_to_text.
    credential: Credential ID to link this model to (e.g. "credential:abcd1234"). Optional.
    """
    params = CreateModelParam(name=name, provider=provider, type=type, credential=credential)
    return await get_client().create_model(
        params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Delete Model By Id", readOnlyHint=False, destructiveHint=True, idempotentHint=True, openWorldHint=False)
)
async def delete_model_by_id(
    id: str,
    ctx: Context = None,
) -> dict[str, Any]:
    """Delete a model configuration by ID.

Args:
    id: The unique ID of the model to delete (e.g. "model:abcd1234"). Get the model id from list_all_models.
    """
    await get_client().delete_model_by_id(id, get_user_token())
    return {"deleted": True, "id": id}


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Get Default Models", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def get_default_models(
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Get default model assignments.

    Args:
        include_all_fields: Default False (common fields only). Set True for all fields.
    """
    return await get_client().get_default_models(
        get_user_token(), include_all_fields=include_all_fields
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Update Default Models", readOnlyHint=False, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def update_default_models(
    default_chat_model: Optional[str] = None,
    default_transformation_model: Optional[str] = None,
    large_context_model: Optional[str] = None,
    default_text_to_speech_model: Optional[str] = None,
    default_speech_to_text_model: Optional[str] = None,
    default_embedding_model: Optional[str] = None,
    default_tools_model: Optional[str] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Update default model assignments (partial update).

Args:
    default_chat_model: Default chat model ID (e.g. "model:abcd1234"). Optional.
    default_transformation_model: Default transformation model ID (e.g. "model:abcd1234"). Optional.
    large_context_model: Large context model ID (e.g. "model:abcd1234"). Optional.
    default_text_to_speech_model: Default text-to-speech model ID (e.g. "model:abcd1234"). Optional.
    default_speech_to_text_model: Default speech-to-text model ID (e.g. "model:abcd1234"). Optional.
    default_embedding_model: Default embedding model ID (e.g. "model:abcd1234"). Optional.
    default_tools_model: Default tools model ID (e.g. "model:abcd1234"). Optional.
    """
    params = UpdateDefaultModelsParam(default_chat_model=default_chat_model, default_transformation_model=default_transformation_model, large_context_model=large_context_model, default_text_to_speech_model=default_text_to_speech_model, default_speech_to_text_model=default_speech_to_text_model, default_embedding_model=default_embedding_model, default_tools_model=default_tools_model)
    return await get_client().update_default_models(
        params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


# =============================================================================
# Transformation Tools
# =============================================================================


@mcp.tool(
    tags={"basic", "opennotebook"}, annotations=ToolAnnotations(title="List All Transformations", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def list_all_transformations(
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """List all transformation records.

    Args:
        include_all_fields: Default False (common fields only). Set True for all fields.
    """
    data = await get_client().list_all_transformations(
        get_user_token(),
        include_all_fields=include_all_fields if ALLOW_ALL_AGGREGATE else False
    )
    return {"items": json_to_toon(data)}


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Create Transformation", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def create_transformation(
    name: str,
    title: str,
    description: str,
    prompt: str,
    apply_default: bool = False,
    model_id: Optional[str] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Create a new transformation.

Args:
    name: Transformation name (e.g. "summary").
    title: Display title for the transformation (e.g. "Summary").
    description: Description of what this transformation does.
    prompt: The transformation prompt.
    apply_default: Whether to apply this transformation by default: true or false (Default: false).
    model_id: Model ID to use by default for this transformation (e.g. "model:abcd1234"). Optional.
    """
    params = CreateTransformationParam(name=name, title=title, description=description, prompt=prompt, apply_default=apply_default, model_id=model_id)
    return await get_client().create_transformation(
        params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"basic", "opennotebook"}, annotations=ToolAnnotations(title="Get Transformation By Id", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def get_transformation_by_id(
    id: str,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Get a single transformation by ID.

Args:
    id: The unique ID of the transformation (e.g. "transformation:abcd1234"). Get the transformation id from list_all_transformations.
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    return await get_client().get_transformation_by_id(
        id, get_user_token(), include_all_fields=include_all_fields
    )


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Update Transformation", readOnlyHint=False, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def update_transformation(
    id: str,
    name: Optional[str] = None,
    title: Optional[str] = None,
    description: Optional[str] = None,
    prompt: Optional[str] = None,
    apply_default: Optional[bool] = None,
    model_id: Optional[str] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Update an existing transformation.

Args:
    id: The unique ID of the transformation to update (e.g. "transformation:abcd1234"). Get the transformation id from list_all_transformations.
    name: New name for the transformation.
    title: New display title.
    description: New description.
    prompt: New transformation prompt.
    apply_default: Whether to apply by default: true or false.
    model_id: Model ID to use by default (e.g. "model:abcd1234"). Optional.
    """
    params = UpdateTransformationParam(name=name, title=title, description=description, prompt=prompt, apply_default=apply_default, model_id=model_id)
    return await get_client().update_transformation(
        id, params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"basic", "opennotebook"}, annotations=ToolAnnotations(title="Delete Transformation By Id", readOnlyHint=False, destructiveHint=True, idempotentHint=True, openWorldHint=False)
)
async def delete_transformation_by_id(
    id: str,
    ctx: Context = None,
) -> dict[str, Any]:
    """Delete a transformation by ID.

Args:
    id: The unique ID of the transformation to delete (e.g. "transformation:abcd1234"). Get the transformation id from list_all_transformations.
    """
    await get_client().delete_transformation_by_id(id, get_user_token())
    return {"deleted": True, "id": id}


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Execute Transformation", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def execute_transformation(
    transformation_id: str,
    input_text: str,
    model_id: Optional[str] = None,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Execute a transformation on input text.

Args:
    transformation_id: ID of the transformation to execute (e.g. "transformation:abcd1234"). Get the transformation id from list_all_transformations.
    input_text: Text to transform (e.g. "The quick brown fox jumps over the lazy dog.").
    model_id: Model ID to use for this transformation run (e.g. "model:abcd1234"). Optional.
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    params = ExecuteTransformationParam(transformation_id=transformation_id, input_text=input_text, model_id=model_id)
    return await get_client().execute_transformation(
        params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=include_all_fields
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Get Default Transformation Prompt", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def get_default_transformation_prompt(
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Get the default transformation prompt.

    Args:
        include_all_fields: Default False (common fields only). Set True for all fields.
    """
    return await get_client().get_default_transformation_prompt(
        get_user_token(), include_all_fields=include_all_fields
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Update Default Transformation Prompt", readOnlyHint=False, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def update_default_transformation_prompt(
    transformation_instructions: str,
    ctx: Context = None,
) -> dict[str, Any]:
    """Update the default transformation prompt instructions.

Args:
    transformation_instructions: Default transformation instructions (e.g. "Summarize the key points in bullet form.").
    """
    params = DefaultPromptUpdateParam(transformation_instructions=transformation_instructions)
    return await get_client().update_default_transformation_prompt(
        params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


# =============================================================================
# Embedding Tools
# =============================================================================


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Embed Content", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def embed_content(
    item_id: str,
    item_type: str,
    async_processing: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Embed content for vector search.

Args:
    item_id: ID of the item to embed (e.g. "source:abcd1234").
    item_type: Type of item: source or note.
    async_processing: Process asynchronously in background: true or false (Default: false).
    """
    params = EmbedContentParam(item_id=item_id, item_type=item_type, async_processing=async_processing)
    return await get_client().embed_content(
        params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Start Embedding Rebuild", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def start_embedding_rebuild(
    mode: str = "existing",
    include_sources: bool = True,
    include_notes: bool = True,
    include_insights: bool = True,
    ctx: Context = None,
) -> dict[str, Any]:
    """Start a background job to rebuild embeddings.

Args:
    mode: Rebuild mode: existing (re-embeds items with embeddings) or all (embeds everything) (Default: existing).
    include_sources: Include sources in rebuild: true or false (Default: true).
    include_notes: Include notes in rebuild: true or false (Default: true).
    include_insights: Include insights in rebuild: true or false (Default: true).
    """
    params = StartEmbeddingRebuildParam(mode=mode, include_sources=include_sources, include_notes=include_notes, include_insights=include_insights)
    return await get_client().start_embedding_rebuild(
        params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Get Rebuild Status", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def get_rebuild_status(
    command_id: str,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Get the status of a rebuild operation.

Args:
    command_id: Command ID to track progress (e.g. "command:abcd1234"). Returned by start_embedding_rebuild.
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    return await get_client().get_rebuild_status(
        command_id, get_user_token(), include_all_fields=include_all_fields
    )


# =============================================================================
# Settings Tools
# =============================================================================


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Get Settings", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def get_settings(
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Get all application settings.

    Args:
        include_all_fields: Default False (common fields only). Set True for all fields.
    """
    return await get_client().get_settings(
        get_user_token(), include_all_fields=include_all_fields
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Update Settings", readOnlyHint=False, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def update_settings(
    default_content_processing_engine_doc: Optional[str] = None,
    default_content_processing_engine_url: Optional[str] = None,
    default_embedding_option: Optional[str] = None,
    auto_delete_files: Optional[str] = None,
    docling_ocr: Optional[bool] = None,
    docling_formulas: Optional[bool] = None,
    docling_vision: Optional[bool] = None,
    youtube_preferred_languages: Optional[list[str]] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Update application settings (partial update).

Args:
    default_content_processing_engine_doc: Default engine for doc processing: auto, docling, or simple.
    default_content_processing_engine_url: Default engine for URL processing: auto, firecrawl, jina, crawl4ai, or simple.
    default_embedding_option: Default embedding option: ask, always, or never.
    auto_delete_files: Auto-delete files after processing: yes or no.
    docling_ocr: Enable Docling OCR: true or false.
    docling_formulas: Enable Docling formulas: true or false.
    docling_vision: Enable Docling vision: true or false.
    youtube_preferred_languages: Preferred YouTube languages as ISO 639-1 codes (e.g. ["en", "es"]).
    """
    params = UpdateSettingsParam(default_content_processing_engine_doc=default_content_processing_engine_doc, default_content_processing_engine_url=default_content_processing_engine_url, default_embedding_option=default_embedding_option, auto_delete_files=auto_delete_files, docling_ocr=docling_ocr, docling_formulas=docling_formulas, docling_vision=docling_vision, youtube_preferred_languages=youtube_preferred_languages)
    return await get_client().update_settings(
        params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


# =============================================================================
# Chat Session Tools
# =============================================================================


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="List Chat Sessions", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def list_chat_sessions(
    notebook_id: str,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """List all chat sessions for a notebook.

Args:
    notebook_id: The unique ID of the notebook (e.g. "notebook:rcxuqr34bn7y30unh8pw"). Get the notebook id from list_all_notebooks.
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    data = await get_client().list_chat_sessions(
        notebook_id, get_user_token(),
        include_all_fields=include_all_fields if ALLOW_ALL_AGGREGATE else False
    )
    return {"items": json_to_toon(data)}


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Create Chat Session", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def create_chat_session(
    notebook_id: str,
    title: Optional[str] = None,
    model_override: Optional[str] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Create a new chat session for a notebook.

Args:
    notebook_id: Notebook ID to create the session for (e.g. "notebook:rcxuqr34bn7y30unh8pw").
    title: Optional session title.
    model_override: Model override for this session (e.g. "model:abcd1234"). Optional.
    """
    params = CreateChatSessionParam(notebook_id=notebook_id, title=title, model_override=model_override)
    return await get_client().create_chat_session(
        params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Get Chat Session", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def get_chat_session(
    id: str,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Get a specific chat session with its messages.

Args:
    id: The unique ID of the chat session (e.g. "chat_session:abcd1234"). Get the chat session id from list_chat_sessions.
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    return await get_client().get_chat_session(
        id, get_user_token(), include_all_fields=include_all_fields
    )


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Update Chat Session", readOnlyHint=False, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def update_chat_session(
    id: str,
    title: Optional[str] = None,
    model_override: Optional[str] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Update a chat session's title or model override.

Args:
    id: The unique ID of the chat session to update (e.g. "chat_session:abcd1234"). Get the chat session id from list_chat_sessions.
    title: New title for the session.
    model_override: Model override for this session (e.g. "model:abcd1234"). Optional.
    """
    params = UpdateChatSessionParam(title=title, model_override=model_override)
    return await get_client().update_chat_session(
        id, params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"primary", "opennotebook"}, annotations=ToolAnnotations(title="Delete Chat Session", readOnlyHint=False, destructiveHint=True, idempotentHint=True, openWorldHint=False)
)
async def delete_chat_session(
    id: str,
    ctx: Context = None,
) -> dict[str, Any]:
    """Delete a chat session by ID.

Args:
    id: The unique ID of the chat session to delete (e.g. "chat_session:abcd1234"). Get the chat session id from list_chat_sessions.
    """
    await get_client().delete_chat_session(id, get_user_token())
    return {"deleted": True, "id": id}


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Execute Chat", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def execute_chat(
    session_id: str,
    message: str,
    context: ChatContext,
    model_override: Optional[str] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Execute a chat request and get AI response.

    Args:
        session_id: Chat session ID (e.g. "chat_session:abcd1234"). Get the chat session id from list_chat_sessions.
        message: User message content (e.g. "Summarize the attached sources.").
        context: Chat context with sources and notes. Pass the output of build_chat_context.
        model_override: Optional model override for this message (e.g. "model:abcd1234").
    """
    params = ExecuteChatParam(session_id=session_id, message=message, context=context, model_override=model_override)
    return await get_client().execute_chat(
        params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Build Chat Context", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def build_chat_context(
    notebook_id: str,
    context_config: ContextConfigItem,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Build context for a notebook based on context configuration.

    Args:
        notebook_id: Notebook ID (e.g. "notebook:rcxuqr34bn7y30unh8pw"). Get the notebook id from list_all_notebooks.
        context_config: Context configuration. Empty {} includes everything with short context. Keys: sources and notes, each mapping an item ID to an inclusion status (not in, insights, or full content).
        include_all_fields: Default False (common fields only). Set True for all fields.
    """
    params = BuildChatContextParam(notebook_id=notebook_id, context_config=context_config)
    return await get_client().build_chat_context(
        params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=include_all_fields
    )


# =============================================================================
# Source Chat Session Tools
# =============================================================================


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Create Source Chat Session", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def create_source_chat_session(
    source_id: str,
    title: Optional[str] = None,
    model_override: Optional[str] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Create a new chat session for a source.

Args:
    source_id: Source ID to create the chat session for (e.g. "source:abcd1234"). Get the source id from list_all_sources.
    title: Optional session title.
    model_override: Model override for this session (e.g. "model:abcd1234"). Optional.
    """
    params = CreateSourceChatSessionParam(source_id=source_id, title=title, model_override=model_override)
    return await get_client().create_source_chat_session(
        source_id, params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="List Source Chat Sessions", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def list_source_chat_sessions(
    source_id: str,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """List all chat sessions for a source.

Args:
    source_id: Source ID (e.g. "source:abcd1234"). Get the source id from list_all_sources.
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    data = await get_client().list_source_chat_sessions(
        source_id, get_user_token(),
        include_all_fields=include_all_fields if ALLOW_ALL_AGGREGATE else False
    )
    return {"items": json_to_toon(data)}


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Get Source Chat Session", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def get_source_chat_session(
    source_id: str,
    session_id: str,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Get a specific source chat session with its messages.

Args:
    source_id: Source ID (e.g. "source:abcd1234"). Get the source id from list_all_sources.
    session_id: Session ID (e.g. "chat_session:abcd1234"). Get the session id from list_source_chat_sessions.
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    return await get_client().get_source_chat_session(
        source_id, session_id, get_user_token(), include_all_fields=include_all_fields
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Update Source Chat Session", readOnlyHint=False, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def update_source_chat_session(
    source_id: str,
    session_id: str,
    title: Optional[str] = None,
    model_override: Optional[str] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Update a source chat session's title or model override.

Args:
    source_id: Source ID (e.g. "source:abcd1234"). Get the source id from list_all_sources.
    session_id: Session ID (e.g. "chat_session:abcd1234"). Get the session id from list_source_chat_sessions.
    title: New title for the session.
    model_override: Model override for this session (e.g. "model:abcd1234"). Optional.
    """
    params = UpdateSourceChatSessionParam(title=title, model_override=model_override)
    return await get_client().update_source_chat_session(
        source_id, session_id, params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Delete Source Chat Session", readOnlyHint=False, destructiveHint=True, idempotentHint=True, openWorldHint=False)
)
async def delete_source_chat_session(
    source_id: str,
    session_id: str,
    ctx: Context = None,
) -> dict[str, Any]:
    """Delete a source chat session.

Args:
    source_id: Source ID (e.g. "source:abcd1234"). Get the source id from list_all_sources.
    session_id: Session ID to delete (e.g. "chat_session:abcd1234"). Get the session id from list_source_chat_sessions.
    """
    await get_client().delete_source_chat_session(source_id, session_id, get_user_token())
    return {"deleted": True, "id": session_id}


# =============================================================================
# Podcast Tools
# =============================================================================


async def _resolve_profile_name(
    client: OpenNotebookClient, kind: str, value: str, ctx: Context
) -> str:
    """Return the profile *name* for episode/speaker profile references.

    The OpenNotebook `/api/podcasts/generate` endpoint resolves episode
    profiles by name only (see EpisodeProfile.get_by_name). Agents often
    pass the record ID (e.g. "episode_profile:abcd1234") returned by the
    list_*_profiles tools instead of the name, which makes the backend
    return a 500. This helper detects a record ID and resolves it to its
    name via the list endpoints so either form works. Already-named values
    are returned unchanged.
    """
    if kind == "episode_profile":
        prefix, items = "episode_profile:", await client.list_episode_profiles(
            get_user_token(), include_all_fields=True
        )
    else:
        prefix, items = "speaker_profile:", await client.list_speaker_profiles(
            get_user_token(), include_all_fields=True
        )

    if not value.startswith(prefix):
        return value

    items = items if isinstance(items, list) else []
    for item in items:
        if isinstance(item, dict) and str(item.get("id")) == value:
            name = item.get("name")
            if name:
                return str(name)
    raise ValueError(
        f"{kind} '{value}' not found - pass a valid profile name or record ID "
        "(see list_episode_profiles / list_speaker_profiles)."
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Generate Podcast", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def generate_podcast(
    episode_profile: str,
    speaker_profile: str,
    episode_name: str,
    content: Optional[str] = None,
    notebook_id: Optional[str] = None,
    briefing_suffix: Optional[str] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Generate a podcast episode using Episode and Speaker Profiles.

Provide either content or notebook_id (content is pulled from the notebook when notebook_id is given).

Args:
    episode_profile: Episode profile NAME (e.g. "tech_experts"). A record ID (e.g. "episode_profile:abcd1234") is also accepted and resolved automatically to its name. list_episode_profiles returns both id and name.
    speaker_profile: Speaker profile NAME (e.g. "tech_experts"). A record ID (e.g. "speaker_profile:abcd1234") is also accepted and resolved automatically to its name. list_speaker_profiles returns both id and name.
    episode_name: Name for the episode (e.g. "Episode 1: AI in 2026").
    content: Content to discuss in the podcast. Required if notebook_id is not provided.
    notebook_id: Notebook ID to pull content from (e.g. "notebook:rcxuqr34bn7y30unh8pw"). Required if content is not provided.
    briefing_suffix: Optional briefing suffix appended to the episode briefing.
    """
    client = get_client()
    token = get_user_token()
    episode_profile = await _resolve_profile_name(client, "episode_profile", episode_profile, ctx)
    speaker_profile = await _resolve_profile_name(client, "speaker_profile", speaker_profile, ctx)
    params = GeneratePodcastParam(episode_profile=episode_profile, speaker_profile=speaker_profile, episode_name=episode_name, content=content, notebook_id=notebook_id, briefing_suffix=briefing_suffix)
    return await client.generate_podcast(
        params.model_dump(exclude_unset=True, exclude_none=True), token,
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Get Podcast Job Status", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def get_podcast_job_status(
    job_id: str,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Get the status of a podcast generation job.

Args:
    job_id: Job ID returned from generate_podcast (e.g. "command:abcd1234").
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    return await get_client().get_podcast_job_status(
        job_id, get_user_token(), include_all_fields=include_all_fields
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="List Podcast Episodes", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def list_podcast_episodes(
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """List all podcast episodes.

    Args:
        include_all_fields: Default False (common fields only). Set True for all fields.
    """
    data = await get_client().list_podcast_episodes(
        get_user_token(),
        include_all_fields=include_all_fields if ALLOW_ALL_AGGREGATE else False
    )
    return {"items": json_to_toon(data)}


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Get Podcast Episode", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def get_podcast_episode(
    id: str,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Get a specific podcast episode.

Args:
    id: The unique ID of the podcast episode (e.g. "podcast_episode:abcd1234"). Get the id from list_podcast_episodes.
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    return await get_client().get_podcast_episode(
        id, get_user_token(), include_all_fields=include_all_fields
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Retry Podcast Episode", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def retry_podcast_episode(
    id: str,
    ctx: Context = None,
) -> dict[str, Any]:
    """Retry a failed podcast episode.

Args:
    id: The unique ID of the podcast episode to retry (e.g. "podcast_episode:abcd1234"). Get the id from list_podcast_episodes.
    """
    return await get_client().retry_podcast_episode(id, get_user_token(), include_all_fields=ALLOW_ALL_AGGREGATE)


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Delete Podcast Episode", readOnlyHint=False, destructiveHint=True, idempotentHint=True, openWorldHint=False)
)
async def delete_podcast_episode(
    id: str,
    ctx: Context = None,
) -> dict[str, Any]:
    """Delete a podcast episode.

Args:
    id: The unique ID of the podcast episode to delete (e.g. "podcast_episode:abcd1234"). Get the id from list_podcast_episodes.
    """
    await get_client().delete_podcast_episode(id, get_user_token())
    return {"deleted": True, "id": id}


# =============================================================================
# Episode Profile Tools
# =============================================================================


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="List Episode Profiles", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def list_episode_profiles(
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """List all episode profiles.

    Args:
        include_all_fields: Default False (common fields only). Set True for all fields.
    """
    data = await get_client().list_episode_profiles(
        get_user_token(),
        include_all_fields=include_all_fields if ALLOW_ALL_AGGREGATE else False
    )
    return {"items": json_to_toon(data)}


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Get Episode Profile", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def get_episode_profile(
    name: str,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Get a specific episode profile by name.

Args:
    name: The name of the episode profile (e.g. "tech_experts"). Get the id from list_episode_profiles.
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    return await get_client().get_episode_profile(
        name, get_user_token(), include_all_fields=include_all_fields
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Create Episode Profile", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def create_episode_profile(
    name: str,
    speaker_config: str,
    default_briefing: str,
    description: str = "",
    outline_llm: Optional[str] = None,
    transcript_llm: Optional[str] = None,
    language: Optional[str] = None,
    num_segments: int = 5,
    max_tokens: Optional[int] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Create a new episode profile.

Args:
    name: Unique profile name (e.g. "tech_experts").
    speaker_config: Speaker profile record ID (e.g. "speaker_profile:abcd1234").
    default_briefing: Default briefing template (e.g. "Discuss the latest AI research.").
    description: Profile description.
    outline_llm: Model record ID for outline generation (e.g. "model:abcd1234"). Optional.
    transcript_llm: Model record ID for transcript generation (e.g. "model:abcd1234"). Optional.
    language: Podcast language code (e.g. "en-US"). Optional.
    num_segments: Number of podcast segments (1-20) (Default: 5).
    max_tokens: Max output tokens for outline/transcript generation (e.g. 4096). Optional.
    """
    params = CreateEpisodeProfileParam(name=name, speaker_config=speaker_config, default_briefing=default_briefing, description=description, outline_llm=outline_llm, transcript_llm=transcript_llm, language=language, num_segments=num_segments, max_tokens=max_tokens)
    return await get_client().create_episode_profile(
        params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Update Episode Profile", readOnlyHint=False, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def update_episode_profile(
    id: str,
    name: Optional[str] = None,
    speaker_config: Optional[str] = None,
    default_briefing: Optional[str] = None,
    description: Optional[str] = None,
    outline_llm: Optional[str] = None,
    transcript_llm: Optional[str] = None,
    language: Optional[str] = None,
    num_segments: Optional[int] = None,
    max_tokens: Optional[int] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Update an existing episode profile.

Args:
    id: The unique ID of the episode profile to update (e.g. "episode_profile:abcd1234"). Get the id from list_episode_profiles.
    name: New profile name (e.g. "tech_experts").
    speaker_config: New speaker profile record ID (e.g. "speaker_profile:abcd1234").
    default_briefing: New default briefing.
    description: New description.
    outline_llm: New outline model ID (e.g. "model:abcd1234"). Optional.
    transcript_llm: New transcript model ID (e.g. "model:abcd1234"). Optional.
    language: New language code (e.g. "en-US").
    num_segments: New number of segments (1-20).
    max_tokens: New max tokens (e.g. 4096).
    """
    params = CreateEpisodeProfileParam(name=name or "", speaker_config=speaker_config or "", default_briefing=default_briefing or "", description=description or "", outline_llm=outline_llm, transcript_llm=transcript_llm, language=language, num_segments=num_segments or 5, max_tokens=max_tokens)
    return await get_client().update_episode_profile(
        id, params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Delete Episode Profile", readOnlyHint=False, destructiveHint=True, idempotentHint=True, openWorldHint=False)
)
async def delete_episode_profile(
    id: str,
    ctx: Context = None,
) -> dict[str, Any]:
    """Delete an episode profile by ID.

Args:
    id: The unique ID of the episode profile to delete (e.g. "episode_profile:abcd1234"). Get the id from list_episode_profiles.
    """
    await get_client().delete_episode_profile(id, get_user_token())
    return {"deleted": True, "id": id}


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Duplicate Episode Profile", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def duplicate_episode_profile(
    id: str,
    ctx: Context = None,
) -> dict[str, Any]:
    """Duplicate an episode profile.

Args:
    id: The unique ID of the episode profile to duplicate (e.g. "episode_profile:abcd1234"). Get the id from list_episode_profiles.
    """
    return await get_client().duplicate_episode_profile(id, get_user_token(), include_all_fields=ALLOW_ALL_AGGREGATE)


# =============================================================================
# Speaker Profile Tools
# =============================================================================


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="List Speaker Profiles", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def list_speaker_profiles(
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """List all speaker profiles.

    Args:
        include_all_fields: Default False (common fields only). Set True for all fields.
    """
    data = await get_client().list_speaker_profiles(
        get_user_token(),
        include_all_fields=include_all_fields if ALLOW_ALL_AGGREGATE else False
    )
    return {"items": json_to_toon(data)}


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Get Speaker Profile", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def get_speaker_profile(
    name: str,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Get a specific speaker profile by name.

Args:
    name: The name of the speaker profile (e.g. "tech_experts"). Get the id from list_speaker_profiles.
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    return await get_client().get_speaker_profile(
        name, get_user_token(), include_all_fields=include_all_fields
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Create Speaker Profile", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def create_speaker_profile(
    name: str,
    speakers: list[SpeakerConfig],
    description: str = "",
    voice_model: Optional[str] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Create a new speaker profile.

Args:
    name: Unique profile name (e.g. "tech_experts").
    speakers: Array of speaker configurations, each with name, voice_id, backstory, and personality (e.g. [{"name": "Alice", "voice_id": "en-US-1", "backstory": "AI researcher for 10 years", "personality": "Engaging"}]).
    description: Profile description.
    voice_model: Model record ID for TTS (e.g. "model:abcd1234"). Optional.
    """
    params = CreateSpeakerProfileParam(name=name, speakers=speakers, description=description, voice_model=voice_model)
    return await get_client().create_speaker_profile(
        params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Update Speaker Profile", readOnlyHint=False, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def update_speaker_profile(
    id: str,
    name: Optional[str] = None,
    speakers: Optional[list[SpeakerConfig]] = None,
    description: Optional[str] = None,
    voice_model: Optional[str] = None,
    ctx: Context = None,
) -> dict[str, Any]:
    """Update an existing speaker profile.

Args:
    id: The unique ID of the speaker profile to update (e.g. "speaker_profile:abcd1234"). Get the id from list_speaker_profiles.
    name: New profile name (e.g. "tech_experts").
    speakers: New array of speaker configurations (each with name, voice_id, backstory, personality).
    description: New description.
    voice_model: New TTS model record ID (e.g. "model:abcd1234"). Optional.
    """
    params = CreateSpeakerProfileParam(name=name or "", speakers=speakers or [], description=description or "", voice_model=voice_model)
    return await get_client().update_speaker_profile(
        id, params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Delete Speaker Profile", readOnlyHint=False, destructiveHint=True, idempotentHint=True, openWorldHint=False)
)
async def delete_speaker_profile(
    id: str,
    ctx: Context = None,
) -> dict[str, Any]:
    """Delete a speaker profile by ID.

Args:
    id: The unique ID of the speaker profile to delete (e.g. "speaker_profile:abcd1234"). Get the id from list_speaker_profiles.
    """
    await get_client().delete_speaker_profile(id, get_user_token())
    return {"deleted": True, "id": id}


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Duplicate Speaker Profile", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def duplicate_speaker_profile(
    id: str,
    ctx: Context = None,
) -> dict[str, Any]:
    """Duplicate a speaker profile.

Args:
    id: The unique ID of the speaker profile to duplicate (e.g. "speaker_profile:abcd1234"). Get the id from list_speaker_profiles.
    """
    return await get_client().duplicate_speaker_profile(id, get_user_token(), include_all_fields=ALLOW_ALL_AGGREGATE)


# =============================================================================
# Command Job Tools
# =============================================================================


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Submit Command Job", readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)
)
async def submit_command_job(
    command: str,
    app: str = "open_notebook",
    input: dict[str, Any] = {},
    ctx: Context = None,
) -> dict[str, Any]:
    """Submit a command for background processing.

Args:
    command: Command function name: generate_podcast or rebuild_embeddings (e.g. "rebuild_embeddings").
    app: Application name (Default: "open_notebook").
    input: Arguments to pass to the command as a dict. For generate_podcast, ALL of these keys are REQUIRED: {"episode_profile": "<NAME>", "speaker_profile": "<NAME>", "episode_name": "...", "content": "..."}. NOTE: unlike the generate_podcast tool, this raw-command path does NOT fetch content from a notebook_id and does NOT resolve profile names/IDs - profile values must be NAMES and content must be provided explicitly. For rebuild_embeddings: {"mode": "existing", "include_sources": true, "include_notes": true, "include_insights": true}.
    """
    if command == "generate_podcast":
        required = ["episode_profile", "speaker_profile", "episode_name", "content"]
        missing = [k for k in required if not input.get(k)]
        if missing:
            raise ValueError(
                "submit_command_job with command 'generate_podcast' requires all "
                f"of [{', '.join(required)}] in 'input'; missing: {', '.join(missing)}. "
                "Note: this raw-command path does NOT pull content from notebook_id "
                "and profile values must be NAMES (see the generate_podcast tool to "
                "use notebook_id / record IDs)."
            )
    params = SubmitCommandParam(command=command, app=app, input=input)
    return await get_client().submit_command_job(
        params.model_dump(exclude_unset=True, exclude_none=True), get_user_token(),
        include_all_fields=ALLOW_ALL_AGGREGATE
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Get Command Job Status", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def get_command_job_status(
    job_id: str,
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """Get the status of a specific command job.

Args:
    job_id: Job ID returned from submit_command_job (e.g. "command:abcd1234").
    include_all_fields: Default False (common fields only). Set True for all fields.
    """
    return await get_client().get_command_job_status(
        job_id, get_user_token(), include_all_fields=include_all_fields
    )


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="List Command Jobs", readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
)
async def list_command_jobs(
    include_all_fields: bool = False,
    ctx: Context = None,
) -> dict[str, Any]:
    """List command jobs with optional filtering.

    Args:
        include_all_fields: Default False (common fields only). Set True for all fields.
    """
    data = await get_client().list_command_jobs(
        get_user_token(),
        include_all_fields=include_all_fields if ALLOW_ALL_AGGREGATE else False
    )
    return {"items": json_to_toon(data)}


@mcp.tool(
    tags={"advanced", "opennotebook"}, annotations=ToolAnnotations(title="Cancel Command Job", readOnlyHint=False, destructiveHint=True, idempotentHint=True, openWorldHint=False)
)
async def cancel_command_job(
    job_id: str,
    ctx: Context = None,
) -> dict[str, Any]:
    """Cancel a running command job.

Args:
    job_id: Job ID to cancel (e.g. "command:abcd1234"). Returned by submit_command_job.
    """
    return await get_client().cancel_command_job(job_id, get_user_token(), include_all_fields=ALLOW_ALL_AGGREGATE)


# =============================================================================
# Entry Point
# =============================================================================


def main():
    if not os.getenv("OPENNOTEBOOK_BASE_URL"):
        print("ERROR: OPENNOTEBOOK_BASE_URL environment variable is required", file=sys.stderr)
        print("Example: export OPENNOTEBOOK_BASE_URL=http://opennotebook-app:5055", file=sys.stderr)
        sys.exit(1)

    port_env = os.getenv("MCP_SERVER_PORT")
    if not port_env:
        print("ERROR: MCP_SERVER_PORT environment variable is required", file=sys.stderr)
        print("Example: export MCP_SERVER_PORT=6596", file=sys.stderr)
        sys.exit(1)

    host = "0.0.0.0"
    port = int(port_env)
    path = "/mcp"
    if IS_STATEFUL:
        app = mcp.http_app(path=path)
    else:
        app = mcp.http_app(path=path, stateless_http=True)
    app = AuthMiddleware(app)
    print(f"Starting OpenNotebook MCP server on http://{host}:{port}{path}", file=sys.stderr)
    import uvicorn
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
