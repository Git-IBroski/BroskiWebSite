export interface CarouselMember {
  name: string;
  image: string;
  bgColor: string; // Colore HEX per lo sfondo del box nel carousel
}

// Configurazione del carousel: durata di ogni slide in millisecondi
export const CAROUSEL_INTERVAL_MS = 4000;

export const carouselMembers: CarouselMember[] = [
  { name: 'zZalix', image: '/skins/zZalix.png', bgColor: '#fc55f4ff' }, // Esempio: Primary Blue
  { name: 'un1verso', image: '/skins/un1verso.png', bgColor: '#4e4e4eff' }, // Esempio: Viola
  { name: "a\'", image: '/skins/a\'.png', bgColor: '#a2def0ff' }, // Esempio: Striking Red
  { name: 'Pirata91', image: '/skins/Pirata91.png', bgColor: '#212222ff' }, // Esempio: Blu chiaro
  { name: 'gabryX2', image: '/skins/gabryX2.png', bgColor: '#36a336ff' }, // Esempio: Verde Lime
  { name: 'MainSciamn', image: '/skins/MainSciamn.png', bgColor: '#440c0cff' }, // Esempio: Neon Cyan
  { name: 'Zeph', image: '/skins/Zeph.png', bgColor: '#5d4d2e' }, // Arancione
  { name: 'Zlem', image: '/skins/Zlem.png', bgColor: '#dddcdcff' }, // Bianco
  { name: 'NotAlexAgain', image: '/skins/NotAlexAgain.png', bgColor: '#7fd1b2ff' } // Esempio: Rosa
];
