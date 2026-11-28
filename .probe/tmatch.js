const fs=require('fs');
const src=fs.readFileSync('app/src/main/assets/www/js/matches.js','utf8');
const blk=src.slice(src.indexOf('var CMP ='),src.indexOf('function tvApply'));
var T365={games:JSON.parse(fs.readFileSync('out/s365.json')).games};
eval(blk);
let tot=0,hit=0;
for(const f of fs.readdirSync('out').filter(x=>x.startsWith('espn_'))){
  const code=f.slice(5,-5), d=JSON.parse(fs.readFileSync('out/'+f));
  for(const e of d.events||[]){
    const c=e.competitions[0];let h,a;c.competitors.forEach(x=>x.homeAway==='home'?h=x:a=x);
    const tm=x=>({ab:x.team.abbreviation||'',full:x.team.displayName||'',n:x.team.shortDisplayName||x.team.displayName});
    const ev={code,t:Date.parse(e.date),h:tm(h),a:tm(a)};
    const g=match365(ev);tot++;if(g)hit++;
    console.log(code,'|',ev.h.n,'-',ev.a.n,'=>',g?g.homeCompetitor.name+' - '+g.awayCompetitor.name+' ['+g.competitionId+']':'NONE');
  }
}
console.log('matched',hit,'/',tot);
const G=T365.games;
const cs=JSON.parse(fs.readFileSync('out/s365.json')).competitions||[];
console.log('|COMP', cs.filter(c=>/turk|süper|super lig|ligue 1|trendyol/i.test(c.name)).map(c=>c.id+':'+c.name+':'+c.countryId).join(' ; '));
console.log('|FR35', G.filter(g=>g.competitionId===35).map(g=>g.homeCompetitor.name+'-'+g.awayCompetitor.name+'@'+g.startTime).join(' ; '));
