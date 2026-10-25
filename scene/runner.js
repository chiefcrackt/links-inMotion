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
  var SHOE_SCALE=opt.shoeScale||0.85, LEAN=opt.lean||6;
  var FAR_SH=opt.farShoulder||[10,4], FAR_HIP=opt.farHip||[10,-6];
  var HIP =[ 28,  14,   0, -20, -27, -12,  18,  38];
  var KNEE=[ 12,  38,  22,  10,  42, 100, 106,  72];
  var PF  =[  4, -24, -22,  10,  28,  18,   2, -18];   // ankle: + = toes pointed, - = toes pulled up
  var ARM =[-44, -34, -12,  14,  28,  20,   0, -26];
  var ELB =[ 80,  82,  86,  92,  96,  92,  86,  82];
  function cr(k,p){var n=k.length,x=((p%1)+1)%1*n,i=Math.floor(x),t=x-i,a=k[(i-1+n)%n],b=k[i%n],c=k[(i+1)%n],d=k[(i+2)%n];
    return 0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)}
  function pt(o,l,a){return [o[0]+l*Math.sin(a*R),o[1]+l*Math.cos(a*R)]}
  var sole=parts.shoe.sole.map(function(q){return [q[0]*SHOE_SCALE,q[1]*SHOE_SCALE]});
  // Jump state, set by the scene: tuck (0..1 knees up in the air), crouch (0..1 bent knees on the ground),
  // lift (source px above the ground), w (0..1 how much the jump overrides the stride's own hip height).
  var J={tuck:0,crouch:0,lift:0,w:0};
  function mixv(a,b,t){return a+(b-a)*t}
  function leg(p,h){var hip=cr(HIP,p),kn=cr(KNEE,p),pf=cr(PF,p);
    if(J.tuck>0){var T=Math.PI*2;hip=mixv(hip,40+10*Math.cos(T*p),J.tuck);kn=mixv(kn,108,J.tuck);pf=mixv(pf,32,J.tuck)}
    if(J.crouch>0){hip+=14*J.crouch;kn+=34*J.crouch}
    var shin=hip-kn,foot=-shin+pf,k=pt(h,TH.len,hip),an=pt(k,SN.len,shin),low=-1e9;
    sole.forEach(function(q){var r=rot(q,foot);low=Math.max(low,an[1]+r[1])});return {hip:hip,shin:shin,foot:foot,k:k,an:an,low:low}}
  function lift(p){var u=((p%0.5)+0.5)%0.5;return u>0.34&&u<0.5?22*Math.sin(Math.PI*(u-0.34)/0.16):0}
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
    var fo=sw+el,e=pt(sh,UA.len,sw);
    piece(ctx,shade&&imgs.forearm_far?'forearm_far':'forearm',e,FA.rest-fo,0,shade);piece(ctx,'upperarm',sh,UA.rest-sw,0,shade)}
  // Core motion. q = step phase (two steps per cycle). Landing is near q=0.25 (the "down" pose).
  function core(p){var T=Math.PI*2,q=p*2;
    return {
      pelvisTilt: 2.2*Math.sin(T*(q-0.05)),          // pelvis rocks a little with each step
      pelvisShift: 4*Math.cos(T*p),                   // near hip swings forward and back with the near leg
      torsoLean: LEAN+2.4*Math.sin(T*(q-0.2))+12*J.crouch,  // leans in a bit more on push-off (and when crouching to jump)
      squash: 1-0.018*Math.max(0,Math.cos(T*(q-0.25))),// tiny compress on landing
      shoulderTwist: 7*Math.sin(T*(p+0.25)),          // shoulders rotate against the hips
      headCounter: -0.75                              // head undoes most of the torso rock
    }}
  function draw(ctx,p,x,groundY,scale){
    ctx.save();ctx.translate(x,groundY);ctx.scale(scale,scale);
    var c=core(p),hy=hipY(p);
    if(J.w>0){var a=leg(p,[0,0]),b=leg(p+0.5,FAR_HIP),ground=-Math.max(a.low,b.low);hy=mixv(hy,ground,J.w)-J.lift}
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
    drawArm(ctx,sh,p,false);
    ctx.restore()}
  return {draw:draw,groundSpeed:groundSpeed,leg:leg,hipY:hipY,jump:J}
}

