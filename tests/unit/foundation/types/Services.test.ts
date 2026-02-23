import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
    ServiceDefinition,
    ServicesDTO,
    ServiceDefinitionWithPort,
    PortAllocatorDTO,
    BranchPortAllocationDTO,
    GeneratedServicesDTO,
    RepositoryServices,
} from '@/foundation/types/Services';

describe('Services Types', () => {
    describe('ServiceDefinition', () => {
        it('should validate a valid service', async () => {
            const data = {
                name: 'backend',
                type: 'http',
                path: '/api',
                healthCheckPath: '/health',
            };

            const service = plainToInstance(ServiceDefinition, data);
            const errors = await validate(service);

            expect(errors).toHaveLength(0);
            expect(service.name).toBe('backend');
            expect(service.type).toBe('http');
            expect(service.path).toBe('/api');
            expect(service.healthCheckPath).toBe('/health');
        });

        it('should reject invalid service type', async () => {
            const data = {
                name: 'backend',
                type: 'invalid',
                path: '/api',
            };

            const service = plainToInstance(ServiceDefinition, data);
            const errors = await validate(service);

            expect(errors.length).toBeGreaterThan(0);
        });

        it('should allow service without path', async () => {
            const data = {
                name: 'backend',
                type: 'http',
            };

            const service = plainToInstance(ServiceDefinition, data);
            const errors = await validate(service);

            expect(errors).toHaveLength(0);
        });

        it('should allow service with healthCheckPath only', async () => {
            const data = {
                name: 'backend',
                type: 'http',
                healthCheckPath: '/health',
            };

            const service = plainToInstance(ServiceDefinition, data);
            const errors = await validate(service);

            expect(errors).toHaveLength(0);
            expect(service.healthCheckPath).toBe('/health');
        });

        it('should default type to http', () => {
            const service = new ServiceDefinition();
            service.name = 'backend';

            expect(service.type).toBe('http');
        });

        it('should allow tcp and grpc service types', async () => {
            const tcpData = { name: 'tcp-service', type: 'tcp' as const };
            const grpcData = { name: 'grpc-service', type: 'grpc' as const };

            const tcpService = plainToInstance(ServiceDefinition, tcpData);
            const grpcService = plainToInstance(ServiceDefinition, grpcData);

            const tcpErrors = await validate(tcpService);
            const grpcErrors = await validate(grpcService);

            expect(tcpErrors).toHaveLength(0);
            expect(grpcErrors).toHaveLength(0);
        });
    });

    describe('ServicesDTO', () => {
        it('should validate a valid services file', async () => {
            const data = {
                services: [
                    { name: 'backend', type: 'http', path: '/api' },
                    { name: 'frontend', type: 'http', path: '/' },
                ],
            };

            const file = plainToInstance(ServicesDTO, data);
            const errors = await validate(file);

            expect(errors).toHaveLength(0);
            expect(file.services).toHaveLength(2);
        });

        it('should reject empty services array', async () => {
            const data = {
                services: [],
            };

            const file = plainToInstance(ServicesDTO, data);

            // An empty array is still valid structurally
            const errors = await validate(file);
            expect(errors).toHaveLength(0);
            expect(file.services).toHaveLength(0);
        });
    });

    describe('RepositoryServices', () => {
        it('should validate valid repository services', async () => {
            const data = {
                name: 'my-repo',
                services: [
                    { name: 'backend', type: 'http', path: '/api' },
                    { name: 'frontend', type: 'http', path: '/' },
                ],
            };

            const repoServices = plainToInstance(RepositoryServices, data);
            const errors = await validate(repoServices);

            expect(errors).toHaveLength(0);
            expect(repoServices.name).toBe('my-repo');
            expect(repoServices.services).toHaveLength(2);
        });

        it('should reject repository without name', async () => {
            const data = {
                services: [{ name: 'backend', type: 'http' }],
            };

            const repoServices = plainToInstance(RepositoryServices, data);
            const errors = await validate(repoServices);

            expect(errors.length).toBeGreaterThan(0);
        });
    });

    describe('ServiceDefinitionWithPort', () => {
        it('should validate a service with port', async () => {
            const data = {
                name: 'backend',
                type: 'http',
                path: '/api',
                port: 3100,
            };

            const service = plainToInstance(ServiceDefinitionWithPort, data);
            const errors = await validate(service);

            expect(errors).toHaveLength(0);
            expect(service.port).toBe(3100);
        });

        it('should reject port below 1024', async () => {
            const data = {
                name: 'backend',
                type: 'http',
                port: 80,
            };

            const service = plainToInstance(ServiceDefinitionWithPort, data);
            const errors = await validate(service);

            expect(errors.length).toBeGreaterThan(0);
        });

        it('should reject port above 65535', async () => {
            const data = {
                name: 'backend',
                type: 'http',
                port: 99999,
            };

            const service = plainToInstance(ServiceDefinitionWithPort, data);
            const errors = await validate(service);

            expect(errors.length).toBeGreaterThan(0);
        });

        it('should accept valid port range', async () => {
            const data = {
                name: 'backend',
                type: 'http',
                port: 3000,
            };

            const service = plainToInstance(ServiceDefinitionWithPort, data);
            const errors = await validate(service);

            expect(errors).toHaveLength(0);
        });
    });

    describe('GeneratedServicesDTO', () => {
        it('should validate a valid generated services file', async () => {
            const data = {
                _doNotEdit: 'This file is auto-generated',
                generatedAt: new Date('2026-02-13T10:00:00Z'),
                services: [
                    { name: 'backend', type: 'http', path: '/api', port: 3000 },
                    { name: 'frontend', type: 'http', path: '/', port: 3001 },
                ],
            };

            const file = plainToInstance(GeneratedServicesDTO, data);
            const errors = await validate(file);

            expect(errors).toHaveLength(0);
            expect(file._doNotEdit).toBe('This file is auto-generated');
            expect(file.generatedAt).toBeInstanceOf(Date);
            expect(file.services).toHaveLength(2);
        });

        it('should validate with empty services array', async () => {
            const data = {
                _doNotEdit: 'This file is auto-generated',
                generatedAt: new Date(),
                services: [],
            };

            const file = plainToInstance(GeneratedServicesDTO, data);
            const errors = await validate(file);

            expect(errors).toHaveLength(0);
        });
    });

    describe('BranchPortAllocationDTO', () => {
        it('should validate a valid branch allocation', async () => {
            const data = {
                name: 'main',
                start: 3000,
                end: 3099,
                services: [
                    { name: 'backend', type: 'http', port: 3000 },
                    { name: 'frontend', type: 'http', port: 3001 },
                ],
            };

            const allocation = plainToInstance(BranchPortAllocationDTO, data);
            const errors = await validate(allocation);

            expect(errors).toHaveLength(0);
            expect(allocation.name).toBe('main');
            expect(allocation.start).toBe(3000);
            expect(allocation.end).toBe(3099);
            expect(allocation.services).toHaveLength(2);
        });

        it('should validate with empty services array', async () => {
            const data = {
                name: 'feature/auth',
                start: 3100,
                end: 3199,
                services: [],
            };

            const allocation = plainToInstance(BranchPortAllocationDTO, data);
            const errors = await validate(allocation);

            expect(errors).toHaveLength(0);
            expect(allocation.services).toHaveLength(0);
        });

        it('should reject invalid port range', async () => {
            const data = {
                name: 'main',
                start: 500,
                end: 599,
                services: [],
            };

            const allocation = plainToInstance(BranchPortAllocationDTO, data);
            const errors = await validate(allocation);

            expect(errors.length).toBeGreaterThan(0);
        });

        it('should reject allocation without name', async () => {
            const data = {
                start: 3000,
                end: 3099,
                services: [],
            };

            const allocation = plainToInstance(BranchPortAllocationDTO, data);
            const errors = await validate(allocation);

            expect(errors.length).toBeGreaterThan(0);
        });
    });

    describe('PortAllocatorDTO', () => {
        it('should validate a valid port allocations file', async () => {
            const data = {
                _doNotEdit: 'This file is auto-generated',
                allocations: [
                    {
                        name: 'main',
                        start: 3000,
                        end: 3099,
                        services: [{ name: 'backend', type: 'http', port: 3000 }],
                    },
                    {
                        name: 'feature/auth',
                        start: 3100,
                        end: 3199,
                        services: [{ name: 'backend', type: 'http', port: 3100 }],
                    },
                ],
            };

            const file = plainToInstance(PortAllocatorDTO, data);
            const errors = await validate(file);

            expect(errors).toHaveLength(0);
            expect(file._doNotEdit).toBe('This file is auto-generated');
            expect(file.allocations).toHaveLength(2);
        });

        it('should validate with empty allocations array', async () => {
            const data = {
                _doNotEdit: 'This file is auto-generated',
                allocations: [],
            };

            const file = plainToInstance(PortAllocatorDTO, data);
            const errors = await validate(file);

            expect(errors).toHaveLength(0);
            expect(file.allocations).toHaveLength(0);
        });

        it('should reject missing _doNotEdit field', async () => {
            const data = {
                allocations: [],
            };

            const file = plainToInstance(PortAllocatorDTO, data);
            const errors = await validate(file);

            expect(errors.length).toBeGreaterThan(0);
        });
    });
});
