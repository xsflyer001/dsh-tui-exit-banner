/**
 * 单测覆盖退出判定的六条路径。只测纯函数与文件读取，不触发真实终端写入 ——
 * process 'exit' 里的打印已在真机实测过，不适合放进单测。
 */
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { commandFromReceipt, isExitReceipt, isSuppressNotice, normalizeCommand } from '../src/index.js'
import { fitTitle, renderBanner } from '../src/banner.js'

const SESSION = 'f984b9ec-6c5d-4ed1-9efd-47527be3413f'

/** 上游 finishExit 写出的终端恢复序列（退出回执独有的特征）。 */
const CLEANUP = '\u001b[?1049l\u001b[?25h\u001b[?1000l\u001b[?1006l'
const HINT = 'Resume with the command below:'

/** 上游退出回执的原文形状：cleanup + \r\n + notice。 */
const receipt = (command = `dst --resume ${SESSION}`): string => `${CLEANUP}\r\n${HINT}\n${command}\n`

const homes: string[] = []
afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    while (homes.length > 0) {
        const dir = homes.pop()
        if (dir !== undefined) rmSync(dir, { recursive: true, force: true })
    }
})

/**
 * 准备一个临时 HOME 并加载 session 模块。
 * 路径在模块加载时由 homedir() 求值，所以必须先改 HOME 再 resetModules。
 */
async function loadSession(options: {
    resume?: string
    resumeAgeMs?: number
    index?: unknown
}) {
    const home = mkdtempSync(join(tmpdir(), 'exit-banner-'))
    homes.push(home)
    const dir = join(home, '.dsh-tui')
    mkdirSync(dir, { recursive: true })

    if (options.resume !== undefined) {
        const file = join(dir, 'resume.txt')
        writeFileSync(file, options.resume)
        if (options.resumeAgeMs !== undefined) {
            const past = (Date.now() - options.resumeAgeMs) / 1000
            utimesSync(file, past, past)
        }
    }
    if (options.index !== undefined) {
        writeFileSync(join(dir, 'session-index.json'), JSON.stringify(options.index))
    }

    vi.stubEnv('HOME', home)
    vi.resetModules()
    return import('../src/session.js')
}

describe('1. 有会话退出', () => {
    it('退出回执被识别，且能取出会话 id', async () => {
        const mod = await loadSession({ resume: SESSION })
        expect(isExitReceipt(receipt())).toBe(true)
        expect(mod.readPendingSession(Date.now() - 1000)).toBe(SESSION)
    })

    it('标题取自 session-index，命令取自上游原文', async () => {
        const mod = await loadSession({
            resume: SESSION,
            index: { entries: { [SESSION]: { derived: { title: '查找之前的会话记录' } } } },
        })
        const title = mod.readSessionTitle(SESSION, '未命名会话')
        const command = commandFromReceipt(receipt(), SESSION)
        const out = renderBanner({
            sessionId: SESSION, title, command, logo: 'shadow',
            showTitle: true, showCommand: true, columns: 120,
        })
        expect(title).toBe('查找之前的会话记录')
        // 命令取上游原文，而不是自己拼 —— 尊重 dsh-tui / dst 别名
        expect(command).toBe(`dst --resume ${SESSION}`)
        expect(out).toContain('██████╗')
        expect(out).toContain('查找之前的会话记录')
        expect(out).toContain(`dst --resume ${SESSION}`)
        expect(out.split('\n')).toHaveLength(11)
    })

    it('上游换成自建别名时，命令原样跟随', () => {
        const line = commandFromReceipt(receipt('my-dsh --profile tui --resume abc'), SESSION)
        expect(line).toBe('my-dsh --profile tui --resume abc')
    })
})

describe('2. 空会话退出', () => {
    it('resume.txt 为空串 → 静默', async () => {
        const mod = await loadSession({ resume: '' })
        expect(mod.readPendingSession(Date.now() - 1000)).toBeUndefined()
    })
})

describe('3. 崩溃 / 被 kill（resume.txt 是上一轮残留）', () => {
    it('mtime 早于本次启动 → 静默', async () => {
        const mod = await loadSession({ resume: SESSION, resumeAgeMs: 60_000 })
        expect(mod.readPendingSession(Date.now())).toBeUndefined()
    })

    it('resume.txt 不存在 → 静默', async () => {
        const mod = await loadSession({})
        expect(mod.readPendingSession(Date.now() - 1000)).toBeUndefined()
    })
})

