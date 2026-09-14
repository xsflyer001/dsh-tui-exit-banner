/**
 * 横幅渲染 —— 纯函数，不碰文件系统也不读全局状态，便于单测。
 *
 * 字形数据用普通字符串字面量而非模板字面量：figlet 的字形里有大量反斜杠，
 * 只要某一行以 `\` 结尾，模板字面量的闭合反引号就会被它转义掉
 * （`String.raw` 也不例外，那是模板语法的规则，不是 cooked 值的问题）。
 * 普通字符串里反斜杠写成 `\\` 就没有这个坑。
 */
import type { LogoStyle } from './config.js';
export type BannerInput = {
    /** 待恢复的会话 id。 */
    sessionId: string;
    /** 会话标题（已回退过）。 */
    title: string;
    /** 恢复命令，通常是上游回执里的原文。 */
    command: string;
    logo: LogoStyle;
    showTitle: boolean;
    showCommand: boolean;
    /** 终端宽度，用于裁剪过长标题。 */
    columns: number;
};
/** 按终端宽度裁掉过长标题，避免横幅折行。 */
export declare function fitTitle(title: string, columns: number): string;
/** 渲染整块横幅。 */
export declare function renderBanner(input: BannerInput): string;
