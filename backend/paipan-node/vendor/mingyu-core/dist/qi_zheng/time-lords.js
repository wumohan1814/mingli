export function resolveQizhengLimitDirection(gender, yearStemYinYang) {
    const yangPerson = gender === 'male';
    const yangYear = yearStemYinYang === '阳';
    return yangPerson === yangYear ? '顺行' : '逆行';
}
export function palaceIndexByLimitStep(step, direction) {
    const offset = ((step % 12) + 12) % 12;
    return direction === '顺行' ? offset : (12 - offset) % 12;
}
export function resolveQizhengNominalAge(birthYear, flowYear) {
    if (!Number.isInteger(birthYear) || !Number.isInteger(flowYear)) {
        throw new Error('行限年份必须是整数。');
    }
    if (flowYear < birthYear) {
        throw new Error('流年不得早于出生年。');
    }
    return flowYear - birthYear + 1;
}
export function buildQizhengTimeLords(params) {
    if (params.twelvePalaces.length !== 12) {
        throw new Error('行限需要完整十二宫。');
    }
    const direction = resolveQizhengLimitDirection(params.gender, params.yearStemYinYang);
    const nominalAge = resolveQizhengNominalAge(params.birthYear, params.flowYear);
    const majorLimits = Array.from({ length: 12 }, (_, step) => {
        const palace = params.twelvePalaces[palaceIndexByLimitStep(step, direction)];
        return {
            palace: palace.palace,
            signIndex: palace.signIndex,
            signBranch: palace.signBranch,
            startNominalAge: step * 10 + 1,
            endNominalAge: step * 10 + 10,
        };
    });
    const majorStep = Math.min(11, Math.floor((nominalAge - 1) / 10));
    const currentMajor = majorLimits[majorStep];
    const minorPalace = params.twelvePalaces[palaceIndexByLimitStep(nominalAge - 1, direction)];
    const annualPalace = params.twelvePalaces.find((item) => item.signBranch === params.flowYearBranch);
    if (!annualPalace) {
        throw new Error(`流年地支 ${params.flowYearBranch} 无法对应本命十二宫。`);
    }
    return {
        yearStem: params.yearStem,
        yearStemYinYang: params.yearStemYinYang,
        gender: params.gender,
        direction,
        nominalAge,
        ageNote: `虚岁按流年${params.flowYear}减出生年${params.birthYear}加一，得${nominalAge}岁；不以生日时刻切分`,
        majorLimits,
        currentMajorLimit: {
            palace: currentMajor.palace,
            signIndex: currentMajor.signIndex,
            signBranch: currentMajor.signBranch,
            nominalAge,
            startNominalAge: currentMajor.startNominalAge,
            endNominalAge: currentMajor.endNominalAge,
        },
        currentMinorLimit: {
            palace: minorPalace.palace,
            signIndex: minorPalace.signIndex,
            signBranch: minorPalace.signBranch,
            nominalAge,
        },
        annualBranch: params.flowYearBranch,
        annualPalace: {
            palace: annualPalace.palace,
            signIndex: annualPalace.signIndex,
            signBranch: annualPalace.signBranch,
        },
    };
}
export function formatQizhengTimeLordPrompt(result) {
    const genderLabel = result.gender === 'male' ? '男' : '女';
    return [
        '【行限】',
        `年干${result.yearStem}${result.yearStemYinYang}，${genderLabel}命${result.direction}；${result.ageNote}。`,
        `当前大限：虚岁${result.currentMajorLimit.startNominalAge}-${result.currentMajorLimit.endNominalAge}，落${result.currentMajorLimit.signBranch}宫${result.currentMajorLimit.palace}。`,
        `当前小限：虚岁${result.currentMinorLimit.nominalAge}，落${result.currentMinorLimit.signBranch}宫${result.currentMinorLimit.palace}。`,
        `流年太岁${result.annualBranch}入${result.annualPalace.signBranch}宫${result.annualPalace.palace}。`,
        `大限十二步：${result.majorLimits
            .map((item) => `虚岁${item.startNominalAge}-${item.endNominalAge}${item.signBranch}宫${item.palace}`)
            .join('；')}。`,
    ];
}
