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
  var FOOT=[-12,   0,   0,  24,  50,  44,  22,  -2];
  var ARM =[-44, -34, -12,  14,  28,  20,   0, -26];
  var ELB =[ 80,  82,  86,  92,  96,  92,  86,  82];
  function cr(k,p){var n=k.length,x=((p%1)+1)%1*n,i=Math.floor(x),t=x-i,a=k[(i-1+n)%n],b=k[i%n],c=k[(i+1)%n],d=k[(i+2)%n];
    return 0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)}
  function pt(o,l,a){return [o[0]+l*Math.sin(a*R),o[1]+l*Math.cos(a*R)]}
  var sole=parts.shoe.sole.map(function(q){return [q[0]*SHOE_SCALE,q[1]*SHOE_SCALE]});
  function leg(p,h){var hip=cr(HIP,p),shin=hip-cr(KNEE,p),foot=cr(FOOT,p),k=pt(h,TH.len,hip),an=pt(k,SN.len,shin),low=-1e9;
    sole.forEach(function(q){var r=rot(q,foot);low=Math.max(low,an[1]+r[1])});return {hip:hip,shin:shin,foot:foot,k:k,an:an,low:low}}
  function lift(p){var u=((p%0.5)+0.5)%0.5;return u>0.34&&u<0.5?22*Math.sin(Math.PI*(u-0.34)/0.16):0}
  var N=240,ys=[];for(var i=0;i<N;i++){var p=i/N,a=leg(p,[0,0]),b=leg(p+0.5,FAR_HIP);ys.push(-Math.max(a.low,b.low)-lift(p))}
  function hipY(p){var x=((p%1)+1)%1*N,i=Math.floor(x),t=x-i;return ys[i%N]*(1-t)+ys[(i+1)%N]*t}
  var groundSpeed=(leg(0.06,[0,0]).an[0]-leg(0.31,[0,0]).an[0])/0.25;
  var K=opt.imgScale||1;   // pieces are stored smaller than the source; joints stay in source units
  function piece(ctx,name,at,angle,sc){var info=parts[name]||parts[name.replace('_far','')];ctx.save();ctx.translate(at[0],at[1]);ctx.rotate(angle*R);if(sc)ctx.scale(sc,sc);
    ctx.scale(1/K,1/K);ctx.drawImage(imgs[name],-info.pivot[0]*K,-info.pivot[1]*K);ctx.restore()}
  function drawLeg(ctx,q,h,shade){ctx.save();if(shade)ctx.filter='brightness(0.72)';
    piece(ctx,'shin',q.k,SN.rest-q.shin);piece(ctx,'shoe',q.an,q.foot,SHOE_SCALE);piece(ctx,'thigh',h,TH.rest-q.hip);ctx.restore()}
  function drawArm(ctx,sh,p,shade){var sw=cr(ARM,p),fo=sw+cr(ELB,p),e=pt(sh,UA.len,sw);ctx.save();if(shade)ctx.filter='brightness(0.72)';
    piece(ctx,shade&&imgs.forearm_far?'forearm_far':'forearm',e,FA.rest-fo);piece(ctx,'upperarm',sh,UA.rest-sw);ctx.restore()}
  // Core motion. q = step phase (two steps per cycle). Landing is near q=0.25 (the "down" pose).
  function core(p){var T=Math.PI*2,q=p*2;
    return {
      pelvisTilt: 2.2*Math.sin(T*(q-0.05)),          // pelvis rocks a little with each step
      pelvisShift: 4*Math.cos(T*p),                   // near hip swings forward and back with the near leg
      torsoLean: LEAN+2.4*Math.sin(T*(q-0.2)),        // leans in a bit more on push-off
      squash: 1-0.018*Math.max(0,Math.cos(T*(q-0.25))),// tiny compress on landing
      shoulderTwist: 7*Math.sin(T*(p+0.25)),          // shoulders rotate against the hips
      headCounter: -0.75                              // head undoes most of the torso rock
    }}
  function draw(ctx,p,x,groundY,scale){
    ctx.save();ctx.translate(x,groundY);ctx.scale(scale,scale);
    var c=core(p),h=[0,hipY(p)];
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
  return {draw:draw,groundSpeed:groundSpeed,leg:leg,hipY:hipY}
}

/* Run scene for the links page: draws the cutout runner and the grid floor each frame, with the floor
   moving at exactly the speed the planted foot pushes back. Pauses when the scene is off screen. */
(function(){
  var box=document.querySelector('.scene');if(!box)return;
  var grid=box.querySelector('.grid'),run=box.querySelector('.runcv');if(!grid||!run)return;
  var gctx=grid.getContext('2d'),rctx=run.getContext('2d');
  var still=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CYCLE=0.8, SCALE=0.105, dpr=1, gw=0, gh=0, rw=0, rh=0, off=0, ph=0.1, last=0, on=true, pp=null;
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
  function drawRunner(){rctx.clearRect(0,0,rw,rh);if(!pp)return;var gy=rh-5;
    rctx.fillStyle='rgba(0,0,0,.42)';rctx.beginPath();rctx.ellipse(rw/2+6,gy,26,3.5,0,0,Math.PI*2);rctx.fill();
    pp.draw(rctx,ph,rw/2-6,gy,SCALE)}
  function frame(t){if(!on){last=0;return}var dt=last?Math.min(.05,(t-last)/1000):0;last=t;
    if(pp){ph=(ph+dt/CYCLE)%1;off+=pp.groundSpeed*SCALE/CYCLE*dt}
    drawGrid();drawRunner();requestAnimationFrame(frame)}
  function start(){pp=makePuppet(imgs,PARTS,{imgScale:0.3});size();drawGrid();drawRunner();if(still)return;
    if('IntersectionObserver' in window){new IntersectionObserver(function(e){var v=e[0].isIntersecting;if(v&&!on){on=true;requestAnimationFrame(frame)}on=v}).observe(box)}
    requestAnimationFrame(frame)}
  names.forEach(function(n){var i=new Image();i.onload=i.onerror=function(){if(--left===0)start()};i.src='scene/runner/'+n+'.webp';imgs[n]=i});
  size();drawGrid();window.addEventListener('resize',function(){size();drawGrid();drawRunner()});
})();
