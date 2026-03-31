import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path
const DB_PATH = process.env.DB_PATH || './data/plutoploy.db';

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
export const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema);

console.log(`✅ Database initialized at ${DB_PATH}`);

// Deployment operations
export const deploymentDb = {
    /**
     * Create a new deployment
     */
    create: (deployment: {
        deployId: string;
        subdomain: string;
        port: number;
        imageName: string;
        containerId: string;
        repo?: string;
    }) => {
        const now = new Date().toISOString();
        const stmt = db.prepare(`
            INSERT INTO deployments (deploy_id, subdomain, port, image_name, container_id, repo, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?)
        `);
        
        return stmt.run(
            deployment.deployId,
            deployment.subdomain,
            deployment.port,
            deployment.imageName,
            deployment.containerId,
            deployment.repo || null,
            now,
            now
        );
    },

    /**
     * Get deployment by ID
     */
    getById: (deployId: string) => {
        const stmt = db.prepare('SELECT * FROM deployments WHERE deploy_id = ?');
        return stmt.get(deployId);
    },

    /**
     * Get deployment by subdomain
     */
    getBySubdomain: (subdomain: string) => {
        const stmt = db.prepare('SELECT * FROM deployments WHERE subdomain = ?');
        return stmt.get(subdomain);
    },

    /**
     * Get all deployments
     */
    getAll: () => {
        const stmt = db.prepare('SELECT * FROM deployments ORDER BY created_at DESC');
        return stmt.all();
    },

    /**
     * Update deployment status
     */
    updateStatus: (deployId: string, status: string) => {
        const stmt = db.prepare(`
            UPDATE deployments 
            SET status = ?, updated_at = ? 
            WHERE deploy_id = ?
        `);
        return stmt.run(status, new Date().toISOString(), deployId);
    },

    /**
     * Delete deployment
     */
    delete: (deployId: string) => {
        const stmt = db.prepare('DELETE FROM deployments WHERE deploy_id = ?');
        return stmt.run(deployId);
    },

    /**
     * Get all used ports
     */
    getUsedPorts: (): number[] => {
        const stmt = db.prepare('SELECT port FROM deployments ORDER BY port');
        const rows = stmt.all() as { port: number }[];
        return rows.map(row => row.port);
    },

    /**
     * Check if subdomain exists
     */
    subdomainExists: (subdomain: string): boolean => {
        const stmt = db.prepare('SELECT 1 FROM deployments WHERE subdomain = ? LIMIT 1');
        return stmt.get(subdomain) !== undefined;
    }
};

// Caddy routes operations
export const routesDb = {
    /**
     * Add or update a route for Caddy
     */
    upsert: (domain: string, host: string, port: number) => {
        const stmt = db.prepare(`
            INSERT INTO routes (domain, host, port)
            VALUES (?, ?, ?)
            ON CONFLICT(domain) DO UPDATE SET
                host = excluded.host,
                port = excluded.port
        `);
        return stmt.run(domain, host, port);
    },

    /**
     * Get route by domain
     */
    getByDomain: (domain: string) => {
        const stmt = db.prepare('SELECT * FROM routes WHERE domain = ?');
        return stmt.get(domain);
    },

    /**
     * Get all routes
     */
    getAll: () => {
        const stmt = db.prepare('SELECT * FROM routes ORDER BY domain');
        return stmt.all();
    },

    /**
     * Delete route
     */
    delete: (domain: string) => {
        const stmt = db.prepare('DELETE FROM routes WHERE domain = ?');
        return stmt.run(domain);
    }
};

// Graceful shutdown
process.on('exit', () => {
    db.close();
});

process.on('SIGINT', () => {
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    db.close();
    process.exit(0);
});
