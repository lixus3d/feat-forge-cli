import { describe, it, expect, beforeEach } from 'vitest';
import { PortAllocator, PortAllocation } from '@/foundation/PortAllocator';

function createAllocator(config = { servicesBasePort: 3000, branchRangeSize: 100 }): PortAllocator {
    return new PortAllocator(new Map(), '/test/path', config);
}

describe('PortAllocator', () => {
    describe('allocatePorts', () => {
        it('should allocate ports for a new branch', () => {
            const allocator = createAllocator();
            const result = allocator.allocatePorts('main', ['backend', 'frontend']);

            expect(result.start).toBe(3000);
            expect(result.end).toBe(3099);
            expect(result.assignedPorts['backend']).toBe(3000);
            expect(result.assignedPorts['frontend']).toBe(3001);
        });

        it('should allocate ports for a second branch', () => {
            const allocator = createAllocator();

            // First branch
            allocator.allocatePorts('main', ['service1']);

            // Second branch
            const result = allocator.allocatePorts('feature/auth', ['service1']);

            expect(result.start).toBe(3100);
            expect(result.end).toBe(3199);
            expect(result.assignedPorts['service1']).toBe(3100);
        });

        it('should throw error when port range is exhausted', () => {
            const allocator = createAllocator({ servicesBasePort: 3000, branchRangeSize: 2 });

            // This should work
            allocator.allocatePorts('main', ['service1', 'service2']);

            // This should fail - trying to allocate more than available
            expect(() => {
                allocator.allocatePorts('main', ['service3']);
            }).toThrow('Port range exhausted');
        });

        it('should allocate sequential ports for multiple services', () => {
            const allocator = createAllocator();
            const result = allocator.allocatePorts('main', ['api', 'frontend', 'worker']);

            expect(result.assignedPorts['api']).toBe(3000);
            expect(result.assignedPorts['frontend']).toBe(3001);
            expect(result.assignedPorts['worker']).toBe(3002);
        });
    });

    describe('getBranchAllocation', () => {
        it('should return undefined for non-existent branch', () => {
            const allocator = createAllocator();
            const result = allocator.getBranchAllocation('feature/nonexistent');

            expect(result).toBeUndefined();
        });

        it('should return allocation after allocating ports', () => {
            const allocator = createAllocator();
            allocator.allocatePorts('main', ['service1']);

            const result = allocator.getBranchAllocation('main');

            expect(result).toBeDefined();
            expect(result?.start).toBe(3000);
            expect(result?.end).toBe(3099);
            expect(result?.usedUntil).toBe(3001);
        });
    });

    describe('getConfig', () => {
        it('should return base configuration', () => {
            const allocator = createAllocator();
            const config = allocator.getConfig();

            expect(config.servicesBasePort).toBe(3000);
            expect(config.rangeSize).toBe(100);
        });
    });

    describe('persistent port allocation', () => {
        it('should reuse the same port for an existing service on re-scan', () => {
            const allocator = createAllocator();

            // First scan: allocate ports for services
            const result1 = allocator.allocatePorts('feature/auth', ['backend', 'frontend']);
            expect(result1.assignedPorts['backend']).toBe(3000);
            expect(result1.assignedPorts['frontend']).toBe(3001);

            // Second scan: same services should get the same ports
            const result2 = allocator.allocatePorts('feature/auth', ['backend', 'frontend']);
            expect(result2.assignedPorts['backend']).toBe(3000);
            expect(result2.assignedPorts['frontend']).toBe(3001);

            // usedUntil should not have incremented
            const allocation = allocator.getBranchAllocation('feature/auth');
            expect(allocation?.usedUntil).toBe(3002);
        });

        it('should assign new port for a new service on re-scan', () => {
            const allocator = createAllocator();

            // First scan: allocate ports
            const result1 = allocator.allocatePorts('feature/auth', ['backend', 'frontend']);
            expect(result1.assignedPorts['backend']).toBe(3000);
            expect(result1.assignedPorts['frontend']).toBe(3001);

            // Second scan: add a new service
            const result2 = allocator.allocatePorts('feature/auth', ['backend', 'frontend', 'worker']);
            expect(result2.assignedPorts['backend']).toBe(3000);
            expect(result2.assignedPorts['frontend']).toBe(3001);
            expect(result2.assignedPorts['worker']).toBe(3002); // New port
        });

        it('should handle removing services between scans', () => {
            const allocator = createAllocator();

            // First scan: allocate ports for 3 services
            const result1 = allocator.allocatePorts('feature/auth', ['backend', 'frontend', 'worker']);
            expect(result1.assignedPorts['backend']).toBe(3000);
            expect(result1.assignedPorts['frontend']).toBe(3001);
            expect(result1.assignedPorts['worker']).toBe(3002);

            // Second scan: remove middle service, only request backend and worker
            const result2 = allocator.allocatePorts('feature/auth', ['backend', 'worker']);
            expect(result2.assignedPorts['backend']).toBe(3000);
            expect(result2.assignedPorts['worker']).toBe(3002);
        });

        it('should handle mix of existing and new services', () => {
            const allocator = createAllocator();

            // First scan: api, db, cache
            const result1 = allocator.allocatePorts('main', ['api', 'db', 'cache']);
            expect(result1.assignedPorts['api']).toBe(3000);
            expect(result1.assignedPorts['db']).toBe(3001);
            expect(result1.assignedPorts['cache']).toBe(3002);

            // Second scan: db, cache, redis (removed api, added redis)
            const result2 = allocator.allocatePorts('main', ['db', 'cache', 'redis']);
            expect(result2.assignedPorts['db']).toBe(3001);
            expect(result2.assignedPorts['cache']).toBe(3002);
            expect(result2.assignedPorts['redis']).toBe(3003); // New port
        });
    });
});
