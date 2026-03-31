import { stopContainer, removeContainer } from './podman-cli.handler';
import fs from 'fs/promises';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

/**
 *  generate caddy config for new app 
 * caddy file lies on server
 * @param deployId 
 * @param subdomain 
 * @param port 
 */

export const generateCaddyConfig = async(deployId : string, subdomain:string, port : number)  =>  {
    const configDir = `/etc/caddy/apps`;
    const configPath = `${configDir}/${deployId}.caddy`;
    
    // caddy config boilerplate
    const caddyConfig = `
${subdomain}.${process.env.DOMAIN || 'yourdomain.com'} {
    reverse_proxy localhost:${port} {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
    }
    
    # Enable compression
    encode gzip
    
    # Logging
    log {
        output file /var/log/caddy/${subdomain}.log
    }
}`;

    try {
        // Create directory if it doesn't exist
        await fs.mkdir(configDir, { recursive: true });
        
        // Write to filesystem
        await fs.writeFile(configPath, caddyConfig.trim());
        console.log(`Caddy config created: ${configPath}`);
    } catch (error: any) {
        // If permission denied, just log warning and continue
        if (error.code === 'EACCES' || error.code === 'EPERM') {
            console.warn(`⚠️  Cannot write Caddy config (permission denied). Skipping Caddy configuration.`);
            console.warn(`   For production, run: sudo mkdir -p ${configDir} && sudo chown $USER ${configDir}`);
        } else {
            throw error;
        }
    }
} 

/**
 * reload caddy file after changing
 */

export const reloadCaddy = async () =>{
    try {
        await execAsync('sudo caddy reload --config /etc/caddy/Caddyfile');
        console.log('Caddy reloaded successfully');
    } catch (err: any) {
        // If Caddy not installed or not configured, just warn
        if (err.message.includes('command not found') || err.message.includes('No such file')) {
            console.warn("⚠️  Caddy not found or not configured. Skipping reload.");
        } else {
            console.warn("⚠️  Caddy reload failed:", err.message);
        }
    }
}


/**
 * remove caddy config and container
 * @param deployId
 */

export const removeDeployment = async (deployId : string) =>{
    try {
        // Stop and remove container
        await stopContainer(deployId);
        await removeContainer(deployId);

        // Remove caddy config
        const caddyConfigPath = `/etc/caddy/apps/${deployId}.caddy`;
        await fs.unlink(caddyConfigPath);

        // Reload caddy
        await reloadCaddy();
        
        console.log(` Deployment ${deployId} removed`);
    } catch (err) {
        console.error("Failed to remove deployment:", err);
        throw err;
    }
}