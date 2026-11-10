/* Night shift (Easter egg): between 10pm and 5am in the visitor's own time the sun sets behind the ridge,
   a moon comes up, and the scene switches to headlamp mode (drawn in runner.js). Tapping the sun sets it
   by hand; tapping the moon brings the sun back. A tap only lasts for this visit (never saved).
   ?night opens straight into night mode. Fires a 'nightchange' event on the scene when it flips. */
(function(){
  var box=document.querySelector('.scene');if(!box)return;
  var hit=box.querySelector('.sunhit');
  var forced=false;try{forced=new URLSearchParams(location.search).has('night')}catch(e){}
  var manual=null;   // this visit's tap, overrides the clock until the page is reloaded
  function byClock(){var h=new Date().getHours();return h>=22||h<5}
  function want(){return manual!==null?manual:(forced||byClock())}
  function label(n){if(hit){hit.setAttribute('aria-pressed',n?'true':'false');hit.setAttribute('aria-label',n?'Bring the sun back up':'Set the sun')}}
  function apply(){var n=want();label(n);if(box.classList.contains('night')===n)return;
    box.classList.toggle('night',n);
    try{box.dispatchEvent(new CustomEvent('nightchange',{detail:{night:n}}))}catch(e){}}
  // First paint: no sunset animation, it's simply already night
  box.classList.add('notrans');apply();
  requestAnimationFrame(function(){requestAnimationFrame(function(){box.classList.remove('notrans')})});
  if(hit)hit.addEventListener('click',function(e){e.stopPropagation();manual=!box.classList.contains('night');apply()});
  setInterval(apply,60000);   // someone still here at 10pm gets the sunset
})();
