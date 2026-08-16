// Post-build guard: fails the build if any emitted CSS contains the
// CSS Media Queries Level 4 range syntax (e.g. `width<=768px`) that
// lightningcss emits and that some browsers silently mis-parse.
//
// Wired into the `build` script via `&&`. Exits 0 on success, 1 on failure.
//
// If this guard fires, two likely causes:
//   1. `build.cssMinify` in vite.config.js was reverted to 'lightningcss'.
//      Re-apply `cssMinify: 'esbuild'` (or set explicit lightningcss targets).
//   2. A new Vite version changed the default CSS minifier again. Audit
//      vite.config.js and pin the explicit `cssMinify` setting.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist', 'assets');
const badRangeSyntax = /@media\s*\([^)]*width\s*[<>]=?\s*\d/i;
const badHeightSyntax = /@media\s*\([^)]*height\s*[<>]=?\s*\d/i;

let failures = 0;

for (const file of readdirSync(distDir)) {
  if (!file.endsWith('.css')) continue;
  const path = join(distDir, file);
  const size = statSync(path).size;
  const css = readFileSync(path, 'utf8');

  const rangeHit = badRangeSyntax.test(css) || badHeightSyntax.test(css);
  if (rangeHit) {
    console.error(`[postbuild-check] FAIL  ${file} (${size} bytes)`);
    console.error('  Found MQ Level 4 range syntax (width<=Npx or height<=Npx).');
    console.error('  This breaks older browsers. Switch build.cssMinify in vite.config.js to esbuild.');
    failures++;
  } else {
    console.log(`[postbuild-check] OK    ${file} (${size} bytes)`);
  }
}

if (failures > 0) {
  console.error(`\n[postbuild-check] ${failures} file(s) failed.`);
  process.exit(1);
}
console.log('[postbuild-check] All CSS files passed.');
