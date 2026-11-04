// Vertikis: criaturas blandas de colores, con cara, que caen, se empujan y se deforman al
// chocar, y que se pueden arrastrar, reventar y crear. Un experimento de VERTIK.
// Homenaje a la home de yugop.com (Yugo Nakamura, 2005).
//
// Todo está en este archivo, en el mismo orden que el tutorial del README: cada sección
// lleva el número de su paso.

// =========================================================================================
// Paso 1 · El escenario: un canvas que ocupa la ventana
// =========================================================================================

const canvas = document.querySelector('[data-cells]');
const ctx = canvas.getContext('2d');

let W = 0; // ancho y alto del escenario, en píxeles CSS
let H = 0;

function resize() {
  // En pantallas retina hay 2 píxeles reales por cada píxel CSS: dibujamos al doble para
  // que se vea nítido (como mucho ×2, para no gastar de más).
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const first = W === 0;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  // A partir de aquí dibujamos en píxeles CSS y el navegador multiplica por dpr.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (first) populate(); // la primera vez, llenamos el escenario (paso 7)
}

// =========================================================================================
// Paso 3 · El objeto vertiki: un anillo de puntos
// =========================================================================================

const POINTS = 28; // puntos del contorno de cada vertiki

// Forma de reposo común: un círculo de radio 1. Cada vertiki la multiplica por su radio.
// Guardamos x e y seguidas: [x0, y0, x1, y1, …].
const UNIT = new Float32Array(POINTS * 2);
for (let i = 0; i < POINTS; i++) {
  const a = (i / POINTS) * Math.PI * 2;
  UNIT[i * 2] = Math.cos(a);
  UNIT[i * 2 + 1] = Math.sin(a);
}

// Paso 10 · Colores planos, alegres pero algo apagados. La cara va en tinta oscura encima.
const PALETTE = ['#f29e4c', '#f2c14e', '#4fb3a9', '#ef7aa1', '#6c9bd2', '#9ccc5a', '#4caf72', '#9b86c9', '#f0806c'];
const INK = '#1b1b1b';

