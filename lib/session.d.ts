/** dsh-tui 退出时写入的待恢复会话 id；空串表示这一轮没有可恢复的会话。 */
export declare const RESUME_FILE: string;
/** dsh-tui 自己的会话索引：会话 id → 派生信息（含标题）。 */
export declare const INDEX_FILE: string;
/**
 * 读本轮退出留下的会话 id。
 *
 * 「这一轮真的留下了会话」双重判定：文件非空（空会话退出时 dsh-tui 写的是空串），
 * 且 mtime 不早于本进程启动时刻（排除上一轮遗留、崩溃、被 kill 的残留）。
 * @param startedAtMs 插件 apply 的时刻。
 * @returns 会话 id；没有可恢复会话时 undefined。
 */
export declare function readPendingSession(startedAtMs: number): string | undefined;
/**
 * 会话标题，取自 dsh-tui 自己的索引。
 * @param sessionId 会话 id。
 * @param untitled 索引里没有标题时的回退文案。
 */
export declare function readSessionTitle(sessionId: string, untitled: string): string;
