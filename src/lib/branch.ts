import path from 'path';

export function branchNameAsPath(branchName: string): string {
    return branchName.split('/').join(path.sep);
}
