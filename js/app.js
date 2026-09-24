/*
 * Physics Quest — app shell: navigation, quiz rounds, XP/levels, progress.
 */
(function () {
  'use strict';

  const Q = window.PhysicsQuestions;
  const ROUND_LENGTH = 10;
  const STORAGE_KEY = 'physics-quest-v1';
  const TITLES = ['Curious Mind', 'Apprentice', 'Tinkerer', 'Experimenter', 'Lab Assistant',
    'Physicist', 'Senior Physicist', 'Professor', 'Nobel Nominee', 'Einstein Mode'];

  const $ = (id) => document.getElementById(id);
  const topicById = Object.fromEntries(Q.TOPICS.map((t) => [t.id, t]));

  // ---------- persistence ----------
  function freshStats() {
    const topics = {};
    Q.TOPICS.forEach((t) => (topics[t.id] = { attempts: 0, correct: 0, recent: [] }));
    return {
      xp: 0, answered: 0, correct: 0, bestStreak: 0,
      topics,
      lab: { hits: 0, shots: 0, level: 1 },
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
        base.topics = Object.assign(freshStats().topics, saved.topics || {});
        base.lab = Object.assign(freshStats().lab, saved.lab || {});
      }
    } catch (e) { /* storage unavailable or corrupt: start fresh */ }
    return base;
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (e) { /* ignore */ }
  }

  let stats = load();

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
    const t = today();
    if (stats.lastDay !== t) {
      stats.dayStreak = stats.lastDay === yesterday() ? stats.dayStreak + 1 : 1;
      stats.lastDay = t;
      stats.bestDayStreak = Math.max(stats.bestDayStreak, stats.dayStreak);
    }
    if (stats.todayDate !== t) { stats.todayDate = t; stats.todayCount = 0; }
  }

  // ---------- XP & levels ----------
  function levelInfo(xp) {
    let level = 1, need = 100;
    while (xp >= need) { xp -= need; level++; need = 100 + (level - 1) * 50; }
    return { level, into: xp, need, title: TITLES[Math.min(level - 1, TITLES.length - 1)] };
  }

  function addXp(amount) {
    const before = levelInfo(stats.xp).level;
    stats.xp += amount;
    const after = levelInfo(stats.xp);
    if (after.level > before) toast(`⭐ Level up! You're now level ${after.level}: ${after.title}`);
  }

  function mastery(topicId) {
    const r = stats.topics[topicId].recent;
    if (!r.length) return null;
    return r.filter(Boolean).length / r.length;
  }

  function accuracyMap() {
    const m = {};
    Q.TOPICS.forEach((t) => { const v = mastery(t.id); if (v !== null) m[t.id] = v; });
    return m;
  }

  // ---------- views ----------
  const TAB_FOR_VIEW = { quiz: 'topics', summary: 'topics' };

  function showView(name) {
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
    const tab = TAB_FOR_VIEW[name] || name;
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === tab));
    if (name === 'home') renderHome();
    if (name === 'topics') renderTopics();
    if (name === 'progress') renderProgress();
    if (name === 'lab') lab.resize();
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('.tab').forEach((b) =>
    b.addEventListener('click', () => {
      if (quiz && !quiz.done && !confirm('Leave the current round? Your answers so far are saved.')) return;
      quiz = null;
      showView(b.dataset.view);
    })
  );

  function renderHud() {
    const li = levelInfo(stats.xp);
    $('hud-level').textContent = li.level;
    $('hud-days').textContent = currentDayStreak();
    $('hud-xpfill').style.width = (100 * li.into / li.need) + '%';
    $('hud-xpfill').parentElement.title = `${li.into} / ${li.need} XP to level ${li.level + 1}`;
  }

  function masteryLabel(m) {
    if (m === null) return 'Not started';
    if (m < 0.4) return 'Needs work';
    if (m < 0.75) return 'Getting there';
    return 'Strong';
  }

  function weakestTopic() {
    let worst = null;
    Q.TOPICS.forEach((t) => {
      const m = mastery(t.id);
      if (m !== null && (worst === null || m < worst.m)) worst = { t, m };
    });
    return worst;
  }

  function renderHome() {
    const count = todayCount();
    $('goal-count').textContent = count;
    $('goal-target').textContent = stats.goal;
    $('goal-fill').style.width = Math.min(100, (100 * count) / stats.goal) + '%';
    $('greeting').textContent = count >= stats.goal
      ? "🏆 Daily goal done — you're on fire!"
      : stats.answered === 0 ? 'Ready to level up your physics?' : 'Welcome back! Keep the streak going.';
    $('home-xp').textContent = stats.xp;
    $('home-acc').textContent = stats.answered ? Math.round((100 * stats.correct) / stats.answered) + '%' : '–';
    $('home-best').textContent = stats.bestStreak;
    const w = weakestTopic();
    $('home-weak').textContent = w ? w.t.icon + ' ' + w.t.name : '–';
  }

  function renderTopics() {
    const grid = $('topic-grid');
    grid.innerHTML = '';
    const smart = document.createElement('button');
    smart.className = 'card topic smart';
    smart.innerHTML = `<span class="topic-icon">🧠</span><b>Smart Mix</b><span class="muted small">All topics — more questions from your weakest ones</span>`;
    smart.addEventListener('click', () => startQuiz('smart'));
    grid.appendChild(smart);
    Q.TOPICS.forEach((t) => {
      const m = mastery(t.id);
      const b = document.createElement('button');
      b.className = 'card topic';
      b.innerHTML = `<span class="topic-icon">${t.icon}</span><b>${t.name}</b><span class="muted small">${t.blurb}</span>
        <div class="bar thin"><div style="width:${m === null ? 0 : Math.round(m * 100)}%"></div></div>
        <span class="small muted">${masteryLabel(m)}${m === null ? '' : ' · ' + Math.round(m * 100) + '%'}</span>`;
      b.addEventListener('click', () => startQuiz(t.id));
      grid.appendChild(b);
    });
  }

  function renderFormulas() {
    const grid = $('formula-grid');
    Q.TOPICS.forEach((t) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<h3>${t.icon} ${t.name}</h3>` +
        Q.FORMULAS[t.id].map(([f, d]) => `<div class="formula"><code>${f}</code><span class="muted small">${d}</span></div>`).join('');
      grid.appendChild(card);
    });
  }

  function renderProgress() {
    const li = levelInfo(stats.xp);
    $('pr-level').textContent = li.level;
    $('pr-title').textContent = li.title;
    $('pr-answered').textContent = stats.answered;
    $('pr-days').textContent = currentDayStreak();
    $('pr-bestdays').textContent = stats.bestDayStreak;
    $('pr-lab').textContent = stats.lab.hits;
    $('set-goal').value = String(stats.goal);
    $('mastery-list').innerHTML = Q.TOPICS.map((t) => {
      const m = mastery(t.id);
      const s = stats.topics[t.id];
      const pct = m === null ? 0 : Math.round(m * 100);
      const tone = m === null ? '' : m < 0.4 ? 'bad' : m < 0.75 ? 'mid' : 'good';
      return `<div class="mastery">
        <span>${t.icon} ${t.name}</span>
        <div class="bar ${tone}"><div style="width:${pct}%"></div></div>
        <span class="small muted">${m === null ? 'not started' : pct + '% · ' + s.attempts + ' answered'}</span>
      </div>`;
    }).join('');
  }

  $('set-goal').addEventListener('change', (e) => { stats.goal = +e.target.value; save(); renderHome(); });
  $('reset').addEventListener('click', () => {
    if (!confirm('Really reset ALL progress? This cannot be undone.')) return;
    stats = freshStats();
    save();
    renderHud();
    renderProgress();
    toast('Progress reset. Fresh start!');
  });

  // ---------- quiz ----------
  let quiz = null;

  function startQuiz(mode) {
    quiz = { mode, index: 0, score: 0, streak: 0, xp: 0, log: [], prompts: new Set(), current: null, answered: false, done: false };
    showView('quiz');
    nextQuestion();
  }

  function nextQuestion() {
    if (quiz.index >= ROUND_LENGTH) return finishQuiz();
    let q;
    for (let tries = 0; tries < 8; tries++) {
      const topic = quiz.mode === 'smart' ? Q.pickWeightedTopic(accuracyMap()) : quiz.mode;
      q = Q.generate(topic);
      if (!quiz.prompts.has(q.prompt)) break;
    }
    quiz.prompts.add(q.prompt);
    quiz.current = q;
    quiz.answered = false;

    const t = topicById[q.topic];
    $('q-topic').textContent = `${t.icon} ${t.name}` + (q.kind === 'concept' ? ' · concept' : ' · calculation');
    $('q-prompt').textContent = q.prompt;
    $('quiz-count').textContent = `${quiz.index + 1} / ${ROUND_LENGTH}`;
    $('quiz-fill').style.width = (100 * quiz.index) / ROUND_LENGTH + '%';
    $('quiz-streak').textContent = '🔥 ' + quiz.streak;
    $('q-feedback').hidden = true;
    $('q-next').hidden = true;

    const box = $('q-choices');
    box.innerHTML = '';
    q.choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.innerHTML = `<span class="key">${i + 1}</span><span></span>`;
      b.lastChild.textContent = c;
      b.addEventListener('click', () => answer(i));
      box.appendChild(b);
    });
  }

  function answer(i) {
    if (!quiz || quiz.answered) return;
    const q = quiz.current;
    const ok = i === q.correctIndex;
    quiz.answered = true;

    const buttons = $('q-choices').children;
    for (let k = 0; k < buttons.length; k++) {
      buttons[k].disabled = true;
      if (k === q.correctIndex) buttons[k].classList.add('correct');
      else if (k === i) buttons[k].classList.add('wrong');
    }

    // record stats
    touchDay();
    stats.todayCount++;
    stats.answered++;
    const ts = stats.topics[q.topic];
    ts.attempts++;
    ts.recent.push(ok);
    if (ts.recent.length > 20) ts.recent.shift();

    let gained = 0;
    if (ok) {
      quiz.score++;
      quiz.streak++;
      stats.correct++;
      ts.correct++;
      stats.bestStreak = Math.max(stats.bestStreak, quiz.streak);
      gained = 10 + Math.min(quiz.streak - 1, 5) * 2;
      quiz.xp += gained;
      addXp(gained);
    } else {
      quiz.streak = 0;
    }
    if (todayCount() === stats.goal) toast('🏆 Daily goal reached! Great work.');
    save();
    renderHud();

    quiz.log.push({ q, chosen: i, ok });
    const fb = $('q-feedback');
    fb.hidden = false;
    fb.className = 'feedback ' + (ok ? 'good' : 'bad');
    fb.innerHTML = (ok
      ? `<b>✅ Correct!</b> +${gained} XP${quiz.streak >= 3 ? ` · 🔥 ${quiz.streak} in a row!` : ''}`
      : `<b>❌ Not quite.</b> The answer is <b></b>.`) + `<p></p>`;
    if (!ok) fb.querySelector('b + b').textContent = q.choices[q.correctIndex];
    fb.querySelector('p').textContent = q.explanation;

    $('quiz-streak').textContent = '🔥 ' + quiz.streak;
    $('q-next').hidden = false;
    $('q-next').textContent = quiz.index + 1 >= ROUND_LENGTH ? 'See results ➜' : 'Next ➜';
    $('q-next').focus();
  }

  $('q-next').addEventListener('click', () => { quiz.index++; nextQuestion(); });
  $('quiz-quit').addEventListener('click', () => {
    if (quiz.index > 0 || quiz.answered) finishQuiz();
    else { quiz = null; showView('topics'); }
  });

  function finishQuiz() {
    quiz.done = true;
    const answered = quiz.log.length;
    const pct = answered ? quiz.score / answered : 0;
    if (answered === ROUND_LENGTH && quiz.score === ROUND_LENGTH) {
      addXp(25);
      quiz.xp += 25;
      toast('💯 Perfect round! +25 bonus XP');
      save();
      renderHud();
    }
    $('sum-emoji').textContent = pct === 1 ? '🏆' : pct >= 0.7 ? '🎉' : pct >= 0.4 ? '💪' : '📖';
    $('sum-title').textContent = pct === 1 ? 'Perfect round!' : pct >= 0.7 ? 'Great job!' : pct >= 0.4 ? 'Good effort — keep going!' : 'Every mistake is a lesson!';
    $('sum-score').textContent = quiz.score;
    $('sum-total').textContent = answered;
    $('sum-xp').textContent = quiz.xp;

    const review = $('sum-review');
    review.innerHTML = '';
    const missed = quiz.log.filter((l) => !l.ok);
    if (missed.length) {
      const h = document.createElement('h3');
      h.textContent = `Review your ${missed.length} missed question${missed.length > 1 ? 's' : ''}`;
      review.appendChild(h);
      missed.forEach((l) => {
        const card = document.createElement('div');
        card.className = 'card review';
        card.innerHTML = '<p class="q-prompt"></p><p class="small"><span class="tag bad">You said</span> <span></span></p><p class="small"><span class="tag good">Answer</span> <span></span></p><p class="muted small"></p>';
        const ps = card.querySelectorAll('p');
        ps[0].textContent = l.q.prompt;
        ps[1].lastChild.textContent = l.q.choices[l.chosen];
        ps[2].lastChild.textContent = l.q.choices[l.q.correctIndex];
        ps[3].textContent = l.q.explanation;
        review.appendChild(card);
      });
    }
    showView('summary');
  }

  $('sum-again').addEventListener('click', () => startQuiz(quiz.mode));
  $('sum-topics').addEventListener('click', () => { quiz = null; showView('topics'); });

  document.addEventListener('keydown', (e) => {
    if (!quiz || quiz.done || !$('view-quiz').classList.contains('active')) return;
    if (!quiz.answered && /^[1-4]$/.test(e.key)) answer(+e.key - 1);
    else if (quiz.answered && e.key === 'Enter' && document.activeElement !== $('q-next')) $('q-next').click();
  });

  // ---------- home buttons ----------
  $('btn-smart').addEventListener('click', () => startQuiz('smart'));
  $('btn-lab').addEventListener('click', () => showView('lab'));

  // ---------- toast ----------
  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 3000);
  }

  // ---------- projectile lab ----------
  const lab = window.ProjectileLab.create({
    canvas: $('lab-canvas'),
    startLevel: stats.lab.level,
    elements: {
      angle: $('lab-angle'), speed: $('lab-speed'),
      angleOut: $('lab-angle-out'), speedOut: $('lab-speed-out'),
      fire: $('lab-fire'), hint: $('lab-hint'), next: $('lab-next'),
      message: $('lab-message'), level: $('lab-level'), shots: $('lab-shots'),
    },
    onScore(r) {
      stats.lab.shots++;
      if (r.hit) {
        touchDay();
        stats.lab.hits++;
        stats.lab.level = r.level + 1;
        addXp(r.xp);
        if (r.level + 1 === 3) toast('🧱 Walls unlocked! Now you need to clear an obstacle.');
      }
      save();
      renderHud();
    },
  });

  // ---------- boot ----------
  renderFormulas();
  renderHud();
  showView('home');
})();
