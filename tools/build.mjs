// Genera, a partir de src/vertikis.js, el vertikis.js final y una página por paso del
// tutorial en cada idioma (steps/es/NN.html y steps/en/NN.html).
// Builds, from src/vertikis.js, the final vertikis.js and one page per tutorial step in
// each language (steps/es/NN.html and steps/en/NN.html).
//
//   node tools/build.mjs
//
// Nadie necesita esto para usar o aprender con vertikis: solo quien cambie el código.
// Nobody needs this to use or learn from vertikis: only whoever changes the code.
//
// Marcas en src/vertikis.js / Markers in src/vertikis.js:
//   //>> 4        … //<<   bloque incluido desde el paso 4 / block included from step 4 on
//   //>> 4-8      … //<<   solo en los pasos 4 a 8 / only in steps 4 to 8
//   código  // @4          línea incluida desde el paso 4 / line included from step 4 on
//   código  // @4-8        línea solo en los pasos 4 a 8 / line only in steps 4 to 8
//   //es texto · //en text   comentario en un idioma / comment in one language
//   //es@4 texto            comentario en un idioma desde el paso 4 (también @4-8)
//   //>> 17 … //<<  (o // @17)  solo en el vertikis.js final, no en el tutorial
//                            / only in the final vertikis.js, not in the tutorial

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/vertikis.js'), 'utf8');
const LAST = 16;

const STEPS = {
  es: [
    ['El escenario', 'Un círculo dibujado en un canvas que ocupa toda la ventana.'],
    ['El bucle', 'El círculo cruza la pantalla: borramos y dibujamos 60 veces por segundo.'],
    ['El objeto vertiki', 'Un anillo de 28 puntos y una curva suave que pasa por ellos.'],
    ['Moverse', 'Inercia, fricción y gravedad: el vertiki cae… y se sale por abajo.'],
    ['Los límites', 'Ya no se sale, pero se aplasta como una tortilla contra el suelo.'],
    ['Mantener la forma', 'Cada punto tira hacia su sitio: se aplasta un poco y recupera la forma.'],
    ['Muchos vertikis', 'Muchos, y se atraviesan como fantasmas.'],
    ['Choques', 'Se empujan, se apilan y se aplastan donde se tocan.'],
    ['Subpasos', 'Cuatro pasos de física por fotograma: más estable.'],
    ['Color y luz', 'Colores alegres, un degradado suave y formas un poco ovaladas.'],
    ['El puntero', 'Arrastra un vertiki y suéltalo con impulso.'],
    ['La cara', 'Ojos que miran al puntero y parpadean; sonríen si pasas por encima.'],
    ['Inflar y explotar', 'Toca un vertiki para inflarlo; si se pasa, ¡explota! Si lo dejas, se desinfla.'],
    ['Nacer', 'Doble clic en un hueco: nace un vertiki pequeño y se infla hasta su tamaño.'],
    ['El sonido', 'Lo mismo, con sonido (toca primero la pantalla para activarlo).'],
    ['El móvil', 'En el teléfono, la gravedad sigue la inclinación. Es el resultado final.'],
  ],
  en: [
    ['The stage', 'A circle drawn on a canvas that fills the whole window.'],
    ['The loop', 'The circle crosses the screen: we clear and redraw 60 times a second.'],
    ['The vertiki object', 'A ring of 28 points and a smooth curve through them.'],
    ['Moving', 'Inertia, friction and gravity: the vertiki falls… and drops off the bottom.'],
    ['The edges', 'It stays on screen now, but squashes flat as a pancake on the floor.'],
    ['Keeping the shape', 'Each point pulls towards its place: it squashes a little and bounces back.'],
    ['Lots of vertikis', 'Lots of them, passing through each other like ghosts.'],
    ['Collisions', 'They push, pile up and flatten where they touch.'],
    ['Substeps', 'Four physics steps per frame: steadier.'],
    ['Colour and light', 'Cheerful colours, a soft gradient and slightly oval shapes.'],
    ['The pointer', 'Drag a vertiki and let go to throw it.'],
    ['The face', 'Eyes that follow the pointer and blink; they smile when you hover.'],
    ['Inflating and bursting', 'Tap a vertiki to inflate it; too big and it bursts! Leave it and it deflates.'],
    ['Being born', 'Double-click an empty spot: a small vertiki is born and grows to full size.'],
    ['Sound', 'The same, with sound (tap the screen first to switch it on).'],
    ['On the phone', 'On a phone, gravity follows the tilt. This is the final result.'],
  ],
};

