/**
 * 命理 · 自研排盘内核 · 西洋占星规则表（节151 · 单一权威规则源）
 * ===========================================================================
 * 本文件是「西洋占星」能力的**唯一权威规则位置**：星座表、宫位制口径、相位表与
 * 容许度表、庙旺陷落（essential dignity）表、四轴定义、假想点公式、时区/夏令时口径。
 * 调用方（capabilities / 对拍框架 / 测试 / 未来的 server.mjs 适配层）**只读不抄**。
 *
 * 来源标注（每块都写清出处，README §2 纪律）：
 *  - 【公有领域传统事实】星座名与序号、十大行星与古典七曜、相位几何角、四轴定义、
 *    庙旺陷落（domicile / exaltation / detriment / fall）—— 皆为古希腊至中世纪占星
 *    传统（Ptolemy《Tetrabiblos》、阿拉伯占星与 Lilly《Christian Astrology》体系）
 *    的公有领域内容，属事实性映射表，与任何现代实现不构成文本复制。
 *  - 【探针实测】宫位制、容许度数值、字号/符号选择、逆行与落宫口径、时区与夏令时
 *    行为 —— 由 `tools/_probe/astrology/` 下黑盒探针实测旧实现输出后锁定
 *    （只运行旧实现并读其输出，未读其源码），详见各条注释里的实测证据。
 *  - 【本内核采用口径】不属于上述两类的判断（如假想点公式的取舍、行星黄道坐标的
 *    光行时/光行差/交动处理顺序）—— 沿用 Meeus《Astronomical Algorithms》与标准
 *    教科书做法，不宣称唯一流派。
 *
 * 确定性纪律：本文件是纯数据 + 纯函数，`Object.freeze`，零 IO / 零随机 / 零时钟。
 */

/** 黄道十二星座（索引 0 = 白羊座，与黄经 0–30° 对应）。【公有领域传统事实】 */
export const ZODIAC_SIGNS = Object.freeze([
  '白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座',
  '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座',
]);

/** 星座英文名（信息性字段用，与中文名一一对应）。【公有领域传统事实】 */
export const ZODIAC_SIGNS_EN = Object.freeze([
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
]);

/**
 * 星座四元素（三分法）与三形态（四正法）。
 * 元素：火象（白羊/狮子/射手）、土象（金牛/处女/摩羯）、风象（双子/天秤/水瓶）、水象（巨蟹/天蝎/双鱼）。
 * 形态：开创（白羊/巨蟹/天秤/摩羯）、固定（金牛/狮子/天蝎/水瓶）、变动（双子/处女/射手/双鱼）。
 * 【公有领域传统事实】
 */
export const ZODIAC_ELEMENT = Object.freeze([
  '火', '土', '风', '水', '火', '土', '风', '水', '火', '土', '风', '水',
]);
export const ZODIAC_MODALITY = Object.freeze([
  '开创', '固定', '变动', '开创', '固定', '变动', '开创', '固定', '变动', '开创', '固定', '变动',
]);

/** 元素与形态的固定枚举顺序（输出 summary 分组的键序，实测旧实现即此四/三键序）。 */
export const ELEMENT_ORDER = Object.freeze(['火', '土', '风', '水']);
export const MODALITY_ORDER = Object.freeze(['开创', '固定', '变动']);

/**
 * 天体清单与输出顺序。
 * 【探针实测】旧实现 `generateAstrolabe(...).planets` 顺序固定为：
 *   Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto,
 *   Chiron, Ceres, Pallas, Juno, Vesta, North Node, South Node, True Lilith,
 *   Part of Fortune, Part of Spirit（共 20 项）。
 *
 * ⚠️ 本内核**星历覆盖范围**（节151 交付物声明，见报告「未解决差异」）：
 *   可用 astronomia（MIT）自研计算：太阳、月亮、水星、金星、火星、木星、土星、
 *   天王星、海王星、冥王星、北交点、南交点、莉莉丝、福点、精神点 —— 共 15 项。
 *   旧实现还输出凯龙星与四小行星（谷神/智神/婚神/灶神）——这两类需要 Chebyshev
 *   星历数据文件，astronomia 不提供、且许可证审查未过，节151 明确「如非必需可降级
 *   为不展示」。故本内核**不输出**这 5 项，`ASTEROID_DEFERRED` 记录该缺口。
 */
export const BODY_ORDER = Object.freeze([
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
  'Uranus', 'Neptune', 'Pluto',
  'North Node', 'South Node', 'True Lilith', 'Part of Fortune', 'Part of Spirit',
]);

