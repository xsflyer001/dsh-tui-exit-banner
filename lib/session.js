/**
 * 读 dsh-tui 自己写的两个文件。不依赖包内 API，因此上游版本变动不会打断它。
 */
import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const home = homedir() || process.env.USERPROFILE || process.env.HOME || '';
/** dsh-tui 退出时写入的待恢复会话 id；空串表示这一轮没有可恢复的会话。 */
export const RESUME_FILE = join(home, '.dsh-tui', 'resume.txt');
/** dsh-tui 自己的会话索引：会话 id → 派生信息（含标题）。 */
export const INDEX_FILE = join(home, '.dsh-tui', 'session-index.json');
/**
 * 读本轮退出留下的会话 id。
 *
 * 「这一轮真的留下了会话」双重判定：文件非空（空会话退出时 dsh-tui 写的是空串），
 * 且 mtime 不早于本进程启动时刻（排除上一轮遗留、崩溃、被 kill 的残留）。
 * @param startedAtMs 插件 apply 的时刻。
 * @returns 会话 id；没有可恢复会话时 undefined。
 */
export function readPendingSession(startedAtMs) {
    try {
        const sessionId = readFileSync(RESUME_FILE, 'utf8').trim();
        if (!sessionId)
            return undefined;
        if (statSync(RESUME_FILE).mtimeMs < startedAtMs)
            return undefined;
        return sessionId;
    }
    catch {
        return undefined;
    }
}
/**
 * 会话标题，取自 dsh-tui 自己的索引。
 * @param sessionId 会话 id。
 * @param untitled 索引里没有标题时的回退文案。
 */
export function readSessionTitle(sessionId, untitled) {
    try {
        const index = JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
        const title = index?.entries?.[sessionId]?.derived?.title;
        if (typeof title === 'string' && title.trim())
            return title.trim();
    }
    catch {
        // 索引不存在或损坏都只是少个标题，不算错误。
    }
    return untitled;
}
//# sourceMappingURL=session.js.map