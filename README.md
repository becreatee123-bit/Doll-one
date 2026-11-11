# Talking Doll 💖

A tiny 3D "Talking Tom"-style web app. Tap the mic, say something, and the doll
repeats it in a kid voice, with lip-sync. Poke or tickle her, or leave her alone
and she'll blink, breathe, look around and eventually yawn.

Everything is free and runs in the browser. Nothing you say is uploaded anywhere.

## Run it

Because it uses ES modules, open it through a web server (double-clicking
`index.html` won't work):

```
cd talking-doll
python3 -m http.server 8000     # then open http://localhost:8000
```

The microphone needs `https` or `localhost`. GitHub Pages gives you https.

## Put it on GitHub Pages (free)

1. Create a new GitHub repo and upload everything in this folder (keep the structure).
2. Repo → Settings → Pages → Source: "Deploy from a branch" → `main` / root.
3. Open `https://<your-username>.github.io/<repo-name>/` on your phone.

It loads Three.js from a CDN, so the device needs internet the first time.

## What's in here

| File | What it does |
|---|---|
| `index.html`, `style.css` | Page, mic button, pitch slider, welcome screen |
| `js/config.js` | **Easy settings**: her name, greeting text, default voice pitch |
| `js/characters/girl.js` | The 3D doll, built from code (hair, face, dress, base) |
| `js/characters/index.js` | List of characters (add more here) |
| `js/behavior.js` | Blinking, breathing, lip-sync, poke/tickle, yawn |
| `js/voice.js` | Mic listening, detects when she stops talking, kid-voice playback |
| `js/sfx.js` | Little synthesized giggle / "oh!" / yawn sounds |
| `js/main.js` | Scene, lights, camera, touch handling |

## Things to try on the phone

- Tap the mic, say something, wait a moment.
- Tap her head → surprised "oh!". Tap her body or hands → giggles.
- Drag a finger over her, or tap quickly 3 times → tickle.
- Drag the empty background → turn her around a bit.
- ⚙️ → voice pitch slider (kid ↔ chipmunk).
- Leave her alone for ~25 seconds → yawn.

## Customising

- **Name / greeting**: edit `js/config.js`.
- **Colours** (hair, skin, dress, base): options at the top of `js/characters/girl.js`
  (`GIRL_DEFAULTS`), or pass them in `js/characters/index.js`.
- **Add another girl**: copy `girl.js` to `girl2.js`, register it in
  `js/characters/index.js`, and add its id to `characters` in `js/config.js`.
  A number picker appears automatically when there is more than one.
- **New interactions**: add a method to `Behavior` in `js/behavior.js` and call it
  from `js/main.js`. The character only needs the small rig API (`setMouth`,
  `setBlink`, `setLook`, `setBrows`, `setHead`, `setBody`...).

## Known limits of this first version

- The kid voice is the recorded voice played faster/higher, which is how the real
  Talking Tom works. It keeps her real speech, but is a bit quick. The slider lets
  you tune it.
- The model is a hand-coded toy-style figure, so details like the dress print and
  hair waves are approximations of the reference.