/** 天体英文名 → 中文标签（旧实现 label 字段实测值；传统星名属公有领域事实）。 */
export const BODY_LABELS = Object.freeze({
  Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星',
  Jupiter: '木星', Saturn: '土星', Uranus: '天王星', Neptune: '海王星', Pluto: '冥王星',
  'North Node': '北交点', 'South Node': '南交点', 'True Lilith': '莉莉丝',
  'Part of Fortune': '福点', 'Part of Spirit': '精神点',
});

/**
 * 星历（密级）待办缺口：旧实现输出但本内核暂无星历数据的天体。
 * 处置依据：节151 规格「小行星（谷神/智神/婚神/灶神）如非必需可降级为不展示」。
 * 原因：需要 Chebyshev 级数数据文件（1.5 MB 量级），astronomia 不含，
 *       引入外部星历数据源须先过许可证审查（节151「不引入 Swiss Ephemeris」纪律）。
 */
export const ASTEROID_DEFERRED = Object.freeze([
  { name: 'Chiron', label: '凯龙星', reason: '无许可证合规的小行星/半人马星历数据源' },
  { name: 'Ceres', label: '谷神星', reason: '无许可证合规的小行星星历数据源' },
  { name: 'Pallas', label: '智神星', reason: '无许可证合规的小行星星历数据源' },
  { name: 'Juno', label: '婚神星', reason: '无许可证合规的小行星星历数据源' },
  { name: 'Vesta', label: '灶神星', reason: '无许可证合规的小行星星历数据源' },
]);

/**
 * 逆行判定天体集合。
 * 【探针实测】旧实现 20 天体的 retrograde 字段只有下列 13 项参与真实判定；
 *   太阳、月亮、交点、莉莉丝、福点、精神点恒为 false（实测这些天体随时刻
 *   变化的速率虽为负——交点/精神点——旧实现仍恒 false），四小行星与凯龙星
 *   实测也恒 false（其星历层未做逆行判定）。
 * 【本内核采用口径】对下列天体用「黄经变化率」（中心差分 ±0.5 天）判逆行：
 *   速率 < 0 → 逆行。13 例 × 10 天体实测与旧实现 100% 一致（探针 23）。
 */
export const RETROGRADE_BODIES = Object.freeze([
  'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
  'Uranus', 'Neptune', 'Pluto',
]);

/**
 * 相位表（含小相位）。
 * 【探针实测】旧实现在 1930–2030 抽样输出过且仅输出这 10 种相位，
 *   精确角与符号如下（`aspects[].exactAngle` / `symbol` 实测值）：
 *     合相 ☌ 0°、六合 ⚹ 60°、刑相 □ 90°、拱相 △ 120°、冲相 ☍ 180°、
 *     半六合 ⚺ 30°、五分相 Q 72°、半刑 ∠ 45°、补八分相 ⚼ 135°、倍五分相 bQ 144°。
 *   相位名与符号属公有领域传统记号。
 */
export const ASPECTS = Object.freeze([
  { name: '合相', symbol: '☌', exactAngle: 0, allowedOrb: 8 },
  { name: '六合', symbol: '⚹', exactAngle: 60, allowedOrb: 6 },
  { name: '刑相', symbol: '□', exactAngle: 90, allowedOrb: 7 },
  { name: '拱相', symbol: '△', exactAngle: 120, allowedOrb: 8 },
  { name: '冲相', symbol: '☍', exactAngle: 180, allowedOrb: 8 },
  { name: '半六合', symbol: '⚺', exactAngle: 30, allowedOrb: 2 },
  { name: '半刑', symbol: '∠', exactAngle: 45, allowedOrb: 2 },
  { name: '五分相', symbol: 'Q', exactAngle: 72, allowedOrb: 2 },
  { name: '补八分相', symbol: '⚼', exactAngle: 135, allowedOrb: 2 },
  { name: '倍五分相', symbol: 'bQ', exactAngle: 144, allowedOrb: 2 },
]);

/** 相位名 → 定义（查表用，避免各处重复查找）。 */
export const ASPECT_BY_NAME = Object.freeze(
  Object.fromEntries(ASPECTS.map((a) => [a.name, a])),
);

/**
 * 「紧密程度」分档阈值。
 * 【探针实测】旧实现 `closeness` 取值与 `normalizedOrbRatio = orb / allowedOrb` 的
 *   关系：ratio < 1/3 → 「紧密」；1/3 ≤ ratio < 2/3 → 「中等」；ratio ≥ 2/3 → 「宽松」。
 *   实测样本：0.3475→中等（恰在 1/3 之上）、0.3106→紧密、0.6745→宽松、0.6622→中等。
 * 【本内核采用口径】按上表分档（边界取「严格小于」）。
 */
