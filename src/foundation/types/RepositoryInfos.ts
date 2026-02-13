export type RepoName = string;
export type RepoPath = string;

export type RepositoryInfos = {
    name: RepoName;
    path: RepoPath;
    main: boolean;
    copyFiles?: string[];
};
