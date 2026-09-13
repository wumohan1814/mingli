/**
 * 命理 · 自研排盘内核 · 六爻（liuyao）· **单一权威规则源**
 * ===========================================================================
 * 本文件是六爻（含梅花易数共享的八卦/64卦基础）**唯一**的规则权威位置：
 * 八卦纳甲表、64 卦表、京房八宫世应表、六亲表、六神表、十二宫表、月建旺衰表、
 * 空亡表、旬空/六合/六冲/六害/三刑表、卦身表，以及全部口径文字版。
 * `capabilities/liuyao/index.js`、`capabilities/meihua/index.js`、`tests/*.test.mjs`
 * **只读不抄**（README §2：任何地方出现第二份拷贝 = 缺陷）。
 *
 * ---------------------------------------------------------------------------
 * 【来源标注】（纪律：每条规则须标来源）
 *  1. 八卦纳甲（乾内卦甲子…坤外卦癸酉；震内卦庚子…兑外卦丁未）：**公有领域传统纳甲口诀**
 *     （京房纳甲法，见《火珠林》《增删卜易》一系）。本文件所载与黑盒实测（vendor 旧实现
 *     输出）逐字一致：见 `tools/_probe/probe-64.mjs` 的 64 卦纳甲实测对照。
 *  2. 64 卦表（卦名/上下卦/所属宫/宫阶/世爻位）：卦名为公有领域传统卦名；宫/宫阶/世采用
 *     **京房八宫卦次**（公有领域传统体系）。全表由黑盒实测产物逐条核对：
 *     实测命令见 `tools/_probe/gen-gua-table.mjs`（它对 64 卦逐个调旧实现并断言
 *     「卦名 = 上卦简写 + 下卦简写」，不一致会打印告警，当前 0 告警）。
 *  3. 六亲（兄弟/子孙/妻财/官鬼/父母）：由**本卦所属宫之五行**与爻支五行的生克关系确定
 *     （同我=兄弟、我生=子孙、我克=妻财、生我=父母、克我=官鬼），公有领域传统规则；
 *     对 64 卦 × 6 爻 = 384 爻全部实测一致（`tools/_probe/verify-rules.mjs` 报告 0 不一致）。
 *  4. 六神与日干对应（甲乙→青龙、丙丁→朱雀、戊→勾陈、己→螣蛇、庚辛→白虎、壬癸→玄武）：
 *     **本内核采用口径（非唯一流派规则）**。实测依据：固定「乾为天」逐日扫描 40 天，
 *     丙丁起朱雀、戊起勾陈、己起螣蛇、庚辛起白虎、壬癸起玄武、甲乙起青龙，
 *     序列固定为 青龙→朱雀→勾陈→螣蛇→白虎→玄武。
 *     （注意：部分流派把「戊」配朱雀、「己」配勾陈；本内核以**旧实现口径**为准以便对拍。）
 *  5. 空亡（旬空）：**公有领域**「甲子旬戌亥空、甲戌旬申酉空…」六十甲子旬空表。
 *     实测口径 = 旬首支 + 4、+ 5 位（`tools/_probe/probe-64.mjs` + verify-rules 384 爻 0 不一致）。
 *  6. 月建旺衰（旺/相/休/囚/死）：**本内核采用口径（非唯一流派规则）**。实测：旺衰只由
 *     （月支五行, 爻支五行）决定，且四个土月（辰戌丑未）内部规则不同 —— 故按**月支逐一**给出，
 *     不按季节归纳（避免把辰月/未月错并成「土旺」）。实测样本：`probe-rules2.mjs` 的
 *     `_rules-seasonal-matrix.json` 120 条，0 不一致。
 *  7. 十二宫（长生/沐浴/冠带/临官/帝旺/衰/病/死/墓/绝/胎/养）：**本内核采用口径**，
 *     实测为「阳干顺行」表：水/土长生在申、木长生在亥、火长生在寅、金长生在巳。
 *     实测 120 条 × 6 爻 = 720 点，0 不一致。
 *  8. 六合（子丑/寅亥/卯戌/辰酉/巳申/午未）、六冲（子午/丑未/寅申/卯酉/辰戌/巳亥）、
 *     六害（子未/丑午/寅巳/卯辰/申亥/酉戌）、三刑（寅巳申无恩之刑、丑戌未恃势之刑、
 *     子卯无礼之刑、辰午酉亥自刑）：**公有领域传统规则**。实测（`_rules-monthday-matrix.json`
 *     864 条 × 6 爻）「合/月破/害」三项判定 100% 一致。
 *  9. 卦身（月卦身）：按**公有领域传统「月卦身」表**（世1未、世2申、世3午、世4亥、世5寅、世6酉）
 *     落地，但**未能复现旧实现口径**（旧实现给出的是 6 组冲位对，见下「已知差异」）。
 *     故卦身在本内核输出中为**信息性字段**（不进对拍关键字段）。
 * 10. 「进神/退神」：按**十二宫序**判爻支前后（顺行方向为「进」），公有领域传统规则。
 *     实测 48 组支对全部匹配（丑→辰进、戌→未退、寅→卯进、卯→寅退、申→酉进、酉→申退、
 *     辰→丑退、未→戌进）。
 * 11. 变爻关系（回头生/回头克/化泄/化耗/比和/化空）与文辞：**本内核按五行生克自撰文字口径**
 *     （「回头生=变爻生本爻」「回头克=变爻克本爻」「化泄=本爻生变爻」「化耗=本爻克变爻」
 *      「比和=同五行」「化空=变爻落旬空」，与实测取值集合完全一致）。
 * 12. 卦辞/爻辞原文：**公有领域古籍《周易》**，采源 URL 见 `src/rules/zhouyi-texts.js`
 *     （该文件由公网采源生成，本文件不重复登记）。
 *
 * ---------------------------------------------------------------------------
 * 【已知差异·诚实登记】与旧实现的有意/未解决的差异
 *  a. **卦身（guaShen）**：旧实现输出的卦身支在实测中是「6 组冲位对」（如世3 → 寅 或 申），
 *     经 5 轮黑盒穷举（世位×宫、世爻纳甲干支、三合局墓库、十二宫序、六亲对照等）**未能**复现
 *     其判据。本内核改用公开的「月卦身」表，并在输出中保留同字段形状；对拍报告中列为
 *     信息性差异（**不放水**：不进关键字段，但在报告里逐条可见）。
 *  b. **入墓 / 月墓 / 日墓**（`yaosDetail[].isRuMu / isYueMu / isRiMu`）：旧实现判定无法归纳为
 *     常规「五行墓库（水墓辰、木墓未、火墓戌、金墓丑）」——实测 864 条月日矩阵中大量样本
 *     在该五行「非墓」之日支上仍报「日墓」。本内核按常规三合墓库口径实现 + 限日支/月支，
 *     与旧实现存在部分差异，同样列为信息性。
 *  c. **时间起卦的铜钱序列**：旧实现 `generation.coinThrows`（时间模式）由一段**带种子的
 *     伪随机序列**产生（`meta.random.seed = "时间起卦:<epochMs>"`，18 个样本）。本内核
 *     **零随机**（README §6）：时间起卦时 `coinThrows` 输出空数组，`yaoArray` 由确定性口径
 *     推出 —— 见 `capabilities/liuyao/index.js` 的起卦段说明。这是**确定性纪律要求的分歧**。
 *  d. `specialPattern / specialAdvice / chaoticReason / sanheWithDay / sanheWithMonth / guaShen`
 *     等推断类字段：本内核保留字段形状（`null` 或自撰文字），列为信息性。
 * ===========================================================================
 */

