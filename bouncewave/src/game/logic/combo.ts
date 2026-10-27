// Own-ball tiers and the score cues that show them (pure; no Phaser).
import {
    COMBO_MAX_TIER,
    SCORE_BUMP_DURATION,
    SCORE_BUMP_SCALE,
    SCORE_POP_FONT_SIZE,
    SCORE_POP_TIER_STEP,
} from '../params';

/** Own-ball colours by tier (index 0 is tier 1). */
const TIER_COLORS = [0x4ae0ff, 0x69f0ae, 0xffeb3b, 0xff9100];

/** The tier after the paddle catches a ball: an enemy ball starts at 1, an own ball goes up by 1 to the cap. */
export function tierAfterCatch(wasOwn: boolean, tier: number): number {
    return wasOwn ? Math.min(tier + 1, COMBO_MAX_TIER) : 1;
}

export function tierColor(tier: number): number {
    return TIER_COLORS[Math.max(1, Math.min(COMBO_MAX_TIER, tier)) - 1];
}

/** The score pop's text: `+30` at tier 1, `+90 ×3` from tier 2. */
export function scorePopText(score: number, tier: number): string {
    return tier >= 2 ? `+${score} ×${tier}` : `+${score}`;
}

export function scorePopFontSize(tier: number): number {
    return SCORE_POP_FONT_SIZE + SCORE_POP_TIER_STEP * (tier - 1);
}

/** The HUD SCORE's scale `elapsed` seconds after a kill: SCORE_BUMP_SCALE falling linearly to 1.0. */
export function scoreBumpScale(elapsed: number): number {
    const t = Math.max(0, Math.min(1, elapsed / SCORE_BUMP_DURATION));
    return SCORE_BUMP_SCALE + (1 - SCORE_BUMP_SCALE) * t;
}
