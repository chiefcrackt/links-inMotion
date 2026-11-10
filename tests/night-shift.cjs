// Night shift: 10pm-5am (visitor's time) the sun sets, a moon rises, Tristan wears a headlamp,
// Hooper's collar blinks and Travis brings a lantern. Tap the sun/moon to switch; ?night forces it.
// Run with the preview on 127.0.0.1:4187:  node tests/night-shift.cjs
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch();
 fs.mkdirSync('test-results',{recursive:true});
 async function open(time,{path='/',viewport={width:390,height:844},reduced=false}={}){
  const context=await browser.newContext({viewport,reducedMotion:reduced?'reduce':'no-preference'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',r=>r.abort());
  await page.clock.setFixedTime(new Date(time));
  await page.goto('http://127.0.0.1:4187'+path);
  await page.getByRole('button',{name:'Make him jump'}).waitFor({state:'visible'});
  return {context,page,errors};
 }
 const isNight=page=>page.locator('.scene').evaluate(s=>s.classList.contains('night'));
 // Bright, warm pixels on the runner canvas: the headlamp lens and beam.
 const lampInk=page=>page.locator('.runcv').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;
   for(let i=0;i<d.length;i+=4)if(d[i+3]>200&&d[i]>245&&d[i+1]>235&&d[i+2]>200)n++;return n});

 // The clock decides: 11pm and 4am are night, noon and 9pm are not.
 for(const [time,want] of [['2026-06-01T23:00:00',true],['2026-06-01T04:30:00',true],['2026-06-01T12:00:00',false],['2026-06-01T21:59:00',false]]){
  const {context,page,errors}=await open(time);
  assert.equal(await isNight(page),want,time);
  assert.equal(await page.locator('.sunhit').getAttribute('aria-pressed'),String(want));
  assert.deepEqual(errors,[]);await context.close()}

 // Day: tap the sun, it sets; tap the moon, it comes back. Nothing is remembered on reload.
 {const {context,page,errors}=await open('2026-06-01T12:00:00');
  const hit=page.getByRole('button',{name:'Set the sun'});
  const dayLamp=await lampInk(page);
  await hit.click();
  assert(await isNight(page),'tapping the sun sets it');
  assert(!(await page.getByRole('button',{name:'Make him jump'}).isDisabled()));
  await page.waitForTimeout(3500);
  assert(await lampInk(page)>dayLamp+20,'headlamp and beam switch on');
  await page.locator('.scene').screenshot({path:'test-results/night-mobile.png'});
  await page.getByRole('button',{name:'Bring the sun back up'}).click();
  assert(!(await isNight(page)),'tapping the moon brings the sun back');
  await page.reload();await page.getByRole('button',{name:'Make him jump'}).waitFor({state:'visible'});
  assert(!(await isNight(page)),'a tap only lasts for the visit');
  assert.deepEqual(errors,[]);await context.close()}

 // Night by the clock: the sun tap is a manual override for this visit.
 {const {context,page,errors}=await open('2026-06-01T23:00:00');
  await page.getByRole('button',{name:'Bring the sun back up'}).click();
  assert(!(await isNight(page)));
  assert.deepEqual(errors,[]);await context.close()}

 // ?night at noon: Hooper's collar light and Travis's lantern come along, and the aid station still finishes.
 for(const viewport of [{width:390,height:844},{width:1280,height:900}]){
  const tag=viewport.width<600?'mobile':'desktop';
  const {context,page,errors}=await open('2026-06-01T12:00:00',{path:'/?night',viewport});
  assert(await isNight(page),'?night forces night');
  await page.waitForTimeout(300);
  assert(await lampInk(page)>20,'headlamp is on from the first frame');
  await page.getByRole('button',{name:'Bring Hooper along'}).click();
  await page.waitForTimeout(4000);
  await page.getByRole('button',{name:'Bring Hooper along'}).click();
  await page.waitForTimeout(3000);
  const aid=page.getByRole('button',{name:'Aid station: Travis brings a PB&J'});
  await aid.waitFor({state:'visible'});await aid.click();
  await page.waitForTimeout(3500);
  const lantern=await page.locator('.runcv').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;
    for(let i=0;i<d.length;i+=4)if(d[i+3]>200&&d[i]>235&&d[i+1]>150&&d[i+1]<215&&d[i+2]<130)n++;return n});   // amber lantern glass
  assert(lantern>4,'Travis carries a lit lantern');
  await page.locator('.scene').screenshot({path:`test-results/night-aid-${tag}.png`});
  await page.waitForFunction(()=>!document.querySelector('.aid').disabled,null,{timeout:40000});
  // The trail game still plays at night.
  await page.getByRole('button',{name:'Play the trail game'}).click();
  await page.getByRole('button',{name:'Stop the trail game'}).click();
  assert.deepEqual(errors,[]);await context.close()}

 // Reduced motion: no sunset animation, the still scene switches straight to night with the headlamp on.
 {const {context,page,errors}=await open('2026-06-01T12:00:00',{reduced:true});
  const before=await lampInk(page);
  await page.getByRole('button',{name:'Set the sun'}).click();
  await page.waitForTimeout(100);
  assert(await isNight(page));
  assert(await lampInk(page)>before+20,'still frame redraws with the headlamp');
  await page.locator('.scene').screenshot({path:'test-results/night-reduced-motion.png'});
  assert.deepEqual(errors,[]);await context.close()}

 await browser.close();
 console.log('night shift ok');
})().catch(e=>{console.error(e);process.exit(1)});
