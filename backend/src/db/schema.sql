-- Deployments table: stores deployment metadata
CREATE TABLE IF NOT EXISTS deployments (
    deploy_id TEXT PRIMARY KEY,
    subdomain TEXT UNIQUE NOT NULL,
    port INTEGER NOT NULL,
    image_name TEXT NOT NULL,
    container_id TEXT NOT NULL,
    repo TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Routes table: used by Caddy SQLite router
CREATE TABLE IF NOT EXISTS routes (
    domain TEXT PRIMARY KEY,
    host TEXT NOT NULL,
    port INTEGER NOT NULL
);

-- Index for faster port lookups
CREATE INDEX IF NOT EXISTS idx_deployments_port ON deployments(port);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
