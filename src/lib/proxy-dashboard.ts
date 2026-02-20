import { IncomingMessage, ServerResponse } from 'http';
import { RoutingTable, RouteEntry } from '@/foundation/Proxy';

interface RouteStatus {
    id: string;
    route: RouteEntry;
    status: 'PENDING';
}

export async function handleDashboardRequest(
    req: IncomingMessage,
    res: ServerResponse,
    routingTable: RoutingTable,
    proxyPort: number,
): Promise<void> {
    const statuses: RouteStatus[] = [];

    Array.from(routingTable.entries()).forEach(([, route], index) => {
        const rowId = `${route.branchName}::${route.serviceName}::${index}`;
        statuses.push({ id: encodeURIComponent(rowId), route, status: 'PENDING' });
    });

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
                    return `<tr data-health-row="${s.id}">
                    <td>${s.route.serviceName}</td>
                    <td><a href="${s.route.proxyUrl}" target="_blank">${s.route.proxyUrl}</a></td>
                    <td><a href="${s.route.url}" target="_blank">${s.route.url}</a></td>
                    <td><a href="${s.route.healthCheckUrl}" target="_blank">${s.route.healthCheckUrl}</a></td>
                    <td data-health-status="${s.id}"><span style="color:#f59e0b;font-weight:bold">● ${s.status}</span></td>
                </tr>`;
                })
                .join('\n');
            return header + '\n' + serviceRows;
        })
        .join('\n');
    const healthTargets = statuses.map((s) => ({
        id: s.id,
        url: s.route.healthCheckUrl,
    }));

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
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
<script>
const healthTargets = ${JSON.stringify(healthTargets)};
const HEALTH_TIMEOUT_MS = 1200;
const REFRESH_EVERY_MS = 30000;

function setStatus(id, label, color) {
  const el = document.querySelector('[data-health-status="' + id + '"]');
  if (!el) return;
  el.innerHTML = '<span style="color:' + color + ';font-weight:bold">● ' + label + '</span>';
}

async function checkHealth(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    // no-cors allows probing reachability from the browser without requiring CORS headers.
    await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function refreshStatuses() {
  await Promise.all(healthTargets.map(async ({ id, url }) => {
    setStatus(id, 'PENDING', '#f59e0b');
    const healthy = await checkHealth(url);
    setStatus(id, healthy ? 'UP' : 'DOWN', healthy ? '#22c55e' : '#ef4444');
  }));
}

if (healthTargets.length > 0) {
  refreshStatuses();
  setInterval(refreshStatuses, REFRESH_EVERY_MS);
}
</script>
</body></html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
}
