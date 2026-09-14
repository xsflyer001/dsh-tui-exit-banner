/** ANSI Shadow 字体的 "DeepSeek"（8 字母 × 8 列 = 64 列）。默认字形。 */
const ANSI_SHADOW = [
    '██████╗ ███████╗███████╗██████╗ ███████╗███████╗███████╗██╗  ██╗',
    '██╔══██╗██╔════╝██╔════╝██╔══██╗██╔════╝██╔════╝██╔════╝██║ ██╔╝',
    '██║  ██║█████╗  █████╗  ██████╔╝███████╗█████╗  █████╗  █████╔╝ ',
    '██║  ██║██╔══╝  ██╔══╝  ██╔═══╝ ╚════██║██╔══╝  ██╔══╝  ██╔═██╗ ',
    '██████╔╝███████╗███████╗██║     ███████║███████╗███████╗██║  ██╗',
    '╚═════╝ ╚══════╝╚══════╝╚═╝     ╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝',
];
/** figlet small：5 行 × 50 列，线条风格。 */
const SMALL = [
    '  ___                       ___               _',
    ' |   \\   ___   ___   _ __  / __|  ___   ___  | |__',
    " | |) | / -_) / -_) | '_ \\ \\__ \\ / -_) / -_) | / /",
    ' |___/  \\___| \\___| | .__/ |___/ \\___| \\___| |_\\_\\',
    '                    |_|',
];
/** figlet mini：4 行 × 39 列，最紧凑的图形版。 */
const MINI = [
    '  _                   __',
    ' | \\   _    _   ._   (_    _    _   |',
    ' |_/  (/_  (/_  |_)  __)  (/_  (/_  |<',
    '                |',
];
/** 单行数学粗体，几乎不占地方（少数终端缺字形会显示成方框）。 */
const PLAIN = ['𝐃𝐞𝐞𝐩𝐒𝐞𝐞𝐤'];
const LOGOS = {
    shadow: ANSI_SHADOW,
    small: SMALL,
    mini: MINI,
    plain: PLAIN,
};
/** 按终端宽度裁掉过长标题，避免横幅折行。 */
export function fitTitle(title, columns) {
    const limit = Math.max(20, columns - 13);
    const chars = Array.from(title);
    return chars.length <= limit ? title : `${chars.slice(0, limit - 1).join('')}…`;
}
/** 渲染整块横幅。 */
export function renderBanner(input) {
    const lines = [''];
    if (input.logo !== 'none') {
        // 非法取值回退到默认字形：配置来自 schema，但手写 config 时可能写错。
        const glyphs = LOGOS[input.logo] ?? ANSI_SHADOW;
        for (const line of glyphs)
            lines.push(`   ${line}`);
        lines.push('');
    }
    const rows = [];
    if (input.showTitle)
        rows.push(['Session', fitTitle(input.title, input.columns)]);
    if (input.showCommand)
        rows.push(['Continue', input.command]);
    if (rows.length > 0) {
        const width = Math.max(...rows.map(([label]) => label.length)) + 2;
        for (const [label, value] of rows)
            lines.push(`   ${label.padEnd(width)}${value}`);
        lines.push('');
    }
    return lines.join('\n');
}
//# sourceMappingURL=banner.js.map