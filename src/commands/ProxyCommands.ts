import { Proxy } from '@/foundation/Proxy';
import { AbstractCommands } from './AbstractCommands';

export class ProxyCommands extends AbstractCommands {
    async start(options: { port?: string }): Promise<void> {
        if (options.port) {
            console.warn(
                `⚠️  Specifying a custom port with --port may result in problems if services communicates with each other through the proxy port/url declared in the .envrc files.
It is recommended to set the desired port in the configuration file instead.`,
            );
        }

        const proxy = new Proxy(this.context);
        await proxy.start({
            port: options.port ? parseInt(options.port, 10) : undefined,
        });
    }
}