describe('4. /restart 与 /update', () => {
    it('重启文案被认成 suppress（不补横幅）', () => {
        expect(isSuppressNotice('正在重启 dsh-tui，完成后自动恢复当前会话……')).toBe(true)
        expect(isSuppressNotice('Restarting dsh-tui')).toBe(true)
    })

    it('重启文案里没有那句英文，因此不算退出回执', () => {
        expect(isExitReceipt(`${CLEANUP}\r\n正在重启 dsh-tui\n`)).toBe(false)
    })

    it('崩溃文案同样被 suppress', () => {
        expect(isSuppressNotice('dsh-tui crashed: boom')).toBe(true)
    })
})

describe('5. 索引里没有标题', () => {
    it('回退到传入的兜底文案', async () => {
        const mod = await loadSession({ resume: SESSION, index: { entries: {} } })
        expect(mod.readSessionTitle(SESSION, '未命名会话')).toBe('未命名会话')
    })

    it('索引文件损坏也不抛错', async () => {
        const home = mkdtempSync(join(tmpdir(), 'exit-banner-'))
        homes.push(home)
        const dir = join(home, '.dsh-tui')
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, 'session-index.json'), '{ not json')
        vi.stubEnv('HOME', home)
        vi.resetModules()
        const mod = await import('../src/session.js')
        expect(mod.readSessionTitle(SESSION, '未命名会话')).toBe('未命名会话')
    })
})

describe('6. 对话内容里出现那句英文（误判防护）', () => {
    it('缺少终端恢复序列 → 不认作退出回执', () => {
        // 这正是插件开发期间踩过的坑：回复里引用了这串英文，被误判成退出
        expect(isExitReceipt(`Resume with the command below:\ndst --resume ${SESSION}`)).toBe(false)
    })

    it('普通渲染 chunk（无 cleanup）也不误判', () => {
        expect(isExitReceipt(`\u001b[2K  Session  f984b9ec  \u001b[1G`)).toBe(false)
    })

    it('只有 ?25h（渲染中也可能出现）不足以判定', () => {
        expect(isExitReceipt(`${HINT}\u001b[?25h`)).toBe(false)
    })
})

describe('7. 恢复命令规整', () => {
    const UPSTREAM = `DSH_TUI_RESUME_SESSION=${SESSION} dsh --profile dsh-tui`

    it('上游的环境变量形式被换成 launcher 形式', () => {
        expect(normalizeCommand(UPSTREAM, SESSION, 'dst')).toBe(`dst --resume ${SESSION}`)
        expect(normalizeCommand(UPSTREAM, SESSION, 'dsh-tui')).toBe(`dsh-tui --resume ${SESSION}`)
    })

    it('上游若已给出简短 --resume 形式则原样保留', () => {
        expect(normalizeCommand(`mydsh --resume ${SESSION}`, SESSION, 'dst')).toBe(`mydsh --resume ${SESSION}`)
        expect(normalizeCommand('dsh-tui -c', SESSION, 'dst')).toBe('dsh-tui -c')
    })

    it('空输入或认不出的形式回退到 launcher 形式', () => {
        expect(normalizeCommand('', SESSION, 'dst')).toBe(`dst --resume ${SESSION}`)
        expect(normalizeCommand('something else', SESSION, 'dst')).toBe(`dst --resume ${SESSION}`)
    })
})

describe('附加：标题裁剪与字形', () => {
    it('过长标题被裁剪到终端宽度内', () => {
        const long = 'x'.repeat(200)
        expect(Array.from(fitTitle(long, 80)).length).toBeLessThanOrEqual(Math.max(20, 80 - 13))
        expect(fitTitle('短标题', 120)).toBe('短标题')
    })

    it('logo 多种样式都能渲染，非法取值回退默认字形', () => {
        for (const logo of ['shadow', 'small', 'mini', 'plain', 'none', 'bogus'] as const) {
            const out = renderBanner({
                sessionId: SESSION, title: 't', command: 'c', logo,
                showTitle: true, showCommand: true, columns: 120,
            })
            expect(typeof out).toBe('string')
            if (logo === 'none') expect(out).not.toContain('█')
        }
    })

    it('showTitle/showCommand 关闭时对应行消失', () => {
        const out = renderBanner({
            sessionId: SESSION, title: 't', command: 'c', logo: 'none',
            showTitle: false, showCommand: true, columns: 120,
        })
        expect(out).not.toContain('Session')
        expect(out).toContain('Continue')
    })
})
