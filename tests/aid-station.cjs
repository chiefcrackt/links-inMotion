// Aid station: Travis walks in, hands Tristan a PB&J, they wave, Travis walks off.
// Run with the preview on 127.0.0.1:4187:  node tests/aid-station.cjs
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch();
 fs.mkdirSync('test-results',{recursive:true});
 async function open(viewport,reduced){
  const context=await browser.newContext({viewport,reducedMotion:reduced?'reduce':'no-preference'});
  const page=await context.newPage(),errors=[],travis=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('/scene/travis/'))travis.push(r.url())});
  await page.route('https://**/*',r=>r.abort());
  await page.goto('http://127.0.0.1:4187/');
  const aid=page.getByRole('button',{name:'Aid station: Travis brings a PB&J'});
  await aid.waitFor({state:'visible'});
  return {context,page,errors,travis,aid};
 }
 const controls=['Bring Hooper along','Play the trail game'];

 // Walking gait: a planted foot must not slide while Travis moves at his ground speed.
 {const {context,page}=await open({width:1280,height:900});
  const slide=await page.evaluate(()=>{const pp=makePuppet({},PARTS,{walk:true});let worst=0,n=0;
   for(let i=0;i<400;i++){const p0=i/400,p1=(i+1)/400;
    const a0=pp.leg(p0,[0,0]),b0=pp.leg(p0+0.5,[10,-6]),a1=pp.leg(p1,[0,0]),b1=pp.leg(p1+0.5,[10,-6]);
    if(a0.low<b0.low-1||a1.low<b1.low-1)continue;   // only while the near foot is the one on the ground
    n++;worst=Math.max(worst,Math.abs((a1.an[0]-a0.an[0])+pp.groundSpeed*(p1-p0)))}
   return {worst,n,speed:pp.groundSpeed}});
  assert(slide.n>80,'near foot is planted for a real part of the stride');
  assert(slide.speed>0,'walk moves forward');
  assert(slide.worst*0.105<0.35,`planted foot slides ${slide.worst} source px per step`);
  await context.close()}

 for(const viewport of [{width:390,height:844},{width:1280,height:900}]){
  const tag=viewport.width<600?'mobile':'desktop';
  const {context,page,errors,travis,aid}=await open(viewport);
  assert.equal(await aid.getAttribute('aria-pressed'),'false');
  assert.equal(travis.length,13,'nine body pieces and four sandwich states');
  await page.getByRole('button',{name:'Bring Hooper along'}).click();
  await aid.click();
  assert.equal(await aid.getAttribute('aria-pressed'),'true');
  assert(await aid.isDisabled());
  for(const name of controls)assert(await page.getByRole('button',{name}).isDisabled(),name+' waits for the aid station');
  assert(await page.locator('.scene').evaluate(s=>s.classList.contains('aiding')));
  assert.equal(await page.getByRole('button',{name:'Bring Hooper along'}).getAttribute('aria-pressed'),'false','Hooper heads off');
  await page.waitForTimeout(5200);
  await page.locator('.scene').screenshot({path:`test-results/aid-${tag}.png`});
  await page.waitForFunction(()=>!document.querySelector('.aid').disabled,null,{timeout:40000});
  assert.equal(await aid.getAttribute('aria-pressed'),'false');
  for(const name of controls)assert(!(await page.getByRole('button',{name}).isDisabled()));
  assert(!(await page.locator('.scene').evaluate(s=>s.classList.contains('aiding'))));
  // He runs again: the floor moves.
  const a=await page.locator('.grid').screenshot();await page.waitForTimeout(400);const b=await page.locator('.grid').screenshot();
  assert(!a.equals(b),'Tristan runs on after the aid station');
  // The trail game hides the button and brings it back.
  await page.getByRole('button',{name:'Play the trail game'}).click();
  assert(await aid.isHidden());
  await page.getByRole('button',{name:'Stop the trail game'}).click();
  await aid.waitFor({state:'visible'});
  assert.deepEqual(errors,[]);
  await context.close();
 }

 // Reduced motion: a still of the handoff, then back to normal.
 {const {context,page,errors,aid}=await open({width:390,height:844},true);
  const ink=()=>page.locator('.runcv').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return n});
  const before=await ink();
  await aid.click();
  assert(await aid.isDisabled());
  const during=await ink();
  assert(during>before*1.5,'Travis and the sandwich appear in the still');
  await page.locator('.scene').screenshot({path:'test-results/aid-reduced-motion.png'});
  await page.waitForFunction(()=>!document.querySelector('.aid').disabled,null,{timeout:8000});
  assert(Math.abs(await ink()-before)<before*0.2,'the still clears');
  assert.deepEqual(errors,[]);
  await context.close()}
 await browser.close();
 console.log('aid station ok');
})().catch(e=>{console.error(e);process.exit(1)});
