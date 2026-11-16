// «Блочная зима»: новогодняя ночь в блочном пиксельном стиле — северное
// сияние, луна, холмы из блоков в снегу, ёлка с гирляндой, подарки, снеговик
// и падающий снег. Рисунки свои, без персонажей, текстур и логотипов игр.
// В светлом режиме ночь становится снежным днём: солнце, облака, голубоватый
// снег. Всё движение идёт ступеньками (steps), по-пиксельному и экономно.

const W = 1600
const H = 1000
const BLOCK = 20
const PX = 10

function seeded(seed: number): () => number {
  let a = seed >>> 0

  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const num = (n: number): string => String(Math.round(n * 10) / 10)
const snap = (n: number, step = 5): number => Math.round(n / step) * step

/** Rectangles gathered per CSS class and printed as one path per class. */
class Layer {
  private readonly parts = new Map<string, string[]>()

  rect(cls: string, x: number, y: number, w: number, h: number): this {
    const d = `M${num(x)} ${num(y)}h${num(w)}v${num(h)}h${num(-w)}z`
    const list = this.parts.get(cls)

    if (list === undefined) {
      this.parts.set(cls, [d])
    } else {
      list.push(d)
    }

    return this
  }

  toString(): string {
    let out = ''

    for (const [cls, list] of this.parts) {
      out += `<path class="${cls}" d="${list.join('')}"/>`
    }

    return out
  }
}

/** Draws rows of characters, one cell each: `palette` names each character's class, '.' is empty. */
function sprite(
  layer: Layer,
  rows: readonly string[],
  palette: Readonly<Record<string, string>>,
  x0: number,
  y0: number,
  px = PX,
): Layer {
  rows.forEach((row, y) => {
    let x = 0

    while (x < row.length) {
      const ch = row.charAt(x)
      let end = x + 1

      while (end < row.length && row.charAt(end) === ch) {
        end++
      }

      const cls = palette[ch]

      if (cls !== undefined) {
        layer.rect(cls, x0 + x * px, y0 + y * px, (end - x) * px, px)
      }

      x = end
    }
  })

  return layer
}

// ---------------------------------------------------------------------------
// Рельеф: два снежных холма по краям (там ёлка и снеговик) и низкая долина
// посередине, чтобы за полем ввода было тёмное спокойное место.

const COLS = W / BLOCK
const LEFT_HILL = 7
const RIGHT_HILL = 67

function hill(col: number, center: number, flat: number, fall: number): number {
  const d = Math.abs(col - center) - flat

  if (d <= 0) {
    return 1
  }

  return d >= fall ? 0 : (1 + Math.cos((Math.PI * d) / fall)) / 2
}

function heightAt(col: number): number {
  return (
    2 +
    Math.round(
      7 * hill(col, LEFT_HILL, 3, 9) +
        8 * hill(col, RIGHT_HILL, 4, 10) +
        1.4 * hill(col, 29, 0, 5) +
        1.2 * hill(col, 47, 0, 5),
    )
  )
}

const groundTop = (col: number): number => H - heightAt(col) * BLOCK

function terrain(rand: () => number): string {
  const blocks = new Layer()
  const details = new Layer()
  const cell = () => 5 * Math.floor(rand() * 4)

  for (let col = 0; col < COLS; col++) {
    const h = heightAt(col)
    const x = col * BLOCK
    const top = groundTop(col)
    const valley = h <= 3
    const snow = valley ? 'snow-v' : 'snow'
    const snowShade = valley ? 'snow-vs' : 'snow-s'

    for (let row = 0; row < h; row++) {
      const y = top + row * BLOCK

      if (row === 0) {
        blocks.rect(snow, x, y, BLOCK, BLOCK)
        details.rect(snowShade, x, y + BLOCK - 5, BLOCK, 5)

        if (!valley && rand() < 0.35) {
          details.rect('snow-z', x + cell(), y + 5 * Math.floor(rand() * 2), 5, 5)
        }

        continue
      }

      const stone = row >= 4
      const even = (col + row) % 2 === 0
      blocks.rect(stone ? (even ? 'stone-a' : 'stone-b') : even ? 'dirt-a' : 'dirt-b', x, y, BLOCK, BLOCK)
      details.rect(stone ? 'stone-k' : 'dirt-k', x + cell(), y + cell(), 5, 5)

      if (rand() < 0.45) {
        details.rect(stone ? 'stone-l' : 'dirt-l', x + cell(), y + cell(), 5, 5)
      }

      if (stone && rand() < 0.14) {
        // Самоцвет в камне: пара блестящих пикселей.
        const gem = ['ore-g', 'ore-u', 'ore-o'][Math.floor(rand() * 3)] ?? 'ore-g'
        const gx = x + cell()
        const gy = y + cell()
        details.rect(gem, gx, gy, 5, 5).rect(gem, gx + (gx - x < 15 ? 5 : -5), gy + (gy - y < 15 ? 5 : -5), 5, 5)
      }

      if (row === 1) {
        // Снег свисает через край блока.
        details.rect(snowShade, x, y, BLOCK, 5)

        if (rand() < 0.6) {
          details.rect(snowShade, x + cell(), y + 5, 5, 5 * (1 + Math.floor(rand() * 2)))
        }
      }
    }
  }

  return `${blocks}${details}`
}

// Дальний лес: ступенчатые силуэты елей вдоль горизонта, в два слоя.
function forest(rand: () => number): string {
  const layer = new Layer()
  const kinds = [
    { cls: 'far-a', count: 30, low: 75, high: 135 },
    { cls: 'far-b', count: 22, low: 105, high: 190 },
  ] as const

  for (const kind of kinds) {
    for (let i = 0; i < kind.count; i++) {
      const cx = snap(rand() * W)
      const height = snap(kind.low + rand() * (kind.high - kind.low), 15)
      const base = 975

      for (let y = base - height; y < base; y += 15) {
        const k = (y - (base - height)) / height
        const half = snap(5 + k * height * 0.3)
        layer.rect(kind.cls, cx - half, y, half * 2, 15)
      }
    }
  }

  return layer.toString()
}

// ---------------------------------------------------------------------------
// Небо: звёзды, северное сияние, луна (днём — солнце) и облака (только днём).

const MOON_X = 300
const MOON_Y = 165

function stars(rand: () => number): string {
  const still = new Layer()
  const a = new Layer()
  const b = new Layer()
  const nearMoon = (x: number, y: number, room: number) => Math.hypot(x - MOON_X, y - MOON_Y) < room

  for (let i = 0; i < 95; i++) {
    const x = snap(rand() * W)
    const y = snap(rand() * 640)
    const size = rand() < 0.8 ? 5 : 10
    const pick = rand()

    if (!nearMoon(x, y, 130)) {
      ;(pick < 0.55 ? still : pick < 0.8 ? a : b).rect('star', x, y, size, size)
    }
  }

  // Искорки: крестик из пяти пикселей.
  for (let i = 0; i < 9; i++) {
    const x = snap(rand() * W)
    const y = snap(40 + rand() * 520)

    if (!nearMoon(x, y, 160)) {
      ;(i % 2 === 0 ? a : b).rect('star', x, y - 5, 5, 15).rect('star', x - 5, y, 15, 5)
    }
  }

  return `<g class="stars">${still}<g class="tw-a">${a}</g><g class="tw-b">${b}</g></g>`
}

function aurora(): string {
  const col = 20
  // Волны с периодом, кратным ширине сцены: две копии подряд, сдвиг на 1600
  // даёт бесшовную петлю.
  const band = (gradient: string, base: number, amp: number, phase: number, thick: number) => {
    let out = ''

    for (let copy = 0; copy < 2; copy++) {
      for (let x = 0; x < W; x += col) {
        const t = (x / W) * Math.PI * 2
        const top = base + amp * Math.sin(2 * t + phase) + amp * 0.4 * Math.sin(5 * t + 1.7 * phase)
        const h = thick * (1 + 0.45 * Math.sin(3 * t + 0.6 * phase))
        out += `<rect x="${x + copy * W}" y="${snap(top, 10)}" width="${col}" height="${snap(h, 10)}"/>`
      }
    }

    return `<g fill="url(#${gradient})">${out}</g>`
  }

  return (
    '<g class="aur-wrap"><g class="aur-glow"><g class="aur">' +
    band('au-a', 140, 55, 0, 190) +
    band('au-b', 225, 40, 2.1, 130) +
    '</g></g></g>'
  )
}

function moonRows(): string[] {
  const r = 7
  const craters = new Set(['-3,-2', '-2,-2', '-3,-1', '2,1', '3,1', '2,2', '-1,3', '1,-4', '0,-4'])
  const rows: string[] = []

  for (let y = -r; y <= r; y++) {
    let line = ''

    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r + 3) {
        line += '.'
      } else if (x + y >= 7) {
        line += 's'
      } else {
        line += craters.has(`${x},${y}`) ? 'd' : 'm'
      }
    }

    rows.push(line)
  }

  return rows
}

