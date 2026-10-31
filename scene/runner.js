/* TODO Claude - task 7: split animation code before implementing task 5 in index.html.
   Make this a separate behavior-preserving change. Extract focused files for the
   runner/Hooper rigs and joint data, outfit selection and asset loading, trail-game
   rules/scoring, and scene rendering/timing/input. Keep a small scene entry point
   and explicit interfaces for shared state; choose file names to suit the code.
   Preserve the authored gait, joints, layering, lighting, jump/stumble timing,
   Hooper interactions, obstacle difficulty, milestones, best-score storage key,
   per-load random outfits and original-art fallback, reduced-motion behavior,
   offscreen pausing, resize handling, and existing accessible controls.
   Keep GitHub Pages deployment static with no build system or new framework.
   Update script loading and any tests that inspect source boundaries. Run the
   existing gait/outfit checks and npm test; add meaningful regression coverage
   for behavior affected by extraction. Compare desktop/mobile appearance before
   and after. Do not bundle new gameplay or visual redesign into this refactor.
*/
/* Joints for each cut-out piece, in the source drawing's pixels. */
var PARTS={"upperarm":{"pivot":[49,48],"end":[54,248]},"forearm":{"pivot":[34,36],"end":[43,221]},"thigh":{"pivot":[91.94999999999999,73.50000000000003],"end":[98.25,327.6]},"shin":{"pivot":[56,40],"end":[44,280]},"shoe":{"pivot":[55,26],"end":[211,26],"sole":[[-45,83],[55,91],[145,78],[156,58]]},"shorts":{"pivot":[94.94999999999999,95.50000000000003],"waist":[-3.1499999999999773,-71.50000000000001]},"torso":{"pivot":[108,346],"neck":[47,-338],"shoulder":[-25,-288]},"head":{"pivot":[90,195]}};
/* Cutout runner built from a parts sheet. Each part has a pivot (the joint it hangs from) and an end
   (the next joint), both in that part's own pixels. Run-cycle keyframes rotate the parts; the hip height is
   solved each frame so the lowest shoe touches the ground. Angles: degrees from straight down, + = forward. */