export const CLOSENESS_BANDS = Object.freeze([
  { maxRatio: 1 / 3, label: '紧密' },
  { maxRatio: 2 / 3, label: '中等' },
  { maxRatio: Infinity, label: '宽松' },
]);

/**
 * 参与相位计算的天体（实测：旧实现把第 3 个下标之后的所有天体两两组合，
 * 包含交点、莉莉丝、福点与精神点）。本内核按 BODY_ORDER 全量组合。
 */
export const ASPECT_BODY_SOURCE = BODY_ORDER;

/**
 * 核心天体的古典庙旺陷落表（essential dignity）。
 * 【探针实测】旧实现 `dignity` / `dignityLabel` 取值反推（探针 21，逐星座取样）：
 *   dignity ∈ {domicile, exaltation, detriment, fall}，标签为
 *   入庙 / 曜升 / 落陷 / 坠落；且**只对古典七曜**（日、月、水、金、火、木、土）赋值，
 *   三王星、交点、莉莉丝、福点等恒无 dignity。
 * 【公有领域传统事实】具体映射（Ptolemy 体系）：
 *   太阳 庙狮子、旺白羊、陷水瓶、弱天秤
 *   月亮 庙巨蟹、旺金牛、陷摩羯、弱天蝎
 *   水星 庙双子/处女、旺处女、陷射手/双鱼、弱双鱼
 *   金星 庙金牛/天秤、旺双鱼、陷白羊/天蝎、弱处女
 *   火星 庙白羊/天蝎、旺摩羯、陷金牛/天秤、弱巨蟹
 *   木星 庙射手/双鱼、旺巨蟹、陷双子/处女、弱摩羯
 *   土星 庙摩羯/水瓶、旺天秤、陷巨蟹/狮子、弱白羊
 * 实测与该表逐条一致（探针 21 输出了全部 12 星座 × 7 曜的命中项）。
 */
export const DIGNITY_TABLE = Object.freeze({
  Sun: { domicile: ['狮子座'], exaltation: ['白羊座'], detriment: ['水瓶座'], fall: ['天秤座'] },
  Moon: { domicile: ['巨蟹座'], exaltation: ['金牛座'], detriment: ['摩羯座'], fall: ['天蝎座'] },
  Mercury: { domicile: ['双子座', '处女座'], exaltation: ['处女座'], detriment: ['射手座', '双鱼座'], fall: ['双鱼座'] },
  Venus: { domicile: ['金牛座', '天秤座'], exaltation: ['双鱼座'], detriment: ['白羊座', '天蝎座'], fall: ['处女座'] },
  Mars: { domicile: ['白羊座', '天蝎座'], exaltation: ['摩羯座'], detriment: ['金牛座', '天秤座'], fall: ['巨蟹座'] },
  Jupiter: { domicile: ['射手座', '双鱼座'], exaltation: ['巨蟹座'], detriment: ['双子座', '处女座'], fall: ['摩羯座'] },
  Saturn: { domicile: ['摩羯座', '水瓶座'], exaltation: ['天秤座'], detriment: ['巨蟹座', '狮子座'], fall: ['白羊座'] },
});

/** 庙旺陷落 → 中文标签（实测旧实现 dignityLabel 取值）。 */
export const DIGNITY_LABELS = Object.freeze({
  domicile: '入庙',
  exaltation: '曜升',
  detriment: '落陷',
  fall: '坠落',
});

/** 四轴定义（顺序实测：上升、天顶、下降、天底）。【公有领域传统事实】 */
export const ANGLE_DEFINITIONS = Object.freeze([
  { name: 'Ascendant', label: '上升', from: 'ascendant' },
  { name: 'Midheaven', label: '天顶', from: 'midheaven' },
  { name: 'Descendant', label: '下降', from: 'ascendant+180' },
  { name: 'Imum Coeli', label: '天底', from: 'midheaven+180' },
]);

