// Editor en vivo: el código de sketch.js a la izquierda y, a la derecha, el resultado, que
// se vuelve a ejecutar cada vez que dejas de escribir. El resultado corre en un iframe
// aislado (sandbox): un error en el código no rompe la página. Los textos vienen de los
// atributos data-* de #editor, para servir a la página en español y a la inglesa.

(async () => {
  const root = document.getElementById('editor');
  const host = root.querySelector('.editor__code');
  const preview = root.querySelector('.editor__preview');
  const status = root.querySelector('.editor__status');
  const t = root.dataset;

  // El código original se lee de sketch.js: necesita un servidor (GitHub Pages, o
  // «python3 -m http.server»). Abriendo el archivo con doble clic no se puede leer.
  let original;
  try {
    const res = await fetch('sketch.js');
    if (!res.ok) throw new Error(res.status);
    original = await res.text();
  } catch {
    root.classList.add('is-offline');
    status.textContent = t.offline;
    return;
  }

  const editor = CodeMirror(host, {
    value: original,
    mode: 'javascript',
    lineNumbers: true,
    matchBrackets: true,
    indentUnit: 2,
    tabSize: 2,
    lineWrapping: false,
    viewportMargin: Infinity,
    extraKeys: {
      Tab: (cm) => cm.execCommand(cm.somethingSelected() ? 'indentMore' : 'insertSoftTab'),
      'Shift-Tab': 'indentLess',
      'Cmd-Enter': () => run(),
      'Ctrl-Enter': () => run(),
    },
  });
  // Lector de pantalla: el área de texto escondida de CodeMirror recibe un nombre.
  editor.getInputField().setAttribute('aria-label', t.label);

  // Cada ejecución, un iframe nuevo: así no queda nada de la anterior (ni bucles ni
  // variables). El código va dentro de la página del iframe, con p5.js.
  let frame = null;
  let runId = 0;
  function run() {
    const id = ++runId;
    const code = editor.getValue().replace(/<\/script/gi, '<\\/script');
    const next = document.createElement('iframe');
    next.title = t.previewLabel;
    next.setAttribute('sandbox', 'allow-scripts');
    next.srcdoc = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%;overflow:hidden;background:#fff}canvas{display:block;touch-action:none}</style>
<script>
  const report = (error, line) => parent.postMessage({ vertikisRun: ${id}, error: String(error), line }, '*'); window.addEventListener('error', (e) => report(e.message, e.lineno)); window.addEventListener('unhandledrejection', (e) => report(e.reason?.message ?? e.reason, Number(/:(\\d+):\\d+\\)?\\s*$/m.exec(e.reason?.stack?.split('\\n')[1] ?? '')?.[1]))); const log = console.error; console.error = (...a) => { report(a.map((x) => x?.message ?? x).join(' ').split('\\n')[0]); log(...a); };
</script>
<script src="https://cdn.jsdelivr.net/npm/p5@2.3.4/lib/p5.min.js"></script>
</head><body><script>
${code}
</script>
<script>parent.postMessage({ vertikisRun: ${id}, ok: true }, '*');</script>
</body></html>`;
    preview.append(next);
    if (frame) frame.remove();
    frame = next;
    status.textContent = t.running;
    status.classList.remove('is-error');
    markError(null);
  }

  // La línea del error se marca en el editor hasta la siguiente ejecución.
  let marked = null;
  function markError(line) {
    if (marked !== null) editor.removeLineClass(marked, 'background', 'is-error-line');
    marked = line;
    if (line !== null) editor.addLineClass(line, 'background', 'is-error-line');
  }

  // Líneas antes del código en el srcdoc (para dar la línea del error en el editor).
  const OFFSET = 7;
  window.addEventListener('message', (e) => {
    const m = e.data;
    if (!m || m.vertikisRun !== runId) return;
    if (m.error) {
      const n = m.line > OFFSET && m.line - OFFSET <= editor.lineCount() ? m.line - OFFSET : 0;
      status.textContent = n ? `${m.error} (${t.line} ${n})` : m.error;
      status.classList.add('is-error');
      if (n) markError(n - 1);
    } else if (!status.classList.contains('is-error')) {
      status.textContent = t.ok;
    }
  });

  // Se ejecuta solo al dejar de escribir 0,7 s.
  let timer;
  editor.on('change', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 700);
  });

  root.querySelector('[data-reset]').addEventListener('click', () => {
    editor.setValue(original);
    run();
  });
  root.querySelector('[data-run]').addEventListener('click', () => run());

  // El resultado empieza a correr cuando el editor se acerca a la pantalla: hasta entonces,
  // un sketch de más no gasta.
  new IntersectionObserver((entries, io) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    run();
  }, { rootMargin: '200px' }).observe(root);
})();
