const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 fs.mkdirSync('test-results',{recursive:true});
 for(const mobile of [false,true])for(const [id,random] of [['race',.05],['trail',.3],['winter',.6],['hd',.9]]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900}});
  await context.addInitScript(value=>{Math.random=()=>value},random);
  const page=await context.newPage(),errors=[],requested=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('/scene/outfits/'))requested.push(r.url())});
  await page.route('https://**/*',r=>r.abort());
  await page.goto('http://127.0.0.1:4187/');
  await page.waitForFunction(id=>document.querySelector('.scene').dataset.runnerOutfit===id,id);
  await page.getByRole('button',{name:'Make him jump'}).waitFor({state:'visible'});
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.scene')).opacity==='1'&&document.querySelector('.boot').getAnimations().every(a=>a.currentTime>=700));
  assert(await page.locator('.runcv').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let count=0;for(let i=3;i<d.length;i+=4)if(d[i])count++;return count>100}));
  assert.equal(requested.length,id==='hd'?9:id==='winter'?8:6);
  assert(requested.every(url=>url.includes('/'+id+'/')));
  await page.locator('.scene').screenshot({path:`test-results/runner-${id}-${mobile?'mobile':'desktop'}.png`});
  await page.getByRole('button',{name:'Make him jump'}).click();
  const hooper=page.getByRole('button',{name:'Bring Hooper along'});await hooper.click();
  assert.equal(await hooper.getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Play the trail game'}).click();
  await page.getByRole('button',{name:'Stop the trail game'}).waitFor({state:'visible'});
  await page.getByRole('button',{name:'Stop the trail game'}).click();
  assert.deepEqual(errors,[]);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await context.close();
 }
 // Reload uses a fresh choice, even when the previous page selected another outfit.
 const page=await browser.newPage();
 await page.addInitScript(()=>{const previous=sessionStorage.getItem('outfit-test');sessionStorage.setItem('outfit-test','1');Math.random=()=>previous?.6:.05});
 await page.goto('http://127.0.0.1:4187/');await page.waitForFunction(()=>document.querySelector('.scene').dataset.runnerOutfit==='race');
 await page.reload();await page.waitForFunction(()=>document.querySelector('.scene').dataset.runnerOutfit==='winter');
 await page.close();
 for(const missingFitter of [false,true]){
  const context=await browser.newContext({reducedMotion:'reduce'});await context.addInitScript(()=>{Math.random=()=>.4});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  if(missingFitter)await p.route('**/scene/outfit-fit.js*',r=>r.abort());
  else await p.route('**/scene/outfits/trail/torso.png*',r=>r.abort());
  await p.goto('http://127.0.0.1:4187/');await p.waitForFunction(()=>document.querySelector('.scene').dataset.runnerOutfit==='original');
  await p.getByRole('button',{name:'Make him jump'}).waitFor({state:'visible'});
  await p.getByRole('button',{name:'Make him jump'}).click();assert.deepEqual(errors,[]);await context.close();
 }
 const context=await browser.newContext({reducedMotion:'reduce'});await context.addInitScript(()=>{Math.random=()=>.4});
 const reduced=await context.newPage();await reduced.goto('http://127.0.0.1:4187/');
 await reduced.waitForFunction(()=>document.querySelector('.scene').dataset.runnerOutfit==='trail');
 const still=await reduced.locator('.runcv').evaluate(c=>c.toDataURL());await reduced.waitForTimeout(150);
 assert.equal(await reduced.locator('.runcv').evaluate(c=>c.toDataURL()),still);await context.close();
 // Outfit button: each tap switches to the next look in order and wraps around, without triggering a jump.
 {const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(()=>{Math.random=()=>.3});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://**/*',r=>r.abort());
  await p.goto('http://127.0.0.1:4187/');
  const swap=p.getByRole('button',{name:'Change outfit (now: Trail)'});await swap.waitFor({state:'visible'});
  const seen=[];for(const id of ['winter','hd','race','trail']){await p.locator('.outfit').click();
   await p.waitForFunction(id=>document.querySelector('.scene').dataset.runnerOutfit===id&&!document.querySelector('.outfit').disabled,id);seen.push(id)}
  assert.deepEqual(seen,['winter','hd','race','trail']);
  assert.equal(await p.locator('.outfit').getAttribute('aria-label'),'Change outfit (now: Trail)');
  assert.deepEqual(errors,[]);await context.close()}
 await browser.close();console.log('Passed: all outfits (race, trail, winter, HD) desktop/mobile, Outfit button cycling, fresh reload choice, jumps, Hooper/game, reduced motion and fallback.');
})().catch(e=>{console.error(e);process.exit(1)});
