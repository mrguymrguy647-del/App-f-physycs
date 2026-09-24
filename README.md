# ⚛️ Physics Quest

A small browser game for getting better at physics in your free time: short quiz rounds, a projectile-motion mini game, and progress tracking that keeps you coming back.

## Play

No install needed. Either:

- **Double-click `index.html`** to open it in your browser, or
- run a local server with `npm start` (or `python3 -m http.server 8000`) and open <http://localhost:8000>.

It works on phones too. Your progress is saved in your browser (`localStorage`).

## What's inside

| Mode | What you do |
| --- | --- |
| 🧠 **Smart Mix** | 10-question rounds across all topics that pick more questions from your weakest topics |
| 📚 **Topic quizzes** | Motion, Forces, Energy, Momentum, Waves, Electricity. Calculation questions are generated randomly, so they never run out, and conceptual questions check your understanding |
| 🎯 **Projectile Lab** | Set the angle and launch speed to hit a target. Every shot shows the range, max height and flight time using the real formulas. Walls appear from level 3 |
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

- **New calculation:** add a function to the right topic in `GENERATORS` in `js/questions.js`. It returns `{ prompt, answer, unit, mistakes: [...], explanation }`.
- **New concept question:** add `{ prompt, choices, explanation }` to `CONCEPTS`. **The first choice is the correct one** (choices are shuffled when shown).

Run `npm test` afterwards to check that everything still generates correctly.