function makePuppet(imgs, parts, opt){
  opt=opt||{};
  var R=Math.PI/180;
  function sub(a,b){return [a[0]-b[0],a[1]-b[1]]}
  function ang(v){return Math.atan2(v[0],v[1])/R}
  function len(v){return Math.hypot(v[0],v[1])}
  function rot(v,a){var c=Math.cos(a*R),s=Math.sin(a*R);return [v[0]*c-v[1]*s,v[0]*s+v[1]*c]}
  function bone(n){var p=parts[n];return {rest:ang(sub(p.end,p.pivot)),len:len(sub(p.end,p.pivot))}}
  var TH=bone('thigh'),SN=bone('shin'),UA=bone('upperarm'),FA=bone('forearm');
  var WALK=!!opt.walk;   // walking gait (Travis): feet stay planted in turn, no flight phase
  var SHOE_SCALE=opt.shoeScale||0.85, LEAN=opt.lean||(WALK?2:6);
  var FAR_SH=opt.farShoulder||[10,4], FAR_HIP=opt.farHip||[10,-6];
  var HIP =WALK?[ 22,  16,   6,  -6, -16, -20,  -2,  18]:[ 28,  14,   0, -20, -27, -12,  18,  38];
  var KNEE=WALK?[  4,  14,   8,   4,  10,  40,  58,  22]:[ 12,  38,  22,  10,  42, 100, 106,  72];
  var PF  =WALK?[-10,   0,   4,   8,  22,  18,  -6, -14]:[  4, -24, -22,  10,  28,  18,   2, -18];   // ankle: + = toes pointed, - = toes pulled up
  var ARM =WALK?[-16, -10,  -2,   8,  16,  10,   0, -10]:[-44, -34, -12,  14,  28,  20,   0, -26];
  var ELB =WALK?[ 16,  16,  18,  20,  22,  20,  18,  16]:[ 80,  82,  86,  92,  96,  92,  86,  82];
  function cr(k,p){var n=k.length,x=((p%1)+1)%1*n,i=Math.floor(x),t=x-i,a=k[(i-1+n)%n],b=k[i%n],c=k[(i+1)%n],d=k[(i+2)%n];
    return 0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)}
  function pt(o,l,a){return [o[0]+l*Math.sin(a*R),o[1]+l*Math.cos(a*R)]}
  var sole=parts.shoe.sole.map(function(q){return [q[0]*SHOE_SCALE,q[1]*SHOE_SCALE]});
  // Jump state, set by the scene: tuck (0..1 knees up in the air), crouch (0..1 bent knees on the ground),
  // lift (source px above the ground), w (0..1 how much the jump overrides the stride's own hip height).
  // stand (0..1) blends to a relaxed standing pose with both feet down; arm {sw,el,w} poses the near arm
  // (reach, eat, wave), w = how much it overrides the swing.
  var J={tuck:0,crouch:0,lift:0,w:0,pump:0,stand:0,arm:null};
  function mixv(a,b,t){return a+(b-a)*t}
  function leg(p,h){var hip=cr(HIP,p),kn=cr(KNEE,p),pf=cr(PF,p);
    if(J.tuck>0){var T=Math.PI*2;hip=mixv(hip,40+10*Math.cos(T*p),J.tuck);kn=mixv(kn,108,J.tuck);pf=mixv(pf,32,J.tuck)}
    if(J.crouch>0){hip+=14*J.crouch;kn+=34*J.crouch}
    if(J.stand>0){hip=mixv(hip,2,J.stand);kn=mixv(kn,4,J.stand);pf=mixv(pf,0,J.stand)}
    var shin=hip-kn,foot=-shin+pf,k=pt(h,TH.len,hip),an=pt(k,SN.len,shin),low=-1e9;
    sole.forEach(function(q){var r=rot(q,foot);low=Math.max(low,an[1]+r[1])});return {hip:hip,shin:shin,foot:foot,k:k,an:an,low:low}}
  function lift(p){if(WALK)return 0;var u=((p%0.5)+0.5)%0.5;return u>0.34&&u<0.5?22*Math.sin(Math.PI*(u-0.34)/0.16):0}
  var N=240,ys=[];for(var i=0;i<N;i++){var p=i/N,a=leg(p,[0,0]),b=leg(p+0.5,FAR_HIP);ys.push(-Math.max(a.low,b.low)-lift(p))}
  function hipY(p){var x=((p%1)+1)%1*N,i=Math.floor(x),t=x-i;return ys[i%N]*(1-t)+ys[(i+1)%N]*t}
  var groundSpeed=(leg(0.06,[0,0]).an[0]-leg(0.31,[0,0]).an[0])/0.25;
  var K=opt.imgScale||1;   // pieces are stored smaller than the source; joints stay in source units
  var darkCache={};
  function dark(name){if(darkCache[name])return darkCache[name];var src=imgs[name],c=document.createElement('canvas');
    c.width=src.naturalWidth||src.width;c.height=src.naturalHeight||src.height;var x=c.getContext('2d');x.drawImage(src,0,0);
    x.globalCompositeOperation='source-atop';x.fillStyle='rgba(8,14,30,.32)';x.fillRect(0,0,c.width,c.height);return darkCache[name]=c}
  function piece(ctx,name,at,angle,sc,shade){var info=parts[name]||parts[name.replace('_far','')];ctx.save();ctx.translate(at[0],at[1]);ctx.rotate(angle*R);if(sc)ctx.scale(sc,sc);
    ctx.scale(1/K,1/K);ctx.drawImage(shade?dark(name):imgs[name],-info.pivot[0]*K,-info.pivot[1]*K);ctx.restore()}
  function drawLeg(ctx,q,h,shade){
    piece(ctx,'shin',q.k,SN.rest-q.shin,0,shade);piece(ctx,'shoe',q.an,q.foot,SHOE_SCALE,shade);piece(ctx,'thigh',h,TH.rest-q.hip,0,shade)}
  function drawArm(ctx,sh,p,shade){var sw=cr(ARM,p),el=cr(ELB,p);
    if(J.tuck>0){sw=mixv(sw,shade?-20:58,J.tuck);el=mixv(el,shade?70:104,J.tuck)}   // drive the near arm up, far arm back
    if(J.crouch>0){sw=mixv(sw,-30,J.crouch*0.7)}                                        // arms swing back to load
    if(J.pump>0&&!shade){sw=mixv(sw,148,J.pump);el=mixv(el,30,J.pump)}                   // milestone fist pump
    if(J.stand>0){sw=mixv(sw,shade?4:-4,J.stand);el=mixv(el,14,J.stand)}                // arms hang at rest
    if(J.arm&&J.arm.w>0&&!shade){sw=mixv(sw,J.arm.sw,J.arm.w);el=mixv(el,J.arm.el,J.arm.w)}
    var fo=sw+el,e=pt(sh,UA.len,sw);
    piece(ctx,shade&&imgs.forearm_far?'forearm_far':'forearm',e,FA.rest-fo,0,shade);piece(ctx,'upperarm',sh,UA.rest-sw,0,shade);
    return pt(e,FA.len*0.93,fo)}   // the fist
  // Core motion. q = step phase (two steps per cycle). Landing is near q=0.25 (the "down" pose).
  function core(p){var T=Math.PI*2,q=p*2,m=1-0.9*J.stand;   // standing calms the stride motion
    return {
      pelvisTilt: m*2.2*Math.sin(T*(q-0.05)),          // pelvis rocks a little with each step
      pelvisShift: m*4*Math.cos(T*p),                   // near hip swings forward and back with the near leg
      torsoLean: mixv(LEAN+2.4*Math.sin(T*(q-0.2))+12*J.crouch,1.5,J.stand),  // leans in a bit more on push-off (and when crouching to jump)
      squash: 1-m*0.018*Math.max(0,Math.cos(T*(q-0.25))),// tiny compress on landing
      shoulderTwist: m*7*Math.sin(T*(p+0.25)),          // shoulders rotate against the hips
      headCounter: -0.75                              // head undoes most of the torso rock
    }}
  // flip: draw facing left (the rig faces right). Returns the near fist in canvas coordinates.
  function draw(ctx,p,x,groundY,scale,flip){
    ctx.save();ctx.translate(x,groundY);ctx.scale(flip?-scale:scale,scale);
    var c=core(p),hy=hipY(p),gw=Math.max(J.w,J.stand);
    if(gw>0){var a=leg(p,[0,0]),b=leg(p+0.5,FAR_HIP),ground=-Math.max(a.low,b.low);hy=mixv(hy,ground,gw)-J.lift}
    var h=[0,hy];
    // chain: hip -> waist (on the shorts) -> neck/shoulder (on the torso)
    var w=rot(parts.shorts.waist,c.pelvisTilt),waist=[h[0]+w[0],h[1]+w[1]];
    var tA=c.torsoLean;
    function onTorso(v){var r=rot([v[0],v[1]*c.squash],tA);return [waist[0]+r[0],waist[1]+r[1]]}
    var neck=onTorso(parts.torso.neck),shBase=onTorso(parts.torso.shoulder);
    var sh=[shBase[0]+c.shoulderTwist,shBase[1]],fs=[shBase[0]+FAR_SH[0]-c.shoulderTwist,shBase[1]+FAR_SH[1]];
    var nh=[h[0]+c.pelvisShift*0.5,h[1]],fh=[h[0]+FAR_HIP[0]-c.pelvisShift*0.5,h[1]+FAR_HIP[1]];
    var nq=leg(p,nh),fq=leg(p+0.5,fh);
    drawArm(ctx,fs,p+0.5,true);
    drawLeg(ctx,fq,fh,true);
    drawLeg(ctx,nq,nh,false);
    piece(ctx,'shorts',h,c.pelvisTilt);
    piece(ctx,'head',neck,LEAN*0.3+(tA-LEAN)*(1+c.headCounter));
    ctx.save();ctx.translate(waist[0],waist[1]);ctx.rotate(tA*R);ctx.scale(1/K,c.squash/K);ctx.drawImage(imgs.torso,-parts.torso.pivot[0]*K,-parts.torso.pivot[1]*K);ctx.restore();
    var fist=drawArm(ctx,sh,p,false);
    ctx.restore();
    return {fist:[x+(flip?-scale:scale)*fist[0],groundY+scale*fist[1]]}}
  return {draw:draw,groundSpeed:groundSpeed,leg:leg,hipY:hipY,jump:J}
}

/* Hooper's joints and rig (v3 parts sheet). Each piece has its own scale (s) to "dog units" = the sheet's standing dog in pixels,
   a pivot in its own pixels, and for limbs an end joint. Torso and head are placed where they sit on the standing dog;
   the hip is the body's origin. Legs have three bones each: front = shoulder, forearm, wrist+paw;
   hind = thigh, shank, hock+paw. The lower pieces were cut from the lengthened legs with round caps at the joint. */
var DOGPARTS={
 torso:{s:1.035,pivot:[5,45],at:[35,208]},
 head:{s:0.86,pivot:[110,300],at:[478,264]},
 fu:{s:0.94,pivot:[58,40],end:[55,212],at:[408,262]},
 fl:{s:0.85,pivot:[38,26],end:[40,246]},
 fp:{s:0.85,pivot:[40,28],end:[64,98]},
 hu:{s:0.82,pivot:[72,44],end:[70,232],at:[118,262]},
 hl:{s:1.02,pivot:[40,28],end:[37.5,150]},
 hp:{s:1.02,pivot:[37.5,28],end:[77,151]}
};
/* Hooper: paw-driven rotary gallop. Three-bone legs fold at elbows and hocks;
   stance paws sweep backward at ground speed, with a smooth airborne recovery.
   The body follows a continuous compression/flight curve, independent of which paw is lowest. */
