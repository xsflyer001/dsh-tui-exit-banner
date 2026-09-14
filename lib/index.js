/**
 * dsh-tui 退出横幅 —— cordis 运行时插件。
 *
 * 退出 dsh-tui 且这一轮真的留下了会话时，打印一块回执：
 *
 *      ██████╗ ███████╗ ...（大号 DeepSeek）
 *      Session   查找之前的会话记录
 *      Continue  dst --resume f984b9ec-6c5d-4ed1-9efd-47527be3413f
 *
 * 空会话（没有留下可恢复内容）静默退出，和 opencode 的行为一致。
 *
 * ── 关于接缝（重要，请勿误读为「标准插件」）────────────────────────────────
 * 本插件走的是**宿主级钩子**，不是 dsh-std / dsh-ecosystem-spec 的标准接缝。
 * 截至 tui-admission/0.15，dsh-tui 提供且被规范收录的接缝只有
 * `tui.decision-events`、`tui.scene`、`tui.settings-section`、`tui.channel`
 * 以及已被取代的 `workspace-provider` —— 其中**没有**「退出 / 生命周期」能力，
 * 因此「退出时输出」这件事没有合规接缝可用。本插件只做两件最小的事：
 *
 *   1. 包装 process.stdout.write，认出上游的退出回执 chunk
 *      （判据：同一 chunk 内既有那句英文，又有终端恢复序列）；
 *   2. 把横幅推迟到 process 'exit' 再写。上游在 `done()` 之前写 notice，
 *      紧接着被 Ink 的收尾输出（备用屏切换 / 清屏）冲掉，
 *      表现就是「提示闪一下就不见了」。
 *
 * ── 为什么 exit 钩子不跟插件同生共死（踩坑记录，勿「顺手修好」）────────────
 * 上游的退出顺序是：`onUserExit` 写 resume.txt → `finishExit` 写 cleanup+notice
 * → `done()` → `disposeRootAndExit` → `process.exit()`。
 *
 * 也就是说 **cordis 拆整棵树发生在 process 'exit' 之前**。如果按常规把 exit 钩子
 * 放进插件的清理（`ctx.effect(() => () => process.off('exit', onExit))`），
 * dispose 时会先把钩子摘掉，等 `process.exit()` 真正触发时已经没人监听了 ——
 * 横幅被主路径吞掉却补不回来，用户**什么都看不到**。（实测日志：`MAIN PATH hit`
 * 出现 3 次，`EXIT fired` 0 次。）
 *
 * 所以这里的 exit 钩子是**模块级单例、且故意不随 dispose 移除**；dispose 只还原
 * `process.stdout.write`。live reload 时新实例会覆盖 `activeState`，旧钩子读到的新
 * 状态，因此不会重复打印，也不会累积。
 *
 * 上游一旦提供退出接缝，应迁移过去并删除这里的 stdout 包装。
 */
import { writeSync } from 'node:fs';
import { Config } from './config.js';
import { renderBanner } from './banner.js';
import { readPendingSession, readSessionTitle } from './session.js';
export const name = 'dsh-tui-exit-banner';
export { Config, renderBanner };
/** 与 dsh-tui 的语言契约一致：DSH_TUI_LANG 显式指定时从其值，否则中文。 */
function untitledText() {
    const lang = (process.env.DSH_TUI_LANG ?? 'zh').toLowerCase();
    return lang.startsWith('zh') ? '未命名会话' : 'Untitled session';
}
/** 上游退出回执里的英文；命中它才把整段 notice 换成横幅。 */
const UPSTREAM_HINT = 'Resume with the command below:';
/**
 * 退出回执独有的终端恢复序列。上游 finishExit 把终端 cleanup 和 notice 写在
 * 同一个 chunk 里，cleanup 必带这几条；而 TUI 渲染对话内容时不会出现它们 ——
 * 这正是「对话里引用过这句英文」不会被误判成退出的原因。
 * 注意别把 ?25h（显示光标）加进来：它在正常渲染里也可能出现。
 */
const EXIT_CLEANUP_MARKERS = [
    '\u001b[?1049l',
    '\u001b[?1000l',
    '\u001b[?1002l',
    '\u001b[?1003l',
    '\u001b[?1006l',
];
/**
 * 这些通知说明本次退出会交给「重启 / 更新 / 崩溃」流程 —— 那时新进程马上接管
 * 终端，不该再补一张收尾横幅。
 */
const SUPPRESS_MARKERS = [
    'dsh-tui crashed:',
    '正在重启 dsh-tui',
    'Restarting dsh-tui',
    '正在更新 @deepseek-harness-tui/dsh-tui',
    'Updating @deepseek-harness-tui/dsh-tui',
];
/**
 * 这个 chunk 是不是 dsh-tui 的退出回执？
 * 必须同时具备：上游那句英文 + 终端恢复序列。
 */
export function isExitReceipt(text) {
    if (!text.includes(UPSTREAM_HINT))
        return false;
    return EXIT_CLEANUP_MARKERS.some(marker => text.includes(marker));
}
/**
 * 这个 chunk 是否说明本次退出会交给「重启 / 更新 / 崩溃」流程？
 * 那三种情况下新进程马上接管终端，不该再补一张收尾横幅。
 */
export function isSuppressNotice(text) {
    return SUPPRESS_MARKERS.some(marker => text.includes(marker));
}
/**
 * 从上游回执里原样取出恢复命令行（通常是 `dst --resume <id>`）。
 * 取上游原文而不是自己拼，是为了尊重 dsh-tui / dst 别名与自定义 profile。
 */