/* Hooper's joints, in the source parts sheet's pixels. */
var DOGPARTS={"torso":{"pivot":[113,195],"hip":[113,195],"sho":[410,202],"neck":[470,65],"tail":[20,95]},"head":{"pivot":[92,234]},"tail":{"pivot":[135,27]},"fu":{"pivot":[51,34],"end":[51,144]},"fl":{"pivot":[37,36],"end":[33,198]},"hu":{"pivot":[68,67],"end":[93,247]},"hl":{"pivot":[38,33],"end":[63,126]}};
/* Hooper: a trotting cutout dog. Each leg is two pieces (front: upper leg + forearm/paw, hind: thigh + hock/paw).
   Diagonal pairs move together (a trot). In stance the leg is nearly straight; in swing the lower piece folds
   so the paw lifts and tucks. Body height is solved each frame so the lowest paw touches the ground.
   Units are source pixels of the parts sheet; draw() scales to the screen. */
function makeDog(imgs, parts, opt){
  opt=opt||{};
  var R=Math.PI/180,T=Math.PI*2,K=opt.imgScale||1;
  function sub(a,b){return [a[0]-b[0],a[1]-b[1]]}
  function rot(v,a){var c=Math.cos(a*R),s=Math.sin(a*R);return [v[0]*c-v[1]*s,v[0]*s+v[1]*c]}
  function add(a,b){return [a[0]+b[0],a[1]+b[1]]}
  var P=parts,tor=P.torso;
  function rel(n){return sub(tor[n],tor.pivot)}
  var HIP=rel('hip'),SHO=rel('sho'),NECK=rel('neck'),TAILP=rel('tail');
  function bone(n){return sub(P[n].end,P[n].pivot)}
  var FU=bone('fu'),FL=bone('fl'),HU=bone('hu'),HL=bone('hl'),FAR=[22,-8];
  var dark={};
  function shade(n){if(dark[n])return dark[n];var s=imgs[n],c=document.createElement('canvas');c.width=s.naturalWidth||s.width;c.height=s.naturalHeight||s.height;
    var x=c.getContext('2d');x.drawImage(s,0,0);x.globalCompositeOperation='source-atop';x.fillStyle='rgba(8,14,30,.34)';x.fillRect(0,0,c.width,c.height);return dark[n]=c}
  function piece(ctx,n,at,ang,dk,sc){var i=P[n];ctx.save();ctx.translate(at[0],at[1]);ctx.rotate(ang*R);if(sc)ctx.scale(sc,sc);ctx.scale(1/K,1/K);
    ctx.drawImage(dk?shade(n):imgs[n],-i.pivot[0]*K,-i.pivot[1]*K);ctx.restore()}
  function sm(x){return x*x*(3-2*x)}
  // Angles in degrees, canvas rotation (+ = clockwise, which swings a hanging leg backward).
  // p: 0 = paw lands in front, 0..0.5 stance (paw sweeps back), 0.5..1 swing forward.
  function front(p){p=((p%1)+1)%1;var up=-22*Math.cos(T*p),lo=0;
    if(p>0.5){var u=(p-0.5)/0.5;lo=78*Math.pow(Math.sin(Math.PI*Math.min(1,u*1.15)),1.2)}   // wrist folds back, paw tucks up
    return {up:up,lo:up+lo}}
  function hind(p){p=((p%1)+1)%1;var up=-20*Math.cos(T*p)+4,lo=-6;
    if(p>0.5){var u=(p-0.5)/0.5;lo=-6-46*Math.sin(Math.PI*u)}                               // hock flexes, paw comes forward
    else{lo=-6+10*sm(Math.min(1,p/0.45))}                                                   // push-off extends the hock
    return {up:up,lo:up+lo}}
  function chain(at,u,l,ang){var k=add(at,rot(u,ang.up));return {k:k,paw:add(k,rot(l,ang.lo))}}
  function pose(p){
    var pitch=1.4*Math.sin(T*2*p+0.6);
    var sho=rot(SHO,pitch),hip=rot(HIP,pitch);
    var nf=front(p),ff=front(p+0.5),nh=hind(p+0.5),fh=hind(p);   // trot: near-front + far-hind together
    var a=chain(sho,FU,FL,nf),b=chain(add(sho,FAR),FU,FL,ff),c=chain(hip,HU,HL,nh),d=chain(add(hip,FAR),HU,HL,fh);
    var low=Math.max(a.paw[1],b.paw[1],c.paw[1],d.paw[1])+10;      // +10: thickness of the pad below the bone end
    return {pitch:pitch,sho:sho,hip:hip,nf:nf,ff:ff,nh:nh,fh:fh,a:a,b:b,c:c,d:d,y:-low}}
  var stride=(function(){var L=Math.hypot(FU[0],FU[1])+Math.hypot(FL[0],FL[1]);return 4*L*Math.sin(22*R)})();
  function draw(ctx,p,x,gy,scale,lift){
    var q=pose(p);ctx.save();ctx.translate(x,gy);ctx.scale(scale,scale);ctx.translate(0,q.y-(lift||0));
    var neck=rot(NECK,q.pitch),tl=rot(TAILP,q.pitch);
    function leg(u,l,at,ang,ch,dk){piece(ctx,l,ch.k,ang.lo,dk);piece(ctx,u,at,ang.up,dk)}
    leg('fu','fl',add(q.sho,FAR),q.ff,q.b,true);leg('hu','hl',add(q.hip,FAR),q.fh,q.d,true);
    piece(ctx,'torso',[0,0],q.pitch);
    piece(ctx,'tail',[tl[0]-10,tl[1]+26],-55+9*Math.sin(T*4*p)+q.pitch,false,0.65);   // Frenchie stub curling off the rump, quick wag
    leg('hu','hl',q.hip,q.nh,q.c,false);leg('fu','fl',q.sho,q.nf,q.a,false);
    piece(ctx,'head',[neck[0]-46,neck[1]+62],6-q.pitch*0.6+2*Math.sin(T*2*p+1));   // nose level, head set down into the shoulders
    ctx.restore()}
  return {draw:draw,stride:stride}
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
  var jt=-1,JUMP=0.95,HEIGHT=330;
  function sm(a,b,x){x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x)}
  function updateJump(dt,gy){var J=pp.jump;if(jt<0){J.tuck=J.crouch=J.lift=J.w=0;return}
    var prev=jt;jt+=dt;var t=jt;
    J.w=sm(0,0.07,t)*(1-sm(0.82,0.95,t));
    if(t<0.16){J.crouch=Math.sin(Math.PI/2*t/0.16);J.tuck=0;J.lift=0}
    else if(t<0.64){var u=(t-0.16)/0.48;J.lift=HEIGHT*4*u*(1-u);J.tuck=Math.pow(Math.sin(Math.PI*u),0.6);J.crouch=Math.max(0,1-u*7)}
    else{var v=(t-0.64)/(JUMP-0.64);J.lift=0;J.tuck=0;J.crouch=0.85*Math.sin(Math.PI*Math.min(1,v))}
    if(prev<0.64&&t>=0.64)ripples.push({x:rw/2+4,t:0,big:true});
    if(t>=JUMP){jt=-1;J.tuck=J.crouch=J.lift=J.w=0}}
  function wake(){if(!on){on=true;last=0;requestAnimationFrame(frame)}}
  function jump(){if(!pp||jt>=0)return;jt=0;if(hd)hd.hop=-0.14;wake()}   // Hooper hops a beat after Tristan
  // Hooper: trots in from the left, runs alongside, then dashes off ahead. null when he's not out.
  var dog=null,hd=null,DSCALE=0.075,STAY=10;
  function ease(x){return x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2}
  function hooper(){if(!dog)return;
    if(!hd){hd={mode:'in',t:0,p:0,x:-60,hop:-1};setPaw(true)}
    else if(hd.mode!=='out'){hd.mode='out';hd.t=0;hd.x0=hd.x;setPaw(false)}
    wake()}
  function setPaw(onn){if(paw){paw.setAttribute('aria-pressed',onn?'true':'false')}}
  function updateDog(dt,floorSpeed){if(!hd)return;var home=rw/2+30,px=hd.x;hd.t+=dt;
    if(hd.mode==='in'){var k=Math.min(1,hd.t/1.8);hd.x=-60+(home+60)*ease(k);if(k>=1){hd.mode='run';hd.t=0}}
    else if(hd.mode==='run'){hd.x=home+4*Math.sin(hd.t*0.9);if(hd.t>STAY){hd.mode='out';hd.t=0;hd.x0=hd.x}}
    else{var k=Math.min(1,hd.t/1.5);hd.x=hd.x0+(rw+80-hd.x0)*k*k;if(k>=1){hd=null;setPaw(false);return}}
    var vx=dt>0?(hd.x-px)/dt:0,stridePx=dog.stride*DSCALE;
    hd.p=(hd.p+dt*Math.max(0,floorSpeed+vx)/stridePx)%1;
    if(hd.hop>-1){hd.hop+=dt;if(hd.hop>0.5)hd.hop=-1}}
  function drawDog(ctx,gy){if(!hd)return;var lift=0,air=0;
    if(hd.hop>0){var u=hd.hop/0.5;lift=170*4*u*(1-u);air=lift/170}
    ctx.fillStyle='rgba(0,0,0,'+(0.38*(1-0.5*air)).toFixed(3)+')';ctx.beginPath();ctx.ellipse(hd.x+20,gy,22*(1-0.4*air),3*(1-0.4*air),0,0,Math.PI*2);ctx.fill();
    dog.draw(ctx,hd.p,hd.x,gy,DSCALE,lift)}
  function footX(p,rx){var q=pp.leg(p,[0,0]);return rx+(q.an[0]+40)*SCALE}
  function drawRunner(dt){rctx.clearRect(0,0,rw,rh);if(!pp)return;var gy=rh-5,rx=rw/2-6;
    var air=pp.jump.lift/HEIGHT,sw=1-0.45*air;   // shadow shrinks and fades while he's in the air
    rctx.fillStyle='rgba(0,0,0,'+(0.42*(1-0.5*air)).toFixed(3)+')';rctx.beginPath();rctx.ellipse(rw/2+6,gy,26*sw,3.5*sw,0,0,Math.PI*2);rctx.fill();
    drawRipples(gy,dt||0,pp.groundSpeed*SCALE/CYCLE);
    if(body.width!==run.width||body.height!==run.height){body.width=rim.width=run.width;body.height=rim.height=run.height}
    bctx.setTransform(dpr,0,0,dpr,0,0);bctx.clearRect(0,0,rw,rh);pp.draw(bctx,ph,rx,gy,SCALE);drawDog(bctx,gy+1);
    rctx.save();rctx.setTransform(1,0,0,1,0,0);rctx.drawImage(body,0,0);rctx.restore();
    edge(1.3,1.1,'#F2D57A',0.95);    // sun behind him: gold along the back and top
    edge(-0.6,-1.1,'#2E9BAD',0.55)}  // grid glow from below: teal along the underside
  function frame(t){if(!on){last=0;return}var dt=last?Math.min(.05,(t-last)/1000):0;last=t;
    if(pp){var prev=ph,jumping=jt>=0;ph=(ph+dt/CYCLE)%1;off+=pp.groundSpeed*SCALE/CYCLE*dt;updateJump(dt);updateDog(dt,pp.groundSpeed*SCALE/CYCLE);
      if(!jumping&&ph<prev)ripples.push({x:footX(0,rw/2-6),t:0});            // near foot lands at the start of the cycle
      if(!jumping&&prev<0.5&&ph>=0.5)ripples.push({x:footX(0,rw/2-6)+10*SCALE,t:0})} // far foot lands halfway (same pose, one step later)
    drawGrid();drawRunner(dt);
    if(still&&jt<0&&!hd&&!ripples.length){on=false;return}   // reduced motion: stop again once the jump is over
    requestAnimationFrame(frame)}
  var btn=box.querySelector('.jump'),paw=box.querySelector('.paw');
  if(paw)paw.addEventListener('click',function(e){e.stopPropagation();hooper()});
  if(btn)btn.addEventListener('click',function(e){e.stopPropagation();jump()});
  box.addEventListener('click',function(e){if(!e.target.closest('a'))jump()});
  
  function start(){pp=makePuppet(imgs,PARTS,{imgScale:0.3});size();drawGrid();drawRunner();if(btn)btn.hidden=false;loadDog();if(still){on=false;return}
    if('IntersectionObserver' in window){new IntersectionObserver(function(e){var v=e[0].isIntersecting;if(v&&!on){on=true;requestAnimationFrame(frame)}on=v}).observe(box)}
    requestAnimationFrame(frame)}
  function loadDog(){var dn=['torso','head','tail','fu','fl','hu','hl'],di={},dl=dn.length;
    dn.forEach(function(n){var i=new Image();i.onload=function(){if(--dl===0){dog=makeDog(di,DOGPARTS,{imgScale:0.3});if(paw)paw.hidden=false}};
      i.src='scene/hooper/'+n+'.webp?v=2';di[n]=i})}
  names.forEach(function(n){var i=new Image();i.onload=i.onerror=function(){if(--left===0)start()};i.src='scene/runner/'+n+'.webp?v=3';imgs[n]=i});
  size();drawGrid();window.addEventListener('resize',function(){size();drawGrid();drawRunner()});
})();
