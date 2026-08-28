# DocuMind - Technical Handover Document

This document is designed to provide a complete understanding of the DocuMind Multimodal RAG Engine for AI agents or human developers taking over the project.

## 1. System Overview

**DocuMind** is a multi-tenant, Retrieval-Augmented Generation (RAG) platform. It allows users to securely upload documents (PDF/TXT), process them into vector embeddings, and engage in real-time streaming chats with an LLM that references their personal knowledge base.

### Core Architecture
The system uses a microservices architecture managed by `docker-compose`:
1. **Frontend (`frontend/`)**: A Next.js 16 (App Router) + TypeScript + Tailwind CSS single-page app — login/register, a left document-upload sidebar, and a right streaming chat panel. Talks to the API directly from the browser with a `Bearer` JWT kept in `localStorage`. (`ui/` holds the retired Streamlit prototype; it is no longer the primary UI.)
2. **Backend API (`api/`)**: A FastAPI application handling REST endpoints, JWT authentication, CORS for the frontend, RAG retrieval logic, and LLM orchestration.
3. **Task Queue (`worker/`)**: A Celery worker processing long-running tasks (like PDF text extraction, chunking, and embedding generation).
4. **Message Broker**: Redis (used by Celery).
5. **Database**: PostgreSQL with the `pgvector` extension for storing application state and high-dimensional vector embeddings.
6. **AI Provider**: The **Google Gemini API**, accessed via the `google-genai` Python SDK — `gemini-3.6-flash` for chat generation and `gemini-embedding-2` (768-dim) for embedding generation. All inference is a remote HTTPS call; no local model server or GPU is involved.

---

## 2. Deployment Topology

The backend services (API, Worker, Redis, DB, and the legacy Streamlit `ui`) run as Docker microservices defined in `docker-compose.yml` (dev) and `docker-compose.prod.yml` (prod). Inference is fully cloud-API — the containers only need outbound HTTPS to `generativelanguage.googleapis.com`. There is no GPU host, no lab server, and no SSH tunnel.

The `frontend/` Next.js app is **not** in the compose files yet — run it with `npm run dev` (or build and host it separately, e.g. Vercel or a Node container). It reaches the API via `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).

**Configuration:**
* `GEMINI_API_KEY` — required by both the `api` and `worker` containers.
* `CHAT_MODEL` (default `gemini-3.6-flash`) — used by the API.
* `EMBEDDING_MODEL` (default `gemini-embedding-2`) — used by both the API (query embedding) and the Worker (chunk embedding).
* `FRONTEND_ORIGINS` (default `http://localhost:3000,http://localhost:3001`) — comma-separated list of browser origins allowed by the API's CORS middleware, or `*` to allow any origin (credentials are disabled in that mode; the API authenticates via the `Authorization` header, not cookies). The `X-Session-ID` response header is added to `expose_headers` so the chat stream can read the new session id.
* Backend vars are supplied via `.env` and injected into the `api`/`worker` containers by `docker-compose`. Frontend vars live in `frontend/.env.local`.

> **Secrets:** `.env` is now git-ignored (previously committed). `.env.example` is the tracked template. Rotate any key that was committed.

---

## 3. Database Schema

The database relies on SQLAlchemy ORM. Multi-tenant security is enforced via strict `user_id` foreign keys and cascading deletes.

* **`users`**: `id`, `username`, `email`, `hashed_password`
* **`documents`**: `id`, `user_id` (FK), `filename`, `status` (processing, completed, failed)
* **`document_chunks`**: `id`, `document_id` (FK), `content` (text chunk), `embedding` (Vector(768) type using `pgvector`, matching Gemini `gemini-embedding-2` at `output_dimensionality=768`)
* **`chat_sessions`**: `id`, `user_id` (FK), `title`, `created_at`
* **`chat_messages`**: `id`, `session_id` (FK), `role` (user/assistant), `content`, `created_at`

*Note: Deleting a user automatically cascades and deletes all associated documents, document chunks, chat sessions, and messages.*

---

## 4. The RAG Pipelines