const CLOUD = [
  '......cccc........',
  '....cccccccc.cc...',
  '..cccccccccccccc..',
  '.cccccccccccccccc.',
  'cccccccccccccccccc',
  '.cccccccccccccccc.',
]

// ---------------------------------------------------------------------------
// Ёлка: звезда, четыре яруса с тенью справа и снегом на кончиках веток,
// ствол, игрушки и гирлянда (огоньки мигают тремя волнами).

type Light = { x: number; y: number; color: string; group: number }

const TREE_WIDTH = 29
const TREE_CENTER = 14
const TREE_STAR = ['...Y...', '..YYY..', 'YYYYYYY', '.YYYYy.', '..YYy..', '.YY.yy.', '.Y...y.']
const TREE_TIERS = [
  { top: 6, rows: 6, from: 0, to: 4 },
  { top: 11, rows: 7, from: 2, to: 7 },
  { top: 17, rows: 8, from: 4, to: 10 },
  { top: 24, rows: 9, from: 6, to: 14 },
] as const

function tree(rand: () => number): { rows: string[]; lights: Light[] } {
  const grid: string[][] = []
  const c = TREE_CENTER
  const line = (y: number): string[] => {
    while (grid.length <= y) {
      grid.push(new Array<string>(TREE_WIDTH).fill('.'))
    }

    return grid[y] ?? []
  }
  const put = (x: number, y: number, ch: string) => {
    if (x >= 0 && x < TREE_WIDTH) {
      line(y)[x] = ch
    }
  }
  const at = (x: number, y: number): string => grid[y]?.[x] ?? '.'
  const halfAt = (tier: (typeof TREE_TIERS)[number], r: number) =>
    Math.round(tier.from + ((tier.to - tier.from) * r) / (tier.rows - 1))

  TREE_STAR.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row.charAt(x)

      if (ch !== '.') {
        put(c - 3 + x, y, ch)
      }
    }
  })

  for (const tier of TREE_TIERS) {
    for (let r = 0; r < tier.rows; r++) {
      const half = halfAt(tier, r)
      const lit = Math.max(1, Math.floor(half * 0.4))

      for (let dx = -half; dx <= half; dx++) {
        const ch = dx < -half + lit ? 'G' : half > 1 && dx >= half - 1 ? 'd' : 'g'
        put(c + dx, tier.top + r, ch)
      }
    }
  }

  // Снег на кончиках веток: та часть нижнего ряда яруса, что видна из-под
  // следующего яруса.
  TREE_TIERS.forEach((tier, i) => {
    const y = tier.top + tier.rows - 1
    const covered = TREE_TIERS[i + 1]?.from ?? tier.to - 3

    for (let dx = covered + 1; dx <= tier.to; dx++) {
      put(c - dx, y, 's')
      put(c + dx, y, 'S')
    }
  })

  const trunkTop = TREE_TIERS[3].top + TREE_TIERS[3].rows

  for (let y = trunkTop; y < trunkTop + 3; y++) {
    for (let dx = -2; dx <= 2; dx++) {
      put(c + dx, y, dx >= 1 ? 'B' : 'b')
    }
  }

  // Гирлянды: провисающая нить огоньков посередине трёх нижних ярусов.
  const colors = ['l-r', 'l-o', 'l-u', 'l-p']
  const lights: Light[] = []

  for (const tier of TREE_TIERS.slice(1)) {
    const r = Math.floor(tier.rows * 0.5)
    const half = halfAt(tier, r)

    for (let dx = -half + 1; dx <= half - 1; dx += 2) {
      const y = tier.top + r + (Math.abs(dx) < half * 0.5 ? 1 : 0)

      if ('gGd'.includes(at(c + dx, y))) {
        const n = lights.length
        lights.push({ x: c + dx, y, color: colors[n % colors.length] ?? 'l-r', group: n % 3 })
      }
    }
  }

  // Игрушки: красные и золотые шары между гирляндами.
  for (const tier of TREE_TIERS.slice(1)) {
    for (let k = 0; k < 2; k++) {
      const r = tier.rows - 3
      const half = halfAt(tier, r)
      const dx = Math.round((rand() * 2 - 1) * (half - 2))
      const y = tier.top + r

      if ('gGd'.includes(at(c + dx, y)) && !lights.some(l => l.x === c + dx && l.y === y)) {
        put(c + dx, y, k === 0 ? 'x' : 'o')
      }
    }
  }

  return { rows: grid.map(row => row.join('')), lights }
}