const UI = {
  es: { step: 'paso', of: 'de', prev: '← anterior', next: 'siguiente →', tutorial: 'tutorial', readme: 'README.md' },
  en: { step: 'step', of: 'of', prev: '← previous', next: 'next →', tutorial: 'tutorial', readme: 'README.en.md' },
};

const inRange = (step, from, to) => step >= Number(from) && (to === undefined ? true : step <= Number(to));

function render(step, lang) {
  const out = [];
  const stack = [];
  const active = () => stack.every(Boolean);
  for (const line of source.split('\n')) {
    const open = line.match(/^\s*\/\/>>\s*(\d+)(?:-(\d+))?\s*$/);
    if (open) {
      stack.push(inRange(step, open[1], open[2]));
      continue;
    }
    if (/^\s*\/\/<<\s*$/.test(line)) {
      stack.pop();
      continue;
    }
    if (!active()) continue;
    const comment = line.match(/^(\s*)\/\/(es|en)(?:@(\d+)(?:-(\d+))?)?(?: (.*))?$/);
    if (comment) {
      const [, indent, l, from, to, text = ''] = comment;
      if (l !== lang) continue;
      if (from !== undefined && !inRange(step, from, to)) continue;
      out.push(text ? `${indent}// ${text}` : `${indent}//`);
      continue;
    }
    const tag = line.match(/^(.*?)\s*\/\/ @(\d+)(?:-(\d+))?\s*$/);
    if (tag) {
      if (inRange(step, tag[2], tag[3])) out.push(tag[1]);
      continue;
    }
    out.push(line);
  }
  // Sin dos líneas en blanco seguidas, ni líneas en blanco al abrir o cerrar un bloque.
  return (
    out
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\{\n\n/g, '{\n')
      .replace(/\n\n(\s*\})/g, '\n$1')
      .trim() + '\n'
  );
}

const pad = (n) => String(n).padStart(2, '0');
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function page(step, lang) {
  const [title, hint] = STEPS[lang][step - 1];
  const ui = UI[lang];
  const code = render(step, lang)
    .split('\n')
    .map((l) => (l ? '      ' + l : l))
    .join('\n');
  const prev = step > 1 ? `<a href="${pad(step - 1)}.html">${ui.prev}</a>` : '';
  const next = step < LAST ? `<a href="${pad(step + 1)}.html">${ui.next}</a>` : '';
  // A partir del paso 11 hay cursores de agarrar; desde el 14, el «+» de crear.
  const cursors =
    step >= 11
      ? `
      canvas.is-over { cursor: grab; }
      canvas.is-dragging { cursor: grabbing; }`
      : '';
  const plus =
    step >= 14
      ? `
        cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M12 5v14M5 12h14' stroke='%23fff' stroke-width='5' stroke-linecap='round'/%3E%3Cpath d='M12 5v14M5 12h14' stroke='%23000' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") 12 12, crosshair;`
      : '';
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>vertikis · ${ui.step} ${step}: ${escape(title)}</title>
    <style>
      html, body { margin: 0; height: 100%; background: #fff; overflow: hidden; overscroll-behavior: none; }
      canvas {
        position: fixed; inset: 0; width: 100%; height: 100%; touch-action: none;${plus}
      }${cursors}
      .step {
        position: fixed; left: 8px; top: 8px; z-index: 1; max-width: calc(100vw - 16px); margin: 0;
        font: 10px/1.6 ui-monospace, Menlo, Consolas, monospace; letter-spacing: 0.04em; color: #000;
        pointer-events: none;
      }
      .step b { display: inline-block; padding: 2px 5px; background: #000; color: #fff; font-weight: normal; text-transform: uppercase; }
      .step a { color: inherit; pointer-events: auto; margin-right: 8px; }
    </style>
  </head>
  <body>
    <canvas data-cells></canvas>
    <p class="step">
      <b>${ui.step} ${step} ${ui.of} ${LAST} · ${escape(title)}</b><br />
      ${escape(hint)}<br />
      ${prev}${next}<a href="https://github.com/scorcoles/vertikis/blob/main/${ui.readme}#${ui.step}-${step}">${ui.tutorial}</a>
    </p>
    <script>
${code}    </script>
  </body>
</html>
`;
}

writeFileSync(join(root, 'vertikis.js'), render(LAST + 1, 'es'));
for (const lang of ['es', 'en']) {
  mkdirSync(join(root, 'steps', lang), { recursive: true });
  for (let s = 1; s <= LAST; s++) writeFileSync(join(root, 'steps', lang, `${pad(s)}.html`), page(s, lang));
}
console.log(`vertikis.js + ${LAST * 2} pasos / steps`);