function makeDog(imgs, parts, opt){
  opt=opt||{};
  var R=Math.PI/180,T=Math.PI*2,K=opt.imgScale||1,P=parts,FAR=opt.far||[14,-4];
  function sub(a,b){return [a[0]-b[0],a[1]-b[1]]}
  function add(a,b){return [a[0]+b[0],a[1]+b[1]]}
  function rot(v,a){var c=Math.cos(a*R),s=Math.sin(a*R);return [v[0]*c-v[1]*s,v[0]*s+v[1]*c]}
  function pt(o,l,a){return [o[0]+l*Math.sin(a*R),o[1]+l*Math.cos(a*R)]}
  var O=P.hu.at,SHO=sub(P.fu.at,O),NECK=sub(P.head.at,O),TOR=sub(P.torso.at,O);
  function bone(n){var p=P[n],v=[(p.end[0]-p.pivot[0])*p.s,(p.end[1]-p.pivot[1])*p.s];return {rest:Math.atan2(v[0],v[1])/R,len:Math.hypot(v[0],v[1])}}
  var B={};['fu','fl','fp','hu','hl','hp'].forEach(function(n){B[n]=bone(n)});
  var dark={};
  function shade(n){if(dark[n])return dark[n];var s=imgs[n],c=document.createElement('canvas');c.width=s.naturalWidth||s.width;c.height=s.naturalHeight||s.height;
    var x=c.getContext('2d');x.drawImage(s,0,0);x.globalCompositeOperation='source-atop';x.fillStyle='rgba(8,14,30,.38)';x.fillRect(0,0,c.width,c.height);return dark[n]=c}
  function piece(ctx,n,at,ang,dk){var p=P[n];ctx.save();ctx.translate(at[0],at[1]);ctx.rotate(ang*R);ctx.scale(p.s/K,p.s/K);
    ctx.drawImage(dk?shade(n):imgs[n],-p.pivot[0]*K,-p.pivot[1]*K);ctx.restore()}
  // Rotary gallop: hind pair drives, front pair catches, then gathered flight.
  // Solve joints from paw paths so planted feet travel at one ground speed.
  var stride=680, STANCE=0.30;
  var OFF={nh:0,fh:0.07,ff:0.40,nf:0.48};
  function chain(at,f,p,rootY){
    p=((p%1)+1)%1;
    var a=f?['fu','fl','fp']:['hu','hl','hp'];
    var reach=f?120:85, x, lift=0, curl=0;
    if(p<STANCE){x=reach-stride*p}
    else{
      var u=(p-STANCE)/(1-STANCE), h=u*u*(3-2*u);
      // Hermite recovery preserves the backwards velocity at lift-off and landing.
      x=(reach-stride*STANCE)*(1-h)+reach*h-stride*(1-STANCE)*(2*u*u*u-3*u*u+u);
      lift=(f?150:125)*Math.pow(Math.sin(Math.PI*u),2);
      curl=Math.pow(Math.sin(Math.PI*u),2);
    }
    var angle=f?5-115*curl:18+65*curl;
    var paw=[at[0]+x,-rootY-lift];
    var wrist=[paw[0]-B[a[2]].len*Math.sin(angle*R),paw[1]-B[a[2]].len*Math.cos(angle*R)];
    var dx=wrist[0]-at[0],dy=wrist[1]-at[1],l1=B[a[0]].len,l2=B[a[1]].len;
    var dist=Math.max(Math.abs(l1-l2)+0.01,Math.min(l1+l2-0.01,Math.hypot(dx,dy)));
    var bend=Math.acos(Math.max(-1,Math.min(1,(l1*l1+dist*dist-l2*l2)/(2*l1*dist))))/R;
    var upper=Math.atan2(dx,dy)/R+(f?-bend:bend);
    var knee=pt(at,l1,upper);
    var lower=Math.atan2(wrist[0]-knee[0],wrist[1]-knee[1])/R;
    var ankle=pt(knee,l2,lower),tip=pt(ankle,B[a[2]].len,angle);
    return {n:a,j:[at,knee,ankle],paw:tip,r:[B[a[0]].rest-upper,B[a[1]].rest-lower,B[a[2]].rest-angle]};
  }
  function body(p){
    var pitch=-3.5*Math.cos(T*(p-0.12));
    var flex=1+0.018*Math.cos(T*(p-0.48));
    var air=p>0.78?Math.pow(Math.sin(Math.PI*(p-0.78)/0.22),2):0;
    var arch=3+10*Math.cos(T*(p-0.94));
    return {pitch:pitch,flex:flex,air:air,arch:arch};
  }
  // Spine bend. The torso is drawn as thin vertical strips laid along a curve; points on the body (hip, shoulder,
  // neck) ride the same curve. u runs -1 (rump) .. +1 (chest) across the torso picture.
  var TP=P.torso,TW={xm:232,half:226,n:32},OV=7;   // OV: strip overlap (torso px) so no gap opens where strips tilt apart
  function uOf(v){return ((v[0]-TOR[0])/TP.s+TP.pivot[0]-TW.xm)/TW.half}                // body point (dog units) -> u
  function dyAt(u,A){return A*(u*u-0.35)}                                              // torso px, + = down
  function thAt(u,A){return Math.atan(2*A*u/TW.half)}                                  // radians
  function onBody(v,b){var u=uOf(v);return rot([v[0]*b.flex,v[1]+dyAt(u,b.arch)*TP.s],b.pitch)}
  var U_NECK=uOf(NECK);
  function pose(p){
    p=((p%1)+1)%1;var b=body(p);
    var sho=onBody(SHO,b),hip=onBody([0,0],b);
    var y=-330+9*Math.cos(T*(p-0.12))-24*b.air;
    return {b:b,sho:sho,hip:hip,
      a:chain(sho,1,p-OFF.nf,y),bb:chain(add(sho,FAR),1,p-OFF.ff,y),
      c:chain(hip,0,p-OFF.nh,y),d:chain(add(hip,FAR),0,p-OFF.fh,y),y:y};
  }
  var LAYS={};
  function layer(ctx,k){var w=ctx.canvas.width,h=ctx.canvas.height,L=LAYS[k]||(LAYS[k]=document.createElement('canvas'));if(L.width!==w||L.height!==h){L.width=w;L.height=h}
    var o=L.getContext('2d');o.setTransform(1,0,0,1,0,0);o.globalCompositeOperation='source-over';o.clearRect(0,0,w,h);o.setTransform(ctx.getTransform());return L}
  function bentTorso(c,b){var img=imgs.torso,W=(img.naturalWidth||img.width)/K,H=(img.naturalHeight||img.height)/K,n=TW.n,w=W/n,pv=TP.pivot;
    c.save();c.rotate(b.pitch*R);c.scale(b.flex,1);c.translate(TOR[0],TOR[1]);c.scale(TP.s,TP.s);
    for(var i=0;i<n;i++){var x0=i*w,xc=x0+w/2,u=(xc-TW.xm)/TW.half;c.save();c.translate(xc-pv[0],dyAt(u,b.arch));c.rotate(thAt(u,b.arch));
      var o0=Math.max(0,x0-OV),o1=Math.min(W,x0+w+OV);c.drawImage(img,o0*K,0,(o1-o0)*K,H*K,o0-xc,-pv[1],o1-o0,H);c.restore()}
    c.restore()}
  function draw(ctx,p,x,gy,scale,lift){
    var q=pose(p);ctx.save();ctx.translate(x,gy);ctx.scale(scale,scale);ctx.translate(0,q.y-(lift||0));
    function low(ch,dk){piece(ctx,ch.n[2],ch.j[2],ch.r[2],dk);piece(ctx,ch.n[1],ch.j[1],ch.r[1],dk)}   // paw under the shank, shank over it
    low(q.bb,true);piece(ctx,'fu',q.bb.j[0],q.bb.r[0],true);low(q.d,true);piece(ctx,'hu',q.d.j[0],q.d.r[0],true);   // far legs, darker
    function upper(c){piece(c,'hu',q.c.j[0],q.c.r[0]);piece(c,'fu',q.a.j[0],q.a.r[0])}
    upper(ctx);                                                                           // near thigh + shoulder under the body (the top of each leg)
    var tl=layer(ctx,'t');bentTorso(tl.getContext('2d'),q.b);                              // the bent body, drawn once
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(tl,0,0);ctx.restore();
    var ul=layer(ctx,'u'),o=ul.getContext('2d');upper(o);o.setTransform(1,0,0,1,0,0);o.globalCompositeOperation='destination-in';o.drawImage(tl,0,0);o.globalCompositeOperation='source-over';
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(ul,0,0);ctx.restore();         // ...and again on top, trimmed to the body, so the shoulder and haunch roll inside his outline
    low(q.c);low(q.a);                                                                   // near lower legs over the body
    var nk=onBody(NECK,q.b);
    piece(ctx,'head',nk,-q.b.pitch*0.7-thAt(U_NECK,q.b.arch)/R*0.5+2*Math.sin(T*p+0.8));                            // head stays fairly level, bobs with the stride
    ctx.restore()}
  return {draw:draw,stride:stride,pose:pose}
}

