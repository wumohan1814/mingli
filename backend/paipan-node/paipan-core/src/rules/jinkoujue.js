/**
 * 命理 · 自研排盘内核 · 单一权威规则源 · 金口诀（jinkoujue）
 * ---------------------------------------------------------------------------
 * 「单一权威规则源」纪律（见 README §2）：本文件是金口诀这门术数的**唯一权威规则位置**。
 * 调用方（capabilities/jinkoujue、测试）只能从这里取表；任何第二份拷贝即缺陷。
 *
 * 通用干支/五行/阴阳/贵人/月将表**从大六壬规则源复用**（liuren.js 已是权威位置，
 * 不再拷贝一份——规则漂移是已知教训）；本文件只定义金口诀特有的规则：
 *   十二贵神次序与本属、五子元遁用法、四位五行归属、月令旺衰、旬空、
 *   阴阳发用表、五动三动表、比合歌表、四象类象、口径文本模板。
 *
 * 口径来源（黑盒对拍实测与旧实现逐条一致；古籍文本从公网采源，见各条标注）：
 *   - 四柱/月将/昼夜/贵人/旬空：与旧实现逐条实测一致（420+ 例扫描 + 12 中气边界）
 *   - 十二贵神本属：探针 12 地分全表实测（勾陈=戊辰土、螣蛇=丁巳火 等，见下）
 *   - 贵神顺逆：贵人支临 亥子丑寅卯辰 顺布、巳午未申酉戌 逆布（10 日干×昼夜 20 例）
 *   - 阴阳发用：4 位阴阳计数 → 二阴二阳以将神、三阳一阴以唯一阴位、三阴一阳以唯一阳位、
 *     纯阳以贵神（纯阳反阴）、纯阴以将神（纯阴反阳）
 *   - 五动三动：五动 = 妻动(人元克地分)/官动(贵神克人元)/贼动(贵神克将神)/财动(将神克贵神)/鬼动(地分克人元)；
 *     三动 = 兄弟动(人元比和地分)/子孙动(人元生地分)/父母动(地分生人元)；同课多动按
 *     妻→官→贼→财→鬼（五动）→三动 次序（实测一课多动样例排序）
 *   - 比合歌：四位五行计数 ≥3 用「三X」句（四同亦用三X句）、=2 用「二X」句（两对按
 *     木火土金水序拼接）、全不同用「四位五行周流」句
 *   - 月令旺衰：旺=与月同、相=月生我、休=我生月、囚=我克月、死=月克我（实测校准）
 *   - 旬空：日柱旬空二支；位支落入 → isVoid=true、constraints 追加「落日旬空」
 *
 * 文案/释义来源（现代白话自撰；古籍篇名采自旧实现 source 字段引用的书名，正文自撰）：
 *   - 五动/三动/比合歌正文：公版《六壬神课金口诀古本》采源（URL 见文末）
 *   - 四象类象与发用 rule 白话：现代通行整理，白话自撰
 *
 * 纪律：零依赖、零 IO、零网络、零随机数、零「当前时间」。纯数据 + 纯函数。
 */
import {
  ZHI,
  GAN,
  ZHI_WUXING,
  GAN_WUXING,
  SHENG,
  KE,
  GAN_YY,
  ZHI_YY,
  WU_SHU_DUN,
  NOBLEMAN_TABLE,
  MONTH_LEADER_BY_ZHONGQI,
  TIAN_JIANG_ORDER,
  HOUR_LABELS,
} from './liuren.js';

/** 时辰标签（复用大六壬：0=早子时 … 12=晚子时）。 */
export { HOUR_LABELS };

/** 十二地支 / 十天干 / 五行 / 阴阳（复用大六壬权威表）。 */
export { ZHI, GAN, ZHI_WUXING, GAN_WUXING, SHENG, KE, GAN_YY, ZHI_YY, WU_SHU_DUN, NOBLEMAN_TABLE, MONTH_LEADER_BY_ZHONGQI };

/** 十二贵神次序（贵人起，顺序固定；与 TIAN_JIANG_ORDER 一致）。 */
export const GUI_SHEN_ORDER = TIAN_JIANG_ORDER;

/**
 * 十二贵神本属干支表（黑盒探针 12 地分全表实测，见 _probe/jinkoujue/probe3）：
 *   贵人己丑土、螣蛇丁巳火、朱雀丙午火、六合乙卯木、勾陈戊辰土、青龙甲寅木、
 *   天空戊戌土、白虎庚申金、太常己未土、玄武壬子水、太阴辛酉金、天后癸亥水。
 * 值 = { gan, zhi, wuxing }：zhi 用于「贵神支」（element=本属五行）、gan 用于
 * guiShenRule 文本「贵神本属X支Y」（注意：positions.guiShen.stem 是**遁干**，不是本属干）。
 */
