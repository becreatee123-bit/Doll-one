// ---------------------------------------------------------------------------
//  Easy settings – edit these without touching the rest of the code.
// ---------------------------------------------------------------------------
export const CONFIG = {
  // Shown in the welcome bubble. Leave "" to skip the name.
  herName: '',
  // {name} is replaced by herName (or removed if empty)
  greeting: 'Hi {name}! Tap the mic and say something 🎤',

  // Kid voice = recorded voice played back faster/higher (like Talking Tom).
  // 1.0 = her normal voice, ~1.4 = kid, ~1.9 = chipmunk.
  voice: { rate: 1.42, min: 1.1, max: 2.0 },

  // Characters available. Add more by creating js/characters/<name>.js
  // and registering it in js/characters/index.js, then listing its id here.
  characters: ['girl'],
  startCharacter: 'girl',
};
