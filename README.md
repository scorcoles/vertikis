# vertikis

**Español** · [English](README.en.md)

Criaturas blandas de colores, con cara, que caen, se empujan, se aplastan al chocar y se pueden arrastrar, inflar hasta que exploten y crear. Todo con un `<canvas>`, JavaScript normal y sin librerías.

**Demo:** [scorcoles.github.io/vertikis](https://scorcoles.github.io/vertikis/) · también en [vertik.net/vertikis](https://www.vertik.net/vertikis/)

- **Arrastra** un vertiki para moverlo y lanzarlo.
- **Toca** un vertiki: se infla un 15 %. Si se pasa de tamaño, **explota**. Si lo dejas tranquilo, se desinfla poco a poco.
- **Doble clic en un hueco** (o doble toque): nace uno nuevo.
- **En el móvil**, inclina el teléfono: la gravedad sigue la inclinación.

Un experimento de [VERTIK](https://www.vertik.net). Homenaje a la home de yugop.com (Yugo Nakamura, 2005).

Y un **tutorial paso a paso** para aprender a hacerlo desde cero, con una página que funciona por cada paso: [empieza aquí](#tutorial).

---

## Cómo ejecutarlo

No hay nada que instalar. Descarga el repo y **abre `index.html` con doble clic**. Ya está.

Si prefieres servirlo (para probarlo en el móvil por la red de casa, por ejemplo), desde la carpeta del proyecto:

```bash
python3 -m http.server 8000
# y abre http://localhost:8000
```

Lo que hay en el repo:

| Archivo | Qué es |
| --- | --- |
| `index.html` | La página: un `<canvas>` y el pie con los créditos. |
| `style.css` | Que el canvas ocupe toda la ventana, el cursor y el pie. |
| `vertikis.js` | Todo lo demás. Sus secciones llevan el número del paso del tutorial que las explica. |
| `steps/es/` · `steps/en/` | Una página por paso del tutorial (`01.html` … `16.html`), en español y en inglés. Cada una se abre con doble clic y funciona sola. |
| `src/` · `tools/` | Solo para quien cambie el código: ver [Para quien mantenga el repo](#para-quien-mantenga-el-repo). |

---

<a id="tutorial"></a>

# Tutorial: cómo se hacen los vertikis, paso a paso

Este tutorial está pensado para alguien que sabe poco de programación. Vamos despacio: cada paso añade **una sola idea**. Al final de cada paso te digo qué deberías ver si lo pruebas.

**Cada paso tiene su página**, con el código completo hasta ese momento: ábrela para ver cómo va quedando, y mira su código (botón derecho → «Ver código fuente», o ábrela en tu editor) para ver exactamente qué ha cambiado respecto al paso anterior. Están en [`steps/es/`](steps/es/), y en vivo en `scorcoles.github.io/vertikis/steps/es/01.html`, `02.html`…

Un consejo antes de empezar: no hace falta entender todas las matemáticas. Casi todo son sumas, restas y multiplicaciones. Cuando aparezca algo más raro (un seno, un coseno), te explico para qué sirve y puedes usarlo como una caja negra.

**Índice**

1. [El escenario: un canvas](#paso-1)
2. [El bucle: dibujar 60 veces por segundo](#paso-2)
3. [El objeto vertiki: un anillo de puntos](#paso-3)
4. [Moverse: inercia, fricción y gravedad](#paso-4)
5. [Los límites: que no se salgan de la pantalla](#paso-5)
6. [Mantener la forma: el truco del «shape matching»](#paso-6)
7. [Muchos vertikis](#paso-7)
8. [Choques entre vertikis](#paso-8)
9. [Subpasos: física más estable](#paso-9)
10. [Color y un poco de luz](#paso-10)
11. [El puntero: arrastrar y lanzar](#paso-11)
12. [La cara](#paso-12)
13. [Inflar y explotar](#paso-13)
14. [Nacer](#paso-14)
15. [El sonido, sin archivos de audio](#paso-15)
16. [El móvil: inclinar el teléfono](#paso-16)
17. [Ideas para seguir jugando](#paso-17)

---

<a id="paso-1"></a>

## Paso 1 · El escenario: un canvas

▶ **Este paso funcionando:** [demo](https://scorcoles.github.io/vertikis/steps/es/01.html) · [código](steps/es/01.html)

### Qué queremos

Una hoja en blanco que ocupe toda la ventana, donde podamos dibujar lo que queramos con código.

### La idea

Un `<canvas>` es eso: un rectángulo de píxeles en el que dibujas desde JavaScript, como si tuvieras un pincel. No hay «objetos» dentro: si dibujas un círculo, el canvas solo recuerda los píxeles pintados. Para moverlo, hay que **borrar y volver a dibujar** (lo veremos en el paso 2).

### El código

En el HTML, solo esto:

```html
<canvas data-cells></canvas>
<script src="vertikis.js"></script>
```

En el CSS hacemos que ocupe toda la ventana y quitamos el scroll:

```css
html, body { margin: 0; height: 100%; overflow: hidden; background: #fff; }
canvas     { position: fixed; inset: 0; width: 100%; height: 100%; touch-action: none; }
```

`touch-action: none` es importante en el móvil: sin él, al arrastrar un dedo por el canvas la página haría scroll o zoom en vez de dejarnos mover los vertikis.

En JavaScript cogemos el canvas y su «pincel», que se llama **contexto**:

```js
const canvas = document.querySelector('[data-cells]');
const ctx = canvas.getContext('2d');
```

### El detalle de las pantallas retina

Un canvas tiene **dos tamaños**: el que ocupa en la página (lo pone el CSS) y cuántos píxeles tiene por dentro (`canvas.width` y `canvas.height`). Si no coinciden, se ve borroso.

En pantallas retina cada «píxel CSS» son 2 píxeles reales. Así que hacemos el canvas por dentro el doble de grande y le decimos al pincel que multiplique todo por 2. Así seguimos pensando en píxeles CSS normales y se ve nítido:

```js
let W = 0;
let H = 0;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // 1 o 2
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // «multiplica todo por dpr»
}

window.addEventListener('resize', resize);
resize();
```

`W` y `H` son el ancho y el alto del escenario. Los usaremos todo el rato.

### Pruébalo

Añade al final:

```js
ctx.fillStyle = 'tomato';
ctx.beginPath();
ctx.arc(200, 200, 80, 0, Math.PI * 2); // círculo en (200, 200) de radio 80
ctx.fill();
```

Deberías ver un círculo rojo. En el canvas, **x** crece hacia la derecha y **y** crece **hacia abajo** (al revés que en el cole). El punto (0, 0) es la esquina de arriba a la izquierda.

---

<a id="paso-2"></a>

## Paso 2 · El bucle: dibujar 60 veces por segundo

▶ **Este paso funcionando:** [demo](https://scorcoles.github.io/vertikis/steps/es/02.html) · [código](steps/es/02.html)

### Qué queremos

Que las cosas se muevan.

### La idea

Una animación es una sucesión de dibujos fijos, como un flipbook. En cada «fotograma»:

1. calculamos dónde está cada cosa ahora,
2. borramos el canvas,
3. lo dibujamos todo otra vez.

El navegador nos avisa cuando es buen momento para dibujar el siguiente fotograma con `requestAnimationFrame` (normalmente unas 60 veces por segundo):

```js
function frame() {
  // 1. calcular  (lo llenaremos en los pasos siguientes)
  // 2 y 3. borrar y dibujar
  draw();
  requestAnimationFrame(frame); // «llámame otra vez en el próximo fotograma»
}

requestAnimationFrame(frame);
```

Y `draw()` empieza siempre borrando:

```js
function draw() {
  ctx.clearRect(0, 0, W, H);
  // … dibujar todo …
}
```

### Pruébalo

```js
let x = 0;
function frame() {
  x += 2;                         // cada fotograma, 2 píxeles más a la derecha
  ctx.clearRect(0, 0, W, H);
  ctx.beginPath();
  ctx.arc(x, 200, 80, 0, Math.PI * 2);
  ctx.fill();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

El círculo cruza la pantalla. Prueba a quitar el `clearRect`: verás que deja rastro, porque el canvas nunca «olvida» lo que pintaste.

---

<a id="paso-3"></a>

## Paso 3 · El objeto vertiki: un anillo de puntos

▶ **Este paso funcionando:** [demo](https://scorcoles.github.io/vertikis/steps/es/03.html) · [código](steps/es/03.html)

### Qué queremos

Algo que parezca un círculo pero que se pueda **deformar**, como un globo de agua.

### La idea

Un círculo dibujado con `arc` es rígido: siempre es un círculo perfecto. Así que hacemos trampa: un vertiki es un **anillo de 28 puntos** colocados en círculo. Si movemos los puntos, cambia la forma. Luego dibujamos una curva suave que pase por ellos.

```
        ·  ·  ·
     ·           ·
    ·      +      ·     ← 28 puntos alrededor de un centro (+)
     ·           ·
        ·  ·  ·
```

### Colocar puntos en círculo

Aquí aparecen el coseno y el seno. Para lo que nos importa: si das una vuelta completa a un círculo de radio 1, en el ángulo `a` estás en el punto `(cos(a), sin(a))`. Eso es todo.

Calculamos una vez el «círculo de radio 1» (lo llamamos `UNIT`) y luego cada vertiki lo multiplica por su radio:

```js
const POINTS = 28;
const UNIT = new Float32Array(POINTS * 2); // [x0, y0, x1, y1, …]
for (let i = 0; i < POINTS; i++) {
  const a = (i / POINTS) * Math.PI * 2;    // ángulo de este punto (una vuelta = 2π)
  UNIT[i * 2] = Math.cos(a);
  UNIT[i * 2 + 1] = Math.sin(a);
}
```

`Float32Array` es como un array normal pero solo de números, y más rápido. No te preocupes por él: úsalo como un array.

### El objeto

Cada vertiki es un objeto de JavaScript con su radio y las posiciones de sus puntos. Esta es la versión mínima (en los pasos siguientes le iremos añadiendo cosas):

```js
function makeCell(cx, cy, r) {
  const x = new Float32Array(POINTS);
  const y = new Float32Array(POINTS);
  for (let i = 0; i < POINTS; i++) {
    x[i] = cx + UNIT[i * 2] * r;
    y[i] = cy + UNIT[i * 2 + 1] * r;
  }
  return { r, x, y, px: x.slice(), py: y.slice(), cx, cy };
}
```

Guardamos las `x` en un array y las `y` en otro. `px` y `py` son una copia: «dónde estaba cada punto antes». Las usaremos en el paso 4.

### Dibujar un contorno suave

Si unimos los puntos con líneas rectas sale un polígono de 28 lados. Para que sea redondo usamos un truco clásico: dibujamos curvas que **pasan por el punto medio entre dos puntos** y usan el propio punto como «imán» de la curva (`quadraticCurveTo`):

```js
ctx.beginPath();
ctx.moveTo((c.x[POINTS - 1] + c.x[0]) / 2, (c.y[POINTS - 1] + c.y[0]) / 2);
for (let i = 0; i < POINTS; i++) {
  const j = (i + 1) % POINTS; // el siguiente punto (después del último, vuelve al 0)
  ctx.quadraticCurveTo(c.x[i], c.y[i], (c.x[i] + c.x[j]) / 2, (c.y[i] + c.y[j]) / 2);
}
ctx.fill();
```

### Pruébalo

En la página del paso 3 verás un círculo gris con sus 28 puntos marcados. Prueba a añadir `cells[0].x[0] += 60` en la consola del navegador: le sale un bulto. Ya tenemos algo deformable.

---

<a id="paso-4"></a>

## Paso 4 · Moverse: inercia, fricción y gravedad

▶ **Este paso funcionando:** [demo](https://scorcoles.github.io/vertikis/steps/es/04.html) · [código](steps/es/04.html)

### Qué queremos

Que los puntos se muevan solos, como cosas reales: que caigan, que tengan impulso y que se frenen.

### La idea: Verlet

Normalmente, para mover algo guardas su posición y su velocidad. Hay un método más sencillo y más estable, que se llama **integración de Verlet**: no guardas la velocidad. Guardas **dónde estaba antes** (`px`, `py`) y **dónde está ahora** (`x`, `y`). La velocidad es la diferencia:

```
velocidad = ahora − antes
```

En cada paso:

1. calculas la velocidad (`ahora − antes`),
2. la multiplicas por algo menor que 1 (eso es la **fricción**: se va frenando),
3. apuntas que «antes» es «ahora»,
4. mueves el punto: `ahora += velocidad + gravedad`.

```js
const FRICTION = 0.96; // conserva el 96 % de la velocidad en cada paso
const GRAVITY = 0.45;  // empujón hacia abajo en cada paso

for (let i = 0; i < POINTS; i++) {
  const vx = (c.x[i] - c.px[i]) * FRICTION;
  const vy = (c.y[i] - c.py[i]) * FRICTION;
  c.px[i] = c.x[i];
  c.py[i] = c.y[i];
  c.x[i] += vx;
  c.y[i] += vy + GRAVITY;
}
```

La gravedad es solo un **empujoncito hacia abajo** en cada paso. Como se acumula, las cosas caen cada vez más rápido. Como la fricción frena, no aceleran para siempre.

La gran ventaja de Verlet: si mueves un punto «a mano» (porque choca, o porque lo arrastras), la velocidad se ajusta sola, porque se calcula a partir de las posiciones.

### Pruébalo

Pon este bucle dentro de `frame()`, antes de `draw()`. El vertiki cae… y se sale por abajo de la pantalla. Lo arreglamos ya mismo.

---

<a id="paso-5"></a>

## Paso 5 · Los límites: que no se salgan de la pantalla

▶ **Este paso funcionando:** [demo](https://scorcoles.github.io/vertikis/steps/es/05.html) · [código](steps/es/05.html)

### Qué queremos

Que la ventana sea una caja: suelo, techo y paredes.

### La idea

Después de mover los puntos, miramos cada uno. Si se ha salido, lo devolvemos al borde. Fácil:

```js
for (let i = 0; i < POINTS; i++) {
  if (c.x[i] < 0) c.x[i] = 0;
  if (c.x[i] > W) c.x[i] = W;
  if (c.y[i] < 0) c.y[i] = 0;
  if (c.y[i] > H) c.y[i] = H;
}
```

### Un poco de rozamiento

Con solo eso, un vertiki que cae al suelo resbala como sobre hielo. Para que se frene al tocar el suelo, reducimos su velocidad **a lo largo del borde**. Con Verlet se hace acercando la posición «antes» a la de «ahora» (recuerda: la velocidad es la diferencia entre las dos):

```js
if (c.y[i] < 0 || c.y[i] > H) {
  c.y[i] = c.y[i] < 0 ? 0 : H;
  c.px[i] = c.x[i] - (c.x[i] - c.px[i]) * 0.6; // conserva solo el 60 % del deslizamiento
}
```

Lo hacemos en los cuatro bordes, porque en el móvil, al inclinarlo, cualquier borde puede hacer de suelo (paso 16).

### Pruébalo

El vertiki cae y se queda en el suelo. Pero… se queda **aplastado como una tortilla**: los puntos de abajo se paran en el suelo y los de arriba siguen cayendo sobre ellos. Nada le dice que tiene que ser redondo. Ese es el paso más importante, el siguiente.

---

<a id="paso-6"></a>

## Paso 6 · Mantener la forma: el truco del «shape matching»

▶ **Este paso funcionando:** [demo](https://scorcoles.github.io/vertikis/steps/es/06.html) · [código](steps/es/06.html)

### Qué queremos

Que el vertiki se deforme al chocar, pero que **siempre intente volver a ser redondo**, como un globo de agua.

### La idea

En cada paso hacemos tres cosas:

1. **¿Dónde está?** Calculamos su centro: la media de todos sus puntos.
2. **¿Cuánto ha girado?** Si ha rodado, la forma de reposo debe estar girada igual (si no, al rodar se «desenroscaría»).
3. **Tirar hacia la forma ideal.** Colocamos la forma de reposo (el círculo de su radio) en ese centro y con ese giro, y movemos cada punto **un poco** hacia donde debería estar.

```
   forma actual (aplastada)          forma ideal en el mismo centro
        _______                              .-~~~-.
      /         \          →               /         \
     |_____+_____|                        |     +     |
                                           \         /
                                             '-...-'
   cada punto da un pasito hacia su sitio en la forma ideal
```

Esta técnica se llama **shape matching** («encajar la forma»).

### 1. El centro

```js
let sx = 0, sy = 0;
for (let i = 0; i < POINTS; i++) { sx += c.x[i]; sy += c.y[i]; }
c.cx = sx / POINTS;
c.cy = sy / POINTS;
```

### 2. El giro

Esta es la parte más matemática de todo el proyecto. La idea, sin fórmulas: comparamos cada punto con su gemelo de la forma de reposo y sumamos «cuánto se parecen» (`dot`) y «cuánto están girados uno respecto al otro» (`cross`). `Math.atan2(cross, dot)` convierte esas dos sumas en el ángulo de giro que mejor encaja.

```js
let dot = 0, cross = 0;
for (let i = 0; i < POINTS; i++) {
  const qx = UNIT[i * 2] * c.r;        // dónde está el punto en la forma de reposo
  const qy = UNIT[i * 2 + 1] * c.r;
  const rx = c.x[i] - c.cx;            // dónde está ahora, respecto al centro
  const ry = c.y[i] - c.cy;
  dot += qx * rx + qy * ry;
  cross += qx * ry - qy * rx;
}
c.angle = Math.atan2(cross, dot);
```

Si esto se te atraganta, no pasa nada: puedes tratarlo como una función que te devuelve «cuánto ha girado el vertiki». Está en `fitShape()`.

### 3. Tirar hacia la forma

Para girar un punto `(qx, qy)` un ángulo, se usa esta receta (también caja negra si quieres): `x' = qx·cos − qy·sin` y `y' = qx·sin + qy·cos`.

```js
const STIFFNESS = 0.45; // cuánto se acerca cada punto a su sitio en cada paso
const cos = Math.cos(c.angle);
const sin = Math.sin(c.angle);
for (let i = 0; i < POINTS; i++) {
  const qx = UNIT[i * 2] * c.r;
  const qy = UNIT[i * 2 + 1] * c.r;
  const gx = c.cx + qx * cos - qy * sin; // el sitio ideal de este punto
  const gy = c.cy + qx * sin + qy * cos;
  c.x[i] += (gx - c.x[i]) * STIFFNESS;   // un 45 % del camino
  c.y[i] += (gy - c.y[i]) * STIFFNESS;
}
```

`STIFFNESS` es **lo firme** que es el vertiki. Juega con él:

- `0.05`: gelatina, se queda deformado mucho rato.
- `0.45`: lo que usamos, blando pero firme.
- `1`: rígido como una bola de billar.

### Pruébalo

Ahora el vertiki cae, se aplasta un poquito contra el suelo, rebota levemente y se queda redondito apoyado. Es el corazón de todo el proyecto: el resto son detalles.

---

<a id="paso-7"></a>

## Paso 7 · Muchos vertikis

▶ **Este paso funcionando:** [demo](https://scorcoles.github.io/vertikis/steps/es/07.html) · [código](steps/es/07.html)

### Qué queremos

Llenar la pantalla.

### La idea

Guardamos todos en un array `cells` («células», como los llamábamos al empezar) y en la física y el dibujo hacemos `for (const c of cells) { … }`.

Para el reparto inicial (`populate()`), probamos posiciones y tamaños al azar hasta cubrir más o menos **la mitad de la pantalla**. Si un vertiki nuevo cae demasiado encima de otro, descartamos esa posición y probamos otra:

```js
function populate() {
  cells = [];
  const unit = Math.min(W, H);   // el lado corto de la pantalla
  const target = W * H * 0.5;    // queremos cubrir la mitad
  let area = 0;
  for (let tries = 0; tries < 6000 && area < target; tries++) {
    const r = unit * (0.09 + Math.random() ** 1.3 * 0.12);
    const cx = r * 0.6 + Math.random() * (W - r * 1.2);
    const cy = r * 0.6 + Math.random() * (H - r * 1.2);
    if (cells.some((c) => Math.hypot(c.cx - cx, c.cy - cy) < (c.r + r) * 0.82)) continue;
    cells.push(makeCell(cx, cy, r));
    area += Math.PI * r * r;
  }
}
```

Algunos trucos:

- Los tamaños dependen del **lado corto de la pantalla**, así se ven bien en un móvil y en un monitor grande.
- `Math.random() ** 1.3` da más números pequeños que grandes: hay más vertikis medianos que gigantes.
- `Math.hypot(dx, dy)` es la distancia entre dos puntos (Pitágoras).
- Ese `0.82` deja que se **monten un poco** al principio. Así, al arrancar, se empujan y quedan apretados, que es más bonito.

### Pruébalo

Ves muchos vertikis cayendo… y **atravesándose** unos a otros como fantasmas. Nadie les ha dicho que choquen.

---

<a id="paso-8"></a>

## Paso 8 · Choques entre vertikis

▶ **Este paso funcionando:** [demo](https://scorcoles.github.io/vertikis/steps/es/08.html) · [código](steps/es/08.html)

### Qué queremos

Que se empujen, se apilen y se aplasten un poco donde se tocan.

### La idea, en dos partes

**8a · Choque por puntos.** Para cada punto de un vertiki A, miramos si está dentro de otro vertiki B (lo tratamos como un círculo, que es más fácil). Si lo está, lo sacamos hacia fuera, en la dirección que va del centro de B al punto:

```js
const R = B.r * 0.96;
for (let i = 0; i < POINTS; i++) {
  const dx = A.x[i] - B.cx;
  const dy = A.y[i] - B.cy;
  const d = Math.hypot(dx, dy);            // distancia del punto al centro de B
  if (d >= R || d === 0) continue;         // fuera de B: nada que hacer
  const push = (R - d) * 0.5;              // cuánto se ha metido (la mitad, para ir suave)
  A.x[i] += (dx / d) * push;               // (dx/d, dy/d) es la dirección «hacia fuera»
  A.y[i] += (dy / d) * push;
}
```

Como solo se mueven los puntos que se meten, **se aplanan por la zona de contacto**, como dos globos apretados. Y luego el paso 6 intenta redondearlos de nuevo. Ese tira y afloja es lo que les da el aspecto blando.

Para no comparar cada punto con todos los vertikis de la pantalla (lento), primero miramos si los dos vertikis están cerca. Si no, nos saltamos la pareja.

**8b · Separación de vertikis enteros.** Con solo 8a, si uno pequeño cae muy rápido sobre uno grande, a veces se le mete dentro y se queda ahí. Así que añadimos una regla más bruta: si **dos centros** están más cerca de lo que permiten sus tamaños, apartamos los dos vertikis enteros, cada uno hacia su lado.

- Dejamos un 12 % de margen (`(A.r + B.r) * 0.88`) para que se sigan aplastando en el contacto.
- **Pesan según su tamaño**: el grande se mueve poco y el pequeño mucho.
- Desde el paso 11, el que llevas arrastrado pesa 6 veces más, para que puedas apartar a los demás con él.

### Pruébalo

Ya se apilan como una montaña de globos de agua, aplastados donde se tocan.

---

<a id="paso-9"></a>

## Paso 9 · Subpasos: física más estable

▶ **Este paso funcionando:** [demo](https://scorcoles.github.io/vertikis/steps/es/09.html) · [código](steps/es/09.html)

### Qué queremos

Que no tiemblen ni se atraviesen cuando van rápido.

### La idea

Si algo va muy rápido, en un solo paso puede atravesar a otro sin «verlo». La solución es sencilla: en cada fotograma hacemos **4 pasos pequeños de física** en vez de uno grande.

```js
const SUBSTEPS = 4;
for (let s = 0; s < SUBSTEPS; s++) step();
draw();
```

Toda la física (pasos 4, 5, 6 y 8) va dentro de `step()`. Cuesta 4 veces más calcularla, pero con unas decenas de vertikis va sobrada.

---

<a id="paso-10"></a>

## Paso 10 · Color y un poco de luz

▶ **Este paso funcionando:** [demo](https://scorcoles.github.io/vertikis/steps/es/10.html) · [código](steps/es/10.html)

### Qué queremos

Colores alegres y un pelín de volumen, sin que parezcan de plástico.

### La idea

Una paleta de colores planos, algo apagados, y cada vertiki coge uno al azar:

```js
const PALETTE = ['#f29e4c', '#f2c14e', '#4fb3a9', '#ef7aa1', '#6c9bd2', '#9ccc5a', '#4caf72', '#9b86c9', '#f0806c'];
```

Para dar volumen, rellenamos con un **degradado radial muy suave**: un poco más claro arriba a la izquierda (como si la luz viniera de ahí) y un poco más oscuro en el borde contrario. La función `tint()` mezcla un color con blanco (para el claro) o con negro (para el oscuro).

```js
const g = ctx.createRadialGradient(
  c.cx - c.r * 0.35, c.cy - c.r * 0.4, c.r * 0.05, // círculo pequeño: donde da la luz
  c.cx, c.cy, c.r * 1.25                            // círculo grande: hasta el borde
);
g.addColorStop(0, c.light);
g.addColorStop(0.55, c.color);
g.addColorStop(1, c.shade);
ctx.fillStyle = g;
```

El truco está en que sea **muy poco**: apenas un 16 % hacia el blanco y un 6 % hacia el negro. Si te pasas, parecen bolas de Navidad.

### Un toque orgánico

Un círculo perfecto queda muy de ordenador. A partir de este paso, la forma de reposo está **un poquito ovalada** (entre un 2 % y un 6 %, el valor `e`) y girada al azar. Apenas se nota, pero hace que parezcan vivos. Por eso, desde aquí, `makeCell`, `fitShape` y `step` multiplican el radio por `(1 + e)` en un eje y por `(1 − e)` en el otro.


---

<a id="paso-11"></a>

## Paso 11 · El puntero: arrastrar y lanzar

▶ **Este paso funcionando:** [demo](https://scorcoles.github.io/vertikis/steps/es/11.html) · [código](steps/es/11.html)

### Eventos de puntero

Usamos los **pointer events** (`pointerdown`, `pointermove`, `pointerup`), que funcionan igual con ratón, dedo o lápiz. Así escribimos el código una sola vez para escritorio y móvil.

### ¿Qué vertiki hay aquí?

```js
function cellAt(x, y) {
  for (let k = cells.length - 1; k >= 0; k--) {     // del último al primero
    const c = cells[k];
    if (Math.hypot(x - c.cx, y - c.cy) <= c.r) return c;
  }
  return null;
}
```

Recorremos al revés porque los últimos se dibujan encima: si dos se solapan, gana el de arriba.

### Arrastrar

Al pulsar sobre un vertiki lo guardamos en `grabbed`, y en cada paso de física lo **acercamos al puntero** (un 35 % del camino). El truco fino: también movemos su posición «antes» casi lo mismo. Así no acumula velocidad mientras lo arrastras (si no, temblaría), pero conserva un 30 % de impulso: **al soltarlo sale lanzado** en la dirección en que lo movías.

```js
const dx = (pointer.x - grabOffset.x - c.cx) * 0.35;
const dy = (pointer.y - grabOffset.y - c.cy) * 0.35;
for (let i = 0; i < POINTS; i++) {
  c.x[i] += dx;
  c.y[i] += dy;
  c.px[i] += dx * 0.7; // «antes» se mueve el 70 %: queda un 30 % de velocidad
  c.py[i] += dy * 0.7;
}
```

`grabOffset` recuerda **dónde lo cogiste** (por el borde o por el centro), para que no dé un salto.

Otros detalles: mientras lo arrastras se frena más (fricción 0.6) para que no oscile, pasa a dibujarse encima de todos y usamos `setPointerCapture` para seguir recibiendo el movimiento aunque el puntero salga del canvas.

### El cursor

En CSS ponemos una mano encima de un vertiki (y, desde el paso 14, un «+» en los huecos, porque ahí un doble clic crea uno). En cada fotograma miramos qué hay bajo el ratón (`updateHover()`), porque los vertikis se mueven aunque el ratón esté quieto, y ponemos o quitamos una clase en el canvas. Ese mismo `hovered` lo usará la sonrisa en el paso siguiente.

---

<a id="paso-12"></a>

## Paso 12 · La cara

▶ **Este paso funcionando:** [demo](https://scorcoles.github.io/vertikis/steps/es/12.html) · [código](steps/es/12.html)

Esta es la parte que les da personalidad. La cara son tres trazos (dos ojos y una boca), pero con varios detalles que los hacen sentir vivos.

### Dibujar en el «espacio» del vertiki

Para no tener que calcular dónde cae cada ojo en la pantalla, movemos el pincel al centro del vertiki y dibujamos ahí, como si su centro fuera el (0, 0):

```js
ctx.save();                 // guarda el estado del pincel
ctx.translate(c.cx, c.cy);  // ahora (0, 0) es el centro del vertiki
// … dibujar ojos y boca …
ctx.restore();              // vuelve a como estaba
```

Todo se mide **en proporción al radio** (`s = c.r`): el ojo está a `s * 0.22` del centro. Así un vertiki grande tiene la cara grande y uno pequeño, pequeña.

### Que gire, pero poco

Si la cara girase igual que el cuerpo, al rodar se quedaría boca abajo. Si no girase nada, parecería pegada encima. Hacemos que gire **un 35 %** de lo que gira el cuerpo, contando desde el giro con el que nació (`c.base`):

```js
const turned = Math.atan2(Math.sin(c.angle - c.base), Math.cos(c.angle - c.base));
ctx.rotate(turned * 0.35);
```

(Ese `atan2(sin, cos)` es solo una forma de que el ángulo quede entre −180° y 180°.)

### Los ojos miran al puntero

Calculamos la dirección del vertiki al ratón y desplazamos los ojos un poquito hacia allí (como mucho un 3,5 % del radio). Para que no salten, se **acercan poco a poco** a donde deben mirar:

```js
c.lookX += (lx - c.lookX) * 0.15; // cada fotograma, un 15 % del camino
```

Este patrón, `valor += (objetivo − valor) * 0.15`, sale muchas veces en el proyecto. Es la forma más sencilla de **suavizar** cualquier cosa: se acerca rápido al principio y despacio al final.

### Parpadean

Cada vertiki apunta cuándo le toca parpadear (`blinkAt`). Durante 130 ms el ojo se aplasta en vertical y vuelve a abrirse. Luego elige el siguiente parpadeo entre 2 y 6 segundos más tarde (y a veces, un 20 %, hace un doble parpadeo enseguida). Como cada uno tiene su ritmo, nunca parpadean todos a la vez.

### La sonrisa con muelle

La boca es un arco. Con el ratón encima sonríe más: el arco se hunde. Pero en lugar de cambiar de golpe, usamos un **muelle**: la sonrisa tiene un valor (`smile`, de 0 a 1) y una velocidad (`smileV`):

```js
const want = c === hovered || c === grabbed ? 1 : 0;      // a dónde quiere ir
c.smileV = (c.smileV + (want - c.smile) * 0.22) * 0.68;   // acelera hacia allí, y frena
c.smile += c.smileV;
```

Se pasa un poquito y vuelve: un mini rebote de ~0,3 s. Es un detalle pequeño que se nota mucho.

### Reacciones

- **Susto («o»)**: cuando un vertiki explota (lo verás en el paso 13), sus vecinos ponen boca de «o» y abren los ojos durante 0,7 s.
- **Ojos apretados «> <»**: si un vertiki cambia de velocidad de golpe (un choque fuerte), aprieta los ojos 0,3 s. Lo detectamos comparando cuánto se movió su centro en este fotograma y en el anterior.

Las dos funcionan igual: guardamos «hasta cuándo» (`surprisedUntil`, `squintUntil`) y al dibujar miramos si todavía no ha llegado esa hora.

---

<a id="paso-13"></a>

## Paso 13 · Inflar y explotar

▶ **Este paso funcionando:** [demo](https://scorcoles.github.io/vertikis/steps/es/13.html) · [código](steps/es/13.html)

### Qué queremos

Una sola regla, que un niño entienda sin que se la expliquen: **cada toque infla un vertiki, y si se pasa de tamaño, explota** como un globo, con unas gotas que salen volando y una onda. Si lo dejas tranquilo, se desinfla poco a poco. Es la única manera de que exploten.

### Un toque no es un arrastre

Pulsar sobre un vertiki ya servía para agarrarlo (paso 11). Si cada pulsación lo inflase, se inflaría también cada vez que lo arrastras. Así que solo cuenta como **toque** pulsar y soltar enseguida (menos de 250 ms) **sin mover el dedo** (menos de 10 px).

Al pulsar apuntamos cuándo, dónde y sobre quién (`press`). Al soltar comprobamos si fue un toque:

```js
const tap = press && e && performance.now() - press.t < 250 && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 10;
if (tap && cells.includes(press.cell)) inflate(press.cell);
```

### Inflar

Cada vertiki recuerda su tamaño de siempre (`rest`). Inflarlo es ponerle un objetivo un 15 % más grande (`target`). Si ese objetivo pasa de un 34 % del lado corto de la pantalla, explota:

```js
function inflate(c) {
  const next = (c.target ?? c.r) * 1.15;
  if (next > Math.min(W, H) * 0.34) {
    pop(c);
    return;
  }
  c.target = next;
  c.inflatedAt = performance.now();
}
```

(`a ?? b` significa «`a`, y si no tiene valor, `b`».)

`performance.now()` da los milisegundos que han pasado desde que se abrió la página. Lo usamos siempre para medir tiempos.

En cada fotograma, el radio se acerca al objetivo con el patrón de suavizado del paso 12. Y si nadie lo ha tocado en 1,2 segundos, se va acercando a su tamaño de siempre, pero **muy despacio**:

```js
if (c.target !== undefined) {
  c.r += (c.target - c.r) * 0.2;                    // crecer: rápido
  if (Math.abs(c.target - c.r) < 0.5) c.target = undefined;
} else if (c.r > c.rest && now - c.inflatedAt > 1200) {
  c.r += (c.rest - c.r) * 0.003;                    // desinflarse: muy despacio
}
```

Como el radio es lo que usa la forma de reposo (paso 6), al inflarse los puntos empujan hacia fuera y el vertiki **aparta a sus vecinos**. Gratis, sin código extra.

Los pequeños necesitan más toques que los grandes para explotar. Y como se desinflan, inflar uno es una pequeña carrera: si tardas, se te deshincha.

### Explotar

1. Quitamos el vertiki del array `cells`.
2. Creamos unas cuantas **gotas** (más cuanto más grande era) en su borde, con una velocidad hacia fuera y un poco hacia arriba.
3. Creamos una **onda**: un círculo que se agranda y se desvanece.
4. Asustamos a los vecinos (paso 12) y hacemos sonar la explosión (paso 15).

Las gotas son lo más sencillo de todo el proyecto: posición, velocidad, gravedad y una «vida» que baja de 1 a 0. Al dibujarlas, su tamaño es `radio * vida`, así que se encogen hasta desaparecer:

```js
for (const d of drops) {
  d.vy += 0.35;     // gravedad
  d.vx *= 0.98;     // un poco de rozamiento con el aire
  d.x += d.vx;
  d.y += d.vy;
  d.life -= 0.025;  // 40 fotogramas de vida
}
drops = drops.filter((d) => d.life > 0);  // fuera las que ya han muerto
```

La onda es igual: un valor `t` de 0 a 1. El radio crece con `t` y la opacidad (`globalAlpha`) y el grosor bajan con él.

---

<a id="paso-14"></a>

## Paso 14 · Nacer

▶ **Este paso funcionando:** [demo](https://scorcoles.github.io/vertikis/steps/es/14.html) · [código](steps/es/14.html)

### Qué queremos

Poder crear vertikis nuevos con un doble clic en un hueco, y que no aparezcan de golpe, sino que **nazcan pequeños y se inflen**.

### Doble clic hecho a mano

El navegador tiene un evento `dblclick`, pero en el móvil no es fiable. Así que lo detectamos nosotros: si una pulsación llega **menos de 320 ms** después de la anterior y **a menos de 30 px**, es un doble clic.

```js
const double = now - lastDown.t < 320 && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 30;
if (double && !cellAt(e.clientX, e.clientY)) spawn(e.clientX, e.clientY);
```

Solo cuenta en un hueco. Sobre un vertiki, dos toques rápidos son simplemente dos toques: lo inflan dos veces.

### Nacer pequeño

`spawn()` crea un vertiki con un radio de solo el 15 % del que tendrá, y le pone ese tamaño final como objetivo (`target`) y como tamaño de siempre (`rest`):

```js
function spawn(x, y) {
  const target = Math.min(W, H) * (0.07 + Math.random() * 0.14);
  const c = makeCell(x, y, target * 0.15);
  c.target = target;
  c.rest = target;
  cells.push(c);
}
```

No hace falta nada más: el mismo código que infla (paso 13) lo hace crecer hasta su tamaño, empujando a los vecinos. Y desde que nace, se puede inflar hasta que explote como cualquier otro.

---

<a id="paso-15"></a>

## Paso 15 · El sonido, sin archivos de audio

▶ **Este paso funcionando:** [demo](https://scorcoles.github.io/vertikis/steps/es/15.html) · [código](steps/es/15.html)

Ningún sonido del proyecto es un archivo. Todos se **fabrican en el momento** con la Web Audio API, que es como tener un pequeño sintetizador dentro del navegador.

### Los cables

Web Audio funciona como un estudio de sonido con cables: creas «aparatos» (nodos) y los conectas entre sí, hasta llegar a los altavoces.

```
oscilador (el tono)  →  ganancia (el volumen)  →  volumen general  →  altavoces
```

### Primero, el permiso

Los navegadores **no dejan sonar nada hasta que el usuario toca la página** (para que las webs no te asalten con ruido). Así que creamos el sistema de audio en el primer `pointerdown`:

```js
let audio = null;
let master = null;

function ac() {
  if (!audio) {
    audio = new AudioContext();            // el «estudio»
    master = audio.createGain();           // volumen general de todo
    master.gain.value = 0.66;
    master.connect(audio.destination);     // destination = los altavoces
  }
  if (audio.state === 'suspended') audio.resume();
  return audio;
}
```

Todo pasa por `master`. Si quieres bajar o subir todos los sonidos a la vez, cambias un solo número.

### Un tono: el oscilador

Un **oscilador** genera una onda: un pitido continuo. Le decimos una frecuencia (grave o agudo, en hercios) y podemos hacer que cambie con el tiempo, de `from` a `to`. Eso es un «barrido», y es lo que hace que suene a burbuja.

### Que no sea un pitido: la envolvente

Un tono que empieza y acaba de golpe hace «clic» y suena a ordenador. Así que controlamos el volumen con una **envolvente**: sube muy rápido (8 milisegundos) y luego se apaga poco a poco.

```js
function tone(from, to, dur, vol, type = 'sine') {
  const a = ac();
  const t = a.currentTime;                                  // «ahora», en el reloj del audio
  const osc = a.createOscillator();
  osc.type = type;                                          // 'sine' (suave), 'triangle'…
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);  // barrido de frecuencia
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.0001, t);                      // empieza en silencio
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);   // sube rapidísimo
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);  // y se apaga
  osc.connect(gain).connect(master);                        // los cables
  osc.start(t);
  osc.stop(t + dur + 0.02);
}
```

¿Por qué `0.0001` y no `0`? Las rampas «exponenciales» (que suenan más naturales al oído) no pueden empezar ni acabar en cero exacto. Es una manía de la API.

Con esta única función hacemos varios sonidos:

- **Nacer** («bloop»): un tono que sube, más grave cuanto más grande es el vertiki.
- **Inflar**: cada toque (paso 13), un «bloop» más corto que sube un poco más agudo cuanto más grande se hace el vertiki. Así se oye que se acerca al límite.

### Chocar: escuchar solo lo que importa

Cuando lanzas un vertiki contra los demás, suena un «toc» grave y muy suave en cada choque. Lo difícil no es el sonido (es otro `tone` que baja, muy bajito), sino **decidir cuándo sonar**. Si sonase cada vez que dos vertikis se tocan, el montón entero sería un zumbido constante, porque en reposo están todos apretados.

Así que solo escuchamos al que **has lanzado**, y solo durante 1,5 segundos:

1. Al soltarlo, si iba algo rápido (más de 2 píxeles por fotograma), le apuntamos `thrownUntil` = ahora + 1500 ms, y la lista de vertikis que ya estaba tocando.
2. En cada fotograma miramos a quién toca ahora. Si toca a uno que **antes no tocaba**, es un choque nuevo: suena.
3. El volumen depende de la **velocidad con la que se acercan** los dos: un roce casi no se oye y un buen golpe, algo más (pero nunca mucho).

```js
const touching = new Set();
for (const k of cells) {
  if (k === c || Math.hypot(k.cx - c.cx, k.cy - c.cy) > (c.r + k.r) * 0.92) continue; // no se tocan
  touching.add(k);
  if (!c.touching.has(k)) bump(Math.hypot(c.vx - k.vx, c.vy - k.vy), Math.min(c.r, k.r)); // ¡nuevo!
}
c.touching = touching;
```

Un `Set` es como un array en el que cada cosa está una sola vez y en el que preguntar «¿está este?» (`has`) es muy rápido.

### Explotar: ruido

Un globo que explota no es un tono: es **ruido**, como el «shhh» de una radio mal sintonizada. Lo fabricamos llenando 0,1 segundos de audio con números al azar:

```js
const len = Math.ceil(a.sampleRate * 0.1);      // cuántas muestras son 0,1 s
const buffer = a.createBuffer(1, len, a.sampleRate);
const data = buffer.getChannelData(0);
for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1; // entre −1 y 1
```

Ese ruido pasa por un **filtro** que corta los agudos y se va cerrando muy rápido (de 2600 Hz a 300 Hz): el «pshh» se convierte en «pof». Y le sumamos un tono grave muy corto que baja, el «thump», que da el golpe. Los globos grandes suenan más graves.

```
ruido  →  filtro (se cierra)  →  envolvente  →  master
                                     +  tono grave  →  master
```

### Pruébalo

Cambia los números de `createSound` o el tipo de onda (`'square'`, `'sawtooth'`) y escucha qué pasa. Es la mejor manera de aprender sonido: tocar y escuchar.

---

<a id="paso-16"></a>

## Paso 16 · El móvil: inclinar el teléfono

▶ **Este paso funcionando:** [demo](https://scorcoles.github.io/vertikis/steps/es/16.html) · [código](steps/es/16.html)

### La gravedad con dirección

Hasta ahora la gravedad empujaba siempre hacia abajo. Ahora la guardamos como una **dirección** (`gravX`, `gravY`), que en escritorio vale «hacia abajo» (0, 1):

```js
c.x[i] += vx + GRAVITY * gravX;
c.y[i] += vy + GRAVITY * gravY;
```

En el móvil, esa dirección la marca la inclinación del teléfono.

### Leer la inclinación

El evento `deviceorientation` nos da dos ángulos: `gamma` (inclinación izquierda-derecha) y `beta` (adelante-atrás). Su seno nos dice cuánto empuja la gravedad en cada eje. Si la pantalla está girada (en horizontal), giramos también esa dirección. Y la suavizamos (otra vez el patrón del paso 12) para que no tiemble con el pulso.

Muchas tablets Android no tienen giroscopio, y entonces `deviceorientation` llega con los ángulos vacíos. Como plan B escuchamos también `devicemotion`: su `accelerationIncludingGravity` sale solo del acelerómetro, que tienen todos, y dividida entre 9,81 nos da lo mismo que los senos.

### El permiso del iPhone

En iPhone hay que **pedir permiso** para leer la inclinación, y solo se puede pedir dentro de un toque del usuario. Por eso lo pedimos en el primer `pointerdown`, a la vez que desbloqueamos el sonido. En Android funciona sin pedir nada.

### Un detalle de móvil

La gravedad es un 40 % más baja que en escritorio: en la mano, una pantalla pequeña con gravedad fuerte resulta nerviosa.

```js
const touchDevice = navigator.maxTouchPoints > 0 || window.matchMedia('(any-pointer: coarse)').matches; // ¿pantalla táctil?
const GRAVITY = touchDevice ? 0.27 : 0.45;
```

---

<a id="paso-17"></a>

## Paso 17 · Ideas para seguir jugando

La mejor forma de aprender es romper cosas. Algunas ideas, de más fácil a más difícil:

1. **Cambia la paleta** de colores. O haz que todos sean del mismo color.
2. Cambia `STIFFNESS` a `0.1`: vertikis de gelatina.
3. Cambia `POINTS` a `8`: vertikis poligonales.
4. Pon `GRAVITY` en negativo: caen hacia arriba.
5. Haz que **cambien de color** al pasar el ratón por encima.
6. Añade una **expresión nueva**: que se duerman (ojos cerrados) si nadie los toca en 10 segundos.
7. Haz que dos vertikis del mismo color que se tocan durante un rato **se fusionen** en uno más grande.
8. Haz que la gravedad apunte hacia el ratón.

---

## Glosario

- **Canvas**: un rectángulo de píxeles en el que se dibuja con JavaScript.
- **Contexto (`ctx`)**: el «pincel» del canvas.
- **Fotograma**: uno de los dibujos fijos que, en sucesión rápida, forman la animación.
- **Verlet**: forma de mover cosas guardando la posición actual y la anterior (la velocidad es la diferencia).
- **Fricción**: multiplicar la velocidad por algo menor que 1 en cada paso para que se frene.
- **Shape matching**: tirar de los puntos hacia una forma ideal colocada en el mismo centro y giro.
- **Suavizado**: `valor += (objetivo − valor) * k`, para acercarse a algo poco a poco.
- **Muelle**: como el suavizado, pero con velocidad, así que se pasa un poco y rebota.
- **Oscilador**: nodo de Web Audio que genera un tono.
- **Envolvente**: cómo sube y baja el volumen de un sonido en el tiempo.
- **Filtro paso bajo (lowpass)**: deja pasar los graves y corta los agudos.

---

<a id="para-quien-mantenga-el-repo"></a>

## Para quien mantenga el repo

Para aprender o jugar con vertikis no necesitas esto. Es solo para quien cambie el código del repo.

`vertikis.js` y las páginas de `steps/` **no se editan a mano**: salen todas de un único archivo, `src/vertikis.js`. Así cada cambio se hace una sola vez y los 32 pasos (16 en cada idioma) no se desincronizan. Ese archivo lleva unas marcas sencillas:

- `//>> 4` … `//<<`: este trozo aparece a partir del paso 4. `//>> 4-8`: solo en los pasos 4 a 8.
- `código // @4` o `código // @4-8`: lo mismo, para una sola línea.
- `//es texto` y `//en text`: un comentario en cada idioma.
- `//>> 17` … `//<<` (o `// @17`): solo en el `vertikis.js` final, no en el tutorial (sorpresas).

Después de cambiarlo, genera todo con:

```bash
node tools/build.mjs
```

Solo hace falta [Node](https://nodejs.org), sin instalar nada más.

## Créditos

Un experimento de [VERTIK](https://www.vertik.net).

Homenaje a la home de [yugop.com](https://yugop.com/) de Yugo Nakamura (2005), con sus círculos negros blandos que se empujaban y se arrastraban.

## Licencia

[MIT](LICENSE): úsalo, cámbialo y aprende con él. Si haces algo chulo, nos encantará verlo.
