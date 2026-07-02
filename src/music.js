// Background music: real recordings of public-domain classical pieces,
// sourced from Wikimedia Commons with verified licenses (PD / CC BY 3.0).
// Full attribution in CREDITS.md. One track per level, looping.

const TRACKS = [
  { file: 'assets/music/canon-in-d.mp3', title: 'Pachelbel — Canon in D (Kevin MacLeod, CC BY)' },
  { file: 'assets/music/blue-danube.mp3', title: 'Strauss — The Blue Danube (US Marine Band)' },
  { file: 'assets/music/espana.mp3', title: 'Chabrier — España (USAF Strolling Strings)' },
  { file: 'assets/music/mountain-king.mp3', title: 'Grieg — In the Hall of the Mountain King (Kevin MacLeod, CC BY)' },
  { file: 'assets/music/flight-of-the-bumblebee.mp3', title: 'Rimsky-Korsakov — Flight of the Bumblebee (USAF Band)' },
  { file: 'assets/music/tannhauser.mp3', title: 'Wagner — Tannhäuser Overture (US Marine Band)' },
  { file: 'assets/music/zauberflote.mp3', title: 'Mozart — Die Zauberflöte Overture (Musopen Symphony)' },
  { file: 'assets/music/jupiter.mp3', title: 'Holst — Jupiter, the Bringer of Jollity (Skidmore College Orchestra / Musopen)' },
  { file: 'assets/music/hungarian-dance-1.mp3', title: 'Brahms — Hungarian Dance No. 1 (USAF Strolling Strings)' },
  { file: 'assets/music/light-cavalry.mp3', title: 'Suppé — Light Cavalry Overture (US Marine Band)' },
  { file: 'assets/music/swan-lake-waltz.mp3', title: 'Tchaikovsky — Swan Lake, Waltz' },
  { file: 'assets/music/beethoven-5.mp3', title: 'Beethoven — Symphony No. 5, I. Allegro con brio' },
  { file: 'assets/music/william-tell.mp3', title: 'Rossini — William Tell Overture (US Marine Corps Band)' },
  { file: 'assets/music/morning-mood.mp3', title: 'Grieg — Morning Mood (Musopen Symphony)' },
  { file: 'assets/music/anitras-dance.mp3', title: "Grieg — Anitra's Dance (Musopen Symphony)" },
  { file: 'assets/music/danse-macabre.mp3', title: 'Saint-Saëns — Danse Macabre (Kevin MacLeod, CC BY)' },
  { file: 'assets/music/spring.mp3', title: 'Vivaldi — Spring, I. Allegro (John Harrison, CC BY-SA)' },
  { file: 'assets/music/toccata-fugue.mp3', title: 'Bach — Toccata and Fugue in D minor (Kevin MacLeod, CC BY)' },
  { file: 'assets/music/bald-mountain.mp3', title: 'Mussorgsky — Night on Bald Mountain' },
  { file: 'assets/music/stars-and-stripes.mp3', title: 'Sousa — The Stars and Stripes Forever (USAF Band)' },
];

let audio = null;
let muted = false;

export const music = {
  play(levelIdx) {
    this.stop();
    audio = new Audio(TRACKS[levelIdx % TRACKS.length].file);
    audio.loop = true;
    audio.volume = 0.35;
    audio.muted = muted;
    // all callers are click handlers, so autoplay policy is satisfied
    audio.play().catch(() => {});
  },
  stop() {
    if (audio) audio.pause();
    audio = null;
  },
  toggleMute() {
    muted = !muted;
    if (audio) audio.muted = muted;
    return muted;
  },
  nowPlaying: (levelIdx) => TRACKS[levelIdx % TRACKS.length].title,
};
