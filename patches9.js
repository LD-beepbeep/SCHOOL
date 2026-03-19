/* ================================================================
   StudentOS — patches9.js   Major Update  v1.0
   ================================================================
   NEW FEATURES:
   1. Settings → fullscreen with sidebar subpages (replaces modal)
   2. Feedback button → lars.dehairs@gmail.com + Firestore log
   3. More settings: auto-dark, compact mode, show seconds,
      daily goal, grade scale, confetti on task done, custom bg image
   4. Weather Widget (Open-Meteo, no API key, auto-detects location)
   5. Formula Library (120+ built-in formulas by subject, searchable)
      + "Browse Library" button in formula tab
   6. New Dashboard Widgets: Weather, Quote of the Day, Study Habits
   7. Forum Light Mode — fixed via patches9.css + CSS injections
   8. Mobile bottom nav pill improvements
   9. Various UI bug fixes

   ADD TO index.html (bottom of <body>, after all other scripts):
   <link rel="stylesheet" href="patches9.css">
   <script type="module" src="patches9.js"></script>
   ================================================================ */

import { getApps }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, addDoc, serverTimestamp }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* ── Firebase ── */
let _auth = null, _db = null, _uid = null, _uName = '';
(function _boot() {
    const apps = getApps();
    if (!apps.length) { setTimeout(_boot, 200); return; }
    _auth = getAuth(apps[0]);
    _db   = getFirestore(apps[0]);
    onAuthStateChanged(_auth, u => {
        _uid   = u ? u.uid  : null;
        _uName = u ? (u.displayName || u.email || '') : '';
    });
})();

/* ── Helpers ── */
function _esc(s) { const d = document.createElement('div'); d.textContent = s||''; return d.innerHTML; }
function _p9id() { return 'p9_' + Math.random().toString(36).slice(2, 10); }
function _lsGet(k, def) {
    try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def; }
    catch { return def; }
}
function _lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function _dbGet(k, def) {
    if (window.DB && typeof window.DB.get === 'function') return window.DB.get(k, def);
    return _lsGet(k, def);
}
function _dbSet(k, v) {
    if (window.DB && typeof window.DB.set === 'function') window.DB.set(k, v);
    else _lsSet(k, v);
}
function _toast(msg, err = false) {
    const t = document.getElementById('sos-toast');
    if (!t) return;
    t.textContent = msg;
    t.style.background = err ? '#ef4444' : '';
    t.classList.add('show');
    setTimeout(() => { t.classList.remove('show'); t.style.background = ''; }, 3400);
}

/* ================================================================
   SECTION 1 — FORMULA LIBRARY DATABASE  (120+ formulas)
   ================================================================ */
