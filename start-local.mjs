import {fileURLToPath} from 'node:url';
import {startLocalWorldServer} from './.fred-server/tools/serve-opening-world.mjs';
await startLocalWorldServer({root:fileURLToPath(new URL('.',import.meta.url))});
