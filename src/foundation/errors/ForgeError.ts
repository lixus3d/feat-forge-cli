export class ForgeError extends Error {
    static extend(error: any, message?: string) {
        const forgeError = new this(`${message ? message + '\n' : ''}${error.message}`);
        if (error.stack) {
            forgeError.stack = error.stack;
        }
        return forgeError;
    }
}
