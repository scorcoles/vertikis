//es Vertikis: criaturas blandas de colores, con cara, que caen, se empujan y se deforman al
//es chocar, y que se pueden arrastrar, inflar hasta que exploten y crear. Un experimento de VERTIK.
//es Homenaje a la home de yugop.com (Yugo Nakamura, 2005).
//en Vertikis: soft, colourful creatures with faces that fall, push each other and squash
//en when they collide, and that you can drag, inflate until they burst, and create. An experiment by VERTIK.
//en A tribute to the yugop.com home page (Yugo Nakamura, 2005).
//es@16
//es@16 Este archivo se genera con «node tools/build.mjs» a partir de src/vertikis.js.
//en@16
//en@16 This file is generated with «node tools/build.mjs» from src/vertikis.js.

//es =========================================================================================
//es Paso 1 · El escenario: un canvas que ocupa la ventana
//es =========================================================================================
//en =========================================================================================
//en Step 1 · The stage: a canvas that fills the window
//en =========================================================================================

const canvas = document.querySelector('[data-cells]');
//es El «pincel» con el que dibujamos en el canvas.
//en The «brush» we draw on the canvas with.
const ctx = canvas.getContext('2d');

//es Ancho y alto del escenario, en píxeles CSS.
//en Width and height of the stage, in CSS pixels.
let W = 0;
let H = 0;

function resize() {
  //es En pantallas retina hay 2 píxeles reales por cada píxel CSS: dibujamos al doble para
  //es que se vea nítido (como mucho ×2, para no gastar de más).
  //en On retina screens there are 2 real pixels per CSS pixel: we draw at double size so it
  //en looks sharp (×2 at most, so we don't overdo it).
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const first = W === 0; // @3
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  //es A partir de aquí dibujamos en píxeles CSS y el navegador multiplica por dpr.
  //en From here on we draw in CSS pixels and the browser multiplies by dpr.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  //es@3-6 La primera vez, creamos un vertiki en el centro.
  //en@3-6 The first time, we create one vertiki in the middle.
  if (first) cells = [makeCell(W / 2, H * 0.35, Math.min(W, H) * 0.2)]; // @3-6
  //es@7 La primera vez, llenamos el escenario (paso 7).
  //en@7 The first time, we fill the stage (step 7).
  if (first) populate(); // @7
}

//>> 1-1
//es Para probar: un círculo rojo en el centro.
//en To try it out: a red circle in the middle.
function draw() {
  ctx.fillStyle = 'tomato';
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.2, 0, Math.PI * 2);
  ctx.fill();
}
//<<

//>> 2-2
//es Para probar: un círculo que cruza la pantalla. Cada fotograma: borrar, mover, dibujar.
//en To try it out: a circle crossing the screen. Every frame: clear, move, draw.
let x = 0;
function draw() {
  ctx.clearRect(0, 0, W, H);
  x = (x + 3) % (W + 200);
  ctx.fillStyle = 'tomato';
  ctx.beginPath();
  ctx.arc(x - 100, H / 2, 80, 0, Math.PI * 2);
  ctx.fill();
}
//<<

//>> 3
//es =========================================================================================
//es Paso 3 · El objeto vertiki: un anillo de puntos
//es =========================================================================================
//en =========================================================================================
//en Step 3 · The vertiki object: a ring of points
//en =========================================================================================

//es Puntos del contorno de cada vertiki.
//en Points around the outline of each vertiki.
const POINTS = 28;

//es Forma de reposo común: un círculo de radio 1. Cada vertiki la multiplica por su radio.
//es Guardamos x e y seguidas: [x0, y0, x1, y1, …].
//en Shared resting shape: a circle of radius 1. Each vertiki multiplies it by its radius.
//en We store x and y one after the other: [x0, y0, x1, y1, …].
const UNIT = new Float32Array(POINTS * 2);
for (let i = 0; i < POINTS; i++) {
  const a = (i / POINTS) * Math.PI * 2;
  UNIT[i * 2] = Math.cos(a);
  UNIT[i * 2 + 1] = Math.sin(a);
}

//>> 10
//es Paso 10 · Colores planos, alegres pero algo apagados.
//en Step 10 · Flat colours, cheerful but slightly muted.
const PALETTE = ['#f29e4c', '#f2c14e', '#4fb3a9', '#ef7aa1', '#6c9bd2', '#9ccc5a', '#4caf72', '#9b86c9', '#f0806c'];

