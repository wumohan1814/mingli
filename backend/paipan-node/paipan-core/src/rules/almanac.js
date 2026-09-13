/**
 * 命理 · 自研排盘内核 · 单一权威规则源 · 黄历择日（almanac）
 * ---------------------------------------------------------------------------
 * 「单一权威规则源」纪律（README §2）：本文件是黄历择日的**唯一权威规则位置**：
 * 事项关键词表、九星值日口径、全年方位神表、方位名表、神煞名校勘表、证据层口径，
 * 全部在这里；capabilities/almanac/、对拍框架、测试、未来适配层只能读不能抄。
 *
 * == 规则来源（每条都标来源）==
 *   - 建除十二值 / 二十八宿 / 九星 / 彭祖百忌 / 冲煞 / 十二神（青龙黄黑道）/ 日宜忌：
 *     **由内核唯一依赖 `lunar-typescript@1.8.6`（6tail）提供**，其数据表与旧实现所用同源库同源
 *     （对拍实测：建除、二十八宿（含七政/动物/方/吉凶）、彭祖百忌、冲煞、日宜忌（含逐条次序）、
 *     时干支与时天神，全部逐字段一致）。
 *   - 二十八宿／九星的「全名」写法（如「井木犴」「三碧木，北斗天玑，方位东」）为传统写法组合。
 *   - 全年方位神（岁神十二）：公有领域传统岁神表（太岁、太阳、丧门、太阴、官符、死符、岁破、龙德、
 *     白虎、福德、吊客、病符），以流年支为太岁位顺推；方位名用二十四山方向的通俗名（正北/东北偏北…）。
 *   - 事项关键词表：**本内核自订的「事项—宜忌条目」对照表**（键名取自通书通行宜忌条目，
 *     如入宅/移徙/安床/修造/动土…；属公有领域传统条目名，不含任何旧实现文案）。
 *   - 现代白话说辞（highlights/cautions/证据层措辞）：**本文件自行撰写**，不复制旧实现任何句子。
 *
 * == 对拍实测确认的口径（黑盒探针，禁止读旧实现源码）==
 *   1. 日期范围限 1900–2100，单次最多 180 天（超出抛错）。
 *   2. 事项 10 选 1（键固定）：move / marriage / opening / contract / travel / medical /
 *      study / burial / renovation / custom；topicLabel 见 TOPICS。
 *   3. **九星值日口径（本内核反推并全量验证）**：换向边界＝每年「夏至/冬至」当天**最近的甲子日**；
 *      相位＝相邻边界之间；顺相位（冬至起）`星＝((d − 边界日) mod 9)+1`，
 *      逆相位（夏至起）`星＝((下一边界日 − 1 − d) mod 9)+1`。
 *      该口径在 1900–1916 逐日 6209 天 100% 命中旧实现（含 1905-05-25 这类「4 周期逆相位」特例），
 *      并在 1900–2100 抽样复验（见 tests 与探针）。
 *   4. 全年方位神 12 项随**流年支**顺推；`hours` 13 条（早子时…亥时、晚子时），
 *      晚子时用**次日日干**起五鼠遁（与旧实现一致）。
 *   5. 神煞列表＝`getDayJiShen()`（吉神）在前、`getDayXiongSha()`（凶神）在后，顺序即此；
 *      lunar-typescript 有 4 个未翻译的 i18n 键，本内核按校勘表补中文（见 XIONG_SHA_NAME_FIX）。
 *   6. **候选状态**：命中本事项忌项、或该日宜项明列「诸事不宜」→ 慎用候选；否则可用候选。
 *      条件候选留作接口（本内核自订口径：仅有间接不合时使用）。
 *   7. **days 顺序**（决定 days[i] 这类路径）：先按状态（可用 → 条件 → 慎用），
 *      再按「有宜项命中」在前，最后按日期升序。
 *   8. 旧实现**忽略 participants**（实测：传完整生辰后输出 participants 恒为 []，
 *      且 participantNotes / participantRelationFacts 恒为空）——本内核照此（并在此登记）。
 *
 * 纪律：零 IO、零网络、零随机数、零「当前时刻」依赖（历法一律按显式日期字符串）。
 */

