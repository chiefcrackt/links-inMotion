/* "Next up" card schedule. This is the only file to edit when plans change.

   The page shows ONE card: the soonest entry that is live today. An entry is
   live from `showFrom` through `showUntil` (both inclusive). When it expires,
   the next entry takes over on its own. If nothing is live, the card hides.

   Fields (dates are YYYY-MM-DD, read in the viewer's local time):
     label        Small gold line above the title, e.g. "Race · 50K". Optional.
     title        Required. Entries without one are skipped.
     description  One short sentence. Optional.
     date         Event day. Drives the countdown. Optional.
     link         https:// address the card opens. Optional; no link = plain card.
     showFrom     First day it can appear. Optional; default = right away.
     showUntil    Last day it appears. Optional; default = `date`.
                  With no date and no showUntil, it stays until you remove it.
     off          true pauses this entry without deleting it.

   Set `enabled: false` to hide the card everywhere.
*/
window.NEXT_UP = {
  enabled: true,
  items: [
    {
      label: 'Race · 50K',
      title: 'Last Trail Standing',
      description: '50K on the trails in Robinson Township, PA.',
      date: '2026-11-14',
      link: 'https://runsignup.com/Race/PA/Pittsburgh/LastTrailStanding'
    }
  ]
};