// Mezcla un color hex con blanco (t > 0) o con negro (t < 0).
function tint(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const to = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  const ch = (v) => Math.round(v + (to - v) * k);
  return `rgb(${ch(n >> 16)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}

let cells = []; // todos los vertikis («células») del escenario

function makeCell(cx, cy, r) {
  // Forma de reposo ligeramente ovalada (orgánica, no un círculo perfecto): el eje largo
  // mide r·(1+e) y el corto r·(1−e), con el eje largo en una dirección al azar.
  const e = 0.02 + Math.random() * 0.04;
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
    r, // radio de reposo
    e, // cuánto se ovala
    x, // posición actual de cada punto
    y,
    px: x.slice(), // posición en el paso anterior (paso 4: Verlet)
    py: y.slice(),
    cx, // centro y giro de la forma (paso 6)
    cy,
    angle: turn,
    base: turn, // giro con el que nació: la cara se mide desde aquí, para que nazca derecha
    // Paso 10 · color y dos tonos para el degradado
    color,
    light: tint(color, 0.16),
    shade: tint(color, -0.06),
    // Paso 11 · la cara
    smile: 0, // 0 = «:)», 1 = «:D»; se anima con un muelle (smileV es su velocidad)
    smileV: 0,
    lookX: 0, // hacia dónde miran los ojos (suavizado)
    lookY: 0,
    blinkAt: performance.now() + 1000 + Math.random() * 5000, // próximo parpadeo (ms)
    surprisedUntil: 0, // boca «o» y ojos abiertos (al reventar una vecina)
    squintUntil: 0, // ojos apretados «> <» (tras un golpe fuerte)
    vx: 0, // velocidad del centro en el último fotograma (para detectar golpes)
    vy: 0,
    prevCx: cx,
    prevCy: cy,
    // Paso 14 · al nacer
    target: undefined, // radio al que crece una recién creada
    youngUntil: undefined, // hasta cuándo no se puede reventar
  };
}

// =========================================================================================
// Paso 7 · Muchos vertikis
// =========================================================================================

// Tamaños variados y algo montados entre sí, para que al arrancar se empujen y queden
// apretados y aplastados por los contactos.
function populate() {
  cells = [];
  const unit = Math.min(W, H);
  const target = W * H * 0.5; // superficie que ocupan (con la gravedad se amontonan abajo)
  let area = 0;
  for (let tries = 0; tries < 6000 && area < target; tries++) {
    const r = unit * (0.09 + Math.random() ** 1.3 * 0.12);
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

const SUBSTEPS = 4; // paso 9: cuántas veces calculamos la física en cada fotograma
const FRICTION = 0.96; // paso 4: cuánta velocidad conserva cada punto en cada paso
const STIFFNESS = 0.45; // paso 6: cuánto tira cada punto hacia su forma de reposo
// Gravedad (px por paso²). En móvil, más baja y con la dirección que marque la inclinación
// del teléfono (paso 16); en escritorio, siempre hacia abajo.
const touchDevice = window.matchMedia('(pointer: coarse)').matches;
const GRAVITY = touchDevice ? 0.27 : 0.45;
let gravX = 0; // dirección de la gravedad (vector de largo 1)
let gravY = 1;

// Paso 12 · el arrastre
let grabbed = null; // el vertiki agarrado
let hovered = null; // el vertiki bajo el ratón
let pointerSeen = false; // hasta que se mueve el puntero, los ojos miran al frente
let grabOffset = { x: 0, y: 0 };
let pointer = { x: 0, y: 0 };

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
    const qx = UNIT[i * 2] * c.r * (1 + c.e);
    const qy = UNIT[i * 2 + 1] * c.r * (1 - c.e);
    const rx = c.x[i] - c.cx;
    const ry = c.y[i] - c.cy;
    dot += qx * rx + qy * ry;
    cross += qx * ry - qy * rx;
  }
  c.angle = Math.atan2(cross, dot);
}

function step() {
  for (const c of cells) {
    // Paso 4 · Inercia con fricción, más la gravedad (integración de Verlet: la velocidad
    // es la diferencia entre la posición actual y la anterior).
    for (let i = 0; i < POINTS; i++) {
      // El agarrado se frena más: así sigue al puntero sin oscilar.
      const f = c === grabbed ? 0.6 : FRICTION;
      const vx = (c.x[i] - c.px[i]) * f;
      const vy = (c.y[i] - c.py[i]) * f;
      c.px[i] = c.x[i];
      c.py[i] = c.y[i];
      c.x[i] += vx + GRAVITY * gravX;
      c.y[i] += vy + GRAVITY * gravY;
    }

    // Paso 12 · Arrastre: todo el vertiki se acerca al puntero. La posición anterior se
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
    for (let i = 0; i < POINTS; i++) {
      const qx = UNIT[i * 2] * c.r * (1 + c.e);
      const qy = UNIT[i * 2 + 1] * c.r * (1 - c.e);
      const gx = c.cx + qx * cos - qy * sin; // dónde «debería» estar este punto
      const gy = c.cy + qx * sin + qy * cos;
      c.x[i] += (gx - c.x[i]) * STIFFNESS;
      c.y[i] += (gy - c.y[i]) * STIFFNESS;
    }
  }

  // Paso 8a · Choques por puntos: cada punto que entra en otro vertiki (visto como un
  // círculo) sale hacia fuera. Así se aplastan por la zona de contacto.
  for (let a = 0; a < cells.length; a++) {
    const A = cells[a];
    for (let b = 0; b < cells.length; b++) {
      if (a === b) continue;
      const B = cells[b];
      const reach = A.r + B.r;
      if (Math.abs(A.cx - B.cx) > reach || Math.abs(A.cy - B.cy) > reach) continue; // lejos
      const R = B.r * 0.96;
      for (let i = 0; i < POINTS; i++) {
        const dx = A.x[i] - B.cx;
        const dy = A.y[i] - B.cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R * R || d2 === 0) continue; // este punto está fuera
        const d = Math.sqrt(d2);
        const push = (R - d) * 0.5;
        A.x[i] += (dx / d) * push;
        A.y[i] += (dy / d) * push;
      }
    }
  }

  // Paso 8b · Separación entre vertikis enteros: si dos centros están más cerca de lo que
  // permiten sus tamaños (con un 12 % de margen para que se sigan aplastando), se apartan
  // como bloques. Pesan según su superficie; el agarrado pesa más, para apartar a los demás.
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
      if (c.y[i] < 0 || c.y[i] > H) {
        c.y[i] = c.y[i] < 0 ? 0 : H;
        c.px[i] = c.x[i] - (c.x[i] - c.px[i]) * 0.6;
      }
    }
  }
}

// =========================================================================================
// Pasos 3, 10, 11 y 13 · Dibujar
// =========================================================================================

let drops = []; // paso 13: gotas de los globos reventados
let rings = []; // y ondas que se abren

function draw() {
  ctx.clearRect(0, 0, W, H);

  // Cuerpos.
  for (const c of cells) {
    // Paso 10 · Levísimo degradado: luz fija arriba a la izquierda, más claro ahí y un poco
    // más oscuro en el borde opuesto.
    const g = ctx.createRadialGradient(c.cx - c.r * 0.35, c.cy - c.r * 0.4, c.r * 0.05, c.cx, c.cy, c.r * 1.25);
    g.addColorStop(0, c.light);
    g.addColorStop(0.55, c.color);
    g.addColorStop(1, c.shade);
    ctx.fillStyle = g;
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
  }

  // Paso 11 · Caras: dos ojos que miran al puntero y parpadean, y una sonrisa que se curva
  // más con el ratón encima. Reacciones: «o» de susto y ojos apretados «> <».
  const now = performance.now();
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const c of cells) {
    const s = c.r; // todo se mide en proporción al radio
    const squint = now < c.squintUntil;
    const surprised = !squint && now < c.surprisedUntil;
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
      ctx.arc(0, s * 0.12, s * 0.06, 0, Math.PI * 2); // «o» de susto
      ctx.stroke();
    } else {
      // Un trozo de círculo que pasa por las dos comisuras y por el punto más bajo de la
      // sonrisa. Con el ratón encima se hunde más (k de 0 a 1).
      const k = squint ? 0 : c.smile;
      const w = s * 0.16; // medio ancho de la boca
      const h = Math.max(0.05, w * (0.32 + 0.5 * k)); // cuánto baja el centro
      const top = s * 0.06; // altura de las comisuras
      const R = (w * w + h * h) / (2 * h);
      const centerY = top + h - R;
      const a0 = Math.asin(Math.min(1, (top - centerY) / R));
      ctx.arc(0, centerY, R, a0, Math.PI - a0);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Paso 13 · Gotas y ondas de los globos reventados.
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
}

// =========================================================================================
// Paso 2 · El bucle: unas 60 veces por segundo, calcular y dibujar
// =========================================================================================

function frame() {
  updateHover(); // paso 12
  updateGravity(); // paso 16
  const now = performance.now();

  for (const c of cells) {
    // Paso 11 · La boca se abre o se cierra con un muelle (pequeño rebote, ~0,3 s).
    const want = c === hovered || c === grabbed ? 1 : 0;
    c.smileV = (c.smileV + (want - c.smile) * 0.22) * 0.68;
    c.smile += c.smileV;

    // Paso 11 · Mirada: hacia el puntero, en el giro de la cara, como mucho un 3,5 % del radio.
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

    // Paso 11 · Parpadeo: al acabar uno, el siguiente en 2–6 s (a veces doble, enseguida).
    if (now > c.blinkAt + 130) c.blinkAt = now + (Math.random() < 0.2 ? 180 : 2000 + Math.random() * 4000);

    // Paso 11 · Golpe fuerte: cambio brusco de velocidad del centro de un fotograma a otro.
    const vx = c.cx - c.prevCx;
    const vy = c.cy - c.prevCy;
    if (Math.hypot(vx - c.vx, vy - c.vy) > 7 && c !== grabbed) c.squintUntil = now + 320;
    c.vx = vx;
    c.vy = vy;
    c.prevCx = c.cx;
    c.prevCy = c.cy;

    // Paso 14 · Los recién creados crecen rápido hasta su tamaño.
    if (c.target !== undefined) {
      c.r += (c.target - c.r) * 0.2;
      if (Math.abs(c.target - c.r) < 0.5) c.target = undefined;
    }
  }

  // Paso 13 · Gotas con gravedad que se encogen; ondas que se abren y se apagan (~0,4 s).
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

  // Paso 9 · Varios pasos pequeños de física por fotograma: más estable que uno grande.
  for (let s = 0; s < SUBSTEPS; s++) step();
  draw();
  requestAnimationFrame(frame);
}

// =========================================================================================
// Paso 15 · Sonidos (Web Audio, sintetizados; sin archivos)
// =========================================================================================

// El navegador no deja sonar nada hasta el primer clic o toque: hasta entonces, mudo.
let audio = null;
let master = null; // volumen general: todo pasa por aquí
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

// Reventar: golpe de ruido que se apaga hacia grave, como un globo, más un «thump».
function popSound(size) {
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
    // Los globos grandes revientan más graves.
    tone(160 - Math.min(80, size / 3), 50, 0.12, 0.19);
  } catch {}
}

// Crear: «bloop» que sube, como una burbuja que nace (más grave cuanto más grande).
const createSound = (size) => tone(220 - Math.min(100, size / 2), 720 - Math.min(300, size), 0.14, 0.18);

// =========================================================================================
// Paso 13 · Reventar
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
  popSound(c.r);
}

// =========================================================================================
// Paso 14 · Nacer
// =========================================================================================

// Un vertiki nuevo de tamaño al azar, que nace pequeño y crece hasta su tamaño. Durante sus
// primeros 2 s no se puede reventar: cada toque lo hace crecer (ver «feed»).
const YOUTH = 2000;
function spawn(x, y) {
  const target = Math.min(W, H) * (0.07 + Math.random() * 0.14);
  const c = makeCell(x, y, target * 0.15);
  c.target = target;
  c.youngUntil = performance.now() + YOUTH;
  cells.push(c);
  createSound(target);
}

// Tocar un recién nacido lo hace crecer un 15 % y le da otros 2 s; si pasa de cierto
// tamaño, explota (así no se llena la pantalla de vertikis gigantes).
function feed(c) {
  const next = (c.target ?? c.r) * 1.15;
  if (next > Math.min(W, H) * 0.34) {
    pop(c);
    return;
  }
  c.target = next;
  c.youngUntil = performance.now() + YOUTH;
  tone(300 - Math.min(120, next / 3), 900 - Math.min(400, next), 0.1, 0.14);
}

// =========================================================================================
// Paso 12 · El puntero: arrastrar, doble clic, hover
// =========================================================================================

// El vertiki bajo el puntero (el de encima si se solapan: el último dibujado).
function cellAt(x, y) {
  for (let k = cells.length - 1; k >= 0; k--) {
    const c = cells[k];
    if (Math.hypot(x - c.cx, y - c.cy) <= c.r) return c;
  }
  return null;
}

// Doble clic o doble toque, detectado a mano para que funcione igual con ratón y en táctil:
// dos pulsaciones en menos de 320 ms y a menos de 30 px.
let lastDown = { t: 0, x: 0, y: 0 };

canvas.addEventListener('pointerdown', (e) => {
  pointerSeen = true;
  // Primer gesto: ya se puede sonar (y en iPhone, pedir el acelerómetro).
  if (!unlocked) {
    unlocked = true;
    ac();
    askTilt();
  }
  pointer = { x: e.clientX, y: e.clientY };
  const now = performance.now();
  const double = now - lastDown.t < 320 && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 30;
  lastDown = double ? { t: 0, x: 0, y: 0 } : { t: now, x: e.clientX, y: e.clientY };

  const hit = cellAt(e.clientX, e.clientY);
  if (hit && hit.youngUntil !== undefined && now < hit.youngUntil) {
    // Un recién nacido no revienta: cada toque (simple o doble) lo hace crecer.
    feed(hit);
    lastDown = { t: 0, x: 0, y: 0 };
    if (!cells.includes(hit)) return; // explotó
  } else if (double) {
    // Doble clic: sobre un vertiki lo revienta; en un hueco crea uno nuevo.
    if (hit) pop(hit);
    else spawn(e.clientX, e.clientY);
    return;
  }

  grabbed = cellAt(e.clientX, e.clientY);
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

function release() {
  grabbed = null;
  canvas.classList.remove('is-dragging');
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

// Qué hay bajo el ratón, en cada fotograma (los vertikis se mueven aunque el ratón esté
// quieto): para la sonrisa y el cursor («+» en los huecos, mano encima).
function updateHover() {
  const over = mouseInside ? cellAt(pointer.x, pointer.y) : null;
  hovered = over;
  canvas.classList.toggle('is-over', !!hovered);
}

// =========================================================================================
// Paso 16 · El móvil: la gravedad sigue la inclinación del teléfono
// =========================================================================================

// gamma: inclinación izquierda-derecha; beta: adelante-atrás. Se gira según cómo esté la
// pantalla (vertical u horizontal) y se suaviza para que no tiemble.
let tiltX = 0;
let tiltY = 1;
let tiltListening = false;

function onOrientation(e) {
  if (e.beta === null || e.gamma === null) return;
  const rad = Math.PI / 180;
  let x = Math.sin(e.gamma * rad);
  let y = Math.sin(e.beta * rad);
  // Del aparato a la pantalla, según cómo esté girada.
  const a = (screen.orientation?.angle ?? 0) * rad;
  const sx = x * Math.cos(a) + y * Math.sin(a);
  const sy = -x * Math.sin(a) + y * Math.cos(a);
  x = sx;
  y = sy;
  // Casi plano: poca gravedad. Inclinado del todo, como mucho la normal.
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
// El homenaje: un clic o un toque abre o cierra la captura de yugop.com
// =========================================================================================

const homage = document.querySelector('[data-homage]');
function setHomageOpen(open) {
  homage.classList.toggle('is-open', open);
  homage.setAttribute('aria-expanded', String(open));
}
homage.addEventListener('click', () => setHomageOpen(!homage.classList.contains('is-open')));
document.addEventListener('pointerdown', (e) => {
  if (!homage.contains(e.target)) setHomageOpen(false);
});

// =========================================================================================
// ¡Arrancamos!
// =========================================================================================

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