export const GUI_SHEN_BENSHU = Object.freeze({
  贵人: Object.freeze({ gan: '己', zhi: '丑', wuxing: '土' }),
  螣蛇: Object.freeze({ gan: '丁', zhi: '巳', wuxing: '火' }),
  朱雀: Object.freeze({ gan: '丙', zhi: '午', wuxing: '火' }),
  六合: Object.freeze({ gan: '乙', zhi: '卯', wuxing: '木' }),
  勾陈: Object.freeze({ gan: '戊', zhi: '辰', wuxing: '土' }),
  青龙: Object.freeze({ gan: '甲', zhi: '寅', wuxing: '木' }),
  天空: Object.freeze({ gan: '戊', zhi: '戌', wuxing: '土' }),
  白虎: Object.freeze({ gan: '庚', zhi: '申', wuxing: '金' }),
  太常: Object.freeze({ gan: '己', zhi: '未', wuxing: '土' }),
  玄武: Object.freeze({ gan: '壬', zhi: '子', wuxing: '水' }),
  太阴: Object.freeze({ gan: '辛', zhi: '酉', wuxing: '金' }),
  天后: Object.freeze({ gan: '癸', zhi: '亥', wuxing: '水' }),
});

/**
 * 贵神顺逆规则：贵人支临地盘 亥(11)子(0)丑(1)寅(2)卯(3)辰(4) → 顺布；
 * 巳(5)午(6)未(7)申(8)酉(9)戌(10) → 逆布（黑盒探针 10 日干×昼夜 20 例实测，与大六壬同）。
 */
export const NOBLEMAN_DIRECTION_RULE = Object.freeze({
  rule: '贵人支临亥子丑寅卯辰六宫顺布，临巳午未申酉戌六宫逆布',
});

/**
 * 四象类象（positions.*.role 固定文本，黑盒实测固定表，进门禁）。
 */
export const SI_XIANG_ROLES = Object.freeze({
  diFen: '四象中的田宅、子孙、奴仆、鞍马与六畜位',
  jiangShen: '四象中的己身、妻财、亲戚与内位',
  guiShen: '四象中的主、臣、父与官禄位',
  renYuan: '四象中的客、天、君、祖与外位',
});

/**
 * 月令旺衰：旺=与月同、相=月生我、休=我生月、囚=我克月、死=月克我（探针实测校准）。
 * 键 = 月支五行；值 = 目标五行 → 旺相休囚死。
 */
export const SEASON_STATE_BY_MONTH = Object.freeze(
  Object.fromEntries(
    ['木', '火', '土', '金', '水'].map((monthEl) => {
      const map = {};
      for (const el of ['木', '火', '土', '金', '水']) {
        let s;
        if (el === monthEl) s = '旺';
        else if (SHENG[monthEl] === el) s = '相';
        else if (SHENG[el] === monthEl) s = '休';
        else if (KE[el] === monthEl) s = '囚';
        else s = '死';
        map[el] = s;
      }
      return [monthEl, Object.freeze(map)];
    }),
  ),
);

/**
 * 阴阳发用表：4 位阴阳计数 → { pattern, usePosition, rule }。
 * 注意：人元阴阳 = 遁干阴阳，而遁干与地分支阴阳恒同（五鼠遁子时干恒阳、
 * 干序奇偶=支序奇偶，推导见能力文件注释），故唯一阴/阳位只会落在将神或贵神。
 */
export const YIN_YANG_USE = Object.freeze({
  二阴二阳: Object.freeze({ pattern: '二阴二阳', usePosition: '将神', rule: '二阴二阳，以将神为用' }),
  三阳一阴: Object.freeze({ pattern: '三阳一阴', usePosition: '唯一阴位', rule: '三阳一阴，以唯一阴位为用' }),
  三阴一阳: Object.freeze({ pattern: '三阴一阳', usePosition: '唯一阳位', rule: '三阴一阳，以唯一阳位为用' }),
  纯阳: Object.freeze({ pattern: '纯阳', usePosition: '贵神', rule: '纯阳反阴，以贵神为用' }),
  纯阴: Object.freeze({ pattern: '纯阴', usePosition: '将神', rule: '纯阴反阳，以将神为用' }),
});

/**
 * 五动三动表（黑盒扫描 420+ 例穷举，trigger 形式「{from}{五行}{克/生/比和}{to}{五行}」）：
 *   五动 = 妻动(人元克地分)/官动(贵神克人元)/贼动(贵神克将神)/财动(将神克贵神)/鬼动(地分克人元)
 *   三动 = 兄弟动(人元比和地分)/子孙动(人元生地分)/父母动(地分生人元)
 * 同课多动按 妻→官→贼→财→鬼（五动）→三动 次序（实测一课多动样例排序）。
 */
