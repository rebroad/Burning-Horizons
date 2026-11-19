import fs from 'node:fs';
import path from 'node:path';

// Publication working-tree coverage only: no history or binary metadata claims.
const excludedDirectories = new Set(['.git', 'node_modules', 'dist']);
const runtimeDirectories = new Set(['world', 'blender', 'video', 'network']);
const textExtensions = /\.(?:[cm]?jsx?|tsx?|go|rs|c|cc|cpp|cxx|h|hh|hpp|hxx|mod|sum|lock|cfg|py|md|html?|json|jsonl|map|txt|ya?ml|service|example|svg|sh|bash|zsh|fish|ps1|bat|cmd|conf|ini|toml|xml|css|vue|svelte|wgsl|glsl|csv|tsv|env|gitignore)$/i;

export function loadPrivateTerms(root, configFile) {
  if (configFile === undefined) return { terms: [], operatorScan: false };
  if (!configFile.trim()) throw new Error('Operator private-term configuration is empty.');
  try {
    const resolvedRoot = fs.realpathSync(root);
    const resolvedFile = fs.realpathSync(configFile);
    const relative = path.relative(resolvedRoot, resolvedFile);
    if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
      throw new Error('Configuration must be outside the repository.');
    }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(resolvedFile));
    if (text.includes('\0')) throw new Error('Invalid private-term text.');
    const terms = text.split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
    if (!terms.length) throw new Error('No private terms configured.');
    return { terms, operatorScan: true };
  } catch {
    // Never include the configured path or literal terms in diagnostics.
    throw new Error('Operator private-term configuration unavailable, empty, malformed, or inside repository.');
  }
}

export function privacyFindings(text, terms = []) {
  const findings = [];
  const addresses = text.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) || [];
  if (addresses.some(address => {
    const octets = address.split('.').map(Number);
    return octets.every(n => n <= 255) && (octets[0] === 10 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168));
  }) || /\b(?:[a-z0-9-]+\.)+ts\.net\b/i.test(text)
    || /\b[a-z]:[\\/]+(?:users|documents and settings)[\\/]+[^\s\\/"'<>]+/i.test(text)
    || /\/(?:home|Users)\/[^\s/"'<>]+/.test(text)
    || /\\\\[a-z0-9_.-]+\\[^\s\\]+/i.test(text)) findings.push('private environment reference');
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}|\bsk-proj-[A-Za-z0-9_-]{30,}/.test(text)) findings.push('possible credential');
  const lower = text.toLowerCase();
  if (terms.some(term => lower.includes(term.toLowerCase()))) findings.push('operator private-term reference');
  return findings;
}

export function scanPublicationTree(root, terms = []) {
  const issues = [];
  let textFiles = 0;
  let files = 0;
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      const rel = path.relative(root, file).replaceAll('\\', '/');
      if (entry.isDirectory() && (excludedDirectories.has(entry.name) || (rel.startsWith('artifacts/') && runtimeDirectories.has(rel.split('/')[1])))) continue;
      const nameFindings = privacyFindings(rel, terms);
      const label = nameFindings.length ? '[redacted file path]' : rel;
      for (const finding of nameFindings) issues.push(`${label}: ${finding} in filename`);
      if (/(?:^|\/)(?:audit-evidence|integration-evidence)(?:\/|$)/.test(rel) || /\.(?:pem|key|pcap|pcapng)$/i.test(rel) || /(?:^|\/)(?:\.env(?:\..+)?|[^/]+\.env)$/.test(rel) && !rel.endsWith('.env.example') || /(?:^|\/)\.publication-private-terms(?:\.[^/]+)?$/.test(rel)) issues.push(`${label}: private file class`);
      if (/public\/models\/(?:godzilla\/|port\/delorean)/i.test(rel)) issues.push(`${label}: excluded asset`);
      if (entry.isSymbolicLink()) { issues.push(`${label}: symbolic link requires publication review`); continue; }
      if (entry.isDirectory()) { walk(file); continue; }
      if (!entry.isFile()) continue;
      files++;
      if (textExtensions.test(rel) || ['LICENSE', 'Dockerfile', 'Makefile', '.gitignore', '.gitattributes'].includes(entry.name)) {
        textFiles++;
        const text = fs.readFileSync(file, 'utf8');
        for (const finding of privacyFindings(text, terms)) issues.push(`${label}: ${finding}`);
      }
    }
  }
  walk(root);
  return { issues, files, textFiles };
}

// Keep filesystem exception details out of CLI output: they can contain a
// private checkout root or private filename before ordinary redaction runs.
export function publicationPrivacyCheck(root, configFile, scanner = scanPublicationTree) {
  let config;
  try {
    config = loadPrivateTerms(root, configFile);
  } catch {
    throw new Error('Operator private-term configuration unavailable, empty, malformed, or inside repository.');
  }
  try {
    return { scan: scanner(root, config.terms), operatorScan: config.operatorScan };
  } catch {
    throw new Error('Publication privacy scan failed; filesystem details withheld.');
  }
}
