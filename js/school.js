/*
 * Physics Quest — School mode curriculum.
 * 7 units → 20 lessons. Each lesson has teaching cards (with a worked example),
 * practice generators and quick concept checks. Units end with an exam; the
 * course ends with a final exam and graduation.
 */
(function (root) {
  'use strict';

  const Q = typeof module !== 'undefined' && module.exports ? require('./questions.js') : root.PhysicsQuestions;
  const { iso, nu, L, rand, pick, fmt, gen, shuffle } = Q;

  const G_SCHOOL = 10;
  const RULES = {
    exerciseCount: 5, exercisePass: 4,
    unitExamCount: 8, unitExamPass: 0.75,
    finalCount: 20, finalPass: 0.7,
    xpLesson: 20, xpUnitExam: 50, xpFinal: 200,
  };

  // Keeps numbers, units and formulas left-to-right inside Arabic HTML.
  const x = (s) => `<span class="ltr">${s}</span>`;

  // ---------- School-only generators ----------
  const SCHOOL_GENERATORS = {
    lengthConvert: gen(1, '1 km = 1000 m,  1 cm = 0.01 m', function lengthConvert(o) {
      if (Math.random() < 0.5) {
        const k = rand(0.5, 20, 0.5);
        const m = k * 1000;
        return {
          prompt: L(o, `Convert ${k} km to metres.`, `حوّل ${nu(k, 'km')} إلى أمتار.`),
          answer: m, unit: 'm', mistakes: [k * 100, k / 1000, k * 10],
          explanation: L(o, `Kilo means 1000: ${k} × 1000 = ${fmt(m)} m.`, `كيلو تعني 1000: ${iso(`${k} × 1000 = ${fmt(m)} m`)}.`),
        };
      }
      const cm = rand(5, 500, 5);
      const m = cm / 100;
      return {
        prompt: L(o, `Convert ${cm} cm to metres.`, `حوّل ${nu(cm, 'cm')} إلى أمتار.`),
        answer: m, unit: 'm', mistakes: [cm * 100, cm / 1000, cm / 10],
        explanation: L(o, `Centi means one hundredth: ${cm} ÷ 100 = ${fmt(m)} m.`, `سنتي تعني جزءًا من مئة: ${iso(`${cm} ÷ 100 = ${fmt(m)} m`)}.`),
      };
    }),
    timeConvert: gen(1, '1 min = 60 s,  1 h = 3600 s', function timeConvert(o) {
      if (Math.random() < 0.6) {
        const min = rand(2, 30);
        return {
          prompt: L(o, `How many seconds are there in ${min} minutes?`, `كم ثانية في ${iso(min)} دقيقة؟`),
          answer: min * 60, unit: 's', mistakes: [min * 100, min / 60, min * 3600],
          explanation: L(o, `1 minute = 60 s, so ${min} × 60 = ${min * 60} s.`, `الدقيقة = ${nu(60, 's')}، إذن ${iso(`${min} × 60 = ${min * 60} s`)}.`),
        };
      }
      const h = rand(1, 5);
      return {
        prompt: L(o, `How many seconds are there in ${h} hour${h > 1 ? 's' : ''}?`, `كم ثانية في ${iso(h)} ساعة؟`),
        answer: h * 3600, unit: 's', mistakes: [h * 60, h * 100, h * 1000],
        explanation: L(o, `1 hour = 60 × 60 = 3600 s, so ${h} × 3600 = ${h * 3600} s.`, `الساعة = ${iso('60 × 60 = 3600 s')}، إذن ${iso(`${h} × 3600 = ${h * 3600} s`)}.`),
      };
    }),
    massConvert: gen(1, '1 g = 0.001 kg', function massConvert(o) {
      const g = rand(100, 5000, 50);
      const kg = g / 1000;
      return {
        prompt: L(o, `Convert ${g} g to kilograms.`, `حوّل ${nu(g, 'g')} إلى كيلوغرامات.`),
        answer: kg, unit: 'kg', mistakes: [g * 1000, g / 100, g / 10],
        explanation: L(o, `1 kg = 1000 g, so ${g} ÷ 1000 = ${fmt(kg)} kg.`, `${iso('1 kg = 1000 g')}، إذن ${iso(`${g} ÷ 1000 = ${fmt(kg)} kg`)}.`),
      };
    }),
    speedConvert: gen(1, 'm/s = km/h ÷ 3.6', function speedConvert(o) {
      const kmh = pick([18, 36, 54, 72, 90, 108, 126, 144]);
      const ms = kmh / 3.6;
      return {
        prompt: L(o, `A car travels at ${kmh} km/h. What is its speed in m/s?`, `تسير سيارة بسرعة ${nu(kmh, 'km/h')}. ما سرعتها بوحدة m/s؟`),
        answer: ms, unit: 'm/s', mistakes: [kmh * 3.6, kmh / 60, kmh * 1000 / 60],
        explanation: L(o, `Divide by 3.6: ${kmh} ÷ 3.6 = ${fmt(ms)} m/s (because 1000 m ÷ 3600 s = 1/3.6).`,
          `اقسم على 3.6: ${iso(`${kmh} ÷ 3.6 = ${fmt(ms)} m/s`)} (لأن ${iso('1000 m ÷ 3600 s = 1/3.6')}).`),
      };
    }),
    accelFromSpeeds: gen(1, 'a = (v − u) / t', function accelFromSpeeds(o) {
      const u = rand(0, 10), v = rand(u + 4, 30), t = rand(2, 8);
      const a = (v - u) / t;
      return {
        prompt: L(o, `A scooter speeds up from ${u} m/s to ${v} m/s in ${t} s. What is its acceleration?`,
          `تزداد سرعة دراجة كهربائية من ${nu(u, 'm/s')} إلى ${nu(v, 'm/s')} خلال ${nu(t, 's')}. ما تسارعها؟`),
        answer: a, unit: 'm/s²', mistakes: [v / t, (v + u) / t, (v - u) * t],
        explanation: L(o, `a = (v − u) / t = (${v} − ${u}) / ${t} = ${fmt(a)} m/s².`, `${iso(`a = (v − u) / t = (${v} − ${u}) / ${t} = ${fmt(a)} m/s²`)}.`),
      };
    }),
    fallSpeed: gen(1, 'v = g·t', function fallSpeed(o) {
      const t = rand(1, 6);
      const v = o.g * t;
      return {
        prompt: L(o, `A stone is dropped from a high bridge. How fast is it falling after ${t} s? (g = ${o.g} m/s², ignore air resistance)`,
          `أُسقط حجر من فوق جسر مرتفع. ما سرعة سقوطه بعد ${nu(t, 's')}؟ (${iso(`g = ${o.g} m/s²`)}، أهمل مقاومة الهواء)`),
        answer: v, unit: 'm/s', mistakes: [0.5 * o.g * t, o.g * t * t, o.g / t],
        explanation: L(o, `Starting from rest: v = g·t = ${o.g} × ${t} = ${fmt(v)} m/s.`, `يبدأ من السكون: ${iso(`v = g·t = ${o.g} × ${t} = ${fmt(v)} m/s`)}.`),
      };
    }),
    workSimple: gen(1, 'W = F·d', function workSimple(o) {
      const F = rand(10, 200, 10), d = rand(2, 20);
      const W = F * d;
      return {
        prompt: L(o, `You push a box with a force of ${F} N for ${d} m. How much work do you do?`,
          `تدفع صندوقًا بقوة ${nu(F, 'N')} مسافة ${nu(d, 'm')}. ما الشغل الذي تبذله؟`),
        answer: W, unit: 'J', mistakes: [F / d, F + d, 0.5 * F * d],
        explanation: L(o, `W = F·d = ${F} × ${d} = ${fmt(W)} J.`, `${iso(`W = F·d = ${F} × ${d} = ${fmt(W)} J`)}.`),
      };
    }),
    energyConservation: gen(1, 'KE (bottom) = PE (top) = m·g·h', function energyConservation(o) {
      const m = rand(1, 10), h = rand(2, 20);
      const E = m * o.g * h;
      return {
        prompt: L(o, `A ${m} kg ball is dropped from ${h} m. Ignoring air resistance, how much kinetic energy does it have just before it hits the ground? (g = ${o.g} m/s²)`,
          `أُسقطت كرة كتلتها ${nu(m, 'kg')} من ارتفاع ${nu(h, 'm')}. بإهمال مقاومة الهواء، ما طاقتها الحركية قبل أن تصل إلى الأرض مباشرة؟ (${iso(`g = ${o.g} m/s²`)})`),
        answer: E, unit: 'J', mistakes: [m * h, 0.5 * m * o.g * h, m * o.g],
        explanation: L(o, `Energy is conserved: all the potential energy becomes kinetic. KE = PE = m·g·h = ${m} × ${o.g} × ${h} = ${fmt(E)} J.`,
          `الطاقة محفوظة: تتحول كل طاقة الوضع إلى طاقة حركية. ${iso(`KE = PE = m·g·h = ${m} × ${o.g} × ${h} = ${fmt(E)} J`)}.`),
      };
    }),
    charge: gen(1, 'Q = I·t', function charge(o) {
      const I = rand(1, 10), t = rand(5, 120, 5);
      const Qc = I * t;
      return {
        prompt: L(o, `A current of ${I} A flows for ${t} s. How much charge passes?`, `يمر تيار ${nu(I, 'A')} لمدة ${nu(t, 's')}. ما مقدار الشحنة المارة؟`),
        answer: Qc, unit: 'C', mistakes: [I / t, t / I, I + t],
        explanation: L(o, `Q = I·t = ${I} × ${t} = ${fmt(Qc)} C.`, `${iso(`Q = I·t = ${I} × ${t} = ${fmt(Qc)} C`)}.`),
      };
    }),
  };

  // ---------- content helpers ----------
  const ck = (enPrompt, enChoices, enExp, arPrompt, arChoices, arExp) => ({
    prompt: { en: enPrompt, ar: arPrompt },
    choices: { en: enChoices, ar: arChoices },
    explanation: { en: enExp, ar: arExp },
  });
  const card = (en, ar) => ({ en, ar });
  const example = (en, ar) => ({ en, ar, example: true });
  const tt = (en, ar) => ({ en, ar });

  // ---------- curriculum ----------
  const UNITS = [
    {
      id: 'measure', icon: '📏', topic: 'measurement',
      title: tt('Measurement: the language of physics', 'القياس: لغة الفيزياء'),
      lessons: [
        {
          id: 'what-is-physics', title: tt('What is physics?', 'ما الفيزياء؟'),
          cards: [
            card('<b>Physics</b> is the science that asks <i>how</i> and <i>why</i> things move, fall, shine, heat up and make sound. It studies matter, energy, forces and motion, from a football to a planet.',
              '<b>الفيزياء</b> هي العلم الذي يسأل <i>كيف</i> و<i>لماذا</i> تتحرك الأشياء وتسقط وتضيء وتسخن وتُصدر الأصوات. تدرس المادة والطاقة والقوى والحركة، من كرة القدم حتى الكواكب.'),
            card('Physicists work like detectives: they <b>observe</b>, make a guess called a <b>hypothesis</b>, then <b>test</b> it with experiments and measurements. If the results disagree, the idea must change.',
              'يعمل الفيزيائيون مثل المحققين: <b>يلاحظون</b>، ثم يضعون تخمينًا يسمى <b>فرضية</b>، ثم <b>يختبرونه</b> بالتجارب والقياسات. إذا خالفت النتائج الفكرة، فيجب تغيير الفكرة.'),
            card('Physics uses <b>mathematics</b> as its language. A short formula like <code>v = d / t</code> says a lot: speed equals distance divided by time. Don\'t worry, we\'ll learn each formula step by step!',
              'تستخدم الفيزياء <b>الرياضيات</b> لغةً لها. قانون قصير مثل <code>v = d / t</code> يقول الكثير: السرعة تساوي المسافة مقسومة على الزمن. لا تقلق، سنتعلم كل قانون خطوة بخطوة!'),
            example('<b>Everyday physics:</b> why do you lean forward when a bus suddenly stops? Your body wants to keep moving. This is called <b>inertia</b>, and you\'ll learn the law behind it in the Forces unit.',
              '<b>فيزياء الحياة اليومية:</b> لماذا تندفع إلى الأمام عندما تتوقف الحافلة فجأة؟ لأن جسمك يريد أن يستمر في الحركة. يسمى ذلك <b>القصور الذاتي</b>، وستتعلم القانون وراءه في وحدة القوى.'),
          ],
          practice: [],
          checks: [
            ck('Which of these is a question physics tries to answer?',
              ['Why does a ball fall back down after you throw it?', 'Which football team is the best?', 'What is the capital of France?', 'What is your favourite colour?'],
              'Physics studies how nature behaves: motion, forces, energy. The other questions are about opinions or geography.',
              'أي هذه الأسئلة تحاول الفيزياء الإجابة عنه؟',
              ['لماذا تعود الكرة إلى الأسفل بعد أن ترميها؟', 'أي فريق كرة قدم هو الأفضل؟', 'ما عاصمة فرنسا؟', 'ما لونك المفضل؟'],
              'الفيزياء تدرس سلوك الطبيعة: الحركة والقوى والطاقة. الأسئلة الأخرى عن الآراء أو الجغرافيا.'),
            ck("A scientist's educated guess that can be tested is called a…",
              ['Hypothesis', 'Law', 'Unit', 'Formula'],
              'A hypothesis is a testable guess. Experiments decide whether it survives.',
              'التخمين العلمي القابل للاختبار يسمى…',
              ['فرضية', 'قانونًا', 'وحدة', 'معادلة'],
              'الفرضية تخمين قابل للاختبار، والتجارب هي التي تحكم إن كان صحيحًا.'),
            ck('What should a physicist do if an experiment disagrees with their idea?',
              ['Change or improve the idea', 'Ignore the experiment', 'Hide the results', 'Stop doing physics'],
              'In science, experiments are the judge. A good scientist updates their idea when the evidence says so.',
              'ماذا يجب أن يفعل الفيزيائي إذا خالفت التجربة فكرته؟',
              ['يغيّر الفكرة أو يحسّنها', 'يتجاهل التجربة', 'يخفي النتائج', 'يتوقف عن دراسة الفيزياء'],
              'في العلم، التجربة هي الحَكَم. العالِم الجيد يعدّل فكرته عندما تدل الأدلة على ذلك.'),
            ck('What "language" does physics use to describe nature precisely?',
              ['Mathematics', 'Poetry', 'Music', 'Drawings only'],
              'Formulas and numbers let physicists make exact predictions that can be checked.',
              'ما "اللغة" التي تستخدمها الفيزياء لوصف الطبيعة بدقة؟',
              ['الرياضيات', 'الشعر', 'الموسيقى', 'الرسوم فقط'],
              'القوانين والأرقام تسمح للفيزيائيين بتنبؤات دقيقة يمكن التحقق منها.'),
            ck('You lean forward when a moving bus suddenly brakes. This is because of…',
              ['Inertia: your body keeps moving', 'Magnetism', 'The bus pushing you forward', 'Sound waves'],
              'Objects keep doing what they were doing unless a force changes it. Your body was moving, so it keeps going forward.',
              'تندفع إلى الأمام عندما تتوقف الحافلة فجأة. هذا بسبب…',
              ['القصور الذاتي: جسمك يستمر في الحركة', 'المغناطيسية', 'دفع الحافلة لك إلى الأمام', 'موجات الصوت'],
              'الأجسام تستمر على حالتها ما لم تغيّرها قوة. كان جسمك متحركًا، فاستمر في الحركة إلى الأمام.'),
          ],
        },
        {
          id: 'si-units', title: tt('Quantities and SI units', 'الكميات والوحدات الدولية'),
          cards: [
            card('Every measurement has two parts: a <b>number</b> and a <b>unit</b>. "5" means nothing, but "5 metres" tells you a length. Always write the unit!',
              `لكل قياس جزءان: <b>رقم</b> و<b>وحدة</b>. الرقم "5" وحده لا يعني شيئًا، لكن "5 أمتار" تخبرك بطول. اكتب الوحدة دائمًا!`),
            card('Scientists everywhere use the same system: the <b>SI</b> (International System of Units). The main units are: length in <b>metres (m)</b>, mass in <b>kilograms (kg)</b>, time in <b>seconds (s)</b> and electric current in <b>amperes (A)</b>.',
              'يستخدم العلماء في كل مكان النظام نفسه: <b>النظام الدولي للوحدات (SI)</b>. أهم الوحدات: الطول <b>بالمتر (m)</b>، والكتلة <b>بالكيلوغرام (kg)</b>، والزمن <b>بالثانية (s)</b>، والتيار الكهربائي <b>بالأمبير (A)</b>.'),
            card('Other units are built from these. Speed is metres per second (<code>m/s</code>). Force is measured in <b>newtons (N)</b>, energy in <b>joules (J)</b> and power in <b>watts (W)</b>. In this game we write units with their international symbols.',
              'تُبنى وحدات أخرى من هذه الوحدات. السرعة بالمتر لكل ثانية (<code>m/s</code>). والقوة تقاس <b>بالنيوتن (N)</b>، والطاقة <b>بالجول (J)</b>، والقدرة <b>بالواط (W)</b>. في هذه اللعبة نكتب الوحدات برموزها الدولية.'),
            example('<b>Example:</b> a car travels 100 m in 5 s. Its speed is <code>100 ÷ 5 = 20 m/s</code>. Notice how the unit m/s comes from dividing metres by seconds.',
              `<b>مثال:</b> تقطع سيارة ${x('100 m')} في ${x('5 s')}. سرعتها <code>100 ÷ 5 = 20 m/s</code>. لاحظ كيف جاءت الوحدة ${x('m/s')} من قسمة المتر على الثانية.`),
          ],
          practice: ['kinematics:simpleSpeed'],
          checks: [
            ck('What is the SI unit of mass?', ['Kilogram (kg)', 'Newton (N)', 'Metre (m)', 'Pound'],
              'Mass is measured in kilograms. The newton is the unit of force (like weight).',
              'ما وحدة الكتلة في النظام الدولي؟', ['الكيلوغرام (kg)', 'النيوتن (N)', 'المتر (m)', 'الرطل'],
              'الكتلة تقاس بالكيلوغرام. أما النيوتن فوحدة القوة (مثل الوزن).'),
            ck('Which unit measures time in the SI system?', ['Second (s)', 'Hour (h)', 'Metre (m)', 'Joule (J)'],
              'The SI unit of time is the second. Hours and minutes are useful, but most formulas need seconds.',
              'ما الوحدة التي تقيس الزمن في النظام الدولي؟', ['الثانية (s)', 'الساعة (h)', 'المتر (m)', 'الجول (J)'],
              'وحدة الزمن الدولية هي الثانية. الساعات والدقائق مفيدة، لكن معظم القوانين تحتاج إلى الثواني.'),
            ck('Which measurement is written correctly?', ['12 m', '12', 'metres', 'm'],
              'A measurement needs both a number and a unit.',
              'أي قياس مكتوب بشكل صحيح؟', ['12 m', '12', 'متر', 'm'],
              'يحتاج القياس إلى رقم ووحدة معًا.'),
            ck('Energy is measured in…', ['Joules (J)', 'Watts (W)', 'Newtons (N)', 'Metres (m)'],
              'Joules measure energy. Watts measure power, which is energy per second.',
              'تقاس الطاقة بوحدة…', ['الجول (J)', 'الواط (W)', 'النيوتن (N)', 'المتر (m)'],
              'الجول وحدة الطاقة. أما الواط فوحدة القدرة، أي الطاقة في الثانية.'),
          ],
        },
        {
          id: 'conversions', title: tt('Prefixes and conversions', 'البادئات وتحويل الوحدات'),
          cards: [
            card('Big and small numbers use <b>prefixes</b>: <b>kilo (k)</b> = 1000, <b>centi (c)</b> = 1/100, <b>milli (m)</b> = 1/1000. So <code>1 km = 1000 m</code>, <code>1 cm = 0.01 m</code> and <code>1 g = 0.001 kg</code>.',
              'للأعداد الكبيرة والصغيرة نستخدم <b>البادئات</b>: <b>كيلو (k)</b> = 1000، و<b>سنتي (c)</b> = 1/100، و<b>ملّي (m)</b> = 1/1000. إذن <code>1 km = 1000 m</code> و<code>1 cm = 0.01 m</code> و<code>1 g = 0.001 kg</code>.'),
            card('Time: <code>1 min = 60 s</code> and <code>1 h = 60 min = 3600 s</code>. Before using a formula, convert everything to SI units (m, kg, s).',
              `الزمن: <code>1 min = 60 s</code> و<code>1 h = 60 min = 3600 s</code>. قبل استخدام أي قانون، حوّل كل شيء إلى الوحدات الدولية (${x('m، kg، s')}).`),
            card('A handy trick: to turn <b>km/h into m/s, divide by 3.6</b> (because <code>1000 m ÷ 3600 s = 1/3.6</code>). A car at 72 km/h moves at <code>72 ÷ 3.6 = 20 m/s</code>.',
              `حيلة مفيدة: لتحويل <b>${x('km/h')} إلى ${x('m/s')} اقسم على 3.6</b> (لأن <code>1000 m ÷ 3600 s = 1/3.6</code>). سيارة سرعتها ${x('72 km/h')} تتحرك بسرعة <code>72 ÷ 3.6 = 20 m/s</code>.`),
            example('<b>Example:</b> convert 2.5 km to metres. Kilo means 1000, so <code>2.5 × 1000 = 2500 m</code>. Convert 3 minutes to seconds: <code>3 × 60 = 180 s</code>.',
              `<b>مثال:</b> حوّل ${x('2.5 km')} إلى أمتار. كيلو تعني 1000، إذن <code>2.5 × 1000 = 2500 m</code>. حوّل 3 دقائق إلى ثوانٍ: <code>3 × 60 = 180 s</code>.`),
          ],
          practice: ['school:lengthConvert', 'school:timeConvert', 'school:massConvert', 'school:speedConvert'],
          checks: [
            ck('What does the prefix "kilo" mean?', ['× 1000', '× 100', '÷ 1000', '× 10'],
              'Kilo = 1000: 1 kilometre = 1000 metres, 1 kilogram = 1000 grams.',
              'ماذا تعني البادئة "كيلو"؟', ['× 1000', '× 100', '÷ 1000', '× 10'],
              'كيلو = 1000: الكيلومتر = 1000 متر، والكيلوغرام = 1000 غرام.'),
            ck('How many seconds are in one hour?', ['3600', '60', '100', '1000'],
              '1 hour = 60 minutes × 60 seconds = 3600 s.',
              'كم ثانية في الساعة الواحدة؟', ['3600', '60', '100', '1000'],
              `الساعة = 60 دقيقة × 60 ثانية = ${nu(3600, 's')}.`),
            ck('Which is the biggest length?', ['1 km', '1 m', '1 cm', '1 mm'],
              'km (1000 m) > m > cm (0.01 m) > mm (0.001 m).',
              'أي هذه الأطوال هو الأكبر؟', ['1 km', '1 m', '1 cm', '1 mm'],
              iso('km (1000 m) > m > cm (0.01 m) > mm (0.001 m)')),
          ],
        },
      ],
    },

    {
      id: 'motion', icon: '🏃', topic: 'kinematics',
      title: tt('Motion', 'الحركة'),
      lessons: [
        {
          id: 'speed', title: tt('Speed', 'السرعة'),
          cards: [
            card('<b>Speed</b> tells you how fast something moves: the distance it covers every second. Formula: <code>v = d / t</code>, where v is speed (m/s), d is distance (m) and t is time (s).',
              `<b>السرعة</b> تخبرك بمدى سرعة حركة الجسم: المسافة التي يقطعها في كل ثانية. القانون: <code>v = d / t</code>، حيث v السرعة (${x('m/s')})، وd المسافة (${x('m')})، وt الزمن (${x('s')}).`),
            card('You can rearrange it: <code>d = v · t</code> to find distance, or <code>t = d / v</code> to find time. A cyclist at 5 m/s for 10 s travels <code>5 × 10 = 50 m</code>.',
              `يمكنك إعادة ترتيبه: <code>d = v · t</code> لإيجاد المسافة، أو <code>t = d / v</code> لإيجاد الزمن. دراج بسرعة ${x('5 m/s')} لمدة ${x('10 s')} يقطع <code>5 × 10 = 50 m</code>.`),
            card('<b>Velocity</b> is speed <i>with a direction</i> (for example 20 m/s north). Most real trips change speed, so we often use <b>average speed</b> = total distance ÷ total time.',
              `<b>السرعة المتجهة</b> هي السرعة <i>مع الاتجاه</i> (مثل ${x('20 m/s')} نحو الشمال). معظم الرحلات الحقيقية تتغير فيها السرعة، لذا نستخدم غالبًا <b>متوسط السرعة</b> = المسافة الكلية ÷ الزمن الكلي.`),
            example('<b>Example:</b> a runner covers 400 m in 80 s. <code>v = d / t = 400 / 80 = 5 m/s</code>.',
              `<b>مثال:</b> يقطع عدّاء ${x('400 m')} في ${x('80 s')}. <code>v = d / t = 400 / 80 = 5 m/s</code>.`),
          ],
          practice: ['kinematics:simpleSpeed', 'kinematics:constantVelocity'],
          checks: [
            ck('Speed is…', ['distance divided by time', 'time divided by distance', 'distance times time', 'mass times distance'],
              'v = d / t: the distance covered each second.',
              'السرعة هي…', ['المسافة مقسومة على الزمن', 'الزمن مقسوم على المسافة', 'المسافة مضروبة في الزمن', 'الكتلة مضروبة في المسافة'],
              `${iso('v = d / t')}: المسافة المقطوعة في كل ثانية.`),
            ck('What is the difference between speed and velocity?', ['Velocity includes a direction', 'Velocity is always bigger', 'Speed includes a direction', 'There is no difference'],
              'Velocity = speed + direction. Two cars at 50 km/h going opposite ways have the same speed but different velocities.',
              'ما الفرق بين السرعة القياسية والسرعة المتجهة؟', ['المتجهة تتضمن الاتجاه', 'المتجهة دائمًا أكبر', 'القياسية تتضمن الاتجاه', 'لا يوجد فرق'],
              `السرعة المتجهة = السرعة + الاتجاه. سيارتان بسرعة ${nu(50, 'km/h')} في اتجاهين متعاكسين لهما السرعة القياسية نفسها لكن سرعتين متجهتين مختلفتين.`),
            ck('A car moves at a steady 20 m/s. How far does it go in 3 s?', ['60 m', '23 m', '6.7 m', '17 m'],
              'd = v · t = 20 × 3 = 60 m.',
              `تتحرك سيارة بسرعة ثابتة ${nu(20, 'm/s')}. ما المسافة التي تقطعها في ${nu(3, 's')}؟`, ['60 m', '23 m', '6.7 m', '17 m'],
              `${iso('d = v · t = 20 × 3 = 60 m')}.`),
          ],
        },
        {
          id: 'acceleration', title: tt('Acceleration', 'التسارع'),
          cards: [
            card('<b>Acceleration</b> is how quickly velocity changes. If a car goes from 0 to 20 m/s in 4 s, its speed grows by 5 m/s every second: its acceleration is <b>5 m/s²</b>.',
              `<b>التسارع</b> هو معدل تغيّر السرعة. إذا انتقلت سيارة من 0 إلى ${x('20 m/s')} خلال ${x('4 s')}، فإن سرعتها تزداد ${x('5 m/s')} كل ثانية: تسارعها <b>${x('5 m/s²')}</b>.`),
            card('Formula: <code>a = (v − u) / t</code>, where u is the starting velocity and v the final velocity. The unit m/s² means "metres per second, every second".',
              `القانون: <code>a = (v − u) / t</code>، حيث u السرعة الابتدائية وv السرعة النهائية. الوحدة ${x('m/s²')} تعني "متر لكل ثانية، في كل ثانية".`),
            card('Rearranged: <code>v = u + a · t</code>. Slowing down is also acceleration, just negative. We call it <b>deceleration</b>.',
              'بإعادة الترتيب: <code>v = u + a · t</code>. التباطؤ أيضًا تسارع لكنه سالب، ونسميه <b>تباطؤًا</b>.'),
            example('<b>Example:</b> a bike starts from rest (u = 0) and accelerates at 2 m/s² for 6 s. <code>v = u + a·t = 0 + 2 × 6 = 12 m/s</code>.',
              `<b>مثال:</b> تبدأ دراجة من السكون (${x('u = 0')}) وتتسارع بمعدل ${x('2 m/s²')} لمدة ${x('6 s')}. <code>v = u + a·t = 0 + 2 × 6 = 12 m/s</code>.`),
          ],
          practice: ['kinematics:finalSpeed', 'school:accelFromSpeeds'],
          checks: [
            ck('What does an acceleration of 3 m/s² mean?', ['Velocity increases by 3 m/s every second', 'The object moves 3 m every second', 'The object moves at 3 m/s', 'The object stops after 3 s'],
              'Acceleration is the change in velocity per second.',
              `ماذا يعني تسارع مقداره ${nu(3, 'm/s²')}؟`, [`تزداد السرعة ${nu(3, 'm/s')} كل ثانية`, `يقطع الجسم ${nu(3, 'm')} كل ثانية`, `يتحرك الجسم بسرعة ${nu(3, 'm/s')}`, `يتوقف الجسم بعد ${nu(3, 's')}`],
              'التسارع هو التغير في السرعة في كل ثانية.'),
            ck('A car moves at a constant 60 km/h on a straight road. Its acceleration is…', ['Zero', '60 km/h', 'Positive', 'Negative'],
              'Constant velocity means no change in velocity, so the acceleration is zero.',
              `سيارة تسير بسرعة ثابتة ${nu(60, 'km/h')} على طريق مستقيم. تسارعها…`, ['صفر', '60 km/h', 'موجب', 'سالب'],
              'السرعة الثابتة تعني عدم تغيّر السرعة، إذن التسارع صفر.'),
            ck('A car brakes and slows down. We say it is…', ['Decelerating (negative acceleration)', 'Accelerating positively', 'Moving at constant velocity', 'Weightless'],
              'Slowing down means velocity decreases: a negative acceleration, also called deceleration.',
              'تضغط سيارة على المكابح فتتباطأ. نقول إنها…', ['تتباطأ (تسارع سالب)', 'تتسارع تسارعًا موجبًا', 'تتحرك بسرعة ثابتة', 'عديمة الوزن'],
              'التباطؤ يعني نقصان السرعة: أي تسارع سالب.'),
          ],
        },
        {
          id: 'falling', title: tt('Falling objects', 'الأجسام الساقطة'),
          cards: [
            card('Near Earth\'s surface, gravity makes every falling object speed up by about <b>9.8 m/s every second</b>. We call this <b>g</b>. In School we round it to <code>g = 10 m/s²</code> to keep the maths easy.',
              `قرب سطح الأرض، تجعل الجاذبية كل جسم ساقط تزداد سرعته بنحو <b>${x('9.8 m/s')} كل ثانية</b>. نسمي هذا <b>g</b>. في المدرسة نقرّبها إلى <code>g = 10 m/s²</code> لتسهيل الحساب.`),
            card('Without air, a feather and a hammer fall <b>together</b>: the acceleration doesn\'t depend on mass. On Earth, a feather falls slowly only because air pushes against it (<b>air resistance</b>).',
              'بدون هواء، تسقط الريشة والمطرقة <b>معًا</b>: التسارع لا يعتمد على الكتلة. على الأرض، تسقط الريشة ببطء فقط لأن الهواء يدفعها (<b>مقاومة الهواء</b>).'),
            card('A dropped object starts at rest, so after t seconds its speed is <code>v = g · t</code>. After 3 s it is falling at <code>10 × 3 = 30 m/s</code>!',
              `الجسم الذي يُسقط يبدأ من السكون، لذا بعد t ثانية تكون سرعته <code>v = g · t</code>. بعد ${x('3 s')} تكون سرعته <code>10 × 3 = 30 m/s</code>!`),
            example('<b>Example:</b> a stone is dropped from a bridge and hits the water after 2 s. Its speed just before impact: <code>v = g·t = 10 × 2 = 20 m/s</code>.',
              `<b>مثال:</b> أُسقط حجر من فوق جسر فاصطدم بالماء بعد ${x('2 s')}. سرعته قبل الاصطدام مباشرة: <code>v = g·t = 10 × 2 = 20 m/s</code>.`),
          ],
          practice: ['school:fallSpeed'],
          checks: [
            ck('Without air resistance, a heavy ball and a light ball are dropped together. Which lands first?', ['They land together', 'The heavy ball', 'The light ball', 'It depends on their colour'],
              'All objects fall with the same acceleration g when there is no air resistance.',
              'بدون مقاومة الهواء، أُسقطت كرة ثقيلة وكرة خفيفة معًا. أيهما تصل أولًا؟', ['تصلان معًا', 'الكرة الثقيلة', 'الكرة الخفيفة', 'يعتمد على لونهما'],
              'تسقط جميع الأجسام بالتسارع نفسه g عند غياب مقاومة الهواء.'),
            ck('Why does a feather fall slowly on Earth?', ['Air resistance pushes against it', "Gravity doesn't pull feathers", 'Feathers have no mass', 'Feathers are magnetic'],
              'Gravity pulls the feather, but air resistance is large compared with its small weight.',
              'لماذا تسقط الريشة ببطء على الأرض؟', ['لأن مقاومة الهواء تدفعها', 'لأن الجاذبية لا تجذب الريش', 'لأن الريشة ليس لها كتلة', 'لأن الريش مغناطيسي'],
              'الجاذبية تجذب الريشة، لكن مقاومة الهواء كبيرة مقارنة بوزنها الصغير.'),
            ck('What is the approximate value of g on Earth?', ['9.8 m/s²', '1 m/s²', '98 m/s²', '0 m/s²'],
              'g ≈ 9.8 m/s², often rounded to 10 m/s².',
              'ما القيمة التقريبية لـ g على الأرض؟', ['9.8 m/s²', '1 m/s²', '98 m/s²', '0 m/s²'],
              `${iso('g ≈ 9.8 m/s²')}، وكثيرًا ما تُقرَّب إلى ${nu(10, 'm/s²')}.`),
          ],
        },
      ],
    },

    {
      id: 'forces', icon: '🧲', topic: 'forces',
      title: tt('Forces', 'القوى'),
      lessons: [
        {
          id: 'what-is-force', title: tt('What is a force?', 'ما القوة؟'),
          cards: [
            card('A <b>force</b> is a push or a pull. Forces can start motion, stop it, speed it up, slow it down or change its direction. Forces are measured in <b>newtons (N)</b>.',
              '<b>القوة</b> دفع أو سحب. يمكن للقوى أن تبدأ الحركة أو توقفها أو تسرّعها أو تبطئها أو تغيّر اتجاهها. تقاس القوى <b>بالنيوتن (N)</b>.'),
            card('When several forces act, we add them up to get the <b>net force</b>. Forces in opposite directions subtract: 50 N forward and 20 N backward give a net force of 30 N forward.',
              `عندما تؤثر عدة قوى نجمعها لنحصل على <b>القوة المحصلة</b>. القوى المتعاكسة تُطرح: ${x('50 N')} إلى الأمام و${x('20 N')} إلى الخلف تعطي قوة محصلة ${x('30 N')} إلى الأمام.`),
            card('<b>Newton\'s first law:</b> if the net force is zero (the forces are <b>balanced</b>), an object stays still or keeps moving at the same velocity. Only an <b>unbalanced</b> force changes motion.',
              '<b>قانون نيوتن الأول:</b> إذا كانت القوة المحصلة صفرًا (القوى <b>متزنة</b>)، يبقى الجسم ساكنًا أو يستمر في الحركة بالسرعة نفسها. القوة <b>غير المتزنة</b> وحدها تغيّر الحركة.'),
            example('<b>Example:</b> in a tug-of-war, team A pulls with 300 N and team B with 300 N. The net force is <code>300 − 300 = 0 N</code>, so the rope doesn\'t move.',
              `<b>مثال:</b> في لعبة شد الحبل، يسحب الفريق الأول بقوة ${x('300 N')} والفريق الثاني بقوة ${x('300 N')}. القوة المحصلة <code>300 − 300 = 0 N</code>، لذا لا يتحرك الحبل.`),
          ],
          practice: ['forces:netForce'],
          checks: [
            ck('A force is…', ['a push or a pull', 'a type of energy', 'the speed of an object', 'the mass of an object'],
              'Forces are pushes and pulls, measured in newtons.',
              'القوة هي…', ['دفع أو سحب', 'نوع من الطاقة', 'سرعة الجسم', 'كتلة الجسم'],
              'القوى دفع وسحب، وتقاس بالنيوتن.'),
            ck('Two forces act on a box: 40 N to the right and 10 N to the left. What is the net force?', ['30 N to the right', '50 N to the right', '30 N to the left', '0 N'],
              'Opposite forces subtract: 40 − 10 = 30 N, in the direction of the bigger force.',
              `تؤثر في صندوق قوتان: ${nu(40, 'N')} نحو اليمين و${nu(10, 'N')} نحو اليسار. ما القوة المحصلة؟`, [`${nu(30, 'N')} نحو اليمين`, `${nu(50, 'N')} نحو اليمين`, `${nu(30, 'N')} نحو اليسار`, '0 N'],
              `القوى المتعاكسة تُطرح: ${iso('40 − 10 = 30 N')} في اتجاه القوة الأكبر.`),
            ck('A hockey puck slides on perfectly smooth ice with no friction. What happens?', ['It keeps sliding at the same speed', 'It slows down and stops', 'It speeds up', 'It turns around'],
              "Newton's first law: with no net force, velocity doesn't change.",
              'قرص هوكي ينزلق على جليد أملس تمامًا بلا احتكاك. ماذا يحدث؟', ['يستمر في الانزلاق بالسرعة نفسها', 'يتباطأ ثم يتوقف', 'يتسارع', 'يعود أدراجه'],
              'قانون نيوتن الأول: بغياب القوة المحصلة لا تتغير السرعة.'),
          ],
        },
        {
          id: 'newton2', title: tt("Newton's second law", 'قانون نيوتن الثاني'),
          cards: [
            card('The bigger the net force, the bigger the acceleration. The bigger the mass, the harder it is to accelerate. Newton put this in one formula: <code>F = m · a</code>.',
              'كلما زادت القوة المحصلة زاد التسارع، وكلما زادت الكتلة صعُب تسريع الجسم. جمع نيوتن ذلك في قانون واحد: <code>F = m · a</code>.'),
            card('F is the net force in newtons (N), m is the mass in kilograms (kg) and a is the acceleration in m/s². In fact, 1 N is exactly the force that gives 1 kg an acceleration of 1 m/s².',
              `F القوة المحصلة بالنيوتن (${x('N')})، وm الكتلة بالكيلوغرام (${x('kg')})، وa التسارع بوحدة ${x('m/s²')}. في الحقيقة، ${x('1 N')} هو بالضبط القوة التي تُكسب ${x('1 kg')} تسارعًا مقداره ${x('1 m/s²')}.`),
            card('Rearranged: <code>a = F / m</code>. Push an empty shopping trolley and a full one with the same force: the empty one (less mass) accelerates much more.',
              'بإعادة الترتيب: <code>a = F / m</code>. ادفع عربة تسوق فارغة وأخرى ممتلئة بالقوة نفسها: الفارغة (كتلتها أقل) تتسارع أكثر بكثير.'),
            example('<b>Example:</b> what force gives a 1200 kg car an acceleration of 2 m/s²? <code>F = m·a = 1200 × 2 = 2400 N</code>.',
              `<b>مثال:</b> ما القوة التي تُكسب سيارة كتلتها ${x('1200 kg')} تسارعًا مقداره ${x('2 m/s²')}؟ <code>F = m·a = 1200 × 2 = 2400 N</code>.`),
          ],
          practice: ['forces:newtonSecond', 'forces:accelerationFromForce'],
          checks: [
            ck('The same force pushes a 1 kg ball and a 5 kg ball. Which accelerates more?', ['The 1 kg ball', 'The 5 kg ball', 'They accelerate equally', 'Neither moves'],
              'a = F / m: smaller mass means bigger acceleration.',
              `تدفع القوة نفسها كرة كتلتها ${nu(1, 'kg')} وأخرى كتلتها ${nu(5, 'kg')}. أيهما تتسارع أكثر؟`, [`الكرة ${nu(1, 'kg')}`, `الكرة ${nu(5, 'kg')}`, 'تتسارعان بالتساوي', 'لا تتحرك أي منهما'],
              `${iso('a = F / m')}: الكتلة الأصغر تعني تسارعًا أكبر.`),
            ck('If you double the net force on an object, its acceleration…', ['Doubles', 'Halves', 'Stays the same', 'Becomes zero'],
              'a = F / m, so a is proportional to F.',
              'إذا ضاعفت القوة المحصلة المؤثرة في جسم، فإن تسارعه…', ['يتضاعف', 'ينقص إلى النصف', 'يبقى كما هو', 'يصبح صفرًا'],
              `${iso('a = F / m')}، إذن التسارع يتناسب طرديًا مع القوة.`),
            ck('One newton (1 N) is the force that…', ['gives 1 kg an acceleration of 1 m/s²', 'lifts 1 kg by 1 m', 'moves an object 1 m in 1 s', 'gives 1 g a speed of 1 m/s'],
              'From F = m·a: 1 N = 1 kg × 1 m/s².',
              `النيوتن الواحد (${iso('1 N')}) هو القوة التي…`, [`تُكسب ${nu(1, 'kg')} تسارعًا ${nu(1, 'm/s²')}`, `ترفع ${nu(1, 'kg')} مسافة ${nu(1, 'm')}`, `تحرّك جسمًا ${nu(1, 'm')} في ${nu(1, 's')}`, `تُكسب ${nu(1, 'g')} سرعة ${nu(1, 'm/s')}`],
              `من ${iso('F = m·a')}: ${iso('1 N = 1 kg × 1 m/s²')}.`),
          ],
        },
        {
          id: 'weight-friction', title: tt('Weight, friction and action–reaction', 'الوزن والاحتكاك والفعل ورد الفعل'),
          cards: [
            card('<b>Mass</b> (kg) is how much matter something has. <b>Weight</b> (N) is the force of gravity on it: <code>W = m · g</code>. A 50 kg student weighs <code>50 × 10 = 500 N</code> on Earth but only about 80 N on the Moon. Their mass is still 50 kg!',
              `<b>الكتلة</b> (${x('kg')}) مقدار ما في الجسم من مادة. <b>الوزن</b> (${x('N')}) قوة جذب الأرض له: <code>W = m · g</code>. طالب كتلته ${x('50 kg')} يزن <code>50 × 10 = 500 N</code> على الأرض، لكن نحو ${x('80 N')} فقط على القمر، وكتلته تبقى ${x('50 kg')}!`),
            card('<b>Friction</b> is a force that opposes sliding. It slows things down and turns motion energy into heat (rub your hands together!). Without friction you couldn\'t even walk.',
              '<b>الاحتكاك</b> قوة تعاكس الانزلاق. يبطئ الأجسام ويحوّل طاقة الحركة إلى حرارة (افرك يديك!). بدون احتكاك لا تستطيع حتى المشي.'),
            card('<b>Newton\'s third law:</b> forces come in pairs. If you push on a wall, the wall pushes back on you with an equal force in the opposite direction. A rocket pushes gas down, and the gas pushes the rocket up.',
              '<b>قانون نيوتن الثالث:</b> القوى تأتي أزواجًا. إذا دفعت جدارًا يدفعك الجدار بقوة مساوية في الاتجاه المعاكس. الصاروخ يدفع الغازات إلى الأسفل، فتدفعه الغازات إلى الأعلى.'),
            example('<b>Example:</b> a 7 kg bowling ball weighs <code>W = m·g = 7 × 10 = 70 N</code>.',
              `<b>مثال:</b> كرة بولينج كتلتها ${x('7 kg')} وزنها <code>W = m·g = 7 × 10 = 70 N</code>.`),
          ],
          practice: ['forces:weight'],
          checks: [
            ck('An astronaut has a mass of 80 kg on Earth. On the Moon their mass is…', ['80 kg', '13 kg', '0 kg', '800 kg'],
              'Mass never changes with location. Only weight changes, because g on the Moon is smaller.',
              `رائد فضاء كتلته ${nu(80, 'kg')} على الأرض. كتلته على القمر…`, ['80 kg', '13 kg', '0 kg', '800 kg'],
              'الكتلة لا تتغير بتغير المكان. الوزن فقط يتغير لأن g على القمر أصغر.'),
            ck('Which force opposes an object sliding across a floor?', ['Friction', 'Weight', 'Magnetism', 'Tension'],
              'Friction acts against the direction of sliding.',
              'أي قوة تعاكس انزلاق جسم على الأرض؟', ['الاحتكاك', 'الوزن', 'المغناطيسية', 'الشد'],
              'الاحتكاك يؤثر عكس اتجاه الانزلاق.'),
            ck('You push a wall with 100 N. How hard does the wall push you?', ['100 N, in the opposite direction', "0 N, walls can't push", '50 N', '200 N'],
              "Newton's third law: equal and opposite forces.",
              `تدفع جدارًا بقوة ${nu(100, 'N')}. بأي قوة يدفعك الجدار؟`, [`${nu(100, 'N')} في الاتجاه المعاكس`, `${nu(0, 'N')}، فالجدران لا تدفع`, '50 N', '200 N'],
              'قانون نيوتن الثالث: قوتان متساويتان ومتعاكستان.'),
          ],
        },
      ],
    },

    {
      id: 'energy', icon: '⚡', topic: 'energy',
      title: tt('Energy', 'الطاقة'),
      lessons: [
        {
          id: 'what-is-energy', title: tt('What is energy?', 'ما الطاقة؟'),
          cards: [
            card('<b>Energy</b> is what makes things happen: it lets things move, heat up, light up and make sound. It is measured in <b>joules (J)</b>.',
              '<b>الطاقة</b> هي ما يجعل الأشياء تحدث: تجعلها تتحرك وتسخن وتضيء وتُصدر صوتًا. تقاس <b>بالجول (J)</b>.'),
            card('Energy comes in many forms: <b>kinetic</b> (motion), <b>potential</b> (stored by height or in a stretched spring), <b>thermal</b> (heat), <b>chemical</b> (food, fuel, batteries), <b>electrical</b>, <b>light</b> and <b>sound</b>.',
              'للطاقة أشكال كثيرة: <b>حركية</b> (الحركة)، و<b>طاقة وضع</b> (مختزنة بالارتفاع أو في نابض مشدود)، و<b>حرارية</b>، و<b>كيميائية</b> (الطعام والوقود والبطاريات)، و<b>كهربائية</b>، و<b>ضوئية</b>، و<b>صوتية</b>.'),
            card('<b>Conservation of energy:</b> energy can\'t be created or destroyed, only changed from one form to another. A falling ball turns potential energy into kinetic energy; brakes turn kinetic energy into heat.',
              '<b>حفظ الطاقة:</b> الطاقة لا تفنى ولا تُستحدث من العدم، بل تتحول من شكل إلى آخر. الكرة الساقطة تحوّل طاقة الوضع إلى طاقة حركية، والمكابح تحوّل الطاقة الحركية إلى حرارة.'),
            example('<b>Example:</b> a 2 kg book falls from a shelf 1.5 m high. It had <code>PE = m·g·h = 2 × 10 × 1.5 = 30 J</code>. Just before landing, all 30 J has become kinetic energy.',
              `<b>مثال:</b> يسقط كتاب كتلته ${x('2 kg')} من رف ارتفاعه ${x('1.5 m')}. كانت طاقة وضعه <code>PE = m·g·h = 2 × 10 × 1.5 = 30 J</code>. قبل ارتطامه مباشرة تتحول هذه الـ ${x('30 J')} كلها إلى طاقة حركية.`),
          ],
          practice: ['school:energyConservation'],
          checks: [
            ck('What is the unit of energy?', ['Joule (J)', 'Newton (N)', 'Watt (W)', 'Kilogram (kg)'],
              'Energy is measured in joules.',
              'ما وحدة الطاقة؟', ['الجول (J)', 'النيوتن (N)', 'الواط (W)', 'الكيلوغرام (kg)'],
              'تقاس الطاقة بالجول.'),
            ck('A battery stores energy in which form?', ['Chemical', 'Kinetic', 'Sound', 'Nuclear'],
              'Batteries store chemical energy and turn it into electrical energy.',
              'بأي شكل تختزن البطارية الطاقة؟', ['كيميائية', 'حركية', 'صوتية', 'نووية'],
              'تختزن البطاريات طاقة كيميائية وتحوّلها إلى طاقة كهربائية.'),
            ck('According to the law of conservation of energy…', ['Energy changes form but the total stays the same', 'Energy is used up and disappears', 'Energy can be created from nothing', 'Only kinetic energy is conserved'],
              'Energy is never lost; it only changes form (often into heat).',
              'وفق قانون حفظ الطاقة…', ['الطاقة تتحول من شكل إلى آخر ويبقى مجموعها ثابتًا', 'الطاقة تُستهلك وتختفي', 'يمكن استحداث الطاقة من العدم', 'الطاقة الحركية وحدها محفوظة'],
              'الطاقة لا تضيع أبدًا، بل تتحول من شكل إلى آخر (غالبًا إلى حرارة).'),
            ck('When you rub your hands together, kinetic energy turns into…', ['Thermal energy (heat)', 'Chemical energy', 'Nuclear energy', 'Potential energy'],
              "Friction turns motion into heat. That's why your hands get warm.",
              'عندما تفرك يديك، تتحول الطاقة الحركية إلى…', ['طاقة حرارية', 'طاقة كيميائية', 'طاقة نووية', 'طاقة وضع'],
              'الاحتكاك يحوّل الحركة إلى حرارة، ولهذا تدفأ يداك.'),
          ],
        },
        {
          id: 'ke-pe', title: tt('Kinetic and potential energy', 'الطاقة الحركية وطاقة الوضع'),
          cards: [
            card('<b>Kinetic energy</b> is energy of motion: <code>KE = ½ · m · v²</code>. Because speed is squared, going twice as fast means <b>four times</b> the energy.',
              '<b>الطاقة الحركية</b> طاقة الحركة: <code>KE = ½ · m · v²</code>. لأن السرعة مربّعة، فإن مضاعفة السرعة تعني طاقة أكبر <b>أربع مرات</b>.'),
            card('<b>Gravitational potential energy</b> is energy stored by height: <code>PE = m · g · h</code>. Lifting something higher stores more energy, which it gives back when it falls.',
              '<b>طاقة الوضع الجاذبية</b> طاقة مختزنة بسبب الارتفاع: <code>PE = m · g · h</code>. رفع الجسم أعلى يختزن طاقة أكبر، ويعيدها عند سقوطه.'),
            card('A roller coaster swaps between them: high and slow at the top (lots of PE), low and fast at the bottom (lots of KE).',
              'قطار الملاهي (الأفعوانية) يتبادل بينهما: عالٍ وبطيء في القمة (طاقة وضع كبيرة)، ومنخفض وسريع في الأسفل (طاقة حركية كبيرة).'),
            example('<b>Example:</b> a 60 kg runner at 5 m/s has <code>KE = ½ × 60 × 5² = ½ × 60 × 25 = 750 J</code>.',
              `<b>مثال:</b> عدّاء كتلته ${x('60 kg')} يجري بسرعة ${x('5 m/s')} طاقته الحركية <code>KE = ½ × 60 × 5² = ½ × 60 × 25 = 750 J</code>.`),
          ],
          practice: ['energy:kinetic', 'energy:potential'],
          checks: [
            ck('If a bike goes twice as fast, its kinetic energy becomes…', ['4 times bigger', '2 times bigger', 'The same', 'Half as big'],
              'KE = ½mv²: doubling v makes v² four times bigger.',
              'إذا تحركت دراجة بضعف سرعتها، فإن طاقتها الحركية تصبح…', ['أكبر 4 مرات', 'أكبر مرتين', 'كما هي', 'النصف'],
              `${iso('KE = ½mv²')}: مضاعفة v تجعل ${iso('v²')} أكبر أربع مرات.`),
            ck('Where does a roller coaster have the most potential energy?', ['At the highest point', 'At the lowest point', 'When it is moving fastest', 'PE is the same everywhere'],
              'PE = m·g·h: the higher it is, the more PE.',
              'أين تكون طاقة الوضع لقطار الملاهي أكبر ما يمكن؟', ['عند أعلى نقطة', 'عند أدنى نقطة', 'عندما يكون أسرع ما يمكن', 'طاقة الوضع نفسها في كل مكان'],
              `${iso('PE = m·g·h')}: كلما زاد الارتفاع زادت طاقة الوضع.`),
            ck('A parked car has…', ['No kinetic energy', 'Lots of kinetic energy', 'Negative kinetic energy', 'Kinetic energy equal to its weight'],
              'KE = ½mv² and v = 0, so KE = 0.',
              'سيارة متوقفة لديها…', ['طاقة حركية صفرية', 'طاقة حركية كبيرة', 'طاقة حركية سالبة', 'طاقة حركية تساوي وزنها'],
              `${iso('KE = ½mv²')} و${iso('v = 0')}، إذن ${iso('KE = 0')}.`),
          ],
        },
        {
          id: 'work-power', title: tt('Work and power', 'الشغل والقدرة'),
          cards: [
            card('In physics, you do <b>work</b> when a force moves something: <code>W = F · d</code> (force × distance in the direction of the force). Work is energy transferred, so it\'s measured in joules.',
              'في الفيزياء، تبذل <b>شغلًا</b> عندما تحرّك قوةٌ جسمًا: <code>W = F · d</code> (القوة × المسافة في اتجاه القوة). الشغل طاقة منقولة، لذا يقاس بالجول.'),
            card('Holding a heavy bag without moving it feels tiring, but the work done on the bag is zero: it doesn\'t move!',
              'حمل حقيبة ثقيلة دون تحريكها متعب، لكن الشغل المبذول على الحقيبة صفر: فهي لا تتحرك!'),
            card('<b>Power</b> is how fast work is done: <code>P = W / t</code>, measured in <b>watts (W)</b>. 1 W = 1 J every second. Running up the stairs needs more power than walking, even though the work is the same.',
              `<b>القدرة</b> معدل بذل الشغل: <code>P = W / t</code>، وتقاس <b>بالواط (W)</b>. ${x('1 W = 1 J')} في كل ثانية. صعود الدرج جريًا يحتاج قدرة أكبر من صعوده مشيًا، مع أن الشغل هو نفسه.`),
            example('<b>Example:</b> you push a box with 50 N for 4 m in 2 s. <code>W = F·d = 50 × 4 = 200 J</code>, and <code>P = W/t = 200 / 2 = 100 W</code>.',
              `<b>مثال:</b> تدفع صندوقًا بقوة ${x('50 N')} مسافة ${x('4 m')} خلال ${x('2 s')}. <code>W = F·d = 50 × 4 = 200 J</code>، و<code>P = W/t = 200 / 2 = 100 W</code>.`),
          ],
          practice: ['school:workSimple', 'energy:power'],
          checks: [
            ck('You hold a heavy suitcase still for 5 minutes. How much work do you do on it?', ['Zero', 'A lot', 'It depends on the weight', 'Negative work'],
              'W = F·d and the distance moved is 0, so W = 0.',
              'تحمل حقيبة سفر ثقيلة دون حركة لمدة 5 دقائق. ما الشغل الذي تبذله عليها؟', ['صفر', 'كثير', 'يعتمد على وزنها', 'شغل سالب'],
              `${iso('W = F·d')} والمسافة صفر، إذن ${iso('W = 0')}.`),
            ck('The watt (W) is equal to…', ['1 joule per second', '1 newton per metre', '1 joule × second', '1 kilogram per second'],
              'Power is energy per second: 1 W = 1 J/s.',
              'الواط (W) يساوي…', ['1 جول لكل ثانية', '1 نيوتن لكل متر', '1 جول × ثانية', '1 كيلوغرام لكل ثانية'],
              `القدرة طاقة في الثانية: ${iso('1 W = 1 J/s')}.`),
            ck('Ali runs up the stairs and Sara walks up the same stairs. They weigh the same. Who has more power?', ['Ali, the runner', 'Sara, the walker', 'Same power', 'Neither uses power'],
              'Same work, but Ali does it in less time, so P = W / t is bigger.',
              'صعد علي الدرج جريًا وصعدت سارة الدرج نفسه مشيًا، ولهما الوزن نفسه. من قدرته أكبر؟', ['علي الذي جرى', 'سارة التي مشت', 'القدرة نفسها', 'لا أحد منهما يستخدم قدرة'],
              `الشغل نفسه، لكن علي أنجزه في زمن أقل، لذا ${iso('P = W / t')} أكبر.`),
          ],
        },
      ],
    },

    {
      id: 'momentum', icon: '🎱', topic: 'momentum',
      title: tt('Momentum', 'الزخم'),
      lessons: [
        {
          id: 'momentum-basics', title: tt('Momentum', 'الزخم'),
          cards: [
            card('<b>Momentum</b> measures how hard it is to stop a moving object: <code>p = m · v</code>, in kg·m/s. A slow truck can have more momentum than a fast bicycle because it is so heavy.',
              `<b>الزخم</b> (كمية الحركة) يقيس مدى صعوبة إيقاف جسم متحرك: <code>p = m · v</code>، بوحدة ${x('kg·m/s')}. شاحنة بطيئة قد يكون زخمها أكبر من دراجة سريعة لأنها ثقيلة جدًا.`),
            card('Momentum has a direction, like velocity. A ball moving left and one moving right have momenta in opposite directions.',
              'للزخم اتجاه مثل السرعة المتجهة. كرة تتحرك يسارًا وأخرى تتحرك يمينًا زخماهما في اتجاهين متعاكسين.'),
            card('To change momentum you need a force acting for some time. This is called <b>impulse</b>: <code>F · Δt = Δp</code>. A longer contact time means a smaller force. That\'s why you bend your knees when you land.',
              'لتغيير الزخم تحتاج إلى قوة تؤثر مدةً من الزمن. يسمى ذلك <b>الدفع</b>: <code>F · Δt = Δp</code>. زمن التلامس الأطول يعني قوة أصغر، ولهذا تثني ركبتيك عندما تهبط.'),
            example('<b>Example:</b> a 0.5 kg football moving at 20 m/s has <code>p = m·v = 0.5 × 20 = 10 kg·m/s</code>.',
              `<b>مثال:</b> كرة قدم كتلتها ${x('0.5 kg')} تتحرك بسرعة ${x('20 m/s')} زخمها <code>p = m·v = 0.5 × 20 = 10 kg·m/s</code>.`),
          ],
          practice: ['momentum:momentum', 'momentum:changeInMomentum'],
          checks: [
            ck('Which has the most momentum?', ['A 2000 kg truck at 5 m/s', 'A 60 kg runner at 8 m/s', 'A 0.1 kg ball at 30 m/s', 'A parked 1000 kg car'],
              'p = m·v: truck 10 000, runner 480, ball 3, parked car 0 kg·m/s.',
              'أيها له أكبر زخم؟', [`شاحنة ${nu(2000, 'kg')} بسرعة ${nu(5, 'm/s')}`, `عدّاء ${nu(60, 'kg')} بسرعة ${nu(8, 'm/s')}`, `كرة ${nu(0.1, 'kg')} بسرعة ${nu(30, 'm/s')}`, `سيارة متوقفة كتلتها ${nu(1000, 'kg')}`],
              `${iso('p = m·v')}: الشاحنة 10000، والعدّاء 480، والكرة 3، والسيارة المتوقفة ${nu(0, 'kg·m/s')}.`),
            ck('Why do airbags reduce injuries in a crash?', ['They increase the stopping time, reducing the force', 'They reduce your change in momentum', 'They increase your mass', 'They absorb all of your momentum instantly'],
              'Impulse F·Δt = Δp. Your change in momentum is fixed, so a longer stopping time means a smaller force.',
              'لماذا تقلل الوسائد الهوائية من الإصابات في الحوادث؟', ['تزيد زمن التوقف فتقل القوة', 'تقلل التغير في زخمك', 'تزيد كتلتك', 'تمتص كل زخمك فورًا'],
              `الدفع ${iso('F·Δt = Δp')}. التغير في زخمك ثابت، لذا زمن توقف أطول يعني قوة أصغر.`),
            ck('Why do you bend your knees when you jump down from a wall?', ['To make the stopping time longer and the force smaller', 'To make your momentum bigger', 'To land faster', 'It has no effect'],
              'Your change in momentum is fixed. Stretching the stop over more time (Δt) reduces the force (F·Δt = Δp).',
              'لماذا تثني ركبتيك عندما تقفز من فوق جدار؟', ['لإطالة زمن التوقف وتقليل القوة', 'لزيادة زخمك', 'لتهبط أسرع', 'لا تأثير لذلك'],
              `التغير في زخمك ثابت. إطالة زمن التوقف ${iso('Δt')} تقلل القوة (${iso('F·Δt = Δp')}).`),
          ],
        },
        {
          id: 'collisions', title: tt('Collisions', 'التصادمات'),
          cards: [
            card('In a collision, objects push on each other with equal and opposite forces (Newton\'s third law). The result: the <b>total momentum</b> before equals the total momentum after. This is <b>conservation of momentum</b>.',
              'في التصادم، يدفع كل جسم الآخر بقوتين متساويتين ومتعاكستين (قانون نيوتن الثالث). والنتيجة: <b>الزخم الكلي</b> قبل التصادم يساوي الزخم الكلي بعده. هذا هو <b>حفظ الزخم</b>.'),
            card('When objects stick together: <code>m₁·v₁ = (m₁ + m₂)·v</code>. A moving car hitting a parked car of the same mass: they move off together at half the speed.',
              'عندما يلتحم الجسمان معًا: <code>m₁·v₁ = (m₁ + m₂)·v</code>. سيارة متحركة تصطدم بسيارة متوقفة لها الكتلة نفسها: تتحركان معًا بنصف السرعة.'),
            card('Explosions and recoil work the same way: before, the total momentum is zero; after, the pieces fly apart in opposite directions so their momenta still add up to zero.',
              'الانفجارات والارتداد تعمل بالطريقة نفسها: قبلها يكون الزخم الكلي صفرًا، وبعدها تتطاير الأجزاء في اتجاهين متعاكسين بحيث يبقى مجموع زخميهما صفرًا.'),
            example('<b>Example:</b> a 2 kg trolley at 6 m/s hits a still 1 kg trolley and they stick. <code>v = 2 × 6 / (2 + 1) = 4 m/s</code>.',
              `<b>مثال:</b> عربة كتلتها ${x('2 kg')} بسرعة ${x('6 m/s')} تصطدم بعربة ساكنة كتلتها ${x('1 kg')} فتلتحمان. <code>v = 2 × 6 / (2 + 1) = 4 m/s</code>.`),
          ],
          practice: ['momentum:inelastic'],
          checks: [
            ck('A skater standing still throws a heavy ball forward. What happens to the skater?', ['They glide backward', 'They stay still', 'They glide forward', 'They spin'],
              'Total momentum was zero before, so it must be zero after: the ball goes forward, the skater goes backward.',
              'متزلج ساكن يرمي كرة ثقيلة إلى الأمام. ماذا يحدث له؟', ['ينزلق إلى الخلف', 'يبقى ساكنًا', 'ينزلق إلى الأمام', 'يدور حول نفسه'],
              'الزخم الكلي كان صفرًا، فيجب أن يبقى صفرًا: الكرة تتحرك إلى الأمام والمتزلج إلى الخلف.'),
            ck('Two ice skaters at rest push each other apart. What is their total momentum afterwards?', ['Zero', 'Bigger than before', "Equal to the heavier skater's momentum", 'It depends on who pushes harder'],
              'Momentum is conserved: it was zero before, so it is zero after. They move in opposite directions.',
              'متزلجان ساكنان يدفع كل منهما الآخر فيتباعدان. ما زخمهما الكلي بعد ذلك؟', ['صفر', 'أكبر مما كان', 'يساوي زخم المتزلج الأثقل', 'يعتمد على من يدفع أقوى'],
              'الزخم محفوظ: كان صفرًا قبل الدفع فيبقى صفرًا بعده، ويتحركان في اتجاهين متعاكسين.'),
            ck('A moving car crashes into an identical parked car and they stick together. Their speed just after is…', ['Half the first car\'s speed', 'The same as the first car\'s speed', 'Double the first car\'s speed', 'Zero'],
              'm·v = (m + m)·v_after, so v_after = v / 2.',
              'سيارة متحركة تصطدم بسيارة متوقفة مماثلة لها فتلتحمان. سرعتهما بعد التصادم مباشرة…', ['نصف سرعة السيارة الأولى', 'مساوية لسرعة السيارة الأولى', 'ضعف سرعة السيارة الأولى', 'صفر'],
              `${iso('m·v = (m + m)·v_after')}، إذن ${iso('v_after = v / 2')}.`),
          ],
        },
      ],
    },

    {
      id: 'waves', icon: '🌊', topic: 'waves',
      title: tt('Waves and sound', 'الموجات والصوت'),
      lessons: [
        {
          id: 'what-is-wave', title: tt('What is a wave?', 'ما الموجة؟'),
          cards: [
            card('A <b>wave</b> carries energy from place to place without carrying matter. When a wave passes through water, the water mostly bobs up and down while the wave moves along.',
              '<b>الموجة</b> تنقل الطاقة من مكان إلى آخر دون أن تنقل المادة. عندما تمر موجة في الماء، يتحرك الماء صعودًا وهبوطًا في مكانه تقريبًا بينما تنتقل الموجة.'),
            card('Words to know: <b>amplitude</b> (how big the wave is), <b>wavelength λ</b> (distance from one crest to the next, in m) and <b>frequency f</b> (waves per second, in <b>hertz, Hz</b>).',
              `مصطلحات مهمة: <b>السعة</b> (مقدار ارتفاع الموجة)، و<b>الطول الموجي λ</b> (المسافة بين قمتين متتاليتين، بالمتر)، و<b>التردد f</b> (عدد الموجات في الثانية، <b>بالهيرتز ${x('Hz')}</b>).`),
            card('The <b>period T</b> is the time for one complete wave: <code>T = 1 / f</code>. A 2 Hz wave makes 2 waves every second, so each one takes 0.5 s.',
              `<b>الزمن الدوري T</b> هو زمن موجة كاملة واحدة: <code>T = 1 / f</code>. موجة ترددها ${x('2 Hz')} تصنع موجتين كل ثانية، إذن تستغرق كل واحدة ${x('0.5 s')}.`),
            example('<b>Example:</b> a buoy bobs 30 times in 60 s. <code>f = 30 / 60 = 0.5 Hz</code> and <code>T = 1 / 0.5 = 2 s</code>.',
              `<b>مثال:</b> تتمايل عوّامة 30 مرة في ${x('60 s')}. <code>f = 30 / 60 = 0.5 Hz</code> و<code>T = 1 / 0.5 = 2 s</code>.`),
          ],
          practice: ['waves:period', 'waves:frequencyCount'],
          checks: [
            ck('What does a wave transfer?', ['Energy', 'Matter', 'Water only', 'Nothing'],
              'Waves carry energy, not matter.',
              'ماذا تنقل الموجة؟', ['الطاقة', 'المادة', 'الماء فقط', 'لا شيء'],
              'الموجات تنقل الطاقة لا المادة.'),
            ck('The distance from one crest to the next crest is the…', ['Wavelength', 'Amplitude', 'Frequency', 'Period'],
              'Wavelength λ is the length of one complete wave.',
              'المسافة بين قمة والقمة التالية هي…', ['الطول الموجي', 'السعة', 'التردد', 'الزمن الدوري'],
              'الطول الموجي λ هو طول موجة كاملة واحدة.'),
            ck('Frequency is measured in…', ['Hertz (Hz)', 'Metres (m)', 'Seconds (s)', 'Newtons (N)'],
              '1 Hz = one wave per second.',
              'يقاس التردد بوحدة…', ['الهيرتز (Hz)', 'المتر (m)', 'الثانية (s)', 'النيوتن (N)'],
              `${iso('1 Hz')} = موجة واحدة في الثانية.`),
          ],
        },
        {
          id: 'wave-equation', title: tt('The wave equation', 'معادلة الموجة'),
          cards: [
            card('Every second, a wave makes f waves, each λ long. So in one second it travels f × λ metres: <code>v = f · λ</code>.',
              'في كل ثانية تصنع الموجة f من الموجات، طول كل منها λ. إذن تقطع في الثانية <code>f × λ</code> مترًا: <code>v = f · λ</code>.'),
            card('The speed of a wave depends on what it travels through. Sound in air moves at about <b>340 m/s</b>; in water, about 1500 m/s.',
              `سرعة الموجة تعتمد على الوسط الذي تنتقل فيه. الصوت في الهواء ينتقل بسرعة نحو <b>${x('340 m/s')}</b>، وفي الماء نحو ${x('1500 m/s')}.`),
            card('If the speed stays the same, a higher frequency means a shorter wavelength: <code>λ = v / f</code>. High notes have short wavelengths; low notes have long ones.',
              'إذا بقيت السرعة ثابتة، فإن التردد الأعلى يعني طولًا موجيًا أقصر: <code>λ = v / f</code>. النغمات الحادة أطوالها الموجية قصيرة، والغليظة طويلة.'),
            example('<b>Example:</b> a sound wave in air has f = 170 Hz. <code>λ = v / f = 340 / 170 = 2 m</code>.',
              `<b>مثال:</b> موجة صوتية في الهواء ترددها ${x('170 Hz')}. <code>λ = v / f = 340 / 170 = 2 m</code>.`),
          ],
          practice: ['waves:waveSpeed', 'waves:wavelength'],
          checks: [
            ck('If the frequency of a sound doubles (same speed), its wavelength…', ['Halves', 'Doubles', 'Stays the same', 'Becomes zero'],
              'λ = v / f: double f means half λ.',
              'إذا تضاعف تردد صوت (والسرعة ثابتة)، فإن طوله الموجي…', ['ينقص إلى النصف', 'يتضاعف', 'يبقى كما هو', 'يصبح صفرًا'],
              `${iso('λ = v / f')}: مضاعفة f تعني نصف λ.`),
            ck('Which formula gives the speed of a wave?', ['v = f · λ', 'v = f / λ', 'v = λ / f', 'v = f + λ'],
              'Speed = frequency × wavelength.',
              'أي قانون يعطي سرعة الموجة؟', ['v = f · λ', 'v = f / λ', 'v = λ / f', 'v = f + λ'],
              'السرعة = التردد × الطول الموجي.'),
            ck('About how fast does sound travel in air?', ['340 m/s', '3 m/s', '300 000 km/s', '34 000 m/s'],
              'Sound: about 340 m/s. Light is the one that travels 300 000 km/s!',
              'ما السرعة التقريبية للصوت في الهواء؟', ['340 m/s', '3 m/s', '300 000 km/s', '34 000 m/s'],
              `الصوت نحو ${nu(340, 'm/s')}. أما الضوء فهو الذي يقطع ${nu('300 000', 'km/s')}!`),
          ],
        },
        {
          id: 'sound-light', title: tt('Sound and light', 'الصوت والضوء'),
          cards: [
            card('<b>Sound</b> is a vibration passed from particle to particle, so it needs a <b>medium</b> (air, water, solids). In empty space there is no sound. Higher <b>frequency</b> means higher pitch; bigger <b>amplitude</b> means louder.',
              '<b>الصوت</b> اهتزاز ينتقل من جسيم إلى جسيم، لذا يحتاج إلى <b>وسط</b> (هواء أو ماء أو مواد صلبة). في الفضاء الفارغ لا يوجد صوت. <b>التردد</b> الأعلى يعني صوتًا أحدّ، و<b>السعة</b> الأكبر تعني صوتًا أعلى.'),
            card('An <b>echo</b> is sound bouncing back from a surface. The sound travels there and back, so the distance to the wall is <code>d = v · t / 2</code>. Bats and ships use echoes to find things.',
              '<b>الصدى</b> صوت ينعكس عن سطح. الصوت يذهب ويعود، لذا فإن بُعد الجدار <code>d = v · t / 2</code>. تستخدم الخفافيش والسفن الصدى لتحديد مواقع الأشياء.'),
            card('<b>Light</b> is an electromagnetic wave: it needs no medium and travels at <b>300 000 km/s</b> (3 × 10⁸ m/s), the fastest speed possible. That\'s why you see lightning before you hear thunder.',
              `<b>الضوء</b> موجة كهرومغناطيسية: لا يحتاج إلى وسط وينتقل بسرعة <b>${x('300 000 km/s')}</b> (${x('3 × 10⁸ m/s')})، وهي أعلى سرعة ممكنة. لهذا ترى البرق قبل أن تسمع الرعد.`),
            example('<b>Example:</b> you clap and hear the echo from a cliff after 2 s. <code>d = 340 × 2 / 2 = 340 m</code>.',
              `<b>مثال:</b> تصفّق فتسمع الصدى من جرف بعد ${x('2 s')}. <code>d = 340 × 2 / 2 = 340 m</code>.`),
          ],
          practice: ['waves:echo'],
          checks: [
            ck("Why can't sound travel through outer space?", ['Sound needs a medium (particles) to travel through', 'Space is too cold', 'Sound is absorbed by stars', 'Sound travels too slowly'],
              'Sound is vibrating particles. In a vacuum there are no particles to vibrate.',
              'لماذا لا ينتقل الصوت في الفضاء الخارجي؟', ['لأن الصوت يحتاج إلى وسط (جسيمات) لينتقل فيه', 'لأن الفضاء بارد جدًا', 'لأن النجوم تمتص الصوت', 'لأن الصوت بطيء جدًا'],
              'الصوت جسيمات تهتز. في الفراغ لا توجد جسيمات لتهتز.'),
            ck('A note gets higher in pitch. What has increased?', ['Frequency', 'Amplitude', 'Wavelength', 'Speed of sound'],
              'Pitch depends on frequency. Loudness depends on amplitude.',
              'أصبحت نغمة أكثر حدّة. ما الذي ازداد؟', ['التردد', 'السعة', 'الطول الموجي', 'سرعة الصوت'],
              'الحدّة تعتمد على التردد، والعلوّ يعتمد على السعة.'),
            ck('Why do you see lightning before you hear thunder?', ['Light travels much faster than sound', 'Thunder happens later', 'Sound travels faster than light', 'Your eyes are closer than your ears'],
              'They happen at the same time, but light arrives almost instantly while sound needs about 3 s per km.',
              'لماذا ترى البرق قبل أن تسمع الرعد؟', ['لأن الضوء أسرع بكثير من الصوت', 'لأن الرعد يحدث لاحقًا', 'لأن الصوت أسرع من الضوء', 'لأن عينيك أقرب من أذنيك'],
              `يحدثان في اللحظة نفسها، لكن الضوء يصل فورًا تقريبًا بينما يحتاج الصوت نحو ${nu(3, 's')} لكل كيلومتر.`),
          ],
        },
      ],
    },

    {
      id: 'electricity', icon: '🔌', topic: 'electricity',
      title: tt('Electricity', 'الكهرباء'),
      lessons: [
        {
          id: 'current-voltage', title: tt('Charge, current and voltage', 'الشحنة والتيار والجهد'),
          cards: [
            card('Everything is made of atoms, which contain tiny charged particles. <b>Electrons</b> carry negative charge. When electrons flow through a wire, we get an electric <b>current</b>.',
              'كل شيء مكوّن من ذرات تحتوي على جسيمات مشحونة صغيرة جدًا. <b>الإلكترونات</b> تحمل شحنة سالبة. عندما تتدفق الإلكترونات في سلك نحصل على <b>تيار</b> كهربائي.'),
            card('<b>Current (I)</b> is the rate of flow of charge, measured in <b>amperes (A)</b>: <code>Q = I · t</code>, where Q is the charge in coulombs (C). Think of it like the amount of water flowing through a pipe each second.',
              '<b>التيار (I)</b> معدل تدفق الشحنة، ويقاس <b>بالأمبير (A)</b>: <code>Q = I · t</code>، حيث Q الشحنة بالكولوم (C). تخيّله مثل كمية الماء المتدفقة في أنبوب كل ثانية.'),
            card('<b>Voltage (V)</b>, measured in <b>volts</b>, is the "push" that drives the current, like water pressure. A battery provides this push. Without a complete loop (a <b>circuit</b>), no current flows.',
              '<b>الجهد (V)</b>، ويقاس <b>بالفولت</b>، هو "الدفع" الذي يحرّك التيار، مثل ضغط الماء. البطارية توفر هذا الدفع. وبدون مسار مغلق كامل (<b>دائرة</b>) لا يمر تيار.'),
            example('<b>Example:</b> a current of 2 A flows for 10 s. The charge that passes: <code>Q = I·t = 2 × 10 = 20 C</code>.',
              `<b>مثال:</b> يمر تيار ${x('2 A')} لمدة ${x('10 s')}. الشحنة المارة: <code>Q = I·t = 2 × 10 = 20 C</code>.`),
          ],
          practice: ['school:charge'],
          checks: [
            ck('Which is the best description of electric current?', ['The rate of flow of charge', 'The energy per unit charge', 'The opposition to charge flow', 'The total charge stored'],
              'Current is charge flowing per second. Energy per charge is voltage; opposition to flow is resistance.',
              'ما أفضل وصف للتيار الكهربائي؟', ['معدل تدفق الشحنة', 'الطاقة لكل وحدة شحنة', 'الممانعة لتدفق الشحنة', 'مجموع الشحنة المخزنة'],
              'التيار شحنة متدفقة في الثانية. الطاقة لكل وحدة شحنة هي الجهد، والممانعة للتدفق هي المقاومة.'),
            ck('What unit measures electric current?', ['Ampere (A)', 'Volt (V)', 'Ohm (Ω)', 'Watt (W)'],
              'Current is measured in amperes (amps).',
              'ما الوحدة التي يقاس بها التيار الكهربائي؟', ['الأمبير (A)', 'الفولت (V)', 'الأوم (Ω)', 'الواط (W)'],
              'يقاس التيار بالأمبير.'),
            ck('A bulb is connected to a battery, but one wire is disconnected. What happens?', ['No current flows and the bulb is off', 'The bulb glows dimly', 'The battery explodes', 'Current flows through the air'],
              'Current needs a complete loop (a closed circuit).',
              'مصباح موصول ببطارية، لكن أحد الأسلاك مفصول. ماذا يحدث؟', ['لا يمر تيار والمصباح مطفأ', 'يضيء المصباح ضوءًا خافتًا', 'تنفجر البطارية', 'يمر التيار عبر الهواء'],
              'يحتاج التيار إلى مسار مغلق كامل (دائرة مغلقة).'),
          ],
        },
        {
          id: 'ohms-law', title: tt("Ohm's law", 'قانون أوم'),
          cards: [
            card('<b>Resistance (R)</b> tells you how much a component opposes the current. It\'s measured in <b>ohms (Ω)</b>. Thin, long wires and bulbs have more resistance.',
              '<b>المقاومة (R)</b> تخبرك بمدى ممانعة العنصر للتيار، وتقاس <b>بالأوم (Ω)</b>. الأسلاك الرفيعة الطويلة والمصابيح لها مقاومة أكبر.'),
            card('<b>Ohm\'s law</b> connects all three: <code>V = I · R</code>. More voltage means more current. More resistance means less current: <code>I = V / R</code>.',
              '<b>قانون أوم</b> يربط الثلاثة معًا: <code>V = I · R</code>. جهد أكبر يعني تيارًا أكبر، ومقاومة أكبر تعني تيارًا أقل: <code>I = V / R</code>.'),
            card('A handy memory triangle: V on top, I and R below. Cover the one you want: <code>V = I × R</code>, <code>I = V ÷ R</code>, <code>R = V ÷ I</code>.',
              'مثلث مفيد للتذكّر: V في الأعلى، وI وR في الأسفل. غطِّ الكمية التي تريدها: <code>V = I × R</code>، و<code>I = V ÷ R</code>، و<code>R = V ÷ I</code>.'),
            example('<b>Example:</b> a 12 V battery drives current through a 4 Ω resistor. <code>I = V / R = 12 / 4 = 3 A</code>.',
              `<b>مثال:</b> بطارية ${x('12 V')} تمرّر تيارًا في مقاوم ${x('4 Ω')}. <code>I = V / R = 12 / 4 = 3 A</code>.`),
          ],
          practice: ['electricity:ohmVoltage', 'electricity:ohmCurrent'],
          checks: [
            ck('If the resistance in a circuit increases (same voltage), the current…', ['Decreases', 'Increases', 'Stays the same', 'Reverses'],
              'I = V / R: a bigger R gives a smaller I.',
              'إذا زادت المقاومة في دائرة (والجهد ثابت)، فإن التيار…', ['يقل', 'يزداد', 'يبقى كما هو', 'ينعكس اتجاهه'],
              `${iso('I = V / R')}: مقاومة أكبر تعطي تيارًا أصغر.`),
            ck('Resistance is measured in…', ['Ohms (Ω)', 'Amperes (A)', 'Volts (V)', 'Joules (J)'],
              'The unit of resistance is the ohm, Ω.',
              'تقاس المقاومة بوحدة…', ['الأوم (Ω)', 'الأمبير (A)', 'الفولت (V)', 'الجول (J)'],
              'وحدة المقاومة هي الأوم Ω.'),
            ck("Which formula is Ohm's law?", ['V = I · R', 'P = V · I', 'F = m · a', 'v = f · λ'],
              'Ohm\'s law: voltage = current × resistance.',
              'أي هذه القوانين هو قانون أوم؟', ['V = I · R', 'P = V · I', 'F = m · a', 'v = f · λ'],
              'قانون أوم: الجهد = التيار × المقاومة.'),
          ],
        },
        {
          id: 'circuits-power', title: tt('Circuits and electrical power', 'الدوائر والقدرة الكهربائية'),
          cards: [
            card('In a <b>series</b> circuit, components are in one loop, one after another. The same current flows through all of them, and resistances add: <code>R = R₁ + R₂ + …</code>. If one bulb breaks, they all go out.',
              'في دائرة <b>التوالي</b> تكون العناصر في حلقة واحدة، واحدًا بعد الآخر. يمر التيار نفسه فيها جميعًا، وتُجمع المقاومات: <code>R = R₁ + R₂ + …</code>. إذا تعطّل مصباح انطفأت كلها.'),
            card('In a <b>parallel</b> circuit, each component has its own branch. Each gets the full voltage, and if one breaks the others stay on. That\'s how your home is wired.',
              'في دائرة <b>التوازي</b> يكون لكل عنصر فرعه الخاص. يحصل كل منها على الجهد الكامل، وإذا تعطّل أحدها بقيت البقية تعمل. هكذا تُمدَّد أسلاك منزلك.'),
            card('<b>Electrical power</b> is the energy used per second: <code>P = V · I</code>, in watts. A 2000 W kettle uses energy much faster than a 10 W LED bulb.',
              `<b>القدرة الكهربائية</b> هي الطاقة المستهلكة في الثانية: <code>P = V · I</code>، بالواط. غلاية ${x('2000 W')} تستهلك الطاقة أسرع بكثير من مصباح LED قدرته ${x('10 W')}.`),
            example('<b>Example:</b> a 230 V heater draws 5 A. <code>P = V·I = 230 × 5 = 1150 W</code>.',
              `<b>مثال:</b> مدفأة تعمل على ${x('230 V')} وتسحب تيارًا ${x('5 A')}. <code>P = V·I = 230 × 5 = 1150 W</code>.`),
          ],
          practice: ['electricity:series', 'electricity:electricPower'],
          checks: [
            ck('In a series circuit, one bulb breaks. What happens to the others?', ['They all go out', 'They get brighter', 'Nothing changes', 'Only the next bulb goes out'],
              'A series circuit has only one path. A break anywhere stops the current everywhere.',
              'في دائرة توالٍ، تعطّل أحد المصابيح. ماذا يحدث للمصابيح الأخرى؟', ['تنطفئ جميعها', 'تزداد إضاءتها', 'لا يتغير شيء', 'ينطفئ المصباح التالي فقط'],
              'دائرة التوالي لها مسار واحد فقط. أي انقطاع في أي مكان يوقف التيار في كل مكان.'),
            ck('Why are homes wired in parallel?', ['Each device gets the full voltage and works on its own', 'It uses less wire', 'So all lights switch off together', 'Parallel circuits have no current'],
              'In parallel, every branch gets the full voltage and can be switched on or off independently.',
              'لماذا تُمدَّد أسلاك المنازل على التوازي؟', ['ليحصل كل جهاز على الجهد الكامل ويعمل مستقلًا', 'لأنها تحتاج أسلاكًا أقل', 'لتنطفئ كل الأضواء معًا', 'لأن دوائر التوازي لا يمر فيها تيار'],
              'على التوازي يحصل كل فرع على الجهد الكامل ويمكن تشغيله أو إطفاؤه بشكل مستقل.'),
            ck('Two 10 Ω resistors in series have a total resistance of…', ['20 Ω', '10 Ω', '5 Ω', '100 Ω'],
              'In series, resistances add: 10 + 10 = 20 Ω.',
              `مقاومان كل منهما ${nu(10, 'Ω')} على التوالي. مقاومتهما الكلية…`, ['20 Ω', '10 Ω', '5 Ω', '100 Ω'],
              `على التوالي تُجمع المقاومات: ${iso('10 + 10 = 20 Ω')}.`),
          ],
        },
      ],
    },
  ];

  // ---------- lookups ----------
  const LESSONS = [];
  UNITS.forEach((u, ui) => u.lessons.forEach((l, li) => {
    l.unitId = u.id;
    l.unitIndex = ui;
    l.indexInUnit = li;
    l.number = LESSONS.length + 1;
    l.topic = u.topic;
    LESSONS.push(l);
  }));
  const lessonById = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
  const unitById = Object.fromEntries(UNITS.map((u) => [u.id, u]));

  function resolvePractice(ref) {
    const [where, name] = ref.split(':');
    if (where === 'school') return SCHOOL_GENERATORS[name] || null;
    return Q.findGenerator(where, name);
  }

  // One question for a lesson. `used` tracks concept checks already asked in this set.
  function lessonQuestion(lesson, lang, used) {
    const freshChecks = lesson.checks.filter((c) => !used.has(c));
    const canPractice = lesson.practice.length > 0;
    const useCheck = freshChecks.length > 0 && (!canPractice || Math.random() < 0.45);
    let q;
    if (useCheck) {
      const c = pick(freshChecks);
      used.add(c);
      q = Q.conceptual(lesson.topic, c, lang);
    } else if (canPractice) {
      q = Q.fromGenerator(lesson.topic, resolvePractice(pick(lesson.practice)), { g: G_SCHOOL, easy: true, lang });
    } else {
      q = Q.conceptual(lesson.topic, pick(lesson.checks), lang);
    }
    q.lessonId = lesson.id;
    return q;
  }

  // A set of `count` questions spread evenly across the given lessons.
  function buildSet(lessons, count, lang) {
    let order = [];
    while (order.length < count) order = order.concat(shuffle(lessons));
    order = order.slice(0, count);
    const used = new Set();
    const prompts = new Set();
    return order.map((lesson) => {
      let q;
      for (let tries = 0; tries < 10; tries++) {
        q = lessonQuestion(lesson, lang, used);
        if (!prompts.has(q.prompt)) break;
      }
      prompts.add(q.prompt);
      return q;
    });
  }

  const api = {
    UNITS, LESSONS, RULES, SCHOOL_GENERATORS, G_SCHOOL,
    lessonById, unitById, resolvePractice, lessonQuestion, buildSet,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PhysicsSchool = api;
})(typeof window !== 'undefined' ? window : globalThis);