/** 事项表：键 → 中文标签 + 本内核自订的宜/忌关键词（传统通书条目名）。 */
const TOPICS = Object.freeze({
  move: Object.freeze({
    label: '搬家入宅',
    yiKeywords: Object.freeze(['入宅', '移徙', '安床', '修造', '动土']),
    jiKeywords: Object.freeze(['入宅', '移徙', '安床']),
  }),
  marriage: Object.freeze({
    label: '订婚结婚',
    yiKeywords: Object.freeze(['嫁娶', '纳采', '订盟', '会亲友', '冠笄', '成服', '安床']),
    jiKeywords: Object.freeze(['嫁娶', '纳采', '订盟']),
  }),
  opening: Object.freeze({
    label: '开业启动',
    yiKeywords: Object.freeze(['开市', '交易', '立券', '纳财', '开仓', '出货财', '挂匾']),
    jiKeywords: Object.freeze(['开市', '交易', '立券']),
  }),
  contract: Object.freeze({
    label: '签约合作',
    yiKeywords: Object.freeze(['交易', '立券', '纳财', '会亲友']),
    jiKeywords: Object.freeze(['交易', '立券']),
  }),
  travel: Object.freeze({
    label: '出行赴任',
    yiKeywords: Object.freeze(['出行', '赴任', '移徙']),
    jiKeywords: Object.freeze(['出行', '赴任']),
  }),
  medical: Object.freeze({
    label: '就医手术',
    yiKeywords: Object.freeze(['求医', '治病', '解除']),
    jiKeywords: Object.freeze(['求医', '治病']),
  }),
  study: Object.freeze({
    label: '考试学习',
    yiKeywords: Object.freeze(['入学', '求嗣', '祭祀', '祈福']),
    jiKeywords: Object.freeze(['入学', '求嗣']),
  }),
  burial: Object.freeze({
    label: '安葬修坟',
    yiKeywords: Object.freeze(['安葬', '修坟', '启钻', '立碑', '入殓', '移柩', '成服', '除服']),
    jiKeywords: Object.freeze(['安葬', '修坟', '启钻']),
  }),
  renovation: Object.freeze({
    label: '修造动土',
    yiKeywords: Object.freeze(['修造', '动土', '竖柱', '上梁', '盖屋', '起基']),
    jiKeywords: Object.freeze(['修造', '动土', '竖柱', '上梁']),
  }),
  custom: Object.freeze({
    label: '自定义事项',
    yiKeywords: Object.freeze([]),
    jiKeywords: Object.freeze([]),
  }),
});

/** 事项键清单（固定次序）。 */
export const ALMANAC_TOPIC_KEYS = Object.freeze(Object.keys(TOPICS));

/** 「诸事不宜」字面（旧实现据此判慎用，对拍实测）。 */
export const ALL_PURPOSES_TABOO = '诸事不宜';

/**
 * 九星表（值日星）：序号 1–9 → 全名/颜色/五行/斗柄星名/方位。
 * 对拍实测与旧实现一致（例：三 → 三碧木/碧/木/天玑/东）。
 */
const NINE_STARS = Object.freeze([
  Object.freeze({ index: 1, name: '一', fullName: '一白水', color: '白', wuxing: '水', dipper: '天枢', direction: '北' }),
  Object.freeze({ index: 2, name: '二', fullName: '二黑土', color: '黑', wuxing: '土', dipper: '天璇', direction: '西南' }),
  Object.freeze({ index: 3, name: '三', fullName: '三碧木', color: '碧', wuxing: '木', dipper: '天玑', direction: '东' }),
  Object.freeze({ index: 4, name: '四', fullName: '四绿木', color: '绿', wuxing: '木', dipper: '天权', direction: '东南' }),
  Object.freeze({ index: 5, name: '五', fullName: '五黄土', color: '黄', wuxing: '土', dipper: '玉衡', direction: '中' }),
  Object.freeze({ index: 6, name: '六', fullName: '六白金', color: '白', wuxing: '金', dipper: '开阳', direction: '西北' }),
  Object.freeze({ index: 7, name: '七', fullName: '七赤金', color: '赤', wuxing: '金', dipper: '摇光', direction: '西' }),
  Object.freeze({ index: 8, name: '八', fullName: '八白土', color: '白', wuxing: '土', dipper: '洞明', direction: '东北' }),
  Object.freeze({ index: 9, name: '九', fullName: '九紫火', color: '紫', wuxing: '火', dipper: '隐元', direction: '南' }),
]);

