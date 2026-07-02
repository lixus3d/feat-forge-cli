import { describe, expect, it } from 'vitest';
import { ForgeError } from '@/foundation/errors/ForgeError';
import { FORGE_ERRORS } from '@/foundation/errors/_error.config';
import {
    ForgeBadStateError,
    ForgeConfigError,
    ForgeExpectMainRepositoryError,
    ForgeModeNotDefinedError,
    ForgeNotInActiveBranchError,
    ForgePortAllocationsLoadError,
    ForgePortNotAssignedError,
    ForgePortRangeExhaustedError,
    ForgeServicesScanError,
    ForgeServicesValidationError,
} from '@/foundation/errors';

describe('ForgeError', () => {
    it('should extend an existing error and preserve its stack', () => {
        const baseError = new Error('root cause');
        baseError.stack = 'stack trace';

        const error = ForgeError.extend(baseError, 'context');

        expect(error).toBeInstanceOf(ForgeError);
        expect(error.message).toBe('context\nroot cause');
        expect(error.stack).toBe('stack trace');
    });
});

describe('generated forge errors', () => {
    it('should expose generated error classes from the barrel file', () => {
        const errors = [
            new ForgeBadStateError(),
            new ForgeConfigError(),
            new ForgeExpectMainRepositoryError(),
            new ForgeModeNotDefinedError(),
            new ForgeNotInActiveBranchError(),
            new ForgePortAllocationsLoadError(),
            new ForgePortNotAssignedError(),
            new ForgePortRangeExhaustedError(),
            new ForgeServicesScanError(),
            new ForgeServicesValidationError(),
        ];

        expect(errors.map((error) => error.name)).toEqual([
            'ForgeBadStateError',
            'ForgeConfigError',
            'ForgeExpectMainRepositoryError',
            'ForgeModeNotDefinedError',
            'ForgeNotInActiveBranchError',
            'ForgePortAllocationsLoadError',
            'ForgePortNotAssignedError',
            'ForgePortRangeExhaustedError',
            'ForgeServicesScanError',
            'ForgeServicesValidationError',
        ]);
        expect(errors.map((error) => error.message)).toEqual([
            FORGE_ERRORS.ForgeBadStateError,
            FORGE_ERRORS.ForgeConfigError,
            FORGE_ERRORS.ForgeExpectMainRepositoryError,
            FORGE_ERRORS.ForgeModeNotDefinedError,
            FORGE_ERRORS.ForgeNotInActiveBranchError,
            FORGE_ERRORS.ForgePortAllocationsLoadError,
            FORGE_ERRORS.ForgePortNotAssignedError,
            FORGE_ERRORS.ForgePortRangeExhaustedError,
            FORGE_ERRORS.ForgeServicesScanError,
            FORGE_ERRORS.ForgeServicesValidationError,
        ]);
    });
});
