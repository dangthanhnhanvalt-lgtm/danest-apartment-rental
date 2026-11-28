// Run from DaNest project root: node "<path-to-kit>/B_run_tests.cjs"
// No credentials, no npm install, no source patches, no remote mutations.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=process.cwd();
if(!fs.existsSync(path.join(root,'package.json'))||!fs.existsSync(path.join(root,'src','App.tsx'))){console.error('Run from DaNest project root (package.json and src/App.tsx).');process.exit(2);}
const results=path.join(__dirname,'results');fs.mkdirSync(results,{recursive:true});
const rows=[]; const csv=v=>'"'+String(v).replace(/"/g,'""')+'"';
function run(id,kind,cmd,args){const start=Date.now();const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:240000,maxBuffer:8*1024*1024,windowsHide:true});const status=r.status===0&&!r.error?'PASS':'FAIL';const log=(r.stdout||'')+'\n'+(r.stderr||'')+(r.error?'\n'+r.error.message:'');fs.writeFileSync(path.join(results,id+'.log'),log);rows.push([id,kind,status,Date.now()-start,r.status===null?'no exit code':r.status,id+'.log']);console.log(`${status} ${id}`);}
function skip(id,kind,reason){rows.push([id,kind,'SKIP',0,reason,'']);console.log(`SKIP ${id}: ${reason}`);}
const stage=fs.mkdtempSync(path.join(root,'.danest-10c-'));
try{
 const names=fs.readdirSync(path.join(__dirname,'offline')).filter(n=>/^danest-[a-z0-9-]+\.cjs$/.test(n)).sort();
 for(const n of names){const id=n.slice(0,-4);if(!fs.existsSync(path.join(root,'node_modules','typescript'))){skip(id,'offline','Install project dependencies using existing lockfile');continue;}const dest=path.join(stage,n);fs.copyFileSync(path.join(__dirname,'offline',n),dest);run(id,'offline logic/static assertions',process.execPath,[dest]);}
 const tsc=path.join(root,'node_modules','typescript','bin','tsc'),vite=path.join(root,'node_modules','vite','bin','vite.js');
 if(fs.existsSync(tsc))run('typescript','typecheck',process.execPath,[tsc,'-b']);else skip('typescript','typecheck','Missing local TypeScript');
 // Vite build uses the project config; normal build output (dist) may be regenerated.
 if(fs.existsSync(vite))run('vite-build','production build',process.execPath,[vite,'build']);else skip('vite-build','production build','Missing local Vite');
}finally{fs.rmSync(stage,{recursive:true,force:true});fs.writeFileSync(path.join(results,'B_results.csv'),[['test_id','kind','result','elapsed_ms','exit_or_reason','log'],...rows].map(r=>r.map(csv).join(',')).join('\n')+'\n');}
console.log('Results: '+path.join(results,'B_results.csv'));console.log('Static tests are not browser/HTTP tests. Review failed logs; old assertions may need updating after UI changes.');if(rows.some(r=>r[2]==='FAIL'))process.exitCode=1;