/** 全年方位神次序（传统岁神十二，以太岁位顺推）。 */
export const ANNUAL_DIRECTION_GOD_ORDER = Object.freeze([
  '太岁', '太阳', '丧门', '太阴', '官符', '死符', '岁破', '龙德', '白虎', '福德', '吊客', '病符',
]);

/** 十二支的方位通俗名（二十四山方向）。 */
export const BRANCH_DIRECTION_NAMES = Object.freeze({
  子: '正北', 丑: '东北偏北', 寅: '东北偏东', 卯: '正东', 辰: '东南偏东', 巳: '东南偏南',
  午: '正南', 未: '西南偏南', 申: '西南偏西', 酉: '正西', 戌: '西北偏西', 亥: '西北偏北',
});

/**
 * 神煞名校勘表：lunar-typescript 1.8.6 的吉神/凶煞表里有 4 个 i18n 键没有中文翻译，
 * 旧实现按本地校勘表补中文（对拍实测：同下标对齐反推得到下列映射；1900–2100 逐日扫描
 * 共出现这 4 个键，无其他未翻译键）。
 */
export const XIONG_SHA_NAME_FIX = Object.freeze({
  'sn.sanSang': '三丧',
  'sn.guiKu': '鬼哭',
  'sn.daTui': '大退',
  'sn.siLi': '四离',
});

/** 十二神（黄道黑道）与黄黑道属性（用于证据层分级，非关键字段）。 */
export const TWELVE_GOD_LUCK = Object.freeze({
  青龙: '黄道', 明堂: '黄道', 金匮: '黄道', 天德: '黄道', 玉堂: '黄道', 司命: '黄道',
  天刑: '黑道', 朱雀: '黑道', 白虎: '黑道', 天牢: '黑道', 玄武: '黑道', 勾陈: '黑道',
});

/**
 * 逐时时课表：13 个时辰（对拍实测与旧实现完全一致）。
 * 0＝早子时 00:00–01:00；1–11＝丑…亥（每 2 小时一进）；12＝晚子时 23:00–24:00（按次日日干起五鼠遁）。
 */
export const ALMANAC_HOURS = Object.freeze([
  Object.freeze({ name: '早子时', range: '00:00-01:00', branch: '子' }),
  Object.freeze({ name: '丑时', range: '01:00-03:00', branch: '丑' }),
  Object.freeze({ name: '寅时', range: '03:00-05:00', branch: '寅' }),
  Object.freeze({ name: '卯时', range: '05:00-07:00', branch: '卯' }),
  Object.freeze({ name: '辰时', range: '07:00-09:00', branch: '辰' }),
  Object.freeze({ name: '巳时', range: '09:00-11:00', branch: '巳' }),
  Object.freeze({ name: '午时', range: '11:00-13:00', branch: '午' }),
  Object.freeze({ name: '未时', range: '13:00-15:00', branch: '未' }),
  Object.freeze({ name: '申时', range: '15:00-17:00', branch: '申' }),
  Object.freeze({ name: '酉时', range: '17:00-19:00', branch: '酉' }),
  Object.freeze({ name: '戌时', range: '19:00-21:00', branch: '戌' }),
  Object.freeze({ name: '亥时', range: '21:00-23:00', branch: '亥' }),
  Object.freeze({ name: '晚子时', range: '23:00-24:00', branch: '子' }),
]);

/**
 * 二十八宿动物校勘表：lunar-typescript 的宿动物有 2 处与旧实现的本地校勘表写法不同
 * （对拍实测 28 宿全扫，仅这 2 处：壁水貐 / 胃土雉 为旧实现写法，库写作 壁水獝 / 胃土彘）。
 * 库方 `twentyEightStarDetail.source` 自述「二十八宿动物按本地校勘表」，即旧实现自己改过这 2 字；
 * 本内核跟随旧实现写法，以免前端宿名显示漂移（并在本表登记差异）。
 */
export const XIU_ANIMAL_FIX = Object.freeze({
  壁: '貐',
  胃: '雉',
});

