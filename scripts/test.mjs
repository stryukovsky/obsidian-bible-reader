import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const folder = await mkdtemp(join(tmpdir(), 'bible-reader-tests-'));
try {
 const outfile = join(folder, 'reader.mjs');
 await build({ entryPoints: ['tests/exports.ts'], outfile, bundle: true, platform: 'browser', format: 'esm', target: 'es2021' });
 const viewfile = join(folder, 'view.mjs');
 await build({ entryPoints: ['tests/view-exports.ts'], outfile: viewfile, bundle: true, platform: 'browser', format: 'esm', target: 'es2021', alias: { obsidian: resolve('tests/obsidian-mock.mjs') } });
 const result = spawnSync(process.execPath, ['--import', pathToFileURL(resolve('tests/setup.mjs')).href, '--test', '--test-isolation=none', 'tests/core.test.mjs', 'tests/state.test.mjs', 'tests/library.test.mjs', 'tests/git.test.mjs', 'tests/view.test.mjs', 'tests/markdown.test.mjs', 'tests/synodal.test.mjs', 'tests/scroll.test.mjs', 'tests/history.test.mjs', 'tests/bookmarks.test.mjs'], {
  stdio: 'inherit', env: { ...process.env, BIBLE_TEST_BUNDLE: pathToFileURL(outfile).href, BIBLE_VIEW_BUNDLE: pathToFileURL(viewfile).href },
 });
 process.exitCode = result.status ?? 1;
} finally { await rm(folder, { recursive: true, force: true }); }