const TREE_PALETTE = {
  Y: 'gold',
  y: 'gold-d',
  o: 'gold',
  x: 'gf-r',
  g: 't-g',
  G: 't-G',
  d: 't-d',
  s: 't-s',
  S: 't-S',
  b: 't-b',
  B: 't-B',
} as const

const SNOWMAN = [
  '......hhhhh......',
  '......hhhhh......',
  '......rrrrr......',
  '....hhhhhhhhh....',
  '.....wwwwwwl.....',
  '....wwkwwkwwl....',
  '....wwwwnnnwl....',
  '....wwwwwwwwl....',
  '.....wwwwwwl.....',
  '....rrrrrrrRr....',
  'b...wwwwwwwrRl..b',
  '.b.wwwwkwwwrRl.b.',
  '..bwwwwwwwwwwlb..',
  '...wwwwkwwwwwl...',
  '....wwwwwwwwl....',
  '...wwwwwwwwwwl...',
  '..wwwwwwwwwwwll..',
  '..wwwwkwwwwwwll..',
  '..wwwwwwwwwwwll..',
  '...lwwwwwwwwll...',
  '....lllllllll....',
]

const SNOWMAN_PALETTE = {
  w: 'sm-w',
  l: 'sm-l',
  k: 'sm-k',
  h: 'sm-h',
  n: 'sm-n',
  r: 'gf-r',
  R: 'gf-R',
  b: 't-b',
} as const

