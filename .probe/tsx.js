const fs=require('fs');
const src=fs.readFileSync('app/src/main/assets/www/js/matches.js','utf8');
const cut=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b));
eval(cut('function norm','function tside'));
eval(cut('function trNow','var BTR_CH').replace(/^/,''));
eval(cut('function trNow','function btrLoad'));
var S={ev:[]},TRM={},BTR={list:[]};
eval(cut('function trMatch','function tvApply'));
const buf=fs.readFileSync('out/sx.html'); const ct=fs.readFileSync('out/sx.ct','utf8');
let cs=(/charset=["']?([\w-]+)/i.exec(ct)||[])[1]; if(!cs){cs=(/<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.slice(0,4096).toString('latin1'))||[])[1];}
console.log('| content-type:',ct.trim(),'| charset used:',cs);
const html=new TextDecoder(cs||'utf-8').decode(buf);
const L=sxParse(html); console.log('| sporx live football rows:',L.length);
L.forEach(x=>console.log('|  ',new Date(x[1]).toISOString().slice(5,16),x[0],'::',x[2]));
BTR.list=L;
for(const f of fs.readdirSync('out').filter(x=>x.startsWith('espn_'))){
  const d=JSON.parse(fs.readFileSync('out/'+f));
  for(const e of d.events||[]){const c=e.competitions[0];let h,a;c.competitors.forEach(x=>x.homeAway==='home'?h=x:a=x);
    const tm=x=>({ab:x.team.abbreviation||'',full:x.team.displayName||'',n:x.team.shortDisplayName||x.team.displayName});
    S.ev.push({id:f+e.id,t:Date.parse(e.date),h:tm(h),a:tm(a)});}
}
trMatch();
S.ev.forEach(e=>console.log('| MATCH',new Date(e.t).toISOString().slice(11,16),e.h.n,'-',e.a.n,'=>',(TRM[e.id]||[]).join(', ')||'-'));
