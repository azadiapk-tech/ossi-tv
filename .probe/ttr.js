const fs=require('fs');
const src=fs.readFileSync('app/src/main/assets/www/js/matches.js','utf8');
const cut=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b));
eval(cut('function norm','function tside'));
var S={ev:[]},TRM={},BTR={list:[]};
eval(cut('function trMatch','function tvApply').replace('TRM = {};','TRM = {};'));
// guide
for(const [rid,name] of [['beinsports','beIN SPORTS 1'],['beinsports-2','beIN SPORTS 2'],['beinsports-3','beIN SPORTS 3'],['beinsports-4','beIN SPORTS 4'],['bein-sports-haber','beIN SPORTS HABER']]){
  const html=fs.readFileSync('out/'+rid+'.html','utf8');
  const m=/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  JSON.parse(m[1]).props.pageProps.data.listTvGuides.forEach(x=>{
    if(!/ - /.test(x.name||''))return;
    const dm=/(\d+)\/(\d+)\/(\d{4})/.exec(x.event_date),tm=/(\d+):(\d+)/.exec(x.event_time);
    BTR.list.push([name,Date.UTC(+dm[3],+dm[1]-1,+dm[2],+tm[1]-3,+tm[2]),x.name]);
  });
}
for(const f of fs.readdirSync('out').filter(x=>x.startsWith('espn_'))){
  const d=JSON.parse(fs.readFileSync('out/'+f));
  for(const e of d.events||[]){const c=e.competitions[0];let h,a;c.competitors.forEach(x=>x.homeAway==='home'?h=x:a=x);
    const tm=x=>({ab:x.team.abbreviation||'',full:x.team.displayName||'',n:x.team.shortDisplayName||x.team.displayName});
    S.ev.push({id:f+e.id,t:Date.parse(e.date),h:tm(h),a:tm(a)});}
}
trMatch();
S.ev.forEach(e=>console.log('|',new Date(e.t).toISOString().slice(11,16),e.h.n,'-',e.a.n,'=>',(TRM[e.id]||[]).join(', ')||'-'));
console.log('| guide:',BTR.list.map(x=>x[0].slice(-1)+' '+new Date(x[1]).toISOString().slice(11,16)+' '+x[2]).join(' ; '));
