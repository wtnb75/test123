export interface Point {
    x: number;
    y: number;
}

// 'outline' is a fixed background element, not something the player drags
// or that's scored — see DraggablePartId.
export type PartId = 'outline' | 'eyebrowL' | 'eyebrowR' | 'eyeL' | 'eyeR' | 'nose' | 'mouth';

export type DraggablePartId = Exclude<PartId, 'outline'>;

export interface PartTransform {
    x: number;
    y: number;
    rotation: number;
}

export type Region = 'placement' | 'tray';

export type GamePhase = 'reveal' | 'placement' | 'scoring';