### A. Document Ingestion Pipeline (`/upload` -> Worker)
1. User uploads a PDF via Streamlit UI.
2. FastAPI (`/upload`) saves the raw file to a shared Docker volume (`/shared/`) and returns a 200 OK.
3. FastAPI enqueues a Celery task: `process_document`.
4. **Celery Worker**:
   * Reads the file from `/shared/`.
   * Extracts text using `PyPDF2`.
   * Splits text using LangChain's `RecursiveCharacterTextSplitter` (1000 char chunks, 100 char overlap).
   * Calls `client.models.embed_content` (`google-genai`) with `gemini-embedding-2` and `EmbedContentConfig(output_dimensionality=768)` to get a 768-dim vector for each chunk.
   * Saves the text chunk and vector embedding into the `document_chunks` table.
   * Updates document status to `completed`.

### B. Chat & Retrieval Pipeline (`/chat`)
1. User sends a query.
2. FastAPI (`/chat`) embeds the user's query with `client.models.embed_content` (`gemini-embedding-2`, 768-dim).
3. **Vector Search:** Performs a cosine similarity search (`cosine_distance`) via `pgvector` against the `document_chunks` table, filtered strictly by the current `user_id`, retrieving the top 5 chunks.
4. **Prompt Assembly:** The retrieved chunks go into the Gemini `system_instruction` (context); prior `chat_messages` are replayed as `types.Content` entries (roles mapped `assistant` → `model`), followed by the current query.
5. **LLM Generation:** Streams a response from the async client — `await client.aio.models.generate_content_stream(...)` — using `CHAT_MODEL` (default `gemini-3.6-flash`), iterated with `async for chunk in stream`.
6. **Streaming:** FastAPI streams each `chunk.text` as a chunked `StreamingResponse` body. The new session id is returned in the `X-Session-ID` response header. The Next.js chat component reads the body with the Streams API (`response.body.getReader()` + `TextDecoder`) and appends deltas live; its reader also tolerates formal SSE `data:` framing if the endpoint is upgraded later.
7. Once the stream completes, the final assistant message is saved to the database.

---

## 5. Security & Authentication

* **JWT (JSON Web Tokens):** All API endpoints require a Bearer token.
* **Bcrypt:** Passwords are never stored in plaintext.
* **Isolation:** Every database query involving documents or chats explicitly filters by `user_id == current_user.id` to prevent cross-tenant data leakage.
* **CORS:** `api/main.py` allows the origins in `FRONTEND_ORIGINS` (with credentials) and exposes `X-Session-ID`; `FRONTEND_ORIGINS=*` allows any origin with credentials disabled. Lock this down to the real frontend origin(s) in production.
* **Token storage:** the frontend keeps the JWT in `localStorage`. A 401 from any API call dispatches a `documind:unauthorized` browser event that clears it and returns the user to the login screen.

## 6. Deployment

There is no bundled CI/CD pipeline. Deploy by running the compose stack on any host (or container platform) with outbound HTTPS and the environment variables below:

```
docker compose -f docker-compose.prod.yml up -d --build
```

## 7. Developer Notes / Troubleshooting

* **API Key:** `GEMINI_API_KEY` must be set for **both** the `api` and `worker` containers. A missing or invalid key surfaces as a `google.genai` client error on the first request.
* **Model Selection:** `CHAT_MODEL` (default `gemini-3.6-flash`) and `EMBEDDING_MODEL` (default `gemini-embedding-2`) are overridable via environment variables.
* **Embedding Dimension:** `document_chunks.embedding` is `Vector(768)`, and the worker/API request `output_dimensionality=768` explicitly. If you change the embedding model or dimension, update `EMBEDDING_DIM` and `Vector(...)` in **both** `api/routers/chat.py` + `api/models/document.py` and `worker/tasks.py` + `worker/models.py`, then re-index existing rows.
* **Async chat:** the `/chat` handler uses the async Gemini client (`client.aio...`); the surrounding FastAPI route is `async def` and returns a `StreamingResponse` wrapping an async generator.
