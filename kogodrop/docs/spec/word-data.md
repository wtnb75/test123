# 古語単語データ仕様

`docs/spec.md` の一部。出題する古語・例文のデータ構造と、その検証・収録方針を、独立して書いたもの。`docs/spec.md` と合わせて 1 つの spec である。

## 概要

出題に使う古語（`KogoEntry`）と例文（`ExampleSentence`）のデータの項目・値の制約・レベル・検証の手順・収録方針を定める。ゲームのルール・画面は `docs/spec.md` のとおり。

## 操作仕様

なし（データの定義だけで、入力は扱わない）。

## 画面・Scene構成

なし（データを画面にどう出すかは `docs/spec.md` の「画面・Scene 構成」のとおり）。

## ルール

### 単語構造（`KogoEntry`）
各エントリは以下を持つ:
- `id`: 一意の識別子（例: `"aware"`）
- `word`: 古語（終止形。ひらがな表記を基本とするが、漢字仮名交じり表記も可。例: `"あはれ"` または `"哀れ"`）
- `reading`: ひらがな読み（`word` がひらがなのみの場合は省略可。`word` に漢字を使う場合は必須。スロット・タイル表示・`highlights` 照合はすべて `word` を使う）
- `meaning`: 主要な現代語訳（30文字以内）
- `shortMeaning`: スロット表示用の短縮訳の配列。先頭要素がスロット表示デフォルト値で、全要素が正解判定の対象（各要素10文字以内）
- `level`: 難易度レベル `"basic" | "standard" | "advanced"`
- `pos`: 品詞・活用種別。以下の定義済み値のいずれかを使う:
  - 形容詞: `"形容詞・ク活用"`, `"形容詞・シク活用"`
  - 形容動詞: `"形容動詞・ナリ活用"`, `"形容動詞・タリ活用"`
  - 動詞: `"動詞・四段活用"`, `"動詞・上一段活用"`, `"動詞・上二段活用"`, `"動詞・下一段活用"`, `"動詞・下二段活用"`, `"動詞・カ行変格活用"`, `"動詞・サ行変格活用"`, `"動詞・ナ行変格活用"`, `"動詞・ラ行変格活用"`
  - その他: `"名詞"`, `"副詞"`, `"助動詞"`, `"接続詞"`, `"感動詞"`
- `englishMeaning`: 英語訳（フル表記・50文字以内、例: `"pathos; touching sentiment"`）
- `shortEnglishMeaning`: スロット表示用の短縮英語訳の配列。先頭要素がスロット表示デフォルト値で、全要素が正解判定の対象（各要素15文字以内）
- `verified`: レビュー済みフラグ（`boolean`）。`false` のエントリは出題プールから除外する

#### レベル定義
| level | 目安 | 語数目標 |
|-------|------|---------|
| `basic` | 高校受験の最頻出語。ほぼ全員が学ぶ | 約60語 |
| `standard` | 高校受験の標準語。公立上位〜私立を想定 | 約60語 |
| `advanced` | やや難しい語。難関私立・大学受験入口レベル | 約40語 |
| **合計** | | **約160語** |

### 例文構造（`ExampleSentence`）
単語とは独立したコレクションとして `data/exampleSentences.ts` に格納する。
各エントリは以下を持つ:
- `sentence`: 古文テキスト
- `translation`: 現代語訳
- `highlights`: この例文が主に示す単語の情報オブジェクトの配列（1件以上）。各オブジェクトは:
  - `word`: 終止形（`KogoEntry.word` と一致、逆引きに使う）
  - `form`: 例文中の実際の語形（`sentence.includes(form)` が成立する文字列）
  - `note?`: 活用説明（例: `"連用形・ウ音便"`, `"連体形"`, `"連用形"` 等）
- `source?`: 出典（古典文学からの引用の場合のみ記載。例: `"枕草子"`, `"源氏物語"`）
- `verified`: レビュー済みフラグ（`boolean`）。`false` の例文は Review Scene に表示しない

`highlights` をオブジェクト配列にすることで:
- `sentence.includes(h.form)` による確実な一致（辞書形ではなく実際の語形を使う）
- 単語からの逆引き: `exampleSentences.filter(ex => ex.highlights.some(h => h.word === entry.word))`
- `note` で活用の知識をプレイヤーに渡せる

単語と例文の関係は多対多:
- 1つの例文が複数の単語を示せる（`highlights` に複数のオブジェクト）
- 1つの単語に複数の例文を当てられる（別の例文エントリで同じ `word` を参照）

### データ検証ワークフロー