/**
 * 农历月的数字写法（对拍实测：旧实现写「正月/二月/…/十月/十一月/十二月」，
 * 不使用 lunar-typescript 的「冬月/腊月」俗写；闰月加「闰」）。
 */
export const LUNAR_MONTH_NAMES = Object.freeze(['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']);

/** 宜忌表里的占位字（实测：库给 ['无'] 时旧实现输出空数组）。 */
export const TABOO_PLACEHOLDER = '无';

/** 建除十二值（次序列出，供证据层与测试断言）。 */
export const TWELVE_OFFICERS = Object.freeze(['建', '除', '满', '平', '定', '执', '破', '危', '成', '收', '开', '闭']);

/** 候选状态（本内核自订，与对拍实测的旧实现分组一致）。 */
export const CANDIDATE_STATUS = Object.freeze({
  preferred: '可用候选',
  conditional: '条件候选',
  caution: '慎用候选',
});

/** 本内核自撰的白话说辞模板。 */
export const ALMANAC_COPY = Object.freeze({
  highlightHit: (topicLabel) => `本日宜项覆盖「${topicLabel}」`,
  cautionHit: (topicLabel) => `本日忌项触及「${topicLabel}」`,
  cautionAllTaboo: (topicLabel) => `本日明列诸事不宜，不列入「${topicLabel}」首选`,
  hardConstraints: Object.freeze([
    (startDate, endDate) => `只比较 ${startDate} 至 ${endDate} 范围内的候选日期`,
    (topicLabel) => `事项限定为「${topicLabel}」，不得把其他事项宜忌直接替代当前事项规则`,
    () => '命中当前事项明确忌项、诸事不宜时列为慎用候选；同组内有明确宜项命中者靠前，组内按日期升序',
    () => '没有参与人资料时不得编造个人适配结论',
  ]),
  realityConstraints: Object.freeze([
    () => '场地、证件、人员到场、交通、预算、天气、办理窗口与安全要求优先于传统排序',
    () => '现实条件未提供时只列待核验项，不假设其已经满足',
    () => '传统规则互相冲突时并列展示支持与限制，不合成为成功率或吉凶总分',
    () => '本内核不含月相天文背景（旧实现的月相字段由调用方按需另取），候选排序不看月相',
  ]),
});

/** 规则表冻结汇总（供 capability 与测试读取口径文字）。 */
export const ALMANAC_RULES = Object.freeze({
  source: '建除/二十八宿/九星/彭祖百忌/冲煞/十二神/日宜忌 取自 lunar-typescript@1.8.6；全年方位神与事项关键词表为公有领域传统内容',
  dateRange: Object.freeze({ minYear: 1900, maxYear: 2100, maxDaysPerCall: 180 }),
  topics: TOPICS,
  topicKeys: ALMANAC_TOPIC_KEYS,
  nineStarRule: '换向边界＝夏至/冬至当天最近的甲子日；顺相位锚定起点＝一白，逆相位锚定末端＝一白，相位内每日 ±1',
  hoursRule: '13 个时辰（早子时 00:00-01:00 … 亥时 21:00-23:00、晚子时 23:00-24:00）；晚子时按次日日干起五鼠遁',
  candidateStatusRule: '命中本事项忌项或该日宜项明列「诸事不宜」→ 慎用候选；否则可用候选',
  daysOrderRule: '状态（可用→条件→慎用）→ 有宜项命中者在前 → 日期升序',
  participantsRule: '对拍实测旧实现忽略 participants（输出恒为 []），本内核照此',
  allTaboosText: ALL_PURPOSES_TABOO,
});

/**
 * 取某事项的权威定义。
 * @param {string} topic 事项键
 * @returns {{key:string,label:string,yiKeywords:ReadonlyArray<string>,jiKeywords:ReadonlyArray<string>}}
 */
export function almanacTopic(topic) {
  const def = TOPICS[topic];
  if (!def) throw new RangeError(`未收录的黄历事项类型: ${topic}`);
  return { key: topic, label: def.label, yiKeywords: def.yiKeywords, jiKeywords: def.jiKeywords };
}

/**
 * 九星序号（1–9）→ 权威九星对象。
 * @param {number} index 1–9
 * @returns {object} 冻结的九星对象
 */
export function nineStar(index) {
  const i = Math.trunc(index);
  const found = NINE_STARS.find((x) => x.index === i);
  if (!found) throw new RangeError(`九星序号越界（1–9）: ${index}`);
  return found;
}

