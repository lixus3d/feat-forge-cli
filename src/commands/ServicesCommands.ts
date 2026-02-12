import { BranchContext } from '@/foundation/BranchContext';
import { PortAllocator } from '@/foundation/PortAllocator';
import { ServiceDefinitionWithPort } from '@/foundation/types/Services';
import {
    generateBranchServicesFile,
    generateEnvrcFile,
    getServiceOutputs,
    loadGeneratedServicesFile,
    scanReposServices,
} from '@/lib/services';
import { AbstractCommands } from './AbstractCommands';
import { EnvCommands } from './EnvCommands';

export class ServicesCommands extends AbstractCommands {
    // ============================================================================
    // PUBLIC COMMAND METHODS
    // ============================================================================

    /**
     * Scan repositories for services and generate configuration files
     */
    async scan(branchName?: string): Promise<void> {
        // Load branch context (use current branch if not specified)
        const branchContext = branchName
            ? await this.context.loadBranchContext(branchName)
            : await BranchContext.findNearestBranchContext(this.context);

        // Scan for services in all repositories
        console.log(`🔍 Scanning for services in branch "${branchContext.branchName}"...`);
        const reposServices = await scanReposServices(branchContext);

        if (reposServices.some((repo) => repo.services.length > 0)) {
            console.log(`✅ Found services in ${reposServices.length} repository(ies)`);
        } else {
            console.log('⚠️ No services found in any repositories');
            return;
        }
        console.log('🔄 Allocating ports for discovered services...');
        // Load port allocator
        const portAllocator = await PortAllocator.load(this.context);

        // Allocate ports for all repositories
        portAllocator.allocatePorts(branchContext.branchName, reposServices);

        // Save port allocations
        await portAllocator.save();
        console.log('✅ Port allocation completed');

        // Generate and write generated.services.json
        console.log('🔄 Generating generated.services.json with port assignments...');
        const generated = await generateBranchServicesFile(branchContext, portAllocator);
        console.log(`✅ generated.services.json: ${generated.path}`);

        // Generate and write .envrc
        await new EnvCommands(this.context).generateEnvrcFile(branchContext, generated.services);

        // Display summary
        this.showServiceSummary(branchContext, generated.services);
    }

    /**
     * List discovered services with their allocated ports
     */
    async list(format?: 'json' | 'default'): Promise<void> {
        // Load current branch context
        const branchContext = await BranchContext.findNearestBranchContext(this.context);

        // Load generated services file
        const generatedServicesFile = await loadGeneratedServicesFile(branchContext);

        if (format === 'json') {
            // Output as JSON
            console.log(JSON.stringify(generatedServicesFile, null, 2));
        } else {
            // Default log format
            this.showServiceSummary(branchContext, generatedServicesFile.services);
        }
    }

    // ============================================================================
    // PRIVATE UTILITY METHODS
    // ============================================================================

    private showServiceSummary(branchContext: BranchContext, services: ServiceDefinitionWithPort[]): void {
        console.log('Services Summary:');

        for (const service of services) {
            const { name, port, url, proxyUrl } = getServiceOutputs(this.context, branchContext, service);
            console.log(`    🚀 ${name}: (PORT:${port})`);
            console.log(`        🌐 url: ${url}`);
            if (this.context.options.proxy.enabled) {
                console.log(`        🔀 proxy-url: ${proxyUrl}`);
            }
        }
    }
}