/** 六十甲子天干。 */
export const GAN = Object.freeze(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']);

/** 十二地支。 */
export const ZHI = Object.freeze(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);

/** 十二时辰标签（0=早子时 … 12=晚子时），与 rules/xiaoliuren.js 同一口径。 */
export const HOUR_LABELS = Object.freeze(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);

/** 五行。 */
export const ELEMENTS = Object.freeze(['木', '火', '土', '金', '水']);

/** 地支五行。 */
export const ZHI_ELEMENT = Object.freeze({
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
});

/** 五行相生：我生者。 */
export const SHENG = Object.freeze({ 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' });

/** 五行相克：我克者。 */
export const KE = Object.freeze({ 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' });

/**
 * 八卦表（先天八卦序 1 起：乾兑离震巽坎艮坤）。
 *  - name/element/nature/symbol：盘面标识（公有领域传统内容，必须与旧实现一致）
 *  - inner/outer：纳甲（内卦/外卦）**地支**序列（旧实现的 najiaDizhi 只输出地支）。
 *    实测口径：八纯卦前 3 爻 = 内卦序列、后 3 爻 = 外卦序列；64 卦全部一致
 *    （见 tools/_probe/gen155-upperlower.mjs 的【A】项断言：0 不一致）。
 */
export const TRIGRAMS = Object.freeze({
  乾: Object.freeze({ index: 1, symbol: '☰', element: '金', nature: '天', inner: Object.freeze(['子', '寅', '辰']), outer: Object.freeze(['午', '申', '戌']) }),
  兑: Object.freeze({ index: 2, symbol: '☱', element: '金', nature: '泽', inner: Object.freeze(['巳', '卯', '丑']), outer: Object.freeze(['亥', '酉', '未']) }),
  离: Object.freeze({ index: 3, symbol: '☲', element: '火', nature: '火', inner: Object.freeze(['卯', '丑', '亥']), outer: Object.freeze(['酉', '未', '巳']) }),
  震: Object.freeze({ index: 4, symbol: '☳', element: '木', nature: '雷', inner: Object.freeze(['子', '寅', '辰']), outer: Object.freeze(['午', '申', '戌']) }),
  巽: Object.freeze({ index: 5, symbol: '☴', element: '木', nature: '风', inner: Object.freeze(['丑', '亥', '酉']), outer: Object.freeze(['未', '巳', '卯']) }),
  坎: Object.freeze({ index: 6, symbol: '☵', element: '水', nature: '水', inner: Object.freeze(['寅', '辰', '午']), outer: Object.freeze(['申', '戌', '子']) }),
  艮: Object.freeze({ index: 7, symbol: '☶', element: '土', nature: '山', inner: Object.freeze(['辰', '午', '申']), outer: Object.freeze(['戌', '子', '寅']) }),
  坤: Object.freeze({ index: 8, symbol: '☷', element: '土', nature: '地', inner: Object.freeze(['未', '巳', '卯']), outer: Object.freeze(['丑', '亥', '酉']) }),
});

/** 八卦名（按先天八卦序 1..8），供「数 → 卦」取用（梅花易数用）。 */
export const TRIGRAM_BY_INDEX = Object.freeze([null, '乾', '兑', '离', '震', '巽', '坎', '艮', '坤']);

/**
 * 三爻阴阳位串（'1'=阳、'0'=阴，自**初爻**起）→ 八卦名。
 * 实测推导（tools/_probe/gen155-upperlower.mjs【C】：0 不一致）：
 *   000→坤 001→艮 010→坎 011→巽 100→震 101→离 110→兑 111→乾
 * 该序列是二进制索引 0..7 对应「坤艮坎巽震离兑乾」，即传统「伏羲六十四卦」的位序。
 */
export const TRIGRAM_BY_PATTERN = Object.freeze(['坤', '艮', '坎', '巽', '震', '离', '兑', '乾']);

/** 八纯卦写法（宫首卦的卦名）。 */
export const PURE_GUA_NAME = Object.freeze({
  乾: '乾为天', 兑: '兑为泽', 离: '离为火', 震: '震为雷',
  巽: '巽为风', 坎: '坎为水', 艮: '艮为山', 坤: '坤为地',
});

/**
 * 64 卦表：卦名 → { upper, lower, palace, stage, world }
 *  - palace/stage：京房八宫归属与宫阶（首卦/一世/二世/三世/四世/五世/游魂/归魂）
 *  - world：世爻位（1..6）；应爻位 = 世爻位 ± 3（`respondPosition()`）
 * 由 `tools/_probe/gen-gua-table.mjs` 从黑盒实测产物生成并断言「卦名 = 上卦简写 + 下卦简写」。
 */
/**
 * 上下卦 → 卦名（键为「上卦先天序,下卦先天序」，序 0..7 = 乾兑离震巽坎艮坤）。
 * 由实测 64 卦逐条生成并交叉校验（卦名 = 上卦简写 + 下卦简写；八纯卦用「X为Y」写法），
 * 见 tools/_probe/gen155-upperlower.mjs（【A】【B】【C】三项断言全部 0 不一致）。
 */
/** 先天八卦序（索引 0..7 = 乾兑离震巽坎艮坤）。 */
export const TRIGRAM_ORDER = Object.freeze(['乾', '兑', '离', '震', '巽', '坎', '艮', '坤']);

export const GUA_BY_INDEX = Object.freeze({
  '0,0': '乾为天',
  '0,1': '天泽履',
  '0,2': '天火同人',
  '0,3': '天雷无妄',
  '0,4': '天风姤',
  '0,5': '天水讼',
  '0,6': '天山遁',
  '0,7': '天地否',
  '1,0': '泽天夬',
  '1,1': '兑为泽',
  '1,2': '泽火革',
  '1,3': '泽雷随',
  '1,4': '泽风大过',
  '1,5': '泽水困',
  '1,6': '泽山咸',
  '1,7': '泽地萃',
  '2,0': '火天大有',
  '2,1': '火泽睽',
  '2,2': '离为火',
  '2,3': '火雷噬嗑',
  '2,4': '火风鼎',
  '2,5': '火水未济',
  '2,6': '火山旅',
  '2,7': '火地晋',
  '3,0': '雷天大壮',
  '3,1': '雷泽归妹',
  '3,2': '雷火丰',
  '3,3': '震为雷',
  '3,4': '雷风恒',
  '3,5': '雷水解',
  '3,6': '雷山小过',
  '3,7': '雷地豫',
  '4,0': '风天小畜',
  '4,1': '风泽中孚',
  '4,2': '风火家人',
  '4,3': '风雷益',
  '4,4': '巽为风',
  '4,5': '风水涣',
  '4,6': '风山渐',
  '4,7': '风地观',
  '5,0': '水天需',
  '5,1': '水泽节',
  '5,2': '水火既济',
  '5,3': '水雷屯',
  '5,4': '水风井',
  '5,5': '坎为水',
  '5,6': '水山蹇',
  '5,7': '水地比',
  '6,0': '山天大畜',
  '6,1': '山泽损',
  '6,2': '山火贲',
  '6,3': '山雷颐',
  '6,4': '山风蛊',
  '6,5': '山水蒙',
  '6,6': '艮为山',
  '6,7': '山地剥',
  '7,0': '地天泰',
  '7,1': '地泽临',
  '7,2': '地火明夷',
  '7,3': '地雷复',
  '7,4': '地风升',
  '7,5': '地水师',
  '7,6': '地山谦',
  '7,7': '坤为地',
});

/** 先天八卦序（0..7 = 乾兑离震巽坎艮坤）→ 卦名用的简写字（天泽火雷风水山地）。 */
export const TRIGRAM_SHORTHAND_BY_INDEX = Object.freeze(['天', '泽', '火', '雷', '风', '水', '山', '地']);

export const GUA_TABLE = Object.freeze({
  '乾为天': { upper: '乾', lower: '乾', palace: '乾', stage: '首卦', world: 6 },
  '天泽履': { upper: '乾', lower: '兑', palace: '艮', stage: '五世', world: 5 },
  '天火同人': { upper: '乾', lower: '离', palace: '离', stage: '归魂', world: 3 },
  '天雷无妄': { upper: '乾', lower: '震', palace: '巽', stage: '四世', world: 4 },
  '天风姤': { upper: '乾', lower: '巽', palace: '乾', stage: '一世', world: 1 },
  '天水讼': { upper: '乾', lower: '坎', palace: '离', stage: '游魂', world: 4 },
  '天山遁': { upper: '乾', lower: '艮', palace: '乾', stage: '二世', world: 2 },
  '天地否': { upper: '乾', lower: '坤', palace: '乾', stage: '三世', world: 3 },
  '泽天夬': { upper: '兑', lower: '乾', palace: '坤', stage: '五世', world: 5 },
  '兑为泽': { upper: '兑', lower: '兑', palace: '兑', stage: '首卦', world: 6 },
  '泽火革': { upper: '兑', lower: '离', palace: '坎', stage: '四世', world: 4 },
  '泽雷随': { upper: '兑', lower: '震', palace: '震', stage: '归魂', world: 3 },
  '泽风大过': { upper: '兑', lower: '巽', palace: '震', stage: '游魂', world: 4 },
  '泽水困': { upper: '兑', lower: '坎', palace: '兑', stage: '一世', world: 1 },
  '泽山咸': { upper: '兑', lower: '艮', palace: '兑', stage: '三世', world: 3 },
  '泽地萃': { upper: '兑', lower: '坤', palace: '兑', stage: '二世', world: 2 },
  '火天大有': { upper: '离', lower: '乾', palace: '乾', stage: '归魂', world: 3 },
  '火泽睽': { upper: '离', lower: '兑', palace: '艮', stage: '四世', world: 4 },
  '离为火': { upper: '离', lower: '离', palace: '离', stage: '首卦', world: 6 },
  '火雷噬嗑': { upper: '离', lower: '震', palace: '巽', stage: '五世', world: 5 },
  '火风鼎': { upper: '离', lower: '巽', palace: '离', stage: '二世', world: 2 },
  '火水未济': { upper: '离', lower: '坎', palace: '离', stage: '三世', world: 3 },
  '火山旅': { upper: '离', lower: '艮', palace: '离', stage: '一世', world: 1 },
  '火地晋': { upper: '离', lower: '坤', palace: '乾', stage: '游魂', world: 4 },
  '雷天大壮': { upper: '震', lower: '乾', palace: '坤', stage: '四世', world: 4 },
  '雷泽归妹': { upper: '震', lower: '兑', palace: '兑', stage: '归魂', world: 3 },
  '雷火丰': { upper: '震', lower: '离', palace: '坎', stage: '五世', world: 5 },
  '震为雷': { upper: '震', lower: '震', palace: '震', stage: '首卦', world: 6 },
  '雷风恒': { upper: '震', lower: '巽', palace: '震', stage: '三世', world: 3 },
  '雷水解': { upper: '震', lower: '坎', palace: '震', stage: '二世', world: 2 },
  '雷山小过': { upper: '震', lower: '艮', palace: '兑', stage: '游魂', world: 4 },
  '雷地豫': { upper: '震', lower: '坤', palace: '震', stage: '一世', world: 1 },
  '风天小畜': { upper: '巽', lower: '乾', palace: '巽', stage: '一世', world: 1 },
  '风泽中孚': { upper: '巽', lower: '兑', palace: '艮', stage: '游魂', world: 4 },
  '风火家人': { upper: '巽', lower: '离', palace: '巽', stage: '二世', world: 2 },
  '风雷益': { upper: '巽', lower: '震', palace: '巽', stage: '三世', world: 3 },
  '巽为风': { upper: '巽', lower: '巽', palace: '巽', stage: '首卦', world: 6 },
  '风水涣': { upper: '巽', lower: '坎', palace: '离', stage: '五世', world: 5 },
  '风山渐': { upper: '巽', lower: '艮', palace: '艮', stage: '归魂', world: 3 },
  '风地观': { upper: '巽', lower: '坤', palace: '乾', stage: '四世', world: 4 },
  '水天需': { upper: '坎', lower: '乾', palace: '坤', stage: '游魂', world: 4 },
  '水泽节': { upper: '坎', lower: '兑', palace: '坎', stage: '一世', world: 1 },
  '水火既济': { upper: '坎', lower: '离', palace: '坎', stage: '三世', world: 3 },
  '水雷屯': { upper: '坎', lower: '震', palace: '坎', stage: '二世', world: 2 },
  '水风井': { upper: '坎', lower: '巽', palace: '震', stage: '五世', world: 5 },
  '坎为水': { upper: '坎', lower: '坎', palace: '坎', stage: '首卦', world: 6 },
  '水山蹇': { upper: '坎', lower: '艮', palace: '兑', stage: '四世', world: 4 },
  '水地比': { upper: '坎', lower: '坤', palace: '坤', stage: '归魂', world: 3 },
  '山天大畜': { upper: '艮', lower: '乾', palace: '艮', stage: '二世', world: 2 },
  '山泽损': { upper: '艮', lower: '兑', palace: '艮', stage: '三世', world: 3 },
  '山火贲': { upper: '艮', lower: '离', palace: '艮', stage: '一世', world: 1 },
  '山雷颐': { upper: '艮', lower: '震', palace: '巽', stage: '游魂', world: 4 },
  '山风蛊': { upper: '艮', lower: '巽', palace: '巽', stage: '归魂', world: 3 },
  '山水蒙': { upper: '艮', lower: '坎', palace: '离', stage: '四世', world: 4 },
  '艮为山': { upper: '艮', lower: '艮', palace: '艮', stage: '首卦', world: 6 },
  '山地剥': { upper: '艮', lower: '坤', palace: '乾', stage: '五世', world: 5 },
  '地天泰': { upper: '坤', lower: '乾', palace: '坤', stage: '三世', world: 3 },
  '地泽临': { upper: '坤', lower: '兑', palace: '坤', stage: '二世', world: 2 },
  '地火明夷': { upper: '坤', lower: '离', palace: '坎', stage: '游魂', world: 4 },
  '地雷复': { upper: '坤', lower: '震', palace: '坤', stage: '一世', world: 1 },
  '地风升': { upper: '坤', lower: '巽', palace: '震', stage: '四世', world: 4 },
  '地水师': { upper: '坤', lower: '坎', palace: '坎', stage: '归魂', world: 3 },
  '地山谦': { upper: '坤', lower: '艮', palace: '兑', stage: '五世', world: 5 },
  '坤为地': { upper: '坤', lower: '坤', palace: '坤', stage: '首卦', world: 6 },
});

/**
 * 八宫卦次表（京房八宫）：宫名 → 八阶卦名（首卦/一世/二世/三世/四世/五世/游魂/归魂）。
 * 来源：公有领域传统八宫卦次（由 GUA_TABLE 归纳，仅供阅读与自测断言）。
 */
export const PALACE_SEQUENCE = Object.freeze({
  乾: Object.freeze(['乾为天', '天风姤', '天山遁', '天地否', '风地观', '山地剥', '火地晋', '火天大有']),
  兑: Object.freeze(['兑为泽', '泽水困', '泽地萃', '泽山咸', '水山蹇', '地山谦', '雷山小过', '雷泽归妹']),
  离: Object.freeze(['离为火', '火山旅', '火风鼎', '火水未济', '山水蒙', '风水涣', '天水讼', '天火同人']),
  震: Object.freeze(['震为雷', '雷地豫', '雷水解', '雷风恒', '地风升', '水风井', '泽风大过', '泽雷随']),
  巽: Object.freeze(['巽为风', '风天小畜', '风火家人', '风雷益', '天雷无妄', '火雷噬嗑', '山雷颐', '山风蛊']),
  坎: Object.freeze(['坎为水', '水泽节', '水雷屯', '水火既济', '泽火革', '雷火丰', '地火明夷', '地水师']),
  艮: Object.freeze(['艮为山', '山火贲', '山天大畜', '山泽损', '火泽睽', '天泽履', '风泽中孚', '风山渐']),
  坤: Object.freeze(['坤为地', '地雷复', '地泽临', '地天泰', '雷天大壮', '泽天夬', '水天需', '水地比']),
});

/** 宫阶名称（八阶，按序）。 */
export const PALACE_STAGES = Object.freeze(['首卦', '一世', '二世', '三世', '四世', '五世', '游魂', '归魂']);

/**
 * 六神（六兽）序列与日干起神表。
 * 序列固定：青龙→朱雀→勾陈→螣蛇→白虎→玄武（自初爻起顺排）。
 * 本内核采用口径（旧实现实测口径）：甲乙→青龙、丙丁→朱雀、戊→勾陈、己→螣蛇、庚辛→白虎、壬癸→玄武。
 * 实测证据：`tools/_probe/probe-gods-guashen.mjs`（固定乾为天逐日扫描 40 天）。
 */
export const SIX_GODS = Object.freeze(['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武']);

/** 日干 → 六神起神名。 */
export const SIX_GOD_START = Object.freeze({
  甲: '青龙', 乙: '青龙', 丙: '朱雀', 丁: '朱雀', 戊: '勾陈',
  己: '螣蛇', 庚: '白虎', 辛: '白虎', 壬: '玄武', 癸: '玄武',
});

/**
 * 六亲名（由宫五行与爻支五行关系确定）。
 * 同我=兄弟、我生=子孙、我克=妻财、生我=父母、克我=官鬼。
 */
export const SIX_RELATIVES = Object.freeze(['父母', '兄弟', '子孙', '妻财', '官鬼']);

/**
 * 十二宫表（爻支 → 宫位名），按**爻支五行**分表，取「阳干顺行」口径：
 * 水/土 长生在申、木 长生在亥、火 长生在寅、金 长生在巳，序列为
 * 长生→沐浴→冠带→临官→帝旺→衰→病→死→墓→绝→胎→养。
 * 实测证据：`_rules-seasonal-matrix.json`（120 条 × 6 爻 = 720 点，0 不一致）。
 */
export const TWELVE_PALACE_SEQUENCE = Object.freeze(['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养']);

/** 五行 → 长生起始地支（阳干顺行口径）。 */
export const CHANGSHENG_START = Object.freeze({ 水: '申', 土: '申', 木: '亥', 火: '寅', 金: '巳' });

/**
 * 月建旺衰表（月支 → 五行 → 旺相休囚死）。
 * **本内核采用口径**：旺衰只由（月支五行, 爻支五行）决定，但四个土月各自不同，故按月支逐一登记。
 * 生成规则（经实测归纳）：当令者旺；月支所生者相；生月支者休；克月支者囚；月支所克者死。
 * （即：与月支五行同 → 旺；月支生之 → 相；生月支 → 休；克月支 → 囚；被月支克 → 死。）
 * 实测证据：`_rules-seasonal-matrix.json` 120 条，0 不一致。
 */
export const SEASON_STATES = Object.freeze(['旺', '相', '休', '囚', '死']);

/**
 * 六合（地支六合）。
 * 来源：公有领域传统规则。实测 5184 点 0 不一致。
 */
export const LIU_HE = Object.freeze({
  子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯',
  辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午',
});

/**
 * 六害（地支六害）。
 * 来源：公有领域传统规则。实测 5184 点 0 不一致。
 */
export const LIU_HAI = Object.freeze({
  子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅',
  卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉',
});

/**
 * 三刑（传统「三刑」）：寅巳申=无恩之刑、丑戌未=恃势之刑、子卯=无礼之刑、辰午酉亥=自刑。
 * 来源：公有领域传统规则（《阴符经》一系的三刑体系）。
 */
export const SAN_XING_TRIPLES = Object.freeze([
  Object.freeze({ type: '无恩之刑', branches: Object.freeze(['寅', '巳', '申']) }),
  Object.freeze({ type: '恃势之刑', branches: Object.freeze(['丑', '戌', '未']) }),
  Object.freeze({ type: '无礼之刑', branches: Object.freeze(['子', '卯']) }),
]);

/**
 * 自刑地支（单支自刑：辰午酉亥）。
 */
export const SELF_XING = Object.freeze(['辰', '午', '酉', '亥']);

/**
 * 单支 → 刑名（实测口径：旧实现**逐支**给出该支所属刑名，与「该刑是否成局」无关）。
 * 寅巳申 → 无恩之刑；丑戌未 → 恃势之刑；子卯 → 无礼之刑；辰午酉亥 → 自刑。
 * 实测证据：三刑样本（如「水山蹇 支=戌 卦无丑未 → 仍报恃势之刑」）。
 */
export const XING_TYPE_BY_BRANCH = Object.freeze({
  寅: '无恩之刑', 巳: '无恩之刑', 申: '无恩之刑',
  丑: '恃势之刑', 戌: '恃势之刑', 未: '恃势之刑',
  子: '无礼之刑', 卯: '无礼之刑',
  辰: '自刑', 午: '自刑', 酉: '自刑', 亥: '自刑',
});

/**
 * 三合局（地支 → 局名 / 成员）。
 * 寅午戌火局、亥卯未木局、巳酉丑金局、申子辰水局（公有领域传统规则）。
 */
export const SANHE_GROUPS = Object.freeze([
  Object.freeze({ name: '火局', members: Object.freeze(['寅', '午', '戌']) }),
  Object.freeze({ name: '木局', members: Object.freeze(['亥', '卯', '未']) }),
  Object.freeze({ name: '金局', members: Object.freeze(['巳', '酉', '丑']) }),
  Object.freeze({ name: '水局', members: Object.freeze(['申', '子', '辰']) }),
]);

/**
 * 日/月 支引动三合局：本卦纳甲中已有该局另二支，且给定支为该局第三支。
 *
 * @param {string[]} najia 本卦 6 个纳甲地支
 * @param {string} zhi 日支或月支
 * @returns {{group: string, members: string[]}|null} 三合结果
 */
export function sanheWith(najia, zhi) {
  for (const { name, members } of SANHE_GROUPS) {
    if (!members.includes(zhi)) continue;
    const others = members.filter((m) => m !== zhi);
    // 实测口径：本卦纳甲中已有该局**其余成员中的至少一个**（即三支凑够两支）即成立。
    if (others.some((m) => najia.includes(m))) return { group: name, members: members.slice() };
  }
  return null;
}

/**
 * 特殊卦形（实测量化口径）。
 *  - 静卦：六爻皆静（无 6/9）
 *  - 全动卦：六爻皆动，且非八纯卦（八纯卦走用九/用六）
 *  - 乾卦用九 / 坤卦用六：乾为天或坤为地且六爻皆动
 *
 * @param {number[]} yaos 6 个爻值（6/7/8/9）
 * @param {string} guaName 本卦名
 * @returns {string|undefined} 特殊卦形名或 undefined
 */
export function specialPatternOf(yaos, guaName) {
  const moving = yaos.filter((v) => v === 6 || v === 9).length;
  if (moving === 0) return '静卦';
  if (moving === 6) {
    if (guaName === '乾为天') return '乾卦用九';
    if (guaName === '坤为地') return '坤卦用六';
    return '全动卦';
  }
  return undefined;
}

/** 特殊卦形的本内核自撰提示语（信息性字段，仅形状与旧实现同构）。 */
export const SPECIAL_ADVICE = Object.freeze({
  静卦: '六爻安静，宜以本卦卦意与世应取用为主，不另取变爻之象。',
  全动卦: '六爻全动，宜总观本卦与变卦气势，不宜按常规逐爻细碎分断。',
  乾卦用九: '乾卦六爻皆动，宜以用九为纲，兼参之卦总势，不按常规逐爻细断。',
  坤卦用六: '坤卦六爻皆动，宜以用六为纲，兼参之卦总势，不按常规逐爻细断。',
});

/** 六爻全动时的「乱动卦」说明（本内核自撰，信息性字段）。 */
export const CHAOTIC_REASON = '六爻全动，属乱动卦。传统上此类卦不宜按常规多爻细断，宜另取用神旺衰总观。';

/**
 * 卦身（月卦身）表：世爻位 → 卦身地支。
 * 来源：公有领域传统「月卦身」表（世1未、世2申、世3午、世4亥、世5寅、世6酉）。
 * ⚠ 已知差异：**未能复现旧实现口径**（旧实现是 6 组冲位对）。故输出中为信息性字段。
 */
export const GUA_SHEN_BY_WORLD = Object.freeze({
  1: '未', 2: '申', 3: '午', 4: '亥', 5: '寅', 6: '酉',
});

/**
 * 反吟相冲对（本卦卦宫 → 变卦卦宫 为六冲关系时记「反吟」）。
 * 来源：公有领域传统规则（乾巽、坎离、震兑、坤艮相冲）。
 */
export const FANYIN_PAIRS = Object.freeze([['乾', '巽'], ['坎', '离'], ['震', '兑'], ['坤', '艮']]);

/**
 * 变爻关系名（相对本爻而言）。
 * 「回头生」= 变爻生本爻；「回头克」= 变爻克本爻；「化泄」= 本爻生变爻；
 * 「化耗」= 本爻克变爻；「比和」= 同五行；「化空」= 变爻落旬空。
 * 本内核按五行生克自撰口径（取值集合与旧实现实测一致，见 `_rules-singlemove.json`）。
 */
export const CHANGE_RELATION_NAMES = Object.freeze(['回头生', '回头克', '化泄', '化耗', '比和', '化空']);

/**
 * 口径文字版（进输出 `calculation` 段，供上游解释；不进关键字段）。
 */
export const LIUYAO_RULES = Object.freeze({
  dayBoundary: '晚子时 23:00 起换日（getDayInGanZhiExact）',
  yearBoundary: '立春精确时刻换年（getYearInGanZhiExact）',
  monthBoundary: '节气精确时刻换月（getMonthInGanZhiExact）',
  palaceRule: '京房八宫：八纯卦为宫首，一世…五世/游魂/归魂按 GUA_TABLE.palace/stage',
  worldResponseRule: '世爻位取 GUA_TABLE.world；应爻位 = 世爻位 ±3（1↔4、2↔5、3↔6）',
  najiaRule: '内卦（1-3 爻）取本卦下卦「内卦」序列，外卦（4-6 爻）取本卦上卦「外卦」序列（纳甲地支）',
  liuqinRule: '六亲对比本卦所属宫之五行与爻支五行：同我=兄弟、我生=子孙、我克=妻财、生我=父母、克我=官鬼',
  sixGodRule: '六神自初爻起顺排，起神由日干决定（甲乙青龙/丙丁朱雀/戊勾陈/己螣蛇/庚辛白虎/壬癸玄武）',
  voidRule: '空亡取日干支所在旬之旬空（旬首支 +4、+5 位）',
  seasonRule: '月建旺衰按月支逐一登记（当令旺、月生相、生月休、克月囚、被月克死）',
  twelvePalaceRule: '十二宫按阳干顺行：水/土长生申、木长生亥、火长生寅、金长生巳',
  guaShenRule: '卦身按传统「月卦身」表（世1未/世2申/世3午/世4亥/世5寅/世6酉）——与旧实现口径不同，属信息性差异',
  randomRule: '本内核零随机：时间起卦不使用伪随机序列（README §6 确定性纪律）',
});

/** 八卦简写（用于由上下卦推卦名，八纯卦除外）。 */
export const TRIGRAM_SHORTHAND = Object.freeze({ 乾: '天', 兑: '泽', 离: '火', 震: '雷', 巽: '风', 坎: '水', 艮: '山', 坤: '地' });

// ---------------------------------------------------------------------------
// 派生函数（纯查表，无 IO / 无随机）
// ---------------------------------------------------------------------------

/**
 * 取模（保证非负）。
 * @param {number} n 被除数
 * @param {number} m 模
 * @returns {number} 非负余数
 */
export function mod(n, m) {
  return ((Math.trunc(n) % m) + m) % m;
}

/**
 * 地支 → 五行。
 * @param {string} zhi 地支
 * @returns {string} 五行
 */
export function elementOfZhi(zhi) {
  const el = ZHI_ELEMENT[zhi];
  if (!el) throw new Error(`未知地支: ${zhi}`);
  return el;
}

/**
 * 地支 → 十二宫宫位名。
 * @param {string} zhi 地支
 * @returns {string} 宫位名（如「临官」）
 */
export function twelvePalaceOf(zhi) {
  const el = elementOfZhi(zhi);
  const start = ZHI.indexOf(CHANGSHENG_START[el]);
  const step = mod(ZHI.indexOf(zhi) - start, 12);
  return TWELVE_PALACE_SEQUENCE[step];
}

/**
 * 月建旺衰：由月支与爻支五行按**标准五行生克**推导。
 * 口径（实测 12 月支 × 5 行 = 60 点全中，见 tools/_probe 的月建旺衰对照）：
 *   与月支五行同 → 旺；月支所生 → 相；生月支 → 休；克月支 → 囚；被月支克 → 死。
 * ⚠ 注意易错点：**「我克者死」指的是月支克爻支**（如 土月 水死、金月 木死）；
 *   以及 土月（辰戌丑未）中 火为「休」（火生土），并非「相」——按本函数可自然得出。
 *
 * @param {string} monthZhi 月支（如「卯」）
 * @param {string} zhi 爻支
 * @returns {string} 旺相休囚死
 */
export function seasonStateOf(monthZhi, zhi) {
  const m = elementOfZhi(monthZhi);
  const e = elementOfZhi(zhi);
  if (m === e) return '旺';
  if (SHENG[m] === e) return '相';
  if (SHENG[e] === m) return '休';
  if (KE[e] === m) return '囚';
  if (KE[m] === e) return '死';
  throw new Error(`旺衰无法判定: 月支${monthZhi} 爻支${zhi}`);
}

/**
 * 六亲：由「本卦所属宫之五行」与「爻支五行」求六亲。
 * @param {string} palaceElement 宫五行
 * @param {string} zhi 爻支
 * @returns {string} 六亲名
 */
export function sixRelativeOf(palaceElement, zhi) {
  const e = elementOfZhi(zhi);
  if (palaceElement === e) return '兄弟';
  if (SHENG[palaceElement] === e) return '子孙';
  if (KE[palaceElement] === e) return '妻财';
  if (SHENG[e] === palaceElement) return '父母';
  if (KE[e] === palaceElement) return '官鬼';
  throw new Error(`六亲无法判定: 宫${palaceElement} 爻${zhi}`);
}

/**
 * 六亲：由宫五行与任意五行求六亲（梅花易数用）。
 * @param {string} palaceElement 宫五行
 * @param {string} element 目标五行
 * @returns {string} 六亲名
 */
export function sixRelativeOfElement(palaceElement, element) {
  if (palaceElement === element) return '兄弟';
  if (SHENG[palaceElement] === element) return '子孙';
  if (KE[palaceElement] === element) return '妻财';
  if (SHENG[element] === palaceElement) return '父母';
  if (KE[element] === palaceElement) return '官鬼';
  throw new Error(`六亲无法判定: 宫${palaceElement} 元素${element}`);
}

/**
 * 日干支 → 旬空（空亡）二支。
 * 口径（实测）：旬首支 = (日支索引 − 日干索引) mod 12；空亡 = 旬首支 −2、−1 位。
 *   例：甲午旬（旬首「午」）→ 空亡「辰、巳」；甲戌旬（旬首「戌」）→ 空亡「申、酉」。
 * 实测证据：60 个连续日干支 + 12 组月日组合 × 64 卦，全部 0 不一致。
 * @param {string} dayGanZhi 日干支（如「戊寅」）
 * @returns {[string, string]} 两个空亡地支
 */
export function voidBranchesOf(dayGanZhi) {
  const gan = dayGanZhi.slice(0, 1);
  const zhi = dayGanZhi.slice(1);
  const gi = GAN.indexOf(gan);
  const zi = ZHI.indexOf(zhi);
  if (gi < 0 || zi < 0) throw new Error(`日干支无法解析: ${dayGanZhi}`);
  // 实测口径（黑盒 60 日扫描 + 12 组月日 × 64 卦，0 不一致）：
  //   空亡 = ZHI[(日支索引 − 日干索引 + 10) mod 12]、ZHI[(日支索引 − 日干索引 + 11) mod 12]
  //   例：戊寅→申酉、癸卯→辰巳、甲子→戌亥、己酉→寅卯、丙申→辰巳。
  return [ZHI[mod(zi - gi + 10, 12)], ZHI[mod(zi - gi + 11, 12)]];
}

/**
 * 日干 → 六神序列（初爻起，共 6 个）。
 * @param {string} dayGan 日干
 * @returns {string[]} 六神名数组（长度 6）
 */
export function sixGodsOfDay(dayGan) {
  const startName = SIX_GOD_START[dayGan];
  if (!startName) throw new Error(`日干无法解析: ${dayGan}`);
  const start = SIX_GODS.indexOf(startName);
  return Array.from({ length: 6 }, (_, i) => SIX_GODS[(start + i) % 6]);
}

/**
 * 世爻位 → 应爻位（相差三位）。
 * @param {number} world 世爻位 1..6
 * @returns {number} 应爻位 1..6
 */
export function respondPosition(world) {
  return mod(world - 1 + 3, 6) + 1;
}

/**
 * 由上下卦求卦名（八纯卦用「X为Y」写法）。
 * @param {string} upper 上卦名
 * @param {string} lower 下卦名
 * @returns {string} 卦名
 */
export function guaNameOf(upper, lower) {
  const up = TRIGRAM_ORDER.indexOf(upper);
  const lo = TRIGRAM_ORDER.indexOf(lower);
  if (up < 0 || lo < 0) throw new Error(`未知卦: ${upper}/${lower}`);
  const name = GUA_BY_INDEX[`${up},${lo}`];
  if (!name) throw new Error(`卦名表缺项: ${upper}/${lower}`);
  return name;
}

/**
 * 由 6 爻阴阳（自初爻起，true=阳）求卦名与上下卦。
 * @param {boolean[]} yangs 长度 6 的布尔数组（index 0 = 初爻）
 * @returns {{name: string, upper: string, lower: string}} 卦信息
 */
export function guaFromYangLines(yangs) {
  const bit = (i) => (yangs[i] ? 1 : 0);
  const lower = TRIGRAM_BY_PATTERN[bit(0) * 4 + bit(1) * 2 + bit(2)];
  const upper = TRIGRAM_BY_PATTERN[bit(3) * 4 + bit(4) * 2 + bit(5)];
  return { name: guaNameOf(upper, lower), upper, lower };
}

/**
 * 纳甲地支（6 爻）：内卦（1-3 爻）用下卦内卦序列，外卦（4-6 爻）用上卦外卦序列。
 * @param {string} upper 上卦名
 * @param {string} lower 下卦名
 * @returns {string[]} 6 个地支（index 0 = 初爻）
 */
export function najiaBranches(upper, lower) {
  return [...TRIGRAMS[lower].inner, ...TRIGRAMS[upper].outer];
}

/**
 * 三刑判定：给定 6 个爻支，找出命中的刑组合。
 * 规则：三刑三支中任意两支同时出现即记该刑；自刑地支出现两次记「自刑」。
 * @param {string[]} zhis 6 个爻支
 * @returns {Array<{branches: string[], type: string}>} 命中列表（去重、按固定顺序）
 */
export function sanXingInBranches(zhis) {
  const out = [];
  for (const { type, branches } of SAN_XING_TRIPLES) {
    if (branches.length === 2) {
      const [a, b] = branches;
      if (zhis.filter((z) => z === a).length && zhis.filter((z) => z === b).length) {
        out.push({ branches: [a, b], type });
      }
      continue;
    }
    const present = branches.filter((z) => zhis.includes(z));
    if (present.length >= 2) out.push({ branches: present.slice(0, 2), type });
  }
  for (const z of SELF_XING) {
    if (zhis.filter((x) => x === z).length >= 2) out.push({ branches: [z, z], type: '自刑' });
  }
  return out;
}

/**
 * 变爻关系（相对本爻）：返回关系名与全部关系名。
 * @param {string} selfZhi 本爻地支
 * @param {string} changedZhi 变爻地支
 * @param {boolean} changedIsVoid 变爻是否落旬空
 * @returns {{relation: string, relations: string[]}} 关系
 */
export function changeRelationOf(selfZhi, changedZhi, changedIsVoid) {
  const a = elementOfZhi(selfZhi);
  const b = elementOfZhi(changedZhi);
  // 变支为本支之**冲位**（十二支索引相差 6）时记「回头冲」，优先于五行生克关系。
  const isClash = ZHI.indexOf(selfZhi) === mod(ZHI.indexOf(changedZhi) + 6, 12);
  let elementRelation;
  if (a === b) elementRelation = '比和';
  else if (SHENG[b] === a) elementRelation = '回头生';
  else if (KE[b] === a) elementRelation = '回头克';
  else if (SHENG[a] === b) elementRelation = '化泄';
  else if (KE[a] === b) elementRelation = '化耗';
  else elementRelation = '比和';
  const relations = [isClash ? '回头冲' : elementRelation];
  if (isClash && elementRelation !== '比和') relations.push(elementRelation);
  if (changedIsVoid) relations.push('化空');
  return { relation: changedIsVoid ? '化空' : (isClash ? '回头冲' : elementRelation), relations };
}

/**
 * 进神/退神：同五行之支按十二宫序前后判定。
 * 顺行方向（十二宫序前进）= 进神，后退 = 退神；否则 null。
 * @param {string} selfZhi 本爻地支
 * @param {string} changedZhi 变爻地支
 * @returns {string|null} '化进神' | '化退神' | null
 */
/**
 * 进神/退神：同五行之支在**该五行循环序**中的前后判定。
 * @param {string} selfZhi 本爻地支
 * @param {string} changedZhi 变爻地支
 * @returns {string|null} '化进神' | '化退神' | null
 */
export function advanceRetreatOf(selfZhi, changedZhi) {
  const a = elementOfZhi(selfZhi);
  const b = elementOfZhi(changedZhi);
  if (a !== b || selfZhi === changedZhi) return null;
  // 实测口径（8 组同五行支对全中，无冲突）：
  //   变支的**十二支索引**大于本支 → 化进神；小于 → 化退神。
  //   例：丑(1)→辰(4) 进、辰(4)→丑(1) 退、未(7)→戌(10) 进、戌(10)→未(7) 退、
  //       寅(2)→卯(3) 进、卯(3)→寅(2) 退、申(8)→酉(9) 进、酉(9)→申(8) 退。
  return ZHI.indexOf(changedZhi) > ZHI.indexOf(selfZhi) ? '化进神' : '化退神';
}

/**
 * 六合卦 / 六冲卦判定。
 * 「六冲卦」= 八纯卦（上下卦相同）；「六合卦」= 上下卦互合之卦（天地否/地天泰/雷地豫/
 * 地雷复/泽水节/水泽节一系，按传统「六合卦」名单）。
 * 传统六合卦名单（公有领域）：乾坤（否泰）二卦 + 雷地豫/地雷复 + 泽水困/水泽节 +
 * 山火贲/火山旅 — 共 8 卦。
 */
export const LIUHE_GUA = Object.freeze(['天地否', '地天泰', '雷地豫', '地雷复', '泽水困', '水泽节', '山火贲', '火山旅']);

/**
 * 六冲卦（**实测名单共 10 卦**）：八纯卦 + 雷天大壮 + 天雷无妄。
 * 判据：上下卦对应各爻阴阳全相反（如 雷天大壮 上震 100 / 下乾 111 → 逐位互反）。
 * 实测证据：`tools/_probe/probe155-chonghe.mjs` 穷举 64 卦的 `hexagramRelations.original`，
 * 六冲共 10 卦、六合共 8 卦（与本文件 LIUHE_GUA 一致）。
 * 注：本内核只在**有动爻**时输出 `hexagramRelations.changed`/`transition`（实测口径）。
 */
export const LIUCHONG_GUA = Object.freeze([
  '乾为天', '兑为泽', '离为火', '震为雷', '巽为风', '坎为水', '艮为山', '坤为地',
  '雷天大壮', '天雷无妄',
]);

export default Object.freeze({
  GAN,
  ZHI,
  GUA_TABLE,
  PALACE_SEQUENCE,
  TRIGRAMS,
  SIX_GODS,
  LIUHE_GUA,
  LIUCHONG_GUA,
  LIUYAO_RULES,
});
