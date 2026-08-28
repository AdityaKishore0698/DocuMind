-- DocuMind schema — run once against the Supabase database.
--
-- Easiest: paste this into the Supabase dashboard -> SQL Editor -> Run.
-- Or:      psql "$DATABASE_URL" -f scripts/init_db.sql
--
-- Generated from the SQLAlchemy models (api/models/*.py); equivalent to
-- Base.metadata.create_all(). Safe to re-run.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR,
    email           VARCHAR,
    hashed_password VARCHAR
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username);
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email    ON users (email);
CREATE INDEX        IF NOT EXISTS ix_users_id       ON users (id);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER REFERENCES users (id),
    title      VARCHAR,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_chat_sessions_id ON chat_sessions (id);

CREATE TABLE IF NOT EXISTS chat_messages (
    id         SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES chat_sessions (id),
    role       VARCHAR,
    content    VARCHAR,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_chat_messages_id ON chat_messages (id);

CREATE TABLE IF NOT EXISTS documents (
    id       SERIAL PRIMARY KEY,
    user_id  INTEGER REFERENCES users (id),
    filename VARCHAR,
    status   VARCHAR
);
CREATE INDEX IF NOT EXISTS ix_documents_id       ON documents (id);
CREATE INDEX IF NOT EXISTS ix_documents_filename ON documents (filename);

CREATE TABLE IF NOT EXISTS document_chunks (
    id          SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents (id),
    content     VARCHAR,
    embedding   VECTOR(768)
);
CREATE INDEX IF NOT EXISTS ix_document_chunks_id ON document_chunks (id);

-- Recommended (not created by the app): approximate-NN index for cosine search.
-- Add it once the table has data.
-- CREATE INDEX IF NOT EXISTS ix_document_chunks_embedding
--     ON document_chunks USING hnsw (embedding vector_cosine_ops);
