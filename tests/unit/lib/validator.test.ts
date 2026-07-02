import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('class-transformer', () => ({
    plainToInstance: vi.fn(),
}));

vi.mock('class-validator', () => ({
    validate: vi.fn(),
}));

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validateInput } from '@/lib/validator';

class DemoInput {
    name = '';
}

describe('validateInput()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should transform data and return the validated instance', async () => {
        const instance = new DemoInput();
        instance.name = 'forge';
        vi.mocked(plainToInstance).mockReturnValue(instance);
        vi.mocked(validate).mockResolvedValue([]);

        const result = await validateInput(DemoInput, { name: 'forge' }, { forbidNonWhitelisted: true });

        expect(plainToInstance).toHaveBeenCalledWith(DemoInput, { name: 'forge' });
        expect(validate).toHaveBeenCalledWith(instance, {
            whitelist: true,
            validationError: { target: true, value: true },
            forbidNonWhitelisted: true,
        });
        expect(result).toBe(instance);
    });

    it('should throw a detailed error when validation fails', async () => {
        const instance = new DemoInput();
        const errors = [{ property: 'name', constraints: { isString: 'must be a string' } }];
        vi.mocked(plainToInstance).mockReturnValue(instance);
        vi.mocked(validate).mockResolvedValue(errors as any);

        await expect(validateInput(DemoInput, { name: 42 })).rejects.toThrow(
            `Invalid DemoInput file :\n${JSON.stringify(errors, null, 2)}`,
        );
    });
});
