import { BranchContext } from '@/foundation/BranchContext';
import { PortAllocator } from '@/foundation/PortAllocator';
import { GeneratedServicesFile } from '@/foundation/types/Services';
import { pathExists, readJSONFile } from '@/lib/fs';
import { generateEnvrcFile, generateRootServicesFile, scanServices } from '@/lib/services';
import path from 'path';
import { AbstractCommands } from './AbstractCommands';

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
        const scannedServices = await scanServices(branchContext);

        if (Object.keys(scannedServices.repos).length === 0) {
            console.log('ℹ️  No services found');
            return;
        }

        // Load port allocator
        const portAllocator = await PortAllocator.load(this.context.rootDir, this.context.config.options.proxy);

        // Allocate ports for all repositories
        const repoPortMappings = portAllocator.allocatePortsForRepos(branchContext.branchName, scannedServices.repos);

        // Save port allocations
        await portAllocator.save();

        // Generate and write generated.services.json
        const generatedServices = await generateRootServicesFile(branchContext.path, scannedServices, repoPortMappings);

        // Generate and write .envrc
        const branchAllocation = portAllocator.getBranchAllocation(branchContext.branchName);
        await generateEnvrcFile(
            branchContext.path,
            branchContext.branchName,
            generatedServices,
            branchAllocation ? { start: branchAllocation.start, end: branchAllocation.end } : undefined,
        );

        // Display summary
        console.log(`✅ Generated configuration files for ${Object.keys(scannedServices.repos).length} repository(ies)`);
        console.log(`📄 generated.services.json: ${path.join(branchContext.path, 'generated.services.json')}`);
        console.log(`📄 .envrc: ${path.join(branchContext.path, '.envrc')}`);
        console.log('');
        console.log('Service Summary:');

        for (const [repoName, services] of Object.entries(scannedServices.repos)) {
            console.log(`  ${repoName}:`);
            for (const service of services) {
                const port = repoPortMappings[repoName][service.name];
                const path = service.path ? ` (${service.path})` : '';
                console.log(`    - ${service.name}: ${service.type} on port ${port}${path}`);
            }
        }
    }

    /**
     * List discovered services with their allocated ports
     */
    async list(format?: 'json' | 'table'): Promise<void> {
        // Load current branch context
        const branchContext = await BranchContext.findNearestBranchContext(this.context);
        const generatedServicesPath = path.join(branchContext.path, 'generated.services.json');

        if (!(await pathExists(generatedServicesPath))) {
            console.log('❌ No generated services found. Run "forge services scan" first.');
            return;
        }

        // Read generated services
        const generatedServices = await readJSONFile(GeneratedServicesFile, generatedServicesPath);

        if (format === 'json') {
            // Output as JSON
            console.log(JSON.stringify(generatedServices, null, 2));
        } else {
            // Default table format
            console.log('Services in branch:', branchContext.branchName);
            console.log('');

            for (const [repoName, repoServices] of Object.entries(generatedServices.repos)) {
                console.log(`${repoName}:`);

                // Create a table-like display
                const rows = repoServices.services.map((service) => {
                    const pathStr = service.path || '-';
                    return `  ${service.name.padEnd(20)} ${service.type.padEnd(8)} ${service.port} ${pathStr}`;
                });

                console.log('  Name                 Type     Port  Path');
                console.log('  ' + '-'.repeat(60));
                rows.forEach((row) => console.log(row));
                console.log('');
            }
        }
    }

    // ============================================================================
    // PRIVATE UTILITY METHODS
    // ============================================================================
}