/* Run scene for the links page: draws the cutout runner and the grid floor each frame, with the floor
   moving at exactly the speed the planted foot pushes back. Pauses when the scene is off screen. */
(function(){
  var box=document.querySelector('.scene');if(!box)return;
  var grid=box.querySelector('.grid'),run=box.querySelector('.runcv');if(!grid||!run)return;
  var gctx=grid.getContext('2d'),rctx=run.getContext('2d');
  var still=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CYCLE=1.05, SCALE=0.105, dpr=1, gw=0, gh=0, rw=0, rh=0, off=0, ph=0.1, last=0, on=true, pp=null;
  var names=['head','torso','shorts','thigh','shin','shoe','upperarm','forearm','forearm_far'],imgs={},left=names.length;
  // One independent choice per document load; never saved in localStorage.
  // One random outfit per load (never saved); the Outfit button steps through the rest.
  // 'hd' is the original outfit redrawn sharper (inmotion-video handoff A1); it replaces every piece, so it needs no fitting.
  var outfits=['race','trail','winter','hd'],outfit=outfits[Math.floor(Math.random()*outfits.length)];
  var OUTFIT_NAMES={race:'Race day',trail:'Trail',winter:'Cold weather',hd:'Original',original:'Original'};
  var originals=null,looks={},changing=false;
  function loadImages(list,dir,ext){return Promise.all(list.map(function(n){return new Promise(function(resolve,reject){
      var im=new Image();im.onload=function(){resolve([n,im])};im.onerror=function(){reject(new Error('Outfit image failed'))};
      im.src=dir+n+ext;
    })})).then(function(entries){var a={};entries.forEach(function(e){a[e[0]]=e[1]});return a})}
  // Pieces for one outfit, loaded and fitted once, then reused. Rejects if they can't be loaded or fitted.
  function lookFor(id){
    if(looks[id])return Promise.resolve(looks[id]);
    var p;
    if(id==='hd')p=loadImages(names,'scene/outfits/hd/','.webp?v=1');
    else if(typeof window.fitRiverOutfit!=='function')p=Promise.reject(new Error('No outfit fitter'));
    else{var required=names.filter(function(n){return n!=='head'&&(id==='winter'||n!=='forearm'&&n!=='forearm_far')});
      p=loadImages(required,'scene/outfits/'+id+'/','.png?v=1').then(function(art){return window.fitRiverOutfit(art,originals,id)})}
    return p.then(function(set){return looks[id]=set});
  }
  function outfitImages(){
    originals=imgs;
    return lookFor(outfit).then(function(set){imgs=set;box.dataset.runnerOutfit=outfit})
      .catch(function(){imgs=originals;box.dataset.runnerOutfit='original'});
  }
  function labelSwap(){if(swap)swap.setAttribute('aria-label','Change outfit (now: '+OUTFIT_NAMES[box.dataset.runnerOutfit]+')')}
  // Outfit button: switch to the next look in place; he keeps running. A look that fails is skipped.
  function nextOutfit(){
    if(changing||!pp||aid)return;
    var id=outfits[(outfits.indexOf(outfit)+1)%outfits.length];
    changing=true;if(swap)swap.disabled=true;outfit=id;
    lookFor(id).then(function(set){imgs=set;box.dataset.runnerOutfit=id;pp=makePuppet(imgs,PARTS,{imgScale:0.3});drawRunner();labelSwap()})
      .catch(function(){})
      .then(function(){changing=false;if(swap)swap.disabled=false});
  }
  function size(){dpr=Math.min(window.devicePixelRatio||1,2);
    var g=grid.getBoundingClientRect(),r=run.getBoundingClientRect();gw=g.width;gh=g.height;rw=r.width;rh=r.height;
    grid.width=Math.round(gw*dpr);grid.height=Math.round(gh*dpr);gctx.setTransform(dpr,0,0,dpr,0,0);
    run.width=Math.round(rw*dpr);run.height=Math.round(rh*dpr);rctx.setTransform(dpr,0,0,dpr,0,0)}
  function drawGrid(){gctx.clearRect(0,0,gw,gh);gctx.lineWidth=1.5;var cx=gw/2,sp=gw/4,o=off%sp;
    gctx.strokeStyle='rgba(46,155,173,.55)';
    for(var k=-16;k<=16;k++){var xb=cx+k*sp-o;gctx.beginPath();gctx.moveTo(cx,0);gctx.lineTo(cx+(xb-cx)*1.6,gh*1.6);gctx.stroke()}
    for(var n=0;n<40;n++){var y=gh/(n+.55);if(y>gh+1)continue;if(y<1.5)break;
      gctx.strokeStyle='rgba(46,155,173,'+Math.min(.85,.15+y/gh*.8).toFixed(3)+')';gctx.beginPath();gctx.moveTo(0,y);gctx.lineTo(gw,y);gctx.stroke()}}
  // Offscreen layers for the rim light: the runner is drawn once, then its edges facing the light are tinted.
  var body=document.createElement('canvas'),bctx=body.getContext('2d'),rim=document.createElement('canvas'),mctx=rim.getContext('2d');
  function edge(dx,dy,color,alpha){
    mctx.setTransform(1,0,0,1,0,0);mctx.globalCompositeOperation='source-over';mctx.clearRect(0,0,rim.width,rim.height);
    mctx.drawImage(body,0,0);mctx.globalCompositeOperation='destination-out';mctx.drawImage(body,dx*dpr,dy*dpr);
    mctx.globalCompositeOperation='source-in';mctx.globalAlpha=alpha;mctx.fillStyle=color;mctx.fillRect(0,0,rim.width,rim.height);mctx.globalAlpha=1;
    rctx.save();rctx.setTransform(1,0,0,1,0,0);rctx.drawImage(rim,0,0);rctx.restore()}
  // Footstrike ripples: spawned when a foot lands, then carried away by the floor
  var ripples=[];
  function drawRipples(gy,dt,floorSpeed){
    for(var i=ripples.length-1;i>=0;i--){var r=ripples[i],L=r.big?1:0.7,z=r.big?2.2:1;r.t+=dt;r.x-=floorSpeed*dt;if(r.t>L){ripples.splice(i,1);continue}
      var k=r.t/L,e=1-Math.pow(1-k,2);
      rctx.strokeStyle='rgba(46,155,173,'+(0.75*(1-k)).toFixed(3)+')';rctx.lineWidth=(1.6*(1-k)+0.6)*(r.big?1.4:1);
      rctx.beginPath();rctx.ellipse(r.x,gy,(6+30*e)*z,(1.6+4.5*e)*z,0,0,Math.PI*2);rctx.stroke();
      rctx.strokeStyle='rgba(232,201,106,'+(0.45*(1-k)).toFixed(3)+')';rctx.lineWidth=1;
      rctx.beginPath();rctx.ellipse(r.x,gy,(3+16*e)*z,(1+2.5*e)*z,0,0,Math.PI*2);rctx.stroke()}}
  // Jump timeline (seconds): crouch, spring up with knees tucked, land with a squash. jt < 0 means not jumping.
  var jt=-1,HEIGHT=330,jH=330,jA1=0.64,jA2=0.95;   // jump height (source px), touchdown time, end time
  function sm(a,b,x){x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x)}
  function updateJump(dt,gy){var J=pp.jump;if(jt<0){J.tuck=J.crouch=J.lift=J.w=0;return}
    var prev=jt;jt+=dt;var t=jt;
    J.w=sm(0,0.07,t)*(1-sm(jA2-0.13,jA2,t));
    if(t<0.16){J.crouch=Math.sin(Math.PI/2*t/0.16);J.tuck=0;J.lift=0}
    else if(t<jA1){var u=(t-0.16)/(jA1-0.16);J.lift=jH*4*u*(1-u);J.tuck=Math.pow(Math.sin(Math.PI*u),0.6);J.crouch=Math.max(0,1-u*7)}
    else{var v=(t-jA1)/(jA2-jA1);J.lift=0;J.tuck=0;J.crouch=0.85*Math.sin(Math.PI*Math.min(1,v))}
    if(prev<jA1&&t>=jA1)ripples.push({x:rw/2+4,t:0,big:true});
    if(t>=jA2){jt=-1;J.tuck=J.crouch=J.lift=J.w=0}}
  function wake(){if(!on){on=true;last=0;requestAnimationFrame(frame)}}
  function jump(){if(G&&!G.over)hideHint();if(aid||!pp||(jt>=0&&jt<jA1+0.06)||st>=0)return;var game=G&&!G.over;jH=game?540:330;jA1=game?0.78:0.64;jA2=jA1+0.31;jt=0;if(hd)hd.hop=-0.14;wake()}   // Hooper hops a beat after Tristan
  // Hooper: trots in from the left, runs alongside, then dashes off ahead. null when he's not out.
  var dog=null,hd=null,DSCALE=0.074,STAY=10,HOP=172;   // HOP: hop height in source px
  function ease(x){return x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2}
  function hooper(){if(!dog||aid)return;
    if(!hd){hd={mode:'in',t:0,p:0,x:-60,hop:-1};setPaw(true)}
    else if(hd.mode!=='out'){hd.mode='out';hd.t=0;hd.x0=hd.x;setPaw(false)}
    wake()}
  function setPaw(onn){if(paw){paw.setAttribute('aria-pressed',onn?'true':'false')}}
  function updateDog(dt,floorSpeed){if(!hd)return;var home=rw/2+30,px=hd.x;hd.t+=dt;
    if(hd.mode==='in'){var k=Math.min(1,hd.t/3.6);hd.x=-60+(home+60)*(1-Math.pow(1-k,3));if(k>=1){hd.mode='run';hd.t=0}}
    else if(hd.mode==='run'){hd.x=home+4*Math.sin(hd.t*0.9);if(hd.t>STAY){hd.mode='out';hd.t=0;hd.x0=hd.x}}
    else{var k=Math.min(1,hd.t/2.6);hd.x=hd.x0+(rw+80-hd.x0)*k*k;if(k>=1){hd=null;setPaw(false);return}}
    var vx=dt>0?(hd.x-px)/dt:0,stridePx=dog.stride*DSCALE;
    hd.p=(hd.p+dt*Math.max(0,floorSpeed+vx)/stridePx)%1;
    if(hd.hop>-1){hd.hop+=dt;if(hd.hop>0.5)hd.hop=-1}}
  function drawDog(ctx,gy){if(!hd)return;var lift=0,air=0;
    if(hd.hop>0){var u=hd.hop/0.5;lift=HOP*4*u*(1-u);air=lift/HOP}
    ctx.fillStyle='rgba(0,0,0,'+(0.38*(1-0.5*air)).toFixed(3)+')';ctx.beginPath();ctx.ellipse(hd.x+20,gy,22*(1-0.4*air),3*(1-0.4*air),0,0,Math.PI*2);ctx.fill();
    dog.draw(ctx,hd.p,hd.x,gy,DSCALE,lift)}

  // ---- Aid station: Tristan stops, Travis walks in from the right with a PB&J, Tristan eats it,
  // they wave, Travis walks back off to the right, and Tristan runs on. null when it isn't playing.
  var tv=null,timg={},aid=null,RUNK=1,WC=1.15,GAP=680;   // Travis puppet, sandwich images, run speed 0..1, walk cycle (s), hip-to-hip gap (source px)
  var REACH={sw:64,el:12},HOLD={sw:22,el:74},EAT={sw:62,el:120},REST={sw:-4,el:14};
  function lerpPose(a,b,k){return {sw:a.sw+(b.sw-a.sw)*k,el:a.el+(b.el-a.el)*k,w:1}}
  function aidStation(){if(!tv||!pp||aid||(G&&!G.over)||jt>=0||st>=0)return;
    if(hd&&hd.mode!=='out'){hd.mode='out';hd.t=0;hd.x0=hd.x;setPaw(false)}   // Hooper heads off up the trail
    aid={step:'stop',t:0,s:0,tx:rw+50,tp:0.3,face:-1,bite:0,xfer:0,crumbs:[]};
    setAidUi(true);
    if(still){aidStill();return}
    wake()}
  function setAidUi(onn){box.classList.toggle('aiding',onn);if(aidBtn){aidBtn.disabled=onn;aidBtn.setAttribute('aria-pressed',onn?'true':'false')}
    [paw,swap,playBtn].forEach(function(b){if(b)b.disabled=onn})}
  function aidStill(){   // reduced motion: one still of the handoff, then back to normal
    var A=aid;A.step='still';A.tx=rw/2-6+GAP*SCALE;A.xfer=0.5;
    pp.jump.stand=1;pp.jump.arm={sw:REACH.sw,el:REACH.el,w:1};tv.jump.stand=1;tv.jump.arm={sw:REACH.sw,el:REACH.el,w:1};
    RUNK=0;drawRunner();
    setTimeout(function(){aidEnd();drawRunner()},4500)}
  function aidEnd(){aid=null;RUNK=1;pp.jump.stand=0;pp.jump.arm=null;if(tv){tv.jump.stand=0;tv.jump.arm=null}setAidUi(false)}
  function walkTravis(dt,dir){var A=aid;A.tx+=dir*tv.groundSpeed*SCALE/WC*dt;A.tp=(A.tp+dt/WC)%1}
  function crumbs(at){for(var i=0;i<6;i++)aid.crumbs.push({x:at[0]+(Math.random()-0.3)*4,y:at[1]+Math.random()*2,vx:(Math.random()-0.2)*28,vy:-14-Math.random()*16,t:0,c:i%2?'#D9A15A':'#F3E3C0'})}
  function updateAid(dt,gy,fist){if(!aid||aid.step==='still')return;var A=aid,P=pp.jump,T=tv.jump;A.t+=dt;A.s+=dt;var s=A.s;
    var target=rw/2-6+GAP*SCALE;
    if(A.step==='stop'){RUNK=1-sm(0,1.1,s);P.stand=sm(0.4,1.2,s);
      if(s>0.5){T.stand=0;walkTravis(dt,-1);if(A.tx<=target){A.tx=target;A.step='give';A.s=0}}}
    else if(A.step==='give'){RUNK=0;P.stand=1;T.stand=sm(0,0.45,s);
      T.arm={sw:REACH.sw,el:REACH.el,w:sm(0.2,0.75,s)*(1-sm(1.4,1.9,s))};
      P.arm=s<1.3?{sw:REACH.sw,el:REACH.el,w:sm(0.55,1,s)}:lerpPose(REACH,HOLD,sm(1.3,1.8,s));
      A.xfer=sm(1.0,1.3,s);if(s>=1.9){A.step='eat';A.s=0}}
    else if(A.step==='eat'){var k=Math.floor(s),u=s-k;
      if(k>=4){P.arm=null;A.step='wave';A.s=0}
      else{P.arm=u<0.4?lerpPose(HOLD,EAT,sm(0,0.4,u)):u<0.6?lerpPose(EAT,EAT,1):k<3?lerpPose(EAT,HOLD,sm(0.6,1,u)):lerpPose(EAT,REST,sm(0.6,1,u));
        if(A.bite===k&&u>=0.45){A.bite=k+1;if(fist)crumbs(fist)}}}
    else if(A.step==='wave'){var w=sm(0,0.3,s)*(1-sm(1.4,1.7,s));
      T.arm={sw:150,el:30+24*Math.sin(s*10),w:w};P.arm={sw:150,el:30+24*Math.sin(s*10+1.2),w:w*sm(0.2,0.5,s)};
      if(s>=1.8){T.arm=P.arm=null;A.face=1;A.step='leave';A.s=0}}
    else if(A.step==='leave'){T.stand=1-sm(0,0.3,s);walkTravis(dt,1);if(A.tx>rw+60){A.step='go';A.s=0}}
    else if(A.step==='go'){P.stand=1-sm(0,0.6,s);RUNK=sm(0.1,1.2,s);if(s>=1.2){aidEnd();return}}
    for(var i=A.crumbs.length-1;i>=0;i--){var c=A.crumbs[i];c.t+=dt;c.vy+=90*dt;c.x+=c.vx*dt;c.y=Math.min(gy,c.y+c.vy*dt);if(c.t>1.4)A.crumbs.splice(i,1)}}
  function drawAid(ctx,gy,fist){if(!aid||!tv)return null;var A=aid,flip=A.face<0;
    var tr=tv.draw(ctx,A.tp,A.tx,gy,SCALE,flip);
    if(A.bite<4){var img=timg['pbj-'+A.bite],from=tr.fist,to=fist||from,k=A.step==='give'||A.step==='still'?A.xfer:1,
        x=from[0]+(to[0]-from[0])*k,y=from[1]+(to[1]-from[1])*k,w=img.naturalWidth/72*140*SCALE,h=w*img.naturalHeight/img.naturalWidth;
      ctx.drawImage(img,x-w*0.5,y-h*0.62,w,h)}
    return tr}
  function drawAidShadow(ctx,gy){if(!aid)return;ctx.fillStyle='rgba(0,0,0,.42)';ctx.beginPath();ctx.ellipse(aid.tx+12*aid.face,gy,26,3.5,0,0,Math.PI*2);ctx.fill()}
  function drawCrumbs(ctx){if(!aid)return;aid.crumbs.forEach(function(c){ctx.globalAlpha=Math.max(0,1-c.t/1.4);ctx.fillStyle=c.c;ctx.fillRect(c.x-0.8,c.y-0.8,1.6,1.6)});ctx.globalAlpha=1}
  function loadTravis(){var tn=names.concat(['pbj-0','pbj-1','pbj-2','pbj-3']),ti={},tl=tn.length;
    tn.forEach(function(n){var i=new Image();i.onload=i.onerror=function(){if(--tl===0&&tn.every(function(k){return ti[k].naturalWidth>0})){
        timg=ti;tv=makePuppet(ti,PARTS,{imgScale:0.3,walk:true});if(aidBtn&&!(G&&!G.over))aidBtn.hidden=false}};
      i.src='scene/travis/'+n+'.webp?v=1';ti[n]=i})}
  // ---- Trail mini-game: roots and rocks scroll in on the floor; tap to jump them. One clip ends the run.
  var SPD=1, st=-1;                    // world speed multiplier (drops during a stumble), stumble timer
  var GS=1, gsGoal=1, mile=0, signs=[], burst=-1, pumpT=-1;   // game speed (builds every 5 clears), mile markers, celebration timers
  var hint=box.querySelector('.ghint'), hintT=-1;
  var hills=[].slice.call(box.querySelectorAll('.far,.near,.glint'));
  function hillRate(r){hills.forEach(function(el){if(el.getAnimations)el.getAnimations().forEach(function(a){a.playbackRate=r})})}
  function isMile(n){return n===10||n===25||(n>=50&&n%25===0)}
  function celebrate(){mile++;signs.push({x:rw+30,n:mile});burst=0;pumpT=0;
    if(hud){hud.classList.remove('pop');void hud.offsetWidth;hud.classList.add('pop')}}
  var G=null, best=0, playBtn=box.querySelector('.play'), hud=box.querySelector('.ghud'), hS=null, hB=null, hMsg=null;
  try{best=+localStorage.getItem('tim_trail_best')||0}catch(e){}
  if(hud){hS=hud.querySelector('.hs');hB=hud.querySelector('.hb');hMsg=hud.querySelector('.hm')}
  function showHud(){if(!hud)return;hS.textContent=G?G.streak:0;hB.textContent=best}
  function play(){if(!pp||aid)return;
    if(G&&!G.over){endGame(false);return}                     // Stop
    G={obs:[],streak:0,gap:260,since:0,over:false};st=-1;SPD=1;gsGoal=1;mile=0;signs=[];
    if(hint){hint.hidden=false;hint.classList.remove('gone');hintT=0}
    if(hd&&hd.mode!=='out'){hd.mode='out';hd.t=0;hd.x0=hd.x;setPaw(false)}   // Hooper sits this one out
    if(paw)paw.hidden=true;if(aidBtn)aidBtn.hidden=true;if(hud){hud.hidden=false;hud.classList.remove('over');hMsg.textContent=''}
    if(playBtn){playBtn.querySelector('span').textContent='Stop';playBtn.querySelector('path').setAttribute('d','M4 4 H12 V12 H4 Z');playBtn.setAttribute('aria-label','Stop the trail game')}
    showHud();wake()}
  function endGame(clipped){if(!G)return;G.over=true;gsGoal=1;hideHint();
    if(G.streak>best){best=G.streak;try{localStorage.setItem('tim_trail_best',String(best))}catch(e){}}
    showHud();if(hud){hud.classList.add('over');hMsg.textContent=clipped?'Clipped it. Play to run again.':'Run ended.'}
    if(playBtn){playBtn.querySelector('span').textContent='Play';playBtn.querySelector('path').setAttribute('d','M4 2.5 L13 8 L4 13.5 Z');playBtn.setAttribute('aria-label','Play the trail game')}
    if(paw&&dog)paw.hidden=false;if(aidBtn&&tv)aidBtn.hidden=false}
  function spawn(){var rock=Math.random()<0.5;
    G.obs.push(rock?{k:'rock',x:rw+10,w:15+Math.random()*4,h:13+Math.random()*4,s:Math.random()}
                   :{k:'root',x:rw+10,w:22+Math.random()*5,h:9+Math.random()*2,s:Math.random()});
    var tight=Math.min(80,G.streak*5);G.gap=(200-tight+Math.random()*(110-tight*0.4))*gsGoal;G.since=0}   // gaps stretch with speed so they stay fair
  function updateGame(dt,fs){if(!G)return;var rx=rw/2-6,lift=pp.jump.lift*SCALE,move=fs*SPD*GS*dt;
    for(var i=G.obs.length-1;i>=0;i--){var o=G.obs[i];o.x-=move;
      if(o.x+o.w<-20){G.obs.splice(i,1);continue}
      if(G.over||o.hit||o.cleared)continue;
      var a=rx,b=rx+8;                                         // where his planted foot meets the ground
      if(o.x<b&&o.x+o.w>a&&lift<o.h-1){o.hit=true;st=0;endGame(true);continue}
      if(o.x+o.w<a){o.cleared=true;G.streak++;showHud();
        if(G.streak%5===0)gsGoal=Math.min(1.6,1+0.08*G.streak/5);
        if(isMile(G.streak))celebrate()}}
    if(!G.over){G.since+=move;if(G.since>=G.gap)spawn()}
    else if(!G.obs.length&&st<0)G=null}
  function hideHint(){if(hint&&!hint.hidden){hint.classList.add('gone');hintT=-1;setTimeout(function(){if(hint.classList.contains('gone'))hint.hidden=true},400)}}
  function updateExtras(dt,fs){
    var g0=GS;GS+=(gsGoal-GS)*Math.min(1,dt*1.2);if(Math.abs(GS-g0)>0.002||(GS!==1&&!G))hillRate(GS);
    if(hintT>=0){hintT+=dt;if(hintT>4)hideHint()}
    if(pumpT>=0){pumpT+=dt;pp.jump.pump=st>=0?0:Math.sin(Math.PI*Math.min(1,pumpT/1.1));if(pumpT>1.1){pumpT=-1;pp.jump.pump=0}}
    if(burst>=0){burst+=dt;if(burst>0.7)burst=-1}
    for(var i=signs.length-1;i>=0;i--){signs[i].x-=fs*SPD*GS*dt;if(signs[i].x<-60)signs.splice(i,1)}}
  function drawSigns(ctx,gy){signs.forEach(function(sg){var x=sg.x,top=gy-46;
    ctx.fillStyle='#C9A24A';ctx.fillRect(x+21,top+14,3,32);                      // post
    ctx.fillStyle='#13233D';ctx.strokeStyle='#E8C96A';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.rect(x,top,46,16);ctx.fill();ctx.stroke();
    ctx.fillStyle='#E8C96A';ctx.font='700 10px "Barlow Condensed","Arial Narrow",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('MILE '+sg.n,x+23,top+8.5);ctx.textAlign='start';ctx.textBaseline='alphabetic'})}
  function drawBurst(ctx,gy){if(burst<0)return;var k=burst/0.7,cx=rw/2,cy=gy-72,r=12+70*(1-Math.pow(1-k,2));
    ctx.strokeStyle='rgba(242,213,122,'+(0.85*(1-k)).toFixed(3)+')';ctx.lineWidth=3*(1-k)+1;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='rgba(46,155,173,'+(0.6*(1-k)).toFixed(3)+')';ctx.lineWidth=1.5;
    for(var i=0;i<10;i++){var a=i/10*Math.PI*2+0.3,r1=r*0.75,r2=r*1.05;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);ctx.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2);ctx.stroke()}}
  var FALL=0;   // forward tilt in degrees, pivoting on his front foot
  function updateStumble(dt){var J=pp.jump;if(st<0){FALL=0;SPD+=(1-SPD)*Math.min(1,dt*4);return}
    st+=dt;var t=st;
    if(t<0.5){var k=t/0.5;FALL=84*k*k}                                   // trip and topple (speeds up like gravity)
    else if(t<0.66){var b=(t-0.5)/0.16;FALL=84-7*Math.sin(Math.PI*b)}    // small bounce off the grid
    else if(t<1.7){FALL=84}                                              // lie there a beat
    else if(t<2.35){var g=sm(1.7,2.35,t);FALL=84*(1-g)}                  // push back up
    else{FALL=0;st=-1}
    var down=st<0?0:Math.min(1,FALL/84);
    J.w=st<0?0:1;J.crouch=0.35*down+0.6*(t>1.7&&t<2.35?Math.sin(Math.PI*(t-1.7)/0.65):0);J.tuck=0.25*down;J.lift=0;
    SPD=st<0?SPD:Math.max(0,1-sm(0,0.45,t))+sm(1.85,2.35,t)}
  function drawObstacles(ctx,gy){if(!G)return;
    G.obs.forEach(function(o){var x=o.x,w=o.w,h=o.h;
      ctx.fillStyle='rgba(46,155,173,.45)';ctx.beginPath();ctx.ellipse(x+w/2,gy+0.5,w*0.75,2.2,0,0,Math.PI*2);ctx.fill();
      if(o.k==='rock'){
        ctx.fillStyle=o.hit?'#8A5A6E':'#5A6F92';ctx.beginPath();ctx.moveTo(x,gy);ctx.lineTo(x+w*0.12,gy-h*0.62);ctx.lineTo(x+w*(0.38+o.s*0.15),gy-h);
        ctx.lineTo(x+w*0.82,gy-h*0.78);ctx.lineTo(x+w,gy);ctx.closePath();ctx.fill();
        ctx.fillStyle=o.hit?'#B07A8C':'#8BA3C4';ctx.beginPath();ctx.moveTo(x+w*0.12,gy-h*0.62);ctx.lineTo(x+w*(0.38+o.s*0.15),gy-h);ctx.lineTo(x+w*0.82,gy-h*0.78);ctx.lineTo(x+w*0.55,gy-h*0.45);ctx.closePath();ctx.fill();
        ctx.strokeStyle='rgba(242,213,122,.95)';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(x+w*0.12,gy-h*0.62);ctx.lineTo(x+w*(0.38+o.s*0.15),gy-h);ctx.lineTo(x+w*0.82,gy-h*0.78);ctx.stroke()}
      else{
        ctx.lineCap='round';ctx.strokeStyle=o.hit?'#A0687A':'#9A6A44';ctx.lineWidth=h*0.6;
        ctx.beginPath();ctx.moveTo(x,gy+1);ctx.quadraticCurveTo(x+w*0.45,gy-h*1.45,x+w,gy+1);ctx.stroke();
        ctx.strokeStyle=o.hit?'#A0687A':'#7E5534';ctx.lineWidth=h*0.32;ctx.beginPath();ctx.moveTo(x+w*0.55,gy-h*0.55);ctx.quadraticCurveTo(x+w*0.75,gy-h*0.2,x+w*0.82,gy+1);ctx.stroke();
        ctx.strokeStyle='rgba(242,213,122,.95)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x+w*0.12,gy-h*0.5);ctx.quadraticCurveTo(x+w*0.4,gy-h*1.2,x+w*0.62,gy-h*0.7);ctx.stroke()}})}
  var lastFist=null;
  function footX(p,rx){var q=pp.leg(p,[0,0]);return rx+(q.an[0]+40)*SCALE}
  function drawRunner(dt){rctx.clearRect(0,0,rw,rh);if(!pp)return;var gy=rh-5,rx=rw/2-6;
    var air=Math.min(1,pp.jump.lift/HEIGHT),sw=1-0.45*air;   // shadow shrinks and fades while he's in the air
    rctx.fillStyle='rgba(0,0,0,'+(0.42*(1-0.5*air)).toFixed(3)+')';rctx.beginPath();rctx.ellipse(rw/2+6,gy,26*sw,3.5*sw,0,0,Math.PI*2);rctx.fill();
    drawAidShadow(rctx,gy);
    drawSigns(rctx,gy);
    drawRipples(gy,dt||0,pp.groundSpeed*SCALE/CYCLE*SPD*GS);
    drawObstacles(rctx,gy);
    if(body.width!==run.width||body.height!==run.height){body.width=rim.width=run.width;body.height=rim.height=run.height}
    bctx.setTransform(dpr,0,0,dpr,0,0);bctx.clearRect(0,0,rw,rh);bctx.save();if(FALL){var fx=rx+10;bctx.translate(fx,gy);bctx.rotate(FALL*Math.PI/180);bctx.translate(-fx,-gy)}var me=pp.draw(bctx,ph,rx,gy,SCALE);bctx.restore();drawDog(bctx,gy+1);
    if(aid){lastFist=me.fist;drawAid(bctx,gy,aid.step==='give'||aid.step==='eat'||aid.step==='still'?me.fist:null)}
    rctx.save();rctx.setTransform(1,0,0,1,0,0);rctx.drawImage(body,0,0);rctx.restore();
    edge(1.3,1.1,'#F2D57A',0.95);    // sun behind him: gold along the back and top
    edge(-0.6,-1.1,'#2E9BAD',0.55);  // grid glow from below: teal along the underside
    drawCrumbs(rctx);
    drawBurst(rctx,gy)}
  function frame(t){if(!on){last=0;return}var dt=last?Math.min(.05,(t-last)/1000):0;last=t;
    if(pp){var prev=ph,jumping=jt>=0||st>=0||RUNK<0.6,fs=pp.groundSpeed*SCALE/CYCLE*RUNK;ph=(ph+dt*SPD*GS*RUNK/CYCLE)%1;off+=fs*SPD*GS*dt;updateJump(dt);updateStumble(dt);updateDog(dt,fs*SPD);updateGame(dt,fs);updateExtras(dt,fs);updateAid(dt,rh-5,lastFist);
      if(!jumping&&ph<prev)ripples.push({x:footX(0,rw/2-6),t:0});            // near foot lands at the start of the cycle
      if(!jumping&&prev<0.5&&ph>=0.5)ripples.push({x:footX(0,rw/2-6)+10*SCALE,t:0})} // far foot lands halfway (same pose, one step later)
    drawGrid();drawRunner(dt);
    if(still&&jt<0&&!hd&&!ripples.length){on=false;return}   // reduced motion: stop again once the jump is over
    requestAnimationFrame(frame)}
  var btn=box.querySelector('.jump'),paw=box.querySelector('.paw'),swap=box.querySelector('.outfit'),aidBtn=box.querySelector('.aid');
  if(aidBtn)aidBtn.addEventListener('click',function(e){e.stopPropagation();aidStation()});
  if(paw)paw.addEventListener('click',function(e){e.stopPropagation();hooper()});
  if(btn)btn.addEventListener('click',function(e){e.stopPropagation();jump()});
  if(swap)swap.addEventListener('click',function(e){e.stopPropagation();nextOutfit()});
  if(playBtn)playBtn.addEventListener('click',function(e){e.stopPropagation();play()});
  box.addEventListener('click',function(e){if(!e.target.closest('a'))jump()});
  
  function start(){pp=makePuppet(imgs,PARTS,{imgScale:0.3});size();drawGrid();drawRunner();if(btn)btn.hidden=false;if(swap){swap.hidden=false;labelSwap()}if(playBtn&&!still)playBtn.hidden=false;showHud();loadDog();loadTravis();if(still){on=false;return}
    if('IntersectionObserver' in window){new IntersectionObserver(function(e){var v=e[0].isIntersecting;if(v&&!on){on=true;requestAnimationFrame(frame)}on=v}).observe(box)}
    requestAnimationFrame(frame)}
  function loadDog(){var dn=['torso','head','fu','fl','fp','hu','hl','hp'],di={},dl=dn.length;
    dn.forEach(function(n){var i=new Image();i.onload=i.onerror=function(){if(--dl===0&&dn.every(function(k){return di[k].naturalWidth>0})){dog=makeDog(di,DOGPARTS,{imgScale:0.3});if(paw&&!(G&&!G.over))paw.hidden=false}};
      i.src='scene/hooper/'+n+'.webp?v=5';di[n]=i})}
  names.forEach(function(n){var i=new Image();i.onload=i.onerror=function(){if(--left===0)outfitImages().then(start)};i.src='scene/runner/'+n+'.webp?v=3';imgs[n]=i});
  size();drawGrid();window.addEventListener('resize',function(){size();drawGrid();drawRunner()});
})();
