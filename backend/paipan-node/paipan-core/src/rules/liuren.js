/**
 * 命理 · 自研排盘内核 · 单一权威规则源 · 大六壬（liuren）
 * ---------------------------------------------------------------------------
 * 「单一权威规则源」纪律（见 README §2）：本文件是大六壬这门术数的**唯一权威规则位置**。
 * 调用方（capabilities/liuren、对拍框架、测试）只能从这里取表；任何第二份拷贝即缺陷。
 *
 * 口径来源（黑盒对拍实测与旧实现一致；古籍文本从公网采源，见各条标注）：
 *   - 四柱/月将/昼夜/贵人/空亡/寄宫/天地盘/四课：与旧实现逐条实测一致（dense 2920+ 例）
 *   - 月将 = 按已交中气取（雨水后亥…大寒后子），边界精确时刻换将（对拍实测）
 *   - 昼夜贵人十干表、贵人顺逆六宫分界：黑盒探针 20 例实测一致
 *   - 九宗门：方向优先（下克上>上克下）、去重、比用（与日干同阴阳）、涉害、遥克、昴星、别责、八专、伏吟、反吟 ——
 *     判定次序与初传规则来自黑盒扫描（1990 全年×12 时辰 + 2024 抽样）
 *   - 神煞表：支马/驿马/劫煞/亡神/咸池/破碎/天罗/地网/天德/月德/天马/日德/日禄（13 项，实测逐条一致）
 *
 * 文案/释义来源（现代白话自撰；古籍原文公网采源）：
 *   - 课体名与部分释义：公版《六壬指南》《六壬大全》（维基文库，URL 见 GUATI_SOURCES）
 *   - 神煞/天将类象：现代通行整理，白话自撰
 *
 * 纪律：零依赖、零 IO、零网络、零随机数、零「当前时间」。纯数据 + 纯函数。
 */

/** 十二地支（序 0–11：子丑寅卯辰巳午未申酉戌亥）。 */
export const ZHI = Object.freeze(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);

