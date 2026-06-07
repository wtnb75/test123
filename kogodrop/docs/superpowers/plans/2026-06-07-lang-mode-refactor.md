# 言語モード拡張（タイル・スロット独立選択）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 古語・現代語・英語の3言語を「落とすタイル」と「受けるスロット」で独立して選択できるようにし、古語→現代語・英語→古語など6通りの組み合わせに対応する。

**Architecture:** `LangMode` を `{ tile: Lang; slot: Lang }` 型のオブジェクトに変更し、`getTileValue`/`getSlotValue` を統合した `getLangValue(entry, lang)` に一本化する。これによりゲームロジック（kogodrop.ts）は各軸（タイル言語・スロット言語）を独立して扱えるようになる。Title.ts は2行のボタン群でそれぞれ選択。

**Tech Stack:** TypeScript, Phaser.js, Vite, Vitest

---

## ファイル対応表

| ファイル | 変更内容 |
|---|---|
| `src/game/logic/types.ts` | `Lang` 型追加、`LangMode` を `{ tile: Lang; slot: Lang }` に変更 |
| `src/game/logic/kogodrop.ts` | `getTileValue`/`getSlotValue` → `getLangValue`、`getFullMeaning`/`isCorrect`/`generateSlots` の引数を `Lang` に変更 |
| `src/game/logic/kogodrop.test.ts` | 全テストの LangMode 文字列を新型に合わせ更新 |
| `src/game/scenes/Game.ts` | `config.langMode` の参照を `.tile`/`.slot` に分解 |
| `src/game/scenes/Title.ts` | タイル言語・スロット言語の独立ボタン2行に変更 |
| `src/game/scenes/Result.ts` | フォールバックデフォルト値を新型に変更 |
| `src/game/scenes/Review.ts` | フォールバックデフォルト値を新型に変更 |

---

## Task 1: types.ts — `Lang` 型追加と `LangMode` 再定義

**Files:**
- Modify: `src/game/logic/types.ts`

- [ ] **Step 1: `Lang` 型を追加し `LangMode` を変更する**

`types.ts` の該当部分を以下に書き換える:

```typescript
export type Lang = 'kogo' | 'jp' | 'en';
export type LangMode = { tile: Lang; slot: Lang };
// 旧: export type LangMode = 'kogo-to-jp' | 'kogo-to-en' | 'en-to-kogo';
```

`GameConfig` はそのまま（`langMode: LangMode` を保持）。

- [ ] **Step 2: ビルドエラーが出ることを確認する**

```bash
cd kogodrop && npm run build 2>&1 | head -40
```

Expected: `LangMode` を参照している複数ファイルで型エラーが出る（これが正常。後続タスクで順に直す）。

---

## Task 2: kogodrop.ts — 関数シグネチャを新型に更新

**Files:**
- Modify: `src/game/logic/kogodrop.ts`

このタスクでは `getTileValue`/`getSlotValue` を廃止して `getLangValue` に統合し、残る関数の引数型を `Lang` に変更する。

- [ ] **Step 1: `getLangValue` を追加し旧関数を削除する**

`getTileValue` と `getSlotValue` を削除し、以下に置き換える:

```typescript
export const getLangValue = (entry: KogoEntry, lang: Lang): string => {
    if (lang === 'kogo') return entry.word;
    if (lang === 'jp') return entry.shortMeaning[0];
    return entry.shortEnglishMeaning[0];
};
```

- [ ] **Step 2: `getAllSlotValues`（private）を更新する**

```typescript
const getAllLangValues = (entry: KogoEntry, lang: Lang): string[] => {
    if (lang === 'kogo') return [entry.word];
    if (lang === 'jp') return entry.shortMeaning;
    return entry.shortEnglishMeaning;
};
```

- [ ] **Step 3: `getFullMeaning` を更新する**

引数を `mode: LangMode` から `slotLang: Lang` に変更:

```typescript
export const getFullMeaning = (entry: KogoEntry, slotLang: Lang): string => {
    if (slotLang === 'kogo') return entry.word;
    if (slotLang === 'jp') return entry.meaning;
    return entry.englishMeaning;
};
```

- [ ] **Step 4: `isCorrect` を更新する**

```typescript
export const isCorrect = (correct: KogoEntry, selected: KogoEntry, slotLang: Lang): boolean => {
    return getAllLangValues(correct, slotLang).includes(getLangValue(selected, slotLang));
};
```

