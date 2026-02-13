import { unwatchFile } from 'fs';
import { promptConfirm } from './prompt';

/**
 * Slugify a user-provided input to be filesystem and git-branch safe.
 */
export function slugify(input: string, allowSlash: boolean = false, hyphenToUnderscore: boolean = false): string {
    const trimmed = input.trim();
    let lowered = trimmed.toLowerCase();
    let allowedChars = allowSlash ? 'a-z0-9/_-' : 'a-z0-9_-';
    if (hyphenToUnderscore) {
        lowered = lowered.replace(/-/g, '_');
    }
    const replaceRegex = new RegExp(`[^${allowedChars}]+`, 'g');
    const replaced = lowered.replace(replaceRegex, '-');
    const collapsed = replaced.replace(/-+/g, '-');
    const cleaned = collapsed.replace(/^[.-]+/, '').replace(/[-.]+$/, '');
    return cleaned;
}

/**
 * Confirm a slugified input with the user if it differs.
 * Slash are allowed in branch names, but not in feature slugs, so we allow them optionally in the slugification step and only ask for confirmation if the slugified result differs from the input.
 */
export async function confirmSlugOrThrow(input: string, allowSlash: boolean = true): Promise<string> {
    const slug = slugify(input, allowSlash);
    if (!slug) {
        throw new Error('Slug is empty after slugification.');
    }
    if (slug === input) {
        return slug;
    }

    const confirmed = await promptConfirm(`Use slugified input "${slug}" instead of "${input}"?`);
    if (!confirmed) {
        throw new Error('Slug confirmation declined.');
    }
    return slug;
}
