// 命理基础名词表（中文）· 节135 正文数据统一管理
// 跨领域高频专有名词：爻位/时辰/八卦/地支/生肖/星座；i18n 时整体替换为目标语言版本
// 来源：views-divination.js（YAO_LABEL/SHICHEN_ARR/MH_TRIG_NAMES）、views-zodiac.js（ZODIAC/ZD_BRANCH），零改动迁移

if (typeof CONTENT === 'undefined') window.CONTENT = {};
if (!CONTENT.basics) CONTENT.basics = {};

// 爻位（初→上）
CONTENT.basics.yaoLabel = ['初', '二', '三', '四', '五', '上'];

// 12 时辰（n=地支名，start=起始小时，range=展示时段；顺序对齐引擎 SHICHEN_PERIODS）
CONTENT.basics.shichen = [
  { n: '子', start: 23, range: '23:00–00:59' },
  { n: '丑', start: 1, range: '01:00–02:59' },
  { n: '寅', start: 3, range: '03:00–04:59' },
  { n: '卯', start: 5, range: '05:00–06:59' },
  { n: '辰', start: 7, range: '07:00–08:59' },
  { n: '巳', start: 9, range: '09:00–10:59' },
  { n: '午', start: 11, range: '11:00–12:59' },
  { n: '未', start: 13, range: '13:00–14:59' },
  { n: '申', start: 15, range: '15:00–16:59' },
  { n: '酉', start: 17, range: '17:00–18:59' },
  { n: '戌', start: 19, range: '19:00–20:59' },
  { n: '亥', start: 21, range: '21:00–22:59' }
];

// 八卦名（index 对齐三爻二进制，0 位占位空串）
CONTENT.basics.baguaTrigrams = ['', '乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];

// 十二地支（顺序对齐生肖：0=子(鼠) … 11=亥(猪)）
CONTENT.basics.dizhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 十二生肖（顺序对齐地支与 ZE_IDS 图标）
CONTENT.basics.zodiacAnimals = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

// 十二星座（简称，黄道顺序；与 pairs.js 全名（白羊座…）为简称/全称关系）
CONTENT.basics.zodiacSigns = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