/** 十天干。 */
export const GAN = Object.freeze(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']);

/** 地支五行（传统归属，实测与旧实现一致）。 */
export const ZHI_WUXING = Object.freeze({
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
});

/** 天干五行。 */
export const GAN_WUXING = Object.freeze({
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
});

/** 五行相生：木生火、火生土、土生金、金生水、水生木。 */
export const SHENG = Object.freeze({ 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' });

/** 五行相克：木克土、土克水、水克火、火克金、金克木。 */
export const KE = Object.freeze({ 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' });

/** 天干阴阳（阳=true：甲丙戊庚壬）。 */
export const GAN_YY = Object.freeze({
  甲: true, 乙: false, 丙: true, 丁: false, 戊: true,
  己: false, 庚: true, 辛: false, 壬: true, 癸: false,
});

/** 地支阴阳（阳=子寅辰午申戌）。 */
export const ZHI_YY = Object.freeze({
  子: true, 丑: false, 寅: true, 卯: false, 辰: true, 巳: false,
  午: true, 未: false, 申: true, 酉: false, 戌: true, 亥: false,
});

/** 遁干寄宫表（日干 → 寄宫支）。实测与旧实现一致。 */
export const JI_GONG = Object.freeze({
  甲: '寅', 乙: '辰', 丙: '巳', 丁: '未', 戊: '巳',
  己: '未', 庚: '申', 辛: '戌', 壬: '亥', 癸: '丑',
});

/**
 * 月将表：按**已交中气**取月将（换将点为中气精确时刻，对拍实测）。
 * 键 = 中气名（交此中气后启用）；值 = 月将支。
 */
export const MONTH_LEADER_BY_ZHONGQI = Object.freeze({
  雨水: '亥', 春分: '戌', 谷雨: '酉', 小满: '申',
  夏至: '未', 大暑: '午', 处暑: '巳', 秋分: '辰',
  霜降: '卯', 小雪: '寅', 冬至: '丑', 大寒: '子',
});

/** 月将序（用于月将加时计算）：子0…亥11，与 ZHI 序一致即可。 */

/** 昼夜贵人表：日干 → { 昼占, 夜占 } 贵人支（十干昼夜贵人口诀，实测 20 例一致）。 */
export const NOBLEMAN_TABLE = Object.freeze({
  甲: { 昼占: '丑', 夜占: '未' },
  乙: { 昼占: '子', 夜占: '申' },
  丙: { 昼占: '亥', 夜占: '酉' },
  丁: { 昼占: '亥', 夜占: '酉' },
  戊: { 昼占: '丑', 夜占: '未' },
  己: { 昼占: '子', 夜占: '申' },
  庚: { 昼占: '丑', 夜占: '未' },
  辛: { 昼占: '午', 夜占: '寅' },
  壬: { 昼占: '巳', 夜占: '卯' },
  癸: { 昼占: '巳', 夜占: '卯' },
});

/**
 * 十二天将（贵人起，顺序固定）与顺逆布：
 * 贵人临地盘 亥子丑寅卯辰 六宫 → 顺布；临 巳午未申酉戌 六宫 → 逆布（对拍实测）。
 */
export const TIAN_JIANG_ORDER = Object.freeze([
  '贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙',
  '天空', '白虎', '太常', '玄武', '太阴', '天后',
]);

/** 昼夜占：占时支 卯～申 为昼占，酉～寅 为夜占（对拍实测）。 */
export const DAY_NIGHT_RULE = Object.freeze({
  rule: '卯至申为昼占，酉至寅为夜占（按占时支）',
});

/**
 * 天将五行/阴阳/类象（盘面用到的天将属性；description 为白话自撰）。
 * 五行/阴阳属传统归属（结构化字段）；类象为现代通行整理。
 */
export const TIAN_JIANG_PROPS = Object.freeze({
  贵人: { wuxing: '土', yinYang: '阳', category: '尊贵/提携', description: '传统类象为尊贵之人、官方、贵人提携、化险为夷' },
  螣蛇: { wuxing: '火', yinYang: '阴', category: '惊恐/虚诈', description: '传统类象为惊恐、虚惊、缠绕、怪异之事' },
  朱雀: { wuxing: '火', yinYang: '阳', category: '文书/口舌', description: '传统类象为文书、信息、口舌是非、争论' },
  六合: { wuxing: '木', yinYang: '阳', category: '和合/中介', description: '传统类象为婚姻、合作、中介、和合之事' },
  勾陈: { wuxing: '土', yinYang: '阳', category: '田土/迟滞', description: '传统类象为田土、旧事、牵绊、迟滞' },
  青龙: { wuxing: '木', yinYang: '阳', category: '财帛/喜庆', description: '传统类象为财帛、文字、官府、升迁、喜庆' },
  天空: { wuxing: '土', yinYang: '阳', category: '虚诈/落空', description: '传统类象为虚诈、落空、文书空谈' },
  白虎: { wuxing: '金', yinYang: '阳', category: '凶险/病伤', description: '传统类象为凶险、疾病、血光、竞争' },
  太常: { wuxing: '土', yinYang: '阴', category: '宴乐/印绶', description: '传统类象为文章、印绶、衣服、酒食、宴乐' },
  玄武: { wuxing: '水', yinYang: '阴', category: '盗失/暗昧', description: '传统类象为盗贼、遗失、暗昧、隐瞒之事' },
  太阴: { wuxing: '金', yinYang: '阴', category: '阴私/女眷', description: '传统类象为阴私、女眷、隐匿、细腻之事' },
  天后: { wuxing: '水', yinYang: '阳', category: '妇人/恩泽', description: '传统类象为宫廷、妇人、婚姻、恩泽' },
});

/**
 * 神煞表（13 项，顺序与旧实现一致 —— shenShaFacts 数组序）：
 * 每项：{ name, basis, targetType, resolve(日干, 日支, 月建) → 目标 }
 */
export const SHEN_SHA = Object.freeze([
  { name: '支马', basis: '日支', targetType: '地支', rule: '日支所属三合局取支马：申子辰寅、亥卯未巳、寅午戌申、巳酉丑亥' },
  { name: '驿马', basis: '月建', targetType: '地支', rule: '按逐月神煞表取驿马：寅午戌月申、亥卯未月巳、申子辰月寅、巳酉丑月亥' },
  { name: '劫煞', basis: '月建', targetType: '地支', rule: '按逐月神煞表取劫煞：寅午戌月亥、亥卯未月申、申子辰月巳、巳酉丑月寅' },
  { name: '亡神', basis: '月建', targetType: '地支', rule: '按逐月神煞表取亡神：寅午戌月巳、亥卯未月寅、申子辰月亥、巳酉丑月申' },
  { name: '咸池', basis: '月建', targetType: '地支', rule: '按逐月神煞表取咸池：寅午戌月卯、亥卯未月子、申子辰月酉、巳酉丑月午' },
  { name: '破碎', basis: '月建', targetType: '地支', rule: '月建四孟在酉、四仲在巳、四季在丑' },
  { name: '天罗', basis: '日支', targetType: '地支', rule: '日前一支为天罗' },
  { name: '地网', basis: '日支', targetType: '地支', rule: '天罗对冲之支为地网' },
  { name: '天德', basis: '月建', targetType: '地支', rule: '按十二月天德表定位' },
  { name: '月德', basis: '月建', targetType: '天干', rule: '寅午戌月丙、申子辰月壬、亥卯未月甲、巳酉丑月庚' },
  { name: '天马', basis: '月建', targetType: '地支', rule: '正月午起，逐月顺行两支' },
  { name: '日德', basis: '日干', targetType: '地支', rule: '甲己寅、乙庚申、丙辛巳、丁壬亥、戊癸巳' },
  { name: '日禄', basis: '日干', targetType: '地支', rule: '甲寅、乙卯、丙戊巳、丁己午、庚申、辛酉、壬亥、癸子' },
]);

/** 三合局表：支 → 其所在三合局三支（有序）。 */
export const SAN_HE = Object.freeze({
  申: ['申', '子', '辰'], 子: ['申', '子', '辰'], 辰: ['申', '子', '辰'],
  寅: ['寅', '午', '戌'], 午: ['寅', '午', '戌'], 戌: ['寅', '午', '戌'],
  巳: ['巳', '酉', '丑'], 酉: ['巳', '酉', '丑'], 丑: ['巳', '酉', '丑'],
  亥: ['亥', '卯', '未'], 卯: ['亥', '卯', '未'], 未: ['亥', '卯', '未'],
});

/** 十二月天德表（月建 → 天德，混干/支，传统表）。 */
export const TIAN_DE = Object.freeze({
  寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲',
  申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚',
});

/** 月德表：三合火局(寅午戌)月丙、水局(申子辰)月壬、木局(亥卯未)月甲、金局(巳酉丑)月庚。 */
export const YUE_DE = Object.freeze({
  寅: '丙', 午: '丙', 戌: '丙',
  申: '壬', 子: '壬', 辰: '壬',
  亥: '甲', 卯: '甲', 未: '甲',
  巳: '庚', 酉: '庚', 丑: '庚',
});

/** 日德表：甲己寅、乙庚申、丙辛巳、丁壬亥、戊癸巳。 */
export const RI_DE = Object.freeze({
  甲: '寅', 己: '寅', 乙: '申', 庚: '申', 丙: '巳', 辛: '巳',
  丁: '亥', 壬: '亥', 戊: '巳', 癸: '巳',
});

/** 日禄表：甲寅、乙卯、丙戊巳、丁己午、庚申、辛酉、壬亥、癸子。 */
export const RI_LU = Object.freeze({
  甲: '寅', 乙: '卯', 丙: '巳', 戊: '巳', 丁: '午', 己: '午',
  庚: '申', 辛: '酉', 壬: '亥', 癸: '子',
});

/**
 * 课体定义（自研权威规则源；名称与触发条件由黑盒扫描 + 公版课体整理）：
 * 每项 { id, stableKey, name, category, test(初传, 中传, 末传, 四课上神, 日干, 日支, 月将...) → {matched, branches} }
 * 来源：公版《六壬指南》卷一·三传课体 与 《六壬大全》卷七·毕法赋（维基文库）。
 */
export const GUATI_SOURCES = Object.freeze([
  { title: '《六壬指南》卷一·三传课体', url: 'https://zh.wikisource.org/w/index.php?title=六壬指南/1&oldid=854504' },
  { title: '《六壬大全》卷七·毕法赋', url: 'https://zh.wikisource.org/w/index.php?title=六壬大全/7&oldid=854575' },
]);

/** 十二刑（伏吟三传用）：寅刑巳、巳刑申、申刑寅；丑刑戌、戌刑未、未刑丑；子刑卯、卯刑子；辰午酉亥自刑。 */
export const XING = Object.freeze({
  寅: '巳', 巳: '申', 申: '寅',
  丑: '戌', 戌: '未', 未: '丑',
  子: '卯', 卯: '子',
  辰: '辰', 午: '午', 酉: '酉', 亥: '亥',
});

/** 六冲（反吟三传用）：子午、丑未、寅申、卯酉、辰戌、巳亥。 */
export const CHONG = Object.freeze({
  子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅',
  卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳',
});

/** 五鼠遁：日干 → 子时干（甲己还加甲、乙庚丙作初、丙辛从戊起、丁壬庚子居、戊癸壬子是真途）。 */
export const WU_SHU_DUN = Object.freeze({
  甲: '甲', 己: '甲', 乙: '丙', 庚: '丙', 丙: '戊', 辛: '戊',
  丁: '庚', 壬: '庚', 戊: '壬', 癸: '壬',
});

/**
 * 九宗门口径文本（classicalRules / transmissionDetail 用；白话自撰，出处《大六壬大全》九宗门取传法）。
 */
export const JIU_ZONG_MEN = Object.freeze({
  元首: { source: '《大六壬大全》九宗门取传法', rule: '元首', category: '元首法', summary: '四课只有一处上克下，以上克下之上神为初传发用。' },
  重审: { source: '《大六壬大全》九宗门取传法', rule: '重审', category: '重审法', summary: '四课只有一处下贼上，以下贼上之上神为初传发用。' },
  比用: { source: '《大六壬大全》九宗门取传法', rule: '知一/比用', category: '比用法', summary: '贼克或遥克候选不止一处时，取与日干阴阳同类的上神发用。' },
  涉害: { source: '《六壬指南》涉害取法及《六壬大全》涉害课', rule: '涉害', category: '涉害法', summary: '多处贼克且阴阳比用候选仍有多支时，先比较各上神归本家途中所受克的深浅；复等先按阳日干上、阴日支上取先见神，无法复等再取四孟、四仲、四季上神。' },
  遥克: { source: '《大六壬大全》九宗门取传法', rule: '遥克', category: '遥克法', summary: '四课无直接上下克时，取二三四课上神与日干遥相克者；上神克日干为蒿矢，日干克上神为弹射，多候选再依比用、涉害次序取发用。' },
  昴星: { source: '《大六壬大全》九宗门取传法', rule: '昴星', category: '昴星法', summary: '四课无克、无遥克时，阳日取地盘酉之上神为初传，阴日取天盘酉之下神为初传；中传取日支上神，末传取中传上神。' },
  别责: { source: '《大六壬大全》九宗门取传法', rule: '别责', category: '别责法', summary: '无克、无遥克且非昴星时，取日干寄宫合神或日支三合之神发用，中末传取上神递传。' },
  八专: { source: '《大六壬大全》九宗门取传法', rule: '八专', category: '八专法', summary: '日干寄宫与日支同支（八专课）无克时，阳日取日支上神、阴日取日干寄宫上神为初传发用。' },
  伏吟: { source: '《大六壬大全》九宗门取传法', rule: '伏吟', category: '伏吟法', summary: '月将加时天地盘同位（伏吟）无克时，阳日取日干寄宫、阴日取日支为初传；中末传取初传之刑。' },
  反吟: { source: '《大六壬大全》九宗门取传法', rule: '反吟', category: '反吟法', summary: '月将加时天地盘相对（反吟）无克时，取驿马或日支上神发用，三传取对冲递传。' },
});

/** 时辰标签（与 xiHourIndex 一致：0=早子时 … 12=晚子时）。 */
export const HOUR_LABELS = Object.freeze([
  '早子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时',
  '未时', '申时', '酉时', '戌时', '亥时', '晚子时',
]);

export const LIUREN_RULES = Object.freeze({
  source: '口径对拍实测与旧实现一致（vendor 黑盒）；课体名与古籍原文采自公版《六壬指南》《六壬大全》',
  zhi: ZHI,
  gan: GAN,
  zhiWuxing: ZHI_WUXING,
  ganWuxing: GAN_WUXING,
  sheng: SHENG,
  ke: KE,
  jiGong: JI_GONG,
  monthLeaderByZhongqi: MONTH_LEADER_BY_ZHONGQI,
  noblemanTable: NOBLEMAN_TABLE,
  tianJiangOrder: TIAN_JIANG_ORDER,
  tianJiangProps: TIAN_JIANG_PROPS,
  shenSha: SHEN_SHA,
  sanHe: SAN_HE,
  tianDe: TIAN_DE,
  yueDe: YUE_DE,
  riDe: RI_DE,
  riLu: RI_LU,
  xing: XING,
  chong: CHONG,
  wuShuDun: WU_SHU_DUN,
  jiuZongMen: JIU_ZONG_MEN,
  dayNightRule: DAY_NIGHT_RULE,
  hourLabels: HOUR_LABELS,
});