/**
 * 宫位制口径：**Placidus（普拉西德）**。
 * 【探针实测】由旧实现 12 宫头反推（探针 9–15）：
 *   H1 = 上升、H10 = 天顶、H4 = MC+180°、H7 = ASC+180°（H7/H4 为严格对宫）；
 *   中间宫（11、12、2、3）满足方程
 *       RA(λ) = RAMC + base + AD(λ)/N
 *   其中 RAMC = 本地恒星时（GMST + 东经，单位度），
 *        AD(λ) = asin(tan φ · tan δ(λ))（该宫头黄经点的黄纬 0 赤纬），
 *        base = 30°(H11) / 60°(H12) / 120°(H2) / 150°(H3)，N = 3, 1.5, 1.5, 3；
 *       H5 = H11+180°、H6 = H12+180°、H8 = H2+180°、H9 = H3+180°。
 *   实测验证（8 组样例含南纬、高纬）：12 宫头 max|Δ| ≤ 0.86 角分。
 * 【本内核采用口径】按上述方程做牛顿迭代求根（收敛到 1e-12 度）。
 *
 * 极区回退 —— 【探针实测】当 |tan φ · tan δ| > 1（Placidus 在半弧上无解，
 *   即出现「极昼/极夜宫位」）时，旧实现在 lat = 67.5° / 1980-12-21 13:00 的样例
 *   输出为 **整宫制（Whole Sign）**：宫头 = 上升所在星座起点的 0° 起，每宫 30°。
 *   样例实测：上升 228.4943°（天蝎座 18°29′）→ 宫头 210/240/270/300/330/0/30/60/90/120/150/180。
 * 【本内核采用口径】同一回退：检测到任一中间宫无解时，整体切到整宫制（Whole Sign）。
 */
export const HOUSE_SYSTEM = Object.freeze({
  id: 'placidus',
  label: '普拉西德（Placidus）',
  fallback: 'whole-sign',
  fallbackLabel: '整宫制（Whole Sign）—— 极区 Placidus 无解时的回退',
});

/** Placidus 中间宫的 (base, divisor) 参数表（唯一权威位置）。 */
export const PLACIDUS_CUSPS = Object.freeze({
  11: { base: 30, divisor: 3 },
  12: { base: 60, divisor: 1.5 },
  2: { base: 120, divisor: 1.5 },
  3: { base: 150, divisor: 3 },
});

/**
 * 落宫口径。
 * 【探针实测】旧实现 `planets[].house` 与宫头的对应关系为
 *   cusp[i] ≤ λ < cusp[i+1]（末宫跨越 360°），逐宫顺序扫描。
 *   5 组样例 × 20 天体实测 0 处不一致（探针 22-B）。
 */
export const HOUSE_ASSIGNMENT = 'cusp-lower-inclusive';

/**
 * 假想点公式（与旧实现实测一致）。
 * - 北交点：**真交点**（瞬时月球轨道升交点）。实测：astronomia `moonposition.trueNode`
 *   在 13 个样例上与旧实现差 ≤ 9.85′（平均 3.7′）；平均交点公式差到 87′，故排除。
 *   另加交动 Δψ（与行星同一「视黄经」口径）。
 * - 南交点 = 北交点 + 180°（实测差值恰为 180.000000）。
 * - 莉莉丝（True Lilith）：旧实现实测**不是平均远地点**（平均远地点公式差到 25°），
 *   其逐日速率在 0.5–3.2°/天之间剧烈波动，符合**密切（osculating）远地点**特征。
 *   ⚠️ 本内核当前采用「月球平均远地点」= `moonposition.perigee(jde) + 180°` + 交动，
 *   与旧实现差异见报告（未解决差异 #3，未纳入关键字段）。这是本内核的**已知缺口**。
 * - 福点 / 精神点：按昼夜区分（实测 4 组样例全部命中）：
 *     日间盘（太阳在地平线上，即第 7–12 宫）：福点 = ASC + 月亮 − 太阳；精神点 = ASC + 太阳 − 月亮
 *     夜间盘（太阳在地平线下，即第 1–6 宫）：福点 = ASC + 太阳 − 月亮；精神点 = ASC + 月亮 − 太阳
 *   （实测证据：1990-05-12 07:30 太阳 H11 → 福点 = ASC+月−日；
 *     1990-05-12 23:30 太阳 H4 → 福点 = ASC+日−月，两式恰好互换。）
 */
export const HYPOTHETICAL_POINTS = Object.freeze({
  northNode: 'true-node',
  lilith: 'mean-apogee',
  fortune: 'day-night-fortune',
  spirit: 'day-night-spirit',
});

/** 昼间盘判定：太阳落宫 7–12（地平线上）。 */
export const DAY_CHART_HOUSES = Object.freeze([7, 8, 9, 10, 11, 12]);

