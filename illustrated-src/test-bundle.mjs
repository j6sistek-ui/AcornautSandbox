#!/usr/bin/env node
// Check the files players actually load, including the unversioned fallback.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const docs = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const mirror = join(docs, 'js');
const version = readFileSync(join(mirror, 'catalog.js'), 'utf8').match(/ART_VER = "(\d+)"/)?.[1];
assert(version, 'export the game before running the bundle gate');
const stamped = join(docs, `js${version}`);
const files = readdirSync(mirror).filter(f => f.endsWith('.js')).sort();
assert.deepEqual(files, readdirSync(stamped).filter(f => f.endsWith('.js')).sort());
for (const file of files) {
  const code = readFileSync(join(mirror, file), 'utf8');
  assert.equal(code, readFileSync(join(stamped, file), 'utf8'), `${file}: fallback differs from the stamped bundle`);
  for (const [, ref] of code.matchAll(/\bfrom\s+["'](\.\/[^"']+)["']/g)) {
    const target = ref.split('?')[0];
    assert(target.endsWith('.js'), `${file}: browser cannot resolve extensionless import ${ref}`);
    assert(existsSync(join(mirror, target)), `${file}: missing module ${ref}`);
    assert.equal(ref.split('?')[1], `v=${version}`, `${file}: import uses an old build stamp`);
  }
}
assert(readFileSync(join(docs, 'index.html'), 'utf8').includes(`import("./js${version}/standalone.js")`));
assert(readFileSync(join(docs, 'beta/index.html'), 'utf8').includes(`import("../js${version}/standalone.js")`));
console.log(`bundle: ${files.length} matching modules, resolvable imports, production/beta stamp ${version}`);
