import type { ExampleSentence } from '../logic/types';

export const exampleSentences: ExampleSentence[] = [
    {
        sentence: 'やうやう白くなりゆく山ぎは、すこしあかりて、紫だちたる雲のほそくたなびきたるこそ、をかしけれ。',
        translation: 'だんだん白くなっていく山の稜線が、少し明るくなって、紫がかった雲が細くたなびいているのは、趣深い。',
        highlights: [
            { word: 'をかし', form: 'をかしけれ', note: '已然形（係り結び）' },
        ],
        source: '枕草子',
        verified: true,
    },
    {
        sentence: 'いとあはれなり。',
        translation: 'とてもしみじみとした感動がある。',
        highlights: [
            { word: 'あはれ', form: 'あはれ', note: '形容動詞の語幹（あはれなり の語幹）' },
        ],
        source: '源氏物語',
        verified: true,
    },
    {
        sentence: '返り事もおぼつかなくて、日ごろ過ぎぬ。',
        translation: '返事もはっきりせず、何日も過ぎてしまった。',
        highlights: [
            { word: 'おぼつかなし', form: 'おぼつかなく', note: '連用形' },
        ],
        verified: true,
    },
    {
        sentence: 'いみじう美しき人の、わびしげにゐたるこそあはれなれ。',
        translation: '非常に美しい人が、心細そうにしているのはしみじみと感動的だ。',
        highlights: [
            { word: 'いみじ', form: 'いみじう', note: '連用形・ウ音便' },
            { word: 'わびし', form: 'わびしげ', note: '語幹 + 接尾語「げ」' },
            { word: 'あはれ', form: 'あはれ', note: '形容動詞の語幹' },
        ],
        verified: true,
    },
];
