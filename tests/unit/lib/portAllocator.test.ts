import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BranchPortAllocation, PortAllocator } from '@/foundation/PortAllocator';
import { ServiceDefinition, ServiceDefinitionWithPort } from '@/foundation/types/Services';
import { ForgeContext } from '@/foundation/ForgeContext';
import { ForgePortRangeExhaustedError } from '@/foundation/errors';

function createMockForgeContext(config = { servicesBasePort: 3000, branchRangeSize: 100 }): ForgeContext {
    return {
        config: {
            options: {
                proxy: config,
            },
        },
        paths: {
            getPathInRoot: vi.fn((filename: string) => `/test/path/${filename}`),
            featForgeConfigRoot: '/test/path/.feat-forge',
        },
    } as any;
}

function createService(name: string, type: 'http' | 'tcp' | 'grpc' = 'http', path?: string): ServiceDefinition {
    const service = new ServiceDefinition();
    service.name = name;
    service.type = type;
    service.path = path;
    return service;
}

describe('BranchPortAllocation', () => {
    describe('constructor and basic properties', () => {
        it('should create allocation with correct properties', () => {
            const allocation = new BranchPortAllocation('main', 3000, 3099);

            expect(allocation.name).toBe('main');
            expect(allocation.start).toBe(3000);
            expect(allocation.end).toBe(3099);
            expect(allocation.getServices()).toHaveLength(0);
        });

        it('should create allocation with initial services', () => {
            const services: ServiceDefinitionWithPort[] = [
                { ...createService('backend'), port: 3000 },
                { ...createService('frontend'), port: 3001 },
            ];
            const allocation = new BranchPortAllocation('main', 3000, 3099, services);

            expect(allocation.getServices()).toHaveLength(2);
        });
    });

    describe('nextAvailablePort', () => {
        it('should return start port when no services allocated', () => {
            const allocation = new BranchPortAllocation('main', 3000, 3099);

            expect(allocation.nextAvailablePort).toBe(3000);
        });

        it('should return next port after allocated services', () => {
            const services: ServiceDefinitionWithPort[] = [
                { ...createService('backend'), port: 3000 },
                { ...createService('frontend'), port: 3001 },
            ];
            const allocation = new BranchPortAllocation('main', 3000, 3099, services);

            expect(allocation.nextAvailablePort).toBe(3002);
        });

        it('should throw error when range is exhausted', () => {
            const services: ServiceDefinitionWithPort[] = [{ ...createService('backend'), port: 3099 }];
            const allocation = new BranchPortAllocation('main', 3000, 3099, services);

            expect(() => allocation.nextAvailablePort).toThrow(ForgePortRangeExhaustedError);
        });
    });

    describe('hasService and getService', () => {
        it('should return false for non-existent service', () => {
            const allocation = new BranchPortAllocation('main', 3000, 3099);

            expect(allocation.hasService('backend')).toBe(false);
        });

        it('should return true for existing service', () => {
            const services: ServiceDefinitionWithPort[] = [{ ...createService('backend'), port: 3000 }];
            const allocation = new BranchPortAllocation('main', 3000, 3099, services);

            expect(allocation.hasService('backend')).toBe(true);
        });

        it('should return undefined for non-existent service', () => {
            const allocation = new BranchPortAllocation('main', 3000, 3099);

            expect(allocation.getService('backend')).toBeUndefined();
        });

        it('should return service for existing service', () => {
            const services: ServiceDefinitionWithPort[] = [{ ...createService('backend', 'http', '/api'), port: 3000 }];
            const allocation = new BranchPortAllocation('main', 3000, 3099, services);

            const service = allocation.getService('backend');
            expect(service).toBeDefined();
            expect(service?.name).toBe('backend');
            expect(service?.port).toBe(3000);
            expect(service?.path).toBe('/api');
        });
    });

    describe('allocatePort', () => {
        it('should allocate port for new service', () => {
            const allocation = new BranchPortAllocation('main', 3000, 3099);
            const service = createService('backend', 'http', '/api');

            const port = allocation.allocatePort(service);

            expect(port).toBe(3000);
            expect(allocation.hasService('backend')).toBe(true);
            expect(allocation.getServices()).toHaveLength(1);
        });

        it('should return existing port for already allocated service', () => {
            const allocation = new BranchPortAllocation('main', 3000, 3099);
            const service = createService('backend');

            const port1 = allocation.allocatePort(service);
            const port2 = allocation.allocatePort(service);

            expect(port1).toBe(3000);
            expect(port2).toBe(3000);
            expect(allocation.getServices()).toHaveLength(1);
        });

        it('should keep existing port and refresh service metadata', () => {
            const allocation = new BranchPortAllocation('main', 3000, 3099);

            allocation.allocatePort(createService('backend', 'http', '/api'));
            const port = allocation.allocatePort({
                ...createService('backend', 'http', '/api'),
                healthCheckPath: '/health',
            } as ServiceDefinition);

            expect(port).toBe(3000);
            expect(allocation.getService('backend')?.port).toBe(3000);
            expect((allocation.getService('backend') as any)?.healthCheckPath).toBe('/health');
        });

        it('should allocate sequential ports for multiple services', () => {
            const allocation = new BranchPortAllocation('main', 3000, 3099);

            const port1 = allocation.allocatePort(createService('backend'));
            const port2 = allocation.allocatePort(createService('frontend'));
            const port3 = allocation.allocatePort(createService('worker'));

            expect(port1).toBe(3000);
            expect(port2).toBe(3001);
            expect(port3).toBe(3002);
        });

        it('should throw error when port range is exhausted', () => {
            const allocation = new BranchPortAllocation('main', 3000, 3001);

            allocation.allocatePort(createService('service1'));
            allocation.allocatePort(createService('service2'));

            expect(() => allocation.allocatePort(createService('service3'))).toThrow(ForgePortRangeExhaustedError);
        });
    });

    describe('toJSON', () => {
        it('should serialize to DTO format', () => {
            const services: ServiceDefinitionWithPort[] = [{ ...createService('backend', 'http', '/api'), port: 3000 }];
            const allocation = new BranchPortAllocation('main', 3000, 3099, services);

            const json = allocation.toJSON();

            expect(json.name).toBe('main');
            expect(json.start).toBe(3000);
            expect(json.end).toBe(3099);
            expect(json.services).toHaveLength(1);
            expect(json.services[0].name).toBe('backend');
            expect(json.services[0].port).toBe(3000);
        });
    });

    describe('load', () => {
        it('should create allocation from DTO', () => {
            const dto = {
                name: 'feature/auth',
                start: 3100,
                end: 3199,
                services: [{ ...createService('backend'), port: 3100 }],
            };

            const allocation = BranchPortAllocation.load(dto);

            expect(allocation.name).toBe('feature/auth');
            expect(allocation.start).toBe(3100);
            expect(allocation.end).toBe(3199);
            expect(allocation.getServices()).toHaveLength(1);
        });
    });
});

