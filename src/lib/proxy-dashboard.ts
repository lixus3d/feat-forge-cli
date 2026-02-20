import { IncomingMessage, ServerResponse } from 'http';
import http from 'http';
import { RoutingTable, RouteEntry } from '@/foundation/Proxy';

interface RouteStatus {
    key: string;
    route: RouteEntry;
    healthy: boolean;
}

async function checkHealth(target: string): Promise<boolean> {
    return new Promise((resolve) => {
        const req = http.get(target, { timeout: 800 }, (res) => {
            res.resume();
            resolve(true);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
    });
}

export async function handleDashboardRequest(
    req: IncomingMessage,
    res: ServerResponse,
    routingTable: RoutingTable,
    proxyPort: number,
): Promise<void> {
    const statuses: RouteStatus[] = [];

    const checks = Array.from(routingTable.entries()).map(async ([key, route]) => {
        const healthy = await checkHealth(route.healthCheckUrl);
        statuses.push({ key, route, healthy });
    });
    await Promise.all(checks);

    statuses.sort(
        (a, b) => a.route.branchName.localeCompare(b.route.branchName) || a.route.serviceName.localeCompare(b.route.serviceName),
    );

    const grouped = new Map<string, RouteStatus[]>();
    for (const s of statuses) {
        const list = grouped.get(s.route.branchName) ?? [];
        list.push(s);
        grouped.set(s.route.branchName, list);
    }

    const rows = Array.from(grouped.entries())
        .map(([branchName, services]) => {
            const header = `<tr class="branch-header"><td colspan="5"><strong>${branchName}</strong></td></tr>`;
            const serviceRows = services
                .map((s) => {
                    const statusBadge = s.healthy
                        ? '<span style="color:#22c55e;font-weight:bold">● UP</span>'
                        : '<span style="color:#ef4444;font-weight:bold">● DOWN</span>';
                    return `<tr>
                    <td>${s.route.serviceName}</td>
                    <td><a href="${s.route.proxyUrl}" target="_blank">${s.route.proxyUrl}</a></td>
                    <td><a href="${s.route.url}" target="_blank">${s.route.url}</a></td>
                    <td><a href="${s.route.healthCheckUrl}" target="_blank">${s.route.healthCheckUrl}</a></td>
                    <td>${statusBadge}</td>
                </tr>`;
                })
                .join('\n');
            return header + '\n' + serviceRows;
        })
        .join('\n');

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="30">
<title>Feat-Forge Proxy Dashboard</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; background: #0f172a; color: #e2e8f0; }
  h1 { color: #38bdf8; }
  table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
  th, td { padding: 0.6rem 1rem; text-align: left; border-bottom: 1px solid #334155; }
  th { background: #1e293b; color: #94a3b8; font-size: 0.85rem; text-transform: uppercase; }
  tr:hover { background: #1e293b; }
  .branch-header td { background: #1e293b; border-bottom: 2px solid #475569; padding-top: 1rem; color: #f1f5f9; font-size: 1rem; }
  a { color: #38bdf8; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .meta { color: #64748b; font-size: 0.85rem; margin-top: 0.5rem; }
</style>
</head><body>
<h1>Feat-Forge Proxy Dashboard</h1>
<p class="meta">${statuses.length} routes &middot; auto-refresh 30s &middot; proxy port ${proxyPort}</p>
<table>
<thead><tr><th>Service</th><th>Proxy URL</th><th>Target</th><th>Health Check</th><th>Status</th></tr></thead>
<tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#64748b">No routes configured. Run <code>forge services scan</code> on active branches.</td></tr>'}</tbody>
</table>
</body></html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
}
