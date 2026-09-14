/**
 * 命理 · 自研排盘内核 · 七政四余规则表（节152 · 单一权威规则源）
 * ===========================================================================
 * 本文件是「七政四余」能力的**唯一权威规则位置**：二十八宿距星目录、十二宫名、
 * 庙旺乐喜表、命主星表、神煞表、四余模型参数、相位表与容许度。
 * 调用方（capabilities / 对拍框架 / 测试）**只读不抄**。
 *
 * 来源标注（README §2 纪律，逐块写明）：
 *  - 【公有领域传统事实】二十八宿名/序与宿曜（角木蛟…轸水蚓）、十二宫名
 *    （命宫/财帛/兄弟/田宅/男女/奴仆/妻妾/疾厄/迁移/官禄/福德/相貌）、地支序、
 *    庙旺乐喜与命主星（七政守宫）体系、神煞（天乙贵人/驿马/劫煞/咸池/华盖/
 *    孤辰/寡宿）口诀 —— 皆为唐宋以来星宗文献（《果老星宗》《星学大成》、
 *    《协纪辨方书》）所载的公有领域内容，属事实性映射表。
 *  - 【SIMBAD 天文目录事实】二十八宿距星 J2000.0 赤经/赤纬/自行 —— SIMBAD 公开
 *    目录数据（公共领域事实），本表数值经旧实现 mansionBoundaries 黑盒输出观测
 *    核对一致（节152 探针 p11 落表）。
 *  - 【对拍实测锁定】庙旺乐喜表（7×12）、命宫/身宫公式、月孛模型口径、相位
 *    容许度与 closeness 分档、神煞取干/取支口径 —— 由 `tools/_probe/qizheng/`
 *    黑盒探针（只运行旧实现并读其输出，未读其源码）实测锁定，与旧实现一致；
 *    其中庙旺乐喜表与部分流通的星宗表不同（如 日/月同庙于戌宫），按对拍口径为准。
 *  - 【本内核采用口径】紫炁《七政算内篇》均速模型（公有领域古法）、罗睺/计都
 *    = 月球轨道升/降交点、月孛 = 月球平均远地点 —— 数学模型本身为公有领域天文
 *    公式，具体参数与历元见本文件 ZIQI_* 常量与注释。
 *
 * 确定性纪律：纯数据 + 纯函数，`Object.freeze`，零 IO / 零随机 / 零时钟。
 */

/** 十二地支（索引 0=子）。【公有领域传统事实】 */
export const BRANCHES = Object.freeze(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);

