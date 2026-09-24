/*
 * Physics Quest — app shell: language, navigation, difficulty, quiz rounds,
 * School mode (lessons, exercises, exams, graduation), XP/levels and progress.
 */
(function () {
  'use strict';

  const Q = window.PhysicsQuestions;
  const S = window.PhysicsSchool;
  const I18N = window.I18N;
  const t = I18N.t;
  const tr = I18N.tr;
  const ROUND_LENGTH = 10;
  const STORAGE_KEY = 'physics-quest-v1';

  const $ = (id) => document.getElementById(id);
  const topicById = Object.fromEntries(Q.TOPICS.map((tp) => [tp.id, tp]));
  const ltr = (s) => `<bdi dir="ltr">${s}</bdi>`;

  // School rounds use Beginner numbers (g = 10). Exercises show the formula; exams don't.
  const SCHOOL_DIFF = Object.assign({}, Q.DIFF.beginner, { id: 'school', formula: 'always', timer: 0, lives: 0, typed: false, xpMult: 1 });
  const EXAM_DIFF = Object.assign({}, SCHOOL_DIFF, { formula: 'none' });

  // ---------- persistence ----------
  function freshSchool() {
    return { lessons: {}, exams: {}, final: { best: 0, passed: false, date: null }, name: '' };
  }

  function freshStats() {
    const topics = {};
    Q.TOPICS.forEach((tp) => (topics[tp.id] = { attempts: 0, correct: 0, recent: [] }));
    const best = {};
    Q.DIFFICULTIES.forEach((d) => (best[d.id] = null));
    let lang = 'en';
    try { if ((navigator.language || '').toLowerCase().startsWith('ar')) lang = 'ar'; } catch (e) { /* ignore */ }
    return {
      xp: 0, answered: 0, correct: 0, bestStreak: 0,
      lang,
      difficulty: 'beginner',
      best,
      topics,
      school: freshSchool(),
      lab: { hits: 0, shots: 0, levels: { beginner: 1, medium: 1, hard: 1, hardcore: 1 } },
      dayStreak: 0, bestDayStreak: 0, lastDay: null,
      todayDate: null, todayCount: 0, goal: 20,
    };
  }

  function load() {
    const base = freshStats();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        Object.assign(base, saved);
        const fresh = freshStats();
        base.topics = Object.assign(fresh.topics, saved.topics || {});
        base.best = Object.assign(fresh.best, saved.best || {});
        base.lab = Object.assign(fresh.lab, saved.lab || {});
        base.lab.levels = Object.assign(fresh.lab.levels, (saved.lab && saved.lab.levels) || {});
        base.school = Object.assign(freshSchool(), saved.school || {});
        base.school.final = Object.assign(freshSchool().final, (saved.school && saved.school.final) || {});
        // Saves from before difficulty levels existed were played on what is now Medium.
        if (!saved.difficulty) {
          base.difficulty = 'medium';
          if (saved.lab && saved.lab.level) base.lab.levels.medium = saved.lab.level;
        }
        if (!Q.DIFF[base.difficulty]) base.difficulty = 'medium';
        if (!saved.lang) base.lang = fresh.lang;
      }
    } catch (e) { /* storage unavailable or corrupt: start fresh */ }
    return base;
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (e) { /* ignore */ }
  }

  let stats = load();
  I18N.set(stats.lang);
  const diff = () => Q.DIFF[stats.difficulty];

  // ---------- dates & streaks ----------
  function dayKey(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function today() { return dayKey(new Date()); }
  function yesterday() { const d = new Date(); return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)); }

  function currentDayStreak() {
    return stats.lastDay === today() || stats.lastDay === yesterday() ? stats.dayStreak : 0;
  }
  function todayCount() {
    return stats.todayDate === today() ? stats.todayCount : 0;
  }

  function touchDay() {
    const d = today();
    if (stats.lastDay !== d) {
      stats.dayStreak = stats.lastDay === yesterday() ? stats.dayStreak + 1 : 1;
      stats.lastDay = d;
      stats.bestDayStreak = Math.max(stats.bestDayStreak, stats.dayStreak);
    }
    if (stats.todayDate !== d) { stats.todayDate = d; stats.todayCount = 0; }
  }

  // ---------- XP & levels ----------
  function levelInfo(xp) {
    let level = 1, need = 100;
    while (xp >= need) { xp -= need; level++; need = 100 + (level - 1) * 50; }
    const titles = I18N.LEVEL_TITLES[I18N.lang] || I18N.LEVEL_TITLES.en;
    return { level, into: xp, need, title: titles[Math.min(level - 1, titles.length - 1)] };
  }

  function addXp(amount) {
    const before = levelInfo(stats.xp).level;
    stats.xp += amount;
    const after = levelInfo(stats.xp);
    if (after.level > before) toast(t('toast.levelUp', { n: after.level, title: after.title }));
  }

  function mastery(topicId) {
    const r = stats.topics[topicId].recent;
    if (!r.length) return null;
    return r.filter(Boolean).length / r.length;
  }

  function accuracyMap() {
    const m = {};
    Q.TOPICS.forEach((tp) => { const v = mastery(tp.id); if (v !== null) m[tp.id] = v; });
    return m;
  }

  // ---------- language ----------
  function applyStaticText() {
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.title = t('app.name');
    $('set-lang').value = I18N.lang;
  }

  function setLanguage(lang) {
    if (lang === I18N.lang) return;
    stats.lang = lang;
    I18N.set(lang);
    save();
    applyStaticText();
    renderDiffPickers();
    renderFormulas();
    renderHud();
    lab.retext();
    // Re-render the screen that is open (a question already on screen stays in its language).
    if (currentView === 'lesson') renderLesson();
    else if (currentView === 'graduation') renderGraduation();
    else if (currentView === 'quiz') renderQuizChrome();
    else if (!['summary'].includes(currentView)) showView(currentView);
  }

  $('lang-toggle').addEventListener('click', () => setLanguage(I18N.lang === 'ar' ? 'en' : 'ar'));
  $('set-lang').addEventListener('change', (e) => setLanguage(e.target.value));

  // ---------- difficulty picker ----------
  function renderDiffPickers() {
    document.querySelectorAll('.diff-slot').forEach((slot) => {
      const compact = slot.classList.contains('compact');
      slot.innerHTML = '';
      const group = document.createElement('div');
      group.className = 'diff-picker';
      group.setAttribute('role', 'radiogroup');
      group.setAttribute('aria-label', t('diff.title'));
      Q.DIFFICULTIES.forEach((d) => {
        const b = document.createElement('button');
        const active = d.id === stats.difficulty;
        b.className = 'diff-opt diff-' + d.id + (active ? ' active' : '');
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(active));
        b.setAttribute('aria-label', tr(d.name));
        b.title = tr(d.name);
        b.innerHTML = `<span class="diff-icon">${d.icon}</span><span class="diff-name">${tr(d.name)}</span>`;
        b.addEventListener('click', () => setDifficulty(d.id));
        group.appendChild(b);
      });
      slot.appendChild(group);
      if (!compact) {
        const p = document.createElement('p');
        p.className = 'diff-blurb muted small';
        p.textContent = tr(diff().blurb) + (diff().xpMult > 1 ? ' ' + t('diff.xp', { n: diff().xpMult }) : '');
        slot.appendChild(p);
      }
    });
  }

  function setDifficulty(id) {
    if (id === stats.difficulty) return;
    stats.difficulty = id;
    save();
    renderDiffPickers();
    lab.setMode(id, stats.lab.levels[id] || 1);
  }

  // ---------- views ----------
  let currentView = 'home';

  function tabFor(view) {
    if (view === 'lesson' || view === 'graduation') return 'school';
    if (view === 'quiz' || view === 'summary') return round && round.kind !== 'quiz' ? 'school' : 'topics';
    return view;
  }

  function showView(name) {
    currentView = name;
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
    const tab = tabFor(name);
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === tab));
    if (name === 'home') renderHome();
    if (name === 'school') renderSchool();
    if (name === 'topics') renderTopics();
    if (name === 'progress') renderProgress();
    if (name === 'graduation') renderGraduation();
    if (name === 'lab') lab.resize();
    window.scrollTo(0, 0);
  }

  function leaveRoundThen(fn) {
    if (round && !round.done) {
      askConfirm(t('confirm.leave'), t('confirm.leaveBtn'), () => { stopTimer(); round = null; fn(); });
    } else {
      fn();
    }
  }

  document.querySelectorAll('.tab').forEach((b) =>
    b.addEventListener('click', () => leaveRoundThen(() => showView(b.dataset.view)))
  );

  // In-page confirmation (native confirm() dialogs are blocked in some hosts).
  let confirmAction = null;
  function askConfirm(message, yesLabel, onYes) {
    $('confirm-msg').textContent = message;
    $('confirm-yes').textContent = yesLabel;
    confirmAction = onYes;
    $('confirm').hidden = false;
    $('confirm-no').focus();
  }
  function closeConfirm(run) {
    const action = confirmAction;
    confirmAction = null;
    $('confirm').hidden = true;
    if (run && action) action();
  }
  $('confirm-yes').addEventListener('click', () => closeConfirm(true));
  $('confirm-no').addEventListener('click', () => closeConfirm(false));
  $('confirm').addEventListener('click', (e) => { if (e.target === $('confirm')) closeConfirm(false); });

  function renderHud() {
    const li = levelInfo(stats.xp);
    $('hud-level').textContent = li.level;
    $('hud-days').textContent = currentDayStreak();
    $('hud-xpfill').style.width = (100 * li.into / li.need) + '%';
    $('hud-xpfill').parentElement.title = t('hud.xpTo', { into: li.into, need: li.need, next: li.level + 1 });
  }

  function masteryLabel(m) {
    if (m === null) return t('mastery.none');
    if (m < 0.4) return t('mastery.weak');
    if (m < 0.75) return t('mastery.mid');
    return t('mastery.strong');
  }

  function weakestTopic() {
    let worst = null;
    Q.TOPICS.forEach((tp) => {
      const m = mastery(tp.id);
      if (m !== null && (worst === null || m < worst.m)) worst = { tp, m };
    });
    return worst;
  }

  function renderHome() {
    const count = todayCount();
    $('goal-count').textContent = t('home.goalCount', { n: count, goal: stats.goal });
    $('goal-fill').style.width = Math.min(100, (100 * count) / stats.goal) + '%';
    $('greeting').textContent = count >= stats.goal ? t('home.greetGoal')
      : stats.answered === 0 ? t('home.greetNew') : t('home.greetBack');
    $('home-xp').textContent = stats.xp;
    $('home-acc').textContent = stats.answered ? Math.round((100 * stats.correct) / stats.answered) + '%' : '–';
    $('home-best').textContent = stats.bestStreak;
    const w = weakestTopic();
    $('home-weak').textContent = w ? w.tp.icon + ' ' + tr(w.tp.name) : '–';
    const done = lessonsDone();
    if (graduated()) {
      $('school-cta-title').textContent = t('home.schoolGrad');
      $('school-cta-sub').textContent = t('home.schoolGradSub');
    } else if (done > 0) {
      $('school-cta-title').textContent = t('home.schoolGo');
      $('school-cta-sub').textContent = t('home.schoolGoSub', { done, total: S.LESSONS.length });
    } else {
      $('school-cta-title').textContent = t('home.schoolNew');
      $('school-cta-sub').textContent = t('home.schoolNewSub');
    }
  }

  function renderTopics() {
    const grid = $('topic-grid');
    grid.innerHTML = '';
    const smart = document.createElement('button');
    smart.className = 'card topic smart';
    smart.innerHTML = `<span class="topic-icon">🧠</span><b>${t('topics.smart')}</b><span class="muted small">${t('topics.smartSub')}</span>`;
    smart.addEventListener('click', () => startQuiz('smart'));
    grid.appendChild(smart);
    Q.TOPICS.forEach((tp) => {
      const m = mastery(tp.id);
      const b = document.createElement('button');
      b.className = 'card topic';
      b.innerHTML = `<span class="topic-icon">${tp.icon}</span><b>${tr(tp.name)}</b><span class="muted small">${tr(tp.blurb)}</span>
        <div class="bar thin"><div style="width:${m === null ? 0 : Math.round(m * 100)}%"></div></div>
        <span class="small muted">${masteryLabel(m)}${m === null ? '' : ' · ' + Math.round(m * 100) + '%'}</span>`;
      b.addEventListener('click', () => startQuiz(tp.id));
      grid.appendChild(b);
    });
  }

  function renderFormulas() {
    const grid = $('formula-grid');
    grid.innerHTML = '';
    Q.TOPICS.forEach((tp) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<h3>${tp.icon} ${tr(tp.name)}</h3>` +
        Q.FORMULAS[tp.id].map(([f, d]) => `<div class="formula"><code>${f}</code><span class="muted small">${tr(d)}</span></div>`).join('');
      grid.appendChild(card);
    });
  }

  function renderProgress() {
    const li = levelInfo(stats.xp);
    $('pr-level').textContent = li.level;
    $('pr-title').textContent = li.title;
    $('pr-answered').textContent = stats.answered;
    $('pr-days').textContent = currentDayStreak();
    $('pr-days-label').textContent = t('progress.days', { n: stats.bestDayStreak });
    $('pr-lab').textContent = stats.lab.hits;
    $('set-goal').value = String(stats.goal);
    $('best-list').innerHTML = Q.DIFFICULTIES.map((d) => {
      const b = stats.best[d.id];
      return `<div class="best diff-${d.id}"><span>${d.icon} ${tr(d.name)}</span><b>${b ? b.score + ' / ' + b.of : '–'}</b></div>`;
    }).join('') + `<div class="best diff-beginner"><span>🎓 ${t('tab.school')}</span><b>${lessonsDone()} / ${S.LESSONS.length}</b></div>`;
    $('mastery-list').innerHTML = Q.TOPICS.map((tp) => {
      const m = mastery(tp.id);
      const s = stats.topics[tp.id];
      const pct = m === null ? 0 : Math.round(m * 100);
      const tone = m === null ? '' : m < 0.4 ? 'bad' : m < 0.75 ? 'mid' : 'good';
      return `<div class="mastery">
        <span>${tp.icon} ${tr(tp.name)}</span>
        <div class="bar ${tone}"><div style="width:${pct}%"></div></div>
        <span class="small muted">${m === null ? t('progress.notStarted') : t('progress.answeredN', { p: pct, n: s.attempts })}</span>
      </div>`;
    }).join('');
  }

  $('set-goal').addEventListener('change', (e) => { stats.goal = +e.target.value; save(); renderHome(); });
  $('reset').addEventListener('click', () => {
    askConfirm(t('confirm.reset'), t('confirm.resetBtn'), () => {
      const keep = { difficulty: stats.difficulty, lang: stats.lang };
      stats = Object.assign(freshStats(), keep);
      save();
      renderHud();
      renderProgress();
      lab.setMode(keep.difficulty, 1);
      toast(t('toast.reset'));
    });
  });

  // ---------- School progress rules ----------
  const lessonRecord = (id) => stats.school.lessons[id] || null;
  const lessonDone = (id) => !!(lessonRecord(id) && lessonRecord(id).stars >= 2);
  function lessonsDone() { return S.LESSONS.filter((l) => lessonDone(l.id)).length; }
  const examRecord = (unitId) => stats.school.exams[unitId] || null;
  const examPassed = (unitId) => !!(examRecord(unitId) && examRecord(unitId).passed);
  const unitUnlocked = (ui) => ui === 0 || examPassed(S.UNITS[ui - 1].id);
  function lessonUnlocked(lesson) {
    if (!unitUnlocked(lesson.unitIndex)) return false;
    if (lesson.indexInUnit === 0) return true;
    return lessonDone(S.UNITS[lesson.unitIndex].lessons[lesson.indexInUnit - 1].id);
  }
  const unitExamUnlocked = (ui) => unitUnlocked(ui) && S.UNITS[ui].lessons.every((l) => lessonDone(l.id));
  const finalUnlocked = () => S.UNITS.every((u) => examPassed(u.id));
  const graduated = () => !!stats.school.final.passed;
  const stars = (n) => '⭐'.repeat(n) + '☆'.repeat(3 - n);

  function renderSchool() {
    const done = lessonsDone();
    const total = S.LESSONS.length;
    $('school-progress-text').textContent = t('school.progress', { done, total });
    $('school-progress-pct').textContent = Math.round((100 * done) / total) + '%';
    $('school-progress-fill').style.width = (100 * done) / total + '%';
    $('school-grad-banner').hidden = !graduated();

    const wrap = $('school-units');
    wrap.innerHTML = '';
    S.UNITS.forEach((unit, ui) => {
      const unlocked = unitUnlocked(ui);
      const doneInUnit = unit.lessons.filter((l) => lessonDone(l.id)).length;
      const card = document.createElement('div');
      card.className = 'card unit' + (unlocked ? '' : ' locked');
      card.innerHTML = `<div class="unit-head">
          <span class="unit-icon">${unit.icon}</span>
          <div class="unit-titles"><div class="unit-kicker">${t('school.unit', { n: ui + 1 })}</div><h3>${tr(unit.title)}</h3></div>
          <span class="unit-count">${examPassed(unit.id) ? '✅' : unlocked ? t('school.lessons', { done: doneInUnit, total: unit.lessons.length }) : '🔒'}</span>
        </div>`;
      const list = document.createElement('div');
      list.className = 'lesson-list';
      let nextMarked = false;
      unit.lessons.forEach((lesson) => {
        const rec = lessonRecord(lesson.id);
        const open = lessonUnlocked(lesson);
        const isDone = lessonDone(lesson.id);
        const isNext = open && !isDone && !nextMarked;
        if (isNext) nextMarked = true;
        const b = document.createElement('button');
        b.className = 'lesson-item' + (isDone ? ' done' : '') + (isNext ? ' next' : '') + (open ? '' : ' locked');
        b.disabled = !open;
        b.innerHTML = `<span class="lesson-num">${lesson.number}</span>
          <span class="lesson-name">${tr(lesson.title)}</span>
          <span class="lesson-state">${isDone ? stars(rec.stars) : open ? '▶' : '🔒'}</span>`;
        if (!open) b.setAttribute('aria-label', tr(lesson.title) + ' · ' + t('school.locked'));
        b.addEventListener('click', () => openLesson(lesson));
        list.appendChild(b);
      });
      card.appendChild(list);

      const examOpen = unitExamUnlocked(ui);
      const er = examRecord(unit.id);
      const exam = document.createElement('button');
      exam.className = 'exam-item' + (examPassed(unit.id) ? ' passed' : '') + (examOpen ? '' : ' locked');
      exam.disabled = !examOpen;
      exam.innerHTML = `<span class="exam-name"><b>${t('school.unitExam')}</b>
          <small>${examOpen ? t('school.examSub', { n: S.RULES.unitExamCount, p: Math.round(S.RULES.unitExamPass * 100) }) : t('school.examLocked')}</small></span>
        <span class="lesson-state">${examPassed(unit.id) ? t('school.passed', { s: er.best }) : er ? t('school.best', { s: er.best }) : examOpen ? '▶' : '🔒'}</span>`;
      exam.addEventListener('click', () => startUnitExam(unit));
      card.appendChild(exam);
      wrap.appendChild(card);
    });

    const fOpen = finalUnlocked();
    const fr = stats.school.final;
    const final = document.createElement('button');
    final.className = 'card final-card' + (fOpen ? '' : ' locked') + (fr.passed ? ' passed' : '');
    final.disabled = !fOpen;
    final.innerHTML = `<span class="final-icon">🎓</span>
      <span class="exam-name"><b>${t('school.final')}</b>
        <small>${fOpen ? t('school.examSub', { n: S.RULES.finalCount, p: Math.round(S.RULES.finalPass * 100) }) : t('school.finalLocked')}</small></span>
      <span class="lesson-state">${fr.passed ? t('school.passed', { s: fr.best }) : fr.best ? t('school.best', { s: fr.best }) : fOpen ? '▶' : '🔒'}</span>`;
    final.addEventListener('click', startFinalExam);
    wrap.appendChild(final);
  }

  $('school-grad-banner').addEventListener('click', () => showView('graduation'));
  $('btn-school').addEventListener('click', () => showView(graduated() ? 'graduation' : 'school'));

  // ---------- lessons ----------
  let lessonState = null;

  function openLesson(lesson) {
    lessonState = { lesson, index: 0 };
    showView('lesson');
    renderLesson();
  }

  function renderLesson() {
    if (!lessonState) return;
    const { lesson, index } = lessonState;
    const unit = S.UNITS[lesson.unitIndex];
    const card = lesson.cards[index];
    const last = index === lesson.cards.length - 1;
    $('lesson-kicker').textContent = `${unit.icon} ${t('school.unit', { n: lesson.unitIndex + 1 })} · ${t('lesson.label', { n: lesson.number })}`;
    $('lesson-title').textContent = tr(lesson.title);
    $('lesson-body').innerHTML = `<p>${tr(card)}</p>`;
    $('lesson-card').classList.toggle('example', !!card.example);
    $('lesson-example-tag').hidden = !card.example;
    $('lesson-count').textContent = t('lesson.of', { n: index + 1, m: lesson.cards.length });
    $('lesson-dots').innerHTML = lesson.cards.map((_, i) => `<span class="${i === index ? 'on' : i < index ? 'seen' : ''}"></span>`).join('');
    $('lesson-prev').disabled = index === 0;
    $('lesson-next').hidden = last;
    $('lesson-practice').hidden = !last;
    (last ? $('lesson-practice') : $('lesson-next')).focus({ preventScroll: true });
  }

  $('lesson-prev').addEventListener('click', () => { if (lessonState.index > 0) { lessonState.index--; renderLesson(); } });
  $('lesson-next').addEventListener('click', () => {
    if (lessonState.index < lessonState.lesson.cards.length - 1) { lessonState.index++; renderLesson(); }
  });
  $('lesson-practice').addEventListener('click', () => startLessonExercises(lessonState.lesson));
  $('lesson-exit').addEventListener('click', () => showView('school'));

  // ---------- rounds (quiz, lesson exercises, exams) ----------
  let round = null;

  function startRound(cfg) {
    stopTimer();
    round = Object.assign({
      index: 0, score: 0, streak: 0, xp: 0, log: [], prompts: new Set(),
      current: null, answered: false, done: false, peeked: false,
      lives: cfg.diff.lives || null, timerId: null, deadline: 0,
    }, cfg);
    showView('quiz');
    nextQuestion();
  }

  const kindLabel = (q) => (q.kind === 'concept' ? t('quiz.concept') : t('quiz.calc'));
  const topicLabel = (q) => (topicById[q.topic] ? `${topicById[q.topic].icon} ${tr(topicById[q.topic].name)}` : '');

  function startQuiz(mode) {
    const d = diff();
    startRound({
      kind: 'quiz', mode, diff: d, length: ROUND_LENGTH, exam: false, dedupe: true,
      next: () => Q.generate(mode === 'smart' ? Q.pickWeightedTopic(accuracyMap()) : mode, d.id, I18N.lang),
      label: (q) => `${d.icon} ${tr(d.name)} · ${topicLabel(q)} · ${kindLabel(q)}`,
      finish: finishQuiz,
      retry: () => startQuiz(mode),
    });
  }

  function startLessonExercises(lesson) {
    const set = S.buildSet([lesson], S.RULES.exerciseCount, I18N.lang);
    startRound({
      kind: 'lesson', lesson, diff: SCHOOL_DIFF, length: set.length, exam: false,
      next: (r) => set[r.index],
      label: (q) => `🎓 ${t('lesson.label', { n: lesson.number })} · ${tr(lesson.title)} · ${kindLabel(q)}`,
      finish: finishLesson,
      retry: () => startLessonExercises(lesson),
    });
  }

  function startUnitExam(unit) {
    const ui = S.UNITS.indexOf(unit);
    const set = S.buildSet(unit.lessons, S.RULES.unitExamCount, I18N.lang);
    startRound({
      kind: 'exam', unit, diff: EXAM_DIFF, length: set.length, exam: true,
      next: (r) => set[r.index],
      label: () => `📝 ${t('exam.label', { n: ui + 1 })} · ${unit.icon} ${tr(unit.title)}`,
      finish: finishExam,
      retry: () => startUnitExam(unit),
    });
  }

  function startFinalExam() {
    const set = S.buildSet(S.LESSONS, S.RULES.finalCount, I18N.lang);
    startRound({
      kind: 'final', diff: EXAM_DIFF, length: set.length, exam: true,
      next: (r) => set[r.index],
      label: (q) => `🎓 ${t('final.label')} · ${topicLabel(q) || '📏'}`,
      finish: finishFinal,
      retry: startFinalExam,
    });
  }

  function renderLives() {
    const el = $('quiz-lives');
    if (!round.diff.lives) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = '❤️'.repeat(round.lives) + '🖤'.repeat(round.diff.lives - round.lives);
  }

  // Text around the question that depends on the language (safe to redraw any time).
  function renderQuizChrome() {
    if (!round || !round.current) return;
    const q = round.current;
    const d = round.diff;
    $('q-topic').textContent = round.label(q);
    $('quiz-count').textContent = `${round.index + 1} / ${round.length}`;
    $('quiz-tip').textContent = round.exam ? t('quiz.tipExam')
      : q.kind === 'typed' ? t('quiz.tipTyped')
        : t('quiz.tipMcq') + (d.g === 10 ? t('quiz.tipG10') : '');
    if (q.formula && q.kind !== 'concept') $('q-formula').innerHTML = `${t('quiz.use')} ${ltr(q.formula)}`;
    if (round.answered) $('q-next').textContent = isLastQuestion() ? t('quiz.results') : t('quiz.next');
  }

  function isLastQuestion() {
    return round.index + 1 >= round.length || round.lives === 0;
  }

  function nextQuestion() {
    if (round.index >= round.length) return endRound();
    const d = round.diff;
    let q;
    for (let tries = 0; tries < (round.dedupe ? 8 : 1); tries++) {
      q = round.next(round);
      if (!round.prompts.has(q.prompt)) break;
    }
    round.prompts.add(q.prompt);
    round.current = q;
    round.answered = false;
    round.peeked = false;

    $('q-prompt').textContent = q.prompt;
    $('quiz-fill').style.width = (100 * round.index) / round.length + '%';
    $('quiz-streak').textContent = '🔥 ' + round.streak;
    $('quiz-streak').hidden = round.exam;
    $('q-feedback').hidden = true;
    $('q-next').hidden = true;
    renderLives();

    // formula help
    const hasFormula = q.kind !== 'concept' && q.formula;
    $('q-formula').hidden = !(hasFormula && d.formula === 'always');
    $('q-peek').hidden = !(hasFormula && d.formula === 'peek');

    // answer area
    const box = $('q-choices');
    box.innerHTML = '';
    const isTyped = q.kind === 'typed';
    box.hidden = isTyped;
    $('q-typed').hidden = !isTyped;
    if (isTyped) {
      $('q-input').value = '';
      $('q-input').disabled = false;
      $('q-check').disabled = false;
      $('q-typed').className = 'typed';
      $('q-unit').textContent = q.unit;
      $('q-input').focus();
    } else {
      q.choices.forEach((c, i) => {
        const b = document.createElement('button');
        b.className = 'choice';
        b.innerHTML = `<span class="key">${i + 1}</span><span class="choice-text" dir="auto"></span>`;
        b.lastChild.textContent = c;
        b.addEventListener('click', () => answer(i));
        box.appendChild(b);
      });
    }
    renderQuizChrome();
    startTimer();
  }

  // ---------- timer ----------
  function startTimer() {
    stopTimer();
    const secs = round.diff.timer;
    $('quiz-timer').hidden = !secs;
    if (!secs) return;
    round.deadline = performance.now() + secs * 1000;
    round.timerId = setInterval(tick, 100);
    tick();
  }
  function stopTimer() {
    if (round && round.timerId) { clearInterval(round.timerId); round.timerId = null; }
  }
  function timeLeftFraction() {
    if (!round.diff.timer) return 0;
    return Math.max(0, round.deadline - performance.now()) / (round.diff.timer * 1000);
  }
  function tick() {
    if (!round || round.answered) return stopTimer();
    const frac = timeLeftFraction();
    const secs = Math.ceil(frac * round.diff.timer);
    $('quiz-timer-fill').style.width = frac * 100 + '%';
    $('quiz-timer-text').textContent = '⏱ ' + secs + ' s';
    $('quiz-timer').classList.toggle('low', secs <= 10);
    if (frac <= 0) resolve(false, t('quiz.outOfTime'), { timeout: true });
  }

  // ---------- answering ----------
  function answer(i) {
    if (!round || round.answered || round.current.kind === 'typed') return;
    const q = round.current;
    resolve(i === q.correctIndex, q.choices[i], { choiceIndex: i });
  }

  $('q-typed').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!round || round.answered) return;
    const text = $('q-input').value.trim();
    if (!text) { $('q-input').focus(); return; }
    if (!isFinite(Q.parseAnswer(text))) {
      toast(t('quiz.typeNumber'));
      $('q-input').focus();
      return;
    }
    const q = round.current;
    resolve(Q.checkTyped(q, text), text + (q.unit ? ' ' + q.unit : ''), {});
  });

  $('q-peek').addEventListener('click', () => {
    if (!round || round.answered) return;
    round.peeked = true;
    $('q-peek').hidden = true;
    $('q-formula').hidden = false;
  });

  function resolve(ok, chosenText, opts) {
    const q = round.current;
    const d = round.diff;
    const frac = timeLeftFraction();
    round.answered = true;
    stopTimer();

    if (q.kind === 'typed') {
      $('q-input').disabled = true;
      $('q-check').disabled = true;
      $('q-typed').className = 'typed ' + (ok ? 'correct' : 'wrong');
    } else {
      const buttons = $('q-choices').children;
      for (let k = 0; k < buttons.length; k++) {
        buttons[k].disabled = true;
        if (round.exam) {
          if (k === opts.choiceIndex) buttons[k].classList.add('picked');
        } else if (k === q.correctIndex) buttons[k].classList.add('correct');
        else if (k === opts.choiceIndex) buttons[k].classList.add('wrong');
      }
    }

    // record stats
    touchDay();
    stats.todayCount++;
    stats.answered++;
    const ts = stats.topics[q.topic];
    if (ts) {
      ts.attempts++;
      ts.recent.push(ok);
      if (ts.recent.length > 20) ts.recent.shift();
    }

    let gained = 0, speedBonus = 0;
    if (ok) {
      round.score++;
      round.streak++;
      stats.correct++;
      if (ts) ts.correct++;
      stats.bestStreak = Math.max(stats.bestStreak, round.streak);
      if (!round.exam) {
        speedBonus = d.timer ? Math.round(5 * frac) : 0;
        const base = 10 + Math.min(round.streak - 1, 5) * 2 + speedBonus;
        gained = Math.round(base * d.xpMult * (round.peeked ? 0.5 : 1));
        round.xp += gained;
        addXp(gained);
      }
    } else {
      round.streak = 0;
      if (d.lives) round.lives--;
    }
    if (todayCount() === stats.goal) toast(t('toast.goal'));
    save();
    renderHud();
    renderLives();

    round.log.push({ q, chosenText, ok });
    const fb = $('q-feedback');
    fb.hidden = false;
    fb.innerHTML = '';
    if (round.exam) {
      fb.className = 'feedback neutral';
      fb.textContent = t('quiz.saved');
    } else {
      fb.className = 'feedback ' + (ok ? 'good' : 'bad');
      const head = document.createElement('div');
      if (ok) {
        head.innerHTML = `<b>${t('quiz.correct')}</b> +${gained} XP` +
          (speedBonus ? ` <span class="small">${t('quiz.speedBonus')}</span>` : '') +
          (round.peeked ? ` <span class="small">${t('quiz.peekHalf')}</span>` : '') +
          (round.streak >= 3 ? ` · ${t('quiz.inARow', { n: round.streak })}` : '');
      } else {
        head.innerHTML = `<b>${opts.timeout ? t('quiz.timeUp') : t('quiz.wrong')}</b> ${t('quiz.answerIs')}: <b class="ans" dir="auto"></b>`;
        head.querySelector('.ans').textContent = q.answerText;
        if (q.kind === 'typed' && !opts.timeout) {
          const yours = document.createElement('div');
          yours.className = 'small';
          yours.textContent = t('quiz.youTyped', { x: chosenText });
          head.appendChild(yours);
        }
      }
      fb.appendChild(head);
      const p = document.createElement('p');
      p.textContent = q.explanation;
      fb.appendChild(p);
      if (round.lives === 0) {
        const over = document.createElement('p');
        over.innerHTML = `<b>${t('quiz.outOfLives')}</b>`;
        fb.appendChild(over);
      }
    }

    $('quiz-streak').textContent = '🔥 ' + round.streak;
    $('q-next').hidden = false;
    $('q-next').textContent = isLastQuestion() ? t('quiz.results') : t('quiz.next');
    $('q-next').focus();
  }

  $('q-next').addEventListener('click', () => {
    if (round.lives === 0) return endRound();
    round.index++;
    nextQuestion();
  });

  $('quiz-quit').addEventListener('click', () => {
    if (round.kind === 'quiz') {
      stopTimer();
      if (round.index > 0 || round.answered) endRound();
      else { round = null; showView('topics'); }
    } else {
      const kind = round.kind;
      leaveRoundThen(() => showView(kind === 'lesson' ? 'lesson' : 'school'));
    }
  });

  function endRound() {
    stopTimer();
    round.done = true;
    round.finish(round);
  }

  // ---------- summaries ----------
  function renderSummary({ emoji, title, sub, extra, actions, showXp }) {
    const answered = round.log.length;
    $('sum-emoji').textContent = emoji;
    $('sum-title').textContent = title;
    $('sum-sub').textContent = sub || '';
    $('sum-sub').hidden = !sub;
    $('sum-score').innerHTML = `<b>${t('sum.score', { a: round.score, b: answered })}</b>` + (showXp ? ` · <b>+${round.xp} XP</b>` : '');
    $('sum-extra').hidden = !extra;
    $('sum-extra').textContent = extra || '';
    const box = $('sum-actions');
    box.innerHTML = '';
    actions.forEach((a) => {
      const b = document.createElement('button');
      b.className = 'btn' + (a.primary ? ' primary' : '');
      b.textContent = a.label;
      b.addEventListener('click', a.run);
      box.appendChild(b);
    });

    const review = $('sum-review');
    review.innerHTML = '';
    const missed = round.log.filter((l) => !l.ok);
    if (missed.length) {
      const h = document.createElement('h3');
      h.textContent = t('sum.review', { n: missed.length });
      review.appendChild(h);
      missed.forEach((l) => {
        const card = document.createElement('div');
        card.className = 'card review';
        card.innerHTML = `<p class="q-prompt"></p><p class="small"><span class="tag bad">${t('sum.youSaid')}</span> <span dir="auto"></span></p><p class="small"><span class="tag good">${t('sum.answer')}</span> <span dir="auto"></span></p><p class="muted small"></p>`;
        const ps = card.querySelectorAll('p');
        ps[0].textContent = l.q.prompt;
        ps[1].lastChild.textContent = l.chosenText;
        ps[2].lastChild.textContent = l.q.answerText;
        ps[3].textContent = l.q.explanation;
        review.appendChild(card);
      });
    }
    showView('summary');
  }

  function finishQuiz(r) {
    const d = r.diff;
    const answered = r.log.length;
    const pct = answered ? r.score / answered : 0;
    const gameOver = r.lives === 0;
    const perfect = answered === ROUND_LENGTH && r.score === ROUND_LENGTH;
    if (perfect) {
      const bonus = Math.round(25 * d.xpMult);
      addXp(bonus);
      r.xp += bonus;
      toast(t('toast.perfect', { n: bonus }));
    }
    if (answered) {
      const prev = stats.best[d.id];
      if (!prev || r.score > prev.score) {
        stats.best[d.id] = { score: r.score, of: ROUND_LENGTH };
        if (prev && !perfect) toast(t('toast.best', { d: tr(d.name), s: r.score, t: ROUND_LENGTH }));
      }
    }
    save();
    renderHud();
    renderSummary({
      emoji: gameOver ? '💀' : pct === 1 ? '🏆' : pct >= 0.7 ? '🎉' : pct >= 0.4 ? '💪' : '📖',
      title: gameOver ? t('sum.outOfLives') : pct === 1 ? t('sum.perfect') : pct >= 0.7 ? t('sum.great') : pct >= 0.4 ? t('sum.good') : t('sum.lesson'),
      sub: `${d.icon} ${tr(d.name)}` + (gameOver ? ' · ' + t('sum.survived', { n: answered }) : ''),
      showXp: true,
      actions: [
        { label: t('sum.again'), primary: true, run: () => startQuiz(r.mode) },
        { label: t('sum.topics'), run: () => { round = null; showView('topics'); } },
      ],
    });
  }

  function finishLesson(r) {
    const lesson = r.lesson;
    const passed = r.score >= S.RULES.exercisePass;
    const earned = r.score === S.RULES.exerciseCount ? 3 : passed ? 2 : 0;
    const prev = lessonRecord(lesson.id);
    const firstPass = passed && !lessonDone(lesson.id);
    stats.school.lessons[lesson.id] = {
      stars: Math.max(earned, prev ? prev.stars : 0),
      best: Math.max(r.score, prev ? prev.best : 0),
    };
    if (firstPass) { addXp(S.RULES.xpLesson); r.xp += S.RULES.xpLesson; }
    save();
    renderHud();

    const unit = S.UNITS[lesson.unitIndex];
    const nextInUnit = unit.lessons[lesson.indexInUnit + 1];
    const toSchool = { label: t('ex.toSchool'), run: () => showView('school') };
    let actions;
    if (passed) {
      actions = nextInUnit
        ? [{ label: t('ex.nextLesson'), primary: true, run: () => openLesson(nextInUnit) }, toSchool]
        : examPassed(unit.id) ? [toSchool]
          : [{ label: t('ex.toExam'), primary: true, run: () => startUnitExam(unit) }, toSchool];
    } else {
      actions = [
        { label: t('ex.retry'), primary: true, run: r.retry },
        { label: t('ex.reviewLesson'), run: () => openLesson(lesson) },
        toSchool,
      ];
    }
    renderSummary({
      emoji: earned === 3 ? '🌟' : passed ? '✅' : '📖',
      title: passed ? t('ex.passTitle') : t('ex.failTitle'),
      sub: `🎓 ${tr(lesson.title)}`,
      extra: passed ? t('ex.passMsg', { stars: stars(earned) }) + (firstPass ? ' · ' + t('ex.xp', { xp: S.RULES.xpLesson }) : '')
        : t('ex.failMsg', { need: S.RULES.exercisePass, n: S.RULES.exerciseCount }),
      showXp: true,
      actions,
    });
  }

  function finishExam(r) {
    const unit = r.unit;
    const ui = S.UNITS.indexOf(unit);
    const pct = Math.round((100 * r.score) / r.length);
    const passed = pct >= S.RULES.unitExamPass * 100;
    const prev = examRecord(unit.id);
    const firstPass = passed && !examPassed(unit.id);
    stats.school.exams[unit.id] = { best: Math.max(pct, prev ? prev.best : 0), passed: passed || examPassed(unit.id) };
    if (firstPass) { addXp(S.RULES.xpUnitExam); r.xp += S.RULES.xpUnitExam; }
    save();
    renderHud();

    const nextUnit = S.UNITS[ui + 1];
    const toSchool = { label: t('ex.toSchool'), run: () => showView('school') };
    let extra, actions;
    if (passed) {
      extra = (finalUnlocked() ? t('exam.unlockFinal') : t('exam.unlockNext')) + (firstPass ? ' · ' + t('ex.xp', { xp: S.RULES.xpUnitExam }) : '');
      actions = nextUnit
        ? [{ label: t('exam.nextUnit'), primary: true, run: () => openLesson(nextUnit.lessons[0]) }, toSchool]
        : [{ label: t('exam.toFinal'), primary: true, run: startFinalExam }, toSchool];
      if (!nextUnit && !finalUnlocked()) actions = [toSchool];
    } else {
      extra = t('exam.failMsg', { p: Math.round(S.RULES.unitExamPass * 100) });
      actions = [{ label: t('ex.retry'), primary: true, run: r.retry }, toSchool];
    }
    renderSummary({
      emoji: passed ? '🏅' : '📖',
      title: passed ? t('exam.passTitle') : t('exam.failTitle'),
      sub: `📝 ${t('exam.label', { n: ui + 1 })} · ${t('exam.score', { s: pct })}`,
      extra, actions, showXp: firstPass,
    });
  }

  function finishFinal(r) {
    const pct = Math.round((100 * r.score) / r.length);
    const passed = pct >= S.RULES.finalPass * 100;
    const f = stats.school.final;
    const firstPass = passed && !f.passed;
    f.best = Math.max(pct, f.best || 0);
    if (passed) {
      f.passed = true;
      if (!f.date) f.date = new Date().toISOString();
    }
    if (firstPass) { addXp(S.RULES.xpFinal); r.xp += S.RULES.xpFinal; }
    save();
    renderHud();
    const toSchool = { label: t('ex.toSchool'), run: () => showView('school') };
    renderSummary({
      emoji: passed ? '🎓' : '📖',
      title: passed ? t('final.passTitle') : t('final.failTitle'),
      sub: `🎓 ${t('final.label')} · ${t('exam.score', { s: pct })}`,
      extra: passed ? (firstPass ? t('ex.xp', { xp: S.RULES.xpFinal }) : '') : t('final.failMsg', { p: Math.round(S.RULES.finalPass * 100) }),
      showXp: firstPass,
      actions: passed
        ? [{ label: t('final.graduate'), primary: true, run: () => { round = null; showView('graduation'); confetti(); } }, toSchool]
        : [{ label: t('ex.retry'), primary: true, run: r.retry }, toSchool],
    });
    if (firstPass) confetti();
  }

  // ---------- graduation ----------
  function renderGraduation() {
    const hasName = !!stats.school.name;
    $('grad-form').hidden = hasName;
    $('grad-name-input').value = stats.school.name || '';
    $('certificate').hidden = !hasName;
    $('grad-actions').hidden = !hasName;
    if (!hasName) return;
    const f = stats.school.final;
    const score = f.best || 0;
    $('cert-name').textContent = stats.school.name;
    $('cert-body').textContent = t('cert.body', { s: score });
    $('cert-grade').textContent = score >= 90 ? t('grade.honours') : score >= 80 ? t('grade.vgood') : t('grade.good');
    let dateText = '';
    try {
      dateText = new Date(f.date || Date.now()).toLocaleDateString(I18N.lang === 'ar' ? 'ar' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) { dateText = (f.date || '').slice(0, 10); }
    $('cert-date').textContent = dateText;
  }

  $('grad-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('grad-name-input').value.trim();
    if (!name) { $('grad-name-input').focus(); return; }
    stats.school.name = name;
    save();
    renderGraduation();
    confetti();
  });
  $('grad-edit').addEventListener('click', () => {
    $('grad-form').hidden = false;
    $('grad-name-input').focus();
  });
  $('grad-next').addEventListener('click', () => {
    if (stats.difficulty === 'beginner') setDifficulty('medium');
    showView('topics');
  });
  $('grad-school').addEventListener('click', () => showView('school'));

  function confetti() {
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) { /* ignore */ }
    const canvas = $('confetti');
    const ctx = canvas.getContext('2d');
    canvas.hidden = false;
    const w = (canvas.width = window.innerWidth);
    const h = (canvas.height = window.innerHeight);
    const colors = ['#5b5bf0', '#1f9d55', '#e07b16', '#d42f45', '#2f74d8', '#f2c94c'];
    const bits = Array.from({ length: 160 }, () => ({
      x: Math.random() * w, y: -20 - Math.random() * h * 0.5,
      vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      s: 6 + Math.random() * 6, c: colors[Math.floor(Math.random() * colors.length)],
    }));
    const start = performance.now();
    function frame(now) {
      ctx.clearRect(0, 0, w, h);
      bits.forEach((b) => {
        b.x += b.vx; b.y += b.vy; b.vy += 0.03; b.r += b.vr;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.r);
        ctx.fillStyle = b.c;
        ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
        ctx.restore();
      });
      if (now - start < 4500) requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, w, h); canvas.hidden = true; }
    }
    requestAnimationFrame(frame);
  }

  // ---------- keyboard ----------
  document.addEventListener('keydown', (e) => {
    if (!$('confirm').hidden) { if (e.key === 'Escape') closeConfirm(false); return; }
    if (!round || round.done || currentView !== 'quiz') return;
    if (!round.answered && round.current.kind !== 'typed' && /^[1-4]$/.test(e.key)) answer(+e.key - 1);
    else if (round.answered && e.key === 'Enter' && document.activeElement !== $('q-next')) {
      e.preventDefault();
      $('q-next').click();
    }
  });

  // ---------- home buttons ----------
  $('btn-smart').addEventListener('click', () => startQuiz('smart'));
  $('btn-lab').addEventListener('click', () => showView('lab'));

  // ---------- toast ----------
  let toastTimer = null;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 3000);
  }

  // ---------- projectile lab ----------
  const lab = window.ProjectileLab.create({
    canvas: $('lab-canvas'),
    mode: stats.difficulty,
    startLevel: stats.lab.levels[stats.difficulty] || 1,
    elements: {
      angle: $('lab-angle'), speed: $('lab-speed'),
      angleOut: $('lab-angle-out'), speedOut: $('lab-speed-out'),
      fire: $('lab-fire'), hint: $('lab-hint'), next: $('lab-next'),
      message: $('lab-message'), level: $('lab-level'), shots: $('lab-shots'),
      nudges: document.querySelectorAll('.nudge'),
    },
    onScore(r) {
      stats.lab.shots++;
      if (r.hit) {
        const gained = Math.round(r.xp * Q.DIFF[r.mode].xpMult);
        touchDay();
        stats.lab.hits++;
        stats.lab.levels[r.mode] = r.level + 1;
        addXp(gained);
        r.done(gained);
        if (r.mode === 'medium' && r.level + 1 === 3) toast(t('toast.walls'));
      }
      save();
      renderHud();
    },
  });

  // ---------- boot ----------
  applyStaticText();
  renderFormulas();
  renderDiffPickers();
  renderHud();
  showView('home');
})();
