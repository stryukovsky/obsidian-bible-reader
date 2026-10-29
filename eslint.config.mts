import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'dist',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json', 'scripts/*.mjs', 'tests/*.mjs'], maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 16,
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
 { rules: {
  'obsidianmd/ui/sentence-case': ['warn', { brands: ['Bible', 'Bookmarks', 'Settings', 'Core plugins', 'Synodal', 'Markdown', 'SWORD', 'CrossWire', 'King James Version', 'Strong’s', 'MiB', 'Crown', 'United Kingdom', 'About', 'zText', 'RawText'], acronyms: ['ZIP', 'KJV', 'GPL', 'API'] }],
 } },
 // Build and test tooling runs in Node; the plugin runtime remains browser-compatible.
 { files: ['scripts/*.mjs', 'tests/*.mjs'], languageOptions: { globals: globals.node }, rules: { 'obsidianmd/no-nodejs-modules': 'off', 'obsidianmd/no-global-this': 'off', 'no-unsanitized/method': 'off' } },
);