- [ ] **Step 5: `generateSlots` を更新する**

引数 `mode: LangMode` を `slotLang: Lang` に変更し、内部の `getSlotValue` / `getAllSlotValues` 呼び出しを新関数に置き換える:

```typescript
export const generateSlots = (
    correct: KogoEntry,
    pool: KogoEntry[],
    slotLang: Lang,
    rng: () => number = Math.random,
    slotCount = 4
): KogoEntry[] => {
    const dummyTarget = slotCount - 1;
    const allCorrectValues = new Set(getAllLangValues(correct, slotLang));

    const candidates = shuffleArray(
        pool.filter((e) => e.id !== correct.id && !allCorrectValues.has(getLangValue(e, slotLang))),
        rng
    );

    const dummies: KogoEntry[] = [];
    const usedValues = new Set<string>(allCorrectValues);

    for (const e of candidates) {
        if (dummies.length >= dummyTarget) break;
        const val = getLangValue(e, slotLang);
        const confusing = [...allCorrectValues].some((cv) => sharesConfusingPrefix(val, cv));
        if (!usedValues.has(val) && !confusing) {
            dummies.push(e);
            usedValues.add(val);
        }
    }

    for (const e of candidates) {
        if (dummies.length >= dummyTarget) break;
        const val = getLangValue(e, slotLang);
        if (!usedValues.has(val)) {
            dummies.push(e);
            usedValues.add(val);
        }
    }

    for (const e of candidates) {
        if (dummies.length >= dummyTarget) break;
        if (!dummies.includes(e)) dummies.push(e);
    }

    const padSource = candidates.length > 0 ? candidates : [correct];
    while (dummies.length < dummyTarget) {
        dummies.push(padSource[dummies.length % padSource.length]);
    }

    const correctValues = [...allCorrectValues];
    const displayValue = correctValues[Math.floor(rng() * correctValues.length)];
    const correctSlotEntry: KogoEntry =
        displayValue === getLangValue(correct, slotLang)
            ? correct
            : slotLang === 'jp'
              ? { ...correct, shortMeaning: [displayValue] }
              : slotLang === 'en'
                ? { ...correct, shortEnglishMeaning: [displayValue] }
                : correct;

    const correctPosition = Math.floor(rng() * slotCount);
    const slots: KogoEntry[] = [];
    let dummyIndex = 0;
    for (let i = 0; i < slotCount; i++) {
        slots.push(i === correctPosition ? correctSlotEntry : dummies[dummyIndex++]);
    }
    return slots;
};
```

- [ ] **Step 6: import に `Lang` を追加する**

`kogodrop.ts` 冒頭の import を更新:

```typescript
import type { KogoEntry, ExampleSentence, Lang, LangMode, Difficulty, Level } from './types';
```

`LangMode` は `createQuestionSequence` の引数型ではなく `getPool` など直接使用しないが、`GameConfig` 経由で他ファイルが参照するため型エクスポート自体は残す。`kogodrop.ts` 内では `LangMode` は不使用になるので import から外す:

```typescript
import type { KogoEntry, ExampleSentence, Lang, Difficulty, Level } from './types';
```

---

## Task 3: kogodrop.test.ts — テストを新 API に更新

**Files:**
- Modify: `src/game/logic/kogodrop.test.ts`

71箇所の変更。パターンは以下の3種類に集約される。

- [ ] **Step 1: import を更新する**

```typescript
import {
    DIFFICULTY_LEVELS,
    findExampleSentence,
    findExampleSentences,
    generateSlots,
    getFullMeaning,
    getPool,
    getLangValue,        // ← getTileValue と getSlotValue を置き換え
    isCorrect,
    createQuestionSequence,
    sharesConfusingPrefix,
    shuffleArray,
} from './kogodrop';
import type { ExampleSentence, KogoEntry, Lang } from './types';
```

- [ ] **Step 2: `getTileValue` テストを `getLangValue` に書き換える**

旧:
```typescript
describe('getTileValue', () => {
    it('kogo-to-jp returns word', () => {
        expect(getTileValue(e1, 'kogo-to-jp')).toBe(e1.word);
    });
    it('kogo-to-en returns word', () => {
        expect(getTileValue(e1, 'kogo-to-en')).toBe(e1.word);
    });
    it('en-to-kogo returns first shortEnglishMeaning', () => {
        expect(getTileValue(e1, 'en-to-kogo')).toBe(e1.shortEnglishMeaning[0]);
    });
});
```