/**
 * 时间口径与历史夏令时。
 * 【探针实测】旧实现把输入的「东八区挂钟时刻 + timezone=8」换算为 UTC 时，
 *   对**中国 1986–1991 年夏令时**做了时区库级的处理：
 *     1985 及以前 / 1992 及以后：自报 UTC = 挂钟时刻 − 8h（如 1990-05-12 07:30 → 前一日 23:30Z）
 *     1986–1991 年：自报 UTC = 挂钟时刻 − 7h（如 1986-05-12 07:30 → 当日 00:30Z，晚 1 小时）
 *   实测证据（探针 20，逐年 07:30 采样）：仅 1986–1991 六个年份的自报 UTC 落在
 *   00:30Z（+1h），其余年份全为 23:30Z；且这六年行星位置整体对应「提前一小时」的时刻。
 * 【本内核采用口径】实现同一张 DST 表（中国 1986–1991 夏令时起止日），保证与旧实现一致。
 *   表来源：中国国务院 1986 年 4 月发布的夏令时规定（每年 4 月中旬首个星期日 02:00 起、
 *   9 月中旬首个星期日 02:00 止），属**公有领域法规内容**；具体日期见 CN_DST_PERIODS。
 */
export const CN_DST_PERIODS = Object.freeze([
  // [起始 UTC 毫秒, 结束 UTC 毫秒)，挂钟按 +9 处理
  ['1986-05-04T02:00+08:00', '1986-09-14T02:00+08:00'],
  ['1987-04-12T02:00+08:00', '1987-09-13T02:00+08:00'],
  ['1988-04-10T02:00+08:00', '1988-09-11T02:00+08:00'],
  ['1989-04-16T02:00+08:00', '1989-09-17T02:00+08:00'],
  ['1990-04-15T02:00+08:00', '1990-09-16T02:00+08:00'],
  ['1991-04-14T02:00+08:00', '1991-09-15T02:00+08:00'],
]);

/** 西式占星使用的国际标准时区基准偏移（本能力固定东八区，见 normalizeInput）。 */
export const DEFAULT_UTC_OFFSET_HOURS = 8;

/** 夏令时生效时的偏移小时数。 */
export const DST_UTC_OFFSET_HOURS = 9;

/** 黄赤交角口径：IAU 1980 平均交角（Meeus 22.2）。【本内核采用口径】 */
export const OBLIQUITY_MODEL = 'IAU1980-mean';

/** 天文单位（km），月球密切轨道计算用。 */
export const AU_KM = 149597870.7;

/** 月球 GM（km³/s²），Meeus 附录。 */
export const MOON_MU_KM3_S2 = 4902.800118;

/** 光行时（天/AU）。 */
export const LIGHT_TIME_DAYS_PER_AU = 0.0057755183;

/** 光行差常数（角秒）。 */
export const ABERRATION_ARCSEC = 20.49552;

/** 精度等级声明（对准星历来源的诚实标注，写入输出 meta）。 */
export const EPHEMERIS_SOURCE = Object.freeze({
  library: 'astronomia@4.2.0',
  license: 'MIT',
  planetaryTheory: 'VSOP87 (full series, series B)',
  lunarTheory: 'ELP2000-82B (astronomia moonposition)',
  pluto: 'astronomia pluto (Meeus ch.37 series)',
  apparentPlace: 'light-time iterate + annual aberration (Meeus 23.2) + nutation Δψ (IAU1980 22-term)',
  note: '不引入 Swiss Ephemeris；无外网请求；星历数据随包（astronomia 自带 VSOP87/ELP 系数表）',
});

export default Object.freeze({
  ZODIAC_SIGNS,
  ZODIAC_SIGNS_EN,
  ZODIAC_ELEMENT,
  ZODIAC_MODALITY,
  ELEMENT_ORDER,
  MODALITY_ORDER,
  BODY_ORDER,
  BODY_LABELS,
  ASTEROID_DEFERRED,
  RETROGRADE_BODIES,
  ASPECTS,
  ASPECT_BY_NAME,
  CLOSENESS_BANDS,
  ASPECT_BODY_SOURCE,
  DIGNITY_TABLE,
  DIGNITY_LABELS,
  ANGLE_DEFINITIONS,
  HOUSE_SYSTEM,
  PLACIDUS_CUSPS,
  HOUSE_ASSIGNMENT,
  HYPOTHETICAL_POINTS,
  DAY_CHART_HOUSES,
  CN_DST_PERIODS,
  DEFAULT_UTC_OFFSET_HOURS,
  DST_UTC_OFFSET_HOURS,
  OBLIQUITY_MODEL,
  EPHEMERIS_SOURCE,
});