/** 十天干（索引 0=甲）。【公有领域传统事实】 */
export const STEMS = Object.freeze(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']);

/**
 * 黄道宫 → 地支宫（戌宫 = 白羊 0°，逆序排布，果老星宗口径）。
 * 【对拍实测】signIndex 0(白羊)=戌、1(金牛)=酉、…、11(双鱼)=亥，
 *   即 branchIndex = (10 − signIndex + 12) % 12。旧实现 stars[].signBranch
 *   与 twelvePalaces[].signBranch 均按此映射（探针 p1/p4 全部一致）。
 */
export function signBranchOf(signIndex) {
  return BRANCHES[(10 - signIndex + 12) % 12];
}

/** 十二宫名（固定序；宫位 = twelvePalaces[signIndex]，即 signIndex 相同的条目）。【公有领域传统事实】 */
export const TWELVE_PALACE_NAMES = Object.freeze([
  '命宫', '财帛', '兄弟', '田宅', '男女', '奴仆', '妻妾', '疾厄', '迁移', '官禄', '福德', '相貌',
]);

/**
 * 命主星：黄道宫的传统守宫主（七政之一：日/月/水/金/火/木/土）。
 * 【对拍实测】mingZhu = 命宫所在黄道宫的守宫主，14 条探针全部一致：
 *   白羊→火、金牛→金、双子→水、巨蟹→月、狮子→日、处女→水、天秤→金、
 *   天蝎→火、射手→木、摩羯→土、水瓶→土、双鱼→木。
 * 【公有领域传统事实】七政守宫体系（与西方古典入庙对应，星宗用语为「宫主」）。
 */
export const RULER_OF_SIGN = Object.freeze(['火', '金', '水', '月', '日', '水', '金', '火', '木', '土', '土', '木']);

/**
 * 庙旺乐喜表（7 政 × 黄道宫）。
 * 【对拍实测锁定】每条 = 该星的庙/旺/乐/喜落宫集合；任一集合命中即叠加其标签，
 *   组合顺序固定 庙/旺/乐/喜，全不命中输出「平」；四余输出「—」。
 *   34 条跨年代探针 + 13 个定点补格探针覆盖全部 7×12 格（探针 p4/p5/p6/p10）。
 *   注：该表与部分流通星宗庙旺表不同（如 日、月同庙于戌宫），以对拍口径为准。
 */
export const DIGNITY_TABLE = Object.freeze({
  太阳: Object.freeze({ miao: Object.freeze([0]), wang: Object.freeze([5]), le: Object.freeze([4]), xi: Object.freeze([8]) }),
  太阴: Object.freeze({ miao: Object.freeze([0]), wang: Object.freeze([1]), le: Object.freeze([3]), xi: Object.freeze([11]) }),
  '辰星(水)': Object.freeze({ miao: Object.freeze([4]), wang: Object.freeze([5, 10]), le: Object.freeze([2, 5]), xi: Object.freeze([6]) }),
  '太白(金)': Object.freeze({ miao: Object.freeze([6]), wang: Object.freeze([4, 11]), le: Object.freeze([1, 6]), xi: Object.freeze([]) }),
  '荧惑(火)': Object.freeze({ miao: Object.freeze([7]), wang: Object.freeze([9]), le: Object.freeze([0, 7]), xi: Object.freeze([2]) }),
  '岁星(木)': Object.freeze({ miao: Object.freeze([11]), wang: Object.freeze([3, 11]), le: Object.freeze([8, 11]), xi: Object.freeze([3]) }),
  '镇星(土)': Object.freeze({ miao: Object.freeze([9]), wang: Object.freeze([6, 7]), le: Object.freeze([9, 10]), xi: Object.freeze([4]) }),
});

/** 庙旺乐喜标签顺序（组合时拼接用）。 */
export const DIGNITY_GRADE_ORDER = Object.freeze(['miao', 'wang', 'le', 'xi']);
export const DIGNITY_GRADE_LABELS = Object.freeze({ miao: '庙', wang: '旺', le: '乐', xi: '喜' });

/**
 * 二十八宿距星 J2000.0 目录（SIMBAD 事实数据）。
 * 顺序按黄道升序：壁…室（与旧实现 mansionBoundaries 输出同序，探针 p11 核对）。
 * 宿曜（sevenStar）= 二十八宿禽星表的七曜归属：【公有领域传统事实】
 *   角木蛟、亢金龙、氐土貉、房日兔、心月狐、尾火虎、箕水豹、斗木獬、牛金牛、
 *   女土蝠、虚日鼠、危月燕、室火猪、壁水貐、奎木狼、娄金狗、胃土雉、昴日鸡、
 *   毕月乌、觜火猴、参水猿、井木犴、鬼金羊、柳土獐、星日马、张月鹿、翼火蛇、
 *   轸水蚓。
 * 坐标/自行字段：raJ2000/decJ2000 单位度，pmRa/pmDec 单位 mas/yr（pmRa 为 μα*）。
 */
export const MANSION_STARS = Object.freeze([
  { mansion: '壁', chineseName: '壁宿一', raJ2000: 3.308968120905, decJ2000: 15.183598429594, pmRa: 0.492, pmDec: -10.73, sevenStar: '水' },
  { mansion: '奎', chineseName: '奎宿一', raJ2000: 14.301667830111, decJ2000: 23.417650023124, pmRa: -43.008, pmDec: -45.254, sevenStar: '木' },
  { mansion: '娄', chineseName: '娄宿一', raJ2000: 28.660045788845, decJ2000: 20.808031471916, pmRa: 98.74, pmDec: -110.41, sevenStar: '金' },
  { mansion: '胃', chineseName: '胃宿一', raJ2000: 40.8629761644, decJ2000: 27.70714940929, pmRa: 8.502, pmDec: -11.433, sevenStar: '土' },
  { mansion: '昴', chineseName: '昴宿一', raJ2000: 56.218904540788, decJ2000: 24.11333785002, pmRa: 20.542, pmDec: -46.081, sevenStar: '日' },
  { mansion: '毕', chineseName: '毕宿一', raJ2000: 67.154167729665, decJ2000: 19.180434205814, pmRa: 107.526, pmDec: -36.2, sevenStar: '月' },
  { mansion: '觜', chineseName: '觜宿一', raJ2000: 83.784490021032, decJ2000: 9.934155874167, pmRa: -0.34, pmDec: -2.94, sevenStar: '火' },
  { mansion: '参', chineseName: '参宿一', raJ2000: 85.189694427931, decJ2000: -1.942573585972, pmRa: 3.19, pmDec: 2.03, sevenStar: '水' },
  { mansion: '井', chineseName: '井宿一', raJ2000: 95.740111926196, decJ2000: 22.513582745904, pmRa: 56.39, pmDec: -110.03, sevenStar: '木' },
  { mansion: '鬼', chineseName: '鬼宿一', raJ2000: 127.89887483425, decJ2000: 18.09441817296, pmRa: -59.639, pmDec: -56.615, sevenStar: '金' },
  { mansion: '柳', chineseName: '柳宿一', raJ2000: 129.41403113663, decJ2000: 5.70378776223, pmRa: -68.867, pmDec: -7.551, sevenStar: '土' },
  { mansion: '星', chineseName: '星宿一', raJ2000: 141.896844595859, decJ2000: -8.658599531746, pmRa: -15.23, pmDec: 34.37, sevenStar: '日' },
  { mansion: '张', chineseName: '张宿一', raJ2000: 147.869479078842, decJ2000: -14.846628713347, pmRa: 31.037, pmDec: -26.862, sevenStar: '月' },
  { mansion: '翼', chineseName: '翼宿一', raJ2000: 164.943604815762, decJ2000: -18.298786220616, pmRa: -462.303, pmDec: 128.614, sevenStar: '火' },
  { mansion: '轸', chineseName: '轸宿一', raJ2000: 183.951545037377, decJ2000: -17.541930457603, pmRa: -158.61, pmDec: 21.86, sevenStar: '水' },
  { mansion: '角', chineseName: '角宿一', raJ2000: 201.298247361563, decJ2000: -11.161319485112, pmRa: -42.35, pmDec: -30.67, sevenStar: '木' },
  { mansion: '亢', chineseName: '亢宿一', raJ2000: 213.223936885957, decJ2000: -10.273703461482, pmRa: 6.674, pmDec: 138.987, sevenStar: '金' },
  { mansion: '氐', chineseName: '氐宿一', raJ2000: 222.71963789158, decJ2000: -16.041776519834, pmRa: -105.68, pmDec: -68.4, sevenStar: '土' },
  { mansion: '房', chineseName: '房宿一', raJ2000: 239.712971824167, decJ2000: -26.114107945, pmRa: -11.42, pmDec: -26.83, sevenStar: '日' },
  { mansion: '心', chineseName: '心宿一', raJ2000: 245.297148805833, decJ2000: -25.592792076667, pmRa: -10.6, pmDec: -16.28, sevenStar: '月' },
  { mansion: '尾', chineseName: '尾宿一', raJ2000: 252.96761814529, decJ2000: -38.047399464, pmRa: -10.451, pmDec: -18.315, sevenStar: '火' },
  { mansion: '箕', chineseName: '箕宿一', raJ2000: 271.452033745, decJ2000: -30.424089849444, pmRa: -48.839, pmDec: -204.86, sevenStar: '水' },
  { mansion: '斗', chineseName: '斗宿一', raJ2000: 281.414123094121, decJ2000: -26.990782645111, pmRa: 49.919, pmDec: -0.09, sevenStar: '木' },
  { mansion: '牛', chineseName: '牛宿一', raJ2000: 305.25277749238, decJ2000: -14.78140760208, pmRa: 44.133, pmDec: 0.36, sevenStar: '金' },
  { mansion: '女', chineseName: '女宿一', raJ2000: 311.918956553417, decJ2000: -9.495776926901, pmRa: 33.923, pmDec: -34.936, sevenStar: '土' },
  { mansion: '虚', chineseName: '虚宿一', raJ2000: 322.889716983479, decJ2000: -5.571174828064, pmRa: 19.214, pmDec: -8.163, sevenStar: '日' },
  { mansion: '危', chineseName: '危宿一', raJ2000: 331.445981440948, decJ2000: -0.319850955424, pmRa: 18.59, pmDec: -10.45, sevenStar: '月' },
  { mansion: '室', chineseName: '室宿一', raJ2000: 346.190222691426, decJ2000: 15.205267147928, pmRa: 60.4, pmDec: -41.3, sevenStar: '火' },
]);

/**
 * 神煞表。
 * 【对拍实测】天乙贵人按**日干**（晚子时 23:00 起换日，取换日后日干）；
 * 其余六煞按**年支**（年干支按立春精确时刻换年）。14 条跨年代探针全部一致。
 * 传统口诀为公有领域俗传（《协纪辨方书》/《三命通会》）。
 */
export const SHENSHA = Object.freeze({
  /** 天乙贵人（日干 → 双支）。口诀：甲戊庚牛羊、乙己鼠猴乡、丙丁猪鸡位、壬癸兔蛇藏、六辛逢马虎。 */
  tianYi: Object.freeze({
    甲: '丑未', 戊: '丑未', 庚: '丑未',
    乙: '子申', 己: '子申',
    丙: '亥酉', 丁: '亥酉',
    壬: '卯巳', 癸: '卯巳',
    辛: '寅午',
  }),
  /** 驿马（年支三合局 → 马星）。口诀：申子辰马在寅、寅午戌马在申、巳酉丑马在亥、亥卯未马在巳。 */
  yiMa: Object.freeze({ 寅: '申', 午: '申', 戌: '申', 申: '寅', 子: '寅', 辰: '寅', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' }),
  /** 劫煞。口诀：申子辰劫在巳、寅午戌劫在亥、巳酉丑劫在寅、亥卯未劫在申。 */
  jieSha: Object.freeze({ 寅: '亥', 午: '亥', 戌: '亥', 申: '巳', 子: '巳', 辰: '巳', 巳: '寅', 酉: '寅', 丑: '寅', 亥: '申', 卯: '申', 未: '申' }),
  /** 咸池（桃花）。口诀：申子辰见酉、寅午戌见卯、巳酉丑见午、亥卯未见子。 */
  xianChi: Object.freeze({ 寅: '卯', 午: '卯', 戌: '卯', 申: '酉', 子: '酉', 辰: '酉', 巳: '午', 酉: '午', 丑: '午', 亥: '子', 卯: '子', 未: '子' }),
  /** 华盖。口诀：申子辰见辰、寅午戌见戌、巳酉丑见丑、亥卯未见未。 */
  huaGai: Object.freeze({ 寅: '戌', 午: '戌', 戌: '戌', 申: '辰', 子: '辰', 辰: '辰', 巳: '丑', 酉: '丑', 丑: '丑', 亥: '未', 卯: '未', 未: '未' }),
  /** 孤辰（年支三会局 → 孤辰）。口诀：寅卯辰孤在巳、巳午未孤在申、申酉戌孤在亥、亥子丑孤在寅。 */
  guChen: Object.freeze({ 寅: '巳', 卯: '巳', 辰: '巳', 巳: '申', 午: '申', 未: '申', 申: '亥', 酉: '亥', 戌: '亥', 亥: '寅', 子: '寅', 丑: '寅' }),
  /** 寡宿。口诀：寅卯辰寡在丑、巳午未寡在辰、申酉戌寡在未、亥子丑寡在戌。 */
  guaSu: Object.freeze({ 寅: '丑', 卯: '丑', 辰: '丑', 巳: '辰', 午: '辰', 未: '辰', 申: '未', 酉: '未', 戌: '未', 亥: '戌', 子: '戌', 丑: '戌' }),
});

/**
 * 相位表（五相）。
 * 【对拍实测】旧实现 aspects 仅输出这 5 种：同宫 0°(容许 8°)、六合 60°(4°)、
 * 四正 90°(6°)、三方 120°(6°)、对照 180°(8°)。角与容许度取自星宗传统
 * （公有领域），容许度数值为对拍实测。
 */
export const ASPECTS = Object.freeze([
  { name: '同宫', exactAngle: 0, allowedOrb: 8 },
  { name: '六合', exactAngle: 60, allowedOrb: 4 },
  { name: '四正', exactAngle: 90, allowedOrb: 6 },
  { name: '三方', exactAngle: 120, allowedOrb: 6 },
  { name: '对照', exactAngle: 180, allowedOrb: 8 },
]);

/** closeness 分档（按 orb/allowedOrb 比值）。【对拍实测】< 1/3 紧密、< 2/3 中等、其余 宽松（探针 p5/p6）。 */
export const CLOSENESS_BANDS = Object.freeze([
  { maxRatio: 1 / 3, label: '紧密' },
  { maxRatio: 2 / 3, label: '中等' },
  { maxRatio: Infinity, label: '宽松' },
]);

/** 七政四余输出序：七政 + 四余。【公有领域传统事实】 */
export const STAR_ORDER = Object.freeze([
  '太阳', '太阴', '辰星(水)', '太白(金)', '荧惑(火)', '岁星(木)', '镇星(土)',
  '罗睺(火余)', '计都(土余)', '月孛(水余)', '紫炁(木余)',
]);

/** 七政 → 星历天体键。 */
export const STAR_BODY_KEY = Object.freeze({
  太阳: 'Sun', 太阴: 'Moon', '辰星(水)': 'Mercury', '太白(金)': 'Venus',
  '荧惑(火)': 'Mars', '岁星(木)': 'Jupiter', '镇星(土)': 'Saturn',
});

/**
 * 紫炁《七政算内篇》古法均速模型（【公有领域古法】；参数为对拍实测锁定）。
 * 回归黄经 = 归一化(237.038993° + 距 1995-12-31T00:00:00Z 日数 × 360°/10227.1792日)。
 * 周期 10227.1792 日 ≈ 28 年（每日 0.0352003219° ≈ 二十八日一度）。
 * 历元 1995-12-31T00:00:00.000Z 与初值 237.038993° 由旧实现 ziqiModel 黑盒输出
 * 观测核对一致（探针 p1/p3）。
 */
export const ZIQI_MODEL = Object.freeze({
  epochUtcMs: Date.UTC(1995, 11, 31), // 1995-12-31T00:00:00.000Z
  epochLongitudeDeg: 237.038993,
  periodDays: 10227.1792,
});

/**
 * 二十八宿宿界 = 距星目标日期真黄经至下一距星真黄经的实际弧段。
 * 宿界随岁差/自行逐年移动（探针 p3 实测：壁宿界 1905 年 7.8332° → 2024 年 9.4907°），
 * 故宿界必须在每个目标日期由 MANSION_STARS 目录重新换算，不能使用固定表。
 */
export const XIU_RULE = Object.freeze({
  id: 'qizheng-mansion-stars-catalog-date-aware',
  boundarySource: '二十八宿距星 SIMBAD 目录 + 目标日期真黄经（IAU 1976 岁差 + IAU 1980 章动，自研换算；与旧实现 Astronomy Engine 的 IAU 2006/IAU 2000B 换算差 ≤ 20″）',
  xiuTest: '黄经落入 [start, start+width) 即属该宿；xiuDegree = 黄经 − start',
});

export default Object.freeze({
  BRANCHES, STEMS, signBranchOf, TWELVE_PALACE_NAMES, RULER_OF_SIGN,
  DIGNITY_TABLE, DIGNITY_GRADE_ORDER, DIGNITY_GRADE_LABELS,
  MANSION_STARS, SHENSHA, ASPECTS, CLOSENESS_BANDS,
  STAR_ORDER, STAR_BODY_KEY, ZIQI_MODEL, XIU_RULE,
});
