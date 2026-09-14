/**
 * 横幅渲染 —— 纯函数，不碰文件系统也不读全局状态，便于单测。
 *
 * 字形数据用普通字符串字面量而非模板字面量：figlet 的字形里有大量反斜杠，
 * 只要某一行以 `\` 结尾，模板字面量的闭合反引号就会被它转义掉
 * （`String.raw` 也不例外，那是模板语法的规则，不是 cooked 值的问题）。
 * 普通字符串里反斜杠写成 `\\` 就没有这个坑。
 */
import type { LogoStyle } from './config.js'

/** ANSI Shadow 字体的 "DeepSeek"（8 字母 × 8 列 = 64 列）。默认字形。 */
const ANSI_SHADOW = [
    '██████╗ ███████╗███████╗██████╗ ███████╗███████╗███████╗██╗  ██╗',
    '██╔══██╗██╔════╝██╔════╝██╔══██╗██╔════╝██╔════╝██╔════╝██║ ██╔╝',
    '██║  ██║█████╗  █████╗  ██████╔╝███████╗█████╗  █████╗  █████╔╝ ',
    '██║  ██║██╔══╝  ██╔══╝  ██╔═══╝ ╚════██║██╔══╝  ██╔══╝  ██╔═██╗ ',
    '██████╔╝███████╗███████╗██║     ███████║███████╗███████╗██║  ██╗',
    '╚═════╝ ╚══════╝╚══════╝╚═╝     ╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝',
]

/** figlet small：5 行 × 50 列，线条风格。 */
const SMALL = [
    '  ___                       ___               _',
    ' |   \\   ___   ___   _ __  / __|  ___   ___  | |__',
    " | |) | / -_) / -_) | '_ \\ \\__ \\ / -_) / -_) | / /",
    ' |___/  \\___| \\___| | .__/ |___/ \\___| \\___| |_\\_\\',
    '                    |_|',
]

/** figlet mini：4 行 × 39 列，最紧凑的图形版。 */
const MINI = [
    '  _                   __',
    ' | \\   _    _   ._   (_    _    _   |',
    ' |_/  (/_  (/_  |_)  __)  (/_  (/_  |<',
    '                |',
]

/** 单行数学粗体，几乎不占地方（少数终端缺字形会显示成方框）。 */
const PLAIN = ['𝐃𝐞𝐞𝐩𝐒𝐞𝐞𝐤']

const LOGOS: Record<Exclude<LogoStyle, 'none'>, readonly string[]> = {
    shadow: ANSI_SHADOW,
    small: SMALL,
    mini: MINI,
    plain: PLAIN,
}

export type BannerInput = {
    /** 待恢复的会话 id。 */
    sessionId: string
    /** 会话标题（已回退过）。 */
    title: string
    /** 恢复命令，通常是上游回执里的原文。 */
    command: string
    logo: LogoStyle
    showTitle: boolean
    showCommand: boolean
    /** 终端宽度，用于裁剪过长标题。 */
    columns: number
}

/** 按终端宽度裁掉过长标题，避免横幅折行。 */
export function fitTitle(title: string, columns: number): string {
    const limit = Math.max(20, columns - 13)
    const chars = Array.from(title)
    return chars.length <= limit ? title : `${chars.slice(0, limit - 1).join('')}…`
}

/** 渲染整块横幅。 */
export function renderBanner(input: BannerInput): string {
    const lines: string[] = ['']

    if (input.logo !== 'none') {
        // 非法取值回退到默认字形：配置来自 schema，但手写 config 时可能写错。
        const glyphs = LOGOS[input.logo as Exclude<LogoStyle, 'none'>] ?? ANSI_SHADOW
        for (const line of glyphs) lines.push(`   ${line}`)
        lines.push('')
    }

    const rows: Array<[string, string]> = []
    if (input.showTitle) rows.push(['Session', fitTitle(input.title, input.columns)])
    if (input.showCommand) rows.push(['Continue', input.command])

    if (rows.length > 0) {
        const width = Math.max(...rows.map(([label]) => label.length)) + 2
        for (const [label, value] of rows) lines.push(`   ${label.padEnd(width)}${value}`)
        lines.push('')
    }

    return lines.join('\n')
}
