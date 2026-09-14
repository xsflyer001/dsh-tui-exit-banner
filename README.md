# dsh-tui-exit-banner

[dsh-TUI](https://github.com/ccch1mneyyy/dsh-TUI) · 一个为 dsh-TUI 生态打造的插件

退出 dsh-TUI 时打印一块回执：大号 DeepSeek + 会话标题 + 恢复命令。空会话静默退出，和 opencode 的行为一致。

```
   ██████╗ ███████╗███████╗██████╗ ███████╗███████╗███████╗██╗  ██╗
   ██╔══██╗██╔════╝██╔════╝██╔══██╗██╔════╝██╔════╝██╔════╝██║ ██╔╝
   ██║  ██║█████╗  █████╗  ██████╔╝███████╗█████╗  █████╗  █████╔╝
   ██║  ██║██╔══╝  ██╔══╝  ██╔═══╝ ╚════██║██╔══╝  ██╔══╝  ██╔═██╗
   ██████╔╝███████╗███████╗██║     ███████║███████╗███████╗██║  ██╗
   ╚═════╝ ╚══════╝╚══════╝╚═╝     ╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝

   Session   查找之前的会话记录
   Continue  dst --resume f984b9ec-6c5d-4ed1-9efd-47527be3413f
```

## 为什么需要它

dsh-TUI 本来就会在退出时给出恢复提示（`Resume with the command below:`），但它写在
`finishExit` 里、早于 `done()`；紧接着 Ink 的收尾输出（备用屏切换 / 清屏）会把它冲掉，
实际表现是**提示闪一下就不见了**。本插件把那两行英文换成一块更醒目的横幅，并且**推迟到
进程退出的最后一刻**再写，因此不会被覆盖。

## 安装

```
dsh plugin --profile dsh-tui add dsh-tui-exit-banner
```

依赖声明了 `dsh.bundle`，`dsh plugin add` 会自动把它登记进 profile 的 `bundles` 列表。

## 配置

全部有默认值，可以整段省略。写在 profile 的 `cordis.patch.yml` 里覆盖：

```yaml
- id: dsh-tui-exit-banner
  config:
    logo: shadow      # shadow | small | mini | plain | none
    showTitle: true
    showCommand: true
    command: ''       # 留空 = 从上游回执里原样提取（推荐）
```

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `logo` | `shadow` | 顶部大号字。`shadow` 64 列实心块；`small` / `mini` 线条风格（更小）；`plain` 单行；`none` 不打印 |
| `showTitle` | `true` | 是否打印 `Session <标题>`（标题取自 dsh-TUI 自己的 `session-index.json`） |
| `showCommand` | `true` | 是否打印 `Continue <命令>` |
| `command` | 空 | 覆盖恢复命令，支持 `{id}` 占位符，例如 `my-launcher --resume {id}` |
| `launcher` | `dst` | 生成恢复命令用的启动器别名。上游给的是底层形式 `DSH_TUI_RESUME_SESSION=<id> dsh --profile <p>`，这里换成可直敲的 `<launcher> --resume <id>` |

## 关于接缝（请勿误读为标准插件）

**本插件走的是宿主级钩子，不是 `dsh-std` / `dsh-ecosystem-spec` 的标准接缝。**

截至 `tui-admission/0.15`，dsh-TUI 提供且被规范收录的接缝只有 `tui.decision-events`、
`tui.scene`、`tui.settings-section`、`tui.channel`，以及已被取代的 `workspace-provider` ——
其中**没有**「退出 / 生命周期」能力，因此「退出时输出」这件事没有合规接缝可用。

插件只做两件最小的事：

1. 包装 `process.stdout.write`，认出上游的退出回执 chunk。判据是**同一个 chunk 内既有那句
   英文、又有终端恢复序列**（`?1049l` / `?1000l` / `?1002l` / `?1003l` / `?1006l`）。
   故意不含 `?25h`（显示光标）——它在正常渲染里也会出现，会把「对话内容里引用了这句英文」
   误判成退出。
2. 把横幅推迟到 `process.on('exit')` 再写。

**上游一旦提供退出接缝，本插件应迁移过去并删除 stdout 包装。**

## 行为矩阵

| 场景 | 表现 |
| --- | --- |
| 有内容的会话退出 | 打印横幅 |
| 空会话（刚开就退） | 静默 |
| `/restart`、`/update`、崩溃 | 不补横幅（新进程马上接管终端） |
| 会话内容里出现那句英文 | 不误判 |

## 开发

```
pnpm install
pnpm build     # tsc → lib/
pnpm test      # vitest
```

## License

MIT
