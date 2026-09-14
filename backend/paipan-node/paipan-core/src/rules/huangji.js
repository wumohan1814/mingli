/**
 * 命理 · 自研排盘内核 · 单一权威规则源 · 皇极经世
 * ---------------------------------------------------------------------------
 * 「单一权威规则源」纪律（见 README §2）：本文件是「皇极经世」的唯一权威规则
 * 位置。调用方只能读不能抄。
 *
 * == 口径来源（三条，逐条标注）==
 * 1. 古典依据（公有领域古籍，公网可查）：
 *    - 《皇极经世》（北宋·邵雍）：「元会运世」纪年体系（1元=12会=360运=4320世=
 *      129600年）、卦气推演。公网镜像：
 *      https://zh.wikisource.org/wiki/皇極經世
 *    - 《皇极经世书解》（明·黄畿）：「分形同构」年月日时推衍法（本内核 datetime
 *      层所复现的「黄畿分形同构」口径，模型名与其一致）。
 *    - 《周易》卦辞爻辞原文：复用 src/rules/zhouyi-texts.js（公有领域，公网采源，
 *      出处见该文件头）。
 * 2. 对拍实测与旧实现（vendored 第三方引擎，黑盒运行）一致：见
 *    tools/_probe/huangji/ 的探针与拟合脚本（huangji-data.json 79 行、
 *    huangji-years.json 160 行、huangji-allyun.json 2160 行、huangji-datetime-dense.json
 *    401 行；元会运世坐标、六十卦表、黄畿四层卦全部逐项拟合全绿）。
 * 3. 无星历依赖：皇极历法为纯历法数学（元会运世 + 二十四节气映射为 15 皇极日），
 *    不依赖任何天文星历。
 *
 * == 已锁定的口径（黑盒实测）==
 * - 上元甲子积年起点 = 公元前 67017 年（公元纪年无 0 年；-67017 为上元）。
 * - 无 0 年计数：任意两公元年份之间的年数需跳过「0」年；跨度含 0 时 −1。
 * - elapsedYears（自起点以来已完整经过的年数）：Y>0 → Y+67016；Y<0 → Y+67017。
 * - 元会运世坐标：index 均 1 起算；元=floor(elapsed/129600)+1 … 世=floor(elapsed/30)+1，
 *   各级「入级年序」= elapsed − (index−1)×级别年数。
 * - 值年卦：先天圆图 60 卦序（W60，剔四正卦 乾坤坎离，见 HUANGJI_YEAR_CYCLE），
 *   1984（甲子）锚定「鼎」；每 60 年一「六十卦块」，块首卦 = 运卦变爻（行号 = 块序），
 *   年内逐岁沿 W60 顺进。
 * - 统卦（2160 年）：W60[(28 + 元内 2160 块序) mod 60]（复 起于块 0）。
 * - 运卦（360 年）= 统卦 变（运在统卦块内序）爻；六十卦（60 年）= 运卦对应的
 *   「运卦×块序 → 卦」64×6 查表（HUANGJI_SIXTY_TABLE，黑盒实测逐项落表）；
 *   十年卦（10 年）= 六十卦 变（十块在六十年内序）爻。
 * - 年干支：index = (Y − 1984 + (Y ≤ 0 ? 1 : 0)) mod 60。
 * - 黄畿 datetime 层（以冬至为年界，每节气映射为 15 皇极日，超出 15 取 15）：
 *   月序 = 冬至起第 k 个中气（冬至=1 … 小雪=12）；月支 = 地支[月序−1]；
 *   doy = (节气序−1)×15 + 当气日序（节气序自冬至起 1..24）；
 *   dom = (当气在月内位置−1)×15 + 当日序；时段 = floor(时/4)+1。
 *   月卦 = 年卦 变 ceil(月序/2) 爻；旬纬卦 = 月卦 变 (ceil(日/10) + 月序偶?3:0) 爻；
 *   日卦 = W60[(月卦在 W60 位 + ((月序−1)×30 + 日−1) mod 60) mod 60]；
 *   时卦 = 日卦 变 时段 爻。互/错/综 = 标准互卦/错卦/综卦。
 *
 * 纪律：零依赖、零 IO、零网络、零随机、零「当前时间」。纯数据 + 纯函数。
 */