export const MOVEMENTS = Object.freeze([
  { category: '五动', name: '妻动', from: '人元', to: '地分', relation: '克', source: '《六壬神课金口诀古本》“五动爻诵”' },
  { category: '五动', name: '官动', from: '贵神', to: '人元', relation: '克', source: '《六壬神课金口诀古本》“五动爻诵”' },
  { category: '五动', name: '贼动', from: '贵神', to: '将神', relation: '克', source: '《六壬神课金口诀古本》“五动爻诵”' },
  { category: '五动', name: '财动', from: '将神', to: '贵神', relation: '克', source: '《六壬神课金口诀古本》“五动爻诵”' },
  { category: '五动', name: '鬼动', from: '地分', to: '人元', relation: '克', source: '《六壬神课金口诀古本》“五动爻诵”' },
  { category: '三动', name: '兄弟动', from: '人元', to: '地分', relation: '比和', source: '《六壬神课金口诀古本》“三动”' },
  { category: '三动', name: '子孙动', from: '人元', to: '地分', relation: '生', source: '《六壬神课金口诀古本》“三动”' },
  { category: '三动', name: '父母动', from: '地分', to: '人元', relation: '生', source: '《六壬神课金口诀古本》“三动”' },
]);

/**
 * 比合歌表（黑盒扫描 + 定向穷举实测）：
 *   四位五行计数 ≥3 用「三X」句（四同亦用三X句，探针 6 例）；=2 用「二X」句，
 *   两对重复按 木火土金水 序用「；」拼接；全不同用「四位五行周流」句。
 */
export const BIHE_POEMS = Object.freeze({
  周流: '四位五行周流，无极偏比合之患',
  二: Object.freeze({
    木: '二木为爻，事多牵连分争',
    火: '二火为灾，多生口舌焦躁是非',
    土: '二土为滞，事多迟疑阻滞不通',
    金: '二金为刑，互见争斗刑伤折损',
    水: '二水为盗，多有暗耗漂流走失',
  }),
  三: Object.freeze({
    木: '三木为爻，同气分争牵连尤甚',
    火: '三火为灾，口舌官非焦躁极重',
    土: '三土为滞，重滞凝塞迟疑难通',
    金: '三金为刑，争斗刑伤折损极烈',
    水: '三水为盗，暗流损耗漂流难聚',
  }),
});

/** 比合歌拼接序（木火土金水）。 */
export const BIHE_ORDER = Object.freeze(['木', '火', '土', '金', '水']);

/** 口径文本模板（calculation.* 固定句；黑盒实测逐条反推，进门禁）。 */
export const CALC_TEMPLATES = Object.freeze({
  methodLabel: { time: '时间起课', branch: '指定地分', number: '数字起课', random: '随机起课' },
  inputBaseSource: { time: '占时地支序数', branch: '指定地分', number: '用户数字', random: '随机数' },
  monthLeaderRule: '按已交中气定月将',
  yuanDunRule: '五子元遁分别求人元、神干与将干',
  dayNightRule: '卯至申按昼占、酉至寅按夜占（未提供地点时采用固定时支口径）',
});

/** 古籍文案来源（公版《六壬神课金口诀古本》采源；五动三动/比合歌正文据此整理）。 */
export const JINKOUJUE_SOURCES = Object.freeze([
  { title: '《六壬神课金口诀古本》', url: 'https://zh.wikisource.org/wiki/六壬神课金口诀' },
]);

export const JINKOUJUE_RULES = Object.freeze({
  source: '口径对拍实测与旧实现一致（vendor 黑盒，420+ 例扫描）；十二贵神本属/五动三动/比合歌正文采自公版《六壬神课金口诀古本》',
  zhi: ZHI,
  gan: GAN,
  zhiWuxing: ZHI_WUXING,
  ganWuxing: GAN_WUXING,
  sheng: SHENG,
  ke: KE,
  ganYY: GAN_YY,
  zhiYY: ZHI_YY,
  guiShenOrder: GUI_SHEN_ORDER,
  guiShenBenshu: GUI_SHEN_BENSHU,
  noblemanDirectionRule: NOBLEMAN_DIRECTION_RULE,
  siXiangRoles: SI_XIANG_ROLES,
  seasonStateByMonth: SEASON_STATE_BY_MONTH,
  yinYangUse: YIN_YANG_USE,
  movements: MOVEMENTS,
  bihePoems: BIHE_POEMS,
  biheOrder: BIHE_ORDER,
  wuShuDun: WU_SHU_DUN,
  noblemanTable: NOBLEMAN_TABLE,
  monthLeaderByZhongqi: MONTH_LEADER_BY_ZHONGQI,
  hourLabels: HOUR_LABELS,
  calcTemplates: CALC_TEMPLATES,
  sources: JINKOUJUE_SOURCES,
});
