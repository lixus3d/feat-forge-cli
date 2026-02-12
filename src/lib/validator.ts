import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

export async function validateInput<T extends Object>(classTransformerClass: new () => T, data: any): Promise<T> {
    // Validate and transform using class-validator and class-transformer
    const extractedInstance = plainToInstance(classTransformerClass, data);
    const errors = await validate(extractedInstance, {
        whitelist: true,
        forbidNonWhitelisted: true,
        validationError: { target: true, value: true },
    });

    if (errors.length > 0) {
        throw new Error(`Invalid ${classTransformerClass.name} file :\n${JSON.stringify(errors, null, 2)}`);
    }
    return extractedInstance;
}