/**
 * 由「相位边界表」求某日九星序号（纯函数；边界表由调用方按历法算出）。
 * 口径见文件头第 3 条：顺相位锚定起点、逆相位锚定末端，均为「一白」。
 *
 * @param {number} jdn 目标日期的儒略日数
 * @param {ReadonlyArray<{jdn:number, type:'顺'|'逆'}>} boundaries 升序边界表（至少覆盖目标日）
 * @returns {number} 九星序号 1–9
 */
export function nineStarIndexFromPhases(jdn, boundaries) {
  if (!Array.isArray(boundaries) || boundaries.length < 2) throw new RangeError('相位边界表至少需要两个边界');
  let idx = -1;
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    if (jdn >= boundaries[i].jdn && jdn < boundaries[i + 1].jdn) { idx = i; break; }
  }
  if (idx < 0) throw new RangeError(`相位边界表未覆盖该日期（jdn=${jdn}）`);
  const cur = boundaries[idx];
  const next = boundaries[idx + 1];
  const mod9 = (n) => ((n % 9) + 9) % 9;
  if (cur.type === '顺') return mod9(jdn - cur.jdn) + 1;
  return mod9(next.jdn - 1 - jdn) + 1;
}

/**
 * 全年方位神：流年支 → 12 项 {god, branch, direction}（太岁位＝流年支，顺推）。
 * @param {string} yearBranch 流年支（如「巳」）
 * @returns {Array<{god:string,branch:string,direction:string}>}
 */
export function annualDirectionGods(yearBranch) {
  const ZHI = Object.keys(BRANCH_DIRECTION_NAMES);
  const start = ZHI.indexOf(yearBranch);
  if (start < 0) throw new RangeError(`未收录的地支：${yearBranch}`);
  return ANNUAL_DIRECTION_GOD_ORDER.map((god, k) => {
    const branch = ZHI[(start + k) % 12];
    return { god, branch, direction: BRANCH_DIRECTION_NAMES[branch] };
  });
}

/**
 * 神煞名校勘：把 lunar-typescript 的 i18n 键换成中文（其余名字原样返回）。
 * @param {string} name 原始名
 * @returns {string} 中文名
 */
export function fixXiongShaName(name) {
  return XIONG_SHA_NAME_FIX[name] || name;
}

/**
 * 二十八宿动物校勘：按宿名取旧实现写法（仅 壁→貐、胃→雉 两处与库不同）。
 * @param {string} xiu 宿名（如「壁」）
 * @param {string} libAnimal 库返回的动物名
 * @returns {string} 校勘后的动物名
 */
export function fixXiuAnimal(xiu, libAnimal) {
  return XIU_ANIMAL_FIX[xiu] || libAnimal;
}

/**
 * 农历月的中文写法（数字写法 + 闰月前缀）。
 * @param {number} rawMonth lunar-typescript 的 getMonth()（负数＝闰月）
 * @returns {string} 如「十一月」「闰四月」
 */
export function lunarMonthText(rawMonth) {
  const abs = Math.abs(Math.trunc(rawMonth));
  const name = LUNAR_MONTH_NAMES[abs - 1];
  if (!name) throw new RangeError(`农历月份越界: ${rawMonth}`);
  return `${rawMonth < 0 ? '闰' : ''}${name}月`;
}

/**
 * 宜忌占位字清理：库给 ['无'] 时旧实现输出空数组（对拍实测）。
 * @param {ReadonlyArray<string>} items 日宜/日忌条目
 * @returns {Array<string>} 去掉占位字后的条目
 */
export function cleanTabooItems(items) {
  return items.filter((x) => x !== TABOO_PLACEHOLDER);
}

/**
 * 事项命中：在「条目列表」里按关键词取匹配项（**保持条目列表的原次序**，与对拍实测一致）。
 * @param {ReadonlyArray<string>} items 日宜/日忌条目
 * @param {ReadonlyArray<string>} keywords 事项关键词
 * @returns {Array<string>} 命中条目（按 items 原序）
 */
export function matchTopicItems(items, keywords) {
  const set = new Set(keywords);
  return items.filter((x) => set.has(x));
}

export default ALMANAC_RULES;
