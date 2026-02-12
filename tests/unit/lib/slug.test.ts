import { slugify } from '@/lib/slug';

describe('slugify', () => {
    it('should return the same slug if it is already valid', () => {
        const result = slugify('valid-slug');
        expect(result).toBe('valid-slug');
    });

    it('should trim whitespace and convert to lowercase', () => {
        const result = slugify('  Valid Slug  ');
        expect(result).toBe('valid-slug');
    });

    it('should replace invalid characters with hyphens', () => {
        const result = slugify('Invalid@Slug#With$Special%Chars!');
        expect(result).toBe('invalid-slug-with-special-chars');
    });

    it('should collapse multiple hyphens into one', () => {
        const result = slugify('Multiple---Hyphens--Here');
        expect(result).toBe('multiple-hyphens-here');
    });

    it('should remove leading and trailing hyphens and dots', () => {
        const result = slugify('---.LeadingAndTrailing.-');
        expect(result).toBe('leadingandtrailing');
    });

    it('should return an empty slug if all characters are invalid', () => {
        const result = slugify('!!!');
        expect(result).toBe('');
    });

    it('should allow slashes if allowSlash is true', () => {
        const result = slugify('valid/slug_with-underscores', true);
        expect(result).toBe('valid/slug_with-underscores');
    });

    it('should replace hyphens with underscores if hyphenToUnderscore is true', () => {
        const result = slugify('valid-slug-with-hyphens', false, true);
        expect(result).toBe('valid_slug_with_hyphens');
    });
});
