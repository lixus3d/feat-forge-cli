import { promptConfirm } from './prompt';

export type SlugResult = {
    slug: string;
    changed: boolean;
};

/**
 * Sanitize a user-provided slug to be filesystem and git-branch safe.
 */
export function sanitizeSlug(input: string, allowSlash: boolean = false): SlugResult {
    const trimmed = input.trim();
    const lowered = trimmed.toLowerCase();
    const replaceRegex = allowSlash ? /[^a-z0-9/_-]+/g : /[^a-z0-9_-]+/g;
    const replaced = lowered.replace(replaceRegex, '-');
    const collapsed = replaced.replace(/-+/g, '-');
    const cleaned = collapsed.replace(/^[.-]+/, '').replace(/[-.]+$/, '');
    const slug = cleaned;
    return { slug, changed: slug !== input };
}

/**
 * Confirm a sanitized branch name with the user if it differs.
 * Slash are allowed in branch names, but not in feature slugs, so we allow them optionally in the sanitization step and only ask for confirmation if the sanitized slug differs from the input.
 */
export async function confirmSlugOrThrow(input: string, allowSlash: boolean = true): Promise<string> {
    const { slug, changed } = sanitizeSlug(input, allowSlash);
    if (!slug) {
        throw new Error('Slug is empty after sanitization.');
    }
    if (!changed) {
        return slug;
    }

    const confirmed = await promptConfirm(`Use sanitized slug "${slug}" instead of "${input}"?`);
    if (!confirmed) {
        throw new Error('Slug confirmation declined.');
    }
    return slug;
}
