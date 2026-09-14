import type { Context } from '@deepseek-ai/cordis';
import { Config, type Config as ExitBannerConfig, type LogoStyle } from './config.js';
import { renderBanner } from './banner.js';
export declare const name = "dsh-tui-exit-banner";
export { Config, renderBanner };
export type { ExitBannerConfig, LogoStyle };
/**
 * 这个 chunk 是不是 dsh-tui 的退出回执？
 * 必须同时具备：上游那句英文 + 终端恢复序列。
 */
export declare function isExitReceipt(text: string): boolean;
/**
 * 这个 chunk 是否说明本次退出会交给「重启 / 更新 / 崩溃」流程？
 * 那三种情况下新进程马上接管终端，不该再补一张收尾横幅。
 */
export declare function isSuppressNotice(text: string): boolean;
/**
 * 从上游回执里原样取出恢复命令行（通常是 `dst --resume <id>`）。
 * 取上游原文而不是自己拼，是为了尊重 dsh-tui / dst 别名与自定义 profile。
 */
export declare function commandFromReceipt(text: string, sessionId: string): string;
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
export declare function normalizeCommand(raw: string, sessionId: string, launcher: string): string;
/**
 * cordis 插件入口。
 * @param ctx cordis 上下文。
 * @param config 经过 schema 校验的配置（默认值已由 schema 补齐）。
 */
export declare function apply(ctx: Context, config?: ExitBannerConfig): void;
