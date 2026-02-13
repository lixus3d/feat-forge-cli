import { plainToInstance } from 'class-transformer';
import { validate, ValidatorOptions } from 'class-validator';

export async function validateInput<T extends Object>(
    classTransformerClass: new () => T,
    data: any,
    options?: ValidatorOptions,
): Promise<T> {
    // Validate and transform using class-validator and class-transformer
    const extractedInstance = plainToInstance(classTransformerClass, data);
    const errors = await validate(extractedInstance, {
        whitelist: true,
        validationError: { target: true, value: true },
        ...options,
    });

    if (errors.length > 0) {
        throw new Error(`Invalid ${classTransformerClass.name} file :\n${JSON.stringify(errors, null, 2)}`);
    }
    return extractedInstance;
}
