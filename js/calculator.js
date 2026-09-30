/*
 * Physics Quest — scientific calculator.
 * A small safe expression parser (no eval) plus the pop-up calculator panel.
 *
 * Supports: + − × ÷, brackets (missing closing brackets are added), ^ powers,
 * ² squares, √, sin/cos/tan in DEGREES, log (base 10), ln, π, Ans,
 * implicit multiplication (2π, 3(4+1), 2√9) and scientific numbers:
 * "4.7×10^3" typed right after a number is one number (4700), so
 * 2 ÷ 4.7×10^3 = 2 ÷ 4700, just like the EXP key on a real calculator.
 */
(function (root) {
  'use strict';

  const FUNCS = {
    sin: (x) => roundTrig(Math.sin((x * Math.PI) / 180)),
    cos: (x) => roundTrig(Math.cos((x * Math.PI) / 180)),
    tan: (x) => {
      if (Math.abs(((x % 180) + 180) % 180 - 90) < 1e-9) throw new Error('undefined');
      return roundTrig(Math.tan((x * Math.PI) / 180));
    },
    log: (x) => { if (x <= 0) throw new Error('domain'); return Math.log10(x); },
    ln: (x) => { if (x <= 0) throw new Error('domain'); return Math.log(x); },
    '√': (x) => { if (x < 0) throw new Error('domain'); return Math.sqrt(x); },
  };
  // sin 30° should be exactly 0.5, not 0.49999999999999994
  function roundTrig(v) { return Math.abs(v - Math.round(v * 1e12) / 1e12) < 1e-13 ? Math.round(v * 1e12) / 1e12 : v; }

  function tokenize(src) {
    const s = String(src)
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[٫]/g, '.')
      .replace(/\*/g, '×').replace(/\//g, '÷').replace(/[−–]/g, '-')
      .replace(/pi/gi, 'π').replace(/sqrt/gi, '√');
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === ' ') { i++; continue; }
      const num = s.slice(i).match(/^(\d+\.?\d*|\.\d+)(?:(?:×10\^|[eE])([-+]?\d+))?/);
      if (num) {
        tokens.push({ t: 'num', v: parseFloat(num[1] + (num[2] !== undefined ? 'e' + num[2] : '')) });
        i += num[0].length;
        continue;
      }
      const word = s.slice(i).match(/^(sin|cos|tan|log|ln|Ans)/);
      if (word) {
        tokens.push(word[1] === 'Ans' ? { t: 'ans' } : { t: 'fn', v: word[1] });
        i += word[0].length;
        continue;
      }
      if (c === '√') { tokens.push({ t: 'fn', v: '√' }); i++; continue; }
      if (c === 'π') { tokens.push({ t: 'num', v: Math.PI }); i++; continue; }
      if ('+-×÷^()²'.includes(c)) { tokens.push({ t: 'op', v: c }); i++; continue; }
      throw new Error('bad character ' + c);
    }
    return tokens;
  }

  // Recursive-descent parser.
  //   expr   := term (('+'|'-') term)*
  //   term   := unary (('×'|'÷') unary | <implicit ×> unary)*
  //   unary  := ('-'|'+') unary | power
  //   power  := postfix ('^' unary)?          (right associative, -2^2 = -4)
  //   postfix:= primary ('²')*
  //   primary:= number | Ans | π | fn primary | '(' expr ')'
  function evaluate(src, ans) {
    const tokens = tokenize(src);
    if (!tokens.length) throw new Error('empty');
    let pos = 0;
    const peek = () => tokens[pos];
    const isOp = (v) => peek() && peek().t === 'op' && peek().v === v;
    const startsPrimary = () => {
      const k = peek();
      return k && (k.t === 'num' || k.t === 'ans' || k.t === 'fn' || (k.t === 'op' && k.v === '('));
    };

    function expr() {
      let v = term();
      while (isOp('+') || isOp('-')) {
        const op = tokens[pos++].v;
        const r = term();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }
    function term() {
      let v = unary();
      for (;;) {
        if (isOp('×')) { pos++; v *= unary(); }
        else if (isOp('÷')) {
          pos++;
          const d = unary();
          if (d === 0) throw new Error('divide by zero');
          v /= d;
        } else if (startsPrimary()) v *= unary(); // implicit multiplication
        else return v;
      }
    }
    function unary() {
      if (isOp('-')) { pos++; return -unary(); }
      if (isOp('+')) { pos++; return unary(); }
      return power();
    }
    function power() {
      const base = postfix();
      if (isOp('^')) { pos++; return Math.pow(base, unary()); }
      return base;
    }
    function postfix() {
      let v = primary();
      while (isOp('²')) { pos++; v = v * v; }
      return v;
    }
    function primary() {
      const k = tokens[pos++];
      if (!k) throw new Error('incomplete');
      if (k.t === 'num') return k.v;
      if (k.t === 'ans') { if (ans === undefined || ans === null) throw new Error('no Ans yet'); return ans; }
      if (k.t === 'fn') return FUNCS[k.v](isOp('(') ? primary() : postfix());
      if (k.t === 'op' && k.v === '(') {
        const v = expr();
        if (isOp(')')) pos++; // a missing ")" at the end is fine
        else if (peek()) throw new Error('expected )');
        return v;
      }
      throw new Error('unexpected ' + k.v);
    }

    const v = expr();
    if (pos < tokens.length) throw new Error('unexpected ' + tokens[pos].v);
    if (!isFinite(v)) throw new Error('too big');
    return v;
  }

  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (n) => String(n).split('').map((c) => SUP[c]).join('');

  // Full result, like a calculator screen (10 significant figures).
  function formatResult(v) {
    if (v === 0) return '0';
    const r = Number(v.toPrecision(10));
    const a = Math.abs(r);
    if (a >= 1e10 || a < 1e-6) {
      const [m, e] = r.toExponential(9).split('e');
      return `${Number(m)} × 10${sup(+e)}`;
    }
    return String(r);
  }
  // The same result written the way the game writes answers (3 significant figures).
  function formatSf(v, fmt) { return fmt ? fmt(v) : String(Number(v.toPrecision(3))); }
  // Text to type into an answer box.
  function forAnswerBox(v) {
    const r = Number(v.toPrecision(6));
    const a = Math.abs(r);
    if (a !== 0 && (a >= 1e6 || a < 1e-3)) {
      const [m, e] = r.toExponential(5).split('e');
      return `${Number(m)}×10^${+e}`;
    }
    return String(r);
  }

  // ---------- panel ----------
  function mount(opts) {
    const t = opts.t;
    const fmt = opts.fmt;
    const el = {
      fab: document.getElementById('calc-fab'),
      panel: document.getElementById('calc-panel'),
      input: document.getElementById('calc-input'),
      result: document.getElementById('calc-result'),
      sf: document.getElementById('calc-sf'),
      use: document.getElementById('calc-use'),
      question: document.getElementById('calc-question'),
      close: document.getElementById('calc-close'),
      keys: document.getElementById('calc-keys'),
    };
    let ans = null;
    let justEvaluated = false;
    // Cursor position, tracked by us: on touch screens the input is often not focused,
    // and its own selection can't be trusted then. null = end of the line.
    let caret = null;
    const caretPos = () => (caret === null || caret > el.input.value.length ? el.input.value.length : caret);
    const syncCaret = () => { caret = el.input.selectionStart ?? null; };

    function open() {
      el.panel.hidden = false;
      el.fab.setAttribute('aria-expanded', 'true');
      refreshUse();
      el.input.focus({ preventScroll: true });
    }
    function close() {
      el.panel.hidden = true;
      el.fab.setAttribute('aria-expanded', 'false');
      el.fab.focus({ preventScroll: true });
    }
    function refreshUse() {
      const target = opts.answerTarget();
      el.use.hidden = !(target && ans !== null);
      // keep the question in view: on phones the panel covers it
      const q = opts.questionText ? opts.questionText() : '';
      el.question.hidden = !q;
      el.question.textContent = q || '';
    }

    function insert(text) {
      if (justEvaluated) {
        // after "=", an operator continues from Ans; anything else starts fresh
        el.input.value = /^[+×÷^²)]|^-$/.test(text) ? 'Ans' : '';
        justEvaluated = false;
      }
      const inp = el.input;
      const start = caretPos();
      inp.value = inp.value.slice(0, start) + text + inp.value.slice(start);
      caret = start + text.length;
      try { inp.setSelectionRange(caret, caret); } catch (e) { /* ignore */ }
      preview();
    }

    function preview() {
      el.result.classList.remove('error');
      const src = el.input.value.trim();
      if (!src) { el.result.textContent = ''; el.sf.textContent = ''; return; }
      try {
        const v = evaluate(src, ans);
        el.result.textContent = '= ' + formatResult(v);
        el.sf.textContent = t('calc.sf') + ' ' + formatSf(v, fmt);
      } catch (e) {
        el.result.textContent = '';
        el.sf.textContent = '';
      }
    }

    function equals() {
      const src = el.input.value.trim();
      if (!src) return;
      try {
        const v = evaluate(src, ans);
        ans = v;
        el.input.value = formatResult(v).replace(' × 10', '×10^').replace(/[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+$/, (m) => m.split('').map((c) => ({ '⁻': '-', '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 })[c]).join(''));
        el.result.classList.remove('error');
        el.result.textContent = '= ' + formatResult(v);
        el.sf.textContent = t('calc.sf') + ' ' + formatSf(v, fmt);
        justEvaluated = true;
        caret = null;
        refreshUse();
      } catch (e) {
        el.result.textContent = t('calc.error');
        el.result.classList.add('error');
        el.sf.textContent = '';
      }
    }

    function backspace() {
      justEvaluated = false;
      const inp = el.input;
      const start = caretPos();
      if (start > 0) {
        // delete whole words like "sin(" or "Ans" in one go
        const before = inp.value.slice(0, start);
        const m = before.match(/(sin\(|cos\(|tan\(|log\(|ln\(|√\(|Ans|×10\^)$/);
        const n = m ? m[0].length : 1;
        inp.value = before.slice(0, -n) + inp.value.slice(start);
        caret = start - n;
        try { inp.setSelectionRange(caret, caret); } catch (e) { /* ignore */ }
      }
      preview();
    }

    function negate() {
      const inp = el.input;
      if (justEvaluated || !inp.value) { insert('-'); return; }
      // flip the sign of the last number
      inp.value = inp.value.replace(/(^|[+\-×÷^(])(-?)(\d*\.?\d+(?:×10\^-?\d+)?)$/, (m, op, neg, n) => op + (neg ? '' : '-') + n);
      caret = null;
      preview();
    }

    el.keys.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const k = b.dataset.k;
      if (k === '=') equals();
      else if (k === 'AC') { el.input.value = ''; caret = null; justEvaluated = false; preview(); }
      else if (k === 'DEL') backspace();
      else if (k === 'NEG') negate();
      else insert(k);
      if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) el.input.focus({ preventScroll: true });
    });
    el.input.addEventListener('input', () => { justEvaluated = false; syncCaret(); preview(); });
    ['click', 'keyup', 'select'].forEach((ev) => el.input.addEventListener(ev, syncCaret));
    el.input.addEventListener('keydown', (e) => {
      if (justEvaluated && e.key.length === 1 && !e.ctrlKey && !e.metaKey && e.key !== '=') {
        // like the keypad: an operator continues from Ans, anything else starts a new sum
        el.input.value = /[+\-*/×÷^²)]/.test(e.key) ? 'Ans' : '';
        justEvaluated = false;
      }
      if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); equals(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
      e.stopPropagation(); // don't let the quiz react to keys typed here
    });
    el.fab.addEventListener('click', () => (el.panel.hidden ? open() : close()));
    el.close.addEventListener('click', close);
    el.use.addEventListener('click', () => {
      const target = opts.answerTarget();
      if (!target || ans === null) return;
      target.value = forAnswerBox(ans);
      close();
      target.focus();
    });

    return { open, close, refresh: () => { refreshUse(); preview(); }, get isOpen() { return !el.panel.hidden; } };
  }

  const api = { evaluate, formatResult, forAnswerBox, mount };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PhysicsCalculator = api;
})(typeof window !== 'undefined' ? window : globalThis);