const GIFT_RED = ['.o...o.', '..ooo..', 'rrrorrR', 'ooooooo', 'rrrorrR', 'RRRoRRR']
const GIFT_BLUE = ['.w..w.', '..ww..', 'uuwuuU', 'wwwwww', 'UUwUUU']
const GIFT_GREEN = ['..r..', 'ggrgG', 'rrrrr', 'ggrgG', 'GGrGG']

function flakes(rand: () => number, count: number, size: number): string {
  const layer = new Layer()

  for (let i = 0; i < count; i++) {
    const x = snap(rand() * W)
    const y = snap(rand() * H)
    // Вторая копия выше кадра: сдвиг вниз на всю высоту замыкает петлю.
    layer.rect('flake', x, y, size, size).rect('flake', x, y - H, size, size)
  }

  return layer.toString()
}

const CSS = [
  'svg{shape-rendering:crispEdges}',
  '.sky-a{stop-color:#050d16}.sky-b{stop-color:#0a1c24}.sky-c{stop-color:#10302a}',
  '.au-a{stop-color:#3cf2a0}.au-b{stop-color:#2fd6cf}',
  '.aur{animation:aur 120s steps(1200) infinite}',
  '@keyframes aur{from{transform:translateX(0)}to{transform:translateX(-1600px)}}',
  '.aur-glow{animation:glow 14s steps(28) infinite alternate}',
  '@keyframes glow{from{opacity:.55}to{opacity:1}}',
  '.star{fill:#eaf6ff}',
  '.tw-a{animation:blink 3.2s steps(1,end) infinite}',
  '.tw-b{animation:blink 4.6s steps(1,end) -1.7s infinite}',
  '@keyframes blink{0%{opacity:1}50%{opacity:.2}}',
  '.moon{fill:#f2efd9}.moon-d{fill:#d6d0b0}.moon-s{fill:#b9b38f}.halo{fill:#f2efd9;opacity:.07}',
  '.cloud{fill:#ffffff;opacity:0}',
  '.drift{animation:drift 70s steps(140) infinite alternate}',
  '@keyframes drift{from{transform:translateX(-60px)}to{transform:translateX(60px)}}',
  '.far-a{fill:#0d241c}.far-b{fill:#081813}',
  '.snow{fill:#e2edf5}.snow-s{fill:#b4c6d6}.snow-v{fill:#6f879b}.snow-vs{fill:#566d80}.snow-z{fill:#ffffff}',
  '.dirt-a{fill:#5a3b22}.dirt-b{fill:#54371f}.dirt-k{fill:#3b2615}.dirt-l{fill:#6b4729}',
  '.stone-a{fill:#40464c}.stone-b{fill:#3c4147}.stone-k{fill:#2f3338}.stone-l{fill:#4d545b}',
  '.ore-g{fill:#3be08a}.ore-u{fill:#6fe3ff}.ore-o{fill:#ffcf3a}',
  '.t-g{fill:#1f6e3b}.t-G{fill:#2e8f4d}.t-d{fill:#134b28}.t-s{fill:#eaf2f8}.t-S{fill:#bfd0de}',
  '.t-b{fill:#6b4423}.t-B{fill:#4a2e17}',
  '.gold{fill:#ffd23f}.gold-d{fill:#e8a823}',
  '.glow{stop-color:#ffd23f}',
  '.star-glow{animation:pulse 2.4s steps(12) infinite alternate}',
  '@keyframes pulse{from{opacity:.45}to{opacity:1}}',
  '.l-r{fill:#ff4d4d}.l-o{fill:#ffcf3a}.l-u{fill:#4db8ff}.l-p{fill:#ff7ad9}',
  '.bl-a{animation:blink 1.2s steps(1,end) infinite}',
  '.bl-b{animation:blink 1.2s steps(1,end) -.4s infinite}',
  '.bl-c{animation:blink 1.2s steps(1,end) -.8s infinite}',
  '.sm-w{fill:#f1f6fa}.sm-l{fill:#bccbd8}.sm-k{fill:#1b1f24}.sm-h{fill:#262b33}.sm-n{fill:#f08a24}',
  '.gf-r{fill:#d6342f}.gf-R{fill:#9e2420}.gf-o{fill:#ffcf3a}.gf-u{fill:#3b7fd9}.gf-U{fill:#2a5ea8}',
  '.gf-w{fill:#f1f6fa}.gf-g{fill:#2e9b4f}.gf-G{fill:#1f6e3b}',
  '.flake{fill:#ffffff}',
  '.fall-1{animation:fall 46s steps(460) infinite}',
  '.fall-2{animation:fall 30s steps(300) infinite}',
  '.fall-3{animation:fall 19s steps(190) infinite}',
  '@keyframes fall{from{transform:translateY(0)}to{transform:translateY(1000px)}}',
  '.sway{animation:sway 7s steps(14) infinite alternate}',
  '.sway.s2{animation-duration:5s;animation-delay:-2s}',
  '.sway.s3{animation-duration:4s;animation-delay:-1s}',
  '@keyframes sway{from{transform:translateX(-14px)}to{transform:translateX(14px)}}',
  // Светлый режим: снежный день.
  '@media (prefers-color-scheme:light){',
  '.sky-a{stop-color:#cfe6f2}.sky-b{stop-color:#e2f1f4}.sky-c{stop-color:#f1f8f3}',
  '.aur-wrap,.stars{opacity:0}',
  '.moon{fill:#fff4b8}.moon-d{fill:#ffe78f}.moon-s{fill:#ffd95e}.halo{fill:#fff1a8;opacity:.4}',
  '.cloud{opacity:.95}',
  '.far-a{fill:#a9c9b9}.far-b{fill:#8fb7a3}',
  '.snow{fill:#ffffff}.snow-s{fill:#d3e2ec}.snow-v{fill:#f4f8fb}.snow-vs{fill:#dbe7ef}',
  '.flake{fill:#a7c4d8}',
  '}',
  '@media (prefers-reduced-motion:reduce){',
  '.aur,.aur-glow,.tw-a,.tw-b,.drift,.star-glow,.bl-a,.bl-b,.bl-c,.fall-1,.fall-2,.fall-3,.sway{animation:none}',
  '}',
].join('')

