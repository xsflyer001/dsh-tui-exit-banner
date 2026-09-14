import { readFileSync, writeFileSync } from 'node:fs'

const edit = (file, pairs) => {
    let s = readFileSync(file, 'utf8')
    for (const [from, to] of pairs) {
        if (!s.includes(from)) { console.log('  x ' + file + ': 未找到片段 -> ' + from.slice(0, 60)); process.exit(1) }
        s = s.replace(from, to)
    }
    writeFileSync(file, s)
    console.log('  ok ' + file)
}

// ── config.ts：新增 launcher ──────────────────────────────────────────────
edit('src/config.ts', [
    [
        "    /** 覆盖恢复命令；默认从上游回执里原样提取（尊重 dsh-tui / dst 别名与自定义 profile）。 */\n    command?: string",
        "    /**\n" +
        "     * 覆盖恢复命令。支持 `{id}` 占位符，例如 `my-launcher --resume {id}`。\n" +
        "     * 留空时由上游回执规整而来（见 index.ts 的 normalizeCommand）。\n" +
        "     */\n" +
        "    command?: string\n" +
        "    /**\n" +
        "     * 生成恢复命令时用的启动器名，默认 `dst`（dsh-tui 的官方别名）。\n" +
        "     * 上游的 resumeCommand 产出的是底层形式 `DSH_TUI_RESUME_SESSION=<id> dsh --profile <p>`，\n" +
        "     * 又长又不像给人敲的；这里换成启动器形式。你若用别的别名启动，改这一项即可。\n" +
        "     */\n" +
        "    launcher?: string",
    ],
    [
        "    command: z.string().default(''),",
        "    command: z.string().default(''),\n    launcher: z.string().default('dst'),",
    ],
])

// ── index.ts：加 normalizeCommand、改 resolveCommand、移除诊断 ─────────────
edit('src/index.ts', [
    // 移除诊断导入
    [
        "import { appendFileSync, writeSync } from 'node:fs'\nimport { homedir } from 'node:os'\nimport { join } from 'node:path'\nimport type { Context } from '@deepseek-ai/cordis'",
        "import { writeSync } from 'node:fs'\nimport type { Context } from '@deepseek-ai/cordis'",
    ],
    // 移除诊断工具
    [
        "export const name = 'dsh-tui-exit-banner'\n\n// ── 临时诊断（定位后移除）──\nconst DEBUG_LOG = join(homedir() || process.env.HOME || '', '.dsh-tui', 'exit-banner-debug.log')\nfunction dbg(line: string): void {\n    try {\n        appendFileSync(DEBUG_LOG, `${new Date().toISOString()} pid=${process.pid} ${line}\\n`)\n    }\n    catch { /* 诊断失败不影响插件 */ }\n}\ndbg('MODULE loaded')",
        "export const name = 'dsh-tui-exit-banner'",
    ],
    // 移除 apply 入口诊断
    [
        "export function apply(ctx: Context, config: ExitBannerConfig = {}): void {\n    dbg(`APPLY ctx=${typeof ctx} config=${JSON.stringify(config)}`)",
        "export function apply(ctx: Context, config: ExitBannerConfig = {}): void {",
    ],
    // 新增 normalizeCommand
    [
        "type State = {",
        "/**\n" +
        " * 把上游给的恢复命令规整成可以直接敲的形式。\n" +
        " *\n" +
        " * 上游 resumeCommand(profile, id) 在真机上产出的是底层等价形式：\n" +
        " *   DSH_TUI_RESUME_SESSION=<id> dsh --profile dsh-tui\n" +
        " * 它能跑，但太长，而且上游并不知道用户是用哪个启动器别名（dst / dsh-tui）进来的。\n" +
        " * 因此：\n" +
        " *   - 上游给的是上面那种环境变量形式 → 换成 `<launcher> --resume <id>`；\n" +
        " *   - 上游已经给出带 --resume / --continue / -c 的短命令 → 原样保留（可能是自定义别名）；\n" +
        " *   - 认不出来 → 回退到 `<launcher> --resume <id>`。\n" +
        " */\n" +
        "export function normalizeCommand(raw: string, sessionId: string, launcher: string): string {\n" +
        "    const line = raw.trim()\n" +
        "    const fallback = `${launcher} --resume ${sessionId}`\n" +
        "    if (line === '') return fallback\n" +
        "    if (line.startsWith('DSH_TUI_RESUME_SESSION=')) return fallback\n" +
        "    if (/--resume|--continue|(^|\\s)-c(\\s|$)/.test(line)) return line\n" +
        "    return fallback\n" +
        "}\n" +
        "\n" +
        "type State = {",
    ],
    // resolveCommand 用 normalizeCommand + {id} 占位符
    [
        "    const resolveCommand = (text: string | undefined, sessionId: string): string => {\n        if (resolved.command !== '') return resolved.command\n        return text === undefined ? `dst --resume ${sessionId}` : commandFromReceipt(text, sessionId)\n    }",
        "    const resolveCommand = (text: string | undefined, sessionId: string): string => {\n        if (resolved.command !== '') return resolved.command.replaceAll('{id}', sessionId)\n        const raw = text === undefined ? '' : commandFromReceipt(text, sessionId)\n        return normalizeCommand(raw, sessionId, resolved.launcher)\n    }",
    ],
    // resolved 里加 launcher
    [
        "        command: config.command ?? '',\n    }",
        "        command: config.command ?? '',\n        launcher: config.launcher ?? 'dst',\n    }",
    ],
    // 移除主路径诊断
    [
        "                dbg(`MAIN PATH hit: sessionId=${sessionId ?? 'none'}`)\n                if (sessionId !== undefined) {",
        "                if (sessionId !== undefined) {",
    ],
    // 移除 exit 诊断
    [
        "    const onExit = (): void => {\n        dbg(`EXIT fired: pending=${state.pending !== undefined} suppress=${state.suppress} stdoutIsOurs=${process.stdout.write === patchedWrite} listeners=${process.listeners('exit').length} resume=${readPendingSession(state.startedAt) ?? 'none'} startedAt=${state.startedAt}`)\n        let banner = state.pending",
        "    const onExit = (): void => {\n        let banner = state.pending",
    ],
    // 移除 HOOKS 诊断
    [
        "    }, 'dsh-tui-exit-banner: stdout hook + exit listener')\n    dbg(`HOOKS installed: write=${process.stdout.write === patchedWrite} exitListeners=${process.listeners('exit').length}`)",
        "    }, 'dsh-tui-exit-banner: stdout hook + exit listener')",
    ],
])
