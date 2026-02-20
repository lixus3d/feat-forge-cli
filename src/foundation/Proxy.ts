import { FEAT_FORGE_GENERATED_SERVICES_FILE } from '@/lib/constants';
import { handleDashboardRequest } from '@/lib/proxy-dashboard';
import { getServiceOutputs, loadGeneratedServicesFile } from '@/lib/services';
import fs from 'fs';
import { createServer, Server, ServerResponse } from 'http';
import { createProxyServer } from 'http-proxy-3';
import { BranchContext } from './BranchContext';
import { ForgeContext } from './ForgeContext';

export interface RouteEntry {
    branchName: string;
    serviceName: string;
    url: string;
    proxyUrl: string;
    healthCheckUrl: string;
}

export type RoutingTable = Map<string, RouteEntry>;

export class Proxy {
    private server: Server | null = null;
    private routingTable: RoutingTable = new Map();
    private stopWatching: (() => void) | null = null;

    constructor(private readonly context: ForgeContext) {}

    async start(options: { port?: number } = {}): Promise<void> {
        const proxyConfig = this.context.options.proxy;

        if (!proxyConfig.enabled) {
            console.error('❌ Proxy is disabled in configuration. Set proxy.enabled to true in .feat-forge.json');
            return;
        }

        const port = options.port ?? proxyConfig.port;
        const branchContexts = await this.context.loadActiveBranchesContexts();

        if (branchContexts.length === 0) {
            console.log('⚠️  No active branches found. Start a branch first with `forge start <branch>`.');
            return;
        }

        this.registerShutdownHandlers();

        this.routingTable = await this.buildRoutingTable(branchContexts);
        this.showSummary(port);
        this.startServer(port);
        this.startWatching();

        console.log(`\n🚀 Proxy server running on http://localhost:${port}`);
        console.log(`📊 Dashboard: http://localhost:${port}`);
        console.log('\nPress Ctrl+C to stop.\n');
    }

    stop(): void {
        this.stopWatching?.();
        this.stopWatching = null;

        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }

    private async buildRoutingTable(branchContexts: BranchContext[]): Promise<RoutingTable> {
        const table: RoutingTable = new Map();

        for (const branchContext of branchContexts) {
            try {
                const generated = await loadGeneratedServicesFile(branchContext);
                for (const service of generated.services) {
                    const { proxyUrl, url, key, name, healthCheckUrl } = getServiceOutputs(this.context, branchContext, service);
                    table.set(key, {
                        branchName: branchContext.branchName,
                        serviceName: name,
                        url,
                        proxyUrl,
                        healthCheckUrl,
                    });
                }
            } catch {
                // Branch has no generated services file, skip
            }
        }

        return table;
    }

    private startServer(port: number): void {
        const proxy = createProxyServer({});

        proxy.on('error', (err, req, res) => {
            if (res instanceof ServerResponse && !res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'text/plain' });
                res.end(`502 Bad Gateway - Service is down or unreachable`);
            }
        });

        this.server = createServer((req, res) => {
            const host = req.headers.host || '';
            const hostWithoutPort = host.split(':')[0];

            const parts = hostWithoutPort.replace(/\.localhost$/, '').split('.');
            if (parts.length < 2 || hostWithoutPort === 'localhost') {
                return handleDashboardRequest(req, res, this.routingTable, port);
            }

            const key = parts.join('.');
            const route = this.routingTable.get(key);

            if (!route) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end(`404 Not Found - No route for "${key}"`);
                return;
            }

            proxy.web(req, res, { target: route.url });
        });

        this.server.on('upgrade', (req, socket, head) => {
            const host = req.headers.host || '';
            const hostWithoutPort = host.split(':')[0];
            const parts = hostWithoutPort.replace(/\.localhost$/, '').split('.');
            const key = parts.join('.');
            const route = this.routingTable.get(key);

            if (route) {
                proxy.ws(req, socket, head, { target: route.url });
            } else {
                socket.destroy();
            }
        });

        this.server.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`\n❌ Port ${port} is already in use. Please choose a different proxy port.\n`);
                process.exit(1);
            }
            throw err;
        });

        this.server.listen(port);
    }

    private startWatching(): void {
        const watchers: fs.FSWatcher[] = [];
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        const rebuild = async () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                try {
                    const branchContexts = await this.context.loadActiveBranchesContexts();
                    this.routingTable = await this.buildRoutingTable(branchContexts);
                    console.log(`\n🔄 Routing table reloaded (${this.routingTable.size} routes)`);
                } catch (err) {
                    console.error('⚠️  Failed to reload routing table:', err);
                }
            }, 500);
        };

        const worktreesRoot = this.context.paths.worktreesRoot;
        if (fs.existsSync(worktreesRoot)) {
            try {
                const watcher = fs.watch(worktreesRoot, { recursive: true }, (event, filename) => {
                    if (filename && filename.endsWith(FEAT_FORGE_GENERATED_SERVICES_FILE)) {
                        rebuild();
                    }
                });
                watchers.push(watcher);
            } catch {
                const watcher = fs.watch(worktreesRoot, () => rebuild());
                watchers.push(watcher);
            }
        }

        this.stopWatching = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            watchers.forEach((w) => w.close());
        };
    }

    private showSummary(port: number): void {
        console.log('\nProxy Routing Table:');

        const byBranch = new Map<string, { serviceName: string; key: string; target: string }[]>();
        for (const [key, route] of this.routingTable) {
            const entries = byBranch.get(route.branchName) || [];
            entries.push({ serviceName: route.serviceName, key, target: route.url });
            byBranch.set(route.branchName, entries);
        }

        for (const [branch, services] of byBranch) {
            console.log(`\n  📦 ${branch}:`);
            for (const svc of services) {
                console.log(`      🚀 ${svc.serviceName}`);
                console.log(`          🔀 http://${svc.key}.localhost:${port}`);
                console.log(`          🎯 ${svc.target}`);
            }
        }
    }

    private registerShutdownHandlers(): void {
        const cleanup = () => {
            console.log('\n\nShutting down proxy...');
            this.stop();
            console.log('Proxy stopped.');
            process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
    }
}
