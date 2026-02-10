import { sanitizeSlug } from '@/lib/slug';

describe('sanitizeSlug', () => {
    it('should return the same slug if it is already valid', () => {
        const result = sanitizeSlug('valid-slug');
        expect(result.slug).toBe('valid-slug');
        expect(result.changed).toBe(false);
    });

    it('should trim whitespace and convert to lowercase', () => {
        const result = sanitizeSlug('  Valid Slug  ');
        expect(result.slug).toBe('valid-slug');
        expect(result.changed).toBe(true);
    });

    it('should replace invalid characters with hyphens', () => {
        const result = sanitizeSlug('Invalid@Slug#With$Special%Chars!');
        expect(result.slug).toBe('invalid-slug-with-special-chars');
        expect(result.changed).toBe(true);
    });

    it('should collapse multiple hyphens into one', () => {
        const result = sanitizeSlug('Multiple---Hyphens--Here');
        expect(result.slug).toBe('multiple-hyphens-here');
        expect(result.changed).toBe(true);
    });

    it('should remove leading and trailing hyphens and dots', () => {
        const result = sanitizeSlug('---.LeadingAndTrailing.-');
        expect(result.slug).toBe('leadingandtrailing');
        expect(result.changed).toBe(true);
    });

    it('should return an empty slug if all characters are invalid', () => {
        const result = sanitizeSlug('!!!');
        expect(result.slug).toBe('');
        expect(result.changed).toBe(true);
    });

    it('should allow slashes and underscores', () => {
        const result = sanitizeSlug('valid/slug_with-underscores');
        expect(result.slug).toBe('valid/slug_with-underscores');
        expect(result.changed).toBe(false);
    });
});
