import { ForgePortAllocationsLoadError, ForgePortRangeExhaustedError } from '@/foundation/errors';
import { RepoName } from '@/foundation/types/RepositoryInfos';
import {
    BranchPortAllocationDTO,
    PortAllocatorDTO,
    RepositoryServices,
    ServiceDefinition,
    ServiceDefinitionWithPort,
} from '@/foundation/types/Services';
import { pathExists, readJSONFile, writeTextFile } from '@/lib/fs';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsString, Max, Min, ValidateNested } from 'class-validator';
import path from 'path';
import { ForgeContext } from './ForgeContext';

const PORT_ALLOCATIONS_FILE = 'port-allocations.json';

/** Type alias for service names */
export type ServiceName = string;

/** Maps a service name to its assigned port number */
export type ServicePortMap = Record<ServiceName, number>;

/**
 * Business entity representing port allocation for a branch
 */
export class BranchPortAllocation {
    /**
     * Branch name
     */
    public readonly name: string;

    /**
     * Starting port number for this branch's allocation range
     */
    public readonly start: number;

    /**
     * Ending port number for this branch's allocation range
     */
    public readonly end: number;

    /**
     * Services with their allocated ports for this branch
     */
    private services: ServiceDefinitionWithPort[]; // Maps service name to its allocated port

    constructor(branchName: string, start: number, end: number, services: ServiceDefinitionWithPort[] = []) {
        this.name = branchName;
        this.start = start;
        this.end = end;
        this.services = services;
    }

    static load(file: BranchPortAllocationDTO): BranchPortAllocation {
        return new BranchPortAllocation(file.name, file.start, file.end, file.services);
    }

    toJSON(): BranchPortAllocationDTO {
        return {
            name: this.name,
            start: this.start,
            end: this.end,
            services: this.services,
        };
    }

    get nextAvailablePort(): number {
        const usedPorts = this.services.map((s) => s.port);
        if (usedPorts.length === 0) {
            return this.start;
        }
        const nextPort = Math.max(...usedPorts) + 1;

        if (nextPort > this.end) {
            throw new ForgePortRangeExhaustedError();
        }
        return nextPort;
    }

    hasService(serviceName: string): boolean {
        return this.services.some((s) => s.name === serviceName);
    }

    getService(serviceName: string): ServiceDefinitionWithPort | undefined {
        return this.services.find((s) => s.name === serviceName);
    }

    /**
     * Allocate a port for the given service. Returns the existing port if already allocated,
     * or assigns the next available port.
     */
    allocatePort(service: ServiceDefinition): number {
        const serviceName = service.name;
        const existingService = this.getService(serviceName);
        if (existingService) {
            return existingService.port;
        }

        const nextPort = this.nextAvailablePort;

        if (nextPort > this.end) {
            throw new ForgePortRangeExhaustedError(
                `Cannot allocate port for service "${serviceName}": Port range exhausted (${this.start}-${this.end}).`,
            );
        }

        this.services.push({ ...service, port: nextPort });

        return nextPort;
    }

    /**
     * Remove services that are not in the provided list of names
     */
    retainOnly(services: ServiceDefinition[]): void {
        const serviceNames = new Set(services.map((s) => s.name));
        this.services = this.services.filter((s) => serviceNames.has(s.name));
    }

    getServices() {
        return this.services.slice();
    }
}

/**
 * Port allocator manages port assignments for services across branches
 */
export class PortAllocator {
    private forgeContext: ForgeContext;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BranchPortAllocation)
    private allocations: BranchPortAllocation[];

    constructor(forgeContext: ForgeContext, allocations: BranchPortAllocation[]) {
        this.forgeContext = forgeContext;
        this.allocations = allocations;
    }

    /**
     * Load or create port allocations from rootDir
     */
    static async load(forgeContext: ForgeContext): Promise<PortAllocator> {
        const portAllocationFilePath = this.getPortAllocationsFilePath(forgeContext);

        let allocations: BranchPortAllocation[] = [];

        if (await pathExists(portAllocationFilePath)) {
            try {
                const portAllocationFile = await readJSONFile(PortAllocatorDTO, portAllocationFilePath);
                allocations = portAllocationFile.allocations.map(BranchPortAllocation.load);
            } catch (error) {
                if (error instanceof Error) {
                    throw new ForgePortAllocationsLoadError(error.message);
                }
                throw error;
            }
        }

        return new PortAllocator(forgeContext, allocations);
    }

    static getPortAllocationsFilePath(forgeContext: ForgeContext): string {
        return forgeContext.paths.getPathInRoot(PORT_ALLOCATIONS_FILE);
    }

    /**
     * Persist allocations to disk
     */
    toJSON(): PortAllocatorDTO {
        return {
            _doNotEdit: "This file is auto-generated by 'forge services scan'. Manual edits will be lost on next generation.",
            allocations: this.allocations.map((alloc) => alloc.toJSON()),
        };
    }

    async save(): Promise<void> {
        const filePath = PortAllocator.getPortAllocationsFilePath(this.forgeContext);
        const content = JSON.stringify(this, null, 2);
        await writeTextFile(filePath, content);
    }

    private get config() {
        return this.forgeContext.config.options.proxy;
    }

    getAllocation(branchName: string): BranchPortAllocation | undefined {
        return this.allocations.find((alloc) => alloc.name === branchName);
    }

    hasAllocation(branchName: string): boolean {
        return this.allocations.some((alloc) => alloc.name === branchName);
    }

    /**
     * Get or create allocation for a branch
     */
    private getOrCreateBranchAllocation(branchName: string): BranchPortAllocation {
        if (this.hasAllocation(branchName)) {
            return this.getAllocation(branchName)!;
        }

        const branchIndex = this.allocations.length;
        const start = this.config.servicesBasePort + branchIndex * this.config.branchRangeSize;
        const end = start + this.config.branchRangeSize - 1;

        const allocation = new BranchPortAllocation(branchName, start, end);
        this.allocations.push(allocation);
        return allocation;
    }

    /**
     * Allocate ports for services in a branch
     * Returns mapping of service names to assigned ports
     */
    allocateBranchServicesPorts(branchName: string, services: ServiceDefinition[]): BranchPortAllocation {
        const allocation = this.getOrCreateBranchAllocation(branchName);

        for (const service of services) {
            allocation.allocatePort(service);
        }

        return allocation;
    }

    /**
     * Allocate ports for all repositories in a branch at once
     */
    allocatePorts(branchName: string, repoServices: RepositoryServices[]) {
        const allServices = repoServices.flatMap((r) => r.services);

        for (const repoService of repoServices) {
            this.allocateBranchServicesPorts(branchName, repoService.services);
        }

        // Remove services that no longer exist in any repository
        this.getAllocation(branchName)?.retainOnly(allServices);
    }

    /**
     * Get all allocations
     */
    getAllAllocations(): BranchPortAllocation[] {
        return this.allocations.slice();
    }
}
