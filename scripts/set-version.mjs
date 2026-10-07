// Setzt die Versionsnummer in package.json, tauri.conf.json und Cargo.toml.
// Aufruf: npm run version:set -- 1.0.1
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('Bitte eine Version wie 1.0.1 angeben');
  process.exit(1);
}
const json = (path, update) => {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  update(data);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
};
json('package.json', (d) => (d.version = version));
json('src-tauri/tauri.conf.json', (d) => (d.version = version));
const cargo = readFileSync('src-tauri/Cargo.toml', 'utf8').replace(/^version = ".*"$/m, `version = "${version}"`);
writeFileSync('src-tauri/Cargo.toml', cargo);
console.log(`Version ${version} gesetzt. Jetzt committen und taggen: git tag v${version} && git push --tags`);
