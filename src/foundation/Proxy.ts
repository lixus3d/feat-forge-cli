import { handleDashboardRequest } from '@/lib/proxy-dashboard';
import { getServiceOutputs, loadGeneratedServicesFile } from '@/lib/services';
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

const AUTO_REFRESH_INTERVAL_MS = 60_000;

export class Proxy {
    private server: Server | null = null;
    private routingTable: RoutingTable = new Map();
    private teardowns: Array<() => void> = [];

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

        console.log(`\n🚀 Proxy server running on http://localhost:${port}`);
        console.log(`📊 Dashboard: http://localhost:${port}`);
        console.log(`\nAuto-refresh every ${AUTO_REFRESH_INTERVAL_MS / 1000}s. Press "r" to refresh now, Ctrl+C to stop.\n`);

        this.startAutoRefresh();
        this.startKeypressListener();
    }

    stop(): void {
        this.teardowns.forEach((fn) => fn());
        this.teardowns = [];

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

    private async rebuild(verbose: boolean = false): Promise<void> {
        try {
            const branchContexts = await this.context.loadActiveBranchesContexts();
            this.routingTable = await this.buildRoutingTable(branchContexts);
            if (verbose) {
                console.log(`\n🔄 Routing table reloaded (${this.routingTable.size} routes)`);
            }
        } catch (err) {
            console.error('⚠️  Failed to reload routing table:', err);
        }
    }

    private startAutoRefresh(): void {
        const timer = setInterval(() => this.rebuild(), AUTO_REFRESH_INTERVAL_MS);
        // Allow Node to exit even if the interval is still pending
        timer.unref();
        this.teardowns.push(() => clearInterval(timer));
    }

    private startKeypressListener(): void {
        if (!process.stdin.isTTY) return;

        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        const onData = (key: string) => {
            if (key === '\x03') {
                // Ctrl+C in raw mode doesn't send SIGINT — emit it manually
                process.emit('SIGINT');
                return;
            }
            if (key === 'r' || key === 'R') {
                console.log('\n🔄 Manual refresh triggered...');
                this.rebuild(true);
            }
        };

        process.stdin.on('data', onData);

        this.teardowns.push(() => {
            process.stdin.off('data', onData);
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(false);
            }
            process.stdin.pause();
        });
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
