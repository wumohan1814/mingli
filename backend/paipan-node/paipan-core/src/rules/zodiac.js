/**
 * 命理 · 自研排盘内核 · 单一权威规则源 · 生肖流年（zodiac）
 * ---------------------------------------------------------------------------
 * 「单一权威规则源」纪律（README §2）：本文件是生肖流年这门术数的**唯一权威规则位置**。
 * capabilities/zodiac/、对拍框架、测试、未来 server.mjs 适配层**只能读不能抄**：
 * 凡是要用十二地支关系表、三合/三会/六合/六冲/六刑/六害/六破、天乙贵人、太岁星君名、
 * 五行生克的地方，一律从这里取；任何地方出现第二份拷贝即视为缺陷。
 *
 * == 规则来源（每条都标来源；古籍/传统口诀属公有领域）==
 *   - 十二地支固定关系（六冲 / 六合 / 三合 / 三会 / 六害 / 六破 / 三刑 / 自刑）：
 *     通行十二地支关系表（公有领域传统内容），如《三命通会》《渊海子平》一系所载关系。
 *   - 三合局排序：按各局长生 → 帝旺 → 墓 的固定次序列出「本支之外的两支」
 *     （对拍实测与旧实现一致：鼠→「猴、龙」，牛→「蛇、鸡」，虎→「马、狗」，兔→「猪、羊」，
 *      龙→「猴、鼠」，蛇→「鸡、牛」，马→「虎、狗」，羊→「猪、兔」，猴→「鼠、龙」，
 *      鸡→「蛇、牛」，狗→「虎、马」，猪→「兔、羊」）。
 *   - 天乙贵人：公有领域传统口诀「甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，
 *     六辛逢马虎」——对拍实测旧实现按该口诀的**书写次序**输出（如辛年给「马、虎」，
 *     不是「虎、马」），本文件照此次序。
 *   - 六十甲子太岁星君名（值年太岁）：传统道教六十甲子神名，公网采源见下方 TAI_SUI_SOURCE。
 *   - 五行生克：木生火→火生土→土生金→金生水→水生木；木克土→土克水→水克火→火克金→金克木。
 *   - 白话音/文案：**本文件自行撰写**（按主题从零生成），不复制旧实现任何句子。
 *
 * == 对拍实测确认的口径（黑盒探针，禁止读旧实现源码）==
 *   1. yearGanZhi 由 `year` 直接按六十甲子推算（**不看立春**）：1900 → 庚子、2026 → 丙午。
 *      year 必须为 1900–2200 的整数，否则抛错（实测旧实现报「year 必须是 1900-2200 之间的整数」）。
 *   2. `relation` 取「流年年干五行」与「生肖地支本气五行」的生克文字：
 *      年干五行生生肖地支本气 / 生肖地支本气生年干五行 / 生肖地支本气克年干五行 /
 *      年干五行克生肖地支本气 / 年干五行与生肖地支本气同类。
 *   3. `elementRelation.classification`：年干生生肖 = 有利关系；生肖生年干 = 风险关系；
 *      年干克生肖 = 风险关系；生肖克年干 = 中性关系；同类 = 中性关系。
 *   4. `conflicts` 顺序固定为 值太岁 → 冲太岁 → 刑太岁 → 害太岁 → 破太岁；值为流年支。
 *   5. `noble`：流年支与生肖支六合 → 「六合贵人」；三合 → 「三合贵人（X局）」；
 *      否则回落到该生肖固定的「三合：A、B；六合：C」。
 *   6. `meeting`：流年支与生肖支同属一个三会方 → 「三会关系（方位五行）」；否则 null。
 *   7. `zodiacWuxing` 是**盘面展示文案**（土支带藏干）：水（子）/ 土（丑，己土）/ 木（寅）…
 *
 * 纪律：零依赖、零 IO、零网络、零随机数、零「当前时间」。纯数据 + 纯函数。
 */

/** 太岁星君名来源 URL（公网采源登记；60 甲子→星君名 为传统道教内容）。 */
export const TAI_SUI_SOURCE = Object.freeze([
  'https://baike.baidu.com/item/%E5%A4%AA%E5%B2%81%E7%A5%9E',
  'https://zhuanlan.zhihu.com/p/349444835',
]);

/** 十二地支（固定次序：子…亥）。 */
export const ZODIAC_BRANCHES = Object.freeze(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);