//es Mezcla un color hex con blanco (t > 0) o con negro (t < 0).
//en Mixes a hex colour with white (t > 0) or with black (t < 0).
function tint(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const to = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  const ch = (v) => Math.round(v + (to - v) * k);
  return `rgb(${ch(n >> 16)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}
//<<

//es Todos los vertikis («células») del escenario.
//en All the vertikis («cells») on the stage.
let cells = [];

function makeCell(cx, cy, r) {
  //>> 10
  //es Paso 10 · Forma de reposo un poco ovalada (orgánica, no un círculo perfecto): el eje
  //es largo mide r·(1+e) y el corto r·(1−e), con el eje largo en una dirección al azar.
  //en Step 10 · A slightly oval resting shape (organic, not a perfect circle): the long axis
  //en is r·(1+e) and the short one r·(1−e), with the long axis pointing in a random direction.
  const e = 0.02 + Math.random() * 0.04;
  const turn = Math.random() * Math.PI;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  //<<
  const x = new Float32Array(POINTS);
  const y = new Float32Array(POINTS);
  for (let i = 0; i < POINTS; i++) {
    x[i] = cx + UNIT[i * 2] * r; // @3-9
    y[i] = cy + UNIT[i * 2 + 1] * r; // @3-9
    const qx = UNIT[i * 2] * r * (1 + e); // @10
    const qy = UNIT[i * 2 + 1] * r * (1 - e); // @10
    x[i] = cx + qx * cos - qy * sin; // @10
    y[i] = cy + qx * sin + qy * cos; // @10
  }
  const color = PALETTE[Math.floor(Math.random() * PALETTE.length)]; // @10
  return {
    //es Radio de reposo.
    //en Resting radius.
    r,
    //es Posición actual de cada punto.
    //en Current position of each point.
    x,
    y,
    //es Posición en el paso anterior (paso 4: Verlet).
    //en Position in the previous step (step 4: Verlet).
    px: x.slice(),
    py: y.slice(),
    //es Centro de la forma (y, desde el paso 6, su giro).
    //en Centre of the shape (and, from step 6, its rotation).
    cx,
    cy,
    angle: 0, // @6-9
    //>> 10
    //es Paso 10 · cuánto se ovala, giro inicial y colores.
    //en Step 10 · how oval it is, starting rotation and colours.
    e,
    angle: turn,
    color,
    light: tint(color, 0.16),
    shade: tint(color, -0.06),
    //<<
    //>> 12
    //es Paso 12 · La cara. «base» es el giro con el que nació: la cara se mide desde aquí,
    //es para que nazca derecha. smile: 0 = «:)», 1 = «:D», con un muelle (smileV).
    //en Step 12 · The face. «base» is the rotation it was born with: the face is measured
    //en from here, so it starts upright. smile: 0 = «:)», 1 = «:D», on a spring (smileV).
    base: turn,
    smile: 0,
    smileV: 0,
    lookX: 0,
    lookY: 0,
    blinkAt: performance.now() + 1000 + Math.random() * 5000,
    surprisedUntil: 0,
    squintUntil: 0,
    vx: 0,
    vy: 0,
    prevCx: cx,
    prevCy: cy,
    //<<
    //>> 13
    //es Paso 13 · Inflarse: el radio al que crece, su radio de siempre (al que vuelve
    //es desinflándose) y cuándo lo inflaron por última vez.
    //en Step 13 · Inflating: the radius it grows to, its usual radius (which it shrinks back
    //en to) and when it was last inflated.
    target: undefined,
    rest: r,
    inflatedAt: 0,
    //<<
    //>> 15
    //es Paso 15 · Al lanzarlo: hasta cuándo suena al chocar, y con quién se tocaba ya.
    //en Step 15 · When thrown: until when it sounds on impact, and who it was already touching.
    thrownUntil: undefined,
    touching: undefined,
    //<<
  };
}
//<<

//>> 7
//es =========================================================================================
//es Paso 7 · Muchos vertikis
//es =========================================================================================
//en =========================================================================================
//en Step 7 · Lots of vertikis
//en =========================================================================================

//es Tamaños variados y algo montados entre sí, para que al arrancar se empujen y queden
//es apretados y aplastados por los contactos.
//en Assorted sizes, slightly overlapping, so that at the start they push each other and end
//en up packed together and flattened where they touch.
function populate() {
  cells = [];
  const unit = Math.min(W, H);
  //es Superficie que ocupan: la mitad de la pantalla.
  //en Area they cover: half the screen.
  const target = W * H * 0.5;
  let area = 0;
  for (let tries = 0; tries < 6000 && area < target; tries++) {
    const r = unit * (0.09 + Math.random() ** 1.3 * 0.12);
    const cx = r * 0.6 + Math.random() * (W - r * 1.2);
    const cy = r * 0.6 + Math.random() * (H - r * 1.2);
    //es Si se monta demasiado sobre otro, probamos en otro sitio.
    //en If it overlaps another one too much, we try somewhere else.
    if (cells.some((c) => Math.hypot(c.cx - cx, c.cy - cy) < (c.r + r) * 0.82)) continue;
    cells.push(makeCell(cx, cy, r));
    area += Math.PI * r * r;
  }
}
//<<

//>> 4
//es =========================================================================================
//es Pasos 4, 5, 6, 8 y 9 · La física
//es =========================================================================================
//en =========================================================================================
//en Steps 4, 5, 6, 8 and 9 · The physics
//en =========================================================================================

//es Paso 9: cuántas veces calculamos la física en cada fotograma.
//en Step 9: how many times we run the physics each frame.
const SUBSTEPS = 4; // @9
//es Paso 4: cuánta velocidad conserva cada punto en cada paso.
//en Step 4: how much speed each point keeps on every step.
const FRICTION = 0.96;
//es@6 Paso 6: cuánto tira cada punto hacia su forma de reposo.
//en@6 Step 6: how strongly each point pulls towards its resting shape.
const STIFFNESS = 0.45; // @6
//es Gravedad (px por paso²).
//en Gravity (px per step²).
const GRAVITY = 0.45; // @4-15
//>> 16
//es Paso 16 · En el móvil, más baja y con la dirección que marque la inclinación del
//es teléfono; en escritorio, siempre hacia abajo. gravX y gravY: su dirección (largo 1).
//en Step 16 · On a phone it's lower and points wherever the phone is tilted; on a desktop,
//en always down. gravX and gravY: its direction (length 1).
const touchDevice = window.matchMedia('(pointer: coarse)').matches;
const GRAVITY = touchDevice ? 0.27 : 0.45;
let gravX = 0;
let gravY = 1;
//<<

//>> 11
//es Paso 11 · El puntero: el vertiki agarrado, el que está bajo el ratón y dónde está el puntero.
//en Step 11 · The pointer: the grabbed vertiki, the one under the mouse and where the pointer is.
let grabbed = null;
let hovered = null;
let grabOffset = { x: 0, y: 0 };
let pointer = { x: 0, y: 0 };
//<<
//es@12 Paso 12 · Hasta que se mueve el puntero, los ojos miran al frente.
//en@12 Step 12 · Until the pointer moves, the eyes look straight ahead.
let pointerSeen = false; // @12

//>> 6
//es Paso 6 · Dónde está y cuánto ha girado la forma: el centro es la media de los puntos;
//es el giro, el ángulo que mejor encaja la forma de reposo con la actual.
//en Step 6 · Where the shape is and how far it has turned: the centre is the average of the
//en points; the rotation, the angle that best fits the resting shape onto the current one.
function fitShape(c) {
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < POINTS; i++) {
    sx += c.x[i];
    sy += c.y[i];
  }
  c.cx = sx / POINTS;
  c.cy = sy / POINTS;
  let dot = 0;
  let cross = 0;
  for (let i = 0; i < POINTS; i++) {
    const qx = UNIT[i * 2] * c.r; // @6-9
    const qy = UNIT[i * 2 + 1] * c.r; // @6-9
    const qx = UNIT[i * 2] * c.r * (1 + c.e); // @10
    const qy = UNIT[i * 2 + 1] * c.r * (1 - c.e); // @10
    const rx = c.x[i] - c.cx;
    const ry = c.y[i] - c.cy;
    dot += qx * rx + qy * ry;
    cross += qx * ry - qy * rx;
  }
  c.angle = Math.atan2(cross, dot);
}
//<<

function step() {
  for (const c of cells) {
    //es Paso 4 · Inercia con fricción, más la gravedad (integración de Verlet: la velocidad
    //es es la diferencia entre la posición actual y la anterior).
    //en Step 4 · Inertia with friction, plus gravity (Verlet integration: the velocity is
    //en the difference between the current position and the previous one).
    for (let i = 0; i < POINTS; i++) {
      const f = FRICTION; // @4-10
      //es@11 El agarrado se frena más: así sigue al puntero sin oscilar.
      //en@11 The grabbed one is damped more, so it follows the pointer without wobbling.
      const f = c === grabbed ? 0.6 : FRICTION; // @11
      const vx = (c.x[i] - c.px[i]) * f;
      const vy = (c.y[i] - c.py[i]) * f;
      c.px[i] = c.x[i];
      c.py[i] = c.y[i];
      c.x[i] += vx; // @4-15
      c.y[i] += vy + GRAVITY; // @4-15
      c.x[i] += vx + GRAVITY * gravX; // @16
      c.y[i] += vy + GRAVITY * gravY; // @16
    }

    //>> 11
    //es Paso 11 · Arrastre: todo el vertiki se acerca al puntero. La posición anterior se
    //es mueve casi lo mismo, para no acumular velocidad (temblaría); el 30 % que queda es el
    //es impulso con el que sale lanzado al soltarlo.
    //en Step 11 · Dragging: the whole vertiki moves towards the pointer. The previous position
    //en moves almost as much, so it doesn't build up speed (it would shake); the remaining 30 %
    //en is the push it flies off with when you let go.
    if (c === grabbed) {
      const dx = (pointer.x - grabOffset.x - c.cx) * 0.35;
      const dy = (pointer.y - grabOffset.y - c.cy) * 0.35;
      for (let i = 0; i < POINTS; i++) {
        c.x[i] += dx;
        c.y[i] += dy;
        c.px[i] += dx * 0.7;
        c.py[i] += dy * 0.7;
      }
    }
    //<<

    //>> 6
    //es Paso 6 · Vuelta a la forma de reposo, girada y centrada como está ahora.
    //en Step 6 · Back to the resting shape, rotated and centred as it is now.
    fitShape(c);
    const cos = Math.cos(c.angle);
    const sin = Math.sin(c.angle);
    for (let i = 0; i < POINTS; i++) {
      const qx = UNIT[i * 2] * c.r; // @6-9
      const qy = UNIT[i * 2 + 1] * c.r; // @6-9
      const qx = UNIT[i * 2] * c.r * (1 + c.e); // @10
      const qy = UNIT[i * 2 + 1] * c.r * (1 - c.e); // @10
      //es Dónde «debería» estar este punto.
      //en Where this point «should» be.
      const gx = c.cx + qx * cos - qy * sin;
      const gy = c.cy + qx * sin + qy * cos;
      c.x[i] += (gx - c.x[i]) * STIFFNESS;
      c.y[i] += (gy - c.y[i]) * STIFFNESS;
    }
    //<<
  }

  //>> 8
  //es Paso 8a · Choques por puntos: cada punto que entra en otro vertiki (visto como un
  //es círculo) sale hacia fuera. Así se aplastan por la zona de contacto.
  //en Step 8a · Point collisions: every point that gets inside another vertiki (treated as a
  //en circle) is pushed back out. That's how they flatten where they touch.
  for (let a = 0; a < cells.length; a++) {
    const A = cells[a];
    for (let b = 0; b < cells.length; b++) {
      if (a === b) continue;
      const B = cells[b];
      //es Si están lejos, ni lo miramos.
      //en If they're far apart, we don't even check.
      const reach = A.r + B.r;
      if (Math.abs(A.cx - B.cx) > reach || Math.abs(A.cy - B.cy) > reach) continue;
      const R = B.r * 0.96;
      for (let i = 0; i < POINTS; i++) {
        const dx = A.x[i] - B.cx;
        const dy = A.y[i] - B.cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R * R || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = (R - d) * 0.5;
        A.x[i] += (dx / d) * push;
        A.y[i] += (dy / d) * push;
      }
    }
  }

  //es Paso 8b · Separación entre vertikis enteros: si dos centros están más cerca de lo que
  //es permiten sus tamaños (con un 12 % de margen para que se sigan aplastando), se apartan
  //es como bloques. Pesan según su superficie.
  //en Step 8b · Separating whole vertikis: if two centres are closer than their sizes allow
  //en (with a 12 % margin so they still squash), they're pushed apart as blocks. They weigh
  //en according to their area.
  //es@11 El agarrado pesa más, para poder apartar a los demás.
  //en@11 The grabbed one weighs more, so it can shove the others aside.
  for (let a = 0; a < cells.length; a++) {
    const A = cells[a];
    for (let b = a + 1; b < cells.length; b++) {
      const B = cells[b];
      let dx = B.cx - A.cx;
      let dy = B.cy - A.cy;
      let d = Math.hypot(dx, dy);
      const min = (A.r + B.r) * 0.88;
      if (d >= min) continue;
      if (d < 0.01) {
        //es Centros casi iguales: se separan en una dirección al azar.
        //en Centres almost identical: they split in a random direction.
        const t = Math.random() * Math.PI * 2;
        dx = Math.cos(t);
        dy = Math.sin(t);
        d = 1;
      }
      const nx = dx / d;
      const ny = dy / d;
      const ma = A.r * A.r; // @8-10
      const mb = B.r * B.r; // @8-10
      const ma = A.r * A.r * (A === grabbed ? 6 : 1); // @11
      const mb = B.r * B.r * (B === grabbed ? 6 : 1); // @11
      //es La mitad del solape por paso (estable); casi todo sin añadir velocidad.
      //en Half the overlap per step (stable); almost all of it without adding speed.
      const push = (min - d) * 0.5;
      const sa = push * (mb / (ma + mb));
      const sb = push * (ma / (ma + mb));
      for (let i = 0; i < POINTS; i++) {
        A.x[i] -= nx * sa;
        A.y[i] -= ny * sa;
        A.px[i] -= nx * sa * 0.8;
        A.py[i] -= ny * sa * 0.8;
        B.x[i] += nx * sb;
        B.y[i] += ny * sb;
        B.px[i] += nx * sb * 0.8;
        B.py[i] += ny * sb * 0.8;
      }
      A.cx -= nx * sa;
      A.cy -= ny * sa;
      B.cx += nx * sb;
      B.cy += ny * sb;
    }
  }
  //<<

  //>> 5
  //es Paso 5 · Los límites: ningún punto sale de la ventana. Al tocar un borde se frena el
  //es deslizamiento a lo largo de él (rozamiento), en los cuatro bordes.
  //en Step 5 · The edges: no point leaves the window. Touching an edge slows down sliding
  //en along it (friction), on all four edges.
  for (const c of cells) {
    for (let i = 0; i < POINTS; i++) {
      if (c.x[i] < 0 || c.x[i] > W) {
        c.x[i] = c.x[i] < 0 ? 0 : W;
        c.py[i] = c.y[i] - (c.y[i] - c.py[i]) * 0.6;
      }
      if (c.y[i] < 0 || c.y[i] > H) {
        c.y[i] = c.y[i] < 0 ? 0 : H;
        c.px[i] = c.x[i] - (c.x[i] - c.px[i]) * 0.6;
      }
    }
  }
  //<<
}
//<<

//>> 3
//es =========================================================================================
//es Dibujar (pasos 3, 10, 12 y 13)
//es =========================================================================================
//en =========================================================================================
//en Drawing (steps 3, 10, 12 and 13)
//en =========================================================================================

//>> 13
//es Paso 13 · Gotas de los globos que explotan y ondas que se abren.
//en Step 13 · Droplets from burst balloons and rings that spread out.
let drops = [];
let rings = [];
//<<
//es@12 Paso 12 · Tinta de las caras.
//en@12 Step 12 · Ink for the faces.
const INK = '#1b1b1b'; // @12

function draw() {
  ctx.clearRect(0, 0, W, H);

  for (const c of cells) {
    //es@3-9 Un gris neutro, hasta que lleguen los colores en el paso 10.
    //en@3-9 A neutral grey, until colours arrive in step 10.
    ctx.fillStyle = '#cfcfcf'; // @3-9
    //>> 10
    //es Paso 10 · Levísimo degradado: luz fija arriba a la izquierda, más claro ahí y un poco
    //es más oscuro en el borde opuesto.
    //en Step 10 · A very faint gradient: a fixed light at the top left, lighter there and a
    //en little darker on the opposite edge.
    const g = ctx.createRadialGradient(c.cx - c.r * 0.35, c.cy - c.r * 0.4, c.r * 0.05, c.cx, c.cy, c.r * 1.25);
    g.addColorStop(0, c.light);
    g.addColorStop(0.55, c.color);
    g.addColorStop(1, c.shade);
    ctx.fillStyle = g;
    //<<
    //es Paso 3 · Contorno suave: curvas que pasan por los puntos medios del anillo.
    //en Step 3 · Smooth outline: curves through the midpoints of the ring.
    ctx.beginPath();
    const mx = (c.x[POINTS - 1] + c.x[0]) / 2;
    const my = (c.y[POINTS - 1] + c.y[0]) / 2;
    ctx.moveTo(mx, my);
    for (let i = 0; i < POINTS; i++) {
      const j = (i + 1) % POINTS;
      ctx.quadraticCurveTo(c.x[i], c.y[i], (c.x[i] + c.x[j]) / 2, (c.y[i] + c.y[j]) / 2);
    }
    ctx.fill();
    //>> 3-3
    //es Para verlo: los 28 puntos del anillo.
    //en To see it: the 28 points of the ring.
    ctx.fillStyle = '#000';
    for (let i = 0; i < POINTS; i++) {
      ctx.beginPath();
      ctx.arc(c.x[i], c.y[i], 3, 0, Math.PI * 2);
      ctx.fill();
    }
    //<<
  }

  //>> 12
  //es Paso 12 · Caras: dos ojos que miran al puntero y parpadean, y una sonrisa que se curva
  //es más con el ratón encima. Reacciones: «o» de susto y ojos apretados «> <».
  //en Step 12 · Faces: two eyes that follow the pointer and blink, and a smile that curves
  //en more when you hover. Reactions: a startled «o» and squeezed eyes «> <».
  const now = performance.now();
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const c of cells) {
    //es Todo se mide en proporción al radio.
    //en Everything is measured relative to the radius.
    const s = c.r;
    const squint = now < c.squintUntil;
    const surprised = !squint && now < c.surprisedUntil;
    ctx.save();
    ctx.translate(c.cx, c.cy);
    //es La cara se inclina con lo que gira el cuerpo, pero amortiguado (×0,35): reacciona al
    //es rodar sin quedar nunca boca abajo.
    //en The face tilts with the body's rotation, but damped (×0.35): it reacts to rolling
    //en without ever ending up upside down.
    const turned = Math.atan2(Math.sin(c.angle - c.base), Math.cos(c.angle - c.base));
    ctx.rotate(turned * 0.35);

    //es Ojos.
    //en Eyes.
    const eye = Math.max(1, s * 0.036) * (surprised ? 1.35 : 1);
    ctx.lineWidth = Math.max(1, s * 0.03);
    for (const side of [-1, 1]) {
      const ex = side * s * 0.22;
      const ey = -s * 0.12;
      if (squint) {
        //es «>» y «<»: dos trazos que apuntan hacia el centro de la cara.
        //en «>» and «<»: two strokes pointing towards the centre of the face.
        const d = eye * 1.8;
        ctx.beginPath();
        ctx.moveTo(ex + side * d, ey - d);
        ctx.lineTo(ex - side * d * 0.4, ey);
        ctx.lineTo(ex + side * d, ey + d);
        ctx.stroke();
        continue;
      }
      //es Parpadeo: el ojo se aplasta en vertical durante ~130 ms.
      //en Blink: the eye squashes vertically for ~130 ms.
      const t = (now - c.blinkAt) / 130;
      const open = t >= 0 && t <= 1 ? Math.abs(1 - 2 * t) : 1;
      ctx.beginPath();
      ctx.ellipse(ex + c.lookX * s, ey + c.lookY * s, eye, Math.max(0.4, eye * open), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    //es Boca.
    //en Mouth.
    ctx.lineWidth = Math.max(1, s * 0.032);
    ctx.beginPath();
    if (surprised) {
      //es «o» de susto.
      //en Startled «o».
      ctx.arc(0, s * 0.12, s * 0.06, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      //es Un trozo de círculo que pasa por las dos comisuras y por el punto más bajo de la
      //es sonrisa. Con el ratón encima se hunde más (k de 0 a 1).
      //en A slice of a circle through both corners of the mouth and the lowest point of the
      //en smile. When you hover, it dips further (k from 0 to 1).
      const k = squint ? 0 : c.smile;
      const w = s * 0.16;
      const h = Math.max(0.05, w * (0.32 + 0.5 * k));
      const top = s * 0.06;
      const R = (w * w + h * h) / (2 * h);
      const centerY = top + h - R;
      const a0 = Math.asin(Math.min(1, (top - centerY) / R));
      ctx.arc(0, centerY, R, a0, Math.PI - a0);
      ctx.stroke();
    }
    ctx.restore();
  }
  //<<

  //>> 13
  //es Paso 13 · Gotas y ondas de los globos que explotan.
  //en Step 13 · Droplets and rings from burst balloons.
  for (const d of drops) {
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(d.x, d.y, Math.max(0.1, d.r * d.life), 0, Math.PI * 2);
    ctx.fill();
  }
  for (const g of rings) {
    ctx.strokeStyle = g.color;
    ctx.globalAlpha = 1 - g.t;
    ctx.lineWidth = 3 * (1 - g.t);
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r * (1 + 0.5 * g.t), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  //<<
}
//<<

//>> 2
//es =========================================================================================
//es Paso 2 · El bucle: unas 60 veces por segundo, calcular y dibujar
//es =========================================================================================
//en =========================================================================================
//en Step 2 · The loop: about 60 times a second, compute and draw
//en =========================================================================================

function frame() {
  updateHover(); // @11
  updateGravity(); // @16
  const now = performance.now(); // @12

  //>> 12
  for (const c of cells) {
    //es Paso 12 · La boca se abre o se cierra con un muelle (pequeño rebote, ~0,3 s).
    //en Step 12 · The mouth opens and closes on a spring (a small bounce, ~0.3 s).
    const want = c === hovered || c === grabbed ? 1 : 0;
    c.smileV = (c.smileV + (want - c.smile) * 0.22) * 0.68;
    c.smile += c.smileV;

    //es Paso 12 · Mirada: hacia el puntero, en el giro de la cara, como mucho un 3,5 % del radio.
    //en Step 12 · Gaze: towards the pointer, in the face's rotation, at most 3.5 % of the radius.
    const turned = Math.atan2(Math.sin(c.angle - c.base), Math.cos(c.angle - c.base)) * 0.35;
    let lx = 0;
    let ly = 0;
    if (pointerSeen) {
      const dx = pointer.x - c.cx;
      const dy = pointer.y - c.cy;
      const d = Math.hypot(dx, dy) || 1;
      const cos = Math.cos(-turned);
      const sin = Math.sin(-turned);
      lx = ((dx * cos - dy * sin) / d) * 0.035;
      ly = ((dx * sin + dy * cos) / d) * 0.035;
    }
    c.lookX += (lx - c.lookX) * 0.15;
    c.lookY += (ly - c.lookY) * 0.15;

    //es Paso 12 · Parpadeo: al acabar uno, el siguiente en 2–6 s (a veces doble, enseguida).
    //en Step 12 · Blinking: after one ends, the next in 2–6 s (sometimes a quick double).
    if (now > c.blinkAt + 130) c.blinkAt = now + (Math.random() < 0.2 ? 180 : 2000 + Math.random() * 4000);

    //es Paso 12 · Golpe fuerte: cambio brusco de velocidad del centro de un fotograma a otro.
    //en Step 12 · Hard knock: a sudden change in the centre's speed from one frame to the next.
    const vx = c.cx - c.prevCx;
    const vy = c.cy - c.prevCy;
    if (Math.hypot(vx - c.vx, vy - c.vy) > 7 && c !== grabbed) c.squintUntil = now + 320;
    c.vx = vx;
    c.vy = vy;
    c.prevCx = c.cx;
    c.prevCy = c.cy;

    //>> 13
    //es Paso 13 · Al inflarlo (y, desde el paso 14, al nacer) crece rápido hasta su objetivo.
    //es Si nadie lo toca en 1,2 s, se va desinflando despacio hasta su tamaño de siempre.
    //en Step 13 · When inflated (and, from step 14, when born) it quickly grows to its target.
    //en If nobody touches it for 1.2 s, it slowly deflates back to its usual size.
    if (c.target !== undefined) {
      c.r += (c.target - c.r) * 0.2;
      if (Math.abs(c.target - c.r) < 0.5) c.target = undefined;
    } else if (c.r > c.rest && now - c.inflatedAt > 1200) {
      c.r += (c.rest - c.r) * 0.003;
      if (c.r - c.rest < 0.3) c.r = c.rest;
    }
    //<<

    //>> 15
    //es Paso 15 · Lanzado: un «toc» suave cada vez que empieza a tocar a otro (ver «bump»).
    //en Step 15 · Thrown: a soft «tock» every time it starts touching another one (see «bump»).
    if (c.thrownUntil !== undefined) {
      if (now > c.thrownUntil) {
        c.thrownUntil = undefined;
        c.touching = undefined;
      } else {
        const touching = new Set();
        for (const k of cells) {
          if (k === c || Math.hypot(k.cx - c.cx, k.cy - c.cy) > (c.r + k.r) * 0.92) continue;
          touching.add(k);
          if (!c.touching.has(k)) bump(Math.hypot(c.vx - k.vx, c.vy - k.vy), Math.min(c.r, k.r));
        }
        c.touching = touching;
      }
    }
    //<<
  }
  //<<

  //>> 13
  //es Paso 13 · Gotas con gravedad que se encogen; ondas que se abren y se apagan (~0,4 s).
  //en Step 13 · Droplets with gravity that shrink; rings that spread and fade (~0.4 s).
  for (const d of drops) {
    d.vy += 0.35;
    d.vx *= 0.98;
    d.x += d.vx;
    d.y += d.vy;
    d.life -= 0.025;
  }
  drops = drops.filter((d) => d.life > 0 && d.y < H + 20);
  for (const g of rings) g.t += 0.06;
  rings = rings.filter((g) => g.t < 1);
  //<<

  step(); // @4-8
  //es@9 Paso 9 · Varios pasos pequeños de física por fotograma: más estable que uno grande.
  //en@9 Step 9 · Several small physics steps per frame: steadier than one big one.
  for (let s = 0; s < SUBSTEPS; s++) step(); // @9
  draw();
  requestAnimationFrame(frame);
}
//<<

//>> 15
//es =========================================================================================
//es Paso 15 · Sonidos (Web Audio, sintetizados; sin archivos)
//es =========================================================================================
//en =========================================================================================
//en Step 15 · Sounds (Web Audio, synthesised; no files)
//en =========================================================================================

//es El navegador no deja sonar nada hasta el primer clic o toque: hasta entonces, mudo.
//es «master» es el volumen general: todo pasa por aquí.
//en The browser won't play anything until the first click or tap: until then, silence.
//en «master» is the overall volume: everything goes through it.
let audio = null;
let master = null;
let unlocked = false;
const VOLUME = 0.66;

function ac() {
  if (!audio) {
    audio = new AudioContext();
    master = audio.createGain();
    master.gain.value = VOLUME;
    master.connect(audio.destination);
  }
  if (audio.state === 'suspended') audio.resume();
  return audio;
}

//es Un tono que va de una frecuencia a otra, con una envolvente corta (sube y se apaga).
//en A tone that sweeps from one frequency to another, with a short envelope (up, then fade).
function tone(from, to, dur, vol, type = 'sine') {
  try {
    const a = ac();
    const t = a.currentTime;
    const osc = a.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    const gain = a.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch {}
}

//es Explotar: golpe de ruido que se apaga hacia grave, como un globo, más un «thump».
//en Bursting: a burst of noise that fades towards the low end, like a balloon, plus a «thump».
function popSound(size) {
  try {
    const a = ac();
    const t = a.currentTime;
    //es 0,1 s de ruido blanco: números al azar entre −1 y 1.
    //en 0.1 s of white noise: random numbers between −1 and 1.
    const len = Math.ceil(a.sampleRate * 0.1);
    const buffer = a.createBuffer(1, len, a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buffer;
    //es Un filtro que deja pasar los graves y se va cerrando: «pfff» → «pf».
    //en A filter that lets the lows through and keeps closing: «pfff» → «pf».
    const filter = a.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.08);
    const gain = a.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.41, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
    src.stop(t + 0.1);
    //es Los globos grandes explotan más graves.
    //en Big balloons burst lower.
    tone(160 - Math.min(80, size / 3), 50, 0.12, 0.19);
  } catch {}
}

//es Crear: «bloop» que sube, como una burbuja que nace (más grave cuanto más grande).
//en Creating: a rising «bloop», like a bubble being born (lower the bigger it is).
const createSound = (size) => tone(220 - Math.min(100, size / 2), 720 - Math.min(300, size), 0.14, 0.24);

//es Choque de un lanzado contra otro: «toc» grave y suave, más fuerte cuanto más rápido
//es llega y más grave cuanto más grande es el pequeño de los dos.
//en A thrown one hitting another: a low, soft «tock», louder the faster it arrives and
//en lower the bigger the smaller of the two is.
let lastBump = 0;
function bump(speed, size) {
  const now = performance.now();
  if (speed < 0.5 || now - lastBump < 60) return;
  lastBump = now;
  const f = Math.max(90, Math.min(260, 16000 / size));
  //es De casi un susurro (choque lento) a bastante más fuerte (choque rápido).
  //en From almost a whisper (slow hit) to quite a bit louder (fast hit).
  tone(f, f * 0.6, 0.09, Math.min(0.22, 0.02 + speed * 0.013));
}
//<<

//>> 13
//es =========================================================================================
//es Paso 13 · Inflar y explotar
//es =========================================================================================
//en =========================================================================================
//en Step 13 · Inflating and bursting
//en =========================================================================================

function pop(c) {
  cells = cells.filter((k) => k !== c);
  //es Los vecinos se asustan: «o» durante ~0,7 s.
  //en The neighbours get a fright: «o» for ~0.7 s.
  const until = performance.now() + 700;
  for (const k of cells) {
    if (Math.hypot(k.cx - c.cx, k.cy - c.cy) < (c.r + k.r) * 1.6) k.surprisedUntil = until;
  }
  if (grabbed === c) grabbed = null;
  if (hovered === c) hovered = null;
  rings.push({ x: c.cx, y: c.cy, r: c.r, t: 0, color: c.color });
  const n = 10 + Math.round(c.r / 8);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 3 + Math.random() * 6;
    drops.push({
      x: c.cx + Math.cos(a) * c.r * 0.8,
      y: c.cy + Math.sin(a) * c.r * 0.8,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 2,
      r: 2 + Math.random() * (c.r / 14),
      life: 1,
      color: c.color,
    });
  }
  popSound(c.r); // @15
}

//es Tocar un vertiki lo infla un 15 %; si pasa de cierto tamaño (un 34 % del lado corto de
//es la pantalla), explota. Es la única manera de que exploten.
//en Tapping a vertiki inflates it by 15 %; past a certain size (34 % of the short side of
//en the screen), it pops. It's the only way to pop them.
function inflate(c) {
  const next = (c.target ?? c.r) * 1.15;
  if (next > Math.min(W, H) * 0.34) {
    pop(c);
    return;
  }
  c.target = next;
  c.inflatedAt = performance.now();
  tone(300 - Math.min(120, next / 3), 900 - Math.min(400, next), 0.1, 0.14); // @15
}
//<<

//>> 14
//es =========================================================================================
//es Paso 14 · Nacer
//es =========================================================================================
//en =========================================================================================
//en Step 14 · Being born
//en =========================================================================================

//es Un vertiki nuevo de tamaño al azar, que nace pequeño y crece hasta su tamaño.
//en A new vertiki of random size, born small and growing to full size.
function spawn(x, y) {
  const target = Math.min(W, H) * (0.07 + Math.random() * 0.14);
  const c = makeCell(x, y, target * 0.15);
  c.target = target;
  c.rest = target;
  cells.push(c);
  createSound(target); // @15
}
//<<

//>> 11
//es =========================================================================================
//es Paso 11 · El puntero: arrastrar y hover (y, desde el paso 13, tocar para inflar)
//es =========================================================================================
//en =========================================================================================
//en Step 11 · The pointer: dragging and hover (and, from step 13, tapping to inflate)
//en =========================================================================================

//es El vertiki bajo el puntero (el de encima si se solapan: el último dibujado).
//en The vertiki under the pointer (the top one if they overlap: the last one drawn).
function cellAt(x, y) {
  for (let k = cells.length - 1; k >= 0; k--) {
    const c = cells[k];
    if (Math.hypot(x - c.cx, y - c.cy) <= c.r) return c;
  }
  return null;
}

//>> 13
//es Paso 13 · Un toque: pulsar y soltar enseguida (menos de 250 ms) sin mover el dedo (menos
//es de 10 px). Arrastrar no cuenta. Aquí apuntamos cuándo y dónde se pulsó, y sobre quién.
//en Step 13 · A tap: press and release quickly (under 250 ms) without moving your finger
//en (under 10 px). Dragging doesn't count. Here we note when and where you pressed, and on whom.
let press = null;
//<<
//>> 14
//es Paso 14 · Doble clic o doble toque en un hueco, detectado a mano para que funcione igual
//es con ratón y en táctil: dos pulsaciones en menos de 320 ms y a menos de 30 px.
//en Step 14 · Double-click or double-tap on an empty spot, detected by hand so it works the
//en same with a mouse and on touch screens: two presses less than 320 ms and 30 px apart.
let lastDown = { t: 0, x: 0, y: 0 };
//<<

canvas.addEventListener('pointerdown', (e) => {
  pointerSeen = true; // @12
  //>> 15
  //es Paso 15 · Primer gesto: ya se puede sonar.
  //en Step 15 · First gesture: sound is allowed now.
  //es@16 Paso 16 · Y en iPhone, pedir el acelerómetro.
  //en@16 Step 16 · And on iPhone, ask for the motion sensor.
  if (!unlocked) {
    unlocked = true;
    ac();
    askTilt(); // @16
  }
  //<<
  pointer = { x: e.clientX, y: e.clientY };
  //>> 14
  //es Paso 14 · Doble clic en un hueco: nace un vertiki.
  //en Step 14 · Double-click on an empty spot: a vertiki is born.
  const now = performance.now();
  const double = now - lastDown.t < 320 && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 30;
  lastDown = double ? { t: 0, x: 0, y: 0 } : { t: now, x: e.clientX, y: e.clientY };
  if (double && !cellAt(e.clientX, e.clientY)) {
    spawn(e.clientX, e.clientY);
    return;
  }
  //<<

  grabbed = cellAt(e.clientX, e.clientY);
  press = grabbed && { cell: grabbed, t: performance.now(), x: e.clientX, y: e.clientY }; // @13
  if (!grabbed) return;
  grabOffset = { x: e.clientX - grabbed.cx, y: e.clientY - grabbed.cy };
  //es El agarrado pasa a dibujarse encima de los demás.
  //en The grabbed one is now drawn on top of the others.
  cells = [...cells.filter((c) => c !== grabbed), grabbed];
  //es Seguimos recibiendo el movimiento aunque el puntero salga del canvas.
  //en Keep receiving movement even if the pointer leaves the canvas.
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('is-dragging');
});

let mouseInside = false;
canvas.addEventListener('pointermove', (e) => {
  pointerSeen = true; // @12
  pointer = { x: e.clientX, y: e.clientY };
  mouseInside = e.pointerType === 'mouse';
});
canvas.addEventListener('pointerleave', () => {
  mouseInside = false;
  hovered = null;
});

function release(e) {
  //>> 13
  //es Paso 13 · Si ha sido un toque (corto y sin moverse), se infla.
  //en Step 13 · If it was a tap (short and without moving), it inflates.
  const tap = press && e && performance.now() - press.t < 250 && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 10;
  if (tap && cells.includes(press.cell)) inflate(press.cell);
  press = null;
  //<<
  //>> 15
  //es Paso 15 · Si sale lanzado (aunque sea flojito), sus choques suenan durante 1,5 s.
  //en Step 15 · If it's thrown (even gently), its impacts make a sound for 1.5 s.
  if (grabbed && Math.hypot(grabbed.vx, grabbed.vy) > 0.8) {
    const g = grabbed;
    g.thrownUntil = performance.now() + 1500;
    g.touching = new Set(cells.filter((k) => k !== g && Math.hypot(k.cx - g.cx, k.cy - g.cy) <= (k.r + g.r) * 0.92));
  }
  //<<
  grabbed = null;
  canvas.classList.remove('is-dragging');
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', () => release());

//es Qué hay bajo el ratón, en cada fotograma (los vertikis se mueven aunque el ratón esté
//es quieto): para el cursor (mano encima) y, desde el paso 12, la sonrisa.
//en What's under the mouse, every frame (vertikis move even when the mouse is still): for
//en the cursor (a hand on top) and, from step 12, the smile.
function updateHover() {
  hovered = mouseInside ? cellAt(pointer.x, pointer.y) : null;
  canvas.classList.toggle('is-over', !!hovered);
}
//<<

//>> 16
//es =========================================================================================
//es Paso 16 · El móvil: la gravedad sigue la inclinación del teléfono
//es =========================================================================================
//en =========================================================================================
//en Step 16 · On the phone: gravity follows the tilt
//en =========================================================================================

//es gamma: inclinación izquierda-derecha; beta: adelante-atrás. Se gira según cómo esté la
//es pantalla (vertical u horizontal) y se suaviza para que no tiemble.
//en gamma: left-right tilt; beta: front-back. It's rotated to match the screen orientation
//en (portrait or landscape) and smoothed so it doesn't jitter.
let tiltX = 0;
let tiltY = 1;
let tiltListening = false;

function onOrientation(e) {
  if (e.beta === null || e.gamma === null) return;
  const rad = Math.PI / 180;
  let x = Math.sin(e.gamma * rad);
  let y = Math.sin(e.beta * rad);
  //es Del aparato a la pantalla, según cómo esté girada.
  //en From the device to the screen, depending on how it's rotated.
  const a = (screen.orientation?.angle ?? 0) * rad;
  const sx = x * Math.cos(a) + y * Math.sin(a);
  const sy = -x * Math.sin(a) + y * Math.cos(a);
  x = sx;
  y = sy;
  //es Casi plano: poca gravedad. Inclinado del todo, como mucho la normal.
  //en Nearly flat: little gravity. Fully tilted: normal gravity at most.
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  tiltX = x;
  tiltY = y;
}

function listenTilt() {
  if (tiltListening || !touchDevice) return;
  tiltListening = true;
  window.addEventListener('deviceorientation', onOrientation);
}

//es El iPhone pide permiso, y solo se puede pedir dentro de un toque (ver «pointerdown»).
//en iPhone asks for permission, and it can only be requested inside a tap (see «pointerdown»).
const needsPermission = typeof window.DeviceOrientationEvent?.requestPermission === 'function';
if (touchDevice && window.DeviceOrientationEvent && !needsPermission) listenTilt();

function askTilt() {
  if (!touchDevice || !needsPermission || tiltListening) return;
  DeviceOrientationEvent.requestPermission()
    .then((state) => {
      if (state === 'granted') listenTilt();
    })
    .catch(() => {});
}

//es Cada fotograma, la gravedad se acerca a la de la inclinación.
//en Every frame, gravity moves closer to the tilt.
function updateGravity() {
  if (!tiltListening) return;
  gravX += (tiltX - gravX) * 0.1;
  gravY += (tiltY - gravY) * 0.1;
}
//<<

//es =========================================================================================
//es ¡Arrancamos!
//es =========================================================================================
//en =========================================================================================
//en Let's go!
//en =========================================================================================

//>> 1-1
window.addEventListener('resize', () => {
  resize();
  draw();
});
resize();
draw();
//<<
//>> 2
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
//<<
