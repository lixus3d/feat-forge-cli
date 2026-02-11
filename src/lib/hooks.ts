/**
 * Available hook event types that can be triggered throughout the forge lifecycle.
 * Each event can have multiple hooks (e.g., postBranchStart.sh, postBranchStart_01.sh).
 */
export enum HookEvent {
    /** Triggered after a branch is started */
    POST_BRANCH_START = 'postBranchStart',
    /** Triggered before a merge operation */
    PRE_MERGE = 'preMerge',
    /** Triggered after a merge operation */
    POST_MERGE = 'postMerge',
    /** Triggered before stopping a branch */
    PRE_STOP = 'preStop',
    /** Triggered before a rebase operation */
    PRE_REBASE = 'preRebase',
    /** Triggered after a rebase operation */
    POST_REBASE = 'postRebase',
    /** Triggered after refreshing agent context files */
    POST_REFRESH_AGENTS = 'postRefreshAgents',
}

