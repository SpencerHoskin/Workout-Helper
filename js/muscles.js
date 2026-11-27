// Muscle map: a front and a back figure in flat blocks. The main muscles fill with the theme's accent, the helpers
// are striped, everything else stays a quiet panel colour; the key under it names them, so colour isn't the only cue.
import { ANATOMY } from './catalog.js';
import { esc } from './util.js';

export const MUSCLES = {
  chest: 'Chest', 'front-delts': 'Front shoulders', 'side-delts': 'Side shoulders', 'rear-delts': 'Rear shoulders',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', abs: 'Abs', obliques: 'Obliques',
  lats: 'Lats', 'upper-back': 'Upper back', 'lower-back': 'Lower back',
  glutes: 'Glutes', abductors: 'Outer hips', adductors: 'Inner thighs', quads: 'Quads', hamstrings: 'Hamstrings', calves: 'Calves'
};

/** { mus, also, look } for an exercise: the catalog's, or what you set on a custom one. */
export function anatomyOf(ex) {
  const a = ANATOMY[ex.id];
  if (a) return a;
  return { mus: Array.isArray(ex.mus) ? ex.mus.filter(m => MUSCLES[m]) : [], also: [], look: '' };
}

// Each region: [muscle ids ('a|b' = either lights it) or null for plain body, shape]. Drawn in a 100 × 200 box.
// pair() mirrors a path across the centre line (M/L/Q points only).
const mirror = d => d.replace(/([ML]|Q)?\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (m, cmd, x, y) => `${cmd || ''}${100 - Number(x)} ${y} `);
const pair = (id, d) => [[id, d], [id, mirror(d)]];
const HEAD = [[null, '<ellipse cx="50" cy="13" rx="9" ry="11"/>'], [null, '<rect x="45" y="23" width="10" height="7"/>']];
const LIMBS = [
  ...pair('forearms', 'M23 69 Q19 72 18 84 L17 94 L22 95 Q27 84 28 70 Z'),
  [null, '<circle cx="19" cy="99" r="4"/>'], [null, '<circle cx="81" cy="99" r="4"/>'],
  [null, '<ellipse cx="43" cy="144" rx="5" ry="4"/>'], [null, '<ellipse cx="57" cy="144" rx="5" ry="4"/>'],
  [null, '<ellipse cx="43" cy="189" rx="6" ry="3"/>'], [null, '<ellipse cx="57" cy="189" rx="6" ry="3"/>']
];
const FRONT = [
  ...HEAD, ...LIMBS,
  ['front-delts|side-delts', '<circle cx="31" cy="37" r="7"/>'], ['front-delts|side-delts', '<circle cx="69" cy="37" r="7"/>'],
  ...pair('chest', 'M50 31 L37 31 Q31 33 31 41 Q33 51 50 52 Z'),
  ...pair('biceps', 'M25 44 Q21 46 21 56 Q21 64 24 67 L29 66 Q31 58 30 46 Z'),
  ...pair('obliques', 'M42 54 L34 52 Q33 70 37 86 L42 88 Z'),
  ['abs', 'M43 54 L57 54 L57 86 Q50 90 43 86 Z'],
  [null, 'M37 88 Q50 95 63 88 L64 97 L36 97 Z'],
  ...pair('quads', 'M36 98 L46 98 Q46 120 47 140 L39 140 Q34 120 36 98 Z'),
  ...pair('adductors', 'M46 98 L50 98 L50 124 Q47 120 46 110 Z'),
  ...pair(null, 'M39 149 L47 149 L46 184 L41 184 Z')
];
const BACK = [
  ...HEAD, ...LIMBS,
  ['rear-delts|side-delts', '<circle cx="31" cy="37" r="7"/>'], ['rear-delts|side-delts', '<circle cx="69" cy="37" r="7"/>'],
  ...pair('triceps', 'M25 44 Q21 46 21 56 Q21 64 24 67 L29 66 Q31 58 30 46 Z'),
  ...pair('lats', 'M38 34 Q33 42 34 58 Q36 72 44 80 L46 66 L44 52 Q40 44 38 34 Z'),
  ['upper-back', 'M50 26 L38 32 Q40 44 44 52 L50 56 L56 52 Q60 44 62 32 Z'],
  ['lower-back', 'M45 58 L55 58 L56 84 L44 84 Z'],
  ...pair('abductors', 'M36 84 L44 84 L41 92 L35 92 Z'),
  ...pair('glutes', 'M35 92 L50 90 L50 106 Q42 110 36 104 Z'),
  ...pair('hamstrings', 'M36 108 L49 108 Q49 124 47 140 L39 140 Q35 124 36 108 Z'),
  ...pair('calves', 'M39 148 Q36 158 39 170 L42 182 L46 182 Q49 164 47 148 Z')
];

function figure(regions, main, also, dx) {
  return `<g transform="translate(${dx} 0)">${regions.map(([ids, shape]) => {
    const list = ids ? ids.split('|') : [];
    const cls = list.some(m => main.has(m)) ? 'mm-main' : list.some(m => also.has(m)) ? 'mm-also' : 'mm-off';
    const el = shape.startsWith('<') ? shape.replace(/^<(\w+)/, `<$1 class="${cls}"`) : `<path class="${cls}" d="${shape}"/>`;
    return el;
  }).join('')}</g>`;
}

/** The front + back map with a named key: main muscles solid, helpers striped. '' when there's nothing to show. */
export function muscleMap(ex) {
  const { mus, also } = anatomyOf(ex);
  if (!mus.length && !also.length) return '';
  const main = new Set(mus), help = new Set(also);
  const names = list => list.map(m => esc(MUSCLES[m] || m)).join(', ');
  return `<figure class="mmap">
    <svg viewBox="0 0 220 204" role="img" aria-label="${mus.length ? 'Works ' + names(mus) : 'Mostly heart and lungs'}${also.length ? '; also ' + names(also) : ''}">
      <defs><pattern id="mm-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="4" height="4" class="mm-hatch-bg"/><rect width="2" height="4" class="mm-hatch-line"/></pattern></defs>
      ${figure(FRONT, main, help, 0)}${figure(BACK, main, help, 120)}
      <text x="50" y="202" text-anchor="middle">FRONT</text><text x="170" y="202" text-anchor="middle">BACK</text>
    </svg>
    <figcaption>${mus.length ? `<span><i class="mm-key mm-main"></i>Main: ${names(mus)}</span>` : '<span>Mostly heart and lungs</span>'}
      ${also.length ? `<span><i class="mm-key mm-also"></i>Also: ${names(also)}</span>` : ''}</figcaption>
  </figure>`;
}

/** "Quads, Glutes" — the main muscles as one short line for lists. */
export const mainMuscles = ex => anatomyOf(ex).mus.map(m => MUSCLES[m]).join(', ');
