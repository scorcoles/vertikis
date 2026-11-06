// Vertikis: criaturas blandas de colores, con cara, que caen, se empujan y se deforman al
// chocar, y que se pueden arrastrar, inflar hasta que exploten y crear. Un experimento de VERTIK.
// Homenaje a la home de yugop.com (Yugo Nakamura, 2005).
//
// Este archivo se genera con «node tools/build.mjs» a partir de src/vertikis.js.

// =========================================================================================
// Paso 1 · El escenario: un canvas que ocupa la ventana
// =========================================================================================

const canvas = document.querySelector('[data-cells]');
// El «pincel» con el que dibujamos en el canvas.
const ctx = canvas.getContext('2d');

// Ancho y alto del escenario, en píxeles CSS.
let W = 0;
let H = 0;

function resize() {
  // En pantallas retina hay 2 píxeles reales por cada píxel CSS: dibujamos al doble para
  // que se vea nítido (como mucho ×2, para no gastar de más).
  // En modo píxel (vertikis.style.pixel()), al revés: un píxel real por cada «píxel gordo».
  if (pixel) pixel = pixelSize();
  const dpr = pixel ? 1 / pixel : Math.min(window.devicePixelRatio || 1, 2);
  const first = W === 0;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  // A partir de aquí dibujamos en píxeles CSS y el navegador multiplica por dpr.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // La primera vez, llenamos el escenario (paso 7).
  if (first) populate();
}

// =========================================================================================
// Paso 3 · El objeto vertiki: un anillo de puntos
// =========================================================================================

// Puntos del contorno de cada vertiki.
const POINTS = 28;

// Forma de reposo común: un círculo de radio 1. Cada vertiki la multiplica por su radio.
// Guardamos x e y seguidas: [x0, y0, x1, y1, …].
const UNIT = new Float32Array(POINTS * 2);
for (let i = 0; i < POINTS; i++) {
  const a = (i / POINTS) * Math.PI * 2;
  UNIT[i * 2] = Math.cos(a);
  UNIT[i * 2 + 1] = Math.sin(a);
}

// Paso 10 · Colores planos, alegres pero algo apagados.
const PALETTE = ['#f29e4c', '#f2c14e', '#4fb3a9', '#ef7aa1', '#6c9bd2', '#9ccc5a', '#4caf72', '#9b86c9', '#f0806c'];

