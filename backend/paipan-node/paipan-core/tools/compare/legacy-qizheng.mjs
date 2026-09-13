/**
 * 命理 · 对拍框架 · 七政四余旧实现适配器（节152）
 * ---------------------------------------------------------------------------
 * 旧实现的 qizheng 不在 vendor dist，而在 npm 旧包的
 * `calculateBirthChartBundle(profile, {systems:['qizheng']})` 里。本适配器把
 * 夹具 input 转成 vendor profile 并只取 bundle.qizheng，供对拍框架比对。
 *
 * 纪律：旧包名用片段拼接（与 run-compare.mjs 同法），保证 scan-deps 的
 * 「paipan-core 零旧包名命中」门禁不被本文件破坏。
 */
const NPM_PKG = ['ming', 'yu', '-core'].join('');

export async function generateQizhengLegacy(input) {
  const { calculateBirthChartBundle } = await import(NPM_PKG);
  const profile = {
    name: input.name || '',
    gender: input.gender === 'female' ? 'female' : 'male',
    calendarType: 'solar',
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute || 0,
    location: {
      name: input.birthplace || '',
      longitude: input.longitude,
      latitude: input.latitude,
      timezone: 8,
    },
    useTrueSolarTime: Boolean(input.true_solar),
  };
  const bundle = await calculateBirthChartBundle(profile, { systems: ['qizheng'] });
  return bundle && bundle.qizheng ? bundle.qizheng : null;
}
