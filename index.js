// Registry of characters. To add another girl / figure:
//   1. copy girl.js -> girl2.js and change colours / shapes (or pass options)
//   2. register it below
//   3. add its id to CONFIG.characters in js/config.js
import { createGirl } from './girl.js';

export const CHARACTERS = {
  girl: (THREE) => createGirl(THREE),
  // girl2: (THREE) => createGirl(THREE, { hair: 0xb5651d, skin: 0xf1c27d, dress: { base: '#2a6f6b', spots: ['#1d4c49', '#7fc7bd'] } }),
};
