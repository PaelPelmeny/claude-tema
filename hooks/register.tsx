import type { EngineInterface, Register, ThemeResult, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { zimaScene } from './zima'

// «Тема»: темы оформления для приложения Claude, у «Космоса» и «Блочной зимы»
// свои живые сцены на фоне. Переключаются командой /tema, выбор хранится
// между сессиями. У каждой темы есть светлая и тёмная половина: приложение
// само берёт ту, что подходит к его режиму.

const PLUGIN = 'tema'
const STORE_KEY = 'look'
/** The newest look already switched on once by itself. */
const NEWEST_KEY = 'newest'
const STARFIELD = 'tema-zvezdy'
const ZIMA = 'tema-zima'

type LookId = 'kosmos' | 'bumaga' | 'hvoya' | 'sakura' | 'zima'
type Saved = LookId | 'off'

type Look = {
  id: LookId
  title: string
  blurb: string
  aliases: readonly string[]
  args: ThemeSetArgs
  /** The line that would stop Desktop painting this look, if there is one. */
  unpainted: string | undefined
}

type Definition = Parameters<typeof makeColors>[0]

function makeLook(
  id: LookId,
  title: string,
  blurb: string,
  aliases: readonly string[],
  definition: Definition,
  backdrop?: ThemeSetArgs['backdrop'],
): Look {
  const { theme, problems } = makeColors({ ...definition, id: `tema-${id}` })
  const args: ThemeSetArgs =
    backdrop === undefined ? { colors: theme } : { colors: theme, backdrop }

  return {
    id,
    title,
    blurb,
    aliases,
    args,
    unpainted: problems.find(line => line.startsWith("Desktop won't paint")),
  }
}

// ---------------------------------------------------------------------------
// Звёздное небо для «Космоса»: одна SVG-сцена, звёзды раскладываются один раз
// при загрузке модуля (с фиксированным зерном, так что небо всегда одно и то
// же). Мерцание идёт ступеньками (steps), чтобы фон перерисовывался редко.

const W = 1600
const H = 1000

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

function dots(
  rand: () => number,
  count: number,
  radius: readonly [number, number],
  alpha: readonly [number, number],
): string {
  let out = ''

  for (let i = 0; i < count; i++) {
    const x = (rand() * W).toFixed(1)
    const y = (rand() * H).toFixed(1)
    const r = (radius[0] + rand() * (radius[1] - radius[0])).toFixed(2)
    const o = (alpha[0] + rand() * (alpha[1] - alpha[0])).toFixed(2)
    out += `<circle cx="${x}" cy="${y}" r="${r}" fill-opacity="${o}"/>`
  }

  return out
}

function brights(rand: () => number, count: number): string {
  let out = ''

  for (let i = 0; i < count; i++) {
    const x = rand() * W
    const y = rand() * H
    const cx = x.toFixed(1)
    const cy = y.toFixed(1)
    out += `<circle cx="${cx}" cy="${cy}" r="6.5" fill-opacity="0.12"/>`
    out += `<circle cx="${cx}" cy="${cy}" r="2.2"/>`

    if (i % 2 === 0) {
      // Четырёхлучевая искорка вокруг яркой звезды.
      const s = 7 + rand() * 4
      const k = 1.1
      const p = (dx: number, dy: number) => `${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)}`
      out +=
        `<path d="M${p(0, -s)}L${p(k, -k)}L${p(s, 0)}L${p(k, k)}` +
        `L${p(0, s)}L${p(-k, k)}L${p(-s, 0)}L${p(-k, -k)}Z" fill-opacity="0.85"/>`
    }
  }

  return out
}

const SCENE_CSS = [
  '.sky-a{stop-color:#05071a}.sky-b{stop-color:#13113a}',
  '.neb-a{stop-color:#6b4fe0}.neb-b{stop-color:#1b8fbf}.neb-c{stop-color:#b14ea8}',
  '.pl-a{stop-color:#a99bff}.pl-b{stop-color:#5b47cf}.pl-c{stop-color:#20185a}',
  '.moon{fill:#8c86b8}',
  '.ring{fill:none;stroke:#b7adff;stroke-width:4;stroke-opacity:.7}',
  '.stars{fill:#ffffff}.trail{stop-color:#ffffff}',
  '.tw{animation:tw 6s steps(12) infinite}',
  '.tw.b{animation-duration:8.5s;animation-delay:-3s}',
  '.tw.c{animation-duration:11s;animation-delay:-7s}',
  '.tw.d{animation-duration:4.6s;animation-delay:-1.4s}',
  '@keyframes tw{0%,100%{opacity:1}50%{opacity:.28}}',
  '.shoot{opacity:0;animation:shoot 17s linear 4s infinite}',
  '.shoot.late{animation:shoot-late 29s linear 11s infinite}',
  '@keyframes shoot{0%,93%{opacity:0;transform:translate(0,0)}94%{opacity:1}99%,100%{opacity:0;transform:translate(-420px,210px)}}',
  '@keyframes shoot-late{0%,95%{opacity:0;transform:translate(0,0)}95.6%{opacity:1}99.4%,100%{opacity:0;transform:translate(-300px,150px)}}',
  // Узкое окно: планета отходит от правого края, чтобы не обрезалась.
  '@media (max-aspect-ratio:5/4){.planet{transform:translate(-330px,40px)}}',
  // Светлый режим: лавандовый рассвет вместо ночи.
  '@media (prefers-color-scheme:light){',
  '.sky-a{stop-color:#f3f0ff}.sky-b{stop-color:#ddd6f7}',
  '.neb-a{stop-color:#b8a5ff}.neb-b{stop-color:#8ed2ec}.neb-c{stop-color:#f1b2dc}',
  '.pl-a{stop-color:#ffffff}.pl-b{stop-color:#c4b6ff}.pl-c{stop-color:#8873e2}',
  '.moon{fill:#b9b0e6}.ring{stroke:#8873e2}',
  '.stars{fill:#6a58d3}.trail{stop-color:#6a58d3}',
  '}',
  '@media (prefers-reduced-motion:reduce){.tw,.shoot{animation:none}}',
].join('')

function starfield(): string {
  const rand = seeded(20261116)
  // Планета с кольцом и маленькой луной — в правом верхнем углу, подальше от
  // середины (там текст) и от низа (там поле ввода).
  const px = 1388
  const py = 196
  const ringX = 108
  const ringY = 21
  const tilt = `transform="rotate(-16 ${px} ${py})"`
  const ring = (sweep: 0 | 1) =>
    `<path class="ring" d="M${px - ringX} ${py}A${ringX} ${ringY} 0 0 ${sweep} ${px + ringX} ${py}" ${tilt}/>`

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">`,
    '<defs>',
    '<linearGradient id="sky" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" class="sky-a"/><stop offset="1" class="sky-b"/></linearGradient>',
    '<radialGradient id="neb-a" cx="0.16" cy="0.2" r="0.55"><stop offset="0" class="neb-a" stop-opacity="0.36"/><stop offset="1" class="neb-a" stop-opacity="0"/></radialGradient>',
    '<radialGradient id="neb-b" cx="0.88" cy="0.84" r="0.5"><stop offset="0" class="neb-b" stop-opacity="0.3"/><stop offset="1" class="neb-b" stop-opacity="0"/></radialGradient>',
    '<radialGradient id="neb-c" cx="0.6" cy="0.38" r="0.38"><stop offset="0" class="neb-c" stop-opacity="0.14"/><stop offset="1" class="neb-c" stop-opacity="0"/></radialGradient>',
    '<radialGradient id="body" cx="0.34" cy="0.3" r="0.85"><stop offset="0" class="pl-a"/><stop offset="0.55" class="pl-b"/><stop offset="1" class="pl-c"/></radialGradient>',
    '<linearGradient id="trail" x1="0" y1="0" x2="1" y2="0"><stop offset="0" class="trail" stop-opacity="0.95"/><stop offset="1" class="trail" stop-opacity="0"/></linearGradient>',
    '</defs>',
    `<style>${SCENE_CSS}</style>`,
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>`,
    `<rect width="${W}" height="${H}" fill="url(#neb-a)"/>`,
    `<rect width="${W}" height="${H}" fill="url(#neb-b)"/>`,
    `<rect width="${W}" height="${H}" fill="url(#neb-c)"/>`,
    '<g class="stars">',
    `<g>${dots(rand, 160, [0.6, 1.3], [0.35, 0.85])}</g>`,
    `<g class="tw a">${dots(rand, 28, [0.9, 1.7], [0.75, 1])}</g>`,
    `<g class="tw b">${dots(rand, 26, [0.9, 1.8], [0.75, 1])}</g>`,
    `<g class="tw c">${dots(rand, 20, [1.0, 1.9], [0.75, 1])}</g>`,
    `<g class="tw d">${brights(rand, 9)}</g>`,
    '</g>',
    '<g class="planet">',
    ring(1),
    `<circle cx="${px}" cy="${py}" r="58" fill="url(#body)"/>`,
    ring(0),
    `<circle class="moon" cx="${px - 128}" cy="${py - 78}" r="9"/>`,
    '</g>',
    '<g class="stars shoot"><path d="M1180 92L1300 32" stroke="url(#trail)" stroke-width="2.2" stroke-linecap="round" fill="none"/><circle cx="1180" cy="92" r="1.8"/></g>',
    '<g class="stars shoot late"><path d="M520 120L610 75" stroke="url(#trail)" stroke-width="1.8" stroke-linecap="round" fill="none"/><circle cx="520" cy="120" r="1.5"/></g>',
    '</svg>',
  ].join('')
}

const STARFIELD_SVG = starfield()

/** Every scene this mod draws, by the name `$.theme.set` gives it. */
const SCENES: Readonly<Record<string, { svg: string; alt: string }>> = {
  [STARFIELD]: {
    svg: STARFIELD_SVG,
    alt: 'Ночное небо: мерцающие звёзды, планета с кольцом и редкие падающие звёзды',
  },
  [ZIMA]: {
    svg: zimaScene(),
    alt: 'Новогодняя ночь из блоков: северное сияние, луна, ёлка с гирляндой, подарки, снеговик и падающий снег',
  },
}

// ---------------------------------------------------------------------------
// Темы. Цвета задаются несколькими опорными точками, остальное (около сотни
// цветов на режим) достраивает makeColors из дизайн-системы приложения.

const LOOKS: readonly Look[] = [
  makeLook(
    'kosmos',
    'Космос',
    'ночное небо с мерцающими звёздами и планетой, в светлом режиме — лавандовый рассвет',
    ['1', 'космос', 'kosmos', 'cosmos', 'space', 'звезды'],
    {
      label: 'Космос',
      roles: { accent: '#7b61ff', danger: '#e0475b', success: '#3fae72', warning: '#e0a030', pro: '#2fb4d4' },
      light: {
        gray: {
          anchors: {
            'surface-0': '#e8e6f5',
            'surface-1': '#efedfa',
            'surface-2': '#f6f5fd',
            'text-primary': '#1b1933',
            'text-secondary': '#433f63',
            'text-muted': '#5d5980',
          },
        },
      },
      dark: {
        gray: {
          anchors: {
            'surface-0': '#0d0f22',
            'surface-1': '#13162e',
            'surface-2': '#191d39',
            'surface-3': '#1f2443',
            'text-primary': '#ecebff',
            'text-secondary': '#c4c2e8',
            'text-muted': '#9d9bc8',
          },
        },
      },
    },
    { scene: STARFIELD, glass: { blur: 18, opacity: 0.62 } },
  ),
  makeLook(
    'bumaga',
    'Бумага',
    'тёплая бумага днём, бумага под лампой ночью',
    ['2', 'бумага', 'bumaga', 'paper'],
    {
      label: 'Бумага',
      roles: { accent: '#2f5d8c', danger: '#b3392f', success: '#4e7d3a', warning: '#a86f14', pro: '#6d4f94' },
      light: {
        gray: {
          anchors: {
            'surface-0': '#efe6d3',
            'surface-1': '#f4ecdc',
            'surface-2': '#faf5e9',
            'text-primary': '#2a241d',
            'text-secondary': '#544a3d',
            'text-muted': '#6a5f50',
          },
        },
      },
      dark: {
        gray: {
          anchors: {
            'surface-0': '#1f1a15',
            'surface-1': '#28221b',
            'surface-2': '#312a22',
            'surface-3': '#3a3229',
            'text-primary': '#f0e7d7',
            'text-secondary': '#cfc4b2',
            'text-muted': '#aca08d',
          },
        },
      },
    },
  ),
  makeLook(
    'hvoya',
    'Хвоя',
    'спокойная хвойная зелень: светлый мох днём, тёмный лес ночью',
    ['3', 'хвоя', 'hvoya', 'khvoya', 'лес', 'forest', 'pine'],
    {
      label: 'Хвоя',
      roles: { accent: '#1f7f74', danger: '#c0462f', success: '#4e8f3c', warning: '#b5821d', pro: '#8a5a9e' },
      light: {
        gray: {
          anchors: {
            'surface-0': '#e1e8e0',
            'surface-1': '#e9efe8',
            'surface-2': '#f3f6f1',
            'text-primary': '#18231c',
            'text-secondary': '#3c4a40',
            'text-muted': '#56655a',
          },
        },
      },
      dark: {
        gray: {
          anchors: {
            'surface-0': '#111814',
            'surface-1': '#17201b',
            'surface-2': '#1d2822',
            'surface-3': '#222c26',
            'text-primary': '#e5eee7',
            'text-secondary': '#bfcdc3',
            'text-muted': '#97a89c',
          },
        },
      },
    },
  ),
  makeLook(
    'sakura',
    'Сакура',
    'нежно-розовая днём, тёмно-вишнёвая ночью',
    ['4', 'сакура', 'sakura'],
    {
      label: 'Сакура',
      roles: { accent: '#c2457e', danger: '#cf3f2c', success: '#4d8c55', warning: '#b9801f', pro: '#7c5ccc' },
      light: {
        gray: {
          anchors: {
            'surface-0': '#f3e6ea',
            'surface-1': '#f8eef1',
            'surface-2': '#fcf6f8',
            'text-primary': '#2b1a21',
            'text-secondary': '#5a4049',
            'text-muted': '#755a64',
          },
        },
      },
      dark: {
        gray: {
          anchors: {
            'surface-0': '#1a1216',
            'surface-1': '#22181d',
            'surface-2': '#2a1e24',
            'surface-3': '#2f2329',
            'text-primary': '#f6e9ee',
            'text-secondary': '#d8c3cc',
            'text-muted': '#b39ca6',
          },
        },
      },
    },
  ),
  makeLook(
    'zima',
    'Блочная зима',
    'новогодняя ночь из блоков: северное сияние, ёлка с гирляндой, снеговик и снег, а в светлом режиме — снежный день',
    ['5', 'блочная зима', 'зима', 'блоки', 'новый год', 'новогодняя', 'елка', 'майнкрафт', 'minecraft', 'zima', 'winter'],
    {
      label: 'Блочная зима',
      roles: { accent: '#5cb82e', danger: '#d6342f', success: '#18a88a', warning: '#e0a526', pro: '#3d8fe0' },
      light: {
        gray: {
          anchors: {
            'surface-0': '#e0ede2',
            'surface-1': '#e9f3ea',
            'surface-2': '#f3f9f4',
            'text-primary': '#12241a',
            'text-secondary': '#33503e',
            'text-muted': '#4d6b57',
          },
        },
      },
      dark: {
        gray: {
          anchors: {
            'surface-0': '#0d1913',
            'surface-1': '#122119',
            'surface-2': '#17291f',
            'surface-3': '#1c3025',
            'text-primary': '#eaf6ee',
            'text-secondary': '#c3dacb',
            'text-muted': '#94b19e',
          },
        },
      },
    },
    { scene: ZIMA, glass: { blur: 12, opacity: 0.74 } },
  ),
]

/** The look a fresh install starts with, and the one switched on once by itself. */
const NEWEST: LookId = 'zima'
const DEFAULT_LOOK: LookId = NEWEST

const OFF_WORDS: readonly string[] = [
  '0', 'выкл', 'выключить', 'off', 'стандарт', 'стандартная', 'обычная',
  'default', 'нет', 'none', 'сброс', 'reset',
]
const NEXT_WORDS: readonly string[] = ['дальше', 'следующая', 'next', '+', 'еще']

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'.,!?]/g, '')
    .trim()
}

async function readSaved($: EngineInterface): Promise<Saved> {
  const value = await $.store.get(STORE_KEY)

  if (value === 'off') {
    return 'off'
  }

  return LOOKS.find(one => one.id === value)?.id ?? DEFAULT_LOOK
}

async function apply($: EngineInterface, look: Look): Promise<ThemeResult> {
  if (look.unpainted !== undefined) {
    $.ui.toast(look.unpainted)
  }

  return $.theme.set(look.args)
}

function menu(saved: Saved): string {
  const current =
    saved === 'off'
      ? 'стандартное оформление'
      : `«${LOOKS.find(one => one.id === saved)?.title ?? saved}»`
  const rows = LOOKS.map(
    (one, i) => `${i + 1}. ${one.title} — ${one.blurb}${one.id === saved ? '  ← сейчас' : ''}`,
  )

  return [
    `Темы оформления (сейчас: ${current}):`,
    ...rows,
    '',
    '/tema 2 или /tema бумага — включить тему',
    '/tema дальше — следующая по кругу',
    '/tema выкл — стандартное оформление',
  ].join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'tema',
      description: 'Сменить тему оформления: космос, бумага, хвоя, сакура или выкл',
      argumentHint: '[космос|бумага|хвоя|сакура|дальше|выкл]',
      immediate: true,
    })

    // A new look switches itself on once; after that the person's choice stands.
    const isNewestFresh = (await $.store.get(NEWEST_KEY)) !== NEWEST

    if (isNewestFresh) {
      await $.store.set(STORE_KEY, NEWEST)
      await $.store.set(NEWEST_KEY, NEWEST)
    }

    const saved = await readSaved($)
    const look = LOOKS.find(one => one.id === saved)

    if (look !== undefined) {
      await apply($, look)

      if (isNewestFresh) {
        $.ui.toast(`Включена новая тема «${look.title}». Все темы: /tema`)
      }
    }

    return next(e)
  })

  on('command.run', { command: 'tema' }, async ($, e) => {
    const word = normalize(e.args)
    const saved = await readSaved($)

    if (word === '') {
      return { text: menu(saved) }
    }

    if (OFF_WORDS.includes(word)) {
      await $.theme.clear()
      await $.store.set(STORE_KEY, 'off')

      return { text: 'Тема выключена — вернулось стандартное оформление. Включить снова: /tema космос' }
    }

    const look = NEXT_WORDS.includes(word)
      ? LOOKS[(LOOKS.findIndex(one => one.id === saved) + 1) % LOOKS.length]
      : LOOKS.find(one => one.aliases.includes(word))

    if (look === undefined) {
      return { text: `Не знаю тему «${e.args.trim()}».\n\n${menu(saved)}` }
    }

    const set = await apply($, look)
    await $.store.set(STORE_KEY, look.id)
    const unseen = set.isDrawn ? '' : `\nСейчас её не видно: ${set.reason}`

    return { text: `Тема «${look.title}» включена: ${look.blurb}.${unseen}` }
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }

    const scene = SCENES[e.props.scene]
    const isOurs = e.props.plugin === PLUGIN || e.props.plugin.startsWith(`${PLUGIN}@`)

    if (scene === undefined || !isOurs) {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)

    return <Svg source={scene.svg} alt={scene.alt} isInteractive />
  })
}