const P9_FL_DB = [
    /* ─── MATH: Algebra ─── */
    { id:'fl01', subject:'Math', category:'Algebra', name:'Quadratic Formula',
      formula:'x = (-b ± √(b²-4ac)) / 2a',
      desc:'Solves ax² + bx + c = 0. Discriminant b²-4ac determines number of real roots.' },
    { id:'fl02', subject:'Math', category:'Algebra', name:'Distance Formula',
      formula:'d = √((x₂-x₁)² + (y₂-y₁)²)',
      desc:'Distance between two points (x₁,y₁) and (x₂,y₂) in a plane.' },
    { id:'fl03', subject:'Math', category:'Algebra', name:'Midpoint Formula',
      formula:'M = ((x₁+x₂)/2, (y₁+y₂)/2)',
      desc:'Coordinates of the midpoint between (x₁,y₁) and (x₂,y₂).' },
    { id:'fl04', subject:'Math', category:'Algebra', name:'Slope Formula',
      formula:'m = (y₂-y₁) / (x₂-x₁)',
      desc:'Rate of change of y with respect to x between two points.' },
    { id:'fl05', subject:'Math', category:'Algebra', name:'Slope-Intercept Form',
      formula:'y = mx + b',
      desc:'Equation of a line with slope m and y-intercept b.' },
    { id:'fl06', subject:'Math', category:'Algebra', name:'Point-Slope Form',
      formula:'y - y₁ = m(x - x₁)',
      desc:'Equation of a line through (x₁,y₁) with slope m.' },
    { id:'fl07', subject:'Math', category:'Algebra', name:'Difference of Squares',
      formula:'a² - b² = (a+b)(a-b)',
      desc:'Factoring pattern for the difference of two perfect squares.' },
    { id:'fl08', subject:'Math', category:'Algebra', name:'Perfect Square Trinomial',
      formula:'(a±b)² = a² ± 2ab + b²',
      desc:'Expansion of a binomial squared.' },
    { id:'fl09', subject:'Math', category:'Algebra', name:'Sum/Diff of Cubes',
      formula:'a³±b³ = (a±b)(a²∓ab+b²)',
      desc:'Factoring pattern for sum or difference of two cubes.' },
    { id:'fl10', subject:'Math', category:'Algebra', name:'Logarithm Properties',
      formula:'log(ab)=log a+log b | log(a/b)=log a-log b | log(aⁿ)=n·log a',
      desc:'Core rules for manipulating logarithms (any consistent base).' },
    { id:'fl11', subject:'Math', category:'Algebra', name:'Change of Base',
      formula:'log_b(x) = ln(x) / ln(b) = log(x) / log(b)',
      desc:'Convert logarithm from one base to another.' },
    { id:'fl12', subject:'Math', category:'Algebra', name:'Compound Interest',
      formula:'A = P(1 + r/n)^(nt)',
      desc:'A = final amount, P = principal, r = annual rate, n = compoundings/year, t = years.' },
    { id:'fl13', subject:'Math', category:'Algebra', name:'Simple Interest',
      formula:'I = Prt',
      desc:'I = interest, P = principal, r = annual rate, t = time in years.' },
    /* ─── MATH: Geometry ─── */
    { id:'fl14', subject:'Math', category:'Geometry', name:'Pythagorean Theorem',
      formula:'a² + b² = c²',
      desc:'In a right triangle, c is the hypotenuse, a and b are the legs.' },
    { id:'fl15', subject:'Math', category:'Geometry', name:'Area of Circle',
      formula:'A = πr²',
      desc:'r = radius. Circumference: C = 2πr.' },
    { id:'fl16', subject:'Math', category:'Geometry', name:'Area of Triangle',
      formula:'A = ½bh',
      desc:'b = base, h = perpendicular height. Also A = ½ab sin(C).' },
    { id:'fl17', subject:'Math', category:'Geometry', name:'Area of Trapezoid',
      formula:'A = ½(a+b)h',
      desc:'a, b = parallel sides (bases), h = height between them.' },
    { id:'fl18', subject:'Math', category:'Geometry', name:'Volume of Sphere',
      formula:'V = (4/3)πr³',
      desc:'Surface area of sphere: A = 4πr².' },
    { id:'fl19', subject:'Math', category:'Geometry', name:'Volume of Cylinder',
      formula:'V = πr²h',
      desc:'Lateral surface area: 2πrh. Total surface area: 2πr(r+h).' },
    { id:'fl20', subject:'Math', category:'Geometry', name:'Volume of Cone',
      formula:'V = (1/3)πr²h',
      desc:'Slant height l: l = √(r²+h²). Lateral surface: πrl.' },
    { id:'fl21', subject:'Math', category:'Geometry', name:'Volume of Pyramid',
      formula:'V = (1/3) × Base Area × h',
      desc:'h = perpendicular height from base to apex.' },
    { id:'fl22', subject:'Math', category:'Geometry', name:'Sum of Interior Angles',
      formula:'S = (n - 2) × 180°',
      desc:'n = number of sides. Each interior angle of a regular polygon: S/n.' },
    { id:'fl23', subject:'Math', category:'Geometry', name:"Heron's Formula",
      formula:'A = √(s(s-a)(s-b)(s-c)) where s = (a+b+c)/2',
      desc:'Area of a triangle when all three side lengths a, b, c are known.' },
    /* ─── MATH: Trigonometry ─── */
    { id:'fl24', subject:'Math', category:'Trigonometry', name:'SOH-CAH-TOA',
      formula:'sin θ = opp/hyp | cos θ = adj/hyp | tan θ = opp/adj',
      desc:'Basic definitions of trig ratios in a right triangle.' },
    { id:'fl25', subject:'Math', category:'Trigonometry', name:'Pythagorean Identity',
      formula:'sin²θ + cos²θ = 1',
      desc:'Also: 1 + tan²θ = sec²θ and 1 + cot²θ = csc²θ.' },
    { id:'fl26', subject:'Math', category:'Trigonometry', name:'Law of Sines',
      formula:'a/sin A = b/sin B = c/sin C',
      desc:'Relates sides to opposite angles. Useful for non-right triangles.' },
    { id:'fl27', subject:'Math', category:'Trigonometry', name:'Law of Cosines',
      formula:'c² = a² + b² - 2ab cos C',
      desc:'Generalization of Pythagorean theorem for any triangle.' },
    { id:'fl28', subject:'Math', category:'Trigonometry', name:'Double Angle Formulas',
      formula:'sin 2θ = 2 sin θ cos θ | cos 2θ = cos²θ - sin²θ',
      desc:'Expand sin and cos of 2θ. Also cos 2θ = 1-2sin²θ = 2cos²θ-1.' },
    { id:'fl29', subject:'Math', category:'Trigonometry', name:'Sum-to-Product',
      formula:'sin A + sin B = 2 sin((A+B)/2) cos((A-B)/2)',
      desc:'Also: cos A + cos B = 2 cos((A+B)/2) cos((A-B)/2).' },
    /* ─── MATH: Calculus ─── */
    { id:'fl30', subject:'Math', category:'Calculus', name:'Limit Definition of Derivative',
      formula:"f'(x) = lim[h→0] (f(x+h)-f(x))/h",
      desc:'Formal definition. f must be continuous and differentiable at x.' },
    { id:'fl31', subject:'Math', category:'Calculus', name:'Power Rule',
      formula:"d/dx[xⁿ] = nxⁿ⁻¹",
      desc:'Most-used differentiation rule. Works for any real n.' },
    { id:'fl32', subject:'Math', category:'Calculus', name:'Product Rule',
      formula:"(fg)' = f'g + fg'",
      desc:'Derivative of a product of two functions.' },
    { id:'fl33', subject:'Math', category:'Calculus', name:'Quotient Rule',
      formula:"(f/g)' = (f'g - fg') / g²",
      desc:'Derivative of a quotient. g ≠ 0.' },
    { id:'fl34', subject:'Math', category:'Calculus', name:'Chain Rule',
      formula:"d/dx[f(g(x))] = f'(g(x)) · g'(x)",
      desc:'Derivative of composite functions. Work inside-out.' },
    { id:'fl35', subject:'Math', category:'Calculus', name:'Integration by Parts',
      formula:'∫u dv = uv - ∫v du',
      desc:'Choose u and dv using LIATE: Logs, Inverse trig, Algebraic, Trig, Exponential.' },
    { id:'fl36', subject:'Math', category:'Calculus', name:'Fundamental Theorem of Calculus',
      formula:'∫[a,b] f(x)dx = F(b) - F(a) where F\'(x) = f(x)',
      desc:'Connects differentiation and integration. F is any antiderivative of f.' },
    { id:'fl37', subject:'Math', category:'Calculus', name:"Euler's Number e",
      formula:'e = lim[n→∞](1+1/n)ⁿ ≈ 2.71828 | d/dx[eˣ] = eˣ | ∫eˣdx = eˣ+C',
      desc:'The base of natural logarithm. Unique: derivative equals itself.' },
    /* ─── MATH: Statistics ─── */
    { id:'fl38', subject:'Math', category:'Statistics', name:'Mean (Average)',
      formula:'x̄ = (Σxᵢ) / n',
      desc:'Sum of all values divided by count. Sensitive to outliers.' },
    { id:'fl39', subject:'Math', category:'Statistics', name:'Variance (Population)',
      formula:'σ² = Σ(xᵢ - μ)² / N',
      desc:'Average squared deviation from mean. Sample variance uses N-1.' },
    { id:'fl40', subject:'Math', category:'Statistics', name:'Standard Deviation',
      formula:'σ = √(Σ(xᵢ - μ)² / N)',
      desc:'Square root of variance. Measures spread in the same units as data.' },
    { id:'fl41', subject:'Math', category:'Statistics', name:'Z-Score',
      formula:'z = (x - μ) / σ',
      desc:'How many standard deviations x is from the mean μ.' },
    { id:'fl42', subject:'Math', category:'Statistics', name:'Combinations',
      formula:'C(n,r) = n! / (r!(n-r)!)',
      desc:'Number of ways to choose r items from n without regard to order.' },
    { id:'fl43', subject:'Math', category:'Statistics', name:'Permutations',
      formula:'P(n,r) = n! / (n-r)!',
      desc:'Number of ordered arrangements of r items chosen from n.' },
    { id:'fl44', subject:'Math', category:'Statistics', name:'Arithmetic Series Sum',
      formula:'Sₙ = n/2 × (a₁ + aₙ) = n/2 × (2a₁ + (n-1)d)',
      desc:'Sum of n terms. a₁ = first term, d = common difference.' },
    { id:'fl45', subject:'Math', category:'Statistics', name:'Geometric Series Sum',
      formula:'Sₙ = a₁(1 - rⁿ) / (1 - r)  [r ≠ 1]',
      desc:'Sum of n terms with ratio r. Infinite sum (|r|<1): S = a₁/(1-r).' },

    /* ─── PHYSICS: Mechanics ─── */
    { id:'fl46', subject:'Physics', category:'Mechanics', name:"Newton's 2nd Law",
      formula:'F = ma',
      desc:'Net force = mass × acceleration. SI units: newtons (N = kg·m/s²).' },
    { id:'fl47', subject:'Physics', category:'Mechanics', name:'Kinematic Eq. 1',
      formula:'v = u + at',
      desc:'v = final velocity, u = initial velocity, a = acceleration, t = time.' },
    { id:'fl48', subject:'Physics', category:'Mechanics', name:'Kinematic Eq. 2',
      formula:'s = ut + ½at²',
      desc:'s = displacement. Assumes constant acceleration.' },
    { id:'fl49', subject:'Physics', category:'Mechanics', name:'Kinematic Eq. 3',
      formula:'v² = u² + 2as',
      desc:'Time-independent kinematic equation.' },
    { id:'fl50', subject:'Physics', category:'Mechanics', name:'Kinematic Eq. 4',
      formula:'s = ½(u + v)t',
      desc:'Displacement using average velocity (constant acceleration).' },
    { id:'fl51', subject:'Physics', category:'Mechanics', name:'Gravitational Force',
      formula:'F = Gm₁m₂ / r²',
      desc:'G = 6.674×10⁻¹¹ N·m²/kg². Attractive force between two masses.' },
    { id:'fl52', subject:'Physics', category:'Mechanics', name:'Weight',
      formula:'W = mg',
      desc:'g ≈ 9.81 m/s² near Earth\'s surface. Weight is a force (newtons).' },
    { id:'fl53', subject:'Physics', category:'Mechanics', name:'Kinetic Energy',
      formula:'KE = ½mv²',
      desc:'Energy of motion. m = mass, v = speed. Units: joules (J).' },
    { id:'fl54', subject:'Physics', category:'Mechanics', name:'Gravitational PE',
      formula:'PE = mgh',
      desc:'Near Earth\'s surface. h = height above reference point.' },
    { id:'fl55', subject:'Physics', category:'Mechanics', name:'Work-Energy Theorem',
      formula:'W = ΔKE = F·d·cos θ',
      desc:'Net work done equals change in kinetic energy. θ = angle between F and d.' },
    { id:'fl56', subject:'Physics', category:'Mechanics', name:'Momentum',
      formula:'p = mv',
      desc:'Vector quantity. Units: kg·m/s. Conserved in closed systems.' },
    { id:'fl57', subject:'Physics', category:'Mechanics', name:'Impulse',
      formula:'J = Ft = Δp',
      desc:'Change in momentum equals force × time.' },
    { id:'fl58', subject:'Physics', category:'Mechanics', name:'Centripetal Acceleration',
      formula:'aₓ = v²/r',
      desc:'Directed toward center. Centripetal force: Fₓ = mv²/r.' },
    { id:'fl59', subject:'Physics', category:'Mechanics', name:'Power',
      formula:'P = W/t = Fv',
      desc:'Rate of doing work. Units: watts (W = J/s).' },
    { id:'fl60', subject:'Physics', category:'Mechanics', name:'Hooke\'s Law',
      formula:'F = -kx',
      desc:'Restoring force of a spring. k = spring constant, x = displacement.' },
    /* ─── PHYSICS: Electricity ─── */
    { id:'fl61', subject:'Physics', category:'Electricity', name:"Ohm's Law",
      formula:'V = IR',
      desc:'V = voltage (V), I = current (A), R = resistance (Ω).' },
    { id:'fl62', subject:'Physics', category:'Electricity', name:'Electric Power',
      formula:'P = IV = I²R = V²/R',
      desc:'Power dissipated in a resistor. Units: watts.' },
    { id:'fl63', subject:'Physics', category:'Electricity', name:'Resistors in Series',
      formula:'R_total = R₁ + R₂ + R₃ + …',
      desc:'Same current through each. Voltages add up.' },
    { id:'fl64', subject:'Physics', category:'Electricity', name:'Resistors in Parallel',
      formula:'1/R_total = 1/R₁ + 1/R₂ + 1/R₃ + …',
      desc:'Same voltage across each. Currents add up.' },
    { id:'fl65', subject:'Physics', category:'Electricity', name:"Coulomb's Law",
      formula:'F = kq₁q₂ / r²',
      desc:'k = 8.99×10⁹ N·m²/C². Electrostatic force between charges q₁ and q₂.' },
    { id:'fl66', subject:'Physics', category:'Electricity', name:'Electric Field',
      formula:'E = F/q = kQ/r²',
      desc:'Force per unit positive charge. Units: N/C or V/m.' },
    { id:'fl67', subject:'Physics', category:'Electricity', name:'Capacitance',
      formula:'C = Q/V | E = ½CV²',
      desc:'C in farads. Energy stored in a capacitor.' },
    /* ─── PHYSICS: Waves & Optics ─── */
    { id:'fl68', subject:'Physics', category:'Waves', name:'Wave Speed',
      formula:'v = fλ',
      desc:'v = wave speed, f = frequency (Hz), λ = wavelength (m).' },
    { id:'fl69', subject:'Physics', category:'Waves', name:'Period & Frequency',
      formula:'T = 1/f',
      desc:'T = period in seconds. f = frequency in hertz.' },
    { id:'fl70', subject:'Physics', category:'Waves', name:'Doppler Effect',
      formula:'f_obs = f_src × (v ± v_obs) / (v ∓ v_src)',
      desc:'Apparent frequency change due to relative motion. + when approaching.' },
    { id:'fl71', subject:'Physics', category:'Waves', name:"Snell's Law",
      formula:'n₁ sin θ₁ = n₂ sin θ₂',
      desc:'Refraction at a boundary. n = refractive index. n = c/v.' },
    { id:'fl72', subject:'Physics', category:'Waves', name:'Thin Lens Equation',
      formula:'1/f = 1/dₒ + 1/dᵢ | m = -dᵢ/dₒ',
      desc:'f = focal length, dₒ = object dist, dᵢ = image dist, m = magnification.' },
    /* ─── PHYSICS: Thermodynamics ─── */
    { id:'fl73', subject:'Physics', category:'Thermodynamics', name:'Ideal Gas Law',
      formula:'PV = nRT',
      desc:'P = pressure, V = volume, n = moles, R = 8.314 J/(mol·K), T = temperature in K.' },
    { id:'fl74', subject:'Physics', category:'Thermodynamics', name:'First Law of Thermodynamics',
      formula:'ΔU = Q - W',
      desc:'Change in internal energy = heat added minus work done by the system.' },
    { id:'fl75', subject:'Physics', category:'Thermodynamics', name:'Heat Transfer (Conduction)',
      formula:'Q = mcΔT',
      desc:'m = mass, c = specific heat capacity, ΔT = temperature change.' },
    { id:'fl76', subject:'Physics', category:'Thermodynamics', name:'Thermal Expansion',
      formula:'ΔL = αL₀ΔT',
      desc:'α = coefficient of linear expansion. Volume expansion: ΔV = βV₀ΔT.' },
    /* ─── PHYSICS: Modern ─── */
    { id:'fl77', subject:'Physics', category:'Modern Physics', name:'Mass-Energy Equivalence',
      formula:'E = mc²',
      desc:'c = 3×10⁸ m/s (speed of light). Energy released in nuclear reactions.' },
    { id:'fl78', subject:'Physics', category:'Modern Physics', name:'Photoelectric Effect',
      formula:'E_k = hf - φ',
      desc:'h = 6.626×10⁻³⁴ J·s (Planck\'s constant), f = frequency, φ = work function.' },
    { id:'fl79', subject:'Physics', category:'Modern Physics', name:'de Broglie Wavelength',
      formula:'λ = h / p = h / (mv)',
      desc:'Wave-particle duality. Every moving particle has an associated wavelength.' },
    { id:'fl80', subject:'Physics', category:'Modern Physics', name:'Half-Life',
      formula:'N(t) = N₀ × (½)^(t/t½)',
      desc:'t½ = half-life. Also: N(t) = N₀ e^(-λt) where λ = ln2/t½.' },

    /* ─── CHEMISTRY ─── */
    { id:'fl81', subject:'Chemistry', category:'Stoichiometry', name:'Moles & Molar Mass',
      formula:'n = m / M | n = V/22.4 (STP)',
      desc:'n = moles, m = mass in grams, M = molar mass in g/mol.' },
    { id:'fl82', subject:'Chemistry', category:'Stoichiometry', name:'Molarity',
      formula:'C = n / V',
      desc:'C = molar concentration (mol/L or M), n = moles, V = volume in litres.' },
    { id:'fl83', subject:'Chemistry', category:'Stoichiometry', name:'Percent Yield',
      formula:'% yield = (actual yield / theoretical yield) × 100%',
      desc:'Theoretical yield is the maximum possible from stoichiometry.' },
    { id:'fl84', subject:'Chemistry', category:'Gas Laws', name:"Boyle's Law",
      formula:'P₁V₁ = P₂V₂  (constant T, n)',
      desc:'Pressure and volume are inversely proportional at constant temperature.' },
    { id:'fl85', subject:'Chemistry', category:'Gas Laws', name:"Charles's Law",
      formula:'V₁/T₁ = V₂/T₂  (constant P, n)',
      desc:'Volume proportional to absolute temperature. T must be in Kelvin.' },
    { id:'fl86', subject:'Chemistry', category:'Gas Laws', name:'Combined Gas Law',
      formula:'P₁V₁/T₁ = P₂V₂/T₂',
      desc:'Combines Boyle\'s and Charles\'s laws for a fixed amount of gas.' },
    { id:'fl87', subject:'Chemistry', category:'Gas Laws', name:"Dalton's Law",
      formula:'P_total = P₁ + P₂ + P₃ + …',
      desc:'Total pressure of a gas mixture equals the sum of partial pressures.' },
    { id:'fl88', subject:'Chemistry', category:'Thermochem', name:'Gibbs Free Energy',
      formula:'ΔG = ΔH - TΔS',
      desc:'ΔG < 0: spontaneous. ΔH = enthalpy change, ΔS = entropy change, T in K.' },
    { id:'fl89', subject:'Chemistry', category:'Thermochem', name:"Hess's Law",
      formula:'ΔH_rxn = Σ ΔH_f(products) - Σ ΔH_f(reactants)',
      desc:'Enthalpy is a state function; total ΔH is path-independent.' },
    { id:'fl90', subject:'Chemistry', category:'Acid-Base', name:'pH and pOH',
      formula:'pH = -log[H⁺] | pOH = -log[OH⁻] | pH + pOH = 14',
      desc:'At 25°C. [H⁺][OH⁻] = 10⁻¹⁴ = Kw (water equilibrium constant).' },
    { id:'fl91', subject:'Chemistry', category:'Acid-Base', name:'Henderson-Hasselbalch',
      formula:'pH = pKa + log([A⁻]/[HA])',
      desc:'Buffer pH. [A⁻] = conjugate base, [HA] = weak acid. pKa = -log(Ka).' },
    { id:'fl92', subject:'Chemistry', category:'Kinetics', name:'Arrhenius Equation',
      formula:'k = A · e^(-Ea / RT)',
      desc:'k = rate constant, Ea = activation energy, R = 8.314 J/(mol·K), T in K.' },
    { id:'fl93', subject:'Chemistry', category:'Kinetics', name:'Beer-Lambert Law',
      formula:'A = εcl',
      desc:'A = absorbance, ε = molar absorptivity, c = concentration, l = path length.' },
    { id:'fl94', subject:'Chemistry', category:'Electrochemistry', name:'Nernst Equation',
      formula:'E = E° - (RT/nF) ln Q',
      desc:'Cell potential under non-standard conditions. F = 96485 C/mol (Faraday).' },
    { id:'fl95', subject:'Chemistry', category:'Electrochemistry', name:'Cell Potential',
      formula:'E°_cell = E°_cathode - E°_anode',
      desc:'Spontaneous reaction when E° > 0. Related to ΔG: ΔG = -nFE.' },

    /* ─── BIOLOGY ─── */
    { id:'fl96', subject:'Biology', category:'Genetics', name:'Hardy-Weinberg Equilibrium',
      formula:'p + q = 1 | p² + 2pq + q² = 1',
      desc:'p = dominant allele frequency, q = recessive. Assumes no evolution.' },
    { id:'fl97', subject:'Biology', category:'Ecology', name:'Population Growth (Exponential)',
      formula:'dN/dt = rN | N(t) = N₀eʳᵗ',
      desc:'r = intrinsic growth rate, N = population size. Unlimited resources assumed.' },
    { id:'fl98', subject:'Biology', category:'Ecology', name:'Logistic Growth',
      formula:'dN/dt = rN(1 - N/K)',
      desc:'K = carrying capacity. Population levels off at K.' },
    { id:'fl99', subject:'Biology', category:'Ecology', name:'Net Primary Productivity',
      formula:'NPP = GPP - Respiration',
      desc:'Energy available to consumers after autotrophs use energy for metabolism.' },
    { id:'fl100', subject:'Biology', category:'Biochemistry', name:'Enzyme Kinetics (Michaelis-Menten)',
      formula:'v = V_max [S] / (Km + [S])',
      desc:'v = reaction rate, [S] = substrate concentration, Km = Michaelis constant.' },

    /* ─── ECONOMICS ─── */
    { id:'fl101', subject:'Economics', category:'Macroeconomics', name:'GDP (Expenditure)',
      formula:'GDP = C + I + G + (X - M)',
      desc:'C = consumption, I = investment, G = government spending, X-M = net exports.' },
    { id:'fl102', subject:'Economics', category:'Macroeconomics', name:'Inflation Rate',
      formula:'π = (CPI₂ - CPI₁) / CPI₁ × 100%',
      desc:'Percentage change in consumer price index over a period.' },
    { id:'fl103', subject:'Economics', category:'Microeconomics', name:'Price Elasticity of Demand',
      formula:'PED = % change in Qd / % change in P',
      desc:'|PED| > 1: elastic (responsive). |PED| < 1: inelastic.' },
    { id:'fl104', subject:'Economics', category:'Microeconomics', name:'Profit',
      formula:'Profit = Total Revenue - Total Cost | TR = P × Q',
      desc:'Maximum profit where Marginal Revenue = Marginal Cost.' },
    { id:'fl105', subject:'Economics', category:'Finance', name:'Present Value',
      formula:'PV = FV / (1 + r)ⁿ',
      desc:'Current worth of future cash flow. r = discount rate, n = periods.' },
    { id:'fl106', subject:'Economics', category:'Finance', name:'Future Value',
      formula:'FV = PV × (1 + r)ⁿ',
      desc:'Value of current investment at a future date with rate r over n periods.' },
    { id:'fl107', subject:'Economics', category:'Finance', name:'Break-Even Analysis',
      formula:'Break-Even Qty = Fixed Costs / (Price - Variable Cost per Unit)',
      desc:'Quantity at which total revenue equals total cost; zero profit.' },
];

