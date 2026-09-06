export function branchesContain(pillars, requiredBranches, requireAll = true) {
    const allBranches = [pillars.year.zhi, pillars.month.zhi, pillars.day.zhi, pillars.hour.zhi];
    if (requireAll) {
        return requiredBranches.every((b) => allBranches.includes(b));
    }
    return requiredBranches.some((b) => allBranches.includes(b));
}
