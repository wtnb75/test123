# STAGE=proto (self) — consumer: game-spec

Before marking the prototype done:

- Did the user play it and say it is settled (not just you judging that it
  works)? If the loop itself was found not fun, was that raised with the
  user instead of patched around?
- Does the spec-lite body have all five items (ゲーム名 / コンセプト /
  コアループ / 操作仕様 / パラメータ表), and does the パラメータ表 match
  `src/proto/params.ts` value for value?
- Are the rules, screens and number rationales the playtests settled written
  under `## プレイテストで固まったこと` — enough that `game-spec` doesn't
  have to read the code to learn them?
- Is every feature tried or discussed and then cut listed under
  `## 見送ったこと` with its reason, so `game-spec` can make backlog cards?
- Are all prototype additions under `src/proto/` (plus the `src/main.ts`
  entry pointing at it), with nothing changed outside `<game-dir>`?
- Is game logic in `src/proto/logic.ts` without Phaser imports, and does the
  completion summary name which parts are worth porting?
- Were the dev server and any QA container stopped?
- Was the commit question asked, and only answered-yes commits made?