#### チェックが必要な箇所とリスク
| フィールド | リスク | 理由 |
|-----------|--------|------|
| `pos` | 高 | シク活用 vs ク活用の区別、形容動詞の種別など微妙なケースがある |
| `highlights[].note` | 高 | 文法用語の誤用・活用分類のミスが起きやすい |
| 生成 `sentence` | 中 | 助動詞の誤用・不自然な古文が混入しうる |
| `meaning` | 中 | 複数義語の主義・副義の扱いが辞書によって異なる |
| `englishMeaning` / `shortEnglishMeaning` | 中 | 古語の多義性を英語で正確に表現するのが難しく、誤訳・意味の欠落が起きやすい |
| 引用 `sentence` | 低 | 出典が明確なら本文は正確。ただし `translation` は要確認 |

#### 参照する辞書（正とする権威）
- **旺文社全訳古語辞典**（高校受験〜大学受験向け、入手しやすい）
- **学研全訳古語辞典**（受験向け、オンライン版あり）
- いずれかを「正」として決め、意味・品詞の表記を統一する

#### 自動チェック（テストで機械的に担保する）
- `sentence.includes(h.form)` が全エントリで成立すること
- `pos` が定義済み enum の値であること
- `meaning` 30文字以内・`shortMeaning` の各要素が10文字以内であること
- `englishMeaning` 50文字以内・`shortEnglishMeaning` の各要素が15文字以内であること
- `highlights[].word` が `kogoList` の `word` と一致すること
- `verified: true` のエントリのみが出題プール・Review Scene に使われること

#### 人間レビューの進め方
新規エントリは `verified: false` で追加し、辞書で確認後に `verified: true` へ変更する。
レビューは level 順（basic → standard → advanced）に進める。

```
Phase 1: basic 約60語 + 対応例文を verified にする
Phase 2: standard 約60語 + 対応例文
Phase 3: advanced 約40語 + 対応例文
```

#### 動作に必要な最低 verified 語数

| 目的 | 最低語数 | 理由 |
|------|---------|------|
| ゲームが起動できる（技術的最低限） | 4語 | スロット4列を埋めるのに必要 |
| 10問セッションが成立する（開発テスト用） | 20語 | 繰り返しが少なくテスト可能な最低限 |
| MVP リリース（やさしいモードのみ） | basic 60語すべて | Phase 1 完了が条件 |
| MVP リリース（全モード） | basic + standard 120語 | Phase 2 完了が条件 |

開発中は `verified: false` の語を出題プールに含めるデバッグフラグを Vite の環境変数で切り替えられるようにしておくと検証作業が進めやすい。変数名は `VITE_DEV_IGNORE_VERIFIED`（`import.meta.env.VITE_DEV_IGNORE_VERIFIED`）とし、`.env.development` に `VITE_DEV_IGNORE_VERIFIED=true` を記述して有効化する。

### 例文収録方針
| 対象 | 方針 |
|------|------|
| あはれ・をかし・いみじ 等の最頻出語 | 枕草子・源氏物語・徒然草等から引用、`source` を明記 |
| それ以外の語 | 受験問題スタイルに揃えた生成文、`source` は省略 |
| 生成文で精度が不安な語 | 生成後に人間がレビューして必要なら差し替え |

### MVP収録語数・例文数
- 単語: 約160語（basic 60 / standard 60 / advanced 40）
- 例文: 単語数より多くなることを想定（1語あたり1〜3例文目安）

### 収録例（高校受験頻出古語）

| id | 古語 | 意味 | 短縮表示 | level | pos |
|----|------|------|---------|-------|-----|
| aware | あはれ | しみじみとした感動・趣 | しみじみ | basic | 形容動詞・ナリ活用 |
| okashi | をかし | 趣がある・おもしろい | 趣がある | basic | 形容詞・シク活用 |
| imiji | いみじ | 非常に・ひどい・すばらしい | 非常に | basic | 形容詞・シク活用 |
| medetashi | めでたし | すばらしい・おめでたい | すばらしい | basic | 形容詞・シク活用 |
| kanashi | かなし | かわいい・愛しい・悲しい | かわいい | basic | 形容詞・シク活用 |
| wabishi | わびし | 心細い・つらい・みすぼらしい | 心細い | basic | 形容詞・シク活用 |
| utsukushi | うつくし | かわいい・美しい（小さいものへの愛情） | かわいい | basic | 形容詞・シク活用 |
| arigatashi | ありがたし | めったにない・珍しい | めったにない | basic | 形容詞・ク活用 |
| ayashi | あやし | 不思議だ・粗末だ・身分が低い | 不思議だ | basic | 形容詞・シク活用 |
| yukashi | ゆかし | 心引かれる・見たい・知りたい | 心引かれる | standard | 形容詞・シク活用 |
| natsukashi | なつかし | 親しみを感じる・慕わしい | 慕わしい | standard | 形容詞・シク活用 |
| asamashi | あさまし | 驚いた・情けない・嘆かわしい | 驚いた | standard | 形容詞・シク活用 |
| obotsuka | おぼつかなし | 不安だ・はっきりしない | 不安だ | standard | 形容詞・ク活用 |
| tsurenashi | つれなし | 冷淡だ・平気だ | 冷淡だ | standard | 形容詞・ク活用 |
| kokoromoto | こころもとなし | 不安だ・待ち遠しい・頼りない | 待ち遠しい | standard | 形容詞・ク活用 |
| nengoroni | ねんごろなり | 丁寧だ・親切だ・熱心だ | 丁寧だ | standard | 形容動詞・ナリ活用 |
| hashitanashi | はしたなし | 中途半端だ・不体裁だ | 中途半端 | standard | 形容詞・ク活用 |
| souzaushi | さうざうし | 物足りない・さびしい | 物足りない | advanced | 形容詞・シク活用 |
| monogurohoshi | ものぐるほし | 狂っているようだ・正気でない | 正気でない | advanced | 形容詞・シク活用 |
| rautashi | らうたし | かわいい・いじらしい | いじらしい | advanced | 形容詞・ク活用 |

