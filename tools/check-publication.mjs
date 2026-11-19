import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { publicationPrivacyCheck } from './publication-privacy.mjs';
const root=path.resolve(import.meta.dirname,'..');
const issues=[];
let operatorScan = false;
let scan;
try {
 const result=publicationPrivacyCheck(root,process.env.ELSEMESH_PUBLICATION_PRIVATE_TERMS_FILE);
 operatorScan=result.operatorScan;
 scan=result.scan;
 issues.push(...scan.issues);
} catch (error) { console.error(error.message); process.exit(1); }
const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/models/port/licensing/vehicle-manifest.json'),'utf8'));
for(const record of manifest){const file=path.join(root,'public/models/port',record.file);if(!fs.existsSync(file)||crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==record.sha256)issues.push(`${record.file}: asset hash mismatch`);}
for(const entry of ['index.html','worlds.html']){const text=fs.readFileSync(path.join(root,entry),'utf8');if(!/<title>Burning-Horizons/.test(text))issues.push(`${entry}: incorrect game title`);}
console.log(`Operator-specific literal scan: ${operatorScan ? 'run using external configuration' : 'NOT RUN (no external configuration supplied)'}.`);
console.log(`Scope: ${scan.files} working-tree files, ${scan.textFiles} supported text files and filenames, including the guard itself; excludes .git, node_modules, dist and artifacts/{world,blender,video,network}. No Git history or binary metadata coverage.`);
if(issues.length){console.error(issues.join('\n'));process.exitCode=1;}else console.log(`Publication checks passed within stated scope: generic privacy patterns, identifiers, file exclusions, titles and ${manifest.length} vehicle hashes.`);