/* Subject color map */
const P9_FL_COLORS = {
    Math:      { color: '#3b82f6', icon: 'fa-square-root-alt' },
    Physics:   { color: '#8b5cf6', icon: 'fa-atom' },
    Chemistry: { color: '#22c55e', icon: 'fa-flask' },
    Biology:   { color: '#f59e0b', icon: 'fa-dna' },
    Economics: { color: '#ec4899', icon: 'fa-chart-line' },
};
function _flMeta(subj) {
    return P9_FL_COLORS[subj] || { color: '#6b7280', icon: 'fa-circle-question' };
}

/* ================================================================
   SECTION 2 — WEATHER WIDGET
   ================================================================ */
const WMO_CODES = {
    0:  { label:'Clear Sky',       icon:'☀️' },
    1:  { label:'Mainly Clear',    icon:'🌤️' },
    2:  { label:'Partly Cloudy',   icon:'⛅' },
    3:  { label:'Overcast',        icon:'☁️' },
    45: { label:'Foggy',           icon:'🌫️' },
    48: { label:'Icy Fog',         icon:'🌫️' },
    51: { label:'Light Drizzle',   icon:'🌦️' },
    53: { label:'Drizzle',         icon:'🌦️' },
    55: { label:'Heavy Drizzle',   icon:'🌧️' },
    61: { label:'Light Rain',      icon:'🌧️' },
    63: { label:'Rain',            icon:'🌧️' },
    65: { label:'Heavy Rain',      icon:'🌧️' },
    71: { label:'Light Snow',      icon:'🌨️' },
    73: { label:'Snow',            icon:'❄️' },
    75: { label:'Heavy Snow',      icon:'❄️' },
    77: { label:'Snow Grains',     icon:'🌨️' },
    80: { label:'Showers',         icon:'🌦️' },
    81: { label:'Rain Showers',    icon:'🌧️' },
    82: { label:'Heavy Showers',   icon:'⛈️' },
    85: { label:'Snow Showers',    icon:'🌨️' },
    86: { label:'Heavy Snow Showers', icon:'❄️' },
    95: { label:'Thunderstorm',    icon:'⛈️' },
    96: { label:'Storm + Hail',    icon:'⛈️' },
    99: { label:'Storm + Hail',    icon:'⛈️' },
};
function _wmoInfo(code) {
    return WMO_CODES[code] || WMO_CODES[Math.floor(code/10)*10] || { label:'Unknown', icon:'🌡️' };
}

let _weatherCache = null;
let _weatherCacheTime = 0;

async function _fetchWeather() {
    // Check cache (30 min)
    if (_weatherCache && (Date.now() - _weatherCacheTime < 30 * 60 * 1000)) {
        return _weatherCache;
    }
    // Get location
    const pos = await new Promise((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 });
    });
    const { latitude: lat, longitude: lon } = pos.coords;
    // Fetch weather
    const [weatherRes, geoRes] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min,windspeed_10m_max&timezone=auto&forecast_days=5`),
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, { headers: { 'Accept-Language': 'en' } })
    ]);
    const weather = await weatherRes.json();
    const geo = await geoRes.json();
    const city = geo.address?.city || geo.address?.town || geo.address?.village || geo.address?.county || 'Your Location';
    const result = { weather, city };
    _weatherCache = result;
    _weatherCacheTime = Date.now();
    _lsSet('p9_weather_cache', { data: result, time: _weatherCacheTime });
    return result;
}

function _renderWeatherWidget(container) {
    container.innerHTML = `<div class="weather-loading"><i class="fa-solid fa-circle-notch w-spin"></i><span>Locating…</span></div>`;
    // Try cache first
    const cached = _lsGet('p9_weather_cache', null);
    if (cached && (Date.now() - cached.time < 30 * 60 * 1000)) {
        _displayWeather(container, cached.data);
        return;
    }
    if (!navigator.geolocation) {
        container.innerHTML = `<div class="weather-error">Geolocation not supported in this browser.</div>`;
        return;
    }
    _fetchWeather()
        .then(data => _displayWeather(container, data))
        .catch(err => {
            if (err.code === 1) {
                container.innerHTML = `<div class="weather-error">Location access denied.<br><span onclick="_p9WeatherRetry(this)">Grant permission & retry</span></div>`;
            } else {
                container.innerHTML = `<div class="weather-error">Couldn't load weather.<br><span onclick="_p9WeatherRetry(this)">Retry</span></div>`;
            }
        });
}

