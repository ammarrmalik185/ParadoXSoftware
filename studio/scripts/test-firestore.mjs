import path from 'node:path';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const env={...process.env};
// Use the optional project-local Java runtime on Windows without changing system Java.
const javaRoot=path.resolve('.sites-runtime/java21/runtime');
if(process.platform==='win32'&&fs.existsSync(javaRoot)){
 const runtime=fs.readdirSync(javaRoot).find(name=>fs.existsSync(path.join(javaRoot,name,'bin/java.exe')));
 if(runtime){env.JAVA_HOME=path.join(javaRoot,runtime);env.PATH=path.join(env.JAVA_HOME,'bin')+path.delimiter+env.PATH;}
}
env.FIREBASE_CLI_DISABLE_UPDATE_CHECK='true';
fs.mkdirSync('.sites-runtime',{recursive:true});
const log=fs.createWriteStream('.sites-runtime/emulator-test.log');
const child=spawn(process.execPath,['node_modules/firebase-tools/lib/bin/firebase.js','emulators:exec','--only','firestore','--project','demo-paradoxsoftware','--config','firebase.emulators.json','node scripts/check-firestore.mjs'],{stdio:['inherit','pipe','pipe'],env});
for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log.write(chunk);for(const line of chunk.toString().split(/\r?\n/))if(line.startsWith('PASS:'))console.log(line);});
child.on('exit',code=>{log.end();if(code)console.error('Firestore tests failed. Details are in ignored .sites-runtime/emulator-test.log.');process.exitCode=code??1;});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
