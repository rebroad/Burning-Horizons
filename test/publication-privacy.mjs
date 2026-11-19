import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { loadPrivateTerms, privacyFindings, scanPublicationTree, publicationPrivacyCheck } from '../tools/publication-privacy.mjs';

const ip = (...octets) => octets.join('.');
function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'publication-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const root = path.join(temp, 'repo');
  fs.mkdirSync(root);
  const write = (rel, text = '') => {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    return file;
  };
  return { temp, root, write };
}

test('generic private ranges, tailnet and home/machine paths are detected without literal identities', () => {
  for (const address of [ip(10, 4, 5, 6), ip(172, 16, 0, 1), ip(172, 31, 255, 254), ip(192, 168, 2, 3)]) assert.deepEqual(privacyFindings(address), ['private environment reference']);
  for (const value of ['demo.' + 'tailfixture.' + 'ts.net', ['C:', 'Users', 'FixturePerson'].join('\\'), '/' + ['home', 'fixture-person'].join('/'), ['\\\\fixture-machine', 'share', 'file'].join('\\')]) assert.deepEqual(privacyFindings(value), ['private environment reference']);
  for (const value of [ip(127, 0, 0, 1), ip(203, 0, 113, 30), ip(172, 15, 0, 1), ip(172, 32, 0, 1), ip(10, 999, 0, 1), 'localhost', 'example.invalid']) assert.deepEqual(privacyFindings(value), []);
});

test('credential signatures remain enforced', () => {
  assert.deepEqual(privacyFindings('gh' + 'p_' + 'x'.repeat(35)), ['possible credential']);
  assert.deepEqual(privacyFindings('-----BEGIN ' + 'PRIVATE KEY-----'), ['possible credential']);
});

test('filenames, additional text formats and guard itself are scanned; runtime paths are deliberately excluded', t => {
  const { root, write } = fixture(t);
  write('tools/check-publication.mjs', ip(10, 5, 6, 7));
  write('settings.toml', ip(172, 20, 1, 1));
  for (const extension of ['go', 'rs', 'c', 'cpp', 'h', 'hpp', 'mod', 'sum', 'lock', 'cfg']) write('extra.' + extension, ip(10, 5, 6, 7));
  write(ip(192, 168, 5, 6) + '.bin');
  write('node_modules/dependency.js', ip(10, 1, 1, 1));
  write('artifacts/network/capture.txt', ip(10, 1, 1, 1));
  write('dist/index.html', ip(10, 1, 1, 1));
  write('.git/config', ip(10, 1, 1, 1));
  const result = scanPublicationTree(root);
  assert.equal(result.files, 13);
  assert.equal(result.textFiles, 12);
  assert.equal(result.issues.length, 13);
  assert.ok(result.issues.some(issue => issue.startsWith('tools/check-publication.mjs:')));
  assert.ok(result.issues.some(issue => issue.includes('[redacted file path]')));
  const built = scanPublicationTree(path.join(root, 'dist'));
  assert.equal(built.files, 1);
  assert.equal(built.issues.length, 1);
  for (const source of ['../tools/check-publication.mjs', '../tools/publication-privacy.mjs']) assert.deepEqual(privacyFindings(fs.readFileSync(new URL(source, import.meta.url), 'utf8')), []);
});

test('operator configuration must be external, readable and nonempty; absence is explicit', t => {
  const { temp, root, write } = fixture(t);
  assert.deepEqual(loadPrivateTerms(root, undefined), { terms: [], operatorScan: false });
  const external = path.join(temp, 'operator-terms.txt');
  fs.writeFileSync(external, '# comment\nfixture-secret-device\n');
  assert.deepEqual(loadPrivateTerms(root, external), { terms: ['fixture-secret-device'], operatorScan: true });
  for (const invalid of ['', path.join(temp, 'missing'), write('operator-terms.txt', 'fixture-secret-device'), root]) assert.throws(() => loadPrivateTerms(root, invalid));
  fs.writeFileSync(external, '# comments only\n');
  assert.throws(() => loadPrivateTerms(root, external));
  for (const invalid of [Buffer.from([0xff, 0xfe]), Buffer.from('fixture-secret-device\0')]) {
    fs.writeFileSync(external, invalid);
    assert.throws(() => loadPrivateTerms(root, external), error => !error.message.includes('fixture-secret-device') && !error.message.includes(external));
  }
});

test('operator findings redact matching filenames and never report private literals', t => {
  const { root, write } = fixture(t);
  const term = 'fixture-secret-device';
  write(term + '.md', term.toUpperCase());
  write('safe-name.md', term);
  const result = scanPublicationTree(root, [term]);
  assert.equal(result.issues.length, 3);
  assert.ok(result.issues.every(issue => !issue.toLowerCase().includes(term)));
  assert.ok(result.issues.includes('[redacted file path]: operator private-term reference in filename'));
});

test('publication CLI fails closed for a supplied unavailable operator file without disclosing its path', t => {
  const { temp } = fixture(t);
  const missing = path.join(temp, 'fixture-confidential-config.txt');
  const result = spawnSync(process.execPath, [path.resolve(import.meta.dirname, '../tools/check-publication.mjs')], {
    env: { ...process.env, ELSEMESH_PUBLICATION_PRIVATE_TERMS_FILE: missing }, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Operator private-term configuration unavailable/);
  assert.ok(!result.stderr.includes(missing));
  assert.ok(!result.stdout.includes('checks passed'));
});

test('publication filesystem failures redact absolute roots and private filenames', t => {
  const { temp, root } = fixture(t);
  const term = 'fixture-private-device';
  const configFile = path.join(temp, 'operator-terms.txt');
  fs.writeFileSync(configFile, term);
  const privateFile = path.join(root, term + '.md');
  const failingScanner = (scanRoot, terms) => {
    assert.equal(scanRoot, root);
    assert.deepEqual(terms, [term]);
    throw new Error(`EACCES: permission denied, open '${privateFile}'`);
  };
  assert.throws(() => publicationPrivacyCheck(root, configFile, failingScanner), error => {
    assert.equal(error.message, 'Publication privacy scan failed; filesystem details withheld.');
    assert.ok(!error.message.includes(root));
    assert.ok(!error.message.includes(term));
    assert.ok(!error.message.includes(configFile));
    return true;
  });
});

test('private file classes and excluded asset restrictions remain enforced', t => {
  const { root, write } = fixture(t);
  for (const rel of ['.env', '.env.local', 'operator.env', '.publication-private-terms.txt', 'secret.key', 'audit-evidence/report.txt']) write(rel);
  write('deploy/online.env.example', 'HOST=localhost');
  write('.env.example', 'HOST=localhost');
  write('public/models/port/delorean-model.bin');
  write('README.md', 'Burning-Horizons');
  const { issues } = scanPublicationTree(root);
  assert.equal(issues.filter(issue => issue.includes('private file class')).length, 7); // evidence directory plus its file
  assert.ok(!issues.some(issue => issue.includes('.env.example')));
  assert.ok(issues.some(issue => issue.includes('excluded asset')));
  assert.ok(!issues.some(issue => issue.includes('old project naming')));
});
