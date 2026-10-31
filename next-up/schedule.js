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
    },
    {
      label: 'Race · Marathon',
      title: 'Pittsburgh Marathon',
      description: 'A training run this year. The goal: beat last year\'s time.',
      date: '2027-05-02',
      link: 'https://p3r.org/races/dick-s-sporting-goods-pittsburgh-marathon'
    },
    {
      label: 'Race · 100 miles',
      title: 'Rabid Raccoon 100',
      description: '100 miles at Brady\'s Run Park, Beaver Falls. The goal: finish.',
      date: '2027-06-05',
      showUntil: '2027-06-06',          // 4 AM Saturday start, runs into Sunday
      link: 'https://www.bikesignup.com/Race/Events/PA/BeaverFalls/RabidRaccoon100'
    },

    /* Waiting on 2027 dates. Each date below is a guess from past years.
       When the race posts its date, fix `date` and delete the `off: true` line. */
    {
      off: true,                        // 2026 was Sun, July 19
      label: 'Race · Half marathon',
      title: 'Presque Isle Half Marathon',
      description: 'Half marathon on Presque Isle in Erie, PA.',
      date: '2027-07-18',
      link: 'https://runsignup.com/Race/Info/PA/Erie/PresqueIsleHalfMarathon'
    },
    {
      off: true,                        // 2026 was Fri-Sat, Sept 11-12
      label: 'Race · 24 hours',
      title: 'Pain in Moraine',
      description: '24 hours of loops at Moraine State Park. The goal: 100 miles.',
      date: '2027-09-10',
      showUntil: '2027-09-11',          // 7 PM Friday start, finishes Saturday
      link: 'https://www.glacierridgetrailultra.com/'
    },
    {
      off: true,                        // 2026 was Sat, Oct 10
      label: 'Race · 100 miles',
      title: 'Oil Creek 100',
      description: 'Back to Titusville for the 100. The goal: finish.',
      date: '2027-10-09',
      showUntil: '2027-10-10',
      link: 'https://www.bikesignup.com/Race/PA/Titusville/OilCreek100TrailRuns'
    }
  ]
};
