/**
 * 命理 · 自研排盘内核 · 五运六气规则表（单一权威源）
 * ===========================================================================
 * 本文件是「五运六气」能力的**唯一权威规则位置**（README §2）：五运/六气查表、
 * 五步六步边界、符会定义、平气判定、气运相临、输出文案模板，全部在这里并 Object.freeze。
 * capabilities/、fixtures、tests 一律从这里取，**任何地方出现第二份拷贝 = 缺陷**。
 *
 * ---------------------------------------------------------------------------
 * 一、规则来源（公网采源；引用的是**公有领域古籍原文/传统口径**，不涉及任何第三方代码文本）
 * ---------------------------------------------------------------------------
 *  ①《黄帝内经·素问·天元纪大论篇第六十六》
 *     · 天干化五运：「甲己之岁，土运统之；乙庚之岁，金运统之；丙辛之岁，水运统之；
 *        丁壬之岁，木运统之；戊癸之岁，火运统之。」
 *     · 地支化六气：「子午之岁，上见少阴；丑未之岁，上见太阴；寅申之岁，上见少阳；
 *        卯酉之岁，上见阳明；辰戌之岁，上见太阳；巳亥之岁，上见厥阴。」
 *     · 六气标本：「厥阴之上，风气主之；少阴之上，热气主之；太阴之上，湿气主之；
 *        少阳之上，相火主之；阳明之上，燥气主之；太阳之上，寒气主之。」
 *     · 符会提出：「应天为天符，承岁为岁直（岁会），三合为治（太乙天符）。」
 *  ②《黄帝内经·素问·至真要大论篇第七十四》
 *     · 六气司天气化与「病本于某脏」：厥阴司天病本于脾、少阴司天病本于肺、
 *        太阴司天病本于肾、少阳司天病本于肺、阳明司天病本于肝、太阳司天病本于心。
 *     · 司天之气所胜治则：「风淫所胜，平以辛凉，佐以苦甘，以甘缓之，以酸泻之；
 *        热淫所胜，平以咸寒，佐以苦甘，以酸收之；湿淫所胜，平以苦热，佐以酸辛，
 *        以苦燥之，以淡泄之；火淫所胜，平以酸冷，佐以苦甘，以酸收之……；
 *        燥淫所胜，平以苦湿，佐以酸辛，以苦下之；寒淫所胜，平以辛热，佐以甘苦，
 *        以咸泻之。」
 *  ③《运气要诀》清·吴谦
 *     · 客运：「起以所化，统主本年中运为初运，五行相生，以次轮取」；阴干为少（不及），
 *        阳干为太（太过）。
 *     · 五音主客太少相生：「主运角徵宫商羽，五音太少中运取。」（主运五步＝木火土金水
 *        顺布，太少以中运所在一步为准，前后交替）
 *     · 主气六步：「初之气，厥阴风木；二之气，少阴君火；三之气，少阳相火；
 *        四之气，太阴湿土；五之气，阳明燥金；六之气，太阳寒水。」
 *     · 客气司天在泉：「司天即是三气位，在泉六气位当然」，自下（在泉）而升，依次加临。
 *     · 五步交司：「大寒起，至春分后十二日，主初运也。春分十三日起，至芒种后九日，
 *        主二运也。芒种十日起，至处暑后六日，主三运也。处暑七日起，至立冬后三日，
 *        主四运也。立冬四日起，至小寒末日，主五运也。」
 *     · 六步节令：「大寒、立春、雨水、惊蛰，主初之气也；春分、清明、谷雨、立夏，
 *        主二之气也；小满、芒种、夏至、小暑，主三之气也；大暑、立秋、处暑、白露，
 *        主四之气也；秋分、寒露、霜降、立冬，主五之气也；小雪、大雪、冬至、小寒，
 *        主终之气也。」
 *     · 气运相临：「气生中运曰顺化，运被气克天刑言。运生天气乃小逆，运克司天不和愆。
 *        气运相同天符岁。」
 *     · 符会：「天符中运同天气，岁会本运临本支，四正四维皆岁会，太乙天符符会俱。
 *        同天符与同岁会，泉同中运即同司，阴岁名曰同岁会，阳年同天符所知。」
 *        （天符十二年、太乙天符四年、岁会八年、同天符六年、同岁会六年；合计六十年中二十八年）
 *     · 平气：「太过被抑，不及得助，皆曰平运。」并列出五运平气/太过/不及之纪名
 *        （平：敷和、升明、备化、审平、静顺；太过：发生、赫曦、敦阜、坚成、流衍；
 *         不及：委和、伏明、卑监、从革、涸流）。
 *  ④ 交司日期的**公历落点**由内核唯一依赖 `lunar-typescript@1.8.6` 的二十四节气日提供
 *     （与旧实现 1900–2199 共 3300 条边界逐条实测一致，见 tools/_probe/wuyun/probe-06）。
 *
 * ---------------------------------------------------------------------------
 * 二、本内核采用口径（对拍实测锁定；非唯一流派规则）
 * ---------------------------------------------------------------------------
 *  1. **年干支**：按公历年换算＝六十甲子序 `(year - 4) mod 60`（等价于「以公历年内
 *     立春后所属干支纪年」）。与生辰八字的「立春精确时刻换年」是两套口径，本节不混用。
 *  2. **合历年范围 1900–2199**：交司日期依赖节气表；旧实现对范围外年份抛错，
 *     本内核同样抛错（不猜、不外推）。
 *  3. **平气判定**：以「年支五行 × 司天五行」与中运五行的生克关系对判定，见 PING_QI_RULES。
 *     该关系对表在 1900–2199 共 300 年（即 60 甲子 × 5 轮）上与旧实现 **100% 一致**，
 *     其解等价于每 60 年 10 个平气干支：戊辰、戊戌、庚子（太过被抑）／乙酉、丁亥、己丑、
 *     辛卯、癸巳、辛亥、己未（不及得助）。
 *     ⚠️ **已登记的口径差异**：《运气要诀》原注举「乙卯（金运不及遇燥金司天）为同气」
 *     亦入平气；旧实现未把乙卯计为平气，本内核以**对拍一致**为准（乙卯＝非平气）。
 *  4. **符会逐年名单**：按①③的定义逐年判定，不引用任何汇总数反改规则；每 60 年
 *     去重后为 26 年（天符 12 ∪ 岁会 8 ∪ 同天符 6 ∪ 同岁会 6，其中太乙天符 4 年为
 *     天符∩岁会），与《运气要诀》所记「六十年中只得二十八年」不完全吻合，见
 *     SOURCE_RECONCILIATION.handling（同一差异旧实现亦已登记）。
 *  5. **白话文案**：本文件的文案模板与 capability 内生成的现代白话**按主题从零自撰**
 *     （依据为上述公网古籍原文的规则与治则），不从任何第三方实现复制；因此对拍报告里
 *     这些字段会以「信息性差异」逐条列出（关键字段不含白话文案，见 fixtures 说明）。
 */

/** 合历年份范围（含端点）。 */
export const YEAR_RANGE = Object.freeze({ min: 1900, max: 2199 });

/** 六十甲子基准：year ≡ 4 (mod 60) 为「甲子」。 */
export const JIAZI_EPOCH_OFFSET = 4;

/** 十天干（序＝甲0…癸9）。 */
export const GAN = Object.freeze('甲乙丙丁戊己庚辛壬癸');

/** 十二地支（序＝子0…亥11）。 */
export const ZHI = Object.freeze('子丑寅卯辰巳午未申酉戌亥');

/** 天干化五运（天元纪大论：甲己土、乙庚金、丙辛水、丁壬木、戊癸火）。 */
export const GAN_YUN_ELEMENT = Object.freeze({
  甲: '土', 己: '土',
  乙: '金', 庚: '金',
  丙: '水', 辛: '水',
  丁: '木', 壬: '木',
  戊: '火', 癸: '火',
});

/** 天干阴阳（阳干＝太过，阴干＝不及）。 */
export const GAN_YIN_YANG = Object.freeze({
  甲: '阳', 丙: '阳', 戊: '阳', 庚: '阳', 壬: '阳',
  乙: '阴', 丁: '阴', 己: '阴', 辛: '阴', 癸: '阴',
});

/** 五行相生（木→火→土→金→水→木）。 */
export const WU_XING_SHENG = Object.freeze({ 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' });

/** 五行相克（木克土…金克木）。 */
export const WU_XING_KE = Object.freeze({ 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' });

/** 五运次序（主运顺布：木火土金水）。 */
export const WU_YUN_ORDER = Object.freeze(['木', '火', '土', '金', '水']);

/** 五行→五音（木角、火徵、土宫、金商、水羽）。 */
export const WU_YIN_BY_ELEMENT = Object.freeze({ 木: '角', 火: '徵', 土: '宫', 金: '商', 水: '羽' });

/** 五行→气候之气（木风、火热、土湿、金燥、水寒）。 */
export const CLIMATE_QI_BY_ELEMENT = Object.freeze({ 木: '风', 火: '热', 土: '湿', 金: '燥', 水: '寒' });

/** 地支→十二地支五行（支之本气）。 */
export const ZHI_ELEMENT = Object.freeze({
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
});

/** 六气（三阴三阳本气；序＝客气升降之次：厥阴→少阴→少阳→太阴→阳明→太阳）。 */
export const LIU_QI = Object.freeze([
  Object.freeze({ name: '厥阴风木', phase: '厥阴', qi: '风', element: '木' }),
  Object.freeze({ name: '少阴君火', phase: '少阴', qi: '君火', element: '火' }),
  Object.freeze({ name: '少阳相火', phase: '少阳', qi: '相火', element: '火' }),
  Object.freeze({ name: '太阴湿土', phase: '太阴', qi: '湿', element: '土' }),
  Object.freeze({ name: '阳明燥金', phase: '阳明', qi: '燥', element: '金' }),
  Object.freeze({ name: '太阳寒水', phase: '太阳', qi: '寒', element: '水' }),
]);

/** 地支→司天六气名（天元纪大论）。 */
export const ZHI_SITIAN_NAME = Object.freeze({
  子: '少阴君火', 午: '少阴君火',
  丑: '太阴湿土', 未: '太阴湿土',
  寅: '少阳相火', 申: '少阳相火',
  卯: '阳明燥金', 酉: '阳明燥金',
  辰: '太阳寒水', 戌: '太阳寒水',
  巳: '厥阴风木', 亥: '厥阴风木',
});

/** 在泉＝司天之后第三位（司天居三之气、在泉居终之气，相隔三气；按下表升降之次）。 */
export const ZAIQUAN_STEP_OFFSET = 3;

/**
 * 客气升降之次（三阴三阳相生之序，非「厥阴→少阴→太阴→少阳→阳明→太阳」的常序）：
 *   一阳→二阳→三阳→一阴→二阴→三阴→（复起一阳）
 *   ＝ 少阳相火 → 阳明燥金 → 太阳寒水 → 厥阴风木 → 少阴君火 → 太阴湿土
 * 依据《运气要诀·客气司天在泉间气歌》注：「气由下而升上，故以在下之阳明起之，
 * 阳明二阳，二阳生三阳，三阳太阳，故太阳寒水为客初气……一阳生二阳，二阳阳明，
 * 故阳明为客六气，即在泉之气也。」
 * 由此：客初之气＝在泉之后一步，客三之气＝司天，客终之气＝在泉。
 */
export const GUEST_QI_CYCLE = Object.freeze([
  '少阳相火', '阳明燥金', '太阳寒水', '厥阴风木', '少阴君火', '太阴湿土',
]);

/**
 * 司天 → 在泉（升降之次上相隔三位）。
 * @param {string} sitianName 司天六气名
 * @returns {string} 在泉六气名
 */
export function zaiquanNameOfSitian(sitianName) {
  const idx = GUEST_QI_CYCLE.indexOf(sitianName);
  if (idx < 0) throw new Error(`未知司天六气: ${sitianName}`);
  return GUEST_QI_CYCLE[(idx + ZAIQUAN_STEP_OFFSET) % GUEST_QI_CYCLE.length];
}

/**
 * 客气第 stepNo 步（1＝初之气 … 6＝终之气）的六气名。
 * 口径：自在泉起，按升降之次逐步加临 —— 客三之气即司天，客终之气即在泉。
 *
 * @param {string} sitianName 司天六气名
 * @param {number} stepNo 步序号（1–6）
 * @returns {string} 该步客气名
 */
export function guestQiNameAtStep(sitianName, stepNo) {
  const idx = GUEST_QI_CYCLE.indexOf(sitianName);
  if (idx < 0) throw new Error(`未知司天六气: ${sitianName}`);
  return GUEST_QI_CYCLE[(idx + ZAIQUAN_STEP_OFFSET + stepNo) % GUEST_QI_CYCLE.length];
}

/** 主气六步次序（初之气…终之气）＝六气常序下标 0…5。 */
export const HOST_QI_ORDER = Object.freeze([0, 1, 2, 3, 4, 5]);

/** 司天所在步（1 起）＝3；在泉所在步＝6。 */
export const SITIAN_STEP = 3;
export const ZAIQUAN_STEP = 6;

/** 五步（主运/客运）标签。 */
export const MOVEMENT_STEP_LABELS = Object.freeze(['初运', '二运', '三运', '四运', '五运']);

/**
 * 五步交司边界（《运气要诀·运气分主节令歌》）。
 *   solarTerm  起始节气名（取该年此节气之公历日）
 *   offsetDays 自该节气日起第几日（0＝当日）
 *   endTerm    结束边界所据节气名；'NEXT_DAHAN_SKIP_ONE' 表示「次年大寒前一日」
 *   endOffset  结束边界的日偏移（相对 endTerm 当日）
 */
export const MOVEMENT_STEPS = Object.freeze([
  Object.freeze({
    label: '初运', startTerm: '大寒', offsetDays: 0, endTerm: '春分', endOffset: 12,
    periodRule: '大寒日起，至春分后第12日',
  }),
  Object.freeze({
    label: '二运', startTerm: '春分', offsetDays: 13, endTerm: '芒种', endOffset: 9,
    periodRule: '春分后第13日起，至芒种后第9日',
  }),
  Object.freeze({
    label: '三运', startTerm: '芒种', offsetDays: 10, endTerm: '处暑', endOffset: 6,
    periodRule: '芒种后第10日起，至处暑后第6日',
  }),
  Object.freeze({
    label: '四运', startTerm: '处暑', offsetDays: 7, endTerm: '立冬', endOffset: 3,
    periodRule: '处暑后第7日起，至立冬后第3日',
  }),
  Object.freeze({
    label: '五运', startTerm: '立冬', offsetDays: 4, endTerm: 'NEXT_DAHAN', endOffset: -1,
    periodRule: '立冬后第4日起，至小寒末日',
  }),
]);

/** 交司边界精度标注（本内核只到「日」，不细化到时刻）。 */
export const BOUNDARY_PRECISION = '传统日期序号';

/** 六步（主气/客气）标签。 */
export const QI_STEP_LABELS = Object.freeze(['初之气', '二之气', '三之气', '四之气', '五之气', '终之气']);

/**
 * 六步节气分组（《运气要诀·运气分主节令歌》）。
 *   boundaryTerm 该步起始节气（＝上一步结束的次日）
 */
export const QI_STEPS = Object.freeze([
  Object.freeze({ label: '初之气', solarTerms: Object.freeze(['大寒', '立春', '雨水', '惊蛰']), boundaryTerm: '大寒' }),
  Object.freeze({ label: '二之气', solarTerms: Object.freeze(['春分', '清明', '谷雨', '立夏']), boundaryTerm: '春分' }),
  Object.freeze({ label: '三之气', solarTerms: Object.freeze(['小满', '芒种', '夏至', '小暑']), boundaryTerm: '小满' }),
  Object.freeze({ label: '四之气', solarTerms: Object.freeze(['大暑', '立秋', '处暑', '白露']), boundaryTerm: '大暑' }),
  Object.freeze({ label: '五之气', solarTerms: Object.freeze(['秋分', '寒露', '霜降', '立冬']), boundaryTerm: '秋分' }),
  Object.freeze({ label: '终之气', solarTerms: Object.freeze(['小雪', '大雪', '冬至', '小寒']), boundaryTerm: '小雪' }),
]);

/** 本能力需要从节气表取用的节气名（其余节气不参与运算）。 */
export const REQUIRED_SOLAR_TERMS = Object.freeze([
  '大寒', '春分', '芒种', '处暑', '立冬', '小满', '大暑', '秋分', '小雪',
]);

/** 五步/六步的角色标注。 */
export const GUEST_ROLE = Object.freeze({
  movementFirst: '中运起点',
  sitian: '司天',
  zaiquan: '在泉',
});

/** 五行关系名（以主体 a 对 b 而言）。 */
export const REL_SAME = '同';
export const REL_BEGETS_ME = '生我';
export const REL_I_BEGET = '我生';
export const REL_CONTROLS_ME = '克我';
export const REL_I_CONTROL = '我克';

/** 气运相临（司天 × 中运）五类（《运气要诀·六十年运气上下相临歌》）。 */
export const ANNUAL_RELATION_KINDS = Object.freeze(['同气', '顺化', '天刑', '小逆', '不和']);

/** 五步/六步主客关系五类。 */
export const HOST_GUEST_RELATION_KINDS = Object.freeze(['同气', '主生客', '客生主', '主克客', '客克主']);

/** 符会五项名（顺序即输出 `names` 与 `facts` 的顺序）。 */
export const CONFORMITY_NAMES = Object.freeze(['天符', '岁会', '太乙天符', '同天符', '同岁会']);

/**
 * 岁会「本运临本支之位」（四正四维）：木运临卯、火运临午、土运临辰戌丑未、金运临酉、水运临子。
 * 表义：年支 → 该支所能「临」的中运五行。
 */
export const ZHI_BENWEI_ELEMENT = Object.freeze({
  卯: '木', 午: '火', 辰: '土', 戌: '土', 丑: '土', 未: '土', 酉: '金', 子: '水',
});

/**
 * 平气判定（「太过被抑，不及得助」；关系对 = [年支对中运的关系, 司天对中运的关系]）。
 * 该表在 1900–2199 共 300 年上与旧实现 100% 一致（等价 10 个平气干支/60 年）。
 */
export const PING_QI_RULES = Object.freeze({
  // 太过被抑：年支泄之（我生）＋司天克之（克我）
  太过: Object.freeze([Object.freeze([REL_I_BEGET, REL_CONTROLS_ME])]),
  // 不及得助：年支助之/司天助之，或年支泄而司天助
  不及: Object.freeze([
    Object.freeze([REL_SAME, REL_SAME]),
    Object.freeze([REL_SAME, REL_BEGETS_ME]),
    Object.freeze([REL_SAME, REL_I_BEGET]),
    Object.freeze([REL_BEGETS_ME, REL_SAME]),
    Object.freeze([REL_I_BEGET, REL_BEGETS_ME]),
  ]),
});

/** 平气/太过/不及之纪名（《运气要诀·五运平气太过不及歌》）。 */
export const YUN_PING_QI_NAME = Object.freeze({ 木: '敷和', 火: '升明', 土: '备化', 金: '审平', 水: '静顺' });
export const YUN_TAI_GUO_NAME = Object.freeze({ 木: '发生', 火: '赫曦', 土: '敦阜', 金: '坚成', 水: '流衍' });
export const YUN_BU_JI_NAME = Object.freeze({ 木: '委和', 火: '伏明', 土: '卑监', 金: '从革', 水: '涸流' });

/** 平气类型标签（枚举，进关键字段）。 */
export const PING_QI_TYPE = Object.freeze({ ping: '平气之岁', taiGuo: '太过偏亢', buJi: '不及偏虚' });

/** 中运强弱（太过/不及）标签。 */
export const YUN_STRENGTH = Object.freeze({ yang: '太过', yin: '不及' });

/** 五音太少（阳干为太、阴干为少）。 */
export const TONE_STRENGTH = Object.freeze({ yang: '太', yin: '少' });

/**
 * 司天 × 病机白话（本内核自撰，依据《素问·至真要大论》「某淫所胜」民病与「病本于某脏」）。
 *   affectedZangFu        受候脏腑（病本之脏）
 *   climaticPathology     气候之胜与常见见证（自撰概述）
 *   treatmentGuideline    治则（《素问·至真要大论》司天之气所胜原文）
 */
export const SITIAN_PATHOMECHANISM = Object.freeze({
  厥阴风木: Object.freeze({
    affectedZangFu: '肝木偏胜，病本于脾',
    climaticPathology: '风淫所胜，多见耳鸣掉眩、肠鸣飧泄、体重食减、肌肉痿瘦',
    treatmentGuideline: '风淫所胜，平以辛凉，佐以苦甘，以甘缓之，以酸泻之',
  }),
  少阴君火: Object.freeze({
    affectedZangFu: '心火偏胜，病本于肺',
    climaticPathology: '热淫所胜，多见胸中烦热、咳喘鼽衄、疮疡溺赤、肩背臂痛',
    treatmentGuideline: '热淫所胜，平以咸寒，佐以苦甘，以酸收之',
  }),
  少阳相火: Object.freeze({
    affectedZangFu: '相火偏胜，病本于肺',
    climaticPathology: '火淫所胜，多见头痛发热、目赤喉痹、咳唾血、胸中热',
    treatmentGuideline: '火淫所胜，平以酸冷，佐以苦甘，以酸收之',
  }),
  太阴湿土: Object.freeze({
    affectedZangFu: '脾湿偏胜，病本于肾',
    climaticPathology: '湿淫所胜，多见胕肿骨痛、腰脊头项痛、饥不欲食、咳唾有血',
    treatmentGuideline: '湿淫所胜，平以苦热，佐以酸辛，以苦燥之，以淡泄之',
  }),
  阳明燥金: Object.freeze({
    affectedZangFu: '肺燥偏胜，病本于肝',
    climaticPathology: '燥淫所胜，多见心胁暴痛、嗌干面尘、咳而腹鸣、腰痛目昧',
    treatmentGuideline: '燥淫所胜，平以苦湿，佐以酸辛，以苦下之',
  }),
  太阳寒水: Object.freeze({
    affectedZangFu: '肾寒偏胜，病本于心',
    climaticPathology: '寒淫所胜，多见厥心痛、呕血血泄、面赤目黄、善悲时眩仆',
    treatmentGuideline: '寒淫所胜，平以辛热，佐以苦甘，以咸泻之',
  }),
});

/** 年干支口径说明（信息性字段，不入关键字段）。 */
export const YEAR_GAN_ZHI_SOURCE = '公历年内换年（六十甲子序）';

/** 符会逐年名单与古籍汇总数的校勘说明模板（数值由本内核规则算得，见 tests 断言）。 */
export const SOURCE_RECONCILIATION = Object.freeze({
  distinctYearsByListedRules: 26,
  sourceSummaryYears: 28,
  handling: '按天符、岁会、太乙天符、同天符、同岁会逐项定义在六十甲子中去重，得 26 年；'
    + '《运气要诀》原文汇总作「六十年中只得二十八年」。本内核采用逐项定义与逐年名单，'
    + '不用汇总数反改规则。',
});

/** 免责与口径说明（进生产契约，非关键字段）。 */
export const LIMITATIONS = Object.freeze([
  '五步交司按《运气要诀》的传统日期序号（某节气后第几日）表达，不换算为现代精确到时刻的交运时间。',
  '六步区间按二十四节气日整日切分，给出的是年度节律骨架，不含逐日气象推算。',
  '年干支按公历年换算，与生辰八字「立春精确时刻换年」的纪年口径不同，两者不可互相替换。',
  '传统运气模型属于节律分类框架，不能替代地域气候资料、个人体质资料或医疗诊断。',
  '符会与气运相临按《运气要诀》通行口径逐年判定，不延伸为疾病轻重或现实事件的预测。',
]);

/** 规则来源登记（公网 URL；古籍为公有领域原文）。 */
export const RULE_SOURCES = Object.freeze([
  Object.freeze({
    title: '《黄帝内经·素问·天元纪大论篇第六十六》',
    url: 'https://www.zhongyibaodian.com/huangdisuwen/100-3-66.html',
    scope: '天干化五运、地支化六气、六气标本，以及「应天为天符，承岁为岁直」的符会来源。',
  }),
  Object.freeze({
    title: '《黄帝内经·素问·至真要大论篇第七十四》',
    url: 'https://www.zhongyibaodian.com/huangdisuwen/100-3-74.html',
    scope: '六气司天之化与「病本于某脏」，以及司天之气所胜的治则原文。',
  }),
  Object.freeze({
    title: '《运气要诀》清·吴谦',
    url: 'https://lfglib.cn/text/medicinelib/205235.html',
    scope: '客运起中运相生、五音太少相生、主气六步、司天在泉间气、五步交司日期、六步节气分组、'
      + '气运相临（顺化/天刑/小逆/不和）、天符/岁会/太乙天符/同天符/同岁会定义、平气「太过被抑，不及得助」。',
  }),
]);

/**
 * 五行关系判定（以 a 为主体对 b 而言）。
 * @param {string} a 主体五行
 * @param {string} b 对方五行
 * @returns {'同'|'生我'|'我生'|'克我'|'我克'} 关系名
 */
export function wuXingRelation(a, b) {
  if (a === b) return REL_SAME;
  if (WU_XING_SHENG[a] === b) return REL_I_BEGET;
  if (WU_XING_SHENG[b] === a) return REL_BEGETS_ME;
  if (WU_XING_KE[a] === b) return REL_I_CONTROL;
  if (WU_XING_KE[b] === a) return REL_CONTROLS_ME;
  return '未知';
}

/**
 * 干支纪年（公历年 → 干支）。
 * @param {number} year 公历年
 * @returns {string} 两字干支
 */
export function ganZhiOfYear(year) {
  const idx = ((year - JIAZI_EPOCH_OFFSET) % 60 + 60) % 60;
  return GAN[idx % 10] + ZHI[idx % 12];
}

/** 全部规则聚合（供需要整体遍历的调用方使用；内容与上面各表同一引用）。 */
export const WUYUN_RULES = Object.freeze({
  yearRange: YEAR_RANGE,
  jiaziEpochOffset: JIAZI_EPOCH_OFFSET,
  gan: GAN,
  zhi: ZHI,
  ganYunElement: GAN_YUN_ELEMENT,
  ganYinYang: GAN_YIN_YANG,
  wuXingSheng: WU_XING_SHENG,
  wuXingKe: WU_XING_KE,
  wuYunOrder: WU_YUN_ORDER,
  wuYinByElement: WU_YIN_BY_ELEMENT,
  climateQiByElement: CLIMATE_QI_BY_ELEMENT,
  zhiElement: ZHI_ELEMENT,
  liuQi: LIU_QI,
  zhiSitianName: ZHI_SITIAN_NAME,
  zaiquanStepOffset: ZAIQUAN_STEP_OFFSET,
  guestQiCycle: GUEST_QI_CYCLE,
  hostQiOrder: HOST_QI_ORDER,
  sitianStep: SITIAN_STEP,
  zaiquanStep: ZAIQUAN_STEP,
  movementStepLabels: MOVEMENT_STEP_LABELS,
  movementSteps: MOVEMENT_STEPS,
  boundaryPrecision: BOUNDARY_PRECISION,
  qiStepLabels: QI_STEP_LABELS,
  qiSteps: QI_STEPS,
  requiredSolarTerms: REQUIRED_SOLAR_TERMS,
  guestRole: GUEST_ROLE,
  annualRelationKinds: ANNUAL_RELATION_KINDS,
  hostGuestRelationKinds: HOST_GUEST_RELATION_KINDS,
  conformityNames: CONFORMITY_NAMES,
  zhiBenweiElement: ZHI_BENWEI_ELEMENT,
  pingQiRules: PING_QI_RULES,
  yunPingQiName: YUN_PING_QI_NAME,
  yunTaiGuoName: YUN_TAI_GUO_NAME,
  yunBuJiName: YUN_BU_JI_NAME,
  pingQiType: PING_QI_TYPE,
  yunStrength: YUN_STRENGTH,
  toneStrength: TONE_STRENGTH,
  sitianPathomechanism: SITIAN_PATHOMECHANISM,
  yearGanZhiSource: YEAR_GAN_ZHI_SOURCE,
  sourceReconciliation: SOURCE_RECONCILIATION,
  limitations: LIMITATIONS,
  sources: RULE_SOURCES,
});