/** 十二生肖（与 ZODIAC_BRANCHES 同序）。 */
export const ZODIAC_ANIMALS = Object.freeze(['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']);

/**
 * 十二生肖权威表：生肖 → 地支 / 地支本气五行 / 盘面展示文案。
 * wuxingDisplay 与旧实现一致（土支标注藏干本气：丑未己土、辰戌戊土）。
 */
const ZODIAC_TABLE = Object.freeze([
  Object.freeze({ zodiac: '鼠', branch: '子', wuxing: '水', wuxingDisplay: '水（子）' }),
  Object.freeze({ zodiac: '牛', branch: '丑', wuxing: '土', wuxingDisplay: '土（丑，己土）' }),
  Object.freeze({ zodiac: '虎', branch: '寅', wuxing: '木', wuxingDisplay: '木（寅）' }),
  Object.freeze({ zodiac: '兔', branch: '卯', wuxing: '木', wuxingDisplay: '木（卯）' }),
  Object.freeze({ zodiac: '龙', branch: '辰', wuxing: '土', wuxingDisplay: '土（辰，戊土）' }),
  Object.freeze({ zodiac: '蛇', branch: '巳', wuxing: '火', wuxingDisplay: '火（巳）' }),
  Object.freeze({ zodiac: '马', branch: '午', wuxing: '火', wuxingDisplay: '火（午）' }),
  Object.freeze({ zodiac: '羊', branch: '未', wuxing: '土', wuxingDisplay: '土（未，己土）' }),
  Object.freeze({ zodiac: '猴', branch: '申', wuxing: '金', wuxingDisplay: '金（申）' }),
  Object.freeze({ zodiac: '鸡', branch: '酉', wuxing: '金', wuxingDisplay: '金（酉）' }),
  Object.freeze({ zodiac: '狗', branch: '戌', wuxing: '土', wuxingDisplay: '土（戌，戊土）' }),
  Object.freeze({ zodiac: '猪', branch: '亥', wuxing: '水', wuxingDisplay: '水（亥）' }),
]);

/** 天干五行（甲乙木、丙丁火、戊己土、庚辛金、壬癸水）。 */
export const GAN_WUXING = Object.freeze({
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
});

