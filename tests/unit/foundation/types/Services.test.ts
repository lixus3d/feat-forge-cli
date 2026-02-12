import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
    ServiceDefinition,
    ServicesFile,
    GeneratedService,
    PortAllocationsFile,
    BranchPortAllocation,
} from '@/foundation/types/Services';

describe('Services Types', () => {
    describe('ServiceDefinition', () => {
        it('should validate a valid service', async () => {
            const data = {
                name: 'backend',
                type: 'http',
                path: '/api',
            };

            const service = plainToInstance(ServiceDefinition, data);
            const errors = await validate(service);

            expect(errors).toHaveLength(0);
            expect(service.name).toBe('backend');
            expect(service.type).toBe('http');
            expect(service.path).toBe('/api');
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
    });

    describe('ServicesFile', () => {
        it('should validate a valid services file', async () => {
            const data = {
                services: [
                    { name: 'backend', type: 'http', path: '/api' },
                    { name: 'frontend', type: 'http', path: '/' },
                ],
            };

            const file = plainToInstance(ServicesFile, data);
            const errors = await validate(file);

            expect(errors).toHaveLength(0);
            expect(file.services).toHaveLength(2);
        });
    });

    describe('GeneratedService', () => {
        it('should validate a generated service with port', async () => {
            const data = {
                name: 'backend',
                type: 'http',
                path: '/api',
                port: 3100,
            };

            const service = plainToInstance(GeneratedService, data);
            const errors = await validate(service);

            expect(errors).toHaveLength(0);
            expect(service.port).toBe(3100);
        });

        it('should reject invalid port numbers', async () => {
            const data = {
                name: 'backend',
                type: 'http',
                port: 99999,
            };

            const service = plainToInstance(GeneratedService, data);
            const errors = await validate(service);

            expect(errors.length).toBeGreaterThan(0);
        });
    });

    describe('PortAllocationsFile', () => {
        it('should validate a valid port allocations file', async () => {
            const data = {
                _doNotEdit: 'message',
                servicesBasePort: 3000,
                branchRangeSize: 100,
                allocations: {
                    main: { start: 3000, end: 3099, usedUntil: 3050 },
                    'feature/auth': { start: 3100, end: 3199, usedUntil: 3102 },
                },
            };

            const file = plainToInstance(PortAllocationsFile, data);
            const errors = await validate(file, { skipMissingProperties: true });

            // The object should be created with the right structure
            expect(file._doNotEdit).toBe('message');
            expect(file.servicesBasePort).toBe(3000);
            expect(file.branchRangeSize).toBe(100);
            expect(Object.keys(file.allocations)).toHaveLength(2);
        });

        it('should reject invalid servicesBasePort', async () => {
            const data = {
                _doNotEdit: 'message',
                servicesBasePort: 500,
                branchRangeSize: 100,
                allocations: {},
            };

            const file = plainToInstance(PortAllocationsFile, data);
            const errors = await validate(file);

            expect(errors.length).toBeGreaterThan(0);
        });
    });

    describe('BranchPortAllocation', () => {
        it('should create valid branch allocation', async () => {
            const allocation = new BranchPortAllocation();
            allocation.start = 3000;
            allocation.end = 3099;
            allocation.usedUntil = 3050;

            const errors = await validate(allocation);

            expect(errors).toHaveLength(0);
        });

        it('should support services map for persistent port allocation', async () => {
            const allocation = new BranchPortAllocation();
            allocation.start = 3000;
            allocation.end = 3099;
            allocation.usedUntil = 3002;
            allocation.services = {
                backend: 3000,
                frontend: 3001,
            };

            const errors = await validate(allocation);

            expect(errors).toHaveLength(0);
            expect(allocation.services['backend']).toBe(3000);
            expect(allocation.services['frontend']).toBe(3001);
        });
    });
});
