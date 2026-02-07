import { IDEName } from './IDEName';

/**
 * Resolved IDE configuration
 */
export type IDE = {
    name: IDEName;
    createWorkspace: boolean;
    settings?: Record<string, unknown>;
    openCommand?: string;
};
