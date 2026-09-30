/*
 * Physics Quest — PQ-30 scientific calculator.
 * Modelled on the classic school calculator (TI-30Xa style):
 *  - algebraic entry with correct order of operations (× before +) and brackets
 *  - functions act on the number on the display: 30 SIN → 0.5
 *  - green 2nd key for the functions printed above the keys
 *  - EE for powers of ten, DEG/RAD/GRAD, memory, FLO/SCI/ENG and FIX display modes
 * The engine has no DOM code so it can be tested in Node; mount() builds the panel.
 */
(function (root) {
  'use strict';

  const MAX_DIGITS = 10;
  const PREC = { add: 1, sub: 1, mul: 2, div: 2, pow: 3, root: 3, ncr: 3 };
  const OP_SYM = { add: '+', sub: '−', mul: '×', div: '÷', pow: '^', root: 'ˣ√', ncr: 'nCr' };

  // ---------- number display (10-digit mantissa, 2-digit exponent) ----------
  function splitSci(v, sig) {
    const [m, e] = v.toExponential(sig - 1).split('e');
    return { m: String(Number(m)), e: +e };
  }
  function pad2(e) { return (e < 0 ? '-' : '') + String(Math.abs(e)).padStart(2, '0'); }

  function formatNumber(v, fmt, fix) {
    if (!isFinite(v)) return { main: 'Error', exp: null };
    if (v === 0) return { main: fix !== null && fmt === 'FLO' ? (0).toFixed(fix) : '0', exp: null };
    const a = Math.abs(v);
    if (fmt === 'SCI' || fmt === 'ENG' || a >= 1e10 || a < 1e-9) {
      let { m, e } = splitSci(v, MAX_DIGITS);
      if (fmt === 'ENG') {
        const shift = ((e % 3) + 3) % 3;
        e -= shift;
        m = String(Number((Number(m) * Math.pow(10, shift)).toPrecision(MAX_DIGITS)));
      }
      if (fix !== null) m = Number(m).toFixed(fix);
      return { main: m, exp: pad2(e) };
    }
    if (fix !== null) {
      const s = v.toFixed(fix);
      if (s.replace(/[-.]/g, '').length <= MAX_DIGITS) return { main: s, exp: null };
    }
    // plain decimal with at most 10 digits on screen
    const intDigits = Math.max(1, Math.floor(Math.log10(a)) + 1);
    const decimals = Math.max(0, MAX_DIGITS - intDigits);
    let s = String(Number(v.toFixed(Math.min(decimals, 20))));
    if (/e/.test(s) || s.replace(/[-.]/g, '').length > MAX_DIGITS) {
      const { m, e } = splitSci(v, MAX_DIGITS);
      return { main: m, exp: pad2(e) };
    }
    return { main: s, exp: null };
  }

  // Short text for the expression line above the number.
  function shortNum(v) {
    if (!isFinite(v)) return '?';
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e10 || a < 1e-6)) {
      const { m, e } = splitSci(v, 6);
      return `${m}×10^${e}`;
    }
    return String(Number(v.toPrecision(10)));
  }

  function factorial(n) {
    if (n < 0 || n > 69 || !Number.isInteger(n)) throw new Error('domain');
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  // ---------- engine ----------
  function createEngine() {
    const st = {
      entering: false, entry: '0', exp: null, expNeg: false,
      cur: 0, label: '0', curPushed: false,
      vals: [], labels: [], ops: [], tokens: [], parenAt: [], lastGroup: null,
      lastWasOp: false, afterEquals: false,
      second: false, hyp: false, angle: 'DEG', mem: 0, fmt: 'FLO', fix: null, awaitFix: false,
      ans: 0, error: false, line: '',
    };

    const toRad = (x) => (st.angle === 'DEG' ? (x * Math.PI) / 180 : st.angle === 'GRAD' ? (x * Math.PI) / 200 : x);
    const fromRad = (x) => (st.angle === 'DEG' ? (x * 180) / Math.PI : st.angle === 'GRAD' ? (x * 200) / Math.PI : x);
    const clean = (v) => (Math.abs(v - Math.round(v)) < 1e-12 ? Math.round(v) : Math.abs(v) < 1e-12 ? 0 : Number(v.toPrecision(13)));

    function entryValue() {
      const e = st.exp === null ? '' : 'e' + (st.expNeg ? '-' : '') + (st.exp || '0');
      return parseFloat(st.entry + e);
    }
    function entryText() {
      return st.exp === null ? st.entry : `${st.entry}×10^${st.expNeg ? '-' : ''}${+st.exp || 0}`;
    }
    function commitEntry() {
      if (!st.entering) return;
      st.cur = entryValue();
      st.label = entryText();
      st.entering = false;
      st.exp = null;
      st.expNeg = false;
    }
    function fail() { st.error = true; st.entering = false; }
    function startFresh() {
      // a new number after "=" starts a new calculation
      if (st.afterEquals) { st.tokens = []; st.line = ''; st.afterEquals = false; }
    }
    function setCur(v, label) {
      if (!isFinite(v) || Math.abs(v) >= 1e100) return fail();
      st.cur = clean(v);
      st.label = label;
      st.entering = false;
      st.lastWasOp = false;
      st.curPushed = false;
      refreshLine();
    }

    function apply(op, a, b) {
      switch (op) {
        case 'add': return a + b;
        case 'sub': return a - b;
        case 'mul': return a * b;
        case 'div': if (b === 0) throw new Error('div0'); return a / b;
        case 'pow': return Math.pow(a, b);
        case 'root': if (b === 0) throw new Error('domain'); return Math.pow(a, 1 / b);
        case 'ncr': {
          if (!Number.isInteger(a) || !Number.isInteger(b) || b > a || b < 0) throw new Error('domain');
          return Math.round(factorial(a) / (factorial(b) * factorial(a - b)));
        }
      }
      throw new Error('op');
    }
    function reduce() {
      const op = st.ops.pop();
      const b = st.vals.pop(), a = st.vals.pop();
      st.labels.pop(); st.labels.pop();
      const v = apply(op, a, b);
      if (!isFinite(v)) throw new Error('overflow');
      st.vals.push(v);
      st.labels.push(shortNum(v));
    }
    function refreshLine() {
      const tail = st.curPushed || st.lastWasOp ? [] : [st.entering ? entryText() : st.label];
      st.line = st.tokens.concat(tail).join(' ');
    }

    // Unary functions work on the number on the display, like the real calculator.
    function unary(fn, text) {
      commitEntry();
      let v;
      const x = st.cur;
      switch (fn) {
        case 'sq': v = x * x; break;
        case 'cube': v = x * x * x; break;
        case 'sqrt': if (x < 0) throw new Error('domain'); v = Math.sqrt(x); break;
        case 'cbrt': v = Math.cbrt(x); break;
        case 'inv': if (x === 0) throw new Error('div0'); v = 1 / x; break;
        case 'log': if (x <= 0) throw new Error('domain'); v = Math.log10(x); break;
        case 'ln': if (x <= 0) throw new Error('domain'); v = Math.log(x); break;
        case 'tenx': v = Math.pow(10, x); break;
        case 'ex': v = Math.exp(x); break;
        case 'fact': v = factorial(x); break;
        case 'neg': v = -x; break;
        case 'sin': v = st.hyp ? Math.sinh(x) : Math.sin(toRad(x)); break;
        case 'cos': v = st.hyp ? Math.cosh(x) : Math.cos(toRad(x)); break;
        case 'tan': {
          if (st.hyp) { v = Math.tanh(x); break; }
          if (Math.abs(Math.cos(toRad(x))) < 1e-12) throw new Error('domain');
          v = Math.tan(toRad(x));
          break;
        }
        case 'asin': if (Math.abs(x) > 1 && !st.hyp) throw new Error('domain'); v = st.hyp ? Math.asinh(x) : fromRad(Math.asin(x)); break;
        case 'acos': if (st.hyp ? x < 1 : Math.abs(x) > 1) throw new Error('domain'); v = st.hyp ? Math.acosh(x) : fromRad(Math.acos(x)); break;
        case 'atan': if (st.hyp && Math.abs(x) >= 1) throw new Error('domain'); v = st.hyp ? Math.atanh(x) : fromRad(Math.atan(x)); break;
        case 'pct': {
          // 500 + 10% = 550: a percentage after + or − is taken of the first number
          const top = st.ops[st.ops.length - 1];
          v = (top === 'add' || top === 'sub') && st.vals.length ? (st.vals[st.vals.length - 1] * x) / 100 : x / 100;
          break;
        }
        default: throw new Error('fn');
      }
      // label: wrap a bracket group that is already on the line
      let inner = st.label;
      if (st.curPushed && st.lastGroup !== null) {
        inner = st.tokens.slice(st.lastGroup).join(' ');
        st.tokens = st.tokens.slice(0, st.lastGroup);
      }
      const bare = inner.replace(/^\(\s*(.*?)\s*\)$/, '$1');
      const simple = /^-?[\w.π]+$/.test(bare); // a single number or name needs no brackets
      const wrap = simple ? bare : `(${bare})`;
      const labels = { sq: `${wrap}²`, cube: `${wrap}³`, neg: `−${wrap}`, fact: `${wrap}!`, pct: `${wrap}%` };
      const label = labels[fn] || `${text}(${bare})`;
      st.hyp = false;
      setCur(v, label);
    }

    function binary(op) {
      if (st.lastWasOp && !st.entering) { // change your mind: 2 + × 3 → 2 × 3
        st.ops[st.ops.length - 1] = op;
        st.tokens[st.tokens.length - 1] = OP_SYM[op];
        refreshLine();
        return;
      }
      if (st.afterEquals) { st.tokens = []; st.afterEquals = false; }
      commitEntry();
      if (!st.curPushed) st.tokens.push(st.label);
      st.vals.push(st.cur);
      st.labels.push(st.label);
      while (st.ops.length && st.ops[st.ops.length - 1] !== '(' && PREC[st.ops[st.ops.length - 1]] >= PREC[op]) reduce();
      st.ops.push(op);
      st.tokens.push(OP_SYM[op]);
      st.cur = st.vals[st.vals.length - 1]; // show the running result, like the real calculator
      st.label = st.labels[st.labels.length - 1];
      st.lastWasOp = true;
      st.curPushed = false;
      st.lastGroup = null;
      refreshLine();
    }

    function openParen() {
      if (st.afterEquals) { st.tokens = []; st.afterEquals = false; }
      if (st.entering || (st.curPushed && !st.lastWasOp)) binary('mul'); // 2(3+1) means 2 × (3+1)
      if (st.parenAt.length >= 15) throw new Error('too many');
      st.ops.push('(');
      st.parenAt.push(st.tokens.length);
      st.tokens.push('(');
      st.lastWasOp = true;
      st.cur = 0;
      st.label = '0';
      refreshLine();
    }
    function closeParen() {
      if (!st.parenAt.length) return;
      commitEntry();
      if (!st.curPushed) st.tokens.push(st.label);
      st.vals.push(st.cur);
      st.labels.push(st.label);
      while (st.ops[st.ops.length - 1] !== '(') reduce();
      st.ops.pop();
      st.tokens.push(')');
      st.lastGroup = st.parenAt.pop();
      st.cur = st.vals.pop();
      st.labels.pop();
      st.label = shortNum(st.cur);
      st.curPushed = true;
      st.lastWasOp = false;
      refreshLine();
    }
    function equals() {
      commitEntry();
      if (!st.tokens.length) { st.ans = st.cur; st.afterEquals = true; return; }
      if (!st.curPushed) st.tokens.push(st.label);
      while (st.parenAt.length) { st.tokens.push(')'); st.parenAt.pop(); }
      st.vals.push(st.cur);
      st.labels.push(st.label);
      while (st.ops.length) {
        if (st.ops[st.ops.length - 1] === '(') { st.ops.pop(); continue; }
        reduce();
      }
      const v = st.vals.pop();
      st.labels = [];
      st.line = st.tokens.join(' ') + ' =';
      st.tokens = [];
      st.lastGroup = null;
      if (!isFinite(v) || Math.abs(v) >= 1e100) return fail();
      st.cur = clean(v);
      st.label = shortNum(st.cur);
      st.ans = st.cur;
      st.curPushed = false;
      st.lastWasOp = false;
      st.afterEquals = true;
    }

    function clearAll() {
      Object.assign(st, {
        entering: false, entry: '0', exp: null, expNeg: false, cur: 0, label: '0', curPushed: false,
        vals: [], labels: [], ops: [], tokens: [], parenAt: [], lastGroup: null,
        lastWasOp: false, afterEquals: false, second: false, hyp: false, awaitFix: false, error: false, line: '',
      });
    }

    function digit(d) {
      if (!st.entering) {
        startFresh();
        st.entering = true;
        st.entry = '0';
        st.exp = null;
        st.expNeg = false;
        st.lastWasOp = false;
        st.curPushed = false;
      }
      if (st.exp !== null) st.exp = ((st.exp || '') + d).slice(-2);
      else if (st.entry.replace(/[-.]/g, '').length < MAX_DIGITS) st.entry = st.entry === '0' ? d : st.entry === '-0' ? '-' + d : st.entry + d;
      refreshLine();
    }
    function point() {
      if (!st.entering) digit('0');
      if (st.exp === null && !st.entry.includes('.')) st.entry += '.';
      refreshLine();
    }
    function ee() {
      if (!st.entering) {
        const s = shortNum(st.cur);
        digit('1');
        if (!/[e×]/.test(s) && s.replace(/[-.]/g, '').length <= MAX_DIGITS && st.cur !== 0) st.entry = s;
      }
      if (st.exp === null) st.exp = '';
      refreshLine();
    }
    function negate() {
      if (st.entering) {
        if (st.exp !== null) st.expNeg = !st.expNeg;
        else st.entry = st.entry.startsWith('-') ? st.entry.slice(1) : '-' + st.entry;
        refreshLine();
      } else unary('neg', '−');
    }
    function backspace() {
      if (!st.entering) return;
      if (st.exp !== null) {
        if (st.exp) st.exp = st.exp.slice(0, -1);
        else { st.exp = null; st.expNeg = false; }
      } else {
        st.entry = st.entry.slice(0, -1);
        if (st.entry === '' || st.entry === '-') st.entry = '0';
      }
      refreshLine();
    }

    function press(key) {
      if (key === 'onac') { clearAll(); return; }
      if (st.error) {
        if (key === 'cec') clearAll();
        return;
      }
      if (st.awaitFix) {
        st.awaitFix = false;
        if (/^\d$/.test(key)) { st.fix = +key; return; }
        if (key === '.') { st.fix = null; return; }
      }
      if (key === '2nd') { st.second = !st.second; return; }
      if (key === 'hyp') { st.hyp = !st.hyp; st.second = false; return; }
      const second = st.second;
      st.second = false;
      const k = second ? ({
        drg: 'drgconv', log: 'tenx', ln: 'ex', sin: 'asin', cos: 'acos', tan: 'atan', pow: 'root',
        pi: 'swap', sq: 'cube', sqrt: 'cbrt', fact: 'ncr', ee: 'fix', 7: 'flo', 8: 'sci', 9: 'eng',
        sto: 'exc', rcl: 'sum', 2: 'pct',
      })[key] || key : key;

      try {
        if (/^\d$/.test(k)) return digit(k);
        switch (k) {
          case '.': return point();
          case 'ee': return ee();
          case 'neg': return negate();
          case 'del': return backspace();
          case 'cec':
            // first press clears the number being typed, second press clears everything
            if (st.entering) { st.entering = false; st.cur = 0; st.label = '0'; st.exp = null; refreshLine(); } else clearAll();
            return;
          case 'add': case 'sub': case 'mul': case 'div': case 'pow': case 'root': case 'ncr': return binary(k);
          case '(': return openParen();
          case ')': return closeParen();
          case 'eq': return equals();
          case 'pi': startFresh(); return setCur(Math.PI, 'π');
          case 'ans': startFresh(); return setCur(st.ans, 'Ans');
          case 'rcl': startFresh(); return setCur(st.mem, 'M');
          case 'sto': commitEntry(); st.mem = st.cur; return;
          case 'sum': commitEntry(); st.mem += st.cur; return;
          case 'exc': { commitEntry(); const m = st.mem; st.mem = st.cur; return setCur(m, 'M'); }
          case 'swap': {
            commitEntry();
            if (!st.vals.length || st.lastWasOp) return;
            const i = st.vals.length - 1;
            [st.vals[i], st.cur] = [st.cur, st.vals[i]];
            [st.labels[i], st.label] = [st.label, st.labels[i]];
            st.tokens[st.tokens.length - 2] = st.labels[i];
            return refreshLine();
          }
          case 'drg': st.angle = { DEG: 'RAD', RAD: 'GRAD', GRAD: 'DEG' }[st.angle]; return;
          case 'drgconv': {
            commitEntry();
            const rad = toRad(st.cur);
            st.angle = { DEG: 'RAD', RAD: 'GRAD', GRAD: 'DEG' }[st.angle];
            return setCur(fromRad(rad), shortNum(fromRad(rad)));
          }
          case 'fix': st.awaitFix = true; return;
          case 'flo': st.fmt = 'FLO'; return;
          case 'sci': st.fmt = 'SCI'; return;
          case 'eng': st.fmt = 'ENG'; return;
          case 'sin': return unary('sin', st.hyp ? 'sinh' : 'sin');
          case 'cos': return unary('cos', st.hyp ? 'cosh' : 'cos');
          case 'tan': return unary('tan', st.hyp ? 'tanh' : 'tan');
          case 'asin': return unary('asin', st.hyp ? 'sinh⁻¹' : 'sin⁻¹');
          case 'acos': return unary('acos', st.hyp ? 'cosh⁻¹' : 'cos⁻¹');
          case 'atan': return unary('atan', st.hyp ? 'tanh⁻¹' : 'tan⁻¹');
          case 'log': return unary('log', 'log');
          case 'ln': return unary('ln', 'ln');
          case 'tenx': return unary('tenx', '10^');
          case 'ex': return unary('ex', 'e^');
          case 'sq': case 'cube': case 'sqrt': case 'cbrt': case 'inv': case 'fact': case 'pct':
            return unary(k, { sqrt: '√', cbrt: '³√', inv: '1/' }[k] || k);
        }
      } catch (e) {
        fail();
      }
    }

    function view() {
      let num;
      if (st.error) num = { main: 'Error', exp: null };
      else if (st.entering) {
        num = { main: st.entry, exp: st.exp === null ? null : (st.expNeg ? '-' : '') + (st.exp || '').padStart(2, '0') };
      } else num = formatNumber(st.cur, st.fmt, st.fix);
      return {
        main: num.main, exp: num.exp, line: st.error ? '' : st.line,
        second: st.second, hyp: st.hyp, angle: st.angle, mem: st.mem !== 0,
        fmt: st.fmt, fix: st.fix, parens: st.parenAt.length, error: st.error, awaitFix: st.awaitFix,
        hasResult: !st.error && !st.entering && !st.lastWasOp,
      };
    }

    return {
      press,
      pressAll(keys) { keys.forEach(press); return this; },
      view,
      value: () => (st.error ? NaN : st.entering ? entryValue() : st.cur),
    };
  }

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

  // ---------- keypad layout: [key, label, 2nd label, style, extra] ----------
  const LAYOUT = [
    [['2nd', '2nd', '', 'k-2nd'], ['drg', 'DRG', 'DRG▸', 'k-fn'], ['log', 'LOG', '10ˣ', 'k-fn'], ['ln', 'LN', 'eˣ', 'k-fn'], ['cec', 'CE/C', '', 'k-fn']],
    [['hyp', 'HYP', '', 'k-fn'], ['sin', 'SIN', 'SIN⁻¹', 'k-fn'], ['cos', 'COS', 'COS⁻¹', 'k-fn'], ['tan', 'TAN', 'TAN⁻¹', 'k-fn'], ['pow', 'yˣ', 'ˣ√y', 'k-fn']],
    [['pi', 'π', 'x⇄y', 'k-fn'], ['inv', '1/x', '', 'k-fn'], ['sq', 'x²', 'x³', 'k-fn'], ['sqrt', '√x', '³√x', 'k-fn'], ['div', '÷', '', 'k-op']],
    [['fact', 'x!', 'nCr', 'k-fn'], ['ee', 'EE', 'FIX', 'k-fn'], ['(', '(', '', 'k-fn'], [')', ')', '', 'k-fn'], ['mul', '×', '', 'k-op']],
    [['sto', 'STO', 'EXC', 'k-fn'], ['7', '7', 'FLO', 'k-num'], ['8', '8', 'SCI', 'k-num'], ['9', '9', 'ENG', 'k-num'], ['sub', '−', '', 'k-op']],
    [['rcl', 'RCL', 'SUM', 'k-fn'], ['4', '4', '', 'k-num'], ['5', '5', '', 'k-num'], ['6', '6', '', 'k-num'], ['add', '+', '', 'k-op']],
    [['ans', 'Ans', '', 'k-fn'], ['1', '1', '', 'k-num'], ['2', '2', '%', 'k-num'], ['3', '3', '', 'k-num'], ['eq', '=', '', 'k-op k-eq', 'tall']],
    [['del', '⌫', '', 'k-fn'], ['0', '0', '', 'k-num'], ['.', '•', '', 'k-num'], ['neg', '+/−', '', 'k-num']],
  ];
  const KEYBOARD = {
    0: '0', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
    '.': '.', ',': '.', '+': 'add', '-': 'sub', '*': 'mul', x: 'mul', '/': 'div', '^': 'pow',
    '(': '(', ')': ')', Enter: 'eq', '=': 'eq', Backspace: 'del', Delete: 'cec', e: 'ee', E: 'ee',
  };

  // ---------- panel ----------
  function mount(opts) {
    const t = opts.t;
    const engine = createEngine();
    const el = {
      fab: document.getElementById('calc-fab'),
      panel: document.getElementById('calc-panel'),
      keys: document.getElementById('calc-keys'),
      line: document.getElementById('calc-line'),
      ind: document.getElementById('calc-ind'),
      main: document.getElementById('calc-main'),
      exp: document.getElementById('calc-exp'),
      sf: document.getElementById('calc-sf'),
      use: document.getElementById('calc-use'),
      close: document.getElementById('calc-close'),
      question: document.getElementById('calc-question'),
    };

    el.keys.innerHTML = LAYOUT.map((row) => row.map(([k, label, second, cls, extra]) =>
      `<div class="kc${extra === 'tall' ? ' kc-tall' : ''}"><span class="k2">${second}</span><button type="button" class="tk ${cls}" data-k="${k}" aria-label="${label}${second ? ' (2nd: ' + second + ')' : ''}">${label}</button></div>`,
    ).join('')).join('');

    function render() {
      const v = engine.view();
      el.line.textContent = v.line;
      el.main.textContent = v.main === 'Error' || v.main.includes('.') ? v.main : v.main + '.';
      el.exp.textContent = v.exp === null ? '' : v.exp;
      el.exp.hidden = v.exp === null;
      el.ind.innerHTML = [
        v.second || v.awaitFix ? '2nd' : '', v.hyp ? 'HYP' : '', v.mem ? 'M' : '',
        v.parens ? '( )' : '', v.fmt !== 'FLO' ? v.fmt : '', v.fix !== null ? 'FIX' : '', v.angle,
      ].map((s) => `<span>${s}</span>`).join('');
      el.panel.classList.toggle('second-on', v.second);
      const val = engine.value();
      el.sf.textContent = v.hasResult && isFinite(val) && (v.line || val !== 0) ? `${t('calc.sf')} ${opts.fmt ? opts.fmt(val) : Number(val.toPrecision(3))}` : t('calc.hint');
      refreshUse();
    }

    function refreshUse() {
      const target = opts.answerTarget();
      const val = engine.value();
      el.use.hidden = !(target && isFinite(val) && !engine.view().error);
      const q = opts.questionText ? opts.questionText() : '';
      el.question.hidden = !q;
      el.question.textContent = q || '';
    }

    function press(k) { engine.press(k); render(); }

    function open() {
      el.panel.hidden = false;
      el.fab.setAttribute('aria-expanded', 'true');
      el.fab.classList.add('behind-panel');
      render();
      el.panel.focus({ preventScroll: true });
    }
    function close() {
      el.panel.hidden = true;
      el.fab.setAttribute('aria-expanded', 'false');
      el.fab.classList.remove('behind-panel');
      el.fab.focus({ preventScroll: true });
    }

    el.keys.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) press(b.dataset.k);
    });
    document.getElementById('calc-onac').addEventListener('click', () => press('onac'));
    el.panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      const k = KEYBOARD[e.key];
      if (k && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        press(k);
      }
      e.stopPropagation(); // keys pressed on the calculator never answer a quiz question
    });
    el.fab.addEventListener('click', () => (el.panel.hidden ? open() : close()));
    el.close.addEventListener('click', close);
    el.use.addEventListener('click', () => {
      const target = opts.answerTarget();
      const val = engine.value();
      if (!target || !isFinite(val)) return;
      target.value = forAnswerBox(val);
      close();
      target.focus();
    });

    render();
    return { open, close, refresh: render, get isOpen() { return !el.panel.hidden; } };
  }

  const api = { createEngine, formatNumber, forAnswerBox, mount, LAYOUT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PhysicsCalculator = api;
})(typeof window !== 'undefined' ? window : globalThis);
