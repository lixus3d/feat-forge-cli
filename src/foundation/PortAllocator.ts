import { readJSONFile, writeConfigSafely, pathExists } from '@/lib/fs';
import { BranchPortAllocation, PortAllocationsFile, RepoServices } from '@/foundation/types/Services';
import { ForgeProxyOptions } from '@/foundation/ForgeConfigFile';
import { ForgePortAllocationsLoadError, ForgePortRangeExhaustedError } from '@/foundation/errors';
import { BranchName } from '@/foundation/BranchContext';
import { RepoName } from '@/foundation/types/RepositoryInfos';
import path from 'path';

const PORT_ALLOCATIONS_FILE = 'port-allocations.json';

/** Type alias for service names */
export type ServiceName = string;

/** Maps a service name to its assigned port number */
export type ServicePortMap = Record<ServiceName, number>;

/** Maps a repository name to its services' port assignments */
export type RepoPortMappings = Record<RepoName, ServicePortMap>;

export interface PortAllocationResult {
    start: number;
    end: number;
    assignedPorts: ServicePortMap;
}

/**
 * Business entity representing port allocation for a branch
 */
export class PortAllocation {
    readonly start: number;
    readonly end: number;
    usedUntil: number;
    private services: Record<string, number>;

    constructor(start: number, end: number, usedUntil: number, services: Record<string, number> = {}) {
        this.start = start;
        this.end = end;
        this.usedUntil = usedUntil;
        this.services = services;
    }

    /**
     * Allocate a port for the given service. Returns the existing port if already allocated,
     * or assigns the next available port.
     */
    allocatePort(serviceName: string, branchName: string): number {
        if (this.services[serviceName] !== undefined) {
            return this.services[serviceName];
        }

        const nextPort = this.usedUntil;

        if (nextPort > this.end) {
            throw new ForgePortRangeExhaustedError(
                `Cannot allocate port for service "${serviceName}" in branch "${branchName}": ` +
                    `Port range exhausted (${this.start}-${this.end}). ` +
                    `Already used up to ${this.usedUntil}.`,
            );
        }

        this.services[serviceName] = nextPort;
        this.usedUntil++;
        return nextPort;
    }

    getServices(): Record<string, number> {
        return { ...this.services };
    }

    toDTO(): BranchPortAllocation {
        const dto = new BranchPortAllocation();
        dto.start = this.start;
        dto.end = this.end;
        dto.usedUntil = this.usedUntil;
        dto.services = { ...this.services };
        return dto;
    }

    static fromDTO(dto: BranchPortAllocation): PortAllocation {
        return new PortAllocation(dto.start, dto.end, dto.usedUntil, dto.services ? { ...dto.services } : {});
    }
}

/**
 * Port allocator manages port assignments for services across branches
 */
export class PortAllocator {
    private allocations: Map<string, PortAllocation>;
    private config: { servicesBasePort: number; branchRangeSize: number };
    private filePath: string;

    constructor(
        allocations: Map<string, PortAllocation>,
        filePath: string,
        config: { servicesBasePort: number; branchRangeSize: number },
    ) {
        this.allocations = allocations;
        this.filePath = filePath;
        this.config = config;
    }

    /**
     * Load or create port allocations from rootDir
     */
    static async load(rootDir: string, proxyOptions?: ForgeProxyOptions): Promise<PortAllocator> {
        const filePath = path.join(rootDir, PORT_ALLOCATIONS_FILE);

        let mapping: PortAllocationsFile;

        if (await pathExists(filePath)) {
            try {
                mapping = await readJSONFile(PortAllocationsFile, filePath);
            } catch (error) {
                if (error instanceof Error) {
                    throw new ForgePortAllocationsLoadError(error.message);
                }
                throw error;
            }
        } else {
            // Create new allocations file
            mapping = new PortAllocationsFile();
            mapping._doNotEdit = 'This file is managed by feat-forge. Manual edits may cause port allocation conflicts.';
            const defaults = proxyOptions ?? new ForgeProxyOptions();
            mapping.servicesBasePort = defaults.servicesBasePort;
            mapping.branchRangeSize = defaults.branchRangeSize;
            mapping.allocations = {};
        }

        const config = {
            servicesBasePort: mapping.servicesBasePort,
            branchRangeSize: mapping.branchRangeSize,
        };

        const allocations = new Map<string, PortAllocation>();
        for (const [branchName, dto] of Object.entries(mapping.allocations)) {
            allocations.set(branchName, PortAllocation.fromDTO(dto));
        }

        return new PortAllocator(allocations, filePath, config);
    }

    /**
     * Get or create allocation for a branch
     */
    private getOrCreateBranchAllocation(branchName: string): PortAllocation {
        const existing = this.allocations.get(branchName);
        if (existing) {
            return existing;
        }

        const branchIndex = this.allocations.size;
        const start = this.config.servicesBasePort + branchIndex * this.config.branchRangeSize;
        const end = start + this.config.branchRangeSize - 1;

        const allocation = new PortAllocation(start, end, start);
        this.allocations.set(branchName, allocation);
        return allocation;
    }

    /**
     * Allocate ports for services in a branch
     * Returns mapping of service names to assigned ports
     */
    allocatePorts(branchName: string, serviceNames: string[]): PortAllocationResult {
        const allocation = this.getOrCreateBranchAllocation(branchName);
        const assignedPorts: ServicePortMap = {};

        for (const serviceName of serviceNames) {
            assignedPorts[serviceName] = allocation.allocatePort(serviceName, branchName);
        }

        return {
            start: allocation.start,
            end: allocation.end,
            assignedPorts,
        };
    }

    /**
     * Allocate ports for all repositories in a branch at once
     */
    allocatePortsForRepos(branchName: string, repoServices: RepoServices): RepoPortMappings {
        return Object.fromEntries(
            Object.entries(repoServices).map(([repoName, services]) => [
                repoName,
                this.allocatePorts(
                    branchName,
                    services.map((s) => s.name),
                ).assignedPorts,
            ]),
        );
    }

    /**
     * Get the branch allocation (read-only)
     */
    getBranchAllocation(branchName: string): PortAllocation | undefined {
        return this.allocations.get(branchName);
    }

    /**
     * Get all allocations
     */
    getAllAllocations(): Map<BranchName, PortAllocation> {
        return this.allocations;
    }

    /**
     * Persist allocations to disk
     */
    async save(): Promise<void> {
        const mapping = new PortAllocationsFile();
        mapping._doNotEdit = 'This file is managed by feat-forge. Manual edits may cause port allocation conflicts.';
        mapping.servicesBasePort = this.config.servicesBasePort;
        mapping.branchRangeSize = this.config.branchRangeSize;
        mapping.allocations = {};

        for (const [branchName, allocation] of this.allocations) {
            mapping.allocations[branchName] = allocation.toDTO();
        }

        const content = JSON.stringify(mapping, null, 2);
        await writeConfigSafely(this.filePath, content);
    }

    /**
     * Get base port configuration
     */
    getConfig(): { servicesBasePort: number; rangeSize: number } {
        return {
            servicesBasePort: this.config.servicesBasePort,
            rangeSize: this.config.branchRangeSize,
        };
    }
}
