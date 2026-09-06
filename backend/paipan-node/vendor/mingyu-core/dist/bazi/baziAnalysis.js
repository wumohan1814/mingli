import { analyzeFormation, analyzeRoot, analyzeSupport, analyzeConstraint, analyzeSeasonalStatus, analyzeDayMasterStrength, } from './baziStrengthAnalyzer.js';
import { determinePattern } from './baziPatternStrategy.js';
import { determineUsefulGod } from './baziUsefulGodStrategy.js';
import { createBaziAnalysisPipeline } from './baziAnalysisPipeline.js';
export class BaziAnalyzer {
    getWuxing;
    getTenGod;
    getSeasonStatus;
    pipeline;
    constructor(getWuxing, getTenGod, getSeasonStatus) {
        this.getWuxing = getWuxing;
        this.getTenGod = getTenGod;
        this.getSeasonStatus = getSeasonStatus;
        this.pipeline = createBaziAnalysisPipeline({
            getWuxing: this.getWuxing,
            getTenGod: this.getTenGod,
            getSeasonStatus: this.getSeasonStatus,
            analyzeFormation,
            analyzeRoot,
            analyzeSupport,
            analyzeConstraint,
            analyzeSeasonalStatus,
            analyzeDayMasterStrength,
            determinePattern,
            determineUsefulGod,
        });
    }
    analyzeBaziChart(pillars, hiddenStems, monthCommander, seasonInfo) {
        return this.pipeline.run({
            pillars,
            hiddenStems,
            monthCommander,
            seasonInfo,
        });
    }
}
