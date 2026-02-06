import { AIAgentName } from './AIAgentName';

/**
 * Resolved agent configuration
 */
export type AIAgent = {
    name: AIAgentName | string | null;
    agentFile: string;
    requiresIDEConfig: boolean;
    settings?: Record<string, unknown>;
};