新:
```typescript
describe('getLangValue', () => {
    it("'kogo' returns word", () => {
        expect(getLangValue(e1, 'kogo')).toBe(e1.word);
    });
    it("'jp' returns first shortMeaning", () => {
        expect(getLangValue(e1, 'jp')).toBe(e1.shortMeaning[0]);
    });
    it("'en' returns first shortEnglishMeaning", () => {
        expect(getLangValue(e1, 'en')).toBe(e1.shortEnglishMeaning[0]);
    });
});
```

- [ ] **Step 3: `getSlotValue` テストを削除する**

`getSlotValue` は廃止（`getLangValue` で代替）。`describe('getSlotValue', ...)` ブロックごと削除する。

- [ ] **Step 4: `getFullMeaning` テストを更新する**

旧:
```typescript
describe('getFullMeaning', () => {
    it('kogo-to-jp returns meaning', () => {
        expect(getFullMeaning(e1, 'kogo-to-jp')).toBe(e1.meaning);
    });
    it('kogo-to-en returns englishMeaning', () => {
        expect(getFullMeaning(e1, 'kogo-to-en')).toBe(e1.englishMeaning);
    });
    it('en-to-kogo returns word', () => {
        expect(getFullMeaning(e1, 'en-to-kogo')).toBe(e1.word);
    });
});
```

新:
```typescript
describe('getFullMeaning', () => {
    it("'jp' returns meaning", () => {
        expect(getFullMeaning(e1, 'jp')).toBe(e1.meaning);
    });
    it("'en' returns englishMeaning", () => {
        expect(getFullMeaning(e1, 'en')).toBe(e1.englishMeaning);
    });
    it("'kogo' returns word", () => {
        expect(getFullMeaning(e1, 'kogo')).toBe(e1.word);
    });
});
```

- [ ] **Step 5: `isCorrect` テストを更新する**

旧 `'kogo-to-jp'` → 新 `'jp'`、旧 `'kogo-to-en'` → 新 `'en'`、旧 `'en-to-kogo'` → 新 `'kogo'`:

```typescript
describe('isCorrect', () => {
    it('same entry is correct', () => {
        expect(isCorrect(e1, e1, 'jp')).toBe(true);
    });
    it('different entry is incorrect', () => {
        expect(isCorrect(e1, e2, 'jp')).toBe(false);
    });
    it('different entries with same shortMeaning[0] are correct', () => {
        expect(isCorrect(e1, eDupShort, 'jp')).toBe(true);
    });
    it('slot showing an alt meaning (non-[0]) of correct entry is accepted', () => {
        const altSlot = makeEntry('x', 'basic', { shortMeaning: ['alt1'] });
        expect(isCorrect(eAlt, altSlot, 'jp')).toBe(true);
    });
    it('slot showing unrelated meaning is rejected', () => {
        expect(isCorrect(eAlt, e2, 'jp')).toBe(false);
    });
    it('en slot accepts alt shortEnglishMeaning', () => {
        const altSlot = makeEntry('x', 'basic', { shortEnglishMeaning: ['altEn1'] });
        expect(isCorrect(eEnAlt, altSlot, 'en')).toBe(true);
        expect(isCorrect(eEnAlt, e2, 'en')).toBe(false);
    });
    it("'kogo' slot checks word field", () => {
        expect(isCorrect(e1, e1, 'kogo')).toBe(true);
        expect(isCorrect(e1, e2, 'kogo')).toBe(false);
    });
});
```

- [ ] **Step 6: `generateSlots` テストを更新する**

`'kogo-to-jp'` → `'jp'`、`'kogo-to-en'` → `'en'`、`'en-to-kogo'` → `'kogo'` に全置換。
また `slotCount` 指定テストは第3引数が `slotLang: Lang` になったので第4引数（`rng`）の位置に注意:

```typescript
// 旧: generateSlots(e1, pool, 'kogo-to-jp', Math.random, 5)
// 新: generateSlots(e1, pool, 'jp', Math.random, 5)
```

`describe('generateSlots', ...)` 内の全呼び出しをこのパターンで一括置換する。

- [ ] **Step 7: テストを実行して全パスを確認する**

```bash
cd kogodrop && npm run test 2>&1
```

Expected: 全テストパス（Task 4以降でGame.tsを直すまではビルドエラーが残るが、vitest は型チェックなしで動くためテストは通る）。