const DEFS = [
  '<defs>',
  '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">',
  '<stop offset="0" class="sky-a"/><stop offset="0.6" class="sky-b"/><stop offset="1" class="sky-c"/>',
  '</linearGradient>',
  '<linearGradient id="au-a" x1="0" y1="0" x2="0" y2="1">',
  '<stop offset="0" class="au-a" stop-opacity="0"/><stop offset="0.65" class="au-a" stop-opacity="0.5"/>',
  '<stop offset="0.85" class="au-a" stop-opacity="0.35"/><stop offset="1" class="au-a" stop-opacity="0"/>',
  '</linearGradient>',
  '<linearGradient id="au-b" x1="0" y1="0" x2="0" y2="1">',
  '<stop offset="0" class="au-b" stop-opacity="0"/><stop offset="0.7" class="au-b" stop-opacity="0.4"/>',
  '<stop offset="1" class="au-b" stop-opacity="0"/>',
  '</linearGradient>',
  '<radialGradient id="glow">',
  '<stop offset="0" class="glow" stop-opacity="0.55"/><stop offset="1" class="glow" stop-opacity="0"/>',
  '</radialGradient>',
  '</defs>',
].join('')

export function zimaScene(): string {
  const rand = seeded(20261231)

  const treeX = RIGHT_HILL * BLOCK + BLOCK / 2 - (TREE_CENTER * PX + PX / 2)
  const treeBase = groundTop(RIGHT_HILL)
  const { rows: treeRows, lights } = tree(rand)
  const treeY = treeBase - treeRows.length * PX
  const lightLayers = [new Layer(), new Layer(), new Layer()]

  for (const light of lights) {
    lightLayers[light.group]?.rect(light.color, treeX + light.x * PX, treeY + light.y * PX, PX, PX)
  }

  const snowmanX = LEFT_HILL * BLOCK + BLOCK / 2 - 85
  const snowmanY = groundTop(LEFT_HILL) - SNOWMAN.length * PX
  const starX = treeX + TREE_CENTER * PX + PX / 2
  const starY = treeY + 2.5 * PX

  const sky = new Layer()
  sprite(sky, moonRows(), { m: 'moon', d: 'moon-d', s: 'moon-s' }, MOON_X - 75, MOON_Y - 75)

  const clouds = new Layer()
  sprite(clouds, CLOUD, { c: 'cloud' }, 540, 115, 12)
  sprite(clouds, CLOUD, { c: 'cloud' }, 990, 60, 12)
  sprite(clouds, CLOUD, { c: 'cloud' }, 1250, 205, 12)

  const ground = new Layer()
  sprite(ground, SNOWMAN, SNOWMAN_PALETTE, snowmanX, snowmanY)

  const front = new Layer()
  sprite(front, treeRows, TREE_PALETTE, treeX, treeY)

  const gifts = new Layer()
  sprite(gifts, GIFT_GREEN, { r: 'gf-r', g: 'gf-g', G: 'gf-G' }, 1235, treeBase - 50)
  sprite(gifts, GIFT_RED, { o: 'gf-o', r: 'gf-r', R: 'gf-R' }, 1265, treeBase - 60)
  sprite(gifts, GIFT_BLUE, { w: 'gf-w', u: 'gf-u', U: 'gf-U' }, 1380, treeBase - 50)

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">`,
    DEFS,
    `<style>${CSS}</style>`,
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>`,
    stars(rand),
    aurora(),
    `<g class="drift">${clouds}</g>`,
    `<circle class="halo" cx="${MOON_X}" cy="${MOON_Y}" r="150"/>`,
    `<circle class="halo" cx="${MOON_X}" cy="${MOON_Y}" r="105"/>`,
    sky.toString(),
    `<g class="sway" opacity="0.55"><g class="fall-1">${flakes(rand, 70, 3)}</g></g>`,
    forest(rand),
    terrain(rand),
    ground.toString(),
    `<g class="sway s2" opacity="0.85"><g class="fall-2">${flakes(rand, 45, 5)}</g></g>`,
    `<circle class="star-glow" cx="${starX}" cy="${starY}" r="60" fill="url(#glow)"/>`,
    front.toString(),
    `<g class="bl-a">${lightLayers[0]}</g><g class="bl-b">${lightLayers[1]}</g><g class="bl-c">${lightLayers[2]}</g>`,
    gifts.toString(),
    `<g class="sway s3"><g class="fall-3">${flakes(rand, 24, 7)}</g></g>`,
    '</svg>',
  ].join('')
}
