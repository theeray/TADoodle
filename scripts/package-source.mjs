import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, existsSync, rmSync } from 'node:fs';
const temp = '.source-package';
rmSync(temp, {recursive:true,force:true});
mkdirSync(`${temp}/tad-meet`,{recursive:true});
for(const file of ['src','public/favicon.svg','public/tadoodle-logo.svg','public/tadoodle-logo-original.svg','index.html','vite.config.js','package.json','package-lock.json','firestore.rules','firebase.json','.env.example','.gitignore','.github','scripts','tests','README.md','LICENSE','NOTICE.md']) {
  if(existsSync(file))cpSync(file,`${temp}/tad-meet/${file}`,{recursive:true});
}
mkdirSync('public',{recursive:true});
rmSync('public/source.zip',{force:true});
execFileSync('zip',['-q','-r','../public/source.zip','tad-meet'],{cwd:temp});
rmSync(temp,{recursive:true,force:true});
cpSync('LICENSE','public/LICENSE');
