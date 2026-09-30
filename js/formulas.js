/*
 * Physics Quest — formula sheet.
 * Every formula lists the meaning and SI unit of each symbol, plus a tip
 * (how to rearrange it, when to use it). Same symbol, different meaning in
 * different topics (W = weight or work, T = period or tension…), so each
 * formula points at a specific entry in SYMBOLS.
 */
(function (root) {
  'use strict';

  // id: [symbol, English meaning, Arabic meaning, unit]
  // unit '' = no unit (a pure number).
  const S = {
    d: ['d', 'distance travelled', 'المسافة المقطوعة', 'm'],
    s: ['s', 'displacement (distance in a straight line)', 'الإزاحة (المسافة في خط مستقيم)', 'm'],
    t: ['t', 'time', 'الزمن', 's'],
    v: ['v', 'speed or final velocity', 'السرعة أو السرعة النهائية', 'm/s'],
    u: ['u', 'initial (starting) velocity', 'السرعة الابتدائية', 'm/s'],
    vavg: ['v_avg', 'average speed', 'متوسط السرعة', 'm/s'],
    a: ['a', 'acceleration', 'التسارع', 'm/s²'],
    g: ['g', 'acceleration due to gravity: 9.8 (10 in Beginner and School)', 'تسارع الجاذبية: 9.8 (و10 في المبتدئ والمدرسة)', 'm/s²'],
    h: ['h', 'height', 'الارتفاع', 'm'],
    H: ['H', 'maximum height reached', 'أقصى ارتفاع', 'm'],
    theta: ['θ', 'angle (above the horizontal, or of the slope)', 'الزاوية (فوق الأفقي أو زاوية المنحدر)', '°'],
    R_range: ['R', 'range: horizontal distance to the landing point', 'المدى: المسافة الأفقية حتى نقطة السقوط', 'm'],
    x_h: ['x', 'horizontal distance', 'المسافة الأفقية', 'm'],
    v_h: ['v', 'horizontal launch speed', 'سرعة الإطلاق الأفقية', 'm/s'],

    F: ['F', 'force', 'القوة', 'N'],
    Fnet: ['F_net', 'net (resultant) force: all forces added, with directions', 'القوة المحصلة: مجموع القوى مع اتجاهاتها', 'N'],
    m: ['m', 'mass', 'الكتلة', 'kg'],
    W_wt: ['W', 'weight (the pull of gravity)', 'الوزن (قوة جذب الأرض)', 'N'],
    f_fr: ['f', 'friction force', 'قوة الاحتكاك', 'N'],
    mu: ['μ', 'coefficient of friction (how grippy the surfaces are)', 'معامل الاحتكاك (مدى خشونة السطحين)', ''],
    N_n: ['N', 'normal force: the push of the surface, or the scale reading', 'القوة العمودية: دفع السطح أو قراءة الميزان', 'N'],
    k: ['k', 'spring constant (stiffness)', 'ثابت النابض (صلابته)', 'N/m'],
    x_ext: ['x', 'extension or compression of the spring', 'استطالة النابض أو انضغاطه', 'm'],
    m1_hang: ['m₁', 'hanging mass', 'الكتلة المعلّقة', 'kg'],
    m2_table: ['m₂', 'mass on the table', 'الكتلة على الطاولة', 'kg'],

    KE: ['KE', 'kinetic energy (energy of motion)', 'الطاقة الحركية (طاقة الحركة)', 'J'],
    PE: ['PE', 'gravitational potential energy (energy of height)', 'طاقة الوضع الجاذبية (طاقة الارتفاع)', 'J'],
    E_s: ['E', 'energy stored in the spring', 'الطاقة المختزنة في النابض', 'J'],
    W_wk: ['W', 'work done (energy transferred by a force)', 'الشغل المبذول (طاقة تنقلها القوة)', 'J'],
    E_gen: ['E', 'energy', 'الطاقة', 'J'],
    P: ['P', 'power (energy per second)', 'القدرة (الطاقة في الثانية)', 'W'],
    eta: ['η', 'efficiency', 'الكفاءة', '%'],
    Eout: ['E_out', 'useful energy out', 'الطاقة المفيدة الخارجة', 'J'],
    Ein: ['E_in', 'total energy put in', 'الطاقة الكلية الداخلة', 'J'],

    p: ['p', 'momentum', 'الزخم (كمية الحركة)', 'kg·m/s'],
    dp: ['Δp', 'change in momentum', 'التغير في الزخم', 'kg·m/s'],
    dt: ['Δt', 'time the force acts (contact time)', 'زمن تأثير القوة (زمن التلامس)', 's'],
    m1: ['m₁', 'mass of object 1', 'كتلة الجسم الأول', 'kg'],
    m2: ['m₂', 'mass of object 2', 'كتلة الجسم الثاني', 'kg'],
    u1: ['u₁', 'velocity of object 1 before the collision', 'سرعة الجسم الأول قبل التصادم', 'm/s'],
    u2: ['u₂', 'velocity of object 2 before the collision', 'سرعة الجسم الثاني قبل التصادم', 'm/s'],
    v1: ['v₁', 'velocity of object 1 after the collision', 'سرعة الجسم الأول بعد التصادم', 'm/s'],
    v2: ['v₂', 'velocity of object 2 after the collision', 'سرعة الجسم الثاني بعد التصادم', 'm/s'],
    v_joint: ['v', 'common velocity after they stick together', 'السرعة المشتركة بعد الالتحام', 'm/s'],
    dKE: ['ΔKE', 'kinetic energy lost (turned into heat and sound)', 'الطاقة الحركية المفقودة (تتحول إلى حرارة وصوت)', 'J'],

    f: ['f', 'frequency: waves per second', 'التردد: عدد الموجات في الثانية', 'Hz'],
    lam: ['λ', 'wavelength: length of one wave', 'الطول الموجي: طول موجة واحدة', 'm'],
    T_per: ['T', 'period: time for one wave', 'الزمن الدوري: زمن موجة واحدة', 's'],
    N_w: ['N', 'number of waves (or vibrations)', 'عدد الموجات (أو الاهتزازات)', ''],
    v_w: ['v', 'wave speed', 'سرعة الموجة', 'm/s'],
    v_snd: ['v', 'speed of sound (about 340 in air)', 'سرعة الصوت (نحو 340 في الهواء)', 'm/s'],
    d_echo: ['d', 'distance to the wall or cliff', 'البُعد عن الجدار أو الجرف', 'm'],
    t_echo: ['t', 'time until you hear the echo', 'الزمن حتى تسمع الصدى', 's'],
    n: ['n', 'harmonic number (1, 2, 3 …)', 'رقم التوافقية (1، 2، 3 …)', ''],
    fn: ['fₙ', 'frequency of the nth harmonic', 'تردد التوافقية رقم n', 'Hz'],
    L: ['L', 'length of the string', 'طول الوتر', 'm'],
    T_ten: ['T', 'tension (pulling force) in the string', 'قوة الشد في الوتر', 'N'],
    mu_lin: ['μ', 'mass per metre of string', 'كتلة المتر الواحد من الوتر', 'kg/m'],
    fprime: ["f'", 'frequency you hear', 'التردد الذي تسمعه', 'Hz'],
    v_s: ['v_s', 'speed of the moving source', 'سرعة المصدر المتحرك', 'm/s'],
    c: ['c', 'speed of light: 3 × 10⁸', 'سرعة الضوء: 3 × 10⁸', 'm/s'],

    V: ['V', 'voltage (potential difference)', 'الجهد (فرق الجهد)', 'V'],
    I: ['I', 'current', 'التيار', 'A'],
    R: ['R', 'resistance (total resistance in combinations)', 'المقاومة (الكلية عند التوصيل)', 'Ω'],
    R1: ['R₁', 'first resistor', 'المقاوم الأول', 'Ω'],
    R2: ['R₂', 'second resistor', 'المقاوم الثاني', 'Ω'],
    Q: ['Q', 'electric charge', 'الشحنة الكهربائية', 'C'],
    P_el: ['P', 'electrical power', 'القدرة الكهربائية', 'W'],
    E_kwh: ['E', 'energy used (kWh when P is in kW and t in hours)', 'الطاقة المستهلكة (kWh عندما تكون P بالكيلوواط و t بالساعات)', 'J / kWh'],
    E_emf: ['E', 'EMF: the voltage the battery could give', 'القوة الدافعة الكهربائية للبطارية', 'V'],
    r_int: ['r', 'internal resistance of the battery', 'المقاومة الداخلية للبطارية', 'Ω'],
  };
  const SYMBOLS = Object.fromEntries(Object.entries(S).map(([id, [sym, en, ar, unit]]) => [id, { id, sym, name: { en, ar }, unit }]));

  // formula, name, symbol ids, tip
  const F = (formula, en, ar, vars, tipEn, tipAr) => ({ formula, name: { en, ar }, vars, tip: tipEn ? { en: tipEn, ar: tipAr } : null });

  const SECTIONS = [
    {
      id: 'kinematics', icon: '🏃', name: { en: 'Motion', ar: 'الحركة' },
      formulas: [
        F('v = d / t', 'Speed', 'السرعة', ['v', 'd', 't'],
          'Rearrange: d = v·t and t = d / v.', 'بإعادة الترتيب: d = v·t و t = d / v.'),
        F('v_avg = total d / total t', 'Average speed', 'متوسط السرعة', ['vavg', 'd', 't'],
          'Add all the distances and all the times first. Never just average the speeds.', 'اجمع كل المسافات وكل الأزمنة أولًا، ولا تحسب متوسط السرعات مباشرة.'),
        F('a = (v − u) / t', 'Acceleration', 'التسارع', ['a', 'v', 'u', 't'],
          'A negative answer means the object is slowing down (deceleration).', 'الإجابة السالبة تعني أن الجسم يتباطأ.'),
        F('v = u + a·t', 'Final velocity', 'السرعة النهائية', ['v', 'u', 'a', 't'],
          'Starting from rest means u = 0.', 'البدء من السكون يعني u = 0.'),
        F('s = u·t + ½·a·t²', 'Displacement with constant acceleration', 'الإزاحة بتسارع ثابت', ['s', 'u', 'a', 't'],
          'From rest: s = ½·a·t². Don\'t forget the ½ and the square.', 'من السكون: s = ½·a·t². لا تنسَ النصف والتربيع.'),
        F('v² = u² + 2·a·s', 'Velocity without time', 'السرعة دون الزمن', ['v', 'u', 'a', 's'],
          'Use it when no time is given. Stopping distance: s = u² / (2a).', 'استخدمه عندما لا يُعطى الزمن. مسافة التوقف: s = u² / (2a).'),
        F('v = g·t,  h = ½·g·t²', 'Free fall from rest', 'السقوط الحر من السكون', ['v', 'g', 't', 'h'],
          'Time to fall a height h: t = √(2h / g). Mass doesn\'t matter.', 'زمن السقوط من ارتفاع h: t = √(2h / g). الكتلة لا تؤثر.'),
        F('H = u² / (2g)', 'Maximum height when thrown straight up', 'أقصى ارتفاع عند القذف رأسيًا', ['H', 'u', 'g'],
          'At the top the velocity is zero, but the acceleration is still g downward.', 'عند القمة تكون السرعة صفرًا، لكن التسارع يبقى g نحو الأسفل.'),
        F('R = v²·sin(2θ) / g', 'Range of a projectile on flat ground', 'مدى المقذوف على أرض مستوية', ['R_range', 'v', 'theta', 'g'],
          'Biggest range at θ = 45°. Flight time t = 2v·sinθ / g.', 'أكبر مدى عند θ = 45°. زمن التحليق t = 2v·sinθ / g.'),
        F('x = v·t,  h = ½·g·t²', 'Horizontal launch (off a cliff or table)', 'القذف الأفقي (من فوق جرف أو طاولة)', ['x_h', 'v_h', 't', 'h', 'g'],
          'Find the fall time t from the height first, then use it for x.', 'أوجد زمن السقوط t من الارتفاع أولًا، ثم استخدمه لإيجاد x.'),
      ],
    },
    {
      id: 'forces', icon: '🧲', name: { en: 'Forces', ar: 'القوى' },
      formulas: [
        F('F_net = m·a', "Newton's second law", 'قانون نيوتن الثاني', ['Fnet', 'm', 'a'],
          'Rearrange: a = F_net / m and m = F_net / a. Opposite forces subtract.', 'بإعادة الترتيب: a = F_net / m و m = F_net / a. القوى المتعاكسة تُطرح.'),
        F('W = m·g', 'Weight', 'الوزن', ['W_wt', 'm', 'g'],
          'Mass (kg) never changes; weight (N) depends on g.', 'الكتلة (kg) لا تتغير أبدًا، أما الوزن (N) فيعتمد على g.'),
        F('f = μ·N', 'Friction', 'الاحتكاك', ['f_fr', 'mu', 'N_n'],
          'On flat ground N = m·g, so f = μ·m·g.', 'على أرض مستوية N = m·g، إذن f = μ·m·g.'),
        F('F = k·x', "Hooke's law (springs)", 'قانون هوك (النوابض)', ['F', 'k', 'x_ext'],
          'Doubling the force doubles the stretch.', 'مضاعفة القوة تضاعف الاستطالة.'),
        F('a = g·(sin θ − μ·cos θ)', 'Sliding down a slope with friction', 'الانزلاق على منحدر مع احتكاك', ['a', 'g', 'theta', 'mu'],
          'No friction: a = g·sin θ.', 'بلا احتكاك: a = g·sin θ.'),
        F('N = m·(g ± a)', 'Apparent weight in a lift', 'الوزن الظاهري في المصعد', ['N_n', 'm', 'g', 'a'],
          'Use + when accelerating upward (you feel heavier), − when accelerating downward.', 'استخدم + عند التسارع إلى أعلى (تشعر أنك أثقل)، و− عند التسارع إلى أسفل.'),
        F('a = m₁·g / (m₁ + m₂)', 'Block on a table pulled by a hanging mass', 'مكعب على طاولة تسحبه كتلة معلّقة', ['a', 'm1_hang', 'm2_table', 'g'],
          'Only the hanging weight pulls, but both masses have to speed up.', 'وزن الكتلة المعلّقة وحده يسحب، لكن الكتلتين يجب أن تتسارعا معًا.'),
        F('F_A on B = −F_B on A', "Newton's third law", 'قانون نيوتن الثالث', ['F'],
          'The two forces are equal and opposite and act on different objects.', 'القوتان متساويتان ومتعاكستان وتؤثران في جسمين مختلفين.'),
      ],
    },
    {
      id: 'energy', icon: '⚡', name: { en: 'Energy', ar: 'الطاقة' },
      formulas: [
        F('KE = ½·m·v²', 'Kinetic energy', 'الطاقة الحركية', ['KE', 'm', 'v'],
          'Speed is squared: twice as fast means 4 times the energy.', 'السرعة مربّعة: ضعف السرعة يعني 4 أضعاف الطاقة.'),
        F('PE = m·g·h', 'Gravitational potential energy', 'طاقة الوضع الجاذبية', ['PE', 'm', 'g', 'h'],
          'h is the height gained or lost.', 'h هو الارتفاع المكتسب أو المفقود.'),
        F('m·g·h = ½·m·v²', 'Conservation of energy (falling or sliding, no friction)', 'حفظ الطاقة (سقوط أو انزلاق بلا احتكاك)', ['m', 'g', 'h', 'v'],
          'The mass cancels: v = √(2·g·h). With friction: m·g·h = ½·m·v² + E_lost.', 'الكتلة تُختصر: v = √(2·g·h). مع الاحتكاك: m·g·h = ½·m·v² + E_lost.'),
        F('E = ½·k·x²', 'Energy stored in a spring', 'الطاقة المختزنة في نابض', ['E_s', 'k', 'x_ext'],
          'A launched ball gets it as kinetic energy: ½·k·x² = ½·m·v².', 'تتحول إلى طاقة حركية للكرة المقذوفة: ½·k·x² = ½·m·v².'),
        F('W = F·d·cos θ', 'Work done by a force', 'الشغل المبذول بقوة', ['W_wk', 'F', 'd', 'theta'],
          'Force along the motion (θ = 0): W = F·d. At 90° no work is done.', 'القوة في اتجاه الحركة (θ = 0): W = F·d. عند 90° لا يُبذل شغل.'),
        F('P = W / t = E / t', 'Power', 'القدرة', ['P', 'W_wk', 'E_gen', 't'],
          '1 W = 1 J every second.', '1 W = 1 J في كل ثانية.'),
        F('η = E_out / E_in × 100%', 'Efficiency', 'الكفاءة', ['eta', 'Eout', 'Ein'],
          'Always 100% or less. You can also use powers: P_out / P_in.', 'دائمًا 100% أو أقل. يمكنك أيضًا استخدام القدرات: P_out / P_in.'),
      ],
    },
    {
      id: 'momentum', icon: '🎱', name: { en: 'Momentum', ar: 'الزخم' },
      formulas: [
        F('p = m·v', 'Momentum', 'الزخم', ['p', 'm', 'v'],
          'Momentum has a direction: opposite directions have opposite signs.', 'للزخم اتجاه: الاتجاهان المتعاكسان لهما إشارتان متعاكستان.'),
        F('F·Δt = Δp = m·(v − u)', 'Impulse', 'الدفع', ['F', 'dt', 'dp', 'm', 'v', 'u'],
          'Longer contact time means a smaller force (airbags, bending your knees). Watch the signs when something bounces back.', 'زمن تلامس أطول يعني قوة أصغر (الوسائد الهوائية، ثني الركبتين). انتبه للإشارات عندما يرتد الجسم.'),
        F('m₁u₁ + m₂u₂ = m₁v₁ + m₂v₂', 'Conservation of momentum', 'حفظ الزخم', ['m1', 'u1', 'm2', 'u2', 'v1', 'v2'],
          'True in every collision and explosion, as long as no outside force acts. Recoil and explosions start from 0: 0 = m₁v₁ + m₂v₂.', 'صحيح في كل تصادم وانفجار ما لم تؤثر قوة خارجية. الارتداد والانفجارات تبدأ من الصفر: 0 = m₁v₁ + m₂v₂.'),
        F('v = m₁u₁ / (m₁ + m₂)', 'Objects that stick together (target at rest)', 'جسمان يلتحمان (والهدف ساكن)', ['v_joint', 'm1', 'u1', 'm2'],
          'Kinetic energy is not conserved here: some turns into heat and sound.', 'الطاقة الحركية غير محفوظة هنا: جزء منها يتحول إلى حرارة وصوت.'),
        F('v₂ = 2·m₁·u₁ / (m₁ + m₂)', 'Elastic collision (target at rest)', 'تصادم مرن (والهدف ساكن)', ['v2', 'm1', 'u1', 'm2'],
          'Elastic means kinetic energy is conserved too.', 'المرن يعني أن الطاقة الحركية محفوظة أيضًا.'),
        F('ΔKE = KE_before − KE_after', 'Kinetic energy lost in a collision', 'الطاقة الحركية المفقودة في التصادم', ['dKE', 'KE'],
          'Find the speeds after the collision with momentum first.', 'أوجد السرعات بعد التصادم من حفظ الزخم أولًا.'),
      ],
    },
    {
      id: 'waves', icon: '🌊', name: { en: 'Waves', ar: 'الموجات' },
      formulas: [
        F('v = f·λ', 'Wave equation', 'معادلة الموجة', ['v_w', 'f', 'lam'],
          'Same speed, higher frequency → shorter wavelength: λ = v / f.', 'عند السرعة نفسها، تردد أعلى يعني طولًا موجيًا أقصر: λ = v / f.'),
        F('T = 1 / f', 'Period', 'الزمن الدوري', ['T_per', 'f'],
          'And f = 1 / T.', 'وكذلك f = 1 / T.'),
        F('f = N / t', 'Frequency from counting', 'التردد بالعدّ', ['f', 'N_w', 't'],
          'Count the waves and divide by the time.', 'عُدّ الموجات واقسم على الزمن.'),
        F('d = v·t / 2', 'Echo distance', 'بُعد مصدر الصدى', ['d_echo', 'v_snd', 't_echo'],
          'Divide by 2 because the sound goes there and back.', 'نقسم على 2 لأن الصوت يذهب ويعود.'),
        F('t = d / c', 'Time for light to travel', 'زمن انتقال الضوء', ['t', 'd', 'c'],
          'Light takes about 8 minutes (500 s) to reach us from the Sun.', 'يستغرق الضوء نحو 8 دقائق (500 s) ليصل إلينا من الشمس.'),
        F('fₙ = n·v / (2L)', 'Harmonics on a string fixed at both ends', 'توافقيات وتر مثبّت من طرفيه', ['fn', 'n', 'v_w', 'L'],
          'n = 1 is the fundamental (lowest note).', 'n = 1 هي النغمة الأساسية (الأخفض).'),
        F('v = √(T / μ)', 'Wave speed on a string', 'سرعة الموجة على وتر', ['v_w', 'T_ten', 'mu_lin'],
          'Tighter or lighter string → faster waves → higher notes.', 'وتر أشد أو أخف يعني موجات أسرع ونغمات أعلى.'),
        F("f' = f·v / (v ∓ v_s)", 'Doppler effect (moving source)', 'ظاهرة دوبلر (مصدر متحرك)', ['fprime', 'f', 'v_snd', 'v_s'],
          'Use − when the source comes toward you (higher pitch), + when it moves away.', 'استخدم − عندما يقترب المصدر منك (نغمة أعلى)، و+ عندما يبتعد.'),
      ],
    },
    {
      id: 'electricity', icon: '🔌', name: { en: 'Electricity', ar: 'الكهرباء' },
      formulas: [
        F('V = I·R', "Ohm's law", 'قانون أوم', ['V', 'I', 'R'],
          'Rearrange: I = V / R and R = V / I.', 'بإعادة الترتيب: I = V / R و R = V / I.'),
        F('Q = I·t', 'Charge', 'الشحنة', ['Q', 'I', 't'],
          'Current is charge flowing per second: I = Q / t.', 'التيار شحنة تتدفق في الثانية: I = Q / t.'),
        F('P = V·I = I²·R = V² / R', 'Electrical power', 'القدرة الكهربائية', ['P_el', 'V', 'I', 'R'],
          'Pick the version that uses the values you know.', 'اختر الصيغة التي تستخدم القيم المعروفة لديك.'),
        F('R = R₁ + R₂ + …', 'Resistors in series', 'مقاومات على التوالي', ['R', 'R1', 'R2'],
          'Same current through each one. If one breaks, everything goes off.', 'التيار نفسه يمر في كل منها. إذا تعطّل أحدها توقف الكل.'),
        F('1/R = 1/R₁ + 1/R₂ + …', 'Resistors in parallel', 'مقاومات على التوازي', ['R', 'R1', 'R2'],
          'For two: R = R₁·R₂ / (R₁ + R₂). Always smaller than the smallest resistor. Mixed circuit: do the parallel pair first, then add the series one: R = R₁ + R₂·R₃ / (R₂ + R₃).', 'لمقاومين: R = R₁·R₂ / (R₁ + R₂). دائمًا أصغر من أصغر مقاومة. في الدائرة المختلطة احسب الجزء المتوازي أولًا ثم أضف مقاوم التوالي: R = R₁ + R₂·R₃ / (R₂ + R₃).'),
        F('E = P·t', 'Energy used by a device', 'الطاقة التي يستهلكها جهاز', ['E_kwh', 'P_el', 't'],
          'kW × hours gives kWh, the unit on electricity bills.', 'الكيلوواط × الساعات يعطي kWh، وهي وحدة فاتورة الكهرباء.'),
        F('V = E − I·r,  I = E / (R + r)', 'Battery with internal resistance', 'بطارية لها مقاومة داخلية', ['V', 'E_emf', 'I', 'r_int', 'R'],
          'V is the voltage the lamp actually gets; some is "lost" inside the battery.', 'V هو الجهد الذي يصل فعلًا إلى المصباح، وجزء منه "يضيع" داخل البطارية.'),
      ],
    },
  ];

  // Units and prefixes, and constants (their own cards on the sheet).
  const UNITS = [
    // quantity, symbol, unit name, unit symbol
    [{ en: 'Length / distance', ar: 'الطول / المسافة' }, 'd, s, h, x', { en: 'metre', ar: 'متر' }, 'm'],
    [{ en: 'Mass', ar: 'الكتلة' }, 'm', { en: 'kilogram', ar: 'كيلوغرام' }, 'kg'],
    [{ en: 'Time', ar: 'الزمن' }, 't', { en: 'second', ar: 'ثانية' }, 's'],
    [{ en: 'Speed / velocity', ar: 'السرعة' }, 'v, u', { en: 'metre per second', ar: 'متر لكل ثانية' }, 'm/s'],
    [{ en: 'Acceleration', ar: 'التسارع' }, 'a, g', { en: 'metre per second squared', ar: 'متر لكل ثانية مربعة' }, 'm/s²'],
    [{ en: 'Force', ar: 'القوة' }, 'F, W, N', { en: 'newton', ar: 'نيوتن' }, 'N = kg·m/s²'],
    [{ en: 'Energy / work', ar: 'الطاقة / الشغل' }, 'E, W, KE, PE', { en: 'joule', ar: 'جول' }, 'J = N·m'],
    [{ en: 'Power', ar: 'القدرة' }, 'P', { en: 'watt', ar: 'واط' }, 'W = J/s'],
    [{ en: 'Momentum', ar: 'الزخم' }, 'p', { en: 'kilogram metre per second', ar: 'كيلوغرام متر لكل ثانية' }, 'kg·m/s'],
    [{ en: 'Frequency', ar: 'التردد' }, 'f', { en: 'hertz', ar: 'هيرتز' }, 'Hz = 1/s'],
    [{ en: 'Current', ar: 'التيار' }, 'I', { en: 'ampere', ar: 'أمبير' }, 'A'],
    [{ en: 'Voltage', ar: 'الجهد' }, 'V, E', { en: 'volt', ar: 'فولت' }, 'V'],
    [{ en: 'Resistance', ar: 'المقاومة' }, 'R, r', { en: 'ohm', ar: 'أوم' }, 'Ω = V/A'],
    [{ en: 'Charge', ar: 'الشحنة' }, 'Q', { en: 'coulomb', ar: 'كولوم' }, 'C = A·s'],
  ];
  const PREFIXES = [
    ['G', { en: 'giga', ar: 'جيجا' }, '10⁹'],
    ['M', { en: 'mega', ar: 'ميجا' }, '10⁶'],
    ['k', { en: 'kilo', ar: 'كيلو' }, '10³ = 1000'],
    ['c', { en: 'centi', ar: 'سنتي' }, '10⁻² = 0.01'],
    ['m', { en: 'milli', ar: 'ملّي' }, '10⁻³ = 0.001'],
    ['µ', { en: 'micro', ar: 'ميكرو' }, '10⁻⁶'],
    ['n', { en: 'nano', ar: 'نانو' }, '10⁻⁹'],
  ];
  const CONVERSIONS = [
    ['1 km = 1000 m', '1 h = 60 min = 3600 s'],
    ['1 g = 0.001 kg', 'km/h ÷ 3.6 = m/s'],
    ['1 kWh = 3.6 × 10⁶ J', '1 cm = 0.01 m'],
  ];
  const CONSTANTS = [
    ['g', { en: 'Acceleration due to gravity on Earth', ar: 'تسارع الجاذبية على الأرض' }, '9.8 m/s²', { en: 'rounded to 10 m/s² in Beginner and School', ar: 'تُقرَّب إلى 10 m/s² في المبتدئ والمدرسة' }],
    ['v', { en: 'Speed of sound in air', ar: 'سرعة الصوت في الهواء' }, '340 m/s', { en: 'about 1500 m/s in water', ar: 'نحو 1500 m/s في الماء' }],
    ['c', { en: 'Speed of light', ar: 'سرعة الضوء' }, '3 × 10⁸ m/s', { en: 'the fastest speed possible', ar: 'أعلى سرعة ممكنة' }],
  ];

  const api = { SYMBOLS, SECTIONS, UNITS, PREFIXES, CONVERSIONS, CONSTANTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PhysicsFormulas = api;
})(typeof window !== 'undefined' ? window : globalThis);
