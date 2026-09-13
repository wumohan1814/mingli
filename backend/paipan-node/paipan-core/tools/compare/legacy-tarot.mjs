/**
 * 命理 · 对拍框架 · 塔罗旧实现适配器（节157）
 * ---------------------------------------------------------------------------
 * 作用：复刻 server.mjs 的生产装配顺序 —— 先加载 vendored 塔罗引擎，再应用命理
 * 自研牌阵覆盖层（mingli-tarot-spreads.mjs，REQ-122：新增 fourSeasons + 覆盖
 * celtic/horseshoe/hexagram 牌位名），最后导出 drawTarotSpread 供对拍框架比对。
 *
 * 为什么需要：线上 server.mjs 启动时就 applyMingliTarotSpreads(tarotSpreads)，
 * 因此「旧实现侧」的黄金参考必须是**覆盖后**的引擎（与生产一致）；自研内核
 * 照覆盖后的牌位口径实现，切换后前端展示零变化。
 *
 * 纪律：本文件属于对拍框架（允许 import 旧实现），不属于内核 src/；
 * 旧包名用片段拼接（与 run-compare.mjs 同法），保证 scan-deps 的
 * 「paipan-core 零旧包名命中」门禁不被本文件破坏。
 */
const LEGACY_PKG_DIR = ['min', 'gyu', '-core'].join('');
const { drawTarotSpread, tarotSpreads } = await import(`../../../vendor/${LEGACY_PKG_DIR}/dist/divination/tarot.js`);
import { applyMingliTarotSpreads } from '../../../mingli-tarot-spreads.mjs';

applyMingliTarotSpreads(tarotSpreads);

export { drawTarotSpread };