/** 太乙式 16 圆盘/地支（与 taiyi 共用语义，此处独立列出以免跨文件耦合）。 */
export const HUANGJI_ZHI = Object.freeze(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);
export const HUANGJI_GAN = Object.freeze(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']);

/** 上元积年起点（公元 -67017 年）。 */
export const HUANGJI_EPOCH_YEAR = -67017;
/** 值年卦锚点：1984（甲子）→ 鼎。 */
export const HUANGJI_ANCHOR_YEAR = 1984;
export const HUANGJI_ANCHOR_HEXAGRAM = '鼎';

/** 64 卦表（王弼序 id 1–64）：id, name, shortName, symbol, upper, lower。公有领域。 */
export const HUANGJI_HEXAGRAMS = Object.freeze([
  Object.freeze({ id: 1, name: '乾为天', shortName: '乾', symbol: '☰☰', upper: '乾', lower: '乾' }),
  Object.freeze({ id: 2, name: '坤为地', shortName: '坤', symbol: '☷☷', upper: '坤', lower: '坤' }),
  Object.freeze({ id: 3, name: '水雷屯', shortName: '屯', symbol: '☵☳', upper: '坎', lower: '震' }),
  Object.freeze({ id: 4, name: '山水蒙', shortName: '蒙', symbol: '☶☵', upper: '艮', lower: '坎' }),
  Object.freeze({ id: 5, name: '水天需', shortName: '需', symbol: '☵☰', upper: '坎', lower: '乾' }),
  Object.freeze({ id: 6, name: '天水讼', shortName: '讼', symbol: '☰☵', upper: '乾', lower: '坎' }),
  Object.freeze({ id: 7, name: '地水师', shortName: '师', symbol: '☷☵', upper: '坤', lower: '坎' }),
  Object.freeze({ id: 8, name: '水地比', shortName: '比', symbol: '☵☷', upper: '坎', lower: '坤' }),
  Object.freeze({ id: 9, name: '风天小畜', shortName: '小畜', symbol: '☴☰', upper: '巽', lower: '乾' }),
  Object.freeze({ id: 10, name: '天泽履', shortName: '履', symbol: '☰☱', upper: '乾', lower: '兑' }),
  Object.freeze({ id: 11, name: '地天泰', shortName: '泰', symbol: '☷☰', upper: '坤', lower: '乾' }),
  Object.freeze({ id: 12, name: '天地否', shortName: '否', symbol: '☰☷', upper: '乾', lower: '坤' }),
  Object.freeze({ id: 13, name: '天火同人', shortName: '同人', symbol: '☰☲', upper: '乾', lower: '离' }),
  Object.freeze({ id: 14, name: '火天大有', shortName: '大有', symbol: '☲☰', upper: '离', lower: '乾' }),
  Object.freeze({ id: 15, name: '地山谦', shortName: '谦', symbol: '☷☶', upper: '坤', lower: '艮' }),
  Object.freeze({ id: 16, name: '雷地豫', shortName: '豫', symbol: '☳☷', upper: '震', lower: '坤' }),
  Object.freeze({ id: 17, name: '泽雷随', shortName: '随', symbol: '☱☳', upper: '兑', lower: '震' }),
  Object.freeze({ id: 18, name: '山风蛊', shortName: '蛊', symbol: '☶☴', upper: '艮', lower: '巽' }),
  Object.freeze({ id: 19, name: '地泽临', shortName: '临', symbol: '☷☱', upper: '坤', lower: '兑' }),
  Object.freeze({ id: 20, name: '风地观', shortName: '观', symbol: '☴☷', upper: '巽', lower: '坤' }),
  Object.freeze({ id: 21, name: '火雷噬嗑', shortName: '噬嗑', symbol: '☲☳', upper: '离', lower: '震' }),
  Object.freeze({ id: 22, name: '山火贲', shortName: '贲', symbol: '☶☲', upper: '艮', lower: '离' }),
  Object.freeze({ id: 23, name: '山地剥', shortName: '剥', symbol: '☶☷', upper: '艮', lower: '坤' }),
  Object.freeze({ id: 24, name: '地雷复', shortName: '复', symbol: '☷☳', upper: '坤', lower: '震' }),
  Object.freeze({ id: 25, name: '天雷无妄', shortName: '无妄', symbol: '☰☳', upper: '乾', lower: '震' }),
  Object.freeze({ id: 26, name: '山天大畜', shortName: '大畜', symbol: '☶☰', upper: '艮', lower: '乾' }),
  Object.freeze({ id: 27, name: '山雷颐', shortName: '颐', symbol: '☶☳', upper: '艮', lower: '震' }),
  Object.freeze({ id: 28, name: '泽风大过', shortName: '大过', symbol: '☱☴', upper: '兑', lower: '巽' }),
  Object.freeze({ id: 29, name: '坎为水', shortName: '坎', symbol: '☵☵', upper: '坎', lower: '坎' }),
  Object.freeze({ id: 30, name: '离为火', shortName: '离', symbol: '☲☲', upper: '离', lower: '离' }),
  Object.freeze({ id: 31, name: '泽山咸', shortName: '咸', symbol: '☱☶', upper: '兑', lower: '艮' }),
  Object.freeze({ id: 32, name: '雷风恒', shortName: '恒', symbol: '☳☴', upper: '震', lower: '巽' }),
  Object.freeze({ id: 33, name: '天山遁', shortName: '遁', symbol: '☰☶', upper: '乾', lower: '艮' }),
  Object.freeze({ id: 34, name: '雷天大壮', shortName: '大壮', symbol: '☳☰', upper: '震', lower: '乾' }),
  Object.freeze({ id: 35, name: '火地晋', shortName: '晋', symbol: '☲☷', upper: '离', lower: '坤' }),
  Object.freeze({ id: 36, name: '地火明夷', shortName: '明夷', symbol: '☷☲', upper: '坤', lower: '离' }),
  Object.freeze({ id: 37, name: '风火家人', shortName: '家人', symbol: '☴☲', upper: '巽', lower: '离' }),
  Object.freeze({ id: 38, name: '火泽睽', shortName: '睽', symbol: '☲☱', upper: '离', lower: '兑' }),
  Object.freeze({ id: 39, name: '水山蹇', shortName: '蹇', symbol: '☵☶', upper: '坎', lower: '艮' }),
  Object.freeze({ id: 40, name: '雷水解', shortName: '解', symbol: '☳☵', upper: '震', lower: '坎' }),
  Object.freeze({ id: 41, name: '山泽损', shortName: '损', symbol: '☶☱', upper: '艮', lower: '兑' }),
  Object.freeze({ id: 42, name: '风雷益', shortName: '益', symbol: '☴☳', upper: '巽', lower: '震' }),
  Object.freeze({ id: 43, name: '泽天夬', shortName: '夬', symbol: '☱☰', upper: '兑', lower: '乾' }),
  Object.freeze({ id: 44, name: '天风姤', shortName: '姤', symbol: '☰☴', upper: '乾', lower: '巽' }),
  Object.freeze({ id: 45, name: '泽地萃', shortName: '萃', symbol: '☱☷', upper: '兑', lower: '坤' }),
  Object.freeze({ id: 46, name: '地风升', shortName: '升', symbol: '☷☴', upper: '坤', lower: '巽' }),
  Object.freeze({ id: 47, name: '泽水困', shortName: '困', symbol: '☱☵', upper: '兑', lower: '坎' }),
  Object.freeze({ id: 48, name: '水风井', shortName: '井', symbol: '☵☴', upper: '坎', lower: '巽' }),
  Object.freeze({ id: 49, name: '泽火革', shortName: '革', symbol: '☱☲', upper: '兑', lower: '离' }),
  Object.freeze({ id: 50, name: '火风鼎', shortName: '鼎', symbol: '☲☴', upper: '离', lower: '巽' }),
  Object.freeze({ id: 51, name: '震为雷', shortName: '震', symbol: '☳☳', upper: '震', lower: '震' }),
  Object.freeze({ id: 52, name: '艮为山', shortName: '艮', symbol: '☶☶', upper: '艮', lower: '艮' }),
  Object.freeze({ id: 53, name: '风山渐', shortName: '渐', symbol: '☴☶', upper: '巽', lower: '艮' }),
  Object.freeze({ id: 54, name: '雷泽归妹', shortName: '归妹', symbol: '☳☱', upper: '震', lower: '兑' }),
  Object.freeze({ id: 55, name: '雷火丰', shortName: '丰', symbol: '☳☲', upper: '震', lower: '离' }),
  Object.freeze({ id: 56, name: '火山旅', shortName: '旅', symbol: '☲☶', upper: '离', lower: '艮' }),
  Object.freeze({ id: 57, name: '巽为风', shortName: '巽', symbol: '☴☴', upper: '巽', lower: '巽' }),
  Object.freeze({ id: 58, name: '兑为泽', shortName: '兑', symbol: '☱☱', upper: '兑', lower: '兑' }),
  Object.freeze({ id: 59, name: '风水涣', shortName: '涣', symbol: '☴☵', upper: '巽', lower: '坎' }),
  Object.freeze({ id: 60, name: '水泽节', shortName: '节', symbol: '☵☱', upper: '坎', lower: '兑' }),
  Object.freeze({ id: 61, name: '风泽中孚', shortName: '中孚', symbol: '☴☱', upper: '巽', lower: '兑' }),
  Object.freeze({ id: 62, name: '雷山小过', shortName: '小过', symbol: '☳☶', upper: '震', lower: '艮' }),
  Object.freeze({ id: 63, name: '水火既济', shortName: '既济', symbol: '☵☲', upper: '坎', lower: '离' }),
  Object.freeze({ id: 64, name: '火水未济', shortName: '未济', symbol: '☲☵', upper: '离', lower: '坎' }),
]);

/** 四正卦（值年卦 60 序中剔除）。 */
export const HUANGJI_FOUR_CORRECT = Object.freeze(new Set(['乾', '坤', '坎', '离']));

/**
 * 先天圆图 60 卦值年序（剔四正卦；1984 甲子锚定 鼎 = index 0）。
 * 黑盒实测：年卦自 鼎 起，顺 W60，剥→复、夬→姤 两处为圆图对极跳转。
 */
export const HUANGJI_YEAR_CYCLE = Object.freeze([
  '鼎', '恒', '巽', '井', '蛊', '升', '讼', '困', '未济', '解', '涣', '蒙', '师', '遁', '咸', '旅',
  '小过', '渐', '蹇', '艮', '谦', '否', '萃', '晋', '豫', '观', '比', '剥', '复', '颐', '屯', '益',
  '震', '噬嗑', '随', '无妄', '明夷', '贲', '既济', '家人', '丰', '革', '同人', '临', '损', '节',
  '中孚', '归妹', '睽', '兑', '履', '泰', '大畜', '需', '小畜', '大壮', '大有', '夬', '姤', '大过',
]);

/** 值年卦序索引（卦名 → W60 位置 0..59）。 */
export const HUANGJI_CYCLE_INDEX = Object.freeze(
  Object.fromEntries(HUANGJI_YEAR_CYCLE.map((name, i) => [name, i])),
);

/** 64 卦「短名 → 卦对象」与「id → 卦对象」索引。 */
export const HUANGJI_BY_NAME = Object.freeze(Object.fromEntries(HUANGJI_HEXAGRAMS.map((h) => [h.shortName, h])));
export const HUANGJI_BY_ID = Object.freeze(Object.fromEntries(HUANGJI_HEXAGRAMS.map((h) => [h.id, h])));

/** 上卦+下卦（短名组合）→ id。 */
export const HUANGJI_BY_UPPER_LOWER = Object.freeze(
  Object.fromEntries(HUANGJI_HEXAGRAMS.map((h) => [`${h.upper}${h.lower}`, h.id])),
);

/** 三爻编码（bit0=下爻，bit2=上爻；阳=1，阴=0）。数值 = bit0 + bit1×2 + bit2×4。 */
export const HUANGJI_TRIGRAM_BITS = Object.freeze({ 乾: 7, 兑: 3, 离: 5, 震: 1, 巽: 6, 坎: 2, 艮: 4, 坤: 0 });

/**
 * 六十卦表（运卦 × 60块序 0..5 → 六十卦短名；黑盒实测 2160 行逐项一致）。
 * 键为「运卦短名」，值为 6 元素数组。
 */
export const HUANGJI_SIXTY_TABLE = Object.freeze({
  中孚: ['涣', '益', '小畜', '履', '损', '节'], 丰: ['小过', '大壮', '震', '明夷', '革', '革'],
  临: ['师', '复', '泰', '归妹', '节', '损'], 乾: ['姤', '同人', '履', '小畜', '大有', '夬'],
  井: ['需', '蹇', '蒙', '大过', '升', '巽'], 兑: ['困', '随', '夬', '节', '归妹', '履'],
  剥: ['颐', '蒙', '艮', '晋', '观', '复'], 升: ['泰', '谦', '师', '恒', '井', '蛊'],
  同人: ['遁', '姤', '无妄', '家人', '革', '革'], 否: ['无妄', '讼', '遁', '观', '晋', '萃'],
  咸: ['革', '大过', '萃', '蹇', '小过', '遁'], 噬嗑: ['晋', '睽', '革', '颐', '无妄', '震'],
  困: ['兑', '萃', '大过', '蒙', '解', '讼'], 坎: ['节', '比', '井', '困', '师', '涣'],
  坤: ['复', '师', '谦', '豫', '比', '剥'], 复: ['复', '临', '明夷', '震', '屯', '颐'],
  大壮: ['恒', '丰', '归妹', '泰', '夬', '大有'], 大有: ['鼎', '革', '睽', '大畜', '姤', '大壮'],
  大畜: ['蛊', '贲', '损', '大有', '小畜', '泰'], 大过: ['夬', '咸', '困', '井', '恒', '姤'],
  夬: ['大过', '革', '兑', '需', '大壮', '姤'], 姤: ['姤', '遁', '讼', '巽', '鼎', '大过'],
  家人: ['渐', '小畜', '益', '同人', '贲', '既济'], 小畜: ['巽', '家人', '中孚', '姤', '大畜', '需'],
  小过: ['丰', '恒', '豫', '谦', '咸', '旅'], 履: ['讼', '无妄', '姤', '中孚', '睽', '兑'],
  屯: ['比', '节', '既济', '随', '复', '益'], 巽: ['小畜', '渐', '涣', '姤', '蛊', '井'],
  师: ['临', '复', '升', '解', '蒙', '蒙'], 归妹: ['解', '震', '大壮', '临', '兑', '睽'],
  恒: ['大壮', '小过', '解', '升', '大过', '鼎'], 损: ['蒙', '颐', '大畜', '睽', '中孚', '临'],
  旅: ['革', '鼎', '晋', '艮', '遁', '小过'], 无妄: ['否', '履', '同人', '益', '噬嗑', '随'],
  既济: ['蹇', '需', '屯', '革', '明夷', '家人'], 明夷: ['谦', '泰', '复', '丰', '既济', '贲'],
  晋: ['噬嗑', '未济', '旅', '剥', '否', '豫'], 未济: ['睽', '晋', '鼎', '蒙', '讼', '解'],
  比: ['屯', '蒙', '蹇', '萃', '复', '观'], 泰: ['升', '明夷', '临', '大壮', '需', '大畜'],
  涣: ['中孚', '观', '巽', '讼', '蒙', '蒙'], 渐: ['家人', '巽', '观', '遁', '艮', '蹇'],
  益: ['观', '中孚', '家人', '无妄', '颐', '屯'], 睽: ['未济', '噬嗑', '大有', '损', '履', '归妹'],
  离: ['旅', '大有', '噬嗑', '贲', '同人', '丰'], 艮: ['贲', '蛊', '剥', '旅', '渐', '谦'],
  节: ['蒙', '屯', '需', '兑', '临', '中孚'], 萃: ['随', '困', '咸', '比', '豫', '否'],
  蒙: ['损', '剥', '蛊', '未济', '涣', '师'], 蛊: ['大畜', '艮', '蒙', '鼎', '巽', '升'],
  观: ['益', '涣', '渐', '否', '剥', '比'], 解: ['归妹', '豫', '恒', '师', '困', '未济'],
  讼: ['履', '否', '姤', '涣', '未济', '困'], 谦: ['明夷', '升', '复', '小过', '蹇', '艮'],
  豫: ['震', '解', '小过', '复', '萃', '晋'], 贲: ['艮', '大畜', '颐', '革', '家人', '明夷'],
  蹇: ['既济', '井', '比', '咸', '谦', '渐'], 遁: ['同人', '姤', '否', '渐', '旅', '咸'],
  随: ['萃', '兑', '革', '屯', '震', '无妄'], 需: ['井', '既济', '节', '夬', '泰', '小畜'],
  震: ['豫', '归妹', '丰', '复', '随', '噬嗑'], 革: ['咸', '夬', '随', '既济', '丰', '同人'],
  颐: ['剥', '损', '贲', '噬嗑', '益', '复'], 鼎: ['大有', '旅', '未济', '蛊', '姤', '恒'],
});

/** 元会运世换算常量。 */
export const HUANGJI_CONVERSION = Object.freeze({
  yearsPerShi: 30, shiPerYun: 12, yearsPerYun: 360, yunPerHui: 30, yearsPerHui: 10800, huiPerYuan: 12, yearsPerYuan: 129600,
});

/** 会支（会序 1..12 → 子丑…）。 */
export const HUANGJI_HUI_BRANCH = Object.freeze(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);

/** 黄畿：冬至起 24 节气序（index 0..23，节气名）。 */
export const HUANGJI_TERMS_FROM_DONGZHI = Object.freeze([
  '冬至', '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种',
  '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪',
]);
/** 黄畿：冬至起 12 中气（月序 1..12 的月首；冬至=1 … 小雪=12）。 */
export const HUANGJI_QI_FROM_DONGZHI = Object.freeze(['冬至', '大寒', '雨水', '春分', '谷雨', '小满', '夏至', '大暑', '处暑', '秋分', '霜降', '小雪']);

/** 皇极经世模型信息（盘面标识）。 */
export const HUANGJI_MODEL = Object.freeze({
  model: '先天圆图值年卦通行排法',
  yuanStartYear: -67017,
  annualAnchorYear: 1984,
  annualAnchorHexagram: '鼎',
  calendar: '公元纪年（无公元0年）',
});

/** 取卦对象。 */
export function huangjiHexagram(name) {
  return HUANGJI_BY_NAME[name] || null;
}

/** 变爻：某卦 变第 line 爻（1..6）→ 新卦短名。 */
export function huangjiChangeLine(name, line) {
  const h = HUANGJI_BY_NAME[name];
  if (!h) throw new Error(`huangjiChangeLine: 未知卦 ${name}`);
  const upper = HUANGJI_TRIGRAM_BITS[h.upper];
  const lower = HUANGJI_TRIGRAM_BITS[h.lower];
  const six = lower | (upper << 3);   // 6 位：bit0-2=下卦（从下），bit3-5=上卦
  const mask = 1 << (line - 1);
  const changed = six ^ mask;
  const newLower = changed & 0b111;
  const newUpper = (changed >> 3) & 0b111;
  const bitToTri = ['坤', '震', '坎', '兑', '艮', '离', '巽', '乾'];
  const id = HUANGJI_BY_UPPER_LOWER[`${bitToTri[newUpper]}${bitToTri[newLower]}`];
  return HUANGJI_BY_ID[id].shortName;
}
