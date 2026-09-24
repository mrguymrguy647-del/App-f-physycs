# ⚛️ Physics Quest

A small browser game for getting better at physics in your free time: short quiz rounds, a projectile-motion mini game, and progress tracking that keeps you coming back.

## Play

No install needed. Either:

- **Double-click `index.html`** to open it in your browser, or
- run a local server with `npm start` (or `python3 -m http.server 8000`) and open <http://localhost:8000>.

It works on phones too. Your progress is saved in your browser (`localStorage`).

## Difficulty levels

Pick one on the Home, Quiz or Lab screen. You can switch any time.

| Level | Quiz | Projectile Lab | XP |
| --- | --- | --- | --- |
| 🌱 **Beginner** | One-step problems, friendly numbers, g = 10. The formula is shown on every question | Wide targets and a dotted line showing where your shot will land | ×1 |
| 🔥 **Medium** | Two-step problems and classic traps, g = 9.8. "Show formula" costs half the XP | Targets shrink as you level up, walls from level 3 | ×1.5 |
| ⚡ **Hard** | Multi-step problems (slopes with friction, lifts, Doppler, mixed circuits…) with a 45 s timer. Faster answers get bonus XP | Narrow targets and walls from the start, no hints | ×2 |
| 💀 **Hardcore** | No answer options: type the number yourself (within 2%). 60 s per question, 3 lives | Tiny targets, walls and wind that pushes the ball sideways | ×3 |

## What's inside

| Mode | What you do |
| --- | --- |
| 🧠 **Smart Mix** | 10-question rounds across all topics that pick more questions from your weakest topics |
| 📚 **Topic quizzes** | Motion, Forces, Energy, Momentum, Waves, Electricity. Calculation questions are generated randomly, so they never run out, and conceptual questions check your understanding |
| 🎯 **Projectile Lab** | Set the angle and launch speed to hit a target. Every shot shows the range, max height and flight time using the real formulas. Walls and wind depend on the difficulty |
| 📐 **Formulas** | A formula sheet for every topic |
| 📈 **Progress** | XP and levels, a daily goal, a day streak, and topic mastery based on your last 20 answers |

Every answer comes with a worked explanation, and wrong options are built from **common mistakes** (like forgetting the ½ in ½mv² or averaging two speeds), so you learn to spot the traps.

**Tips:** press `1`–`4` to answer and `Enter` to go to the next question. Use g = 9.8 m/s².

## Project layout

```
index.html          page layout
css/style.css       styles (light + dark mode, mobile friendly)
js/questions.js     question generators, conceptual questions, formulas
js/projectile.js    Projectile Lab simulation + canvas rendering
js/app.js           navigation, quiz rounds, XP/levels, saved progress
tests/              checks that every generated question is valid
```

## Adding questions

- **New calculation:** add `gen(tier, formula, function name(o) { ... })` to the right topic in `GENERATORS` in `js/questions.js`. Tier 1 = one step (Beginner and Medium), 2 = two steps (Medium, Hard and Hardcore), 3 = multi-step (Hard and Hardcore). The function gets `o.g` (10 or 9.8) and returns `{ prompt, answer, unit, mistakes: [...], explanation }`.
- **New concept question:** add `{ prompt, choices, explanation }` to `CONCEPTS`. **The first choice is the correct one** (choices are shuffled when shown).

Run `npm test` afterwards to check that everything still generates correctly.
