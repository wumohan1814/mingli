import { EarthBranch, HeavenStem } from 'tyme4ts';
import { assertEarthlyBranch, assertHeavenlyStem } from './baziUtils.js';
export function getLifeStage(stem, branch) {
    assertHeavenlyStem(stem, '天干');
    assertEarthlyBranch(branch, '地支');
    return HeavenStem.fromName(stem).getTerrain(EarthBranch.fromName(branch)).getName();
}