// Mezcla un color hex con blanco (t > 0) o con negro (t < 0).
function tint(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const to = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  const ch = (v) => Math.round(v + (to - v) * k);
  return `rgb(${ch(n >> 16)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}

// Todos los vertikis («células») del escenario.
let cells = [];

function makeCell(cx, cy, r) {
  // Paso 10 · Forma de reposo un poco ovalada (orgánica, no un círculo perfecto): el eje
  // largo mide r·(1+e) y el corto r·(1−e), con el eje largo en una dirección al azar.
  const e = 0.01 + Math.random() * 0.02;
  const turn = Math.random() * Math.PI;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const x = new Float32Array(POINTS);
  const y = new Float32Array(POINTS);
  for (let i = 0; i < POINTS; i++) {
    const qx = UNIT[i * 2] * r * (1 + e);
    const qy = UNIT[i * 2 + 1] * r * (1 - e);
    x[i] = cx + qx * cos - qy * sin;
    y[i] = cy + qx * sin + qy * cos;
  }
  const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
  return {
    // Radio de reposo.
    r,
    // Posición actual de cada punto.
    x,
    y,
    // Posición en el paso anterior (paso 4: Verlet).
    px: x.slice(),
    py: y.slice(),
    // Centro de la forma (y, desde el paso 6, su giro).
    cx,
    cy,
    // Paso 10 · cuánto se ovala, giro inicial y colores.
    e,
    angle: turn,
    color,
    light: tint(color, 0.16),
    shade: tint(color, -0.06),
    lightPx: tint(color, 0.14),
    shadePx: tint(color, -0.1),
    // Paso 12 · La cara. «base» es el giro con el que nació: la cara se mide desde aquí,
    // para que nazca derecha. smile: 0 = «:)», 1 = «:D», con un muelle (smileV).
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
    // Paso 13 · Inflarse: el radio al que crece, su radio de siempre (al que vuelve
    // desinflándose) y cuándo lo inflaron por última vez.
    target: undefined,
    rest: r,
    inflatedAt: 0,
    // Paso 15 · Al lanzarlo: hasta cuándo suena al chocar, y con quién se tocaba ya.
    thrownUntil: undefined,
    touching: undefined,
  };
}

// =========================================================================================
// Paso 7 · Muchos vertikis
// =========================================================================================

// Tamaños variados y algo montados entre sí, para que al arrancar se empujen y queden
// apretados y aplastados por los contactos.
function populate() {
  cells = [];
  const unit = sizeUnit();
  // Superficie que ocupan: la mitad de la pantalla.
  const target = W * H * fillShare();
  let area = 0;
  for (let tries = 0; tries < 6000 && area < target; tries++) {
    const r = unit * randomSize();
    const cx = r * 0.6 + Math.random() * (W - r * 1.2);
    const cy = r * 0.6 + Math.random() * (H - r * 1.2);
    // Si se monta demasiado sobre otro, probamos en otro sitio.
    if (cells.some((c) => Math.hypot(c.cx - cx, c.cy - cy) < (c.r + r) * 0.82)) continue;
    cells.push(makeCell(cx, cy, r));
    area += Math.PI * r * r;
  }
}

// =========================================================================================
// Pasos 4, 5, 6, 8 y 9 · La física
// =========================================================================================

// Paso 9: cuántas veces calculamos la física en cada fotograma.
const SUBSTEPS = 4;
// Paso 4: cuánta velocidad conserva cada punto en cada paso.
const FRICTION = 0.96;
// Paso 6: cuánto tira cada punto hacia su forma de reposo.
const STIFFNESS = 0.45;
// Gravedad (px por paso²).
// Paso 16 · En el móvil, más baja y con la dirección que marque la inclinación del
// teléfono; en escritorio, siempre hacia abajo. gravX y gravY: su dirección (largo 1).
// Táctil si tiene algún dedo posible: una tablet con lápiz o con teclado puede decir que su
// puntero principal es «fino», así que basta con que alguno sea táctil.
const touchDevice = navigator.maxTouchPoints > 0 || window.matchMedia('(any-pointer: coarse)').matches;
// En el móvil, un 15 % menos que en el tutorial: se apilan menos apretados.
const GRAVITY = touchDevice ? 0.23 : 0.45;
let gravX = 0;
let gravY = 1;

// Paso 11 · El puntero: el vertiki agarrado, el que está bajo el ratón y dónde está el puntero.
let grabbed = null;
let hovered = null;
let grabOffset = { x: 0, y: 0 };
let pointer = { x: 0, y: 0 };
// Paso 12 · Hasta que se mueve el puntero, los ojos miran al frente.
let pointerSeen = false;

// Paso 6 · Dónde está y cuánto ha girado la forma: el centro es la media de los puntos;
// el giro, el ángulo que mejor encaja la forma de reposo con la actual.
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
    const qx = UNIT[i * 2] * c.r * (1 + oval(c));
    const qy = UNIT[i * 2 + 1] * c.r * (1 - oval(c));
    const rx = c.x[i] - c.cx;
    const ry = c.y[i] - c.cy;
    dot += qx * rx + qy * ry;
    cross += qx * ry - qy * rx;
  }
  c.angle = Math.atan2(cross, dot);
}

function step() {
  // En el modo yugop flotan: menos gravedad y más rigidez (ver YUGOP).
  // En escritorio, la de yugop un 15 % más baja que en el móvil.
  // En halloween vuelan: sin gravedad, salvo un poco al inclinar el móvil, y a la deriva.
  const G = halloween ? (tiltListening ? GRAVITY * HALLOWEEN.tilt : 0) : yugop ? GRAVITY * YUGOP.gravity * (touchDevice ? 1 : 0.85) : GRAVITY;
  const t = performance.now() / 1000;
  if (halloween) ghostSpace();
  for (const c of cells) {
    const [wx, wy] = halloween ? ghostDrift(c, t) : [0, 0];
    // Paso 4 · Inercia con fricción, más la gravedad (integración de Verlet: la velocidad
    // es la diferencia entre la posición actual y la anterior).
    for (let i = 0; i < POINTS; i++) {
      // El agarrado se frena más: así sigue al puntero sin oscilar.
      const f = c === grabbed ? 0.6 : FRICTION;
      const vx = (c.x[i] - c.px[i]) * f;
      const vy = (c.y[i] - c.py[i]) * f;
      c.px[i] = c.x[i];
      c.py[i] = c.y[i];
      c.x[i] += vx + G * gravX + wx;
      c.y[i] += vy + G * gravY + wy;
    }

    // Paso 11 · Arrastre: todo el vertiki se acerca al puntero. La posición anterior se
    // mueve casi lo mismo, para no acumular velocidad (temblaría); el 30 % que queda es el
    // impulso con el que sale lanzado al soltarlo.
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

    // Paso 6 · Vuelta a la forma de reposo, girada y centrada como está ahora.
    fitShape(c);
    const cos = Math.cos(c.angle);
    const sin = Math.sin(c.angle);
    const K = stiffness(c);
    for (let i = 0; i < POINTS; i++) {
      const qx = UNIT[i * 2] * c.r * (1 + oval(c));
      const qy = UNIT[i * 2 + 1] * c.r * (1 - oval(c));
      // Dónde «debería» estar este punto.
      const gx = c.cx + qx * cos - qy * sin;
      const gy = c.cy + qx * sin + qy * cos;
      c.x[i] += (gx - c.x[i]) * K;
      c.y[i] += (gy - c.y[i]) * K;
    }
  }

  // Paso 8a · Choques por puntos: cada punto que entra en otro vertiki (visto como un
  // círculo) sale hacia fuera. Así se aplastan por la zona de contacto.
  for (let a = 0; a < cells.length; a++) {
    const A = cells[a];
    for (let b = 0; b < cells.length; b++) {
      if (a === b) continue;
      const B = cells[b];
      // Si están lejos, ni lo miramos.
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

  // Paso 8b · Separación entre vertikis enteros: si dos centros están más cerca de lo que
  // permiten sus tamaños (con un 12 % de margen para que se sigan aplastando), se apartan
  // como bloques. Pesan según su superficie.
  // El agarrado pesa más, para poder apartar a los demás.
  for (let a = 0; a < cells.length; a++) {
    const A = cells[a];
    for (let b = a + 1; b < cells.length; b++) {
      const B = cells[b];
      let dx = B.cx - A.cx;
      let dy = B.cy - A.cy;
      let d = Math.hypot(dx, dy);
      // El solape que se permite se mide con el más pequeño de los dos (con dos iguales,
      // lo mismo que antes): si no, un grande encima de uno pequeño lo deja chafado.
      const min = A.r + B.r - Math.min(A.r, B.r) * 0.24;
      if (d >= min) continue;
      if (d < 0.01) {
        // Centros casi iguales: se separan en una dirección al azar.
        const t = Math.random() * Math.PI * 2;
        dx = Math.cos(t);
        dy = Math.sin(t);
        d = 1;
      }
      const nx = dx / d;
      const ny = dy / d;
      const ma = A.r * A.r * (A === grabbed ? 6 : 1);
      const mb = B.r * B.r * (B === grabbed ? 6 : 1);
      // La mitad del solape por paso (estable); casi todo sin añadir velocidad.
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

  // Paso 5 · Los límites: ningún punto sale de la ventana. Al tocar un borde se frena el
  // deslizamiento a lo largo de él (rozamiento), en los cuatro bordes.
  for (const c of cells) {
    for (let i = 0; i < POINTS; i++) {
      if (c.x[i] < 0 || c.x[i] > W) {
        c.x[i] = c.x[i] < 0 ? 0 : W;
        c.py[i] = c.y[i] - (c.y[i] - c.py[i]) * 0.6;
      }
      if (c.y[i] < 0 || c.y[i] > floor) {
        c.y[i] = c.y[i] < 0 ? 0 : floor;
        c.px[i] = c.x[i] - (c.x[i] - c.px[i]) * 0.6;
      }
    }
  }
}

// =========================================================================================
// Dibujar (pasos 3, 10, 12 y 13)
// =========================================================================================

// Paso 13 · Gotas de los globos que explotan.
let drops = [];
// Paso 12 · Tinta de las caras.
const INK = '#1b1b1b';

function draw() {
  ctx.clearRect(0, 0, W, H);
  if (wire) wirePaper();
  if (riso) risoPaper();
  if (xmas) xmasSnow();
  if (evil) evilPaper();
  if (halloween) batsFly(performance.now());

  for (const c of cells) {
    if (wire) { wireBody(c); continue; }
    if (halloween) { ghostBody(c, performance.now()); continue; }
    if (riso) { risoBody(c); continue; }
    // Paso 10 · Levísimo degradado: luz fija arriba a la izquierda, más claro ahí y un poco
    // más oscuro en el borde opuesto.
    const g = ctx.createRadialGradient(c.cx - c.r * 0.35, c.cy - c.r * 0.4, c.r * 0.05, c.cx, c.cy, c.r * 1.25);
    g.addColorStop(0, pixel ? c.lightPx : c.light);
    g.addColorStop(0.55, c.color);
    g.addColorStop(1, pixel ? c.shadePx : c.shade);
    ctx.fillStyle = g;
    if (yugop) ctx.fillStyle = '#000';
    if (evil) evilHorns(c);
    if (evil) ctx.fillStyle = evilFill(c);
    if (xmas) ctx.fillStyle = xmasFill(c);
    // Paso 3 · Contorno suave: curvas que pasan por los puntos medios del anillo.
    ctx.beginPath();
    const mx = (c.x[POINTS - 1] + c.x[0]) / 2;
    const my = (c.y[POINTS - 1] + c.y[0]) / 2;
    ctx.moveTo(mx, my);
    for (let i = 0; i < POINTS; i++) {
      const j = (i + 1) % POINTS;
      ctx.quadraticCurveTo(c.x[i], c.y[i], (c.x[i] + c.x[j]) / 2, (c.y[i] + c.y[j]) / 2);
    }
    ctx.fill();
    if (xmas) xmasHat(c);
    if (evil) evilRim();
  }

  // Paso 12 · Caras: dos ojos que miran al puntero y parpadean, y una sonrisa que se curva
  // más con el ratón encima. Reacciones: «o» de susto y ojos apretados «> <».
  const now = performance.now();
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  if (wire) ctx.fillStyle = ctx.strokeStyle = WIRE_LINE;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const c of cells) {
    // Todo se mide en proporción al radio.
    const s = c.r;
    if (riso) risoFaceInk(c);
    const squint = now < c.squintUntil;
    const surprised = !squint && now < c.surprisedUntil;
    const tilt = Math.atan2(Math.sin(c.angle - c.base), Math.cos(c.angle - c.base)) * 0.35;
    if (pixel) { pixelFace(c, c.cx, c.cy, tilt, s, squint, surprised, '#000', now); continue; }
    if (yugop) { yugopCrosses(c); continue; }
    if (evil) { evilFace(c, tilt, now); continue; }
    if (halloween) { ghostEyes(c, tilt, now); continue; }
    ctx.save();
    ctx.translate(c.cx, c.cy);
    // La cara se inclina con lo que gira el cuerpo, pero amortiguado (×0,35): reacciona al
    // rodar sin quedar nunca boca abajo.
    const turned = Math.atan2(Math.sin(c.angle - c.base), Math.cos(c.angle - c.base));
    ctx.rotate(turned * 0.35);

    // Ojos.
    const eye = Math.max(1, s * 0.036) * (surprised ? 1.35 : 1);
    ctx.lineWidth = Math.max(1, s * 0.03);
    for (const side of [-1, 1]) {
      const ex = side * s * 0.22;
      const ey = -s * 0.12;
      if (squint) {
        // «>» y «<»: dos trazos que apuntan hacia el centro de la cara.
        const d = eye * 1.8;
        ctx.beginPath();
        ctx.moveTo(ex + side * d, ey - d);
        ctx.lineTo(ex - side * d * 0.4, ey);
        ctx.lineTo(ex + side * d, ey + d);
        ctx.stroke();
        continue;
      }
      // Parpadeo: el ojo se aplasta en vertical durante ~130 ms.
      const t = (now - c.blinkAt) / 130;
      const open = t >= 0 && t <= 1 ? Math.abs(1 - 2 * t) : 1;
      ctx.beginPath();
      ctx.ellipse(ex + c.lookX * s, ey + c.lookY * s, eye, Math.max(0.4, eye * open), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boca.
    ctx.lineWidth = Math.max(1, s * 0.032);
    ctx.beginPath();
    if (surprised) {
      // «o» de susto.
      ctx.arc(0, s * 0.12, s * 0.06, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Un trozo de círculo que pasa por las dos comisuras y por el punto más bajo de la
      // sonrisa. Con el ratón encima se hunde más (k de 0 a 1).
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

  // Paso 13 · Gotas de los globos que explotan.
  for (const d of drops) {
    ctx.fillStyle = d.color;
    if (wire) ctx.fillStyle = WIRE_LINE;
    if (yugop) ctx.fillStyle = '#000';
    if (riso) ctx.fillStyle = RISO_INKS[risoInk(d.color) % 2];
    if (evil) ctx.fillStyle = EVIL_RIM;
    if (xmas) ctx.fillStyle = d.xmas;
    if (halloween) ctx.fillStyle = GHOST;
    ctx.beginPath();
    ctx.arc(d.x, d.y, Math.max(0.1, d.r * d.life), 0, Math.PI * 2);
    ctx.fill();
  }
  if (wire) wireNotes();
  if (riso) risoGrain();
}

// =========================================================================================
// Paso 2 · El bucle: unas 60 veces por segundo, calcular y dibujar
// =========================================================================================

function frame() {
  updateHover();
  updateGravity();
  const now = performance.now();
  updateFloor();
  if (yugop) yugopLife(now);

  for (const c of cells) {
    // Paso 12 · La boca se abre o se cierra con un muelle (pequeño rebote, ~0,3 s).
    const want = c === hovered || c === grabbed ? 1 : 0;
    c.smileV = (c.smileV + (want - c.smile) * 0.22) * 0.68;
    c.smile += c.smileV;

    // Paso 12 · Mirada: hacia el puntero, en el giro de la cara, como mucho un 3,5 % del radio.
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

    // Paso 12 · Parpadeo: al acabar uno, el siguiente en 2–6 s (a veces doble, enseguida).
    if (now > c.blinkAt + 130) c.blinkAt = now + (Math.random() < 0.2 ? 180 : 2000 + Math.random() * 4000);

    // Paso 12 · Golpe fuerte: cambio brusco de velocidad del centro de un fotograma a otro.
    const vx = c.cx - c.prevCx;
    const vy = c.cy - c.prevCy;
    if (Math.hypot(vx - c.vx, vy - c.vy) > 7 && c !== grabbed) c.squintUntil = now + 320;
    c.vx = vx;
    c.vy = vy;
    c.prevCx = c.cx;
    c.prevCy = c.cy;

    // Paso 13 · Al inflarlo (y, desde el paso 14, al nacer) crece rápido hasta su objetivo.
    // Si nadie lo toca en 1,2 s, se va desinflando despacio hasta su tamaño de siempre.
    if (c.target !== undefined) {
      c.r += (c.target - c.r) * 0.2;
      if (Math.abs(c.target - c.r) < 0.5) c.target = undefined;
    } else if (c.r > c.rest && now - c.inflatedAt > 1200) {
      c.r += (c.rest - c.r) * 0.003;
      if (c.r - c.rest < 0.3) c.r = c.rest;
    }

    // Paso 15 · Lanzado: un «toc» suave cada vez que empieza a tocar a otro (ver «bump»).
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
  }

  // Paso 13 · Gotas con gravedad que se encogen.
  for (const d of drops) {
    d.vy += 0.35;
    d.vx *= 0.98;
    d.x += d.vx;
    d.y += d.vy;
    d.life -= 0.025;
  }
  drops = drops.filter((d) => d.life > 0 && d.y < H + 20);

  // Paso 9 · Varios pasos pequeños de física por fotograma: más estable que uno grande.
  for (let s = 0; s < SUBSTEPS; s++) step();
  draw();
  tumbleweed(now);
  if (pixel) dither();
  requestAnimationFrame(frame);
}

// =========================================================================================
// Paso 15 · Sonidos (Web Audio, sintetizados; sin archivos)
// =========================================================================================

// El navegador no deja sonar nada hasta el primer clic o toque: hasta entonces, mudo.
// «master» es el volumen general: todo pasa por aquí.
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

// Un tono que va de una frecuencia a otra, con una envolvente corta (sube y se apaga).
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

// Explotar: golpe de ruido que se apaga hacia grave, como un globo, más un «thump».
function popSound(size) {
  if (quietPops) return;
  try {
    const a = ac();
    const t = a.currentTime;
    // 0,1 s de ruido blanco: números al azar entre −1 y 1.
    const len = Math.ceil(a.sampleRate * 0.1);
    const buffer = a.createBuffer(1, len, a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buffer;
    // Un filtro que deja pasar los graves y se va cerrando: «pfff» → «pf».
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
    // Los globos grandes explotan más graves.
    tone(160 - Math.min(80, size / 3), 50, 0.12, 0.19);
  } catch {}
}

// Crear: «bloop» que sube, como una burbuja que nace (más grave cuanto más grande).
const createSound = (size) => tone(220 - Math.min(100, size / 2), 720 - Math.min(300, size), 0.14, 0.24);

// Choque de un lanzado contra otro: «toc» grave y suave, más fuerte cuanto más rápido
// llega y más grave cuanto más grande es el pequeño de los dos.
let lastBump = 0;
function bump(speed, size) {
  const now = performance.now();
  if (speed < 0.5 || now - lastBump < 60) return;
  lastBump = now;
  const f = Math.max(90, Math.min(260, 16000 / size));
  // De casi un susurro (choque lento) a bastante más fuerte (choque rápido).
  tone(f, f * 0.6, 0.09, Math.min(0.22, 0.02 + speed * 0.013));
}

// =========================================================================================
// Paso 13 · Inflar y explotar
// =========================================================================================

function pop(c) {
  cells = cells.filter((k) => k !== c);
  // Los vecinos se asustan: «o» durante ~0,7 s.
  const until = performance.now() + 700;
  for (const k of cells) {
    if (Math.hypot(k.cx - c.cx, k.cy - c.cy) < (c.r + k.r) * 1.6) k.surprisedUntil = until;
  }
  if (grabbed === c) grabbed = null;
  if (hovered === c) hovered = null;
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
      xmas: xmasOf(c).color,
    });
  }
  popSound(c.r);
}

// Tocar un vertiki lo infla un 15 %; si pasa de cierto tamaño (un 34 % del lado corto de
// la pantalla), explota. Es la única manera de que exploten.
function inflate(c) {
  const next = (c.target ?? c.r) * 1.15;
  if (next > Math.min(W, H) * 0.34) {
    pop(c);
    return;
  }
  c.target = next;
  c.inflatedAt = performance.now();
  tone(300 - Math.min(120, next / 3), 900 - Math.min(400, next), 0.1, 0.14);
}

// =========================================================================================
// Paso 14 · Nacer
// =========================================================================================

// Un vertiki nuevo de tamaño al azar, que nace pequeño y crece hasta su tamaño.
function spawn(x, y) {
  const target = sizeUnit() * randomSize();
  const c = makeCell(x, y, target * 0.15);
  c.target = target;
  c.rest = target;
  cells.push(c);
  createSound(target);
}

// =========================================================================================
// Paso 11 · El puntero: arrastrar y hover (y, desde el paso 13, tocar para inflar)
// =========================================================================================

// El vertiki bajo el puntero (el de encima si se solapan: el último dibujado).
function cellAt(x, y) {
  for (let k = cells.length - 1; k >= 0; k--) {
    const c = cells[k];
    if (Math.hypot(x - c.cx, y - c.cy) <= c.r) return c;
  }
  return null;
}

// Paso 13 · Un toque: pulsar y soltar enseguida (menos de 250 ms) sin mover el dedo (menos
// de 10 px). Arrastrar no cuenta. Aquí apuntamos cuándo y dónde se pulsó, y sobre quién.
let press = null;
// Paso 14 · Doble clic o doble toque en un hueco, detectado a mano para que funcione igual
// con ratón y en táctil: dos pulsaciones en menos de 320 ms y a menos de 30 px.
let lastDown = { t: 0, x: 0, y: 0 };

canvas.addEventListener('pointerdown', (e) => {
  pointerSeen = true;
  // Paso 15 · Primer gesto: ya se puede sonar.
  // Paso 16 · Y en iPhone, pedir el acelerómetro.
  if (!unlocked) {
    unlocked = true;
    ac();
    askTilt();
  }
  pointer = { x: e.clientX, y: e.clientY };
  // Paso 14 · Doble clic en un hueco: nace un vertiki.
  const now = performance.now();
  const double = now - lastDown.t < 320 && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 30;
  lastDown = double ? { t: 0, x: 0, y: 0 } : { t: now, x: e.clientX, y: e.clientY };
  if (double && !cellAt(e.clientX, e.clientY)) {
    spawn(e.clientX, e.clientY);
    return;
  }

  grabbed = cellAt(e.clientX, e.clientY);
  press = grabbed && { cell: grabbed, t: performance.now(), x: e.clientX, y: e.clientY };
  if (!grabbed && grabWeed(e)) return;
  if (!grabbed) return;
  grabOffset = { x: e.clientX - grabbed.cx, y: e.clientY - grabbed.cy };
  // El agarrado pasa a dibujarse encima de los demás.
  cells = [...cells.filter((c) => c !== grabbed), grabbed];
  // Seguimos recibiendo el movimiento aunque el puntero salga del canvas.
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('is-dragging');
});

let mouseInside = false;
canvas.addEventListener('pointermove', (e) => {
  pointerSeen = true;
  pointer = { x: e.clientX, y: e.clientY };
  mouseInside = e.pointerType === 'mouse';
});
canvas.addEventListener('pointerleave', () => {
  mouseInside = false;
  hovered = null;
});

function release(e) {
  // Paso 13 · Si ha sido un toque (corto y sin moverse), se infla.
  const tap = press && e && performance.now() - press.t < 250 && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 10;
  if (tap && cells.includes(press.cell)) inflate(press.cell);
  press = null;
  // Paso 15 · Si sale lanzado (aunque sea flojito), sus choques suenan durante 1,5 s.
  if (grabbed && Math.hypot(grabbed.vx, grabbed.vy) > 0.8) {
    const g = grabbed;
    g.thrownUntil = performance.now() + 1500;
    g.touching = new Set(cells.filter((k) => k !== g && Math.hypot(k.cx - g.cx, k.cy - g.cy) <= (k.r + g.r) * 0.92));
  }
  weedGrab = null;
  grabbed = null;
  canvas.classList.remove('is-dragging');
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', () => release());

// Qué hay bajo el ratón, en cada fotograma (los vertikis se mueven aunque el ratón esté
// quieto): para el cursor (mano encima) y, desde el paso 12, la sonrisa.
function updateHover() {
  hovered = mouseInside ? cellAt(pointer.x, pointer.y) : null;
  canvas.classList.toggle('is-over', !!hovered);
  if (mouseInside && weedAt(pointer.x, pointer.y)) canvas.classList.add('is-over');
}

// =========================================================================================
// Paso 16 · El móvil: la gravedad sigue la inclinación del teléfono
// =========================================================================================

// gamma: inclinación izquierda-derecha; beta: adelante-atrás. Se gira según cómo esté la
// pantalla (vertical u horizontal) y se suaviza para que no tiemble.
let tiltX = 0;
let tiltY = 1;
let tiltListening = false;
let hasOrientation = false;

// x, y: hacia dónde tira la gravedad en el aparato (de −1 a 1), con y hacia abajo.
function setTilt(x, y) {
  // Del aparato a la pantalla, según cómo esté girada.
  const a = (screen.orientation?.angle ?? window.orientation ?? 0) * (Math.PI / 180);
  const sx = x * Math.cos(a) + y * Math.sin(a);
  const sy = -x * Math.sin(a) + y * Math.cos(a);
  // Casi plano: poca gravedad. Inclinado del todo, como mucho la normal.
  const len = Math.hypot(sx, sy);
  tiltX = len > 1 ? sx / len : sx;
  tiltY = len > 1 ? sy / len : sy;
}

function onOrientation(e) {
  if (e.beta === null || e.gamma === null) return;
  hasOrientation = true;
  const rad = Math.PI / 180;
  setTilt(Math.sin(e.gamma * rad), Math.sin(e.beta * rad));
}

// Plan B: muchas tablets Android no tienen giroscopio y «deviceorientation» llega vacío.
// El acelerómetro siempre está: «accelerationIncludingGravity» mide la gravedad en m/s²
// (al revés: en vertical, y vale +9,8), así que la pasamos a −1…1 y le damos la vuelta a x.
function onMotion(e) {
  const g = e.accelerationIncludingGravity;
  if (hasOrientation || !g || g.x === null || g.y === null) return;
  setTilt(-g.x / 9.81, g.y / 9.81);
}

function listenTilt() {
  if (tiltListening || !touchDevice) return;
  tiltListening = true;
  window.addEventListener('deviceorientation', onOrientation);
  window.addEventListener('devicemotion', onMotion);
}

// El iPhone pide permiso, y solo se puede pedir dentro de un toque (ver «pointerdown»).
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

// Cada fotograma, la gravedad se acerca a la de la inclinación.
function updateGravity() {
  if (!tiltListening) return;
  gravX += (tiltX - gravX) * 0.1;
  gravY += (tiltY - gravY) * 0.1;
}

// =========================================================================================
// Extra (no sale en el tutorial) · Si no queda ningún vertiki, a los 2 s cruza la pantalla
// un estepicursor negro rodando de izquierda a derecha, dando botecitos.
// =========================================================================================

// Por consola: vertikis.masacre() los hace explotar todos de golpe, y vertikis.style.xxx()
// pone una visualización: normal, pixel, yugop, riso, wire… y las que solo salen así:
// evil, xmas y halloween. Otra vez la misma, vuelve a normal.
let quietPops = false;
window.vertikis = {
  masacre() {
    const n = cells.length;
    const big = Math.max(0, ...cells.map((c) => c.r));
    // Todos a la vez, pero con tres estallidos en vez de uno por vertiki (si no, satura).
    quietPops = true;
    for (const c of [...cells]) pop(c);
    quietPops = false;
    if (n) [0, 70, 150].slice(0, n).forEach((ms) => setTimeout(() => popSound(big), ms));
    return `💥 ${n} vertiki${n === 1 ? '' : 's'}`;
  },
  // vertikis.mode('pixel'): cambia de visualización por su nombre (ver MODES y HIDDEN).
  // Sin nombre, dice cuál está puesta.
  mode(name) {
    if (name === undefined) return currentMode();
    if (!MODES.includes(name) && !HIDDEN.includes(name)) return `? ${[...MODES, ...HIDDEN].join(' · ')}`;
    const wasPixel = !!pixel;
    const wasYugop = yugop;
    const wasHalloween = halloween;
    pixel = name === 'pixel' ? pixelSize() : 0;
    wire = name === 'wire';
    yugop = name === 'yugop';
    riso = name === 'riso';
    evil = name === 'evil';
    xmas = name === 'xmas';
    halloween = name === 'halloween';
    // Al entrar en yugop se apunta cuántos hay (alrededor de ese número aparecen y
    // desaparecen); al salir, los que estaban desapareciendo se van del todo.
    if (yugop && !wasYugop) yugopStart();
    if (halloween && !wasHalloween) ghostFew();
    if (halloween && !wasHalloween) batsStart();
    if (!yugop) cells = cells.filter((c) => !c.vanishing);
    document.documentElement.classList.toggle('is-pixel', !!pixel);
    document.documentElement.classList.toggle('is-wire', wire);
    document.documentElement.classList.toggle('is-yugop', yugop);
    document.documentElement.classList.toggle('is-riso', riso);
    document.documentElement.classList.toggle('is-evil', evil);
    document.documentElement.classList.toggle('is-xmas', xmas);
    document.documentElement.classList.toggle('is-halloween', halloween);
    // El modo píxel cambia la resolución del canvas: hay que rehacerlo al entrar y al salir.
    if (wasPixel !== !!pixel) resize();
    // La dirección lleva la visualización (#pixel, #wire…), para poder compartirla.
    // Sin historial: cambiar de modo no llena el botón «atrás».
    // Si la página tiene dónde ([data-mode-name]), el nombre de la que está puesta.
    for (const el of document.querySelectorAll('[data-mode-name]')) el.textContent = name;
    // Las ocultas también (#evil, #xmas, #halloween): así se pueden ver en el móvil, donde
    // no hay consola.
    const hash = name === 'normal' ? '' : `#${name}`;
    if (location.hash !== hash) history.replaceState(null, '', location.pathname + location.search + hash);
    return { normal: '● smooth', pixel: `▦ pixel ×${pixel}`, wire: '⌗ wire', yugop: '+ yugop', riso: '◐ riso', evil: '😈 evil', xmas: '🎄 xmas', halloween: '👻 halloween' }[name];
  },
  // vertikis.style.pixel(), vertikis.style.evil()…: una orden por visualización (se
  // rellena abajo, con MODES y HIDDEN).
  style: {},
};

