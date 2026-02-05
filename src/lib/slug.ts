import { promptConfirm } from './prompt';

export type SlugResult = {
    slug: string;
    changed: boolean;
};

/**
 * Sanitize a user-provided slug to be filesystem and git-branch safe.
 */
export function sanitizeSlug(input: string): SlugResult {
    const trimmed = input.trim();
    const lowered = trimmed.toLowerCase();
    const replaced = lowered.replace(/[^a-z0-9-_]+/g, '-');
    const collapsed = replaced.replace(/-+/g, '-');
    const cleaned = collapsed.replace(/^[.-]+/, '').replace(/[-.]+$/, '');
    const slug = cleaned;
    return { slug, changed: slug !== input };
}

/**
 * Confirm a sanitized slug with the user if it differs.
 */
export async function confirmSlugOrThrow(input: string): Promise<string> {
    const { slug, changed } = sanitizeSlug(input);
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
