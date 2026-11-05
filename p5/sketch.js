// vertikis en p5.js: la versión corta, para leer de un tirón y jugar.
//
// Criaturas blandas que caen, se empujan y se aplastan; se arrastran, se inflan con un toque
// hasta que revientan, y nacen con un doble clic en un hueco. La versión completa (sonido,
// inclinación del móvil, sustos, modo píxel…) es ../vertikis.js, sin librerías.
//
// Funciona tal cual en editor.p5js.org: pega este archivo en sketch.js y dale a ▶.

// --- Los números que mandan (prueba a cambiarlos) ----------------------------------------

let STIFFNESS = 0.45; // cuánto vuelve cada punto a su forma: 0,05 gelatina · 0,9 pelota
let GRAVITY = 0.45; // cuánto tira hacia abajo, en píxeles por paso²
const FRICTION = 0.96; // cuánta velocidad conserva cada punto en cada paso
const SUBSTEPS = 4; // pasos de física por fotograma: más, más estable
const POINTS = 24; // puntos del contorno de cada vertiki

const PALETTE = ['#f29e4c', '#f2c14e', '#4fb3a9', '#ef7aa1', '#6c9bd2', '#9ccc5a', '#4caf72', '#9b86c9', '#f0806c'];
const INK = '#1b1b1b';

let vertikis = [];
let drops = [];
let grabbed = null;
let grabOffset = { x: 0, y: 0 };
let press = null;
let lastPress = { t: -1000, x: 0, y: 0 };

// --- Montaje -----------------------------------------------------------------------------

function setup() {
  const [w, h] = stageSize();
  const canvas = createCanvas(w, h);
  if (select('#stage')) canvas.parent('stage');
  populate();
}

// Toda la ventana o, si la página tiene un #stage, el tamaño de esa caja.
function stageSize() {
  const stage = document.getElementById('stage');
  return stage ? [stage.clientWidth, stage.clientHeight] : [windowWidth, windowHeight];
}

function windowResized() {
  resizeCanvas(...stageSize());
}

// Llena media pantalla de vertikis de tamaños variados, sin que se monten demasiado.
function populate() {
  vertikis = [];
  const unit = min(width, height);
  let area = 0;
  for (let tries = 0; tries < 3000 && area < width * height * 0.45; tries++) {
    const r = unit * random(0.09, 0.2);
    const x = random(r, width - r);
    const y = random(r, height - r);
    if (vertikis.some((v) => dist(v.cx, v.cy, x, y) < (v.r + r) * 0.85)) continue;
    vertikis.push(makeVertiki(x, y, r));
    area += PI * r * r;
  }
}

// --- 1 · Un vertiki es un anillo de puntos -----------------------------------------------

function makeVertiki(x, y, r) {
  const points = [];
  for (let i = 0; i < POINTS; i++) {
    const a = (i / POINTS) * TWO_PI;
    const px = x + cos(a) * r;
    const py = y + sin(a) * r;
    // Cada punto recuerda dónde estaba en el paso anterior: eso es su velocidad.
    points.push({ x: px, y: py, oldX: px, oldY: py });
  }
  return {
    points,
    r, // radio actual
    rest: r, // radio de siempre
    target: r, // radio al que crece (al inflarse o al nacer)
    inflatedAt: 0,
    cx: x,
    cy: y,
    angle: 0,
    color: random(PALETTE),
    blinkAt: millis() + random(1000, 5000),
  };
}

// --- 2 · Física: inercia, forma, choques y bordes ----------------------------------------