// Las visualizaciones, en el orden en que pasa por ellas el doble clic en «vertikis».
// Para añadir una: su nombre aquí y lo que dibuje en draw().
// «wire» va siempre el último.
const MODES = ['normal', 'pixel', 'yugop', 'riso', 'wire'];
// Las que no están en la lista: solo por consola (vertikis.style.evil(), …) o con su
// dirección (#evil, #xmas, #halloween). Ni el doble clic, ni «Prev» y «Next», ni las
// flechas pasan por ellas.
const HIDDEN = ['evil', 'xmas', 'halloween'];
const currentMode = () =>
  evil ? 'evil' : xmas ? 'xmas' : halloween ? 'halloween' : riso ? 'riso' : yugop ? 'yugop' : wire ? 'wire' : pixel ? 'pixel' : 'normal';
for (const name of [...MODES, ...HIDDEN]) {
  window.vertikis.style[name] = () => window.vertikis.mode(currentMode() === name && name !== 'normal' ? 'normal' : name);
}

// Al abrir una dirección con #pixel, #yugop, #riso, #wire, #evil, #xmas o #halloween (o al
// cambiarla a mano), se pone esa
// visualización. Va en una microtarea: cuando el escenario ya está montado.
const modeFromHash = () => {
  // «blueprint» era el nombre antiguo de «wire»: los enlaces de antes siguen funcionando.
  const asked = decodeURIComponent(location.hash.slice(1));
  const name = asked === 'blueprint' ? 'wire' : asked;
  window.vertikis.mode(MODES.includes(name) || HIDDEN.includes(name) ? name : 'normal');
};
queueMicrotask(modeFromHash);

