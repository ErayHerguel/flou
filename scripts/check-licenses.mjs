// Prüft die Lizenzen aller ausgelieferten npm-Pakete und Rust-Crates gegen eine Freigabeliste.
// Aufruf: npm run licenses
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

/** Pakete ohne Lizenzfeld: MIT anhand der mitgelieferten Lizenzdatei erkennen. */
function licenseFromFile(dir) {
  const file = readdirSync(dir).find((f) => /^licen[cs]e/i.test(f));
  if (!file) return 'UNBEKANNT';
  const text = readFileSync(join(dir, file), 'utf8');
  return /Permission is hereby granted, free of charge/i.test(text) ? 'MIT' : 'UNBEKANNT';
}
import { join } from 'node:path';

const ALLOWED = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MPL-2.0', '0BSD', 'Zlib', 'Unicode-3.0', 'Unicode-DFS-2016', 'CC0-1.0', 'Unlicense', 'BSL-1.0'];
// Schriftart Inter: SIL Open Font License (frei, kostenlos, Bündeln erlaubt)
const ALLOWED_FONTS = ['OFL-1.1'];

/** Ein SPDX-Ausdruck ist erlaubt, wenn bei "OR" eine Variante und bei "AND" alle erlaubt sind. */
function allowed(expression, extra = []) {
  const list = [...ALLOWED, ...extra];
  const clean = expression.replace(/[()]/g, '').trim();
  if (clean.includes(' OR ')) return clean.split(' OR ').some((part) => allowed(part, extra));
  if (clean.includes(' AND ')) return clean.split(' AND ').every((part) => allowed(part, extra));
  return list.includes(clean.replace(/\/.*/, '').trim()) || clean.split('/').some((p) => list.includes(p.trim()));
}

/**
 * Pakete, die zwar installiert, aber nicht ausgeliefert werden. Das wird am gebauten Bundle geprüft:
 * kommt der Marker in dist/ vor, gilt die Ausnahme nicht.
 */
const NOT_SHIPPED = {
  argparse: { marker: 'ArgumentParser', reason: 'nur von der Kommandozeile von markdown-it genutzt' },
};

let problems = 0;

function shippedMarker(marker) {
  if (!existsSync('dist/assets')) throw new Error('Bitte zuerst "npm run build" ausführen (dist/ fehlt).');
  return readdirSync('dist/assets')
    .filter((f) => f.endsWith('.js'))
    .some((f) => readFileSync(join('dist/assets', f), 'utf8').includes(marker));
}

// npm: nur installierte Produktionsabhängigkeiten (das, was im App-Bundle landet)
/** npm ls meldet bei Überschreibungen (overrides) einen Fehlercode; die Liste ist trotzdem vollständig. */
function npmList() {
  try {
    return execSync('npm ls --omit=dev --all --parseable', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (err) {
    if (typeof err.stdout === 'string' && err.stdout) return err.stdout;
    throw err;
  }
}
const paths = npmList()
  .split('\n')
  .filter((p) => p.includes('node_modules'));
const seen = new Map();
for (const dir of paths) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const license = typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? licenseFromFile(dir));
  seen.set(`${pkg.name}@${pkg.version}`, license);
}
for (const [name, license] of seen) {
  if (allowed(license, name.startsWith('@fontsource') ? ALLOWED_FONTS : [])) continue;
  const exception = NOT_SHIPPED[name.slice(0, name.lastIndexOf('@'))];
  if (exception && !shippedMarker(exception.marker)) {
    console.log(`– npm ${name}: ${license} (nicht im Bundle: ${exception.reason})`);
    continue;
  }
  console.log(`✗ npm ${name}: ${license}`);
  problems++;
}
console.log(`npm: ${seen.size} Pakete geprüft`);

// Rust: alle Crates des Release-Builds
const env = { ...process.env, PATH: `${process.env.HOME}/.cargo/bin:${process.env.PATH}` };
const metadata = JSON.parse(
  execSync('cargo metadata --format-version 1 --manifest-path src-tauri/Cargo.toml --filter-platform aarch64-apple-darwin', {
    encoding: 'utf8',
    env,
    maxBuffer: 64 * 1024 * 1024,
  }),
);
const used = new Set(metadata.resolve.nodes.map((n) => n.id));
let crates = 0;
for (const pkg of metadata.packages) {
  if (!used.has(pkg.id) || pkg.source === null) continue;
  crates++;
  if (!pkg.license || !allowed(pkg.license)) {
    console.log(`✗ crate ${pkg.name} ${pkg.version}: ${pkg.license ?? 'UNBEKANNT'}`);
    problems++;
  }
}
console.log(`Rust: ${crates} Crates geprüft`);

if (problems) {
  console.log(`${problems} Lizenz(en) außerhalb der Freigabeliste`);
  process.exit(1);
}
console.log('Alle Lizenzen erlaubt.');
