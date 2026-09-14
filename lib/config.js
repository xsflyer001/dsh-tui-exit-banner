/**
 * 插件配置。每一项都有默认值：不写 config、或只写一部分，行为都与默认一致。
 *
 * 用 schemastery 声明（与 dsh 生态其它插件一致），宿主可以在加载前校验并补齐
 * 默认值，而不是靠插件自己兜。
 */
import z from '@deepseek-ai/schemastery';
export const Config = z.object({
    logo: z.string().default('shadow'),
    showTitle: z.boolean().default(true),
    showCommand: z.boolean().default(true),
    command: z.string().default(''),
    launcher: z.string().default('dst'),
});
//# sourceMappingURL=config.js.map