/** 六十甲子天干 / 地支（推算用）。 */
export const GAN = Object.freeze(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']);

/**
 * 三合局：每局按「长生 → 帝旺 → 墓」固定次序列出三支，并记局名（用于「三合贵人（X局）」）。
 * 局名次序照传统：申子辰水局、巳酉丑金局、寅午戌火局、亥卯未木局。
 */
const SAN_HE_GROUPS = Object.freeze([
  Object.freeze({ name: '水局', branches: Object.freeze(['申', '子', '辰']) }),
  Object.freeze({ name: '金局', branches: Object.freeze(['巳', '酉', '丑']) }),
  Object.freeze({ name: '火局', branches: Object.freeze(['寅', '午', '戌']) }),
  Object.freeze({ name: '木局', branches: Object.freeze(['亥', '卯', '未']) }),
]);

/** 六合（子丑、寅亥、卯戌、辰酉、巳申、午未）。 */
const LIU_HE = Object.freeze([['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']]);

/** 三会方（亥子丑北方水、寅卯辰东方木、巳午未南方火、申酉戌西方金）。 */
const SAN_HUI_GROUPS = Object.freeze([
  Object.freeze({ name: '北方水', branches: Object.freeze(['亥', '子', '丑']) }),
  Object.freeze({ name: '东方木', branches: Object.freeze(['寅', '卯', '辰']) }),
  Object.freeze({ name: '南方火', branches: Object.freeze(['巳', '午', '未']) }),
  Object.freeze({ name: '西方金', branches: Object.freeze(['申', '酉', '戌']) }),
]);

/** 六冲（子午、丑未、寅申、卯酉、辰戌、巳亥）。 */
const LIU_CHONG = Object.freeze([['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']]);

/** 六害（子未、丑午、寅巳、卯辰、申亥、酉戌）。 */
const LIU_HAI = Object.freeze([['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌']]);

/** 六破（子酉、午卯、巳申、寅亥、辰丑、戌未）。 */
const LIU_PO = Object.freeze([['子', '酉'], ['午', '卯'], ['巳', '申'], ['寅', '亥'], ['辰', '丑'], ['戌', '未']]);

/**
 * 三刑：无礼之刑（子卯）、恃势之刑（寅巳申）、无恩之刑（丑戌未）、自刑（辰午酉亥）。
 * 对拍实测：同支相刑只在自刑四支成立（辰辰、午午、酉酉、亥亥），其余同支不刑。
 */
const SAN_XING = Object.freeze([
  Object.freeze({ name: '无礼之刑', branches: Object.freeze(['子', '卯']) }),
  Object.freeze({ name: '恃势之刑', branches: Object.freeze(['寅', '巳', '申']) }),
  Object.freeze({ name: '无恩之刑', branches: Object.freeze(['丑', '戌', '未']) }),
]);
const ZI_XING = Object.freeze(['辰', '午', '酉', '亥']);

/**
 * 天乙贵人：年干 → 贵人所落地支（**按传统口诀书写次序**，对拍实测一致）。
 * 口诀：甲戊庚牛羊、乙己鼠猴乡、丙丁猪鸡位、壬癸兔蛇藏、六辛逢马虎。
 */
const TIAN_YI = Object.freeze({
  甲: Object.freeze(['丑', '未']),
  戊: Object.freeze(['丑', '未']),
  庚: Object.freeze(['丑', '未']),
  乙: Object.freeze(['子', '申']),
  己: Object.freeze(['子', '申']),
  丙: Object.freeze(['亥', '酉']),
  丁: Object.freeze(['亥', '酉']),
  壬: Object.freeze(['卯', '巳']),
  癸: Object.freeze(['卯', '巳']),
  辛: Object.freeze(['午', '寅']),
});

/**
 * 六十甲子 → 值年太岁星君名（传统道教六十甲子神名，公网采源见 TAI_SUI_SOURCE）。
 * 次序＝六十甲子次序（甲子、乙丑、…、癸亥）。
 */
const TAI_SUI_NAMES = Object.freeze([
  '金辨', '陈材', '耿章', '沈悌', '赵达', '郭灿', '王济', '李素', '刘旺', '康志',
  '施广', '任保', '郭嘉', '汪文', '鲁先', '龙仲', '董德', '郑但', '陆明', '魏仁',
  '方杰', '蒋崇', '白敏', '封济', '邹铛', '潘佐', '邬桓', '范宁', '彭泰', '徐斝',
  '章词', '杨仙', '管仲', '唐杰', '姜武', '谢焘', '卢秘', '杨信', '贺谔', '皮时',
  '李诚', '吴遂', '文哲', '缪丙', '徐浩', '程宝', '倪秘', '叶坚', '丘德', '朱得',
  '张朝', '万清', '辛亚', '杨彦', '黎卿', '傅党', '毛梓', '石政', '洪充', '虞程',
]);

/** 太岁关系类型与次序（对拍实测：多命中时按此序输出）。 */
export const TAI_SUI_CONFLICT_ORDER = Object.freeze(['值太岁', '冲太岁', '刑太岁', '害太岁', '破太岁']);

/**
 * 太岁关系对应「本内核自撰」的现实复核提示（现代白话，按主题从零生成，不复制旧实现文案）。
 * 语义与传统含义一致：值＝本命年、冲＝对立变动、刑＝摩擦规章、害＝间接损耗、破＝小缺口。
 */
export const TAI_SUI_CONFLICT_COPY = Object.freeze({
  值太岁: '本命年，外界变化与自我要求容易一起被放大，重要决定宜多做一轮复核。',
  冲太岁: '与流年地支相冲，变动感与对立感偏多，重大调整前宜先留好备选方案。',
  刑太岁: '与流年地支相刑，规则、沟通与来回反复的摩擦需要更细致地处理。',
  害太岁: '与流年地支相害，信息差、边界含糊带来的间接影响值得提前留意。',
  破太岁: '与流年地支相破，计划容易冒出小缺口，资源与约定宜早一步核对。',
});

/** 生肖固定关系（六冲/六害/六破/三刑）在「本年未冲太岁」时的提示前缀（自撰格式）。 */
export const ZODIAC_BASELINE_COPY = Object.freeze({
  chong: '相冲',
  hai: '相害',
  po: '相破',
  xing: '相刑',
});

/** 五行对生肖的行动取向（自撰，按生肖本气五行给一句稳妥取向）。 */
export const ZODIAC_ELEMENT_ACTION = Object.freeze({
  水: '水主智，宜以灵活与长期积累应对变化；顺势多结善缘，逆势少冒进、少口舌。',
  土: '土主稳，宜守成与深耕；顺势可拓根基，逆势少固执硬扛。',
  木: '木主生，宜持续生长与铺路；顺势可扩张，逆势先扎根、缓求速成。',
  火: '火主明，宜抓住节奏与曝光；顺势可加速，逆势避免急躁与透支。',
  金: '金主断，宜理清边界与取舍；顺势可决断，逆势少硬碰、多留余地。',
});

/** 三合贵人 / 六合贵人命中时的行动信号（自撰）。 */
export const ZODIAC_ACTION_SIGNALS = Object.freeze({
  值太岁: '重要决定多做一轮现实复核',
  冲太岁: '重大变动前预留备选方案',
  刑太岁: '合同、规则与沟通内容尽量留痕',
  六合三合: '有合作或求助机会时，先看对方是否真正可靠',
});

/**
 * 三合/六合贵人说明（自撰现代白话，按生肖从零生成；键＝生肖，值＝该生肖三合贵人说明与六合贵人说明）。
 */
const NOBLE_EXPLAIN = Object.freeze({
  鼠: Object.freeze({ sanhe: '鼠与猴、龙成水局：三者都灵活善谋，聚在一起思路开阔、回旋余地大。', liuhe: '鼠与牛六合：机敏遇上沉稳，牛的笃定能安住鼠的多思。' }),
  牛: Object.freeze({ sanhe: '牛与蛇、鸡成金局：三者都重秩序与成效，条理清楚、稳步积累。', liuhe: '牛与鼠六合：踏实遇上机巧，鼠的灵活能松动牛的固执。' }),
  虎: Object.freeze({ sanhe: '虎与马、狗成火局：三者都热情重义，行动果决、互相壮胆。', liuhe: '虎与猪六合：刚勇遇上宽厚，猪的松弛能让虎的冲劲更有回旋。' }),
  兔: Object.freeze({ sanhe: '兔与猪、羊成木局：三者都温和包容，气氛松弛、少有碰撞。', liuhe: '兔与狗六合：温婉遇上忠诚，狗的守护能给兔更多底气。' }),
  龙: Object.freeze({ sanhe: '龙与猴、鼠成水局：三者都善谋善变，格局开阔、点子不断。', liuhe: '龙与鸡六合：恢弘遇上精细，鸡的考究能把蓝图落到细处。' }),
  蛇: Object.freeze({ sanhe: '蛇与鸡、牛成金局：三者都重分寸与积累，沉稳有度、步步为营。', liuhe: '蛇与猴六合：深沉遇上灵巧，猴的机变能激活蛇的谋略。' }),
  马: Object.freeze({ sanhe: '马与虎、狗成火局：三者都直率重情，意气相投、彼此策应。', liuhe: '马与羊六合：奔放遇上温厚，羊的柔顺能让马的躁进收得住。' }),
  羊: Object.freeze({ sanhe: '羊与猪、兔成木局：三者都平和包容，气息相融、少有龃龉。', liuhe: '羊与马六合：温润遇上昂扬，马的劲头能带动羊的行动力。' }),
  猴: Object.freeze({ sanhe: '猴与鼠、龙成水局：三者都善思善变，智计绵密、腾挪有方。', liuhe: '猴与蛇六合：灵动遇上沉静，蛇的定力能稳住猴的飘忽。' }),
  鸡: Object.freeze({ sanhe: '鸡与蛇、牛成金局：三者都讲究分寸与成效，稳健扎实、循序渐进。', liuhe: '鸡与龙六合：精细遇上恢弘，龙的格局能托起鸡的细致。' }),
  狗: Object.freeze({ sanhe: '狗与虎、马成火局：三者都重情重义，肝胆相照、共赴一事。', liuhe: '狗与兔六合：忠诚遇上温婉，兔的细腻能柔化狗的硬朗。' }),
  猪: Object.freeze({ sanhe: '猪与兔、羊成木局：三者都温润少争，安和顺遂、相互濡养。', liuhe: '猪与虎六合：宽厚遇上刚勇，虎的担当能让猪更敢往前。' }),
});

/** 生肖流年规则的冻结汇总（供 capability 与测试逐条断言）。 */
export const ZODIAC_RULES = Object.freeze({
  source: '通行十二地支关系表 + 传统太岁星君名（公有领域传统内容）',
  taiSuiSource: TAI_SUI_SOURCE,
  yearRange: Object.freeze({ min: 1900, max: 2200 }),
  yearGanZhiRule: '按年份直接推六十甲子，不看立春（对拍实测与旧实现一致）',
  conflictOrder: TAI_SUI_CONFLICT_ORDER,
  nobleRule: '六合命中→「六合贵人」；三合命中→「三合贵人（X局）」；否则→该生肖固定「三合：A、B；六合：C」',
  meetingRule: '流年支与生肖支同属一个三会方→「三会关系（方位五行）」，否则 null',
  evidenceGrade: '轻量',
  interpretationBoundary: '仅限生肖与流年关系',
});

/* ------------------------------ 纯函数 ------------------------------ */

/** 取模（保证非负）。 */
function mod(n, m) {
  return ((Math.trunc(n) % m) + m) % m;
}

/** 生肖（如「鼠」）→ 该生肖的权威表项；非法输入抛出 RangeError。 */
export function zodiacEntry(zodiac) {
  if (typeof zodiac !== 'string') throw new RangeError(`生肖必须是文本：${typeof zodiac}`);
  const found = ZODIAC_TABLE.find((item) => item.zodiac === zodiac);
  if (!found) throw new RangeError(`未收录的生肖：${zodiac}`);
  return found;
}

/** 地支 → 生肖。 */
export function branchZodiac(branch) {
  const i = ZODIAC_BRANCHES.indexOf(branch);
  if (i < 0) throw new RangeError(`未收录的地支：${branch}`);
  return ZODIAC_ANIMALS[i];
}

/** 地支本气五行。 */
export function branchWuxing(branch) {
  const i = ZODIAC_BRANCHES.indexOf(branch);
  if (i < 0) throw new RangeError(`未收录的地支：${branch}`);
  return ZODIAC_TABLE[i].wuxing;
}

/** 年份（1900–2200 整数）→ 六十甲子。 */
export function yearGanZhi(year) {
  if (!Number.isInteger(year) || year < ZODIAC_RULES.yearRange.min || year > ZODIAC_RULES.yearRange.max) {
    throw new RangeError(`year 必须是 ${ZODIAC_RULES.yearRange.min}-${ZODIAC_RULES.yearRange.max} 之间的整数。`);
  }
  const offset = mod(year - 4, 60);
  return `${GAN[offset % 10]}${ZODIAC_BRANCHES[offset % 12]}`;
}

/** 干支（如「丙午」）→ 值年太岁星君名。 */
export function taiSuiName(ganZhi) {
  if (typeof ganZhi !== 'string' || ganZhi.length !== 2) throw new RangeError(`干支必须是两字：${ganZhi}`);
  const gi = GAN.indexOf(ganZhi[0]);
  const zi = ZODIAC_BRANCHES.indexOf(ganZhi[1]);
  if (gi < 0 || zi < 0) throw new RangeError(`干支无法解析：${ganZhi}`);
  let index = -1;
  for (let i = 0; i < 60; i += 1) if (i % 10 === gi && i % 12 === zi) { index = i; break; }
  if (index < 0) throw new RangeError(`干支不合法（干支阴阳不配）：${ganZhi}`);
  return TAI_SUI_NAMES[index];
}

/** 干支 → {yearBranch, star}（与旧实现 getYearTaiSui 同形状）。 */
export function yearTaiSui(ganZhi) {
  return { yearBranch: ganZhi.slice(1), star: taiSuiName(ganZhi) };
}

/** 三元关系工具：判断两支是否命中某对表。 */
function hits(pairs, a, b) {
  return pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** 六合伙伴（无则 null）。 */
export function liuHePartner(branch) {
  for (const [x, y] of LIU_HE) {
    if (x === branch) return y;
    if (y === branch) return x;
  }
  return null;
}

/** 三合局（含局名与「本支之外两张，按长生→帝旺→墓次序」）；未收录抛出。 */
export function sanHeGroup(branch) {
  for (const group of SAN_HE_GROUPS) {
    if (group.branches.includes(branch)) {
      const partners = group.branches.filter((b) => b !== branch);
      return { name: group.name, branches: group.branches, partners };
    }
  }
  throw new RangeError(`未收录的地支：${branch}`);
}

/** 三会方（含方位五行名）；不属于任何三会方时返回 null。 */
export function sanHuiGroup(branch) {
  for (const group of SAN_HUI_GROUPS) if (group.branches.includes(branch)) return group;
  return null;
}

/** 三刑名（两支相刑时返回刑名，否则 null）。 */
export function sanXingName(a, b) {
  if (a === b) return ZI_XING.includes(a) ? '自刑' : null;
  for (const group of SAN_XING) if (group.branches.includes(a) && group.branches.includes(b)) return group.name;
  return null;
}

/** 六冲 / 六害 / 六破 判定。 */
export const isLiuChong = (a, b) => hits(LIU_CHONG, a, b);
export const isLiuHai = (a, b) => hits(LIU_HAI, a, b);
export const isLiuPo = (a, b) => hits(LIU_PO, a, b);
export const isLiuHe = (a, b) => hits(LIU_HE, a, b);

/** 三合命中判定（同局且不同支）。 */
export function isSanHe(a, b) {
  if (a === b) return false;
  return sanHeGroup(a).branches.includes(b);
}

/** 五行生克关系：from → to。 */
export const WUXING_SHENG = Object.freeze({ 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' });
export const WUXING_KE = Object.freeze({ 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' });

/**
 * 年干五行 vs 生肖地支本气五行 → 关系文字、结构化类型、分类。
 * 对拍实测口径（见文件头 2、3 条）。
 */
export function elementRelation(yearStemWuxing, zodiacWuxing) {
  if (yearStemWuxing === zodiacWuxing) {
    return { kind: '同类', label: '年干五行与生肖地支本气同类', classification: '中性关系' };
  }
  if (WUXING_SHENG[yearStemWuxing] === zodiacWuxing) {
    return { kind: '年干生生肖', label: '年干五行生生肖地支本气', classification: '有利关系' };
  }
  if (WUXING_SHENG[zodiacWuxing] === yearStemWuxing) {
    return { kind: '生肖生年干', label: '生肖地支本气生年干五行', classification: '风险关系' };
  }
  if (WUXING_KE[zodiacWuxing] === yearStemWuxing) {
    return { kind: '生肖克年干', label: '生肖地支本气克年干五行', classification: '中性关系' };
  }
  return { kind: '年干克生肖', label: '年干五行克生肖地支本气', classification: '风险关系' };
}

/** 年干 → 天乙贵人（两支，按传统口诀书写次序）；未收录返回 null。 */
export function tianYiPartners(yearGan) {
  const branches = TIAN_YI[yearGan];
  if (!branches) return null;
  return { branches, animals: branches.map((b) => branchZodiac(b)) };
}

/** 生肖三合/六合说明文案（自撰）与天乙贵人注（自撰）。 */
export function nobleNotes(zodiac) {
  const entry = NOBLE_EXPLAIN[zodiac];
  if (!entry) throw new RangeError(`未收录的生肖：${zodiac}`);
  const san = sanHeGroup(zodiacEntry(zodiac).branch);
  const he = liuHePartner(zodiacEntry(zodiac).branch);
  return {
    sanhe: { partners: san.partners.map((b) => branchZodiac(b)), explain: entry.sanhe },
    liuhe: { partner: branchZodiac(he), explain: entry.liuhe },
  };
}

/** 生肖固定关系基线（未命中太岁冲突时用于「风险关系」提示，自撰格式）。 */
export function baselineRelations(zodiac) {
  const branch = zodiacEntry(zodiac).branch;
  const out = [];
  for (const b of ZODIAC_BRANCHES) {
    if (b !== branch && isLiuChong(branch, b)) out.push(`${ZODIAC_BASELINE_COPY.chong}：${branchZodiac(b)}`);
  }
  for (const b of ZODIAC_BRANCHES) {
    if (b !== branch && isLiuHai(branch, b)) out.push(`${ZODIAC_BASELINE_COPY.hai}：${branchZodiac(b)}`);
  }
  for (const b of ZODIAC_BRANCHES) {
    if (b !== branch && isLiuPo(branch, b)) out.push(`${ZODIAC_BASELINE_COPY.po}：${branchZodiac(b)}`);
  }
  const xingTargets = ZODIAC_BRANCHES.filter((b) => b !== branch && sanXingName(branch, b) !== null);
  if (xingTargets.length) {
    const name = sanXingName(branch, xingTargets[0]);
    out.push(`${ZODIAC_BASELINE_COPY.xing}：${xingTargets.map((b) => branchZodiac(b)).join('、')}（${name}）`);
  }
  return out;
}

export default ZODIAC_RULES;
