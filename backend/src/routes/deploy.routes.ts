import { Hono } from 'hono';
import { deployApp } from '../services/deployment.service';
import { removeDeployment } from '../handlers/caddy.handler';
import { randomUUID } from 'crypto';

const deployRoutes = new Hono();

// In-memory storage (replace with database later)
const deployments = new Map<string, any>();
let nextPort = 3001;

/**
 * Find next available port
 */
async function findAvailablePort(): Promise<number> {
    const usedPorts = new Set(Array.from(deployments.values()).map(d => d.port));
    
    // Check if port is actually in use by checking with lsof
    while (true) {
        if (!usedPorts.has(nextPort)) {
            try {
                // Quick check if port is available
                const { execSync } = await import('child_process');
                const result = execSync(`lsof -ti:${nextPort} 2>/dev/null || echo "available"`).toString().trim();
                if (result === 'available') {
                    return nextPort++;
                }
            } catch {
                // If lsof fails, assume port is available
                return nextPort++;
            }
        }
        nextPort++;
    }
}

/**
 * Deploy a new app
 */
deployRoutes.post('/deploy', async (c) => {
    try {
        console.log('Deploy endpoint hit');
        const body = await c.req.json();
        console.log('Request body:', body);
        const { image, subdomain, repo } = body;
        
        // Validate input
        if (!image || !subdomain) {
            return c.json({ error: 'Missing required fields: image, subdomain' }, 400);
        }
        
        // Validate subdomain format
        if (!/^[a-z0-9-]+$/.test(subdomain)) {
            return c.json({ error: 'Invalid subdomain format' }, 400);
        }
        
        // Check if subdomain is taken
        const existing = Array.from(deployments.values()).find(d => d.subdomain === subdomain);
        if (existing) {
            return c.json({ error: 'Subdomain already taken' }, 409);
        }
        
        // Generate deployment ID and allocate port
        const deployId = randomUUID();
        const port = await findAvailablePort();
        
        console.log('Starting deployment:', { deployId, subdomain, port, image });
        
        // Deploy the app
        const result = await deployApp({
            deployId,
            subdomain,
            port,
            imageName: image
        });
        
        // Store deployment info
        const deployment = {
            ...result,
            repo,
            createdAt: new Date().toISOString()
        };
        deployments.set(deployId, deployment);
        
        return c.json({
            success: true,
            deployment
        });
        
    } catch (error: any) {
        console.error('Deployment error:', error);
        console.error('Error stack:', error.stack);
        return c.json({ 
            success: false, 
            error: error.message || 'Unknown error'
        }, 500);
    }
});

/**
 * List all deployments
 */
deployRoutes.get('/deployments', (c) => {
    return c.json({
        deployments: Array.from(deployments.values()),
        count: deployments.size
    });
});

/**
 * Get single deployment
 */
deployRoutes.get('/deployments/:id', (c) => {
    const deployId = c.req.param('id');
    const deployment = deployments.get(deployId);
    
    if (!deployment) {
        return c.json({ error: 'Deployment not found' }, 404);
    }
    
    return c.json({ deployment });
});

/**
 * Delete a deployment
 */
deployRoutes.delete('/deployments/:id', async (c) => {
    const deployId = c.req.param('id');
    
    if (!deployments.has(deployId)) {
        return c.json({ error: 'Deployment not found' }, 404);
    }
    
    try {
        await removeDeployment(deployId);
        deployments.delete(deployId);
        
        return c.json({ 
            success: true,
            message: 'Deployment removed successfully'
        });
    } catch (error: any) {
        return c.json({ 
            success: false,
            error: error.message 
        }, 500);
    }
});

export { deployRoutes };