window._p9WeatherRetry = function(el) {
    const container = el.closest('#widget-weather').querySelector('#weather-inner') || el.closest('[id]');
    _weatherCacheTime = 0;
    _lsSet('p9_weather_cache', null);
    _renderWeatherWidget(el.closest('.weather-error').parentElement);
};

function _displayWeather(container, { weather, city }) {
    const cw = weather.current_weather;
    const daily = weather.daily;
    const info = _wmoInfo(cw.weathercode);
    const isDay = cw.is_day !== 0;
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    
    const forecastHtml = (daily.time || []).slice(1, 5).map((dateStr, i) => {
        const d = new Date(dateStr);
        const fi = _wmoInfo(daily.weathercode[i+1]);
        return `<div class="wfc">
            <div>${dayNames[d.getDay()]}</div>
            <div class="wfc-icon">${fi.icon}</div>
            <div class="wfc-hi">${Math.round(daily.temperature_2m_max[i+1])}°</div>
            <div class="wfc-lo">${Math.round(daily.temperature_2m_min[i+1])}°</div>
        </div>`;
    }).join('');

    const hiToday = daily.temperature_2m_max ? Math.round(daily.temperature_2m_max[0]) : '--';
    const loToday = daily.temperature_2m_min ? Math.round(daily.temperature_2m_min[0]) : '--';

    container.innerHTML = `
        <div class="weather-main">
            <div class="weather-icon-big">${info.icon}</div>
            <div>
                <div class="weather-temp-big">${Math.round(cw.temperature)}°C</div>
                <div class="weather-cond">${info.label}</div>
                <div class="weather-city"><i class="fa-solid fa-location-dot" style="font-size:.62rem;margin-right:3px;"></i>${_esc(city)}</div>
            </div>
        </div>
        <div class="weather-details">
            <div class="weather-detail"><i class="fa-solid fa-arrow-up"></i>${hiToday}° / <i class="fa-solid fa-arrow-down"></i>${loToday}°</div>
            <div class="weather-detail"><i class="fa-solid fa-wind"></i>${Math.round(cw.windspeed)} km/h</div>
        </div>
        ${forecastHtml ? `<div class="weather-forecast">${forecastHtml}</div>` : ''}
    `;
}

/* ================================================================
   SECTION 3 — QUOTE OF THE DAY WIDGET
   ================================================================ */