export function commandFromReceipt(text, sessionId) {
    const fallback = `dst --resume ${sessionId}`;
    const at = text.indexOf(UPSTREAM_HINT);
    if (at === -1)
        return fallback;
    const rest = text.slice(at + UPSTREAM_HINT.length);
    for (const raw of rest.split('\n')) {
        const line = raw.trim();
        if (line.length > 0)
            return line;
    }
    return fallback;
}
/**
 * 把上游给的恢复命令规整成可以直接敲的形式。
 *
 * 上游 resumeCommand(profile, id) 在真机上产出的是底层等价形式：
 *   DSH_TUI_RESUME_SESSION=<id> dsh --profile dsh-tui
 * 它能跑，但太长，而且上游并不知道用户是用哪个启动器别名（dst / dsh-tui）进来的。
 * 因此：
 *   - 上游给的是上面那种环境变量形式 → 换成 `<launcher> --resume <id>`；
 *   - 上游已经给出带 --resume / --continue / -c 的短命令 → 原样保留（可能是自定义别名）；
 *   - 认不出来 → 回退到 `<launcher> --resume <id>`。
 */
export function normalizeCommand(raw, sessionId, launcher) {
    const line = raw.trim();
    const fallback = `${launcher} --resume ${sessionId}`;
    if (line === '')
        return fallback;
    if (line.startsWith('DSH_TUI_RESUME_SESSION='))
        return fallback;
    if (/--resume|--continue|(^|\s)-c(\s|$)/.test(line))
        return line;
    return fallback;
}
/**
 * 当前活跃的插件实例状态。
 * 模块级而非每次 apply 各自持有：exit 钩子只装一次，必须能在 live reload 后
 * 读到最新实例的状态。
 */
let activeState;
let exitHookInstalled = false;
/**
 * 安装 process 'exit' 钩子 —— 全进程只装一次，且**不随插件 dispose 移除**。
 * 理由见文件头「为什么 exit 钩子不跟插件同生共死」。
 */
function installExitHook() {
    if (exitHookInstalled)
        return;
    exitHookInstalled = true;
    process.on('exit', () => {
        const state = activeState;
        if (state === undefined)
            return;
        if (state.suppress)
            return;
        let banner = state.pending;
        if (banner === undefined) {
            const sessionId = readPendingSession(state.startedAt);
            if (sessionId !== undefined) {
                const command = state.commandOverride !== ''
                    ? state.commandOverride.replaceAll('{id}', sessionId)
                    : `${state.launcher} --resume ${sessionId}`;
                banner = state.build(sessionId, command);
            }
        }
        if (banner === undefined)
            return;
        try {
            writeSync(1, `\n${banner}`);
        }
        catch {
            // 终端已经关掉时写不进去，静默即可。
        }
    });
}
/**
 * cordis 插件入口。
 * @param ctx cordis 上下文。
 * @param config 经过 schema 校验的配置（默认值已由 schema 补齐）。
 */
export function apply(ctx, config = {}) {
    const resolved = {
        logo: (config.logo ?? 'shadow'),
        showTitle: config.showTitle ?? true,
        showCommand: config.showCommand ?? true,
        command: config.command ?? '',
        launcher: config.launcher ?? 'dst',
    };
    const originalWrite = process.stdout.write;
    const build = (sessionId, command) => renderBanner({
        sessionId,
        title: readSessionTitle(sessionId, untitledText()),
        command,
        logo: resolved.logo,
        showTitle: resolved.showTitle,
        showCommand: resolved.showCommand,
        columns: process.stdout.columns ?? 80,
    });
    const state = {
        startedAt: Date.now(),
        suppress: false,
        commandOverride: resolved.command,
        launcher: resolved.launcher,
        build,
        originalWrite,
    };
    activeState = state;
    installExitHook();
    const patchedWrite = function patchedWrite(...args) {
        const chunk = args[0];
        let text;
        try {
            if (typeof chunk === 'string')
                text = chunk;
            else if (Buffer.isBuffer(chunk))
                text = chunk.toString('utf8');
        }
        catch {
            text = undefined;
        }
        if (text !== undefined) {
            if (isSuppressNotice(text)) {
                state.suppress = true;
            }
            else if (isExitReceipt(text)) {
                const sessionId = readPendingSession(state.startedAt);
                if (sessionId !== undefined) {
                    const command = resolved.command !== ''
                        ? resolved.command.replaceAll('{id}', sessionId)
                        : normalizeCommand(commandFromReceipt(text, sessionId), sessionId, resolved.launcher);
                    state.pending = build(sessionId, command);
                    // 吞掉上游那两行英文，横幅留到 exit 钩子再打。
                    const at = text.indexOf(UPSTREAM_HINT);
                    return originalWrite.call(this, text.slice(0, at), ...args.slice(1));
                }
            }
        }
        return originalWrite.apply(this, args);
    };
    process.stdout.write = patchedWrite;
    // 只还原 stdout.write。exit 钩子**故意不在这里摘** —— cordis 在
    // process.exit() 之前就会 dispose 整棵树，摘掉它横幅就没机会打印了。
    ctx.effect(() => () => {
        process.stdout.write = originalWrite;
    }, 'dsh-tui-exit-banner: stdout hook');
}
//# sourceMappingURL=index.js.map