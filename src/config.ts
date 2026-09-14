/**
 * 插件配置。每一项都有默认值：不写 config、或只写一部分，行为都与默认一致。
 *
 * 用 schemastery 声明（与 dsh 生态其它插件一致），宿主可以在加载前校验并补齐
 * 默认值，而不是靠插件自己兜。
 */
import z from '@deepseek-ai/schemastery'

/** 顶部大号字的样式。 */
export type LogoStyle = 'shadow' | 'small' | 'mini' | 'plain' | 'none'

export type Config = {
    /**
     * 顶部大号字样式，取值见 {@link LogoStyle}：
     * `shadow`（默认）| `small` | `mini` | `plain` | `none`。
     * 声明为 string 是为了与 schemastery 的 z.string() 对齐；
     * 非法取值在渲染时回退到默认字形，不会抛错。
     */
    logo?: string
    /** 是否打印 `Session <会话标题>` 一行。 */
    showTitle?: boolean
    /** 是否打印 `Continue <恢复命令>` 一行。 */
    showCommand?: boolean
    /**
     * 覆盖恢复命令。支持 `{id}` 占位符，例如 `my-launcher --resume {id}`。
     * 留空时由上游回执规整而来（见 index.ts 的 normalizeCommand）。
     */
    command?: string
    /**
     * 生成恢复命令时用的启动器名，默认 `dst`（dsh-tui 的官方别名）。
     * 上游的 resumeCommand 产出的是底层形式 `DSH_TUI_RESUME_SESSION=<id> dsh --profile <p>`，
     * 又长又不像给人敲的；这里换成启动器形式。你若用别的别名启动，改这一项即可。
     */
    launcher?: string
}

export const Config: Schemastery<Config> = z.object({
    logo: z.string().default('shadow'),
    showTitle: z.boolean().default(true),
    showCommand: z.boolean().default(true),
    command: z.string().default(''),
    launcher: z.string().default('dst'),
})
