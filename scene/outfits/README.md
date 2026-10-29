# Tristan wardrobe

Race day, trail runner, and cold weather are the final corrected outfits from
`chiefcrackt/inmotion-video` commit `fea7f9f`. These PNGs are local copies so
the links page does not depend on another website or cross-origin image loads.

`scene/runner.js` chooses uniformly from the three outfits once per document
load. The choice is not persisted; a reload may choose the same outfit again.
Only the chosen outfit's pieces are requested. The original head is retained,
and race/trail also retain the original forearms. The fitter adapts the source
50% sprites to the links page's 30% sprite scale and preserves the final shorts
and sleeve corrections. A loading/fitting failure falls back to Original Tristan.

The existing run cycle, jump, Hooper, game, and reduced-motion behavior remain
in the scene renderer.