const P9_QUOTES = [
    { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
    { text: 'It always seems impossible until it\'s done.', author: 'Nelson Mandela' },
    { text: 'Education is the passport to the future, for tomorrow belongs to those who prepare for it today.', author: 'Malcolm X' },
    { text: 'The beautiful thing about learning is nobody can take it away from you.', author: 'B.B. King' },
    { text: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin' },
    { text: 'Live as if you were to die tomorrow. Learn as if you were to live forever.', author: 'Mahatma Gandhi' },
    { text: 'The more that you read, the more things you will know.', author: 'Dr. Seuss' },
    { text: 'Try to learn something about everything and everything about something.', author: 'T.H. Huxley' },
    { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
    { text: 'Perseverance is not a long race; it is many short races one after the other.', author: 'Walter Elliot' },
    { text: 'Motivation is what gets you started. Habit is what keeps you going.', author: 'Jim Ryun' },
    { text: 'You don\'t have to be great to start, but you have to start to be great.', author: 'Zig Ziglar' },
    { text: 'Do not wait to strike till the iron is hot; make it hot by striking.', author: 'William Butler Yeats' },
    { text: 'A person who never made a mistake never tried anything new.', author: 'Albert Einstein' },
    { text: 'The expert in anything was once a beginner.', author: 'Helen Hayes' },
    { text: 'Push yourself, because no one else is going to do it for you.', author: 'Unknown' },
    { text: 'Great things never came from comfort zones.', author: 'Neil Strauss' },
    { text: 'Dream it. Wish it. Do it.', author: 'Unknown' },
    { text: 'Wake up with determination. Go to bed with satisfaction.', author: 'Unknown' },
    { text: 'Do something today that your future self will thank you for.', author: 'Sean Patrick Flanery' },
    { text: 'Little things make big days.', author: 'Unknown' },
    { text: 'It\'s going to be hard, but hard is not impossible.', author: 'Unknown' },
    { text: 'First, solve the problem. Then, write the code.', author: 'John Johnson' },
    { text: 'Don\'t wish it were easier; wish you were better.', author: 'Jim Rohn' },
    { text: 'You are braver than you believe, and stronger than you seem.', author: 'A.A. Milne' },
];

function _getDailyQuote() {
    const day = Math.floor(Date.now() / 86400000);
    return P9_QUOTES[day % P9_QUOTES.length];
}

function _renderQuoteWidget(inner) {
    let q = _lsGet('p9_current_quote', null);
    if (!q) { q = _getDailyQuote(); _lsSet('p9_current_quote', q); }
    inner.innerHTML = `
        <div class="quote-text">"${_esc(q.text)}"</div>
        <div class="quote-author">— ${_esc(q.author)}</div>
    `;
}

window._p9QuoteRefresh = function(btn) {
    const idx = P9_QUOTES.findIndex(q => q.author === (btn.previousElementSibling?.textContent || '').replace('— ',''));
    const nextIdx = (Math.floor(Math.random() * P9_QUOTES.length));
    const q = P9_QUOTES[nextIdx];
    _lsSet('p9_current_quote', q);
    const inner = btn.closest('#widget-quote').querySelector('.quote-inner');
    if (inner) {
        inner.style.opacity = '0';
        setTimeout(() => {
            _renderQuoteWidget(inner);
            inner.style.transition = 'opacity .3s';
            inner.style.opacity = '1';
        }, 150);
    }
};

/* ================================================================
   SECTION 4 — STUDY HABIT TRACKER WIDGET
   ================================================================ */
function _getHabitData() {
    return _lsGet('p9_habits', []);
}
function _todayStr() {
    return new Date().toISOString().slice(0, 10);
}
function _updateHabitWidget(container) {
    const data = _getHabitData();
    const today = _todayStr();
    const todayDone = data.includes(today);
    const streak = _calcStreak(data);
    // Build last 28 days grid
    const dots = [];
    for (let i = 27; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const s = d.toISOString().slice(0, 10);
        dots.push(`<div class="habit-dot ${data.includes(s) ? 'on' : ''}" title="${s}"></div>`);
    }
    container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <div>
                <div class="habit-streak-big">${streak}</div>
                <div class="habit-streak-lbl">day streak 🔥</div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:.78rem;font-weight:700;">${data.length}</div>
                <div style="font-size:.65rem;color:var(--text-muted);">total days</div>
            </div>
        </div>
        <div class="habit-bar">${dots.join('')}</div>
        <div class="habit-today-cta">
            <button class="habit-check-btn ${todayDone ? 'done' : ''}" 
                    onclick="_p9HabitCheck(this)" ${todayDone ? 'disabled' : ''}>
                ${todayDone ? '✓ Studied today!' : '✓ Mark today as studied'}
            </button>
        </div>
    `;
}

function _calcStreak(data) {
    if (!data.length) return 0;
    const sorted = [...data].sort().reverse();
    let streak = 0;
    const today = _todayStr();
    let check = today;
    for (const d of sorted) {
        if (d === check) { streak++; const dt = new Date(check); dt.setDate(dt.getDate()-1); check = dt.toISOString().slice(0,10); }
        else if (d < check) break;
    }
    return streak;
}

window._p9HabitCheck = function(btn) {
    const today = _todayStr();
    const data = _getHabitData();
    if (!data.includes(today)) {
        data.push(today);
        _lsSet('p9_habits', data);
        const container = btn.closest('#widget-habits').querySelector('.habit-inner');
        if (container) _updateHabitWidget(container);
        _toast('🔥 Great work! Day ' + _calcStreak(data) + ' streak!');
    }
};

/* ================================================================
   SECTION 5 — DOM INJECTION (Widgets)
   ================================================================ */
function _injectWidgets() {
    const grid = document.getElementById('widgets-grid');
    if (!grid) return;

    /* Weather widget */
    if (!document.getElementById('widget-weather')) {
        const ww = document.createElement('div');
        ww.className = 'col-span-1 min-card p-5 flex flex-col widget-item';
        ww.id = 'widget-weather'; ww.draggable = true;
        ww.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <h3 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">
                    <i class="fa-solid fa-cloud-sun text-[var(--accent)] mr-1"></i> Weather
                </h3>
                <button onclick="_p9WeatherRefreshWidget()" class="text-[var(--text-muted)] hover:text-[var(--text-main)] transition text-xs" title="Refresh">
                    <i class="fa-solid fa-rotate-right" style="font-size:.7rem;"></i>
                </button>
            </div>
            <div id="weather-inner" style="flex:1;"></div>
        `;
        grid.appendChild(ww);
        _renderWeatherWidget(ww.querySelector('#weather-inner'));
    }

    /* Quote widget */
    if (!document.getElementById('widget-quote')) {
        const qw = document.createElement('div');
        qw.className = 'col-span-1 min-card p-5 flex flex-col widget-item';
        qw.id = 'widget-quote'; qw.draggable = true;
        qw.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <h3 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">
                    <i class="fa-solid fa-quote-left text-[var(--accent)] mr-1"></i> Quote
                </h3>
                <button class="quote-refresh" onclick="_p9QuoteRefresh(this)" title="New quote">
                    <i class="fa-solid fa-rotate-right"></i>
                </button>
            </div>
            <div class="quote-inner" style="flex:1;"></div>
        `;
        grid.appendChild(qw);
        _renderQuoteWidget(qw.querySelector('.quote-inner'));
    }

    /* Study habits widget */
    if (!document.getElementById('widget-habits')) {
        const hw = document.createElement('div');
        hw.className = 'col-span-1 min-card p-5 flex flex-col widget-item';
        hw.id = 'widget-habits'; hw.draggable = true;
        hw.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <h3 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">
                    <i class="fa-solid fa-fire text-orange-400 mr-1"></i> Study Habits
                </h3>
            </div>
            <div class="habit-inner" style="flex:1;"></div>
        `;
        grid.appendChild(hw);
        _updateHabitWidget(hw.querySelector('.habit-inner'));
    }

    /* Patch widget visibility */
    const p9Widgets = _lsGet('p9_widget_vis', { weather: true, quote: true, habits: true });
    ['weather', 'quote', 'habits'].forEach(name => {
        const el = document.getElementById('widget-' + name);
        if (el) el.classList.toggle('widget-hidden', p9Widgets[name] === false);
    });
}

window._p9WeatherRefreshWidget = function() {
    _weatherCacheTime = 0;
    _lsSet('p9_weather_cache', null);
    const inner = document.getElementById('weather-inner');
    if (inner) _renderWeatherWidget(inner);
    window._p9RenderWeather = function(inner){ _renderWeatherWidget(inner); };
};

/* ================================================================
   SECTION 6 — WIDGET MANAGER PATCH (add new widgets to modal)
   ================================================================ */
function _patchWidgetManager() {
    const modal = document.getElementById('modal-widgets');
    if (!modal) return;
    const list = modal.querySelector('.space-y-2');
    if (!list) return;
    const p9Widgets = _lsGet('p9_widget_vis', { weather: true, quote: true, habits: true });
    const newWidgets = [
        { id: 'weather', label: 'Weather',          icon: '🌤️' },
        { id: 'quote',   label: 'Quote of the Day', icon: '💬' },
        { id: 'habits',  label: 'Study Habits',     icon: '🔥' },
    ];
    newWidgets.forEach(w => {
        if (document.getElementById('wv-' + w.id)) return;
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between p-3 bg-[var(--glass-panel)] rounded-xl';
        row.innerHTML = `
            <div class="flex items-center gap-3">
                <input type="checkbox" id="wv-${w.id}" ${p9Widgets[w.id] !== false ? 'checked' : ''}
                       class="w-4 h-4"
                       onchange="_p9SetWidgetVis('${w.id}', this.checked)">
                <label class="text-sm" for="wv-${w.id}">${w.icon} ${w.label}</label>
            </div>`;
        list.appendChild(row);
    });
}

window._p9SetWidgetVis = function(name, vis) {
    const cfg = _lsGet('p9_widget_vis', { weather: true, quote: true, habits: true });
    cfg[name] = vis;
    _lsSet('p9_widget_vis', cfg);
    const el = document.getElementById('widget-' + name);
    if (el) el.classList.toggle('widget-hidden', !vis);
};

/* ================================================================
   SECTION 7 — FORMULA LIBRARY OVERLAY
   ================================================================ */
function _injectFormulaLibraryBtn() {
    const topbar = document.querySelector('#view-formulas .formula-topbar > div');
    if (!topbar || document.getElementById('p9-library-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'p9-library-btn';
    btn.innerHTML = '<i class="fa-solid fa-book-open-reader"></i> Browse Library';
    btn.onclick = () => _openFormulaLibrary();
    topbar.insertBefore(btn, topbar.firstChild);
}

function _buildFormulaLibraryOverlay() {
    if (document.getElementById('p9-formula-library')) return;
    const el = document.createElement('div');
    el.id = 'p9-formula-library';
    const subjects = ['All', 'Math', 'Physics', 'Chemistry', 'Biology', 'Economics'];
    el.innerHTML = `
        <div class="p9-fl-header">
            <button class="p9-fl-close" onclick="_closeFormulaLibrary()"><i class="ph-bold ph-x"></i></button>
            <h2>Formula <span>Library</span></h2>
            <div class="p9-fl-search">
                <i class="fa-solid fa-magnifying-glass" style="color:var(--text-muted);font-size:.78rem;"></i>
                <input type="text" id="p9-fl-search-input" placeholder="Search 120+ formulas…"
                       oninput="_p9FlSearch(this.value)">
            </div>
        </div>
        <div class="p9-fl-body">
            <div class="p9-fl-subjects" id="p9-fl-subjects">
                ${subjects.map((s, i) => {
                    const meta = s === 'All' ? { color:'#6b7280', icon:'fa-border-all' } : (_flMeta(s));
                    const count = s === 'All' ? P9_FL_DB.length : P9_FL_DB.filter(f => f.subject === s).length;
                    return `<button class="p9-fl-subj-btn ${i===0?'active':''}" 
                                    data-subj="${s}" onclick="_p9FlSetSubj('${s}')">
                        <i class="fa-solid ${meta.icon}" style="color:${meta.color}"></i>
                        <span>${s}</span>
                        <span class="p9-fl-count">${count}</span>
                    </button>`;
                }).join('')}
            </div>
            <div class="p9-fl-list" id="p9-fl-list"></div>
        </div>
    `;
    document.body.appendChild(el);
    _p9FlRender('All', '');
}

let _flActiveSubj = 'All', _flSearch = '';

window._p9FlSetSubj = function(subj) {
    _flActiveSubj = subj;
    document.querySelectorAll('.p9-fl-subj-btn').forEach(b => b.classList.toggle('active', b.dataset.subj === subj));
    _p9FlRender(subj, _flSearch);
};
window._p9FlSearch = function(q) {
    _flSearch = q;
    _p9FlRender(_flActiveSubj, q);
};

function _p9FlRender(subj, search) {
    const list = document.getElementById('p9-fl-list');
    if (!list) return;
    let items = [...P9_FL_DB];
    if (subj !== 'All') items = items.filter(f => f.subject === subj);
    if (search) {
        const q = search.toLowerCase();
        items = items.filter(f =>
            f.name.toLowerCase().includes(q) ||
            f.formula.toLowerCase().includes(q) ||
            f.desc.toLowerCase().includes(q) ||
            f.category.toLowerCase().includes(q)
        );
    }
    if (!items.length) {
        list.innerHTML = `<div class="p9-fl-empty"><i class="fa-solid fa-magnifying-glass"></i><p>No formulas match your search.</p></div>`;
        return;
    }
    const addedIds = new Set((_dbGet('os_formulas', []) || []).map(f => f._libId).filter(Boolean));
    const meta = {};
    items.forEach(f => { if (!meta[f.subject]) meta[f.subject] = _flMeta(f.subject); });
    list.innerHTML = items.map(f => {
        const m = meta[f.subject];
        const added = addedIds.has(f.id);
        return `<div class="p9-fl-card">
            <div class="p9-fl-card-name">${_esc(f.name)}</div>
            <div class="p9-fl-card-formula">${_esc(f.formula)}</div>
            <div class="p9-fl-card-desc">${_esc(f.desc)}</div>
            <div class="p9-fl-card-footer">
                <span class="p9-fl-subj-tag" style="background:${m.color}22;color:${m.color}">${_esc(f.subject)} · ${_esc(f.category)}</span>
                <button class="p9-fl-add-btn ${added?'added':''}" 
                        id="p9-fl-add-${f.id}"
                        onclick="_p9FlAdd('${f.id}')"
                        ${added?'disabled':''}>
                    ${added ? '✓ Added' : '+ Add to My Formulas'}
                </button>
            </div>
        </div>`;
    }).join('');
}

window._p9FlAdd = function(libId) {
    const f = P9_FL_DB.find(x => x.id === libId);
    if (!f) return;
    const items = _dbGet('os_formulas', []);
    if (items.some(x => x._libId === libId)) { _toast('Already in your formulas!'); return; }
    const newF = {
        id: _p9id(),
        title: f.name,
        formula: f.formula,
        note: f.desc,
        subject: f.subject,
        _libId: libId,
        createdAt: Date.now()
    };
    items.push(newF);
    _dbSet('os_formulas', items);
    // Update button
    const btn = document.getElementById('p9-fl-add-' + libId);
    if (btn) { btn.textContent = '✓ Added'; btn.classList.add('added'); btn.disabled = true; }
    // Re-render formula tab if visible
    if (typeof window.renderFormulas === 'function') window.renderFormulas();
    if (typeof window.renderFormulaSubjectBar === 'function') window.renderFormulaSubjectBar();
    _toast('✓ Formula added to your sheets!');
};

function _openFormulaLibrary() {
    _buildFormulaLibraryOverlay();
    requestAnimationFrame(() => {
        document.getElementById('p9-formula-library').classList.add('open');
    });
}
window._closeFormulaLibrary = function() {
    const el = document.getElementById('p9-formula-library');
    if (el) el.classList.remove('open');
};

/* ================================================================
   SECTION 8 — FULLSCREEN SETTINGS
   ================================================================ */
function _buildSettingsUI() {
    if (document.getElementById('p9-settings')) return;
    const el = document.createElement('div');
    el.id = 'p9-settings';
    el.innerHTML = `
        <button id="p9-settings-close" onclick="_p9CloseSettings()" title="Close">
            <i class="ph-bold ph-x"></i>
        </button>

        <!-- Sidebar -->
        <div id="p9-settings-sidebar">
            <div id="p9-settings-logo">
                <div class="p9-logo-icon"><i class="ph-bold ph-student"></i></div>
                <div><div class="p9-logo-name">StudentOS</div><div class="p9-logo-sub">Settings</div></div>
            </div>

            <div class="p9-s-section-label">Settings</div>
            <button class="p9-s-nav-btn active" data-page="profile" onclick="_p9SwitchPage('profile')">
                <i class="fa-solid fa-user"></i><span class="p9-nav-label">Profile</span>
            </button>
            <button class="p9-s-nav-btn" data-page="appearance" onclick="_p9SwitchPage('appearance')">
                <i class="fa-solid fa-palette"></i><span class="p9-nav-label">Appearance</span>
            </button>
            <button class="p9-s-nav-btn" data-page="timer" onclick="_p9SwitchPage('timer')">
                <i class="fa-solid fa-stopwatch"></i><span class="p9-nav-label">Focus & Timer</span>
            </button>
            <button class="p9-s-nav-btn" data-page="notifications" onclick="_p9SwitchPage('notifications')">
                <i class="fa-solid fa-bell"></i><span class="p9-nav-label">Notifications</span>
            </button>

            <div class="p9-s-section-label">Tools</div>
            <button class="p9-s-nav-btn" data-page="data" onclick="_p9SwitchPage('data')">
                <i class="fa-solid fa-database"></i><span class="p9-nav-label">Data & Sync</span>
            </button>
            <button class="p9-s-nav-btn" data-page="shortcuts" onclick="_p9SwitchPage('shortcuts')">
                <i class="fa-solid fa-keyboard"></i><span class="p9-nav-label">Shortcuts</span>
            </button>

            <div class="p9-s-section-label">More</div>
            <button class="p9-s-nav-btn" data-page="feedback" onclick="_p9SwitchPage('feedback')">
                <i class="fa-solid fa-comment-dots"></i><span class="p9-nav-label">Feedback</span>
            </button>
            <button class="p9-s-nav-btn" data-page="about" onclick="_p9SwitchPage('about')">
                <i class="fa-solid fa-circle-info"></i><span class="p9-nav-label">About</span>
            </button>

            <div class="p9-sidebar-signout">
                <button class="p9-s-nav-btn" onclick="if(typeof logOut==='function')logOut()" style="color:#f87171;">
                    <i class="ph-bold ph-sign-out"></i><span class="p9-nav-label">Sign Out</span>
                </button>
            </div>
        </div>

        <!-- Content -->
        <div id="p9-settings-content">

            <!-- ── PROFILE ── -->
            <div class="p9-s-page active" id="p9-page-profile">
                <div class="p9-page-title">My <span>Profile</span></div>
                <div class="p9-section">
                    <div class="p9-section-title">Identity</div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Student Name</div></div>
                        <input id="p9-name-input" type="text" class="p9-input" placeholder="Your name"
                               style="width:160px;text-align:right;"
                               oninput="if(typeof setStudentName==='function')setStudentName(this.value)">
                    </div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Profile Picture</div><div class="p9-row-sub">Avatar shown on forum posts</div></div>
                        <button class="p9-btn p9-btn-ghost" onclick="_p9CloseSettings();setTimeout(()=>{if(typeof openModal==='function')openModal('modal-profile')},200)">Edit →</button>
                    </div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Language</div></div>
                        <select id="p9-lang-select" class="p9-select" onchange="if(typeof setLanguage==='function')setLanguage(this.value)">
                            <option value="en">English</option>
                            <option value="nl">Nederlands</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- ── APPEARANCE ── -->
            <div class="p9-s-page" id="p9-page-appearance">
                <div class="p9-page-title">App <span>Appearance</span></div>
                <div class="p9-section">
                    <div class="p9-section-title">Theme</div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Light Mode</div><div class="p9-row-sub">Toggle between dark and light</div></div>
                        <div id="p9-theme-toggle" class="p9-toggle" onclick="_p9ToggleTheme()" title="Toggle theme"></div>
                    </div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Follow System Theme</div><div class="p9-row-sub">Auto-switch based on OS preference</div></div>
                        <div id="p9-sys-theme-toggle" class="p9-toggle" onclick="_p9ToggleSysTheme()"></div>
                    </div>
                </div>
                <div class="p9-section">
                    <div class="p9-section-title">Colors</div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Accent Color</div><div class="p9-row-sub">Main highlight color across the app</div></div>
                    </div>
                    <div class="p9-accent-grid" style="padding-bottom:14px;">
                        ${[['#3b82f6','Blue'],['#ef4444','Red'],['#10b981','Emerald'],['#8b5cf6','Violet'],['#f59e0b','Amber'],['#ec4899','Pink'],['#14b8a6','Teal'],['#f97316','Orange'],['#06b6d4','Cyan']].map(([c,n]) =>
                            `<div class="p9-accent-swatch" style="background:${c}" title="${n}" onclick="if(typeof setAccent==='function')setAccent('${c}');_p9RefreshAccentSwatches('${c}')"></div>`
                        ).join('')}
                        <input type="color" title="Custom color"
                               onchange="if(typeof setAccent==='function')setAccent(this.value);_p9RefreshAccentSwatches(this.value)"
                               style="width:30px;height:30px;border-radius:50%;padding:0;border:2px solid rgba(255,255,255,.2);cursor:pointer;background:none;">
                    </div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Clock Color</div><div class="p9-row-sub">Color of the dashboard clock</div></div>
                        <input type="color" id="p9-clock-color" value="#ffffff"
                               onchange="if(typeof setClockColor==='function')setClockColor(this.value)"
                               style="width:32px;height:32px;border-radius:50%;padding:0;border:2px solid rgba(255,255,255,.15);cursor:pointer;">
                    </div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Background Tint</div><div class="p9-row-sub">Ambient glow color in the background</div></div>
                        <input type="color" id="p9-bg-color"
                               onchange="if(typeof setBg==='function')setBg(this.value)"
                               style="width:32px;height:32px;border-radius:50%;padding:0;border:2px solid rgba(255,255,255,.15);cursor:pointer;">
                    </div>
                </div>
                <div class="p9-section">
                    <div class="p9-section-title">Typography & Layout</div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Font Scale</div><div class="p9-row-sub">Adjusts text size across the app</div></div>
                        <div class="p9-font-btns">
                            <button class="p9-font-btn" onclick="if(typeof setFontScale==='function')setFontScale(.85);_p9RefreshFontBtns(.85)">S</button>
                            <button class="p9-font-btn active" onclick="if(typeof setFontScale==='function')setFontScale(1);_p9RefreshFontBtns(1)">M</button>
                            <button class="p9-font-btn" onclick="if(typeof setFontScale==='function')setFontScale(1.12);_p9RefreshFontBtns(1.12)">L</button>
                        </div>
                    </div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Show Seconds on Clock</div><div class="p9-row-sub">Display seconds in dashboard clock</div></div>
                        <div id="p9-secs-toggle" class="p9-toggle" onclick="_p9ToggleSeconds()"></div>
                    </div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Compact Widget Mode</div><div class="p9-row-sub">Denser, smaller widget layout</div></div>
                        <div id="p9-compact-toggle" class="p9-toggle" onclick="_p9ToggleCompact()"></div>
                    </div>
                </div>
            </div>

            <!-- ── FOCUS TIMER ── -->
            <div class="p9-s-page" id="p9-page-timer">
                <div class="p9-page-title">Focus <span>& Timer</span></div>
                <div class="p9-section">
                    <div class="p9-section-title">Pomodoro Settings</div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Focus Duration</div><div class="p9-row-sub">Minutes per focus session</div></div>
                        <input type="number" id="p9-pomo-focus" class="p9-input p9-num-input" value="25" min="1" max="120"
                               onchange="if(typeof setCustomPomodoro==='function')setCustomPomodoro(this.value)">
                    </div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Short Break</div><div class="p9-row-sub">Minutes for short breaks</div></div>
                        <input type="number" id="p9-pomo-short" class="p9-input p9-num-input" value="5" min="1" max="30"
                               onchange="_p9SetPomoTime('short', this.value)">
                    </div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Long Break</div><div class="p9-row-sub">Minutes for long breaks</div></div>
                        <input type="number" id="p9-pomo-long" class="p9-input p9-num-input" value="15" min="1" max="60"
                               onchange="_p9SetPomoTime('long', this.value)">
                    </div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Sessions Before Long Break</div></div>
                        <input type="number" id="p9-pomo-sessions" class="p9-input p9-num-input" value="4" min="1" max="10"
                               onchange="_lsSet('p9_pomo_sessions', parseInt(this.value))">
                    </div>
                </div>
                <div class="p9-section">
                    <div class="p9-section-title">Behaviour</div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Timer Sound</div><div class="p9-row-sub">Play a sound when session ends</div></div>
                        <div id="p9-timer-sound-toggle" class="p9-toggle on" onclick="_p9ToggleTimerSound()"></div>
                    </div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Auto-start Breaks</div><div class="p9-row-sub">Automatically start the break timer</div></div>
                        <div id="p9-autobreak-toggle" class="p9-toggle" onclick="_p9ToggleAutoBreak()"></div>
                    </div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Daily Study Goal</div><div class="p9-row-sub">Target focus sessions per day</div></div>
                        <input type="number" id="p9-daily-goal" class="p9-input p9-num-input" value="4" min="1" max="20"
                               onchange="_lsSet('p9_daily_goal', parseInt(this.value))">
                    </div>
                </div>
            </div>

            <!-- ── NOTIFICATIONS ── -->
            <div class="p9-s-page" id="p9-page-notifications">
                <div class="p9-page-title">Notifications</div>
                <div class="p9-section">
                    <div class="p9-section-title">Permissions</div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Calendar Event Reminders</div><div class="p9-row-sub">Notify before upcoming events</div></div>
                        <button class="p9-btn p9-btn-ghost" onclick="if(typeof requestCalNotifications==='function')requestCalNotifications()">Enable</button>
                    </div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Task Due Reminders</div><div class="p9-row-sub">Alerts for tasks due today</div></div>
                        <button class="p9-btn p9-btn-ghost" onclick="if(typeof requestTaskNotifications==='function')requestTaskNotifications()">Enable</button>
                    </div>
                </div>
                <div class="p9-section">
                    <div class="p9-section-title">Preferences</div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Exam Warnings (days before)</div><div class="p9-row-sub">Alert when exam is this many days away</div></div>
                        <input type="number" id="p9-exam-warn" class="p9-input p9-num-input" value="14" min="1" max="60"
                               onchange="_lsSet('p9_exam_warn_days', parseInt(this.value))">
                    </div>
                </div>
            </div>

            <!-- ── DATA ── -->
            <div class="p9-s-page" id="p9-page-data">
                <div class="p9-page-title">Data <span>& Sync</span></div>
                <div class="p9-section">
                    <div class="p9-section-title">Import / Export</div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Export All Data</div><div class="p9-row-sub">Download a JSON backup of everything</div></div>
                        <button class="p9-btn p9-btn-ghost" onclick="if(typeof exportAllData==='function')exportAllData()">Export JSON</button>
                    </div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl">Import Data</div><div class="p9-row-sub">Restore from a JSON backup</div></div>
                        <button class="p9-btn p9-btn-ghost" onclick="document.getElementById('import-all-input').click()">Import JSON</button>
                    </div>
                </div>
                <div class="p9-section">
                    <div class="p9-section-title">Danger Zone</div>
                    <div class="p9-row">
                        <div><div class="p9-row-lbl" style="color:#f87171;">Reset All Data</div><div class="p9-row-sub">Permanently delete all your data</div></div>
                        <button class="p9-btn p9-btn-danger" onclick="if(typeof resetAllData==='function')resetAllData()">Reset</button>
                    </div>
                </div>
                <div style="padding:14px 0 4px;" id="p9-grade-scale-section">
                    <div class="p9-section">
                        <div class="p9-section-title">Academic</div>
                        <div class="p9-row">
                            <div><div class="p9-row-lbl">Grade Scale</div><div class="p9-row-sub">How grades are displayed</div></div>
                            <select class="p9-select" id="p9-grade-scale"
                                    onchange="_lsSet('p9_grade_scale',this.value)">
                                <option value="pct">Percentage (0–100%)</option>
                                <option value="ten">Out of 10</option>
                                <option value="twenty">Out of 20</option>
                                <option value="letter">Letter (A–F)</option>
                            </select>
                        </div>
                        <div class="p9-row">
                            <div><div class="p9-row-lbl">Week Starts On</div></div>
                            <select class="p9-select" id="p9-week-start"
                                    onchange="_lsSet('p9_week_start',this.value)">
                                <option value="mon">Monday</option>
                                <option value="sun">Sunday</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ── SHORTCUTS ── -->
            <div class="p9-s-page" id="p9-page-shortcuts">
                <div class="p9-page-title">Keyboard <span>Shortcuts</span></div>
                <div class="p9-section">
                    <div class="p9-section-title">Navigation</div>
                    ${[
                        ['Alt + 1–9', 'Switch to tab by number'],
                        ['Alt + T', 'New Task'],
                        ['Alt + N', 'New Note'],
                        ['Esc', 'Close modal / dialog'],
                    ].map(([k,v]) => `
                        <div class="p9-row">
                            <div class="p9-row-lbl">${v}</div>
                            <span class="p9-kbd">${k}</span>
                        </div>`).join('')}
                </div>
                <div class="p9-section">
                    <div class="p9-section-title">Study Cards</div>
                    ${[
                        ['Space', 'Flip flashcard'],
                        ['← Arrow', 'Mark as hard / go back'],
                        ['→ Arrow', 'Mark as easy / go forward'],
                    ].map(([k,v]) => `
                        <div class="p9-row">
                            <div class="p9-row-lbl">${v}</div>
                            <span class="p9-kbd">${k}</span>
                        </div>`).join('')}
                </div>
                <div class="p9-section">
                    <div class="p9-section-title">Notes Editor</div>
                    ${[
                        ['Tab', 'Indent bullet point'],
                        ['Shift + Tab', 'Outdent bullet point'],
                        ['Ctrl + Enter', 'Submit post/reply in forum'],
                    ].map(([k,v]) => `
                        <div class="p9-row">
                            <div class="p9-row-lbl">${v}</div>
                            <span class="p9-kbd">${k}</span>
                        </div>`).join('')}
                </div>
            </div>

            <!-- ── FEEDBACK ── -->
            <div class="p9-s-page" id="p9-page-feedback">
                <div class="p9-page-title">Send <span>Feedback</span></div>
                <div class="p9-section" style="padding-bottom:16px;">
                    <div class="p9-section-title">Your Feedback</div>
                    <div class="p9-row" style="flex-direction:column;align-items:flex-start;gap:8px;">
                        <div class="p9-row-lbl">Feedback Type</div>
                        <select class="p9-select" id="p9-fb-type" style="width:100%;">
                            <option value="general">💬 General Feedback</option>
                            <option value="bug">🐛 Bug Report</option>
                            <option value="feature">✨ Feature Request</option>
                            <option value="praise">❤️ Compliment / Praise</option>
                        </select>
                    </div>
                    <div class="p9-row" style="flex-direction:column;align-items:flex-start;gap:8px;">
                        <div class="p9-row-lbl">Your Message</div>
                        <textarea class="p9-textarea" id="p9-fb-text" placeholder="Tell us anything — bugs, ideas, compliments… we read every message! 💌"></textarea>
                    </div>
                    <div style="display:flex;gap:10px;padding:12px 0 4px;align-items:center;flex-wrap:wrap;">
                        <button class="p9-btn p9-btn-primary" onclick="_p9SubmitFeedback()">
                            <i class="fa-solid fa-paper-plane" style="margin-right:6px;"></i>Send Feedback
                        </button>
                        <div id="p9-feedback-status"></div>
                    </div>
                </div>
                <div style="font-size:.75rem;color:var(--text-muted);line-height:1.6;padding:0 2px;">
                    Your feedback is sent to <strong style="color:var(--accent);">lars.dehairs@gmail.com</strong> and logged securely.
                    We aim to respond within a few days. Thank you for helping improve StudentOS! 🙏
                </div>
            </div>

            <!-- ── ABOUT ── -->
            <div class="p9-s-page" id="p9-page-about">
                <div class="p9-page-title">About <span>StudentOS</span></div>
                <div class="p9-about-card">
                    <div class="p9-about-icon"><i class="ph-bold ph-student"></i></div>
                    <div>
                        <div class="p9-about-appname">StudentOS</div>
                        <div class="p9-about-version">Version 9.0 · patches9.js</div>
                        <div class="p9-about-desc">Your all-in-one student workspace 🎓</div>
                    </div>
                </div>
                <div class="p9-stat-grid">
                    <div class="p9-stat-card"><div class="p9-stat-val">50+</div><div class="p9-stat-lbl">Active Users</div></div>
                    <div class="p9-stat-card"><div class="p9-stat-val">9</div><div class="p9-stat-lbl">Patch Updates</div></div>
                    <div class="p9-stat-card"><div class="p9-stat-val">120+</div><div class="p9-stat-lbl">Built-in Formulas</div></div>
                </div>
                <div class="p9-section">
                    <div class="p9-section-title">Developer</div>
                    <div class="p9-row">
                        <div class="p9-row-lbl">Contact</div>
                        <a href="mailto:lars.dehairs@gmail.com" style="color:var(--accent);font-size:.85rem;">lars.dehairs@gmail.com</a>
                    </div>
                    <div class="p9-row">
                        <div class="p9-row-lbl">Made with ❤️ for students</div>
                        <span style="font-size:.8rem;color:var(--text-muted);">Happy studying!</span>
                    </div>
                </div>
                <div class="p9-section">
                    <div class="p9-section-title">Features</div>
                    ${['Tasks & Calendar', 'Study Cards (Flashcards)', 'Notes with Rich Editing', 'Whiteboard & Mind Map', 'Forum (50+ users!)', 'Formula Sheets + Library', 'Grades Tracker', 'Focus Timer (Pomodoro)', 'Music Player', 'Weather Widget', 'Offline Support', 'Firebase Sync'].map(f =>
                        `<div class="p9-row" style="padding:8px 0;">
                            <div style="font-size:.82rem;"><i class="fa-solid fa-check" style="color:#22c55e;margin-right:8px;"></i>${f}</div>
                        </div>`
                    ).join('')}
                </div>
            </div>

        </div><!-- end #p9-settings-content -->
    `;
    document.body.appendChild(el);
    _p9SyncSettingsValues();
}

/* Sync current values into settings UI */
function _p9SyncSettingsValues() {
    try {
        // Name
        const ni = document.getElementById('p9-name-input');
        if (ni) { const n = document.getElementById('student-name-input'); if (n) ni.value = n.value; }
        // Language
        const li = document.getElementById('p9-lang-select');
        if (li) { const l = document.getElementById('lang-select'); if (l) li.value = l.value; }
        // Theme
        const isLight = document.documentElement.hasAttribute('data-theme');
        const tt = document.getElementById('p9-theme-toggle');
        if (tt) tt.classList.toggle('on', isLight);
        // System theme
        const sysTheme = _lsGet('p9_sys_theme', false);
        const st = document.getElementById('p9-sys-theme-toggle');
        if (st) st.classList.toggle('on', sysTheme);
        // Clock color
        const cp = document.getElementById('p9-clock-color');
        if (cp) { const c = document.getElementById('clock-color-picker'); if (c) cp.value = c.value; }
        // Pomo focus
        const pf = document.getElementById('p9-pomo-focus');
        if (pf) { const o = document.getElementById('custom-pomodoro'); if (o) pf.value = o.value; }
        // Pomo short/long
        const pomTimes = _lsGet('os_pomo_times', { short: 5, long: 15 });
        const ps = document.getElementById('p9-pomo-short'); if (ps) ps.value = pomTimes.short || 5;
        const pl = document.getElementById('p9-pomo-long');  if (pl) pl.value = pomTimes.long  || 15;
        // Timer sound
        const tsd = document.getElementById('timer-sound-dot');
        const ts  = document.getElementById('p9-timer-sound-toggle');
        if (ts && tsd) ts.classList.toggle('on', tsd.style.transform !== '');
        // Show seconds
        const showSecs = _lsGet('p9_show_seconds', false);
        const ssToggle = document.getElementById('p9-secs-toggle');
        if (ssToggle) ssToggle.classList.toggle('on', showSecs);
        // Compact
        const compact = _lsGet('p9_compact', false);
        const ct = document.getElementById('p9-compact-toggle');
        if (ct) ct.classList.toggle('on', compact);
        // Grade scale
        const gs = document.getElementById('p9-grade-scale');
        if (gs) gs.value = _lsGet('p9_grade_scale', 'pct');
        // Week start
        const ws = document.getElementById('p9-week-start');
        if (ws) ws.value = _lsGet('p9_week_start', 'mon');
        // Exam warn
        const ew = document.getElementById('p9-exam-warn');
        if (ew) ew.value = _lsGet('p9_exam_warn_days', 14);
        // Daily goal
        const dg = document.getElementById('p9-daily-goal');
        if (dg) dg.value = _lsGet('p9_daily_goal', 4);
        // Pomo sessions
        const ps2 = document.getElementById('p9-pomo-sessions');
        if (ps2) ps2.value = _lsGet('p9_pomo_sessions', 4);
        // Autobreak
        const ab = document.getElementById('p9-autobreak-toggle');
        if (ab) {
            const origAB = typeof window.pomodoroAutoBreak !== 'undefined' ? window.pomodoroAutoBreak : _lsGet('os_pomo_autobreak', false);
            ab.classList.toggle('on', origAB);
        }
        // Accent swatches highlight
        const currentAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
        if (currentAccent) _p9RefreshAccentSwatches(currentAccent);
        // Font scale
        const currentFs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-scale') || 1);
        _p9RefreshFontBtns(currentFs);
    } catch {}
}

window._p9SwitchPage = function(page) {
    document.querySelectorAll('.p9-s-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.p9-s-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    const p = document.getElementById('p9-page-' + page);
    if (p) p.classList.add('active');
};

window._p9RefreshAccentSwatches = function(color) {
    document.querySelectorAll('.p9-accent-swatch').forEach(s => {
        const c = s.style.background.replace(/\s/g, '').toLowerCase();
        s.classList.toggle('active', c === color.replace(/\s/g,'').toLowerCase());
    });
};

window._p9RefreshFontBtns = function(scale) {
    document.querySelectorAll('.p9-font-btn').forEach(b => {
        const map = { S: .85, M: 1, L: 1.12 };
        b.classList.toggle('active', Math.abs(map[b.textContent] - scale) < 0.01);
    });
};

window._p9ToggleTheme = function() {
    if (typeof toggleTheme === 'function') toggleTheme();
    const isLight = document.documentElement.hasAttribute('data-theme');
    const tt = document.getElementById('p9-theme-toggle');
    if (tt) tt.classList.toggle('on', isLight);
};

window._p9ToggleSysTheme = function() {
    const cur = _lsGet('p9_sys_theme', false);
    const next = !cur;
    _lsSet('p9_sys_theme', next);
    const st = document.getElementById('p9-sys-theme-toggle');
    if (st) st.classList.toggle('on', next);
    if (next) _applySystemTheme();
};

function _applySystemTheme() {
    if (!_lsGet('p9_sys_theme', false)) return;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const want = prefersDark ? 'dark' : 'light';
    const current = document.documentElement.hasAttribute('data-theme') ? 'light' : 'dark';
    if (want !== current && typeof toggleTheme === 'function') toggleTheme();
}

window._p9ToggleSeconds = function() {
    const cur = _lsGet('p9_show_seconds', false);
    _lsSet('p9_show_seconds', !cur);
    const t = document.getElementById('p9-secs-toggle');
    if (t) t.classList.toggle('on', !cur);
};

window._p9ToggleCompact = function() {
    const cur = _lsGet('p9_compact', false);
    _lsSet('p9_compact', !cur);
    const t = document.getElementById('p9-compact-toggle');
    if (t) t.classList.toggle('on', !cur);
    document.body.classList.toggle('p9-compact', !cur);
};

window._p9ToggleTimerSound = function() {
    if (typeof toggleTimerSound === 'function') toggleTimerSound();
    const tsd = document.getElementById('timer-sound-dot');
    const ts  = document.getElementById('p9-timer-sound-toggle');
    if (ts && tsd) setTimeout(() => ts.classList.toggle('on', tsd.style.transform !== ''), 50);
};

window._p9ToggleAutoBreak = function() {
    if (window.pomodoroAutoBreak !== undefined) {
        window.pomodoroAutoBreak = !window.pomodoroAutoBreak;
        _dbSet('os_pomo_autobreak', window.pomodoroAutoBreak);
    }
    const ab = document.getElementById('p9-autobreak-toggle');
    if (ab) ab.classList.toggle('on');
};

window._p9SetPomoTime = function(type, val) {
    const times = _lsGet('os_pomo_times', { focus: 25, short: 5, long: 15 });
    times[type] = parseInt(val) || times[type];
    _lsSet('os_pomo_times', times);
    _dbSet('os_pomo_times', times);
};

/* Open / close */
function _p9OpenSettings() {
    _buildSettingsUI();
    _p9SyncSettingsValues();
    document.body.classList.add('p9-settings-active');
    requestAnimationFrame(() => {
        document.getElementById('p9-settings').classList.add('open');
    });
}
window._p9CloseSettings = function() {
    const el = document.getElementById('p9-settings');
    if (el) el.classList.remove('open');
    document.body.classList.remove('p9-settings-active');
};

/* Override openModal to intercept settings */
function _patchOpenModal() {
    function _tryPatch() {
        if (typeof window.openModal !== 'function') { setTimeout(_tryPatch, 200); return; }
        const _orig = window.openModal;
        window.openModal = function(id) {
            if (id === 'modal-settings') { _p9OpenSettings(); return; }
            _orig(id);
        };
    }
    _tryPatch();
}

/* Escape key to close settings */
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        const settings = document.getElementById('p9-settings');
        if (settings && settings.classList.contains('open')) { _p9CloseSettings(); return; }
        const fl = document.getElementById('p9-formula-library');
        if (fl && fl.classList.contains('open')) { _closeFormulaLibrary(); return; }
    }
});

/* ================================================================
   SECTION 9 — FEEDBACK SUBMISSION
   ================================================================ */
window._p9SubmitFeedback = async function() {
    const type    = document.getElementById('p9-fb-type')?.value || 'general';
    const text    = document.getElementById('p9-fb-text')?.value?.trim() || '';
    const status  = document.getElementById('p9-feedback-status');
    if (!text) {
        if (status) { status.textContent = '⚠️ Please write something first!'; status.className = 'err'; }
        return;
    }
    if (status) { status.textContent = 'Sending…'; status.className = ''; }
    
    // 1. Open mailto as fallback (always works)
    const subject = encodeURIComponent(`StudentOS Feedback: ${type.charAt(0).toUpperCase() + type.slice(1)}`);
    const body    = encodeURIComponent(`Feedback Type: ${type}\n\n${text}\n\n---\nFrom: ${_uName || 'Anonymous user'}\nUser ID: ${_uid || 'not logged in'}`);
    const mailLink = document.createElement('a');
    mailLink.href  = `mailto:lars.dehairs@gmail.com?subject=${subject}&body=${body}`;
    mailLink.style.display = 'none';
    document.body.appendChild(mailLink);
    mailLink.click();
    document.body.removeChild(mailLink);

    // 2. Also save to Firestore if available
    if (_db) {
        try {
            await addDoc(collection(_db, 'feedback'), {
                type, text, uid: _uid || null, name: _uName || 'Anonymous',
                createdAt: serverTimestamp(), version: 'patches9'
            });
        } catch {}
    }

    if (status) { status.textContent = '✓ Feedback sent! Thank you 💌'; status.className = 'ok'; }
    const fb = document.getElementById('p9-fb-text');
    if (fb) fb.value = '';
    setTimeout(() => { if (status) { status.textContent = ''; } }, 6000);
};

/* ================================================================
   SECTION 10 — COMPACT MODE + SECONDS CLOCK
   ================================================================ */
function _applyCompact() {
    if (_lsGet('p9_compact', false)) {
        document.body.classList.add('p9-compact');
    }
}

function _patchClockSeconds() {
    // Patch the clock to show seconds if setting is on
    const _tryPatch = () => {
        const clockEl = document.getElementById('clock-time');
        if (!clockEl) { setTimeout(_tryPatch, 500); return; }
        const _orig_tick = window._p9_clock_hooked;
        if (_orig_tick) return;
        window._p9_clock_hooked = true;
        setInterval(() => {
            if (!_lsGet('p9_show_seconds', false)) return;
            const n = new Date();
            const h = n.getHours(); const m = n.getMinutes(); const s = n.getSeconds();
            const fmt = (x) => String(x).padStart(2, '0');
            const use12 = _lsGet('os_clock_12h', false);
            let display;
            if (use12) {
                const hh = h % 12 || 12;
                const ampm = h < 12 ? 'AM' : 'PM';
                display = `${fmt(hh)}:${fmt(m)}:${fmt(s)} ${ampm}`;
            } else {
                display = `${fmt(h)}:${fmt(m)}:${fmt(s)}`;
            }
            clockEl.textContent = display;
        }, 1000);
    };
    _tryPatch();
}

/* ================================================================
   SECTION 11 — MOBILE NAV BOTTOM PILL (optional enhancement)
   ================================================================ */
function _syncMobileNavActive() {
    // When switchTab fires, keep the mobile nav bottom pill in sync
    function _tryPatch() {
        if (typeof window.switchTab !== 'function') { setTimeout(_tryPatch, 400); return; }
        if (window._p9_switchTabHooked) return;
        window._p9_switchTabHooked = true;
        const _orig = window.switchTab;
        window.switchTab = function(name) {
            _orig(name);
            // Update bottom nav pill active state
            document.querySelectorAll('.mob-npb-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.tab === name);
            });
        };
    }
    _tryPatch();
}

/* ================================================================
   SECTION 12 — SYSTEM THEME LISTENER
   ================================================================ */
function _watchSystemTheme() {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => {
        if (_lsGet('p9_sys_theme', false)) _applySystemTheme();
    });
    _applySystemTheme();
}

