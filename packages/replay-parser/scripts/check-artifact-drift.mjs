// Fails when the checked-in artifact in pkg/ no longer behaves like a build of
// the current source. Compares behaviour, not bytes: Rust/WASM builds are not
// reproducible across machines or compiler versions, so a hash comparison would
// go red on every runner update without anything being wrong.
//
// Blind spot, accepted: a source change that only alters behaviour for inputs
// the fixture doesn't cover passes unnoticed.
import { readFile } from 'node:fs/promises';

const FIXTURE = new URL('../tests/fixtures/Burrow.SC2Replay', import.meta.url);

async function parseWith(pkgDir) {
	const module = await import(new URL(`../${pkgDir}/replay_parser.js`, import.meta.url));
	const wasmBytes = await readFile(new URL(`../${pkgDir}/replay_parser_bg.wasm`, import.meta.url));
	module.initSync({ module: wasmBytes });
	return module.parse(new Uint8Array(await readFile(FIXTURE)));
}

const [checkedIn, freshBuild] = await Promise.all([parseWith('pkg'), parseWith('pkg-ci')]);

if (JSON.stringify(checkedIn) !== JSON.stringify(freshBuild)) {
	console.error('Checked-in pkg/ has drifted from the current source.\n');
	console.error('pkg/    :', JSON.stringify(checkedIn, null, 2));
	console.error('pkg-ci/ :', JSON.stringify(freshBuild, null, 2));
	console.error('\nRebuild and commit pkg/ — see packages/replay-parser/README.md.');
	process.exit(1);
}

console.log('pkg/ matches a fresh build of the current source.');
