/**
 * 命理 · 自研排盘内核 · 单一权威规则源 · 奇门终身局（qimen-lifetime）
 * ---------------------------------------------------------------------------
 * 节154：奇门终身局（按生辰起的命盘类奇门，与节153 时家问事局区分）。
 * 本文件只放「终身局特有」的规则；奇门盘面/三元表/符使/地盘等基础规则
 * 统一取自 rules/qimen.js（节153，唯一权威位置，调用方只读不抄）。
 *
 * 口径来源标注（对拍实测锁定，黑盒探针 tools/_probe/qimen-lifetime/，不读 vendor 源码）：
 *   - 中国夏令时表 1986–1991（Asia/Shanghai）：起始 05-04/04-12/04-17/04-16/04-15/04-14，
 *     结束 09-14/09-13/09-11/09-17/09-16/09-15；起始日 03:00 起 UTC+9、结束日 01:00 起 UTC+8。
 *     注意 1988 起始为 04-17（非常见资料的 04-10）——以旧实现对拍实测为准。
 *   - 终身局起局口径：birthDateTime 按 timeZoneId 当地挂钟（含夏令时）→ 绝对时刻 →
 *     东八区标准 +08:00 挂钟起局；带显式时区偏移后缀时校验与历史偏移一致，否则抛错。
 *   - 拆补符头：晚子时（23:00 起）按换日后的日干支从次日开始向前寻甲/己符头
 *     （与节153 qimen 内核的「民用日界」口径不同——本节以旧实现为准）。
 *   - 四柱分限（stages）：0-16 / 17-32 / 33-48 / 49-80 岁四段；起始日 =
 *     出生日（转换后挂钟小时 ∈ [0,7] 时减 1 天）；各段日历 = 起始日 + ageStart/ageEnd 年。
 *   - 个人标记（personalMarkers）：年/日/时干各 2 宫（天盘+地盘，甲干渲染「甲(遁X)」）、
 *     年支本宫、值符星（值符宫=5 时省略）、值使门、天禽寄宫携干（仅转盘）。
 *   - 值符宫=5（天禽）时省略值符星标记；甲干用旬首遁干定位（盘面无甲）。
 *   - 生命周期解读层（stages 主题/支持限制、topicCandidates、白话提示）为自撰内容，
 *     只保证形状与旧实现一致，不做逐字对拍（同节153「释义层不进关键字段」裁决）。
 */

/** 中国夏令时表（Asia/Shanghai，1986–1991；对拍实测，含 1988 异动 04-17）。 */
export const CHINA_DST = Object.freeze({
  1986: { start: [5, 4], end: [9, 14] },
  1987: { start: [4, 12], end: [9, 13] },
  1988: { start: [4, 17], end: [9, 11] },
  1989: { start: [4, 16], end: [9, 17] },
  1990: { start: [4, 15], end: [9, 16] },
  1991: { start: [4, 14], end: [9, 15] },
});

/** Asia/Shanghai 1901-01-01 前的本地平均时 LMT（UTC+8:05:43 ≈ +8.095278；对拍实测）。 */
export const SHANGHAI_LMT_OFFSET = 8.095278;

/** 固定偏移时区（UTC/Etc/GMT±N/Asia/Tokyo 等；对拍实测 Asia/Tokyo 恒 UTC+9）。 */
export const FIXED_OFFSET_TZ = Object.freeze({
  'UTC': 0,
  'Etc/GMT': 0,
  'Asia/Tokyo': 9,
});

/** 支持的 IANA 时区白名单（本内核不引第三方时区库；其余时区抛 PaipanInputError）。 */
export const SUPPORTED_TZ = Object.freeze(['Asia/Shanghai', 'UTC', 'Asia/Tokyo']);

/** 四柱分限标题（固定模板，对拍实测跨生辰一致）。 */
export const STAGE_TITLES = Object.freeze([
  '初限·早年根基', '中前限·青年立业', '中后限·中年鼎盛', '末限·晚景安泰',
]);

/** 四柱分限年龄段（含端点；对拍实测 0-16 / 17-32 / 33-48 / 49-80）。 */
export const STAGE_AGES = Object.freeze([
  { start: 0, end: 16 }, { start: 17, end: 32 }, { start: 33, end: 48 }, { start: 49, end: 80 },
]);

/** 四柱分限主限主题（年/月/日/时柱，固定模板，对拍实测跨生辰一致）。 */
export const STAGE_THEMES = Object.freeze({
  年: '年柱主限：主家庭原生教养、长辈福荫护持、学识基础与先天命质形成。',
  月: '月柱主限：走出家庭踏入社会、人际圈层开拓、事业基石奠定与青年自我认知。',
  日: '日柱主限：人生核心建树期，自身心力智慧完全展现，家庭与社会中流砥柱。',
  时: '时柱主限：事业收获定型、后辈晚生接班、生活闲适自洽与精神安泰归宿。',
});

/** 四柱分限固定限制声明（固定模板）。 */
export const STAGE_LIMITATION = '四柱分限只反映人生不同年龄主干阶段的能量倾向与宏观节奏，不代表具体某一年的必然事件。';

/** 生命周期阶段策略（basis.stagePolicy，固定）。 */
export const STAGE_POLICY = Object.freeze({
  model: 'pillarFourLimits',
  anchorRule: 'birthInstant',
  ageSystem: 'fullYears',
  yearsPerStage: 15,
});

/** 九大人生主题（固定顺序，对拍实测 career→partnership）。 */
export const TOPICS = Object.freeze([
  { topic: 'career', topicName: '事业官禄' },
  { topic: 'wealth', topicName: '资产财帛' },
  { topic: 'marriage', topicName: '婚恋配偶' },
  { topic: 'health', topicName: '身体疾厄' },
  { topic: 'academic', topicName: '学业进修' },
  { topic: 'relocation', topicName: '居所差旅' },
  { topic: 'family', topicName: '原生家庭' },
  { topic: 'children', topicName: '晚辈后嗣' },
  { topic: 'partnership', topicName: '合伙合作' },
]);

/** 个人标记传统意义文案（自撰摘要，信息性不进关键字段；结构字段才进门禁）。 */
export const MARKER_SIGNIFICANCE = Object.freeze({
  'yearStem:tianPan': (v) => `年干天盘落宫（${v}）：表外在社会名位、长辈福荫、名声根基与时代大势`,
  'yearStem:diPan': (v) => `年干地盘落宫（${v}）：表先天祖业沉淀、内在家族根基与深层心理安全感`,
  'yearBranch:baseGong': (v) => `年支本宫（${v}）：身体元气与先天命基之寄托本原`,
  'dayStem:tianPan': (v) => `日干天盘落宫（${v}）：求测者本人显性行藏、心智精力与中年主要作为`,
  'dayStem:diPan': (v) => `日干地盘落宫（${v}）：本人内心隐秘居所、精神寄托与底层支撑`,
  'hourStem:diPan': (v) => `时干地盘落宫（${v}）：晚运蓄势储备与底层执行承载`,
  'hourStem:tianPan': (v) => `时干天盘落宫（${v}）：晚景运势、具体事业产出、下属晚辈及事态最终归宿`,
  'zhiFuStar:tianPan': (v) => `值符星落宫（${v}）：一身大纲领，时代机遇与贵人庇佑之枢纽`,
  'zhiShiDoor:renPan': (v) => `值使门落宫（${v}）：人事具体权柄、行动落地与办事主宰`,
  'companionStem:tianPan': (v) => `天禽寄宫携干（${v}）：中五厚土兼化之隐性能量`,
});
