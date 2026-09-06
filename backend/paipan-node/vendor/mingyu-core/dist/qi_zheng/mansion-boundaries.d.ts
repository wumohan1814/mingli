export interface QizhengMansionStar {
    mansion: string;
    chineseName: string;
    simbadId: string;
    raJ2000Degrees: number;
    decJ2000Degrees: number;
    pmRaMasPerYear: number;
    pmDecMasPerYear: number;
}
export interface QizhengMansionBoundary extends QizhengMansionStar {
    longitude: number;
    widthDegrees: number;
}
/**
 * 明清修订后保持觜前参后的二十八宿距星目录。
 *
 * 星宿与西名对应采用中文维基百科固定版本 oldid=92223725，并按其所述乾隆十七年
 * 修订采用觜宿一（猎户座 lambda）与参宿一（猎户座 zeta）。ICRS/J2000 坐标及自行
 * 来自 SIMBAD TAP `basic` 表的 ra、dec、pmra、pmdec 字段，查询日期 2026-07-27。
 */
export declare const QIZHENG_MANSION_STARS: readonly QizhengMansionStar[];
export declare const QIZHENG_MANSION_MODEL: {
    readonly id: "qizheng-mansion-stars-simbad-astronomy-engine";
    readonly catalogEpoch: "J2000.0 / ICRS";
    readonly mappingSource: "https://zh.wikipedia.org/w/index.php?title=二十八宿&oldid=92223725";
    readonly astrometrySource: "SIMBAD TAP basic 表（ra、dec、pmra、pmdec；查询日期 2026-07-27）";
    readonly transformSource: "Astronomy Engine 2.1.19 同口径内置变换：IAU 2006 岁差与 IAU 2000B 章动，将 J2000 平赤道坐标转为目标日期真黄道坐标";
    readonly limitation: "宿界按距星目标日期真黄经至下一距星真黄经的实际弧段划分；这是可复算的现代坐标复原，不等同于某一历史历元的古赤道距度表，也不证明占星解释有效。";
};
export declare function calculateQizhengMansionBoundaries(date: Date): QizhengMansionBoundary[];
export declare function longitudeToQizhengMansion(longitude: number, boundaries: readonly QizhengMansionBoundary[]): {
    xiu: string;
    xiuDegree: number;
};
