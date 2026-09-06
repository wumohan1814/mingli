import { BASIC_MAPPINGS } from './baziDefinitions.js';
import { collectEstablishedBranchFormations } from './baziFormationUtils.js';
import { WUXING } from './baziTypes.js';
import { assertEarthlyBranch, assertHeavenlyStem, assertHiddenStemsMatchPillars, assertPillars, } from './baziUtils.js';
function assertValidWuxing(value, label) {
    if (!WUXING.includes(value)) {
        throw new Error(`${label}五行无效：${value}`);
    }
}
function resolveWuxing(getWuxing, value, label) {
    const wuxing = getWuxing(value);
    assertValidWuxing(wuxing, label);
    return wuxing;
}
function assertStrengthPillars(dayMaster, pillars) {
    assertHeavenlyStem(dayMaster, '日主');
    assertPillars(pillars);
    if (dayMaster !== pillars.day.gan) {
        throw new Error(`日主与日柱天干不一致：${dayMaster}/${pillars.day.gan}`);
    }
}
function resolveCommanderEffect(dayMasterWuxing, commanderWuxing) {
    if (commanderWuxing === dayMasterWuxing) {
        return { commanderScore: 1.5, commanderEffect: '助身' };
    }
    if (BASIC_MAPPINGS.WUXING_SHENG[commanderWuxing] === dayMasterWuxing) {
        return { commanderScore: 1, commanderEffect: '生身' };
    }
    if (BASIC_MAPPINGS.WUXING_SHENG[dayMasterWuxing] === commanderWuxing) {
        return { commanderScore: -0.8, commanderEffect: '泄身' };
    }
    if (BASIC_MAPPINGS.WUXING_KE[dayMasterWuxing] === commanderWuxing) {
        return { commanderScore: -1, commanderEffect: '耗身' };
    }
    if (BASIC_MAPPINGS.WUXING_KE[commanderWuxing] === dayMasterWuxing) {
        return { commanderScore: -1.3, commanderEffect: '克身' };
    }
    return { commanderScore: 0, commanderEffect: '中性' };
}
const SUPPORTING_COMMANDER_EFFECTS = new Set(['助身', '生身']);
const CONSTRAINING_COMMANDER_EFFECTS = new Set(['泄身', '耗身', '克身']);
const SUPPORTING_FORMATION_EFFECTS = new Set(['助身', '生身']);
function resolveMonthTendency(seasonalStatus) {
    const seasonTendency = seasonalStatus.status === '旺' || seasonalStatus.status === '相'
        ? '扶身'
        : seasonalStatus.status === '囚' || seasonalStatus.status === '死'
            ? '制身'
            : '相持';
    const commanderEffect = seasonalStatus.commanderEffect ?? '中性';
    const commanderTendency = SUPPORTING_COMMANDER_EFFECTS.has(commanderEffect)
        ? '扶身'
        : CONSTRAINING_COMMANDER_EFFECTS.has(commanderEffect)
            ? '制身'
            : '相持';
    if (seasonTendency === '相持')
        return commanderTendency;
    if (commanderTendency === '相持')
        return seasonTendency;
    return seasonTendency === commanderTendency ? seasonTendency : '相持';
}
function isDirectEvidence(value) {
    return !value.includes('(');
}
function compareEvidenceCount(supporting, constraining) {
    if (supporting > constraining)
        return '扶身';
    if (constraining > supporting)
        return '制身';
    return '相持';
}
function resolveStructureTendency(formationAnalysis, rootAnalysis, supportAnalysis, constraintAnalysis) {
    const supportingFormations = formationAnalysis.formations.filter((formation) => SUPPORTING_FORMATION_EFFECTS.has(formation.effect)).length;
    const constrainingFormations = formationAnalysis.formations.length - supportingFormations;
    if (supportingFormations !== constrainingFormations) {
        return compareEvidenceCount(supportingFormations, constrainingFormations);
    }
    const directSupporting = rootAnalysis.roots.filter((root) => isDirectEvidence(root.branch)).length +
        supportAnalysis.supporters.filter((supporter) => isDirectEvidence(supporter.stem)).length;
    const directConstraining = constraintAnalysis.constraints.filter((constraint) => isDirectEvidence(constraint.stem)).length;
    if (directSupporting !== directConstraining) {
        return compareEvidenceCount(directSupporting, directConstraining);
    }
    const hiddenSupporting = rootAnalysis.roots.length + supportAnalysis.supporters.length - directSupporting;
    const hiddenConstraining = constraintAnalysis.constraints.length - directConstraining;
    return compareEvidenceCount(hiddenSupporting, hiddenConstraining);
}
export function analyzeRoot(dayMaster, pillars, hiddenStems, getWuxing) {
    assertStrengthPillars(dayMaster, pillars);
    assertHiddenStemsMatchPillars(pillars, hiddenStems);
    const roots = [];
    let totalStrength = 0;
    const dayMasterWuxing = resolveWuxing(getWuxing, dayMaster, '日主');
    Object.entries(pillars).forEach(([position, pillar]) => {
        const branchWuxing = resolveWuxing(getWuxing, pillar.zhi, `${position}柱地支`);
        const hasMainQiRoot = branchWuxing === dayMasterWuxing;
        if (branchWuxing === dayMasterWuxing) {
            roots.push({ position, branch: pillar.zhi, strength: 2 });
            totalStrength += 2;
        }
        hiddenStems[position].forEach((stem, index) => {
            if (hasMainQiRoot && index === 0) {
                return;
            }
            if (resolveWuxing(getWuxing, stem, `${position}柱藏干`) === dayMasterWuxing) {
                roots.push({ position, branch: `${pillar.zhi}(${stem})`, strength: 1 });
                totalStrength += 1;
            }
        });
    });
    return {
        roots,
        totalStrength,
        hasRoot: roots.length > 0,
        // 地支本气与日主同气即为明根；只在中余气中见同气者仍记有根，不抬成强根。
        strongRoot: roots.some((root) => isDirectEvidence(root.branch)),
    };
}
export function analyzeSupport(dayMaster, pillars, hiddenStems, getWuxing) {
    assertStrengthPillars(dayMaster, pillars);
    assertHiddenStemsMatchPillars(pillars, hiddenStems);
    const supporters = [];
    let totalStrength = 0;
    const dayMasterWuxing = resolveWuxing(getWuxing, dayMaster, '日主');
    const generatingElement = Object.entries(BASIC_MAPPINGS.WUXING_SHENG).find(([, target]) => target === dayMasterWuxing)?.[0];
    Object.entries(pillars).forEach(([position, pillar]) => {
        if (position !== 'day') {
            const stemWuxing = resolveWuxing(getWuxing, pillar.gan, `${position}柱天干`);
            const isCompanion = stemWuxing === dayMasterWuxing;
            const isResource = generatingElement ? stemWuxing === generatingElement : false;
            if (isCompanion || isResource) {
                supporters.push({ position, stem: pillar.gan, strength: 1 });
                totalStrength += 1;
            }
        }
        if (generatingElement &&
            resolveWuxing(getWuxing, pillar.zhi, `${position}柱地支`) === generatingElement) {
            supporters.push({ position, stem: pillar.zhi, strength: 1 });
            totalStrength += 1;
        }
        const branchWuxing = resolveWuxing(getWuxing, pillar.zhi, `${position}柱地支`);
        hiddenStems[position].forEach((stem, index) => {
            const hiddenWuxing = resolveWuxing(getWuxing, stem, `${position}柱藏干`);
            if (index === 0 &&
                generatingElement &&
                branchWuxing === generatingElement &&
                hiddenWuxing === generatingElement) {
                return;
            }
            if (!generatingElement || hiddenWuxing !== generatingElement) {
                return;
            }
            supporters.push({ position, stem: `${pillar.zhi}(${stem})`, strength: 0.5 });
            totalStrength += 0.5;
        });
    });
    return {
        supporters,
        totalStrength,
        hasSupport: supporters.length > 0,
    };
}
export function analyzeConstraint(dayMaster, pillars, hiddenStems, getWuxing) {
    assertStrengthPillars(dayMaster, pillars);
    assertHiddenStemsMatchPillars(pillars, hiddenStems);
    const constraints = [];
    let totalStrength = 0;
    const dayMasterWuxing = resolveWuxing(getWuxing, dayMaster, '日主');
    const generatedElement = BASIC_MAPPINGS.WUXING_SHENG[dayMasterWuxing];
    const wealthElement = BASIC_MAPPINGS.WUXING_KE[dayMasterWuxing];
    const officerElement = Object.entries(BASIC_MAPPINGS.WUXING_KE).find(([, target]) => target === dayMasterWuxing)?.[0];
    const addConstraint = (position, stem, strength) => {
        constraints.push({ position, stem, strength });
        totalStrength += strength;
    };
    const resolveConstraintStrength = (wuxing, stemStrength, branchStrength) => {
        if (!wuxing) {
            return 0;
        }
        if (wuxing === officerElement) {
            return branchStrength + 0.4;
        }
        if (wuxing === wealthElement) {
            return branchStrength;
        }
        if (wuxing === generatedElement) {
            return stemStrength;
        }
        return 0;
    };
    Object.entries(pillars).forEach(([position, pillar]) => {
        if (position !== 'day') {
            const stemWuxing = resolveWuxing(getWuxing, pillar.gan, `${position}柱天干`);
            const stemStrength = resolveConstraintStrength(stemWuxing, 1, 1.2);
            if (stemStrength > 0) {
                addConstraint(position, pillar.gan, stemStrength);
            }
        }
        const branchWuxing = resolveWuxing(getWuxing, pillar.zhi, `${position}柱地支`);
        const branchStrength = resolveConstraintStrength(branchWuxing, 1, 1.2);
        if (branchStrength > 0) {
            addConstraint(position, pillar.zhi, branchStrength);
        }
        hiddenStems[position].forEach((stem, index) => {
            const hiddenWuxing = resolveWuxing(getWuxing, stem, `${position}柱藏干`);
            if (index === 0 && branchStrength > 0 && hiddenWuxing === branchWuxing) {
                return;
            }
            const hiddenStrength = resolveConstraintStrength(hiddenWuxing, 0.5, 0.6);
            if (hiddenStrength > 0) {
                addConstraint(position, `${pillar.zhi}(${stem})`, hiddenStrength);
            }
        });
    });
    return {
        constraints,
        totalStrength,
        hasConstraint: constraints.length > 0,
    };
}
export function analyzeSeasonalStatus(dayMaster, monthBranch, getSeasonStatus, getWuxing, monthCommander) {
    assertHeavenlyStem(dayMaster, '日主');
    assertEarthlyBranch(monthBranch, '月支');
    if (monthCommander)
        assertHeavenlyStem(monthCommander, '月令司权天干');
    const season = getSeasonStatus(monthBranch);
    const dayMasterWuxing = resolveWuxing(getWuxing, dayMaster, '日主');
    const seasonStatus = season[dayMasterWuxing];
    if (!seasonStatus) {
        throw new Error(`月令旺衰数据缺失：${monthBranch}/${dayMasterWuxing}`);
    }
    const scoreMap = {
        旺: 4,
        相: 2,
        休: 0,
        囚: -2,
        死: -4,
    };
    if (!Object.hasOwn(scoreMap, seasonStatus)) {
        throw new Error(`月令旺衰状态无效：${monthBranch}/${dayMasterWuxing}/${seasonStatus}`);
    }
    const baseScore = scoreMap[seasonStatus];
    const commanderWuxing = monthCommander
        ? resolveWuxing(getWuxing, monthCommander, '月令司权天干')
        : undefined;
    const commander = commanderWuxing
        ? resolveCommanderEffect(dayMasterWuxing, commanderWuxing)
        : { commanderScore: 0, commanderEffect: '中性' };
    return {
        status: seasonStatus,
        score: Number((baseScore + (commander.commanderScore ?? 0)).toFixed(1)),
        baseScore,
        commanderStem: monthCommander,
        commanderScore: commander.commanderScore,
        commanderEffect: commander.commanderEffect,
        isTimely: seasonStatus === '旺' || seasonStatus === '相',
    };
}
export function analyzeFormation(dayMaster, pillars, getWuxing) {
    assertStrengthPillars(dayMaster, pillars);
    const dayMasterWuxing = resolveWuxing(getWuxing, dayMaster, '日主');
    const generatedElement = BASIC_MAPPINGS.WUXING_SHENG[dayMasterWuxing];
    const wealthElement = BASIC_MAPPINGS.WUXING_KE[dayMasterWuxing];
    const officerElement = Object.entries(BASIC_MAPPINGS.WUXING_KE).find(([, target]) => target === dayMasterWuxing)?.[0];
    const resourceElement = Object.entries(BASIC_MAPPINGS.WUXING_SHENG).find(([, target]) => target === dayMasterWuxing)?.[0];
    const formations = collectEstablishedBranchFormations(pillars)
        .map((formation) => {
        const monthBonus = formation.includesMonthBranch ? 0.4 : 0;
        if (formation.wuxing === dayMasterWuxing) {
            return {
                ...formation,
                effect: '助身',
                strength: Number((2.6 + monthBonus).toFixed(1)),
            };
        }
        if (resourceElement && formation.wuxing === resourceElement) {
            return {
                ...formation,
                effect: '生身',
                strength: Number((2.2 + monthBonus).toFixed(1)),
            };
        }
        if (formation.wuxing === generatedElement) {
            return {
                ...formation,
                effect: '泄身',
                strength: Number((-2.0 - monthBonus).toFixed(1)),
            };
        }
        if (formation.wuxing === wealthElement) {
            return {
                ...formation,
                effect: '耗身',
                strength: Number((-2.2 - monthBonus).toFixed(1)),
            };
        }
        if (officerElement && formation.wuxing === officerElement) {
            return {
                ...formation,
                effect: '克身',
                strength: Number((-2.6 - monthBonus).toFixed(1)),
            };
        }
        return {
            ...formation,
            effect: '泄身',
            strength: 0,
        };
    })
        .filter((formation) => formation.strength !== 0);
    return {
        formations,
        totalStrength: Number(formations.reduce((sum, formation) => sum + formation.strength, 0).toFixed(1)),
    };
}
export function analyzeDayMasterStrength(seasonalStatus, formationAnalysis, rootAnalysis, supportAnalysis, constraintAnalysis) {
    const monthTendency = resolveMonthTendency(seasonalStatus);
    const rootTendency = rootAnalysis.strongRoot
        ? '扶身'
        : rootAnalysis.hasRoot
            ? '相持'
            : '制身';
    const structureTendency = resolveStructureTendency(formationAnalysis, rootAnalysis, supportAnalysis, constraintAnalysis);
    const tendencies = [monthTendency, rootTendency, structureTendency];
    const supportingConditions = tendencies.filter((item) => item === '扶身').length;
    const constrainingConditions = tendencies.filter((item) => item === '制身').length;
    const hasSupportingFormation = formationAnalysis.formations.some((formation) => SUPPORTING_FORMATION_EFFECTS.has(formation.effect));
    const hasConstrainingFormation = formationAnalysis.formations.some((formation) => !SUPPORTING_FORMATION_EFFECTS.has(formation.effect));
    let status = '中和';
    if (monthTendency === '扶身' &&
        rootAnalysis.strongRoot &&
        structureTendency === '扶身' &&
        constraintAnalysis.constraints.length === 0 &&
        !hasConstrainingFormation) {
        status = '极强';
    }
    else if (!rootAnalysis.hasRoot &&
        monthTendency !== '扶身' &&
        (supportAnalysis.supporters.length === 0 || hasConstrainingFormation) &&
        !hasSupportingFormation) {
        status = '极弱';
    }
    else if (!rootAnalysis.hasRoot && monthTendency !== '扶身') {
        status = '身弱';
    }
    else if (supportingConditions >= 2 && constrainingConditions === 0) {
        status = '身强';
    }
    else if (supportingConditions > constrainingConditions) {
        status = '偏强';
    }
    else if (constrainingConditions >= 2 && supportingConditions === 0) {
        status = '身弱';
    }
    else if (constrainingConditions > supportingConditions) {
        status = '偏弱';
    }
    return {
        status,
        details: {
            timely: seasonalStatus.isTimely,
            seasonalEffect: seasonalStatus.status === '旺' || seasonalStatus.status === '相'
                ? '支持'
                : seasonalStatus.status === '囚' || seasonalStatus.status === '死'
                    ? '削弱'
                    : '中性',
            commanderEffect: seasonalStatus.commanderEffect ?? '中性',
            formationEffect: hasSupportingFormation
                ? hasConstrainingFormation
                    ? '中性'
                    : '支持'
                : hasConstrainingFormation
                    ? '削弱'
                    : '中性',
            hasRoot: rootAnalysis.hasRoot,
            hasStrongRoot: rootAnalysis.strongRoot,
            hasSupport: supportAnalysis.hasSupport,
            hasConstraint: constraintAnalysis.hasConstraint,
            ruleBasis: [
                `月令与司令合看为${monthTendency}；通根条件为${rootTendency}；成局、明根明透及中余气合看为${structureTendency}`,
                '先看得令，再看地支明根，最后比较成局、明透本气与中余气；不把旺相休囚死或司令关系换算成小数总分',
            ],
        },
    };
}