function physics() {
  for (const v of vertikis) {
    // Inercia (Verlet): la velocidad es lo que se movió en el paso anterior.
    for (const p of v.points) {
      const f = v === grabbed ? 0.6 : FRICTION;
      const vx = (p.x - p.oldX) * f;
      const vy = (p.y - p.oldY) * f;
      p.oldX = p.x;
      p.oldY = p.y;
      p.x += vx;
      p.y += vy + GRAVITY;
    }

    // Arrastre: todo el anillo se acerca al puntero. Lo que queda de impulso lo lanza.
    if (v === grabbed) {
      const dx = (mouseX - grabOffset.x - v.cx) * 0.35;
      const dy = (mouseY - grabOffset.y - v.cy) * 0.35;
      for (const p of v.points) {
        p.x += dx;
        p.y += dy;
        p.oldX += dx * 0.7;
        p.oldY += dy * 0.7;
      }
    }

    // Recordar la forma («shape matching»): el círculo de reposo, colocado donde está el
    // vertiki y girado como está, y cada punto tira un poco hacia su sitio en ese círculo.
    fitShape(v);
    v.points.forEach((p, i) => {
      const a = (i / POINTS) * TWO_PI + v.angle;
      p.x += (v.cx + cos(a) * v.r - p.x) * STIFFNESS;
      p.y += (v.cy + sin(a) * v.r - p.y) * STIFFNESS;
    });
  }

  // Choques, 1: cada punto que entra en otro vertiki (visto como un círculo) sale hacia
  // fuera. Por eso se aplastan justo por donde se tocan.
  for (const a of vertikis) {
    for (const b of vertikis) {
      if (a === b || dist(a.cx, a.cy, b.cx, b.cy) > a.r + b.r) continue;
      const R = b.r * 0.96;
      for (const p of a.points) {
        const d = dist(p.x, p.y, b.cx, b.cy);
        if (d >= R || d === 0) continue;
        const push = (R - d) * 0.5;
        p.x += ((p.x - b.cx) / d) * push;
        p.y += ((p.y - b.cy) / d) * push;
      }
    }
  }

  // Choques, 2: si dos centros están demasiado cerca, los vertikis se apartan enteros,
  // cada uno según lo que pesa (su superficie; el agarrado, más, para poder empujar).
  for (let i = 0; i < vertikis.length; i++) {
    for (let j = i + 1; j < vertikis.length; j++) {
      const a = vertikis[i];
      const b = vertikis[j];
      const d = max(0.01, dist(a.cx, a.cy, b.cx, b.cy));
      const minD = (a.r + b.r) * 0.88;
      if (d >= minD) continue;
      const nx = (b.cx - a.cx) / d;
      const ny = (b.cy - a.cy) / d;
      const ma = a.r * a.r * (a === grabbed ? 6 : 1);
      const mb = b.r * b.r * (b === grabbed ? 6 : 1);
      const push = (minD - d) * 0.5;
      shift(a, -nx * push * (mb / (ma + mb)), -ny * push * (mb / (ma + mb)));
      shift(b, nx * push * (ma / (ma + mb)), ny * push * (ma / (ma + mb)));
    }
  }

  // Bordes: ningún punto sale del lienzo, y al rozar un borde se frena.
  for (const v of vertikis) {
    for (const p of v.points) {
      if (p.x < 0 || p.x > width) {
        p.x = constrain(p.x, 0, width);
        p.oldY = p.y - (p.y - p.oldY) * 0.6;
      }
      if (p.y < 0 || p.y > height) {
        p.y = constrain(p.y, 0, height);
        p.oldX = p.x - (p.x - p.oldX) * 0.6;
      }
    }
  }
}

// Dónde está el vertiki (la media de sus puntos) y cuánto ha girado (el ángulo con el que
// el círculo de reposo encaja mejor con los puntos de ahora).
function fitShape(v) {
  v.cx = v.points.reduce((s, p) => s + p.x, 0) / POINTS;
  v.cy = v.points.reduce((s, p) => s + p.y, 0) / POINTS;
  let dot = 0;
  let cross = 0;
  v.points.forEach((p, i) => {
    const a = (i / POINTS) * TWO_PI;
    const rx = p.x - v.cx;
    const ry = p.y - v.cy;
    dot += cos(a) * rx + sin(a) * ry;
    cross += cos(a) * ry - sin(a) * rx;
  });
  v.angle = atan2(cross, dot);
}

// Mueve un vertiki entero casi sin darle velocidad (por eso se mueve también «old»).
function shift(v, dx, dy) {
  for (const p of v.points) {
    p.x += dx;
    p.y += dy;
    p.oldX += dx * 0.8;
    p.oldY += dy * 0.8;
  }
  v.cx += dx;
  v.cy += dy;
}

// --- 3 · Dibujar -------------------------------------------------------------------------