---

## Task 4: Game.ts — `config.langMode` の参照を分解

**Files:**
- Modify: `src/game/scenes/Game.ts`

- [ ] **Step 1: import を更新する**

```typescript
import {
    generateSlots,
    getFullMeaning,
    getPool,
    getLangValue,      // ← getTileValue, getSlotValue を置き換え
    isCorrect,
    createQuestionSequence,
} from '../logic/kogodrop';
```

- [ ] **Step 2: `drawTileCard` の呼び出し箇所を更新する**

旧:
```typescript
const tileVal = getTileValue(entry, this.config.langMode);
this.drawTileCard(tileVal, entry.level, entry.rank);
```

新:
```typescript
const tileVal = getLangValue(entry, this.config.langMode.tile);
this.drawTileCard(tileVal, entry.level, entry.rank);
```

- [ ] **Step 3: NEXTカード表示を更新する**

旧:
```typescript
const nextVal = nextEntry ? getTileValue(nextEntry, this.config.langMode) : '---';
```

新:
```typescript
const nextVal = nextEntry ? getLangValue(nextEntry, this.config.langMode.tile) : '---';
```

- [ ] **Step 4: スロット表示を更新する**

旧:
```typescript
const slotVal = getSlotValue(this.slots[i], this.config.langMode);
```

新:
```typescript
const slotVal = getLangValue(this.slots[i], this.config.langMode.slot);
```

- [ ] **Step 5: `generateSlots` 呼び出しを更新する**

旧:
```typescript
this.slots = generateSlots(entry, this.adaptivePool, this.config.langMode, Math.random, this.adaptiveSlotCount);
```

新:
```typescript
this.slots = generateSlots(entry, this.adaptivePool, this.config.langMode.slot, Math.random, this.adaptiveSlotCount);
```

- [ ] **Step 6: `isCorrect` の全呼び出しを更新する**

`this.config.langMode` を渡している `isCorrect` 呼び出しをすべて `.slot` に変更:

```typescript
// 旧: isCorrect(entry, selected, this.config.langMode)
// 新: isCorrect(entry, selected, this.config.langMode.slot)
```

（Game.ts 内に複数箇所あり。`rg "isCorrect" src/game/scenes/Game.ts` で確認してすべて変更）

- [ ] **Step 7: `getFullMeaning` を更新する**

旧:
```typescript
const fullMeaning = getFullMeaning(entry, this.config.langMode);
```

新:
```typescript
const fullMeaning = getFullMeaning(entry, this.config.langMode.slot);
```

- [ ] **Step 8: タイル縦書き判定を更新する**

旧:
```typescript
const isJapanese = this.config.langMode !== 'kogo-to-en' && this.config.langMode !== 'en-to-kogo';
```

新:
```typescript
const isJapanese = this.config.langMode.tile !== 'en';
```

- [ ] **Step 9: `tileFontSize` 関数シグネチャを更新する**

旧:
```typescript
function tileFontSize(value: string, mode: string): string {
    if (mode === 'kogo-to-en' || mode === 'en-to-kogo') {
```

新:
```typescript
function tileFontSize(value: string, tileLang: string): string {
    if (tileLang === 'en') {
```

呼び出し側:
```typescript
// 旧: tileFontSize(value, this.config.langMode)
// 新: tileFontSize(value, this.config.langMode.tile)
```

- [ ] **Step 10: `tileDisplayText` 呼び出しを更新する**

旧:
```typescript
const vertVal = tileDisplayText(value, this.config.langMode);
```

新:
```typescript
const vertVal = tileDisplayText(value, this.config.langMode.tile);
```

`tileDisplayText` 関数シグネチャも同様に:
```typescript
function tileDisplayText(value: string, tileLang: string): string {
    if (tileLang === 'en') return value;
    return toVertical(value);
}
```

旧の判定 `mode === 'kogo-to-en' || mode === 'en-to-kogo'` は `tileLang === 'en'` に変更（現代語タイルも縦書き）。

- [ ] **Step 11: ビルドとテストを通す**

```bash
cd kogodrop && npm run test && npm run build 2>&1 | tail -20
```

Expected: テスト全パス、ビルド成功（Title.tsはまだ古い型を渡しているためこの時点でビルドエラーが残る可能性あり→次タスクで解消）。

---

## Task 5: Title.ts — タイル言語・スロット言語の独立選択UI