// «Prev» y «Next» en el pie: la visualización anterior y la siguiente (dando la vuelta).
const stepMode = (by) => {
  const n = MODES.length;
  const at = Math.max(0, MODES.indexOf(currentMode()));
  window.vertikis.mode(MODES[(at + by + n) % n]);
};
// Y con el teclado: flecha izquierda, la anterior; flecha derecha, la siguiente.
window.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  stepMode(e.key === 'ArrowLeft' ? -1 : 1);
});

for (const [sel, by] of [['[data-mode-prev]', -1], ['[data-mode-next]', 1]]) {
  for (const el of document.querySelectorAll(sel)) {
    el.style.pointerEvents = 'auto';
    el.addEventListener('click', () => {
      if (!unlocked) {
        unlocked = true;
        ac();
        // Y en iPhone, pedir el acelerómetro: si el primer toque es aquí, no se pediría nunca.
        askTilt();
      }
      stepMode(by);
    });
  }
}
window.addEventListener('hashchange', modeFromHash);

// =========================================================================================
// Extra · Modo píxel: el canvas se dibuja a baja resolución (cada píxel real ocupa
// «pixel» píxeles CSS y el navegador lo amplía sin suavizar), y después se tramea con un
// dither ordenado (matriz de Bayer 4×4) con una paleta cerrada: los degradados se
// convierten en tramas de puntos. Las caras se pintan aparte, píxel a píxel.
// =========================================================================================

// 0 = modo normal; si no, cuántos píxeles CSS mide cada píxel.
let pixel = 0;
const pixelSize = () => Math.max(3, Math.round(Math.min(window.innerWidth, window.innerHeight) / 170));

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

// Paleta cerrada: cada color de los vertikis en tres tonos (sombra, color y luz), más
// negro y blanco. Para no buscar el más cercano en cada píxel, una tabla de 32×32×32
// (5 bits por canal) dice qué color de la paleta toca.
let ditherPalette = null;
let ditherTable = null;
function buildPalette() {
  const rgb = (hex, t) => {
    const n = parseInt(hex.slice(1), 16);
    const to = t > 0 ? 255 : 0;
    const k = Math.abs(t);
    return [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * k));
  };
  ditherPalette = [[0, 0, 0], [255, 255, 255], WEED_PX];
  for (const hex of PALETTE) for (const t of [-0.1, 0, 0.14]) ditherPalette.push(rgb(hex, t));
  ditherTable = new Uint8Array(32 * 32 * 32);
  for (let i = 0; i < ditherTable.length; i++) {
    const r = ((i >> 10) << 3) + 4;
    const g = (((i >> 5) & 31) << 3) + 4;
    const b = ((i & 31) << 3) + 4;
    let best = 0;
    let bestD = Infinity;
    ditherPalette.forEach(([pr, pg, pb], k) => {
      // Distancia con más peso en el verde, como el ojo.
      const d = 2 * (r - pr) ** 2 + 4 * (g - pg) ** 2 + 3 * (b - pb) ** 2;
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    });
    ditherTable[i] = best;
  }
}

// Fondo oscuro (arriba y abajo) y el estepicursor, claro para que se vea sobre él.
const BG_TOP = [26, 26, 26];
const BG_BOTTOM = [38, 38, 38];
const WEED_PX = [233, 231, 224];

// Cuánto empuja la trama hacia un tono u otro (en niveles de 0 a 255).
const SPREAD = 26;

function dither() {
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return;
  if (!ditherTable) buildPalette();
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const c = (v) => (v < 0 ? 0 : v > 255 ? 255 : v) >> 3;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const t = BAYER[(y & 3) * 4 + (x & 3)];
      // Borde de escalones limpios: solo lo que está a medias (los pelos) se tramea.
      if (d[i + 3] / 255 + t * 0.5 < 0.5) {
        // El fondo: dos grises casi iguales que se mezclan en vertical con la misma trama.
        const [r, g, b] = (y / h - 0.12) / 0.76 + t < 0.5 ? BG_TOP : BG_BOTTOM;
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
        d[i + 3] = 255;
        continue;
      }
      const o = t * SPREAD;
      const [r, g, b] = ditherPalette[ditherTable[(c(d[i] + o) << 10) | (c(d[i + 1] + o) << 5) | c(d[i + 2] + o)]];
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Una cara de píxeles enteros (sin suavizado), en negro o blanco puros para que el dither
// la deje intacta. «f» trae la mirada, el parpadeo y la sonrisa; (x, y) es el centro.
function pixelFace(f, x, y, rot, s, squint, surprised, color, now) {
  const k = 1 / pixel;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = color;
  const dot = (px, py, n, m = n) => {
    const X = (x + px * cos - py * sin) * k;
    const Y = (y + px * sin + py * cos) * k;
    ctx.fillRect(Math.round(X - n / 2), Math.round(Y - m / 2), n, m);
  };
  const path = (pts, n) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * k * 2));
      for (let j = 0; j <= steps; j++) dot(x0 + ((x1 - x0) * j) / steps, y0 + ((y1 - y0) * j) / steps, n);
    }
  };
  const pen = Math.max(1, Math.round(s * 0.034 * k));

  // Ojos: bloques de píxeles; al parpadear, una sola fila.
  const t = (now - f.blinkAt) / 130;
  const open = t >= 0 && t <= 1 ? Math.abs(1 - 2 * t) : 1;
  const eye = Math.max(1, Math.round(s * 0.08 * k * (surprised ? 1.35 : 1)));
  for (const side of [-1, 1]) {
    const ex = side * s * 0.22;
    const ey = -s * 0.12;
    if (squint) {
      const dd = Math.max(s * 0.065, pixel * 1.5);
      path([[ex + side * dd, ey - dd], [ex - side * dd * 0.4, ey], [ex + side * dd, ey + dd]], pen);
      continue;
    }
    dot(ex + f.lookX * s, ey + f.lookY * s, eye, Math.max(1, Math.round(eye * open)));
  }

  // Boca: la «o» de susto o el mismo trozo de círculo de siempre, en escalones.
  const pts = [];
  if (surprised) {
    const r = Math.max(s * 0.06, pixel * 1.2);
    for (let i = 0; i <= 16; i++) pts.push([Math.cos((i / 16) * Math.PI * 2) * r, s * 0.12 + Math.sin((i / 16) * Math.PI * 2) * r]);
  } else {
    const m = squint ? 0 : f.smile;
    const w = s * 0.16;
    const h = Math.max(0.05, w * (0.32 + 0.5 * m));
    const top = s * 0.06;
    const R = (w * w + h * h) / (2 * h);
    const centerY = top + h - R;
    const a0 = Math.asin(Math.min(1, (top - centerY) / R));
    for (let i = 0; i <= 12; i++) {
      const a = a0 + ((Math.PI - 2 * a0) * i) / 12;
      pts.push([Math.cos(a) * R, centerY + Math.sin(a) * R]);
    }
  }
  path(pts, pen);
  ctx.restore();
}

// Doble clic (o doble toque) en la etiqueta «vertikis» del pie: de normal a píxel, de
// una a otra por la lista (MODES) y del último otra vez a normal.
const creditTag = document.querySelector('.credit__tag');
if (creditTag) {
  creditTag.style.pointerEvents = 'auto';
  creditTag.style.userSelect = 'none';
  creditTag.style.webkitUserSelect = 'none';
  creditTag.style.touchAction = 'manipulation';
  let lastTagTap = 0;
  creditTag.addEventListener('pointerup', () => {
    const t = performance.now();
    if (t - lastTagTap > 400) {
      lastTagTap = t;
      return;
    }
    lastTagTap = 0;
    if (!unlocked) {
      unlocked = true;
      ac();
      askTilt();
    }
    window.vertikis.mode(MODES[(Math.max(0, MODES.indexOf(currentMode())) + 1) % MODES.length]);
  });
}

// =========================================================================================
// Extra · En alambre («wire»): el mismo escenario dibujado como un esquema técnico, en
// líneas gris oscuro sobre gris clarito. Se ve la física por dentro: los puntos del anillo,
// la forma de reposo a la que vuelven (discontinua), los muelles que tiran de cada punto
// hacia ella, el centro, el giro, el radio y los contactos entre vertikis.
// =========================================================================================

let wire = false;
const WIRE_PAPER = '#eeeeee';
const WIRE_LINE = '#333333';
const wireInk = (a) => `rgba(51, 51, 51, ${a})`;
const WIRE_FONT = '10px ui-monospace, Menlo, Consolas, monospace';

