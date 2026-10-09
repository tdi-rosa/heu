import { build } from 'esbuild';
import { mkdir, copyFile, rm } from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
await build({entryPoints:['client/main.ts'],bundle:true,format:'esm',target:'es2022',outfile:'dist/game.js',minify:true});
await copyFile('client/index.html','dist/index.html');
await copyFile('client/style.css','dist/style.css');