describe('PortAllocator', () => {
    describe('constructor and basic methods', () => {
        it('should create empty allocator', () => {
            const context = createMockForgeContext();
            const allocator = new PortAllocator(context, []);

            expect(allocator.getAllAllocations()).toHaveLength(0);
        });

        it('should create allocator with existing allocations', () => {
            const context = createMockForgeContext();
            const allocations = [new BranchPortAllocation('main', 3000, 3099)];
            const allocator = new PortAllocator(context, allocations);

            expect(allocator.getAllAllocations()).toHaveLength(1);
        });

        it('should resolve allocations file path inside .feat-forge folder', () => {
            const context = createMockForgeContext();

            const filePath = PortAllocator.getPortAllocationsFilePath(context);

            expect(filePath).toBe('/test/path/.feat-forge/port-allocations.json');
        });
    });

    describe('getAllocation and hasAllocation', () => {
        it('should return undefined for non-existent branch', () => {
            const context = createMockForgeContext();
            const allocator = new PortAllocator(context, []);

            expect(allocator.getAllocation('main')).toBeUndefined();
            expect(allocator.hasAllocation('main')).toBe(false);
        });

        it('should return allocation for existing branch', () => {
            const context = createMockForgeContext();
            const allocations = [new BranchPortAllocation('main', 3000, 3099)];
            const allocator = new PortAllocator(context, allocations);

            expect(allocator.getAllocation('main')).toBeDefined();
            expect(allocator.hasAllocation('main')).toBe(true);
        });
    });

    describe('allocateBranchServicesPorts', () => {
        it('should allocate ports for new branch', () => {
            const context = createMockForgeContext();
            const allocator = new PortAllocator(context, []);

            const services = [createService('backend'), createService('frontend')];
            const allocation = allocator.allocateBranchServicesPorts('main', services);

            expect(allocation.start).toBe(3000);
            expect(allocation.end).toBe(3099);
            expect(allocation.getServices()).toHaveLength(2);
            expect(allocation.getService('backend')?.port).toBe(3000);
            expect(allocation.getService('frontend')?.port).toBe(3001);
        });

        it('should allocate ports for second branch in next range', () => {
            const context = createMockForgeContext();
            const allocator = new PortAllocator(context, []);

            allocator.allocateBranchServicesPorts('main', [createService('service1')]);
            const allocation = allocator.allocateBranchServicesPorts('feature/auth', [createService('service1')]);

            expect(allocation.start).toBe(3100);
            expect(allocation.end).toBe(3199);
            expect(allocation.getService('service1')?.port).toBe(3100);
        });

        it('should allocate using first free branch slot to avoid range collision', () => {
            const context = createMockForgeContext();
            const allocator = new PortAllocator(context, [
                new BranchPortAllocation('feature/auth', 3000, 3099),
                new BranchPortAllocation('feature/payment', 3200, 3299),
            ]);

            const allocation = allocator.allocateBranchServicesPorts('main', [createService('service1')]);

            expect(allocation.start).toBe(3100);
            expect(allocation.end).toBe(3199);
            expect(allocation.getService('service1')?.port).toBe(3100);
        });

        it('should reuse existing allocation for same branch', () => {
            const context = createMockForgeContext();
            const allocator = new PortAllocator(context, []);

            const services1 = [createService('backend'), createService('frontend')];
            allocator.allocateBranchServicesPorts('main', services1);

            const services2 = [createService('backend'), createService('frontend')];
            const allocation = allocator.allocateBranchServicesPorts('main', services2);

            expect(allocation.getService('backend')?.port).toBe(3000);
            expect(allocation.getService('frontend')?.port).toBe(3001);
            expect(allocator.getAllAllocations()).toHaveLength(1);
        });

        it('should handle persistent port allocation for existing services', () => {
            const context = createMockForgeContext();
            const allocator = new PortAllocator(context, []);

            // First allocation
            const services1 = [createService('backend'), createService('frontend')];
            allocator.allocateBranchServicesPorts('feature/auth', services1);

            // Second allocation with same services
            const services2 = [createService('backend'), createService('frontend')];
            const allocation = allocator.allocateBranchServicesPorts('feature/auth', services2);

            expect(allocation.getService('backend')?.port).toBe(3000);
            expect(allocation.getService('frontend')?.port).toBe(3001);
            expect(allocation.getServices()).toHaveLength(2);
        });

        it('should allocate new port for new service on re-scan', () => {
            const context = createMockForgeContext();
            const allocator = new PortAllocator(context, []);

            // First allocation
            allocator.allocateBranchServicesPorts('main', [createService('backend'), createService('frontend')]);

            // Second allocation with additional service
            const allocation = allocator.allocateBranchServicesPorts('main', [
                createService('backend'),
                createService('frontend'),
                createService('worker'),
            ]);

            expect(allocation.getService('backend')?.port).toBe(3000);
            expect(allocation.getService('frontend')?.port).toBe(3001);
            expect(allocation.getService('worker')?.port).toBe(3002);
        });

        it('should handle removing services between scans', () => {
            const context = createMockForgeContext();
            const allocator = new PortAllocator(context, []);

            // First allocation with 3 services
            allocator.allocateBranchServicesPorts('main', [
                createService('backend'),
                createService('frontend'),
                createService('worker'),
            ]);

            // Second allocation removing middle service
            const allocation = allocator.allocateBranchServicesPorts('main', [createService('backend'), createService('worker')]);

            expect(allocation.getService('backend')?.port).toBe(3000);
            expect(allocation.getService('worker')?.port).toBe(3002);
            // allocateBranchServicesPorts does not purge; purging happens in allocatePorts
            expect(allocation.hasService('frontend')).toBe(true);
        });
    });

    describe('allocatePorts', () => {
        it('should allocate ports for multiple repositories', () => {
            const context = createMockForgeContext();
            const allocator = new PortAllocator(context, []);

            const repoServices = [
                {
                    name: 'repo1',
                    services: [createService('backend'), createService('frontend')],
                },
                {
                    name: 'repo2',
                    services: [createService('api')],
                },
            ];

            allocator.allocatePorts('main', repoServices);

            const allocation = allocator.getAllocation('main');
            expect(allocation).toBeDefined();
            expect(allocation?.getServices()).toHaveLength(3);
            expect(allocation?.getService('backend')?.port).toBe(3000);
            expect(allocation?.getService('frontend')?.port).toBe(3001);
            expect(allocation?.getService('api')?.port).toBe(3002);
        });

        it('should remove services that are no longer declared in any repository', () => {
            const context = createMockForgeContext();
            const allocator = new PortAllocator(context, []);

            // First scan: 3 services across 2 repos
            allocator.allocatePorts('main', [
                { name: 'repo1', services: [createService('backend'), createService('frontend')] },
                { name: 'repo2', services: [createService('worker')] },
            ]);

            let allocation = allocator.getAllocation('main')!;
            expect(allocation.getServices()).toHaveLength(3);

            // Second scan: 'frontend' removed from repo1
            allocator.allocatePorts('main', [
                { name: 'repo1', services: [createService('backend')] },
                { name: 'repo2', services: [createService('worker')] },
            ]);

            allocation = allocator.getAllocation('main')!;
            expect(allocation.getServices()).toHaveLength(2);
            expect(allocation.hasService('backend')).toBe(true);
            expect(allocation.hasService('worker')).toBe(true);
            expect(allocation.hasService('frontend')).toBe(false);
            // Existing ports are preserved
            expect(allocation.getService('backend')?.port).toBe(3000);
            expect(allocation.getService('worker')?.port).toBe(3002);
        });
    });

    describe('toJSON and serialization', () => {
        it('should serialize to DTO format', () => {
            const context = createMockForgeContext();
            const allocator = new PortAllocator(context, []);

            allocator.allocateBranchServicesPorts('main', [createService('backend')]);

            const json = allocator.toJSON();

            expect(json._doNotEdit).toContain('auto-generated');
            expect(json.allocations).toHaveLength(1);
            expect(json.allocations[0].name).toBe('main');
            expect(json.allocations[0].services).toHaveLength(1);
        });
    });

    describe('edge cases', () => {
        it('should handle small branch range size', () => {
            const context = createMockForgeContext({ servicesBasePort: 3000, branchRangeSize: 2 });
            const allocator = new PortAllocator(context, []);

            // Should work with 2 services
            const allocation = allocator.allocateBranchServicesPorts('main', [createService('service1'), createService('service2')]);

            expect(allocation.getServices()).toHaveLength(2);

            // Should fail with 3rd service
            expect(() => {
                allocator.allocateBranchServicesPorts('main', [
                    createService('service1'),
                    createService('service2'),
                    createService('service3'),
                ]);
            }).toThrow(ForgePortRangeExhaustedError);
        });

        it('should handle different service types', () => {
            const context = createMockForgeContext();
            const allocator = new PortAllocator(context, []);

            const services = [
                createService('http-service', 'http', '/api'),
                createService('tcp-service', 'tcp'),
                createService('grpc-service', 'grpc'),
            ];

            const allocation = allocator.allocateBranchServicesPorts('main', services);

            expect(allocation.getService('http-service')?.type).toBe('http');
            expect(allocation.getService('tcp-service')?.type).toBe('tcp');
            expect(allocation.getService('grpc-service')?.type).toBe('grpc');
        });
    });
});