英語訳（同じ id 順）:

| id | englishMeaning | shortEnglishMeaning |
|----|---------------|-------------------|
| aware | pathos; touching sentiment | pathos |
| okashi | charming; interesting; witty | charming |
| imiji | very; terribly; wonderful | very |
| medetashi | splendid; auspicious; wonderful | splendid |
| kanashi | dear; lovely; sad | dear |
| wabishi | lonely; miserable; shabby | lonely |
| utsukushi | cute; beautiful; lovely | cute |
| arigatashi | rare; precious; hard to find | rare |
| ayashi | strange; humble; of low rank | strange |
| yukashi | yearning; curious; attracted | yearning |
| natsukashi | familiar; dear; nostalgic | nostalgic |
| asamashi | astonishing; shameful; wretched | astonishing |
| obotsuka | uneasy; vague; unreliable | uneasy |
| tsurenashi | cold; indifferent; unconcerned | indifferent |
| kokoromoto | anxious; impatient; uncertain | anxious |
| nengoroni | sincere; kind; earnest | sincere |
| hashitanashi | awkward; improper; incomplete | awkward |
| souzaushi | unsatisfying; lonely; lacking | unsatisfying |
| monogurohoshi | mad; frantic; out of one's mind | frantic |
| rautashi | endearing; sweet; pitiable | endearing |

（残りは実装時に追加。basic 約60語・standard 約60語・advanced 約40語で合計約160語を目標とする）

### 例文収録例

```ts
// 古典引用（source あり）
{
  sentence: "春はあけぼの。やうやう白くなりゆく山ぎは、すこしあかりて、紫だちたる雲のほそくたなびきたる。",
  translation: "春は夜明け。だんだん白んでいく山の稜線が、少し明るくなって、紫がかった雲が細くたなびいている。",
  highlights: [
    { word: "をかし", form: "をかし", note: "終止形" }
  ],
  source: "枕草子"
},
{
  sentence: "いとあはれなり。",
  translation: "とてもしみじみとした感動がある。",
  highlights: [
    { word: "あはれ", form: "あはれ", note: "形容動詞の語幹（あはれなり の語幹）" }
  ],
  source: "源氏物語"
},

// 生成文（source なし）
{
  sentence: "返り事もおぼつかなくて、日ごろ過ぎぬ。",
  translation: "返事もはっきりせず、何日も過ぎてしまった。",
  highlights: [
    { word: "おぼつかなし", form: "おぼつかなく", note: "連用形" }
  ]
},
{
  sentence: "いみじう美しき人の、わびしげにゐたるこそあはれなれ。",
  translation: "非常に美しい人が、心細そうにしているのはしみじみと感動的だ。",
  highlights: [
    { word: "いみじ",  form: "いみじう",  note: "連用形・ウ音便" },
    { word: "わびし",  form: "わびしげ",  note: "語幹 + 接尾語「げ」" },
    { word: "あはれ",  form: "あはれ",    note: "形容動詞の語幹" }
  ]
}
```

## パラメータ表

なし（レベルごとの語数の目標・動作に必要な最低語数・文字数の制約は、上の「ルール」の各表・項目に書く）。

## テスト観点

- データ整合性（全データを対象にしたスタティックテスト）:
  - すべての `highlights[].word` が `kogoList` の `word` と一致すること
  - すべての `highlights[].form` が対応する `sentence` に含まれること
  - `pos` が定義済み enum 値であること
  - `meaning` が30文字以内、`shortMeaning` の各要素が10文字以内であること
  - `englishMeaning` が50文字以内、`shortEnglishMeaning` の各要素が15文字以内であること

## 完了条件

- データ整合性テスト（`highlights[].form` ⊆ `sentence`、`pos` enum 値、文字数制約）がすべてパスする

## 実装裁量

なし（データの置き場所・ファイル名は `docs/spec.md` の「技術要件」のとおり）。
