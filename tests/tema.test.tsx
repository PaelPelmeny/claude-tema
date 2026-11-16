import type { ThemeSetArgs } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

type TestOn = Parameters<TestBody>[1]

type Seen = { sets: ThemeSetArgs[]; clears: number; toasts: string[] }

// Nothing sits beneath the plugin in a test: these hooks stand for the engine.
function engine(on: TestOn, stored?: Record<string, unknown>): Seen {
  const seen: Seen = { sets: [], clears: 0, toasts: [] }

  mock.store(on, stored)
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('theme.set', (_, e) => {
    seen.sets.push(e)

    return { value: { isDrawn: true, requestId: 'theme' } }
  })
  on('theme.clear', () => {
    seen.clears += 1

    return { value: { isDrawn: false, reason: 'cleared' } }
  })
  on('ui.toast', (_, e) => {
    seen.toasts.push(e.text)

    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  return seen
}

const START = { cwd: '/', surface: 'desktop', isInteractive: true } as const
// What the engine stamps on a command the person typed.
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const
// A store that has already seen the newest look switch itself on.
const SEEN_NEWEST = { newest: 'zima' } as const

const label = (seen: Seen) => seen.sets.at(-1)?.colors?.label

test('с пустым хранилищем включается «Блочная зима» со своей сценой', async ($, on) => {
  const seen = engine(on)
  await $.session.start(START)

  expect(seen.sets.length).toBe(1)
  expect(label(seen)).toBe('Блочная зима')
  expect(seen.sets[0]?.backdrop).toEqual({ scene: 'tema-zima', glass: { blur: 12, opacity: 0.74 } })
})

test('о новой теме сообщает только один раз', async ($, on) => {
  const seen = engine(on)
  await $.session.start(START)
  await $.session.start(START)

  expect(seen.toasts.length).toBe(1)
  expect(seen.toasts[0]).toContain('«Блочная зима»')
  expect(seen.toasts[0]).toContain('/tema')
})

test('прежний выбор один раз уступает новой теме, потом выбор человека остаётся', async ($, on) => {
  const seen = engine(on, { look: 'bumaga' })
  await $.session.start(START)

  expect(label(seen)).toBe('Блочная зима')
  expect(seen.toasts.length).toBe(1)

  await $.command.run({ ...RUN, command: 'tema', args: 'бумага' })
  await $.session.start(START)

  expect(label(seen)).toBe('Бумага')
  expect(seen.toasts.length).toBe(1)
})

test('/tema хвоя включает Хвою без фона-сцены и запоминает выбор', async ($, on) => {
  const seen = engine(on)
  await $.session.start(START)
  const { text } = await $.command.run({ ...RUN, command: 'tema', args: 'Хвоя' })

  expect(text).toContain('«Хвоя» включена')
  expect(label(seen)).toBe('Хвоя')
  expect(seen.sets.at(-1)?.backdrop).toBeUndefined()

  await $.session.start(START)
  expect(label(seen)).toBe('Хвоя')
})

test('тему можно выбрать номером или другим словом', async ($, on) => {
  const seen = engine(on)
  await $.session.start(START)

  await $.command.run({ ...RUN, command: 'tema', args: ' 4 ' })
  expect(label(seen)).toBe('Сакура')

  await $.command.run({ ...RUN, command: 'tema', args: 'Ёлка!' })
  expect(label(seen)).toBe('Блочная зима')

  await $.command.run({ ...RUN, command: 'tema', args: 'майнкрафт' })
  expect(label(seen)).toBe('Блочная зима')
})

test('/tema выкл возвращает стандартное оформление и запоминает это', async ($, on) => {
  const seen = engine(on)
  await $.session.start(START)
  const { text } = await $.command.run({ ...RUN, command: 'tema', args: 'выкл' })

  expect(text).toContain('выключена')
  expect(seen.clears).toBe(1)

  await $.session.start(START)
  expect(seen.sets.length).toBe(1)
})

test('/tema дальше идёт по кругу', async ($, on) => {
  const seen = engine(on, { ...SEEN_NEWEST, look: 'sakura' })
  await $.session.start(START)

  expect(label(seen)).toBe('Сакура')
  await $.command.run({ ...RUN, command: 'tema', args: 'дальше' })
  expect(label(seen)).toBe('Блочная зима')
  await $.command.run({ ...RUN, command: 'tema', args: 'дальше' })
  expect(label(seen)).toBe('Космос')
})

test('незнакомое название показывает список и ничего не меняет', async ($, on) => {
  const seen = engine(on)
  await $.session.start(START)
  const { text } = await $.command.run({ ...RUN, command: 'tema', args: 'радуга' })

  expect(text).toContain('Не знаю тему «радуга»')
  expect(text).toContain('1. Космос')
  expect(text).toContain('5. Блочная зима')
  expect(seen.sets.length).toBe(1)
})

test('/tema без слов показывает список и отмечает текущую тему', async ($, on) => {
  engine(on, { ...SEEN_NEWEST, look: 'bumaga' })
  await $.session.start(START)
  const { text } = await $.command.run({ ...RUN, command: 'tema', args: '' })

  expect(text).toContain('сейчас: «Бумага»')
  expect(text).toContain('2. Бумага — тёплая бумага днём, бумага под лампой ночью  ← сейчас')
})

test('обе сцены рисуются на desktop и mobile, чужую сцену мод не трогает', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  for (const surface of ['desktop', 'mobile'] as const) {
    for (const scene of ['tema-zvezdy', 'tema-zima']) {
      const ours = await $.ui.mount({
        plugin: 'tema',
        surface,
        component: 'Backdrop',
        props: { scene, plugin: 'tema', glass: { blur: 12, opacity: 0.74 } },
      })
      const svg = await ours.find({ type: 'Svg' })
      const source = String(svg?.props.source)

      expect(source.startsWith('<svg')).toBe(true)
      expect(source.length).toBeLessThan(131072)
      expect(String(svg?.props.alt).length).toBeGreaterThan(10)
      await ours.unmount()
    }

    const other = await $.ui.mount({
      plugin: 'tema',
      surface,
      component: 'Backdrop',
      props: { scene: 'lagoon', plugin: 'someone-else', glass: false },
    })

    expect((await other.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
    await other.unmount()
  }
})
