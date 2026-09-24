# ⚛️ Physics Quest · مغامرة الفيزياء

A browser game for learning physics from zero and practising it in your free time, in **English and Arabic**. It has a School mode that takes you from "what is physics?" to graduation, quiz rounds at four difficulty levels, a projectile-motion mini game, and progress tracking that keeps you coming back.

## Play

No install needed. Either:

- **Double-click `index.html`** to open it in your browser, or
- run a local server with `npm start` (or `python3 -m http.server 8000`) and open <http://localhost:8000>.

It works on phones too. Your progress is saved in your browser (`localStorage`).

## Languages

Switch between English and العربية with the button in the top bar (or in Progress → Settings). Everything is translated, including every generated question, explanation, lesson and the certificate, and the layout flips to right-to-left for Arabic. Phones set to Arabic start in Arabic.

## 🎓 School mode

For people who barely know any physics yet. 7 units and 20 lessons:

| Unit | Lessons |
| --- | --- |
| 📏 Measurement | What is physics? · SI units · Prefixes and conversions |
| 🏃 Motion | Speed · Acceleration · Falling objects |
| 🧲 Forces | What is a force? · Newton's second law · Weight, friction and action–reaction |
| ⚡ Energy | What is energy? · Kinetic and potential energy · Work and power |
| 🎱 Momentum | Momentum · Collisions |
| 🌊 Waves and sound | What is a wave? · The wave equation · Sound and light |
| 🔌 Electricity | Charge, current and voltage · Ohm's law · Circuits and power |

- **Teaching:** each lesson is a few short cards plus a worked example.
- **Exercises:** 5 questions with the formula shown and an explanation after each one. Get 4 right to pass (⭐⭐), or 5 for ⭐⭐⭐. Passing unlocks the next lesson.
- **Unit exams:** 8 questions from the unit, no hints and results only at the end. You need 75% to unlock the next unit.
- **Final exam:** 20 questions covering every lesson. Pass with 70% to **graduate** 🥳 and get a certificate with your name.

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
js/i18n.js          interface text in English and Arabic
js/questions.js     question generators, conceptual questions, formulas (both languages)
js/school.js        School mode: units, lessons, exercises and exams
js/projectile.js    Projectile Lab simulation + canvas rendering
js/app.js           navigation, rounds, School progress, XP/levels, saved progress
tests/              checks every generated question, both languages and the whole curriculum
```

## Adding questions

- **New calculation:** add `gen(tier, formula, function name(o) { ... })` to the right topic in `GENERATORS` in `js/questions.js`. Tier 1 = one step (Beginner and Medium), 2 = two steps (Medium, Hard and Hardcore), 3 = multi-step (Hard and Hardcore). The function gets `o.g` (10 or 9.8) and returns `{ prompt, answer, unit, mistakes: [...], explanation }`.
- **New concept question:** add `c(enPrompt, enChoices, enExplanation, arPrompt, arChoices, arExplanation)` to `CONCEPTS`. **The first choice is the correct one** (choices are shuffled when shown).
- **Arabic text:** wrap formulas and "number unit" pairs in `iso(...)` / `nu(value, unit)` so they stay left-to-right inside Arabic sentences.
- **New lesson:** add it to a unit in `js/school.js` with `cards`, `practice` (generator names) and `checks`.

Run `npm test` afterwards to check that everything still generates correctly.
