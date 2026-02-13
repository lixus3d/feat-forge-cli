import { AbstractCommands } from './AbstractCommands';
import { ForgeContext } from '@/foundation/ForgeContext';
import { BranchContext } from '@/foundation/BranchContext';
import { generateEnvrcFile, loadGeneratedServicesFile } from '@/lib/services';
import { PortAllocator } from '@/foundation/PortAllocator';
import { readTextFile, pathExists, readJSONFile } from '@/lib/fs';
import { GeneratedServicesDTO, ServiceDefinitionWithPort } from '@/foundation/types/Services';
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
        const generatedServicesFile = await loadGeneratedServicesFile(branchContext);

        // Read generated services
        await this.generateEnvrcFile(branchContext, generatedServicesFile.services);
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
    }

    async generateEnvrcFile(
        branchContext: BranchContext,
        services: ServiceDefinitionWithPort[],
    ): Promise<{ path: string; env: string }> {
        console.log(`🔄 Generating .envrc for branch "${branchContext.branchName}"...`);
        const env = await generateEnvrcFile(this.context, branchContext, services);
        console.log(`   ✅ .envrc: ${env.path}`);
        console.log('');
        return env;
    }
}
