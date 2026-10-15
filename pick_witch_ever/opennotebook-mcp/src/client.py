import datetime as dt
import os
import re
from typing import Any, Optional

import httpx

COMMON_FIELDS: dict[str, set[str]] = {
    "notebook": {"id", "name", "archived", "source_count", "note_count"},
    "note": {"id", "title", "note_type"},
    "source": {"id", "title", "type", "status", "insights_count"},
    "source_insight": {"id", "insight_type", "source_id"},
    "transformation": {"id", "name", "title", "apply_default"},
    "model": {"id", "name", "provider", "type"},
    "chat_session": {"id", "title", "message_count", "notebook_id"},
    "source_chat_session": {"id", "title", "message_count", "source_id"},
    "episode_profile": {"id", "name", "num_segments"},
    "speaker_profile": {"id", "name"},
    "podcast_episode": {"id", "name", "job_status"},
    "command_job": {"job_id", "status", "message"},
    "health": {"status"},
    "notebook_delete_preview": {
        "notebook_id",
        "notebook_name",
        "note_count",
        "exclusive_source_count",
        "shared_source_count",
    },
    "source_link": {"message"},
    "recently_viewed": {"type", "id", "title", "last_viewed_at"},
    "source_status": {"status", "message", "command_id"},
    "insight_creation": {
        "status",
        "message",
        "source_id",
        "transformation_id",
        "command_id",
    },
    "search": {"results", "total_count", "search_type"},
    "ask": {"answer", "question"},
    "default_models": {
        "default_chat_model",
        "default_transformation_model",
        "large_context_model",
        "default_text_to_speech_model",
        "default_speech_to_text_model",
        "default_embedding_model",
        "default_tools_model",
    },
    "default_prompt": {"transformation_instructions"},
    "embed": {"success", "message", "item_id", "item_type", "command_id"},
    "rebuild": {"command_id", "total_items", "message"},
    "rebuild_status": {"command_id", "status", "error_message", "started_at", "completed_at"},
    "settings": {
        "default_content_processing_engine_doc",
        "default_content_processing_engine_url",
        "default_embedding_option",
        "auto_delete_files",
        "docling_ocr",
        "docling_formulas",
        "docling_vision",
        "youtube_preferred_languages",
    },
    "chat_execute": {"session_id", "messages"},
    "chat_context": {"context", "token_count", "char_count"},
    "podcast_generation": {"job_id", "status", "message"},
    "podcast_job_status": {"job_id", "status", "error_message", "created", "updated"},
    "podcast_retry": {"job_id", "message"},
    "command_job_status": {"job_id", "status", "error_message", "created", "updated"},
}


def _filter_fields(data: Any, common_set: set[str]) -> Any:
    if isinstance(data, dict):
        return {k: v for k, v in data.items() if k in common_set}
    if isinstance(data, list):
        return [_filter_fields(item, common_set) for item in data]
    return data


