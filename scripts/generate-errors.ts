import { FORGE_ERRORS } from '@/foundation/errors/_error.config';
import { ensureDir, pathExists } from '@/lib/fs';
import { rm, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GENERATED_FOLDER = 'generated';

(async () => {
    // 1. clean the generated errors folder - we will regenerate all errors from the config, so we can safely delete all existing ones
    const generatedFolder = path.join(__dirname, '../src/foundation/errors/', GENERATED_FOLDER);
    if (await pathExists(generatedFolder)) {
        await rm(generatedFolder, { recursive: true, force: true });
        console.log(`🧹 Cleaned existing generated errors in ${generatedFolder}`);
    }
    await ensureDir(generatedFolder);

    // 2. validate error names
    Object.keys(FORGE_ERRORS).forEach((key) => {
        if (!/^[A-Z][A-Za-z0-9]+$/.test(key)) {
            throw new Error(`Invalid error name '${key}'. Error names must be in PascalCase and start with an uppercase letter.`);
        }
    });

    // 3. generate error classes
    await Promise.all(
        Object.keys(FORGE_ERRORS).map(async (key) => {
            const output = `// THIS FILE IS AUTO-GENERATED - DO NOT EDIT
// Run 'pnpm generate:errors' to regenerate
// Edit .errors.config.ts to add/remove errors
import { ForgeError } from '../ForgeError';
import { FORGE_ERRORS } from '../_error.config';

export class ${key} extends ForgeError {
    constructor(message?: string) {
        super(message || FORGE_ERRORS.${key});
        this.name = '${key}';
    }
}
`;
            const outputPath = path.join(generatedFolder, `${key}.ts`);
            // write the error class file
            await writeFile(outputPath, output, 'utf-8');
        }),
    );

    // 4. generate index.ts that exports all errors
    const output = `// THIS FILE IS AUTO-GENERATED - DO NOT EDIT
// Run 'pnpm generate:errors' to regenerate
// Edit .errors.config.ts to add/remove errors
${Object.keys(FORGE_ERRORS)
    .map((key) => `export { ${key} } from './${GENERATED_FOLDER}/${key}';`)
    .join('\n')}
`;
    const indexPath = path.join(generatedFolder, '..', `index.ts`);
    await writeFile(indexPath, output, 'utf-8');

    console.log(`✅ Successfully generated ${Object.keys(FORGE_ERRORS).length} error classes in ${generatedFolder}`);
})().catch((err) => {
    console.error('❌ Error generating error classes:', err);
    process.exit(1);
});
