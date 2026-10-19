import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const uiSource=path.join(root,'ui-source');
const version=process.env.BEEBRIGHT_BUILD_SHA||process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
if(!/^[a-f0-9]{40}$/.test(version))throw new Error('Build version must be this repository\'s 40-character commit SHA.');
execFileSync(process.execPath,[path.join(uiSource,'node_modules/vite/bin/vite.js'),'build','--mode','desktop'],{cwd:uiSource,stdio:'inherit'});
const ui=path.join(root,'beebright_local/ui'),assets=path.resolve(ui,'assets');
if(!assets.startsWith(root+path.sep))throw new Error('Invalid generated asset path.');
fs.rmSync(assets,{recursive:true,force:true});
fs.cpSync(path.join(uiSource,'dist-local'),ui,{recursive:true});
fs.copyFileSync(path.join(root,'CHANGELOG.md'),path.join(ui,'CHANGELOG.md'));
fs.copyFileSync(path.join(uiSource,'node_modules/three/LICENSE'),path.join(root,'THIRD_PARTY_THREE_LICENSE.txt'));
fs.copyFileSync(path.join(uiSource,'node_modules/@babylonjs/core/license.md'),path.join(root,'THIRD_PARTY_BABYLON_LICENSE.txt'));
fs.writeFileSync(path.join(root,'version.json'),JSON.stringify({version}));
const files=new Map();
const excluded=new Set(['node_modules','__pycache__','dist-local','.pytest_cache']);
function collect(folder,prefix){
 for(const item of fs.readdirSync(folder,{withFileTypes:true})){
  if(excluded.has(item.name)||item.name.endsWith('.pyc'))continue;
  const file=path.join(folder,item.name),name=path.posix.join(prefix,item.name);
  if(item.isDirectory())collect(file,name);else files.set(name,fs.readFileSync(file));
 }
}
for(const folder of ['beebright_local','ui-source','font-licenses','tools'])collect(path.join(root,folder),folder);
for(const file of fs.readdirSync(root))if(/^(bootstrap\.(ps1|py)|install\.(ps1|sh)|requirements\.txt|release\.json|version\.json|README\.md|CHANGELOG\.md|LICENSE|THIRD_PARTY_.*\.txt|test_.*\.py)$/.test(file))files.set(file,fs.readFileSync(path.join(root,file)));
function crc32(data){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
let offset=0;const bodies=[],directory=[];
for(const [name,content]of [...files].sort(([a],[b])=>a.localeCompare(b))){
 const filename=Buffer.from(name),compressed=zlib.deflateRawSync(content),crc=crc32(content),header=Buffer.alloc(30);
 header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(0x21,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(content.length,22);header.writeUInt16LE(filename.length,26);bodies.push(header,filename,compressed);
 const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(0x800,8);entry.writeUInt16LE(8,10);entry.writeUInt16LE(0x21,14);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(compressed.length,20);entry.writeUInt32LE(content.length,24);entry.writeUInt16LE(filename.length,28);entry.writeUInt32LE(offset,42);directory.push(entry,filename);offset+=header.length+filename.length+compressed.length;
}
const central=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.size,8);end.writeUInt16LE(files.size,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
const archive=Buffer.concat([...bodies,central,end]),output=path.join(root,'dist');fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'beebright-local-source.zip'),archive);
const manifest={version,release:JSON.parse(fs.readFileSync(path.join(root,'release.json'),'utf8')).version,sha256:crypto.createHash('sha256').update(archive).digest('hex'),url:`https://github.com/Dev-v1/beebright-local/releases/download/desktop-${version.slice(0,12)}/beebright-local-source.zip`};
fs.writeFileSync(path.join(output,'update-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`BeeBright Local ${manifest.release}: ${files.size} files; built entirely from beebright-local ${version.slice(0,12)}.`);