// El papel, gris clarito y liso, y los contactos (líneas discontinuas entre los centros
// de los vertikis que se tocan), por debajo de todo.
function wirePaper() {
  ctx.fillStyle = WIRE_PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = wireInk(0.35);
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  for (let a = 0; a < cells.length; a++) {
    for (let b = a + 1; b < cells.length; b++) {
      const A = cells[a];
      const B = cells[b];
      if (Math.hypot(A.cx - B.cx, A.cy - B.cy) > (A.r + B.r) * 0.96) continue;
      ctx.moveTo(A.cx, A.cy);
      ctx.lineTo(B.cx, B.cy);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

// Un vertiki en alambre.
function wireBody(c) {
  // Su forma de reposo, girada y centrada como está ahora (la del paso 6).
  const cos = Math.cos(c.angle);
  const sin = Math.sin(c.angle);
  const gx = new Float32Array(POINTS);
  const gy = new Float32Array(POINTS);
  for (let i = 0; i < POINTS; i++) {
    const qx = UNIT[i * 2] * c.r * (1 + oval(c));
    const qy = UNIT[i * 2 + 1] * c.r * (1 - oval(c));
    gx[i] = c.cx + qx * cos - qy * sin;
    gy[i] = c.cy + qx * sin + qy * cos;
  }

  ctx.lineWidth = 1;
  // La forma de reposo, discontinua.
  ctx.strokeStyle = wireInk(0.4);
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  for (let i = 0; i < POINTS; i++) ctx.lineTo(gx[i], gy[i]);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // Los muelles: de cada punto a su sitio en la forma de reposo. Cuanto más aplastado,
  // más largos.
  ctx.strokeStyle = wireInk(0.55);
  ctx.beginPath();
  for (let i = 0; i < POINTS; i++) {
    ctx.moveTo(c.x[i], c.y[i]);
    ctx.lineTo(gx[i], gy[i]);
  }
  ctx.stroke();

  // El contorno de verdad, con las mismas curvas que el dibujo normal.
  ctx.strokeStyle = WIRE_LINE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo((c.x[POINTS - 1] + c.x[0]) / 2, (c.y[POINTS - 1] + c.y[0]) / 2);
  for (let i = 0; i < POINTS; i++) {
    const j = (i + 1) % POINTS;
    ctx.quadraticCurveTo(c.x[i], c.y[i], (c.x[i] + c.x[j]) / 2, (c.y[i] + c.y[j]) / 2);
  }
  ctx.stroke();

  // Los 28 puntos: nudos huecos.
  ctx.lineWidth = 1;
  ctx.fillStyle = WIRE_PAPER;
  for (let i = 0; i < POINTS; i++) {
    ctx.beginPath();
    ctx.arc(c.x[i], c.y[i], 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // El centro (una cruz) y el giro: una cota del centro al borde, en la dirección en la
  // que ha girado la forma, con el radio escrito.
  const k = Math.min(7, c.r * 0.1);
  ctx.beginPath();
  ctx.moveTo(c.cx - k, c.cy);
  ctx.lineTo(c.cx + k, c.cy);
  ctx.moveTo(c.cx, c.cy - k);
  ctx.lineTo(c.cx, c.cy + k);
  ctx.stroke();
  const ex = c.cx + Math.cos(c.angle) * c.r;
  const ey = c.cy + Math.sin(c.angle) * c.r;
  ctx.strokeStyle = wireInk(0.7);
  ctx.beginPath();
  ctx.moveTo(c.cx, c.cy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ex, ey, 3.5, 0, Math.PI * 2);
  ctx.stroke();

  // La ficha: radio y giro, debajo de la cara (en los muy pequeños no cabe).
  if (c.r < 34) return;
  const deg = Math.round((Math.atan2(Math.sin(c.angle - c.base), Math.cos(c.angle - c.base)) * 180) / Math.PI);
  ctx.font = WIRE_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = wireInk(0.75);
  ctx.fillText(`r ${Math.round(c.r)} · ${deg}°`, c.cx, c.cy + c.r * 0.42);
}

// El cajetín, abajo a la derecha, por encima del pie: qué es y con qué números
// funciona ahora mismo. En pantallas estrechas no cabe y no se dibuja.
function wireNotes() {
  if (W < 640) return;
  const rows = [
    'VERTIKIS · SOFT BODIES',
    'VERLET + SHAPE MATCHING',
    `${cells.length} × ${POINTS} PTS · ${SUBSTEPS} SUBSTEPS`,
    `K ${STIFFNESS} · G ${GRAVITY} · F ${FRICTION}`,
    'VERTIK.NET',
  ];
  const w = 230;
  const row = 18;
  const x = W - w - 16;
  const y = H - rows.length * row - 44;
  ctx.fillStyle = WIRE_PAPER;
  ctx.fillRect(x, y, w, rows.length * row);
  ctx.strokeStyle = WIRE_LINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, rows.length * row);
  ctx.font = WIRE_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  rows.forEach((text, n) => {
    if (n) {
      ctx.strokeStyle = wireInk(0.4);
      ctx.beginPath();
      ctx.moveTo(x, y + n * row + 0.5);
      ctx.lineTo(x + w, y + n * row + 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = n === 0 ? WIRE_LINE : wireInk(0.75);
    ctx.fillText(text, x + 10, y + n * row + row / 2 + 0.5);
  });
}

// =========================================================================================
// Extra · Modo yugop: como la home de yugop.com (Yugo Nakamura, 2005), a la que rinden
// homenaje los vertikis. Cuerpos negros y lisos sobre blanco, sin cara, y en su ecuador
// dos crucecitas blancas, una a cada lado, que giran con el cuerpo.
// =========================================================================================

let yugop = false;

// El suelo: en pantallas estrechas (el móvil) el pie ocupa varias líneas abajo y tapaba a
// los pequeños; el suelo sube hasta justo encima del pie y los vertikis se apoyan en él.
// En pantallas anchas el pie es una línea fina y el suelo es el borde de la ventana.
let floor = 0;
const creditEl = document.querySelector('.credit');
function updateFloor() {
  const narrow = window.matchMedia('(max-width: 63.99rem), (pointer: coarse)').matches;
  floor = narrow && creditEl ? Math.max(H * 0.5, creditEl.getBoundingClientRect().top - 6) : H;
}

// La medida de los tamaños. En una pantalla apaisada, el lado corto. En vertical (el
// móvil), un 20 % más que el ancho: si no, salen muchos pequeños apilados en una columna
// alta y el peso de encima aplasta a los de abajo. Y en vertical ocupan algo menos (un
// 40 % de la pantalla en vez de la mitad): menos filas, menos peso.
const sizeUnit = () => (H > W ? Math.min(W * 1.2, H) : Math.min(W, H));
const fillShare = () => (H > W ? 0.4 : 0.5);

// Rigidez de cada vertiki. Los pequeños, más rígidos: los grandes pesan más y, si no, los
// dejan aplastados como pasas. De 0,5 en los grandes a 0,68 en los más pequeños (en yugop,
// sobre la suya, más alta). En vertical (el móvil) hay más filas apiladas y más peso
// encima: todo 0,12 más rígido, y los pequeños hasta 0,85. Siguen deformándose, pero menos.
function stiffness(c) {
  const unit = sizeUnit();
  const small = Math.max(0, Math.min(1, (unit * 0.15 - c.r) / (unit * 0.08)));
  const base = (yugop ? YUGOP.stiffness : 0.5) + (H > W ? 0.12 : 0);
  return Math.min(0.85, base + 0.18 * small);
}

// Tamaño al azar, en fracción del lado corto de la pantalla. Normal: del 9 % al 22 %. En
// yugop, más contraste, como en el original: del 7 % al 24 %. La potencia hace que los
// pequeños y medianos sean lo normal y los grandotes, pocos (cuanto más alta, menos).
const randomSize = () => (yugop ? 0.07 + Math.random() ** 2.2 * 0.17 : 0.09 + Math.random() ** 2 * 0.13);

// Cuánto se ovala la forma de reposo: en yugop, menos de la mitad (casi redondos, pero
// no círculos perfectos).
const oval = (c) => (yugop ? c.e * 0.4 : c.e);
// En el modo yugop flotan casi redondos, como en el original: la gravedad a un 20 % (caen
// despacio) y algo más de rigidez (se aplastan poco, pero se aplastan). Y cada pocos
// segundos uno desaparece (se encoge hasta nada, con un «fiu») o aparece otro en un hueco
// entre los demás (crece desde nada, con un «tic tic», y los empuja para hacerse sitio).
const YUGOP = { gravity: 0.2, stiffness: 0.62, every: [1800, 4200] };
let yugopBase = 0;
let yugopNextAt = 0;

function yugopStart() {
  yugopBase = Math.max(4, cells.length);
  yugopNextAt = performance.now() + 1500;
  // Al entrar, cada uno se va a un tamaño nuevo de la escala de yugop (crecen o encogen
  // suavemente), para que la variedad se vea enseguida. Se reajustan todos para que entre
  // todos ocupen lo mismo que antes: si no, no caben y se aplastan unos contra otros.
  const unit = sizeUnit();
  const alive = cells.filter((c) => !c.vanishing);
  const sizes = alive.map(() => unit * randomSize());
  const before = alive.reduce((sum, c) => sum + c.rest * c.rest, 0);
  const after = sizes.reduce((sum, r) => sum + r * r, 0);
  const k = after ? Math.sqrt(before / after) : 1;
  alive.forEach((c, n) => {
    c.target = c.rest = sizes[n] * k;
  });
}

function yugopLife(now) {
  // Los que ya se han encogido del todo, fuera.
  if (cells.some((c) => c.vanishing && c.r < 1.5)) {
    cells = cells.filter((c) => !(c.vanishing && c.r < 1.5));
    if (hovered && !cells.includes(hovered)) hovered = null;
  }
  if (now < yugopNextAt) return;
  yugopNextAt = now + YUGOP.every[0] + Math.random() * (YUGOP.every[1] - YUGOP.every[0]);
  // Por debajo de los que había, más probable que aparezca; por encima, que desaparezca.
  const alive = cells.filter((c) => !c.vanishing);
  const vanish = Math.random() < (alive.length > yugopBase ? 0.75 : alive.length < yugopBase ? 0.25 : 0.5);
  if (vanish) {
    const pick = alive.filter((c) => c !== grabbed);
    if (!pick.length) return;
    const c = pick[Math.floor(Math.random() * pick.length)];
    c.vanishing = true;
    c.target = 0.5;
    c.rest = 0.5;
    // Un «fiu» que baja, más grave cuanto más grande (solo si ya se puede sonar).
    if (unlocked) tone(640 - Math.min(260, c.r * 1.4), 150, 0.24, 0.1, 'triangle');
    return;
  }
  // Aparecer: en un hueco entre los demás (un punto fuera de todos pero cerca de alguno),
  // no en el cielo vacío. Nace casi sin tamaño y, al crecer, empuja a sus vecinos para
  // hacerse sitio. Si no hay ningún hueco así, en cualquier sitio libre.
  const unit = sizeUnit();
  const r = unit * randomSize();
  const gaps = [];
  const free = [];
  for (let tries = 0; tries < 60; tries++) {
    const px = r * 0.5 + Math.random() * (W - r);
    const py = r * 0.5 + Math.random() * (floor - r);
    // Distancia al borde del vertiki más cercano (negativa si cae dentro de uno).
    let clear = Infinity;
    for (const k of cells) clear = Math.min(clear, Math.hypot(k.cx - px, k.cy - py) - k.r);
    if (clear <= 0) continue;
    (clear < r * 0.6 ? gaps : free).push({ px, py });
  }
  const spot = (gaps.length ? gaps : free)[Math.floor(Math.random() * (gaps.length || free.length))];
  if (spot) {
    const { px: x, py: y } = spot;
    const c = makeCell(x, y, r * 0.05);
    c.target = r;
    c.rest = r;
    cells.push(c);
    // Un «tic tic»: dos golpecitos agudos y secos, el segundo un poco más alto.
    if (unlocked) {
      tone(1900, 1500, 0.03, 0.09, 'square');
      setTimeout(() => tone(2300, 1800, 0.03, 0.08, 'square'), 85);
    }
  }
}

function yugopCrosses(c) {
  // El ecuador: la línea que pasa por el centro con el giro del cuerpo. Cada uno nace con
  // su propia inclinación (el giro al azar con el que se crea) y gira al rodar. Las cruces,
  // a un 72 % del radio, y también inclinadas con el cuerpo.
  const a = c.angle;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = cos * c.r * 0.72;
  const dy = sin * c.r * 0.72;
  const k = Math.max(2.5, c.r * 0.028);
  ctx.save();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  for (const side of [-1, 1]) {
    const x = c.cx + dx * side;
    const y = c.cy + dy * side;
    ctx.moveTo(x - cos * k, y - sin * k);
    ctx.lineTo(x + cos * k, y + sin * k);
    ctx.moveTo(x + sin * k, y - cos * k);
    ctx.lineTo(x - sin * k, y + cos * k);
  }
  ctx.stroke();
  ctx.restore();
}

// =========================================================================================
// Extra · Risografía: como una impresión a dos tintas planas, rosa fluorescente y azul,
// sobre papel. Cada vertiki va en una tinta o en las dos (y entonces sale morado, porque
// las tintas se multiplican). El azul está un poco desregistrado, como en una riso de
// verdad, y encima de todo hay grano de impresión. Las caras van en la otra tinta.
// =========================================================================================

let riso = false;
const RISO_PAPER = '#f3efe6';
const RISO_INKS = ['#ff48b0', '#0078bf'];
// Desregistro de la tinta azul, en píxeles.
const RISO_SHIFT = { x: 2, y: -1.5 };

// Qué tinta lleva cada color de la paleta: 0 rosa, 1 azul, 2 las dos.
const RISO_OF = [0, 0, 1, 0, 1, 2, 1, 2, 0];
const risoInk = (color) => RISO_OF[PALETTE.indexOf(color)] ?? 0;

function risoPaper() {
  ctx.fillStyle = RISO_PAPER;
  ctx.fillRect(0, 0, W, H);
}

function risoShape(c, dx, dy) {
  ctx.beginPath();
  ctx.moveTo((c.x[POINTS - 1] + c.x[0]) / 2 + dx, (c.y[POINTS - 1] + c.y[0]) / 2 + dy);
  for (let i = 0; i < POINTS; i++) {
    const j = (i + 1) % POINTS;
    ctx.quadraticCurveTo(c.x[i] + dx, c.y[i] + dy, (c.x[i] + c.x[j]) / 2 + dx, (c.y[i] + c.y[j]) / 2 + dy);
  }
  ctx.fill();
}

function risoBody(c) {
  const ink = risoInk(c.color);
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.92;
  if (ink !== 1) {
    ctx.fillStyle = RISO_INKS[0];
    risoShape(c, 0, 0);
  }
  if (ink !== 0) {
    ctx.fillStyle = RISO_INKS[1];
    risoShape(c, RISO_SHIFT.x, RISO_SHIFT.y);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// La cara, en la otra tinta (sobre los morados, en reserva: color del papel).
function risoFaceInk(c) {
  const ink = risoInk(c.color);
  ctx.globalCompositeOperation = ink === 2 ? 'source-over' : 'multiply';
  ctx.fillStyle = ctx.strokeStyle = ink === 2 ? RISO_PAPER : RISO_INKS[1 - ink];
}

// El grano: motitas del color del papel encima de todo (la tinta no cubre del todo), en un
// patrón que se repite. Se hace a la resolución real de la pantalla (en retina, dos
// píxeles por cada píxel CSS), con motitas de un píxel real: fino, como el de una riso.
let risoPattern = null;
let risoPatternScale = 0;
function risoGrain() {
  ctx.globalCompositeOperation = 'source-over';
  const dpr = canvas.width / W || 1;
  if (!risoPattern || risoPatternScale !== dpr) {
    const size = 256;
    const g = document.createElement('canvas');
    g.width = g.height = size;
    const gx = g.getContext('2d');
    gx.fillStyle = RISO_PAPER;
    for (let n = 0; n < 4200; n++) {
      gx.globalAlpha = 0.2 + Math.random() * 0.5;
      gx.fillRect(Math.floor(Math.random() * size), Math.floor(Math.random() * size), 1, 1);
    }
    risoPattern = ctx.createPattern(g, 'repeat');
    risoPattern.setTransform(new DOMMatrix().scale(1 / dpr));
    risoPatternScale = dpr;
  }
  ctx.fillStyle = risoPattern;
  ctx.fillRect(0, 0, W, H);
}

// =========================================================================================
// Extra · Evil (por consola, vertikis.style.evil(), o #evil): de noche, casi negros, con un filo
// rojo, cuernecitos rojos, ojos en cruz y una sonrisa cosida en rojo neón que brilla, sobre
// un fondo negro.
// =========================================================================================

let evil = false;
// Gris muy oscuro con un poco de volumen: luz, cuerpo y sombra del degradado.
const EVIL_BODY = ['#333333', '#1a1a1a', '#0b0b0b'];
// El filo, del mismo rojo neón que los ojos y la boca.
const EVIL_NEON = '#ff2a1f';
const EVIL_RIM = EVIL_NEON;
const EVIL_GLOW = 'rgba(255, 30, 20, 0.9)';
const EVIL_HORN = ['#ff3b2f', '#9c0f0b'];
const EVIL_PAPER = ['#141414', '#050505'];

function evilPaper() {
  const g = ctx.createRadialGradient(W / 2, H * 0.6, 0, W / 2, H * 0.6, Math.hypot(W, H) * 0.6);
  g.addColorStop(0, EVIL_PAPER[0]);
  g.addColorStop(1, EVIL_PAPER[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function evilFill(c) {
  const g = ctx.createRadialGradient(c.cx - c.r * 0.35, c.cy - c.r * 0.4, c.r * 0.05, c.cx, c.cy, c.r * 1.25);
  g.addColorStop(0, EVIL_BODY[0]);
  g.addColorStop(0.55, EVIL_BODY[1]);
  g.addColorStop(1, EVIL_BODY[2]);
  return g;
}

// El filo rojo: el mismo contorno que se acaba de rellenar, trazado finísimo (menos de un
// píxel: en pantallas retina, un píxel y medio real).
function evilRim() {
  ctx.strokeStyle = EVIL_RIM;
  ctx.lineWidth = 0.75;
  ctx.stroke();
}

// Dos cuernecitos rojos que salen del borde, en diagonal hacia arriba y hacia fuera, y
// se curvan un poco hacia arriba. Se dibujan antes que el cuerpo: la base queda escondida
// detrás del contorno (y de su filo rojo). Se colocan en el borde tal como está ahora, así
// que siguen al cuerpo cuando se aplasta, y giran como la cara.
const HORN = { at: 0.72, up: 0.45, length: 0.22, width: 0.15 };

function evilHorns(c) {
  const s = c.r;
  const rot = Math.atan2(Math.sin(c.angle - c.base), Math.cos(c.angle - c.base)) * 0.35;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const h = s * HORN.length;
  const w = s * HORN.width;
  ctx.save();
  ctx.translate(c.cx, c.cy);
  ctx.rotate(rot);
  for (const side of [-1, 1]) {
    // Hacia dónde sale (u) y lo que mide el cuerpo en esa dirección (edge).
    const a = side * HORN.at;
    const ux = Math.sin(a);
    const uy = -Math.cos(a);
    let edge = 0;
    for (let i = 0; i < POINTS; i++) {
      const lx = (c.x[i] - c.cx) * cos + (c.y[i] - c.cy) * sin;
      const ly = -(c.x[i] - c.cx) * sin + (c.y[i] - c.cy) * cos;
      edge = Math.max(edge, lx * ux + ly * uy);
    }
    const bx = ux * (edge - s * 0.04);
    const by = uy * (edge - s * 0.04);
    // La punta, más hacia arriba que la base.
    const t = a * HORN.up;
    const tipX = bx + Math.sin(t) * h;
    const tipY = by - Math.cos(t) * h;
    const nx = -uy;
    const ny = ux;
    const g = ctx.createLinearGradient(bx - nx * w * side, by - ny * w * side, bx + nx * w * side, by + ny * w * side);
    g.addColorStop(0, EVIL_HORN[0]);
    g.addColorStop(1, EVIL_HORN[1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx - (nx * w) / 2, by - (ny * w) / 2);
    ctx.quadraticCurveTo(bx - (nx * w) / 2 + ux * h * 0.6, by - (ny * w) / 2 + uy * h * 0.6, tipX, tipY);
    ctx.quadraticCurveTo(bx + (nx * w) / 2 + ux * h * 0.5, by + (ny * w) / 2 + uy * h * 0.5, bx + (nx * w) / 2, by + (ny * w) / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// La cara, en neón: cada trazo con un resplandor rojo alrededor.
function evilFace(c, rot, now) {
  const s = c.r;
  ctx.save();
  ctx.translate(c.cx, c.cy);
  ctx.rotate(rot);
  ctx.strokeStyle = EVIL_NEON;
  ctx.shadowColor = EVIL_GLOW;
  ctx.shadowBlur = Math.max(4, s * 0.12);
  ctx.lineWidth = Math.max(1, s * 0.04);
  // Ojos: dos cruces que miran al puntero. Al parpadear, la cruz se aplasta; con «> <»
  // o con el susto, se hacen un poco más grandes.
  const t = (now - c.blinkAt) / 130;
  const open = t >= 0 && t <= 1 ? Math.abs(1 - 2 * t) : 1;
  const big = now < c.squintUntil || now < c.surprisedUntil ? 1.3 : 1;
  const d = Math.max(1.5, s * 0.075) * big;
  ctx.beginPath();
  for (const side of [-1, 1]) {
    const ex = side * s * 0.24 + c.lookX * s;
    const ey = -s * 0.14 + c.lookY * s;
    const dy = Math.max(0.4, d * open);
    ctx.moveTo(ex - d, ey - dy);
    ctx.lineTo(ex + d, ey + dy);
    ctx.moveTo(ex + d, ey - dy);
    ctx.lineTo(ex - d, ey + dy);
  }
  ctx.stroke();
  // Boca: una sonrisa ancha, cosida con puntadas cortas que la cruzan, cada una un poco
  // torcida (siempre igual para cada vertiki). Con el ratón encima, más honda.
  const w = s * 0.27;
  const h = Math.max(0.05, w * (0.3 + 0.35 * c.smile));
  const top = s * 0.1;
  const R = (w * w + h * h) / (2 * h);
  const centerY = top + h - R;
  const a0 = Math.asin(Math.min(1, (top - centerY) / R));
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.beginPath();
  ctx.arc(0, centerY, R, a0, Math.PI - a0);
  const stitches = 6;
  const len = s * 0.055;
  for (let k = 0; k < stitches; k++) {
    const a = a0 + ((Math.PI - 2 * a0) * (k + 0.5)) / stitches;
    const px = Math.cos(a) * R;
    const py = centerY + Math.sin(a) * R;
    const skew = Math.sin(c.base * 13 + k * 2.1) * 0.35;
    const nx = Math.cos(a + skew);
    const ny = Math.sin(a + skew);
    ctx.moveTo(px - nx * len, py - ny * len);
    ctx.lineTo(px + nx * len, py + ny * len);
  }
  ctx.stroke();
  ctx.restore();
}

// =========================================================================================
// Extra · Xmas (por consola, vertikis.style.xmas(), o #xmas): colores de Navidad, un gorro rojo
// con borde y pompón blancos y nieve que cae por detrás.
// =========================================================================================

let xmas = false;
const XMAS_PALETTE = ['#d7383b', '#e8615a', '#2f8f5b', '#1f6b45', '#4caf72', '#e9b949'];
const HAT_RED = '#c92f33';
const HAT_WHITE = '#fbfbfb';
const HAT_EDGE = '#d9d9d9';
const SNOW = '#c7d5e0';
let snow = [];

// Cada vertiki se queda siempre con el mismo color de Navidad (se elige la primera vez).
function xmasOf(c) {
  if (!c.xm) {
    const color = XMAS_PALETTE[Math.floor(Math.random() * XMAS_PALETTE.length)];
    c.xm = { color, light: tint(color, 0.16), shade: tint(color, -0.06) };
  }
  return c.xm;
}

function xmasFill(c) {
  const m = xmasOf(c);
  const g = ctx.createRadialGradient(c.cx - c.r * 0.35, c.cy - c.r * 0.4, c.r * 0.05, c.cx, c.cy, c.r * 1.25);
  g.addColorStop(0, m.light);
  g.addColorStop(0.55, m.color);
  g.addColorStop(1, m.shade);
  return g;
}

// El gorro, girado como la cara. Se dibuja justo después de su cuerpo (los que vienen
// detrás lo tapan, y las caras van encima de todo). Se apoya en lo más alto del cuerpo tal
// como está ahora, así que baja cuando se aplasta.
// La punta (con el pompón) tiene física propia, como un punto del paso 4: inercia, un
// muelle que la lleva a su sitio y la gravedad. Así se queda atrás al caer o al arrastrar,
// se balancea y se dobla hacia donde tira la gravedad (en el móvil, al inclinarlo). Su
// distancia a la base no cambia: la tela no se estira.
const HAT = { spring: 0.07, friction: 0.9, gravity: 0.35, lowest: 0.12 };

function xmasHat(c) {
  const rot = Math.atan2(Math.sin(c.angle - c.base), Math.cos(c.angle - c.base)) * 0.35;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  let top = 0;
  for (let i = 0; i < POINTS; i++) {
    const ly = -(c.x[i] - c.cx) * sin + (c.y[i] - c.cy) * cos;
    if (ly < top) top = ly;
  }
  // Hacia dónde cae la punta: siempre el mismo lado para cada vertiki.
  hatOn(c, c.cx, c.cy, c.r, rot, top, Math.sin(c.base * 7));
}

// El gorro sobre cualquier cosa (un vertiki o el estepicursor): «owner» guarda la física
// de la punta; (cx, cy) es el centro, s el tamaño, rot el giro, top lo más alto del cuerpo
// (en su sistema girado) y lean hacia dónde cae la punta (de −1 a 1).
function hatOn(c, cx, cy, s, rot, top, lean) {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const y = top + s * 0.18;
  const bw = s * 0.44;
  const restX = lean * s * 0.4;
  const restY = y - s * 0.58;
  const len = Math.hypot(restX, restY - y);
  // De la cara al mundo y vuelta (girar rot y mover al centro).
  const toX = (lx, ly) => cx + lx * cos - ly * sin;
  const toY = (lx, ly) => cy + lx * sin + ly * cos;
  const baseX = toX(0, y);
  const baseY = toY(0, y);
  const restWX = toX(restX, restY);
  const restWY = toY(restX, restY);
  // La primera vez (o al volver a xmas) la punta empieza en su sitio.
  const now = performance.now();
  if (!c.hat || now - c.hat.t > 200) c.hat = { x: restWX, y: restWY, px: restWX, py: restWY, t: now };
  const h = c.hat;
  h.t = now;
  const vx = (h.x - h.px) * HAT.friction;
  const vy = (h.y - h.py) * HAT.friction;
  h.px = h.x;
  h.py = h.y;
  h.x += vx + (restWX - h.x) * HAT.spring + HAT.gravity * gravX;
  h.y += vy + (restWY - h.y) * HAT.spring + HAT.gravity * gravY;
  // Vuelta a la cara: a la misma distancia de la base y nunca por debajo del borde.
  const dx = h.x - baseX;
  const dy = h.y - baseY;
  let tx = dx * cos + dy * sin;
  let ty = -dx * sin + dy * cos;
  ty = Math.min(ty, -s * HAT.lowest);
  const d = Math.hypot(tx, ty) || 1;
  tx *= len / d;
  ty *= len / d;
  h.x = baseX + tx * cos - ty * sin;
  h.y = baseY + tx * sin + ty * cos;
  const tipX = tx;
  const tipY = y + ty;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.fillStyle = HAT_RED;
  ctx.beginPath();
  ctx.moveTo(-bw * 0.9, y);
  ctx.quadraticCurveTo(-bw * 0.6 + tipX * 0.3, y + ty * 0.95, tipX, tipY);
  ctx.quadraticCurveTo(bw * 0.5 + tipX * 0.3, y + ty * 0.7, bw * 0.9, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = HAT_WHITE;
  ctx.strokeStyle = HAT_EDGE;
  ctx.lineWidth = Math.max(0.5, s * 0.015);
  const bh = s * 0.15;
  ctx.beginPath();
  ctx.roundRect(-bw, y - bh / 2, bw * 2, bh, bh / 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(tipX, tipY, s * 0.085, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// Copos que caen despacio, balanceándose, por detrás de los vertikis. Al salir por abajo
// vuelven a entrar por arriba.
function xmasSnow() {
  const want = Math.min(160, Math.round((W * H) / 11000));
  while (snow.length < want) {
    snow.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2.2, v: 0.4 + Math.random() * 0.8, p: Math.random() * 6.3 });
  }
  if (snow.length > want) snow.length = want;
  const t = performance.now() / 1000;
  ctx.fillStyle = SNOW;
  ctx.beginPath();
  for (const f of snow) {
    f.y += f.v;
    f.x += Math.sin(t + f.p) * 0.3;
    if (f.y > H + f.r) {
      f.y = -f.r;
      f.x = Math.random() * W;
    }
    ctx.moveTo(f.x + f.r, f.y);
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
  }
  ctx.fill();
}

// =========================================================================================
// Extra · Halloween (por consola, vertikis.style.halloween(), o
// #halloween): fantasmitas negros, con
// la cabeza redonda, una falda ondulada que se mueve y dos ojos blancos en píldora. Los
// fantasmas vuelan: no tienen gravedad y van a la deriva, cada uno a su aire. En el móvil,
// inclinarlo sí los empuja, pero poco. De vez en cuando pasa un murciélago por detrás.
// =========================================================================================

let halloween = false;
// tilt: la gravedad al inclinar el móvil (fracción de la normal). drift: lo que empuja la
// deriva en cada subpaso (con la fricción, unos 50 px/s como mucho). skirt: lo que baja la
// falda y lo alta que es la onda, en fracción del radio.
// fill: cuánto de la pantalla ocupan (los demás modos, la mitad). few: cuántos como mínimo.
// space y push: a qué
// distancia empiezan a apartarse (en sumas de radios) y con cuánta fuerza.
const HALLOWEEN = { tilt: touchDevice ? 0.1 : 0.3, drift: 0.008, skirt: 0.22, wave: 0.11, waves: 3, fill: 0.25, few: touchDevice ? 4 : 7, space: 1.35, push: 0.0025 };
const GHOST = '#111111';
const GHOST_EYE = '#ffffff';

// Al entrar en halloween, menos: se eligen al azar y se queda cada uno que quepa en «fill»
// de la pantalla; el que no cabe se salta y se sigue probando con el siguiente. Siempre al
// menos «few» (si esos no caben, encogen poco a poco hasta caber). Los demás se van sin más.
function ghostFew() {
  const room = W * H * HALLOWEEN.fill;
  let area = 0;
  const keep = [];
  const shuffled = cells.map((c) => [Math.random(), c]).sort((a, b) => a[0] - b[0]);
  for (const [, c] of shuffled) {
    const size = Math.PI * c.r * c.r;
    if (keep.length >= HALLOWEEN.few && area + size > room) continue;
    keep.push(c);
    area += size;
  }
  cells = keep;
  if (area > room) {
    const k = Math.sqrt(room / area);
    for (const c of cells) c.target = c.rest = c.r * k;
  }
  if (grabbed && !cells.includes(grabbed)) grabbed = null;
  if (hovered && !cells.includes(hovered)) hovered = null;
}

// Les cuesta acercarse: cuando dos están a menos de «space» veces la suma de sus radios,
// se empujan suavemente, más cuanto más cerca (antes de llegar a tocarse).
function ghostSpace() {
  for (let a = 0; a < cells.length; a++) {
    for (let b = a + 1; b < cells.length; b++) {
      const p = cells[a];
      const q = cells[b];
      const dx = q.cx - p.cx;
      const dy = q.cy - p.cy;
      const d = Math.hypot(dx, dy) || 1;
      const min = (p.r + q.r) * HALLOWEEN.space;
      if (d >= min) continue;
      const f = (min - d) * HALLOWEEN.push;
      const ux = (dx / d) * f;
      const uy = (dy / d) * f;
      for (let i = 0; i < POINTS; i++) {
        p.x[i] -= ux;
        p.y[i] -= uy;
        q.x[i] += ux;
        q.y[i] += uy;
      }
    }
  }
}

// La deriva: un empujón que cambia despacio de dirección, distinto para cada fantasma.
const ghostDrift = (c, t) => [
  Math.sin(t * 0.4 + c.base * 5) * HALLOWEEN.drift,
  Math.cos(t * 0.31 + c.base * 8.5) * HALLOWEEN.drift,
];

// El cuerpo: el mismo anillo, pero visto girado como la cara, con la mitad de abajo
// estirada hacia abajo y ondulada (la onda corre despacio: la falda se mueve). Para que la
// onda salga suave, entre cada dos puntos del anillo se mete el punto medio.
function ghostBody(c, now) {
  const s = c.r;
  const rot = Math.atan2(Math.sin(c.angle - c.base), Math.cos(c.angle - c.base)) * 0.35;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const t = now / 1000;
  const n = POINTS * 2;
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  for (let i = 0; i < POINTS; i++) {
    const j = (i + 1) % POINTS;
    for (const [k, px, py] of [
      [i * 2, c.x[i], c.y[i]],
      [i * 2 + 1, (c.x[i] + c.x[j]) / 2, (c.y[i] + c.y[j]) / 2],
    ]) {
      let lx = (px - c.cx) * cos + (py - c.cy) * sin;
      let ly = -(px - c.cx) * sin + (py - c.cy) * cos;
      if (ly > 0) {
        const b = Math.min(1, ly / s);
        ly += b * s * HALLOWEEN.skirt;
        ly += b * b * s * HALLOWEEN.wave * Math.sin((lx / s) * Math.PI * HALLOWEEN.waves + t * 2.5 + c.base * 3);
      }
      xs[k] = lx;
      ys[k] = ly;
    }
  }
  ctx.save();
  ctx.translate(c.cx, c.cy);
  ctx.rotate(rot);
  ctx.fillStyle = GHOST;
  ctx.beginPath();
  ctx.moveTo((xs[n - 1] + xs[0]) / 2, (ys[n - 1] + ys[0]) / 2);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    ctx.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[j]) / 2, (ys[i] + ys[j]) / 2);
  }
  ctx.fill();
  ctx.restore();
}

// Los ojos: dos píldoras blancas de pie, juntas, que se van hacia donde mira (hacia el
// puntero, más que en los otros modos: como en el dibujo, mirando de lado). Sin boca. Al
// parpadear se aplastan; con el susto, se hacen más grandes.
function ghostEyes(c, rot, now) {
  const s = c.r;
  const t = (now - c.blinkAt) / 130;
  const open = t >= 0 && t <= 1 ? Math.abs(1 - 2 * t) : 1;
  const big = now < c.surprisedUntil ? 1.25 : 1;
  const w = s * 0.13 * big;
  const h = Math.max(w * 0.5, s * 0.27 * big * open);
  const look = Math.max(-0.22, Math.min(0.22, c.lookX * 4));
  ctx.save();
  ctx.translate(c.cx, c.cy);
  ctx.rotate(rot);
  ctx.fillStyle = GHOST_EYE;
  for (const side of [-1, 1]) {
    const ex = (side * 0.15 + look) * s;
    const ey = (-0.08 + c.lookY * 2) * s;
    ctx.beginPath();
    ctx.roundRect(ex - w / 2, ey - h / 2, w, h, w / 2);
    ctx.fill();
  }
  ctx.restore();
}

// Murciélagos: cada pocos segundos cruza uno, por detrás de los fantasmas, batiendo las
// alas. Entra y sale por fuera de la pantalla siguiendo una curva (de Bézier, con dos puntos
// de control al azar dentro de la pantalla) que tiembla un poco, como su vuelo. A veces
// van dos seguidos.
const BAT = { every: [12000, 36000], time: [3500, 6500], pair: 0.25 };
// Por dónde entran y por dónde salen: l, izquierda; r, derecha; t, arriba; bl y br, abajo.
const BAT_ROUTES = [['l', 'r'], ['r', 'l'], ['br', 't'], ['bl', 't'], ['br', 'l'], ['bl', 'r'], ['l', 't'], ['r', 't']];
let bats = [];
let batNextAt = 0;

function batsStart() {
  bats = [];
  batNextAt = performance.now() + 1500;
}

function batEdge(side, size) {
  const out = size * 2;
  const along = (from, to) => from + Math.random() * (to - from);
  if (side === 'l') return [-out, along(0.1, 0.8) * H];
  if (side === 'r') return [W + out, along(0.1, 0.8) * H];
  if (side === 't') return [along(0.1, 0.9) * W, -out];
  if (side === 'bl') return [along(0, 0.35) * W, H + out];
  return [along(0.65, 1) * W, H + out];
}

function makeBat(now) {
  const size = Math.max(14, Math.min(W, H) * 0.035) * (0.8 + Math.random() * 0.5);
  const [from, to] = BAT_ROUTES[Math.floor(Math.random() * BAT_ROUTES.length)];
  return {
    size,
    from: batEdge(from, size),
    a: [Math.random() * W, Math.random() * H],
    b: [Math.random() * W, Math.random() * H],
    to: batEdge(to, size),
    start: now,
    time: BAT.time[0] + Math.random() * (BAT.time[1] - BAT.time[0]),
    phase: Math.random() * Math.PI * 2,
  };
}

const bezier = (p, a, b, q, t) => {
  const u = 1 - t;
  return u * u * u * p + 3 * u * u * t * a + 3 * u * t * t * b + t * t * t * q;
};

function batShape(b, x, y, now) {
  const s = b.size;
  // El aleteo: lift levanta las puntas de las alas (y las baja al bajar).
  const lift = Math.sin(now * 0.028 + b.phase) * 0.7;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = GHOST;
  for (const side of [-1, 1]) {
    const P = (px, py) => [side * px * s, (py - lift * px) * s];
    ctx.beginPath();
    ctx.moveTo(...P(0.08, -0.14));
    ctx.quadraticCurveTo(...P(0.45, -0.42), ...P(1.05, -0.18));
    ctx.quadraticCurveTo(...P(0.82, -0.02), ...P(0.68, 0.2));
    ctx.quadraticCurveTo(...P(0.52, 0.02), ...P(0.36, 0.24));
    ctx.quadraticCurveTo(...P(0.22, 0.08), ...P(0.08, 0.2));
    ctx.closePath();
    ctx.fill();
    // Una oreja.
    ctx.beginPath();
    ctx.moveTo(side * 0.03 * s, -0.2 * s);
    ctx.lineTo(side * 0.14 * s, -0.42 * s);
    ctx.lineTo(side * 0.16 * s, -0.14 * s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(0, 0.02 * s, 0.17 * s, 0.3 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = GHOST_EYE;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 0.07 * s, -0.12 * s, Math.max(0.8, 0.03 * s), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function batsFly(now) {
  if (now > batNextAt) {
    bats.push(makeBat(now));
    if (Math.random() < BAT.pair) bats.push(makeBat(now + 500));
    batNextAt = now + BAT.every[0] + Math.random() * (BAT.every[1] - BAT.every[0]);
  }
  bats = bats.filter((b) => now < b.start + b.time);
  for (const b of bats) {
    const t = (now - b.start) / b.time;
    if (t < 0) continue;
    const x = bezier(b.from[0], b.a[0], b.b[0], b.to[0], t);
    const y = bezier(b.from[1], b.a[1], b.b[1], b.to[1], t);
    batShape(b, x + Math.sin(now * 0.009 + b.phase) * b.size * 0.35, y + Math.sin(now * 0.013 + b.phase) * b.size * 0.5, now);
  }
}

let emptySince = null;
let weed = null;
let weedNextAt = 0;
let weedGrab = null;

function makeWeed() {
  // Cada vez con un tamaño distinto: de pelusilla a pelusa.
  const r = Math.max(14, Math.min(46, Math.min(W, H) * 0.05)) * (0.55 + Math.random() * 0.6);
  // Una bola de pelusa: un núcleo de borde blando e irregular (16 bultos) y muchos pelos.
  // Cada pelo se dobla como un muelle (b, con velocidad bv), con su propia curva de reposo
  // y su propio ritmo de vaivén. Casi todos son cortos y tupidos; unos pocos, largos.
  const lumps = [];
  for (let i = 0; i < 16; i++) lumps.push(0.85 + Math.random() * 0.3);
  const hairs = [];
  const N = 150;
  for (let i = 0; i < N; i++) {
    const long = Math.random() < 0.1;
    hairs.push({
      a: (i / N) * Math.PI * 2 + Math.random() * 0.08,
      from: r * (0.45 + Math.random() * 0.15),
      len: r * (long ? 0.45 + Math.random() * 0.35 : 0.2 + Math.random() * 0.3),
      curl: (Math.random() - 0.5) * 1.1, phase: Math.random() * Math.PI * 2, b: 0, bv: 0,
    });
  }
  const y = floor - r;
  return {
    x: -r * 1.4, y, vy: 0, rot: 0, r, speed: 3.2 + Math.random(), lumps, hairs,
    prevX: -r * 1.4 - 3.5, prevY: y, prevRot: 0, pvx: 3.5, pvy: 0,
    lookX: 0, lookY: 0, blinkAt: performance.now() + 1500, smile: 0, smileV: 0,
  };
}

// ¿El puntero está sobre el estepicursor?
const weedAt = (x, y) => weed && Math.hypot(x - weed.x, y - weed.y) < weed.r * 1.2;

// Agarrarlo: mientras lo arrastras se queda contigo; al soltarlo sigue rodando.
function grabWeed(e) {
  if (!weedAt(e.clientX, e.clientY)) return false;
  weedGrab = { x: e.clientX - weed.x, y: e.clientY - weed.y };
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('is-dragging');
  return true;
}

function tumbleweed(now) {
  // Sale a los 2 s de quedarse sin vertikis y, si nadie crea uno, vuelve 6 s después de irse.
  if (cells.length > 0) {
    emptySince = null;
  } else if (emptySince === null) {
    emptySince = now;
    weedNextAt = now + 2000;
  } else if (!weed && now > weedNextAt) {
    weed = makeWeed();
  }
  if (!weed) return;

  const w = weed;
  if (weedGrab) {
    w.x = pointer.x - weedGrab.x;
    w.y = Math.min(floor - w.r, pointer.y - weedGrab.y);
    w.vy = 0;
  } else {
    w.x += w.speed;
    w.rot += w.speed / w.r;
    w.vy += 0.35;
    w.y += w.vy;
    if (w.y > floor - w.r) {
      w.y = floor - w.r;
      w.vy = -(1.5 + Math.random() * 3.5);
    }
    if (w.x - w.r * 1.4 > W) {
      weed = null;
      weedNextAt = now + 6000;
      return;
    }
  }

  // El núcleo: un contorno con bultos que gira al rodar, con el borde difuminado (sombra
  // borrosa del mismo color) para que no parezca un círculo recortado.
  ctx.save();
  ctx.translate(w.x, w.y);
  const ink = wire ? WIRE_LINE : riso ? RISO_INKS[1] : pixel ? `rgb(${WEED_PX})` : INK;
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  ctx.shadowColor = ink;
  ctx.shadowBlur = w.r * 0.35;
  ctx.beginPath();
  const n = w.lumps.length;
  const lump = (i) => {
    const a = (i / n) * Math.PI * 2 + w.rot;
    const d = w.r * 0.62 * w.lumps[i % n];
    return [Math.cos(a) * d, Math.sin(a) * d];
  };
  let [px, py] = lump(n - 1);
  let [qx, qy] = lump(0);
  ctx.moveTo((px + qx) / 2, (py + qy) / 2);
  for (let i = 0; i < n; i++) {
    [px, py] = lump(i);
    [qx, qy] = lump(i + 1);
    ctx.quadraticCurveTo(px, py, (px + qx) / 2, (py + qy) / 2);
  }
  ctx.fill();
  ctx.shadowBlur = 0;

  // Los pelos se doblan por la inercia (se quedan atrás al acelerar, al botar o al
  // arrastrarlo), por el giro y el aire, cuelgan un poco por la gravedad y se mecen solos.
  const vx = w.x - w.prevX;
  const vy = w.y - w.prevY;
  const ax = vx - w.pvx;
  const ay = vy - w.pvy;
  const spin = w.rot - w.prevRot;
  w.prevX = w.x;
  w.prevY = w.y;
  w.prevRot = w.rot;
  w.pvx = vx;
  w.pvy = vy;
  ctx.lineWidth = Math.max(0.8, w.r / 32);
  ctx.beginPath();
  for (const h of w.hairs) {
    const th = h.a + w.rot;
    const tx = -Math.sin(th);
    const ty = Math.cos(th);
    const want = -(ax * tx + ay * ty) * 0.2 - (vx * tx + vy * ty) * 0.05 - spin * 3
      + ty * 0.45 + Math.sin(now * 0.003 + h.phase) * 0.22;
    h.bv = (h.bv + (want - h.b) * 0.07) * 0.88;
    h.b = Math.max(-1.6, Math.min(1.6, h.b + h.bv));
    const bend = h.b + h.curl;
    const bx = Math.cos(th) * h.from;
    const by = Math.sin(th) * h.from;
    const mid = th + bend * 0.5;
    const tip = th + bend * 1.6;
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + Math.cos(mid) * h.len * 0.55, by + Math.sin(mid) * h.len * 0.55,
      bx + Math.cos(mid) * h.len * 0.5 + Math.cos(tip) * h.len * 0.5,
      by + Math.sin(mid) * h.len * 0.5 + Math.sin(tip) * h.len * 0.5);
  }
  ctx.stroke();

  // La cara de los vertikis (siempre derecha): ojos que miran al puntero y parpadean, y una
  // sonrisa que crece con el ratón encima. En blanco, sobre el cuerpo negro.
  const s = w.r * 0.7;
  let lx = 0;
  let ly = 0;
  if (pointerSeen) {
    const d = Math.hypot(pointer.x - w.x, pointer.y - w.y) || 1;
    lx = ((pointer.x - w.x) / d) * 0.035;
    ly = ((pointer.y - w.y) / d) * 0.035;
  }
  w.lookX += (lx - w.lookX) * 0.15;
  w.lookY += (ly - w.lookY) * 0.15;
  if (now > w.blinkAt + 130) w.blinkAt = now + (Math.random() < 0.2 ? 180 : 2000 + Math.random() * 4000);
  const want = weedGrab || (mouseInside && weedAt(pointer.x, pointer.y)) ? 1 : 0;
  w.smileV = (w.smileV + (want - w.smile) * 0.22) * 0.68;
  w.smile += w.smileV;

  const eye = Math.max(0.9, s * 0.04);
  const t = (now - w.blinkAt) / 130;
  const open = t >= 0 && t <= 1 ? Math.abs(1 - 2 * t) : 1;
  const k = w.smile;
  const mw = s * 0.16;
  const mh = Math.max(0.05, mw * (0.32 + 0.5 * k));
  const top = s * 0.06;
  const R = (mw * mw + mh * mh) / (2 * mh);
  const centerY = top + mh - R;
  const a0 = Math.asin(Math.min(1, (top - centerY) / R));
  const face = (color, grow) => {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, s * 0.032) + grow * 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * s * 0.22 + w.lookX * s, -s * 0.12 + w.lookY * s, eye + grow, Math.max(0.4, eye * open) + grow, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, centerY, R, a0, Math.PI - a0);
    ctx.stroke();
  };
  if (!pixel) face(wire ? WIRE_PAPER : riso ? RISO_PAPER : '#fff', 0);
  ctx.restore();
  // En xmas, también lleva gorro: derecho como su cara, encima del núcleo de pelo.
  if (xmas) hatOn(w, w.x, w.y, w.r * 1.2, 0, -w.r * 0.85, 0.6);
  if (pixel) pixelFace(w, w.x, w.y, 0, s, false, false, '#000', now);
}

// =========================================================================================
// ¡Arrancamos!
// =========================================================================================

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
