import { AbstractCommands } from './AbstractCommands';
import { ForgeContext } from '@/foundation/ForgeContext';
import { BranchContext } from '@/foundation/BranchContext';
import { generateEnvrcFile } from '@/lib/services';
import { PortAllocator } from '@/foundation/PortAllocator';
import { readTextFile, pathExists, readJSONFile } from '@/lib/fs';
import { GeneratedServicesFile } from '@/foundation/types/Services';
import path from 'path';

export class EnvCommands extends AbstractCommands {
    constructor(context: ForgeContext) {
        super(context);
    }

    /**
     * Generate .envrc from existing generated.services.json
     */
    async update(branchName?: string): Promise<void> {
        // Load branch context
        const branchContext = branchName
            ? await this.context.loadBranchContext(branchName)
            : await BranchContext.findNearestBranchContext(this.context);

        const generatedServicesPath = path.join(branchContext.path, 'generated.services.json');

        if (!(await pathExists(generatedServicesPath))) {
            console.log('❌ No generated.services.json found. Run "forge services scan" first.');
            return;
        }

        // Read generated services
        console.log(`🔄 Generating .envrc for branch "${branchContext.branchName}"...`);
        const generatedServices = await readJSONFile(GeneratedServicesFile, generatedServicesPath);

        // Load port allocations to get branch range
        const portAllocator = await PortAllocator.load(this.context.rootDir, this.context.config.options.proxy);
        const branchAllocation = portAllocator.getBranchAllocation(branchContext.branchName);

        // Generate .envrc
        const proxyPort = this.context.config.options.proxy?.port ?? 8080;
        await generateEnvrcFile(branchContext.path, branchContext.branchName, generatedServices, branchAllocation ? { start: branchAllocation.start, end: branchAllocation.end } : undefined, proxyPort);

        console.log(`✅ Generated .envrc at ${path.join(branchContext.path, '.envrc')}`);
    }

    /**
     * Display current .envrc and port allocation info
     */
    async show(branchName?: string): Promise<void> {
        // Load branch context
        const branchContext = branchName
            ? await this.context.loadBranchContext(branchName)
            : await BranchContext.findNearestBranchContext(this.context);

        const envrcPath = path.join(branchContext.path, '.envrc');

        console.log(`📋 Environment configuration for branch "${branchContext.branchName}"`);
        console.log('');

        // Check if .envrc exists
        if (!(await pathExists(envrcPath))) {
            console.log('❌ No .envrc found. Run "forge env update" first.');
            return;
        }

        // Read and display .envrc
        const envrcContent = await readTextFile(envrcPath);
        console.log('=== .envrc content ===');
        console.log(envrcContent);
        console.log('');

        // Show port allocation info
        const portAllocator = await PortAllocator.load(this.context.rootDir, this.context.config.options.proxy);
        const branchAllocation = portAllocator.getBranchAllocation(branchContext.branchName);

        if (branchAllocation) {
            console.log('=== Port allocation ===');
            console.log(`Reserved range: ${branchAllocation.start} - ${branchAllocation.end}`);
            console.log(`Used until: ${branchAllocation.usedUntil}`);
            console.log(`Available ports: ${branchAllocation.end - branchAllocation.usedUntil + 1}`);
        } else {
            console.log('❌ No port allocation found for this branch');
        }
    }
}
