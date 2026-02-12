// THIS FILE IS AUTO-GENERATED - DO NOT EDIT
// Run 'pnpm generate:errors' to regenerate
// Edit .errors.config.ts to add/remove errors
import { ForgeError } from '../ForgeError';
import { FORGE_ERRORS } from '../_error.config';

export class ForgePortNotAssignedError extends ForgeError {
    constructor(message?: string) {
        super(message || FORGE_ERRORS.ForgePortNotAssignedError);
        this.name = 'ForgePortNotAssignedError';
    }
}
