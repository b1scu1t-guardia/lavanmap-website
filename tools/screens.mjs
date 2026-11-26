import sharp from 'sharp';
import fs from 'node:fs';
const src=process.env.TEMP+'/claude/shots/', out='public/screens/';
const names=['map','card','filters','spot','night','route'];
for (const n of names) for (const m of ['light','dark']) await sharp(src+`${n}-${m}.png`).resize(1080,null,{kernel:'lanczos3'}).sharpen({sigma:0.6}).webp({quality:90,smartSubsample:true}).toFile(out+`${n}-${m}.webp`);
const tiles=[];let i=0;for(const m of ['light','dark'])for(const n of names){tiles.push({input:await sharp(src+`${n}-${m}.png`).resize(240).toBuffer(),left:(i%6)*250,top:Math.floor(i/6)*546});i++}
await sharp({create:{width:1500,height:1092,channels:3,background:'#888'}}).composite(tiles).png().toFile(process.env.TEMP+'/claude/sheet.png');
for(const f of fs.readdirSync(out))console.log(f,fs.statSync(out+f).size);
// Rendus Blender : secours sans WebGL, van et image de partage.
for (const m of ['light','dark']) await sharp(src+`phone-${m}.png`).trim().resize({height:1100}).webp({quality:86}).toFile(`public/models/phone-${m}.webp`);
await sharp(src+'van.png').trim().resize({width:120}).webp({quality:90}).toFile('public/models/van.webp');
const ph=await sharp(src+'phone-light.png').trim().resize({height:600}).toBuffer();
await sharp({create:{width:1200,height:630,channels:3,background:'#A9CDFB'}}).composite([{input:ph,left:760,top:15},{input:Buffer.from('<svg width="1200" height="630"><path d="M-20 560 C260 520 240 330 520 360 S700 120 1240 90" fill="none" stroke="#E5B43C" stroke-width="46"/><path d="M-20 560 C260 520 240 330 520 360 S700 120 1240 90" fill="none" stroke="#FFDD63" stroke-width="38"/><text x="70" y="180" font-family="Segoe UI,Arial" font-weight="800" font-size="84" fill="#14201A">La Van Map</text><text x="72" y="250" font-family="Segoe UI,Arial" font-size="36" fill="#14201A">Où dormir et manger en van</text></svg>'),left:0,top:0},{input:ph,left:760,top:15}]).jpeg({quality:86}).toFile('public/og.jpg');
