import { afterEach, describe, expect, it } from 'vitest';
import { paramsToEnv } from '@/lib/env';
import { getScriptExtension, isWindows } from '@/lib/platform';

const originalPlatform = process.platform;

describe('platform helpers', () => {
    afterEach(() => {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should detect Windows and use .bat scripts', () => {
        Object.defineProperty(process, 'platform', { value: 'win32' });

        expect(isWindows()).toBe(true);
        expect(getScriptExtension()).toBe('.bat');
    });

    it('should detect non-Windows platforms and use .sh scripts', () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });

        expect(isWindows()).toBe(false);
        expect(getScriptExtension()).toBe('.sh');
    });
});

describe('paramsToEnv()', () => {
    it('should return an empty object when params are missing or empty', () => {
        expect(paramsToEnv()).toEqual({});
        expect(paramsToEnv({})).toEqual({});
    });

    it('should convert values to FORGE_HOOK environment variables', () => {
        expect(
            paramsToEnv({
                branch: 'feature/test',
                port: 3000,
                enabled: false,
                'service-name': 'api',
                skippedNull: null,
                skippedUndefined: undefined,
            }),
        ).toEqual({
            FORGE_HOOK_BRANCH: 'feature/test',
            FORGE_HOOK_PORT: '3000',
            FORGE_HOOK_ENABLED: 'false',
            FORGE_HOOK_SERVICE_NAME: 'api',
        });
    });
});
