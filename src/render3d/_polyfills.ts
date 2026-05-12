// Polyfill browser globals that three.js GLTFLoader expects.
//
// React Native (Hermes engine) ships `navigator` as a truthy object
// but with `navigator.userAgent === undefined`. The GLTFParser
// constructor in three.js r169 (GLTFLoader.js:2579+) does:
//
//     if (typeof navigator !== 'undefined') {
//       const userAgent = navigator.userAgent;
//       const safariMatch = userAgent.match(/Version\/(\d+)/);  // <-- throws
//
// The `typeof navigator !== 'undefined'` guard passes but `userAgent`
// is undefined, so `.match()` throws 'Cannot read property "match" of
// undefined' for every single GLB parse. Build #20's About panel
// showed exactly this: '3D MODELS: 0/15, FIRST ERR: boat-row-small:
// Cannot read property "match" of undefined'.
//
// Setting a non-Safari, non-Firefox UA string satisfies the browser
// detection and lets parsing proceed. This module has side effects
// only and must be imported BEFORE any code that constructs a
// GLTFLoader / GLTFParser. CommonJS hoists imports to file top, so
// keeping this in its own module guarantees ordering.

const _g: any = globalThis as any;

if (typeof _g.navigator === 'undefined') {
  _g.navigator = { userAgent: 'react-native' };
} else if (!_g.navigator.userAgent) {
  try {
    _g.navigator.userAgent = 'react-native';
  } catch {
    _g.navigator = { ..._g.navigator, userAgent: 'react-native' };
  }
}

export const THREE_POLYFILLS_APPLIED = true;