**Files:**
- Modify: `src/game/scenes/Title.ts`

- [ ] **Step 1: import と状態変数を更新する**

旧:
```typescript
import type { Difficulty, GameConfig, LangMode, QuestionCount } from '../logic/types';

const LANG_MODES: { key: LangMode; label: string }[] = [
    { key: 'kogo-to-jp', label: '古語→現代語' },
    { key: 'kogo-to-en', label: '古語→英語' },
    { key: 'en-to-kogo', label: '英語→古語' },
];
```

新:
```typescript
import type { Difficulty, GameConfig, Lang, QuestionCount } from '../logic/types';

const LANGS: { key: Lang; label: string }[] = [
    { key: 'kogo', label: '古語' },
    { key: 'jp',   label: '現代語' },
    { key: 'en',   label: '英語' },
];
```

クラスフィールド:
```typescript
private selectedTileLang: Lang = 'kogo';
private selectedSlotLang: Lang = 'jp';
// 旧: private selectedLangMode: LangMode = 'kogo-to-jp';
```

- [ ] **Step 2: `create()` のレイアウト座標を調整する**

ボタン行が1→2行に増えるため各行の Y 座標を詰める。`create()` 内の `buildButtonGroup` 呼び出しを以下に変更:

```typescript
// タイル言語（落とすカード）
this.buildButtonGroup(
    width,
    height * 0.25,
    'タイル（出題）の言語',
    LANGS,
    (key: string) => {
        this.selectedTileLang = key as Lang;
        if (this.selectedTileLang === this.selectedSlotLang) {
            this.selectedSlotLang = LANGS.find(l => l.key !== key)!.key;
            this.rebuildSlotButtons(width, height);
        }
        this.updateStartButton();
    },
    this.selectedTileLang
);

// スロット言語（答え）
this.buildButtonGroup(
    width,
    height * 0.39,
    'スロット（答え）の言語',
    LANGS,
    (key: string) => {
        this.selectedSlotLang = key as Lang;
        if (this.selectedSlotLang === this.selectedTileLang) {
            this.selectedTileLang = LANGS.find(l => l.key !== key)!.key;
            this.rebuildTileButtons(width, height);
        }
        this.updateStartButton();
    },
    this.selectedSlotLang
);

// 難易度
this.buildButtonGroup(
    width,
    height * 0.53,
    '難易度を選んでください',
    DIFFICULTIES,
    (key: string) => { this.selectedDifficulty = key as Difficulty; },
    this.selectedDifficulty
);

// 出題数
this.buildButtonGroup(
    width,
    height * 0.68,
    '出題数を選んでください',
    QUESTION_COUNTS,
    (key: string) => { this.selectedCount = Number(key) as QuestionCount; },
    String(this.selectedCount)
);
```

スタートボタンの Y も調整:
```typescript
this.startButton = this.add.rectangle(width / 2, height * 0.84, width * 0.68, 68, COLOR_START)
```

- [ ] **Step 3: ゲーム開始時の config を新型で渡す**

```typescript
const config: GameConfig = {
    langMode: { tile: this.selectedTileLang, slot: this.selectedSlotLang },
    difficulty: this.selectedDifficulty,
    questionCount: this.selectedCount,
};
```

- [ ] **Step 4: `rebuildTileButtons` / `rebuildSlotButtons` は不要ならシンプルに実装する**

同一言語選択時の自動切り替えを `rebuildXxxButtons` ではなく再 `create()` 呼び出しか、選択ハイライトの更新のみで済む場合は、`buildButtonGroup` の戻り値として `updateHighlight` コールバックを受け取る方式に変更してもよい。

**シンプルな実装方針（推奨）:** `buildButtonGroup` の戻り値として `setSelected(key: string) => void` を返すようにし、相互排他処理のときに呼び出す。

`buildButtonGroup` の末尾に `return updateHighlight;` を追加し、戻り値型を `(key: string) => void` とする。Title クラスに `private updateTileHighlight!: (k: string) => void;` と `private updateSlotHighlight!: (k: string) => void;` フィールドを持ち、相互排他時に使う:

```typescript
this.updateTileHighlight = this.buildButtonGroup(
    width, height * 0.25, 'タイル（出題）の言語', LANGS,
    (key: string) => {
        this.selectedTileLang = key as Lang;
        if (this.selectedTileLang === this.selectedSlotLang) {
            const auto = LANGS.find(l => l.key !== key)!.key;
            this.selectedSlotLang = auto;
            this.updateSlotHighlight(auto);
        }
    },
    this.selectedTileLang
);

this.updateSlotHighlight = this.buildButtonGroup(
    width, height * 0.39, 'スロット（答え）の言語', LANGS,
    (key: string) => {
        this.selectedSlotLang = key as Lang;
        if (this.selectedSlotLang === this.selectedTileLang) {
            const auto = LANGS.find(l => l.key !== key)!.key;
            this.selectedTileLang = auto;
            this.updateTileHighlight(auto);
        }
    },
    this.selectedSlotLang
);
```

`buildButtonGroup` の戻り値:
```typescript
private buildButtonGroup(
    width: number,
    topY: number,
    label: string,
    options: { key: string; label: string }[],
    onSelect: (key: string) => void,
    defaultKey: string
): (key: string) => void {   // ← 戻り値追加
    // ... 既存の実装 ...
    updateHighlight(defaultKey);
    return updateHighlight;  // ← 追加
}
```

---

## Task 6: Result.ts / Review.ts — デフォルト値を新型に変更

**Files:**
- Modify: `src/game/scenes/Result.ts`
- Modify: `src/game/scenes/Review.ts`

- [ ] **Step 1: Result.ts のデフォルト値を更新する**

旧:
```typescript
this.config = data.config ?? { langMode: 'kogo-to-jp', difficulty: 'normal', questionCount: 20 };
```

新:
```typescript
this.config = data.config ?? { langMode: { tile: 'kogo', slot: 'jp' }, difficulty: 'normal', questionCount: 20 };
```

- [ ] **Step 2: Review.ts のデフォルト値を更新する**

同様:
```typescript
this.config = data.config ?? { langMode: { tile: 'kogo', slot: 'jp' }, difficulty: 'normal', questionCount: 20 };
```

---

## Task 7: 最終確認

- [ ] **Step 1: lint を通す**

```bash
cd kogodrop && npm run lint 2>&1
```

Expected: エラー 0 件。

- [ ] **Step 2: テストを全件通す**

```bash
cd kogodrop && npm run test 2>&1
```

Expected: 全テストパス。

- [ ] **Step 3: カバレッジ確認**

```bash
cd kogodrop && npm run test:coverage 2>&1 | tail -20
```

Expected: ステートメント・分岐・関数・行いずれも 90% 以上。

- [ ] **Step 4: ビルドを通す**

```bash
cd kogodrop && npm run build 2>&1
```

Expected: `dist/` に成果物が生成される。

- [ ] **Step 5: コミット**

```bash
git add kogodrop/src/game/logic/types.ts \
        kogodrop/src/game/logic/kogodrop.ts \
        kogodrop/src/game/logic/kogodrop.test.ts \
        kogodrop/src/game/scenes/Game.ts \
        kogodrop/src/game/scenes/Title.ts \
        kogodrop/src/game/scenes/Result.ts \
        kogodrop/src/game/scenes/Review.ts
git commit -m "feat(kogodrop): タイル・スロット言語を独立選択できるよう LangMode を拡張"
```

---

## セルフレビュー結果

**仕様カバレッジ:**
- ✅ 古語・現代語・英語の3言語をタイルとスロットで独立選択
- ✅ 同一言語の組み合わせを自動回避（相互排他）
- ✅ 6通りの組み合わせに対応（tile≠slotの全組み合わせ）
- ✅ 既存テストの継続動作

**型の一貫性:**
- `getLangValue(entry, lang: Lang)` — Tasks 2, 3, 4 で一貫して使用
- `isCorrect(correct, selected, slotLang: Lang)` — Task 2定義 → Tasks 3, 4で使用
- `generateSlots(correct, pool, slotLang: Lang, ...)` — Task 2定義 → Task 4で使用
- `LangMode = { tile: Lang; slot: Lang }` — Task 1定義 → Tasks 4, 5, 6で使用

**注意点:**
- `generateSlots` の `correctSlotEntry` 生成（Task 2 Step 5）で `slotLang === 'kogo'` の場合は `word` フィールドが単一値なので `displayValue` は常に `entry.word` に一致する。分岐は念のため残してある。
- Task 5 の相互排他ロジックで `updateTileHighlight` / `updateSlotHighlight` を使う前に初期化されている必要がある（`create()` 内の定義順が重要）。タイル行の定義を先にし、その後でスロット行を定義すること。