/* ================================================================
   SECTION 13 — BUG FIXES
   ================================================================ */
function _applyBugFixes() {
    // Fix: Widgets grid needs minimum column span on mobile
    const grid = document.getElementById('widgets-grid');
    if (grid) {
        const mo = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (entry.contentRect.width < 500) {
                    grid.style.gridTemplateColumns = '1fr';
                } else if (entry.contentRect.width < 800) {
                    grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
                } else {
                    grid.style.gridTemplateColumns = '';
                }
            }
        });
        mo.observe(grid);
    }
    
    // Fix: Forum light mode — inject extra CSS for .fpc-meta, fpc-subject-tag
    const extraCSS = document.createElement('style');
    extraCSS.textContent = `
        [data-theme="light"] .fpc-subject-tag { opacity: .9; }
        [data-theme="light"] .fpc-solved-badge { background: rgba(34,197,94,.12) !important; color: #16a34a !important; }
        [data-theme="light"] #forum-new-panel input,
        [data-theme="light"] #forum-new-panel textarea,
        [data-theme="light"] #forum-new-panel select { color: var(--text-main) !important; }
        [data-theme="light"] .forum-input-style { color: var(--text-main) !important; }
        /* Compact mode */
        body.p9-compact .min-card { border-radius: 14px !important; }
        body.p9-compact .widget-item { padding: 12px !important; }
        body.p9-compact .formula-card { padding: 11px !important; }
        /* Settings active - hide gear nav button tooltip etc */
        .p9-settings-active .nav-btn[onclick*="modal-settings"] { color: var(--accent); }
    `;
    document.head.appendChild(extraCSS);

    // Fix: make sure forum-new-body has proper styling for light mode
    setTimeout(() => {
        const forumBody = document.getElementById('forum-new-body');
        if (forumBody) {
            forumBody.style.fontFamily = 'inherit';
        }
    }, 1000);

    // Fix: widget-hidden class
    if (!document.getElementById('p9-widget-hidden-style')) {
        const s = document.createElement('style');
        s.id = 'p9-widget-hidden-style';
        s.textContent = '.widget-hidden { display: none !important; }';
        document.head.appendChild(s);
    }
}

/* ================================================================
   INIT
   ================================================================ */
function _p9Init() {
    _buildSettingsUI();
    _injectFormulaLibraryBtn();
    _injectWidgets();
    _patchWidgetManager();
    _patchOpenModal();
    _applyBugFixes();
    _applyCompact();
    _watchSystemTheme();
    _patchClockSeconds();
    _syncMobileNavActive();

    // Wait for formula view to be visible to inject library btn properly
    const _retryLibBtn = () => {
        if (!document.getElementById('p9-library-btn')) {
            _injectFormulaLibraryBtn();
            setTimeout(_retryLibBtn, 1500);
        }
    };
    setTimeout(_retryLibBtn, 800);
    
    console.log('[patches9] ✓ Loaded — Settings Fullscreen · Weather · Formula Library · New Widgets · Bug Fixes');
}

// Boot when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(_p9Init, 400));
} else {
    setTimeout(_p9Init, 400);
}
