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

For people who barely know any physics yet. 7 units and 21 lessons:

| Unit | Lessons |
| --- | --- |
| 📏 Measurement | What is physics? · SI units · Powers of ten · Prefixes and conversions |
| 🏃 Motion | Speed · Acceleration · Falling objects |
| 🧲 Forces | What is a force? · Newton's second law · Weight, friction and action–reaction |
| ⚡ Energy | What is energy? · Kinetic and potential energy · Work and power |
| 🎱 Momentum | Momentum · Collisions |
| 🌊 Waves and sound | What is a wave? · The wave equation · Sound and light |
| 🔌 Electricity | Charge, current and voltage · Ohm's law · Circuits and power |

- **Teaching:** each lesson is a few short cards plus a worked example.
- **Exercises:** 5 questions with the formula shown and an explanation after each one. Get 4 right to pass (⭐⭐), or 5 for ⭐⭐⭐. Passing unlocks the next lesson.
- **Unit exams:** 8 questions from the unit, no hints and results only at the end. You need 75% to unlock the next unit.
- **Final exam:** 20 questions spread across all the lessons. Pass with 70% to **graduate** 🥳 and get a certificate with your name.

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

Every answer comes with a worked explanation whose steps you can check by hand, and wrong options are built from **common mistakes** (like forgetting the ½ in ½mv² or averaging two speeds), so you learn to spot the traps.

**Numbers:** answers of 1000 or more (and below 0.01) are written with powers of ten, like `2.4 × 10³`, and are rounded to 3 significant figures. In Hardcore, type them as `2.4×10^3` or `2.4e3`, or use the **×10ⁿ** button (phone keypads have no ×, ^ or e). Arabic digits like ٢٫٤ work too.

**🧮 Calculator:** tap the round button in the corner on any screen. It has sin/cos/tan (in degrees), √, x², powers, ×10ⁿ, π and Ans, shows the current question at the top, and shows the result rounded to 3 significant figures like the game's answers. In Hardcore, **Use in my answer** copies the result into the answer box. It's allowed in exams too.

**Tips:** press `1`–`4` to answer and `Enter` to go to the next question. Use g = 9.8 m/s².

## Project layout

```
index.html          page layout
css/style.css       styles (light + dark mode, mobile friendly)
js/i18n.js          interface text in English and Arabic
js/questions.js     question generators, conceptual questions, formulas (both languages)
js/school.js        School mode: units, lessons, exercises and exams
js/projectile.js    Projectile Lab simulation + canvas rendering
js/calculator.js    scientific calculator (safe expression parser, no eval) and its panel
js/app.js           navigation, rounds, School progress, XP/levels, saved progress
tests/              checks every generated question, both languages and the whole curriculum
```

## Adding questions

- **New calculation:** add `gen(tier, formula, function name(o) { ... })` to the right topic in `GENERATORS` in `js/questions.js`. Tier 1 = one step (Beginner and Medium), 2 = two steps (Medium, Hard and Hardcore), 3 = multi-step (Hard and Hardcore). The function gets `o.g` (10 or 9.8) and returns `{ prompt, answer, unit, mistakes: [...], explanation }`.
- **New concept question:** add `c(enPrompt, enChoices, enExplanation, arPrompt, arChoices, arExplanation)` to `CONCEPTS`. **The first choice is the correct one** (choices are shuffled when shown).
- **Arabic text:** wrap formulas and "number unit" pairs in `iso(...)` / `nu(value, unit)` so they stay left-to-right inside Arabic sentences.
- **New lesson:** add it to a unit in `js/school.js` with `cards`, `practice` (generator names) and `checks`.

Multi-step explanations must add up with the numbers they show: use exact values (`ex`) or round an intermediate with `r4` and keep using that rounded value in the next step.

Run `npm test` afterwards. Among other things it recomputes every step of every worked explanation.