def _normalize_datetime(value: str) -> str:
    if re.match(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$', value):
        parsed = dt.datetime.fromisoformat(value)
        parsed = parsed.astimezone(dt.timezone.utc)
        return parsed.strftime('%Y-%m-%d %H:%M:%S')
    if re.match(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}', value):
        raise ValueError(
            f"Invalid datetime: {value}. Timezone offset is required. "
            "Must use format: 2026-06-22T15:00:00-04:00"
        )
    return value


def _denormalize_datetime(value: str) -> str:
    if re.match(r'^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+\+00:00$', value):
        parsed = dt.datetime.strptime(value, '%Y-%m-%d %H:%M:%S.%f+00:00')
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.strftime('%Y-%m-%dT%H:%M:%S+00:00')
    if re.match(r'^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\+00:00$', value):
        parsed = dt.datetime.strptime(value, '%Y-%m-%d %H:%M:%S+00:00')
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.strftime('%Y-%m-%dT%H:%M:%S+00:00')
    if re.match(r'^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$', value):
        parsed = dt.datetime.strptime(value, '%Y-%m-%d %H:%M:%S')
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.strftime('%Y-%m-%dT%H:%M:%S+00:00')
    if re.match(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$', value):
        parsed = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
        return parsed.strftime('%Y-%m-%dT%H:%M:%S+00:00')
    return value


def _denormalize_response(data: Any) -> Any:
    if isinstance(data, dict):
        return {k: _denormalize_response(v) for k, v in data.items()}
    if isinstance(data, list):
        return [_denormalize_response(item) for item in data]
    if isinstance(data, str):
        return _denormalize_datetime(data)
    return data


class OpenNotebookClient:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or os.getenv("OPENNOTEBOOK_BASE_URL", "")).rstrip("/")
        if not self.base_url:
            raise ValueError(
                "OpenNotebook URL required. Set OPENNOTEBOOK_BASE_URL env var "
                "or pass base_url."
            )

    def _get_headers(self, api_key: Optional[str] = None) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        return headers

    def _normalize_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            k: _normalize_datetime(v) if isinstance(v, str) else v
            for k, v in payload.items()
        }

    async def request(
        self,
        method: str,
        path: str,
        api_key: Optional[str] = None,
        **kwargs: Any,
    ) -> Any:
        url = f"{self.base_url}{path}"
        headers = self._get_headers(api_key)
        extra_headers = kwargs.pop("extra_headers", {})
        headers.update(extra_headers)
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.request(method, url, headers=headers, **kwargs)
            if response.status_code >= 400:
                body = response.text[:500]
                raise httpx.HTTPStatusError(
                    f"{response.status_code} {response.reason_phrase} for {method} {path}: {body}",
                    request=response.request, response=response,
                )
            if response.status_code == 204:
                return {}
            if response.headers.get("content-type", "").startswith("application/json"):
                return response.json()
            return {"text": response.text}

    async def get(self, path: str, api_key: Optional[str] = None, **kwargs: Any) -> Any:
        return await self.request("GET", path, api_key, **kwargs)

    async def post(self, path: str, api_key: Optional[str] = None, **kwargs: Any) -> Any:
        return await self.request("POST", path, api_key, **kwargs)

    async def put(self, path: str, api_key: Optional[str] = None, **kwargs: Any) -> Any:
        return await self.request("PUT", path, api_key, **kwargs)

    async def delete(self, path: str, api_key: Optional[str] = None, **kwargs: Any) -> Any:
        return await self.request("DELETE", path, api_key, **kwargs)

    # =========================================================================
    # Health
    # =========================================================================

    async def check_server_status(
        self,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get("/health", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["health"])
        return _denormalize_response(data)

    # =========================================================================
    # Notebooks
    # =========================================================================

    async def list_all_notebooks(
        self,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get("/api/notebooks", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["notebook"])
        return _denormalize_response(data)

    async def create_notebook(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post("/api/notebooks", api_key, json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["notebook"])
        return _denormalize_response(data)

    async def get_notebook_by_id(
        self,
        notebook_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get(f"/api/notebooks/{notebook_id}", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["notebook"])
        return _denormalize_response(data)

    async def update_notebook(
        self,
        notebook_id: str,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.put(f"/api/notebooks/{notebook_id}", api_key, json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["notebook"])
        return _denormalize_response(data)

    async def delete_notebook_by_id(
        self,
        notebook_id: str,
        api_key: Optional[str] = None,
    ) -> Any:
        await self.delete(f"/api/notebooks/{notebook_id}", api_key)
        return {"deleted": True, "id": notebook_id}

    async def get_notebook_delete_preview(
        self,
        notebook_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get(f"/api/notebooks/{notebook_id}/delete-preview", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["notebook_delete_preview"])
        return _denormalize_response(data)

    async def add_source_to_notebook(
        self,
        notebook_id: str,
        source_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post(f"/api/notebooks/{notebook_id}/sources/{source_id}", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["source_link"])
        return _denormalize_response(data)

    async def remove_source_from_notebook(
        self,
        notebook_id: str,
        source_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.delete(f"/api/notebooks/{notebook_id}/sources/{source_id}", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["source_link"])
        return _denormalize_response(data)

    # =========================================================================
    # Recently Viewed
    # =========================================================================

    async def list_recently_viewed(
        self,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get("/api/recently-viewed", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["recently_viewed"])
        return _denormalize_response(data)

    # =========================================================================
    # Notes
    # =========================================================================

    async def list_all_notes(
        self,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
        notebook_id: Optional[str] = None,
    ) -> Any:
        params = {}
        if notebook_id:
            params["notebook_id"] = notebook_id
        data = await self.get("/api/notes", api_key, params=params)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["note"])
        return _denormalize_response(data)

    async def create_note(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post("/api/notes", api_key, json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["note"])
        return _denormalize_response(data)

    async def get_note_by_id(
        self,
        note_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get(f"/api/notes/{note_id}", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["note"])
        return _denormalize_response(data)

    async def update_note(
        self,
        note_id: str,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.put(f"/api/notes/{note_id}", api_key, json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["note"])
        return _denormalize_response(data)

    async def delete_note_by_id(
        self,
        note_id: str,
        api_key: Optional[str] = None,
    ) -> Any:
        await self.delete(f"/api/notes/{note_id}", api_key)
        return {"deleted": True, "id": note_id}

    # =========================================================================
    # Sources
    # =========================================================================

    async def list_all_sources(
        self,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
        notebook_id: Optional[str] = None,
    ) -> Any:
        params = {}
        if notebook_id:
            params["notebook_id"] = notebook_id
        data = await self.get("/api/sources", api_key, params=params)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["source"])
        return _denormalize_response(data)

    async def create_source(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post("/api/sources/json", api_key, json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["source"])
        return _denormalize_response(data)

    async def get_source_by_id(
        self,
        source_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get(f"/api/sources/{source_id}", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["source"])
        return _denormalize_response(data)

    async def update_source(
        self,
        source_id: str,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.put(f"/api/sources/{source_id}", api_key, json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["source"])
        return _denormalize_response(data)

    async def delete_source_by_id(
        self,
        source_id: str,
        api_key: Optional[str] = None,
    ) -> Any:
        await self.delete(f"/api/sources/{source_id}", api_key)
        return {"deleted": True, "id": source_id}

    async def get_source_status(
        self,
        source_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get(f"/api/sources/{source_id}/status", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["source_status"])
        return _denormalize_response(data)

    async def retry_source_processing(
        self,
        source_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post(f"/api/sources/{source_id}/retry", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["source"])
        return _denormalize_response(data)

    async def list_source_insights(
        self,
        source_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get(f"/api/sources/{source_id}/insights", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["source_insight"])
        return _denormalize_response(data)

    async def create_source_insight(
        self,
        source_id: str,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post(f"/api/sources/{source_id}/insights", api_key, json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["insight_creation"])
        return _denormalize_response(data)

    # =========================================================================
    # Insights
    # =========================================================================

    async def get_insight_by_id(
        self,
        insight_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get(f"/api/insights/{insight_id}", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["source_insight"])
        return _denormalize_response(data)

    async def delete_insight_by_id(
        self,
        insight_id: str,
        api_key: Optional[str] = None,
    ) -> Any:
        await self.delete(f"/api/insights/{insight_id}", api_key)
        return {"deleted": True, "id": insight_id}

    async def save_insight_as_note(
        self,
        insight_id: str,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post(f"/api/insights/{insight_id}/save-as-note", api_key,
                               json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["note"])
        return _denormalize_response(data)

    # =========================================================================
    # Search
    # =========================================================================

    async def search_knowledge_base(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post("/api/search", api_key, json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["search"])
        return _denormalize_response(data)

    async def ask_knowledge_base_simple(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post("/api/search/ask/simple", api_key, json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["ask"])
        return _denormalize_response(data)

    # =========================================================================
    # Models
    # =========================================================================

    async def list_all_models(
        self,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get("/api/models", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["model"])
        return _denormalize_response(data)

    async def create_model(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post("/api/models", api_key, json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["model"])
        return _denormalize_response(data)

    async def delete_model_by_id(
        self,
        model_id: str,
        api_key: Optional[str] = None,
    ) -> Any:
        await self.delete(f"/api/models/{model_id}", api_key)
        return {"deleted": True, "id": model_id}

    async def get_default_models(
        self,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get("/api/models/defaults", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["default_models"])
        return _denormalize_response(data)

    async def update_default_models(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.put("/api/models/defaults", api_key, json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["default_models"])
        return _denormalize_response(data)

    # =========================================================================
    # Transformations
    # =========================================================================

    async def list_all_transformations(
        self,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get("/api/transformations", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["transformation"])
        return _denormalize_response(data)

    async def create_transformation(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post("/api/transformations", api_key, json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["transformation"])
        return _denormalize_response(data)

    async def get_transformation_by_id(
        self,
        transformation_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get(f"/api/transformations/{transformation_id}", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["transformation"])
        return _denormalize_response(data)

    async def update_transformation(
        self,
        transformation_id: str,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.put(f"/api/transformations/{transformation_id}", api_key,
                              json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["transformation"])
        return _denormalize_response(data)

    async def delete_transformation_by_id(
        self,
        transformation_id: str,
        api_key: Optional[str] = None,
    ) -> Any:
        await self.delete(f"/api/transformations/{transformation_id}", api_key)
        return {"deleted": True, "id": transformation_id}

    async def execute_transformation(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post("/api/transformations/execute", api_key,
                               json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["transformation"])
        return _denormalize_response(data)

    async def get_default_transformation_prompt(
        self,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get("/api/transformations/default-prompt", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["default_prompt"])
        return _denormalize_response(data)

    async def update_default_transformation_prompt(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.put("/api/transformations/default-prompt", api_key,
                              json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["default_prompt"])
        return _denormalize_response(data)

    # =========================================================================
    # Embedding
    # =========================================================================

    async def embed_content(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post("/api/embed", api_key, json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["embed"])
        return _denormalize_response(data)

    async def start_embedding_rebuild(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post("/api/embeddings/rebuild", api_key,
                               json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["rebuild"])
        return _denormalize_response(data)

    async def get_rebuild_status(
        self,
        command_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get(f"/api/embeddings/rebuild/{command_id}/status", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["rebuild_status"])
        return _denormalize_response(data)

    # =========================================================================
    # Settings
    # =========================================================================

    async def get_settings(
        self,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get("/api/settings", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["settings"])
        return _denormalize_response(data)

    async def update_settings(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.put("/api/settings", api_key, json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["settings"])
        return _denormalize_response(data)

    # =========================================================================
    # Chat Sessions
    # =========================================================================

    async def list_chat_sessions(
        self,
        notebook_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get("/api/chat/sessions", api_key, params={"notebook_id": notebook_id})
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["chat_session"])
        return _denormalize_response(data)

    async def create_chat_session(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post("/api/chat/sessions", api_key, json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["chat_session"])
        return _denormalize_response(data)

    async def get_chat_session(
        self,
        session_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get(f"/api/chat/sessions/{session_id}", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["chat_session"])
        return _denormalize_response(data)

    async def update_chat_session(
        self,
        session_id: str,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.put(f"/api/chat/sessions/{session_id}", api_key,
                              json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["chat_session"])
        return _denormalize_response(data)

    async def delete_chat_session(
        self,
        session_id: str,
        api_key: Optional[str] = None,
    ) -> Any:
        await self.delete(f"/api/chat/sessions/{session_id}", api_key)
        return {"deleted": True, "id": session_id}

    async def execute_chat(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post("/api/chat/execute", api_key,
                               json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["chat_execute"])
        return _denormalize_response(data)

    async def build_chat_context(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post("/api/chat/context", api_key,
                               json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["chat_context"])
        return _denormalize_response(data)

    # =========================================================================
    # Source Chat Sessions
    # =========================================================================

    async def create_source_chat_session(
        self,
        source_id: str,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post(f"/api/sources/{source_id}/chat/sessions", api_key,
                               json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["source_chat_session"])
        return _denormalize_response(data)

    async def list_source_chat_sessions(
        self,
        source_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get(f"/api/sources/{source_id}/chat/sessions", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["source_chat_session"])
        return _denormalize_response(data)

    async def get_source_chat_session(
        self,
        source_id: str,
        session_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get(f"/api/sources/{source_id}/chat/sessions/{session_id}", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["source_chat_session"])
        return _denormalize_response(data)

    async def update_source_chat_session(
        self,
        source_id: str,
        session_id: str,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.put(f"/api/sources/{source_id}/chat/sessions/{session_id}", api_key,
                              json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["source_chat_session"])
        return _denormalize_response(data)

    async def delete_source_chat_session(
        self,
        source_id: str,
        session_id: str,
        api_key: Optional[str] = None,
    ) -> Any:
        await self.delete(f"/api/sources/{source_id}/chat/sessions/{session_id}", api_key)
        return {"deleted": True, "id": session_id}

    # =========================================================================
    # Podcasts
    # =========================================================================

    async def generate_podcast(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post("/api/podcasts/generate", api_key,
                               json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["podcast_generation"])
        return _denormalize_response(data)

    async def get_podcast_job_status(
        self,
        job_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get(f"/api/podcasts/jobs/{job_id}", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["podcast_job_status"])
        return _denormalize_response(data)

    async def list_podcast_episodes(
        self,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get("/api/podcasts/episodes", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["podcast_episode"])
        return _denormalize_response(data)

    async def get_podcast_episode(
        self,
        episode_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get(f"/api/podcasts/episodes/{episode_id}", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["podcast_episode"])
        return _denormalize_response(data)

    async def retry_podcast_episode(
        self,
        episode_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post(f"/api/podcasts/episodes/{episode_id}/retry", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["podcast_retry"])
        return _denormalize_response(data)

    async def delete_podcast_episode(
        self,
        episode_id: str,
        api_key: Optional[str] = None,
    ) -> Any:
        await self.delete(f"/api/podcasts/episodes/{episode_id}", api_key)
        return {"deleted": True, "id": episode_id}

    # =========================================================================
    # Episode Profiles
    # =========================================================================

    async def list_episode_profiles(
        self,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get("/api/episode-profiles", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["episode_profile"])
        return _denormalize_response(data)

    async def get_episode_profile(
        self,
        profile_name: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get(f"/api/episode-profiles/{profile_name}", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["episode_profile"])
        return _denormalize_response(data)

    async def create_episode_profile(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post("/api/episode-profiles", api_key,
                               json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["episode_profile"])
        return _denormalize_response(data)

    async def update_episode_profile(
        self,
        profile_id: str,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.put(f"/api/episode-profiles/{profile_id}", api_key,
                              json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["episode_profile"])
        return _denormalize_response(data)

    async def delete_episode_profile(
        self,
        profile_id: str,
        api_key: Optional[str] = None,
    ) -> Any:
        await self.delete(f"/api/episode-profiles/{profile_id}", api_key)
        return {"deleted": True, "id": profile_id}

    async def duplicate_episode_profile(
        self,
        profile_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post(f"/api/episode-profiles/{profile_id}/duplicate", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["episode_profile"])
        return _denormalize_response(data)

    # =========================================================================
    # Speaker Profiles
    # =========================================================================

    async def list_speaker_profiles(
        self,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get("/api/speaker-profiles", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["speaker_profile"])
        return _denormalize_response(data)

    async def get_speaker_profile(
        self,
        profile_name: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get(f"/api/speaker-profiles/{profile_name}", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["speaker_profile"])
        return _denormalize_response(data)

    async def create_speaker_profile(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post("/api/speaker-profiles", api_key,
                               json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["speaker_profile"])
        return _denormalize_response(data)

    async def update_speaker_profile(
        self,
        profile_id: str,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.put(f"/api/speaker-profiles/{profile_id}", api_key,
                              json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["speaker_profile"])
        return _denormalize_response(data)

    async def delete_speaker_profile(
        self,
        profile_id: str,
        api_key: Optional[str] = None,
    ) -> Any:
        await self.delete(f"/api/speaker-profiles/{profile_id}", api_key)
        return {"deleted": True, "id": profile_id}

    async def duplicate_speaker_profile(
        self,
        profile_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post(f"/api/speaker-profiles/{profile_id}/duplicate", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["speaker_profile"])
        return _denormalize_response(data)

    # =========================================================================
    # Commands
    # =========================================================================

    async def submit_command_job(
        self,
        payload: dict[str, Any],
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.post("/api/commands/jobs", api_key,
                               json=self._normalize_payload(payload))
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["command_job"])
        return _denormalize_response(data)

    async def get_command_job_status(
        self,
        job_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get(f"/api/commands/jobs/{job_id}", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["command_job_status"])
        return _denormalize_response(data)

    async def list_command_jobs(
        self,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.get("/api/commands/jobs", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["command_job"])
        return _denormalize_response(data)

    async def cancel_command_job(
        self,
        job_id: str,
        api_key: Optional[str] = None,
        include_all_fields: bool = False,
    ) -> Any:
        data = await self.delete(f"/api/commands/jobs/{job_id}", api_key)
        if not include_all_fields:
            data = _filter_fields(data, COMMON_FIELDS["command_job"])
        return _denormalize_response(data)