function draw() {
  background(255);

  for (const v of vertikis) {
    // Crece rápido hacia su objetivo; si nadie lo toca en 1,2 s, se desinfla despacio.
    if (v.target > v.r + 0.5) v.r = lerp(v.r, v.target, 0.2);
    else if (v.r > v.rest && millis() - v.inflatedAt > 1200) v.target = v.r = lerp(v.r, v.rest, 0.003);
  }
  for (let s = 0; s < SUBSTEPS; s++) physics();

  noStroke();
  for (const v of vertikis) {
    fill(v.color);
    beginShape();
    for (const p of v.points) splineVertex(p.x, p.y);
    endShape(CLOSE);
    drawFace(v);
  }

  // Gotas de los que revientan: caen y se encogen.
  noStroke();
  for (const d of drops) {
    d.vy += 0.35;
    d.x += d.vx;
    d.y += d.vy;
    d.life -= 0.025;
    fill(d.color);
    circle(d.x, d.y, d.size * d.life);
  }
  drops = drops.filter((d) => d.life > 0);

  cursor(grabbed ? 'grabbing' : vertikiAt(mouseX, mouseY) ? 'grab' : 'crosshair');
}

// La cara: dos ojos que miran al puntero y parpadean, y una sonrisa. Se inclina con el
// cuerpo, pero solo un tercio, para no quedar nunca boca abajo.
function drawFace(v) {
  const s = v.r;
  push();
  translate(v.cx, v.cy);
  rotate(atan2(sin(v.angle), cos(v.angle)) * 0.35);

  const look = createVector(mouseX - v.cx, mouseY - v.cy).setMag(s * 0.035);
  const t = (millis() - v.blinkAt) / 130;
  if (t > 1) v.blinkAt = millis() + random(2000, 6000);
  const open = t >= 0 && t <= 1 ? abs(1 - 2 * t) : 1;
  const eye = max(2, s * 0.072);
  fill(INK);
  ellipse(-s * 0.22 + look.x, -s * 0.12 + look.y, eye, max(0.8, eye * open));
  ellipse(s * 0.22 + look.x, -s * 0.12 + look.y, eye, max(0.8, eye * open));

  noFill();
  stroke(INK);
  strokeWeight(max(1, s * 0.032));
  const happy = v === grabbed || v === vertikiAt(mouseX, mouseY);
  arc(0, s * 0.04, s * 0.32, s * (happy ? 0.26 : 0.14), 0.15 * PI, 0.85 * PI);
  pop();
}

// --- 4 · Tocar, arrastrar, inflar, reventar y nacer ---------------------------------------

function vertikiAt(x, y) {
  for (let k = vertikis.length - 1; k >= 0; k--) {
    if (dist(x, y, vertikis[k].cx, vertikis[k].cy) <= vertikis[k].r) return vertikis[k];
  }
  return null;
}

function mousePressed() {
  // Solo dentro del lienzo (en una página con más cosas, los clics de fuera no cuentan).
  if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;

  // Doble clic (o doble toque) en un hueco: nace un vertiki.
  const double = millis() - lastPress.t < 320 && dist(mouseX, mouseY, lastPress.x, lastPress.y) < 30;
  lastPress = double ? { t: -1000, x: 0, y: 0 } : { t: millis(), x: mouseX, y: mouseY };
  if (double && !vertikiAt(mouseX, mouseY)) {
    const v = makeVertiki(mouseX, mouseY, 4);
    v.target = v.rest = min(width, height) * random(0.07, 0.2);
    vertikis.push(v);
    return;
  }

  grabbed = vertikiAt(mouseX, mouseY);
  if (!grabbed) return;
  press = { t: millis(), x: mouseX, y: mouseY };
  grabOffset = { x: mouseX - grabbed.cx, y: mouseY - grabbed.cy };
  // El agarrado se dibuja encima de los demás.
  vertikis = vertikis.filter((v) => v !== grabbed).concat(grabbed);
}

function mouseReleased() {
  // Un toque (corto y sin moverse) lo infla un 15 %; si se pasa de tamaño, revienta.
  if (press && millis() - press.t < 250 && dist(mouseX, mouseY, press.x, press.y) < 10) {
    const next = grabbed.target * 1.15;
    if (next > min(width, height) * 0.34) burst(grabbed);
    else {
      grabbed.target = next;
      grabbed.inflatedAt = millis();
    }
  }
  grabbed = null;
  press = null;
}

function burst(v) {
  vertikis = vertikis.filter((k) => k !== v);
  for (let i = 0; i < 10 + v.r / 8; i++) {
    const a = random(TWO_PI);
    const speed = random(3, 9);
    drops.push({
      x: v.cx + cos(a) * v.r * 0.8,
      y: v.cy + sin(a) * v.r * 0.8,
      vx: cos(a) * speed,
      vy: sin(a) * speed - 2,
      size: random(4, 4 + v.r / 7),
      life: 1,
      color: v.color,
    });
  }
}
