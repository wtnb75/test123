import type { ExampleSentence } from '../logic/types';

export const exampleSentences: ExampleSentence[] = [
    {
        sentence: 'やうやう白くなりゆく山ぎは、すこしあかりて、紫だちたる雲のほそくたなびきたるこそ、をかしけれ。',
        translation: 'だんだん白くなっていく山の稜線が、少し明るくなって、紫がかった雲が細くたなびいているのは、趣深い。',
        translationEn: 'The mountain ridge gradually turning white, slightly brightening, with wisps of purple cloud trailing thinly — how charming.',
        highlights: [
            { word: 'をかし', form: 'をかしけれ', note: '已然形（係り結び）' },
            { word: 'やうやう', form: 'やうやう' },
        ],
        source: '枕草子 第一段',
        verified: true,
    },
    {
        sentence: '寺のさまもいとあはれなり。',
        translation: '寺の様子にも、とてもしみじみとした感動がある。',
        translationEn: 'The appearance of the temple, too, is deeply moving.',
        highlights: [
            { word: 'いと', form: 'いと', note: '非常に・たいそう（副詞）' },
            { word: 'あはれ', form: 'あはれ', note: '形容動詞の語幹（あはれなり の語幹）' },
        ],
        source: '源氏物語 若紫',
        verified: true,
    },
    {
        sentence: '返り事もおぼつかなくて、日ごろ過ぎぬ。',
        translation: '返事もはっきりせず、何日も過ぎてしまった。',
        translationEn: 'Days passed with no clear reply forthcoming.',
        highlights: [
            { word: 'おぼつかなし', form: 'おぼつかなく', note: '連用形' },
        ],
        verified: true,
    },
    {
        sentence: 'いみじう美しき人の、わびしげにゐたるこそあはれなれ。',
        translation: '非常に美しい人が、心細そうにしているのはしみじみと感動的だ。',
        translationEn: 'A remarkably beautiful person sitting in a forlorn, melancholy way — how poignant.',
        highlights: [
            { word: 'いみじ', form: 'いみじう', note: '連用形・ウ音便' },
            { word: 'わびし', form: 'わびしげ', note: '語幹 + 接尾語「げ」' },
            { word: 'あはれ', form: 'あはれ', note: '形容動詞の語幹' },
            { word: 'うつくし', form: '美しき' },
        ],
        verified: true,
    },
    {
        // arigatashi
        sentence: 'なほ、南の御殿の御心もちゐこそ、さまざまにありがたう、さてはこの御方の御心などこそは、めでたきものには、見たてまつり果てはべりぬれ。',
        translation: 'やはり、南の御殿(＝紫の上)のお心遣いこそ、さまざまにめったにないほど優れていて、また、このお方のお心などこそは、素晴らしいものとして、最後まで拝見いたしました。',
        translationEn: "The Lady of the South Wing's conduct is in every way exceedingly rare and admirable; and this lady's heart, too, I have found splendid to the very end.",
        highlights: [
            { word: 'ありがたし', form: 'ありがたう', note: '連用形ウ音便。めったにない（現代語「ありがとう」の原義）' },
            { word: 'めでたし', form: 'めでたき', note: '連体形。すばらしい・めでたい' },
        ],
        source: '源氏物語 夕霧',
        verified: true,
    },
    {
        // ayashi
        sentence: 'これをもあはれと見てをるに、竹取の翁走り入りていはく、この皇子に申し給ひし蓬莱の玉の枝を、一つの所もあやしき處なく、あやまたずもておはしませり。',
        translation: 'これもしみじみと眺めていたところ、竹取の翁が走り込んで言うには、この皇子に申し上げた蓬莱の玉の枝を、一か所も怪しいところがなく、違わずお持ち帰りになりました。',
        translationEn: 'While gazing at this with deep feeling, the old bamboo-cutter came running in and said the jewelled branch of Hōrai, commissioned from this prince, had been brought back without a single flaw or error.',
        highlights: [
            { word: 'あやし', form: 'あやしき', note: '連体形。不思議・粗末・身分が低い（現代語「怪しい」より広い意味）' },
            { word: 'あはれ', form: 'あはれ', note: 'しみじみとした感動（形容動詞語幹）' },
        ],
        source: '竹取物語',
        verified: true,
    },
    {
        // obotsuka
        sentence: 'また心得たれども、知れりともいはず、おぼつかなからぬは、とかくの事なく、知らぬ人と同じやうにて過ぐる人あり。',
        translation: 'またよく理解していても知っているとも言わず、はっきりわからない様子も見せず、何事もなく、知らない人と同じようにして過ごす人がいる。',
        translationEn: 'There are also people who, even when they understand something well, neither claim to know it nor show any sign of uncertainty — passing without comment, as though complete strangers to the matter.',
        highlights: [
            { word: 'おぼつかなし', form: 'おぼつかな', note: '「おぼつかなから＋ぬ」連用形＋打消連体形（二重否定）' },
        ],
        source: '徒然草',
        verified: true,
    },
    {
        // tsurenashi
        sentence: '女も、常よりことに、大臣の思ひ嘆きたまへる御けしきに、恥づかしう、憂き身と思し沈めど、上はつれなくおほどかにて、眺め過ぐしたまふ。',
        translation: '女も、いつもより特別に、大臣が嘆き悲しんでいらっしゃるご様子に、恥ずかしく、つらい境遇と思い沈んでいるが、表面上は素知らぬ顔でおっとりとして、物思いにふけりながら過ごしていらっしゃる。',
        translationEn: 'The lady, too, more than usually aware of the Minister\'s grief, felt ashamed and sank into her own anguish; but outwardly she kept an air of calm indifference and passed her days in quiet reverie.',
        highlights: [
            { word: 'つれなし', form: 'つれなく', note: '連用形。素知らぬ顔・冷淡に（外見と内面のギャップ）' },
        ],
        source: '源氏物語 梅枝',
        verified: true,
    },
    {
        // kokoromoto
        sentence: '世に譬ふべきにあらざりしかど、この枝を折りてしかば、さらに心もとなくて、船に乘りて追風ふきて、四百餘日になんまうで來にし。',
        translation: 'この世のものとは思えないほど素晴らしかったですが、この枝を折りましたので、さらに気がかりで落ち着かず、船に乗って追い風が吹き、四百余日でこちらに参りました。',
        translationEn: 'It was beyond anything in this world, yet once I broke off this branch I felt deeply anxious and unsettled; I boarded a ship with a following wind and arrived after more than four hundred days.',
        highlights: [
            { word: 'こころもとなし', form: '心もとなく', note: '連用形。気がかりで落ち着かない・不安だ' },
        ],
        source: '竹取物語',
        verified: true,
    },
    {
        // hashitanashi
        sentence: '帰り入らむに、道も昼ははしたなかるべしと急がせたまひて、御祈りにさぶらふ中に、やむごとなう尊き限り召し入れて、御髪下ろさせたまふ。',
        translation: 'お帰りになるのに、道も昼間は人目についてきまりが悪いだろうと急がせて、ご祈祷にお仕えしている中でも高貴で尊いお方だけを召し入れて、出家なさった。',
        translationEn: 'Fearing the road home would be awkward in broad daylight, he urged her to hurry; of those attending the prayers, only the most noble and revered were called in, and she took the tonsure.',
        highlights: [
            { word: 'はしたなし', form: 'はしたなかる', note: '連体形（推量に続く）。きまりが悪い・中途半端だ' },
            { word: 'さぶらふ', form: 'さぶらふ', note: '謙譲・丁寧語。お仕えする・ございます' },
            { word: 'やむごとなし', form: 'やむごとなう', note: '連用形ウ音便（やむごとなく→やむごとなう）。高貴だ' },
        ],
        source: '源氏物語 柏木',
        verified: true,
    },
    {
        // yamugoto
        sentence: 'かくおぼえぬやむごとなき客人のおはすると聞きて、もと勤めざりける家司など、うちつけに参りて、政所など言ふ方にさぶらひて営みけり。',
        translation: 'このように思いがけない高貴なお客様がいらっしゃると聞いて、以前は怠けていた家司などが、すぐに参上して、政所などという所に来て働いた。',
        translationEn: 'Hearing that such an unexpectedly distinguished guest had arrived, stewards who had formerly been negligent came at once, stationed themselves in the household offices, and set to work.',
        highlights: [
            { word: 'やむごとなし', form: 'やむごとなき', note: '連体形。高貴な・格別な' },
            { word: 'おぼゆ', form: 'おぼえぬ', note: '「おぼえ＋ぬ」連用形＋打消連体形。思いがけない' },
            { word: 'さぶらふ', form: 'さぶらひ', note: '連用形。お仕えして（謙譲語）' },
        ],
        source: '源氏物語 夕霧',
        verified: true,
    },
    {
        // kokoronikushi
        sentence: '能をつかむとする人、よくせざらむ程は、なまじひに人に知られじ、内々よく習ひ得てさし出でたらむこそ、いと心にくからめ。',
        translation: '芸能を身につけようとする人は、うまくできないうちは、なまじっか人に知られまいとして、内々でよく習い覚えてから出てきたならば、とても奥ゆかしいだろう。',
        translationEn: 'A person who wishes to acquire a skill, while still unskilled, should try not to let others see; quietly mastering it in private and then stepping forward — that would be truly refined.',
        highlights: [
            { word: 'こころにくし', form: '心にく', note: '奥ゆかしい・上品（現代語「心憎い」とは逆の意味）' },
        ],
        source: '徒然草',
        verified: true,
    },
    {
        // kanashi
        sentence: 'にくげなるちごを、おのが心地のかなしきままに、うつくしみ、かなしがり、これが声のままに、言ひたることなど語りたる。',
        translation: '可愛げのない赤ちゃんを、自分の気持ちの愛しいままに、かわいいと思い、愛しがって、この子の声のままに（真似して）言ったことなどを語っているのは（みっともない）。',
        translationEn: 'Taking an unattractive baby and, purely out of parental love, doting on it and babying it, then retelling things it said in its own lisping voice — (how tiresome).',
        highlights: [
            { word: 'かなし', form: 'かなしき', note: '「愛し」= 愛しい・かわいい（この文では「悲しい」ではなく愛情）' },
            { word: 'うつくし', form: 'うつくし', note: 'かわいい・いとしい（現代語より愛情の意が強い）' },
        ],
        source: '枕草子 第九十二段',
        verified: true,
    },
    {
        // kohishi
        sentence: 'いやまさりつつおぼえつつ。なをわりなくこひしきことのみおぼえければ。',
        translation: '恋しさがますます強くなり思いが募る。どうしようもなく恋しいことばかり思われたので。',
        translationEn: 'The longing growing ever stronger and deeper; unable to bear the yearning that kept welling up.',
        highlights: [
            { word: 'こひし', form: 'こひしき', note: '連体形。恋しい・慕わしい' },
            { word: 'おぼゆ', form: 'おぼえけれ', note: '下二段連用形＋過去「けり」已然形（係り結び）' },
        ],
        source: '伊勢物語',
        verified: true,
    },
    {
        // yoshi
        sentence: 'まいて五つ六つなどは、ただ覺えぬよしをぞ啓すべけれど、「さやはけ惡くく、仰事をはえなくもてなすべき」といひ口をしがるもをかし。',
        translation: 'ましてや五つ六つ（の歌）ともなれば、ただ覚えていないという旨を申し上げればよいのだが、「そんなことでは格好が悪い、仰せのことをそのままにしておけるものか」と言って口惜しがるのもおもしろい。',
        translationEn: 'For five or six poems, one should simply report that one cannot recall them; yet the person who frets, saying "How disgraceful — I cannot just leave the command unfulfilled," is quite amusing.',
        highlights: [
            { word: 'よし', form: 'よし', note: '名詞「由」= 旨・事情（形容詞「よし」ではない）' },
            { word: 'をかし', form: 'をかし', note: '趣がある・おもしろい（現代語「おかしい＝滑稽」とは異なる）' },
        ],
        source: '枕草子 第二十段',
        verified: true,
    },
    {
        // kanashi
        sentence: '思ひ出でぬ事なく思ひ戀しきがうちに、この家にて生れし女子のもろともに歸らねばいかゞはかなしき。',
        translation: '（京のことを）思い出さないことはなく、思い慕わしい中に、この家で生まれた女の子が一緒に帰ってくれないので、どれほど悲しいことか。',
        translationEn: 'There is nothing I do not recall with longing; and among these memories, the girl born in this house who does not return with me — how unspeakably sad.',
        highlights: [
            { word: 'かなし', form: 'かなしき', note: '「悲し」= 悲しい（土佐日記では亡き娘への悲しみ）' },
        ],
        source: '土佐日記',
        verified: true,
    },
    {
        // hakanashi
        sentence: 'すべて世のありにくきこと、わが身とすみかとの、はかなくあだなるさまかくのごとし。',
        translation: '世の中に生き難いことはすべて、わが身と住まいとのはかなく無常なありさまは、この（川の流れや泡の）ようなものだ。',
        translationEn: 'The difficulty of living in this world — the fleeting and insubstantial nature of our selves and our dwellings — is exactly like this.',
        highlights: [
            { word: 'はかなし', form: 'はかなく', note: '連用形。頼りない・はかない・無常' },
            { word: 'あだなり', form: 'あだなる', note: '連体形。はかない・誠実でない・無常' },
        ],
        source: '方丈記',
        verified: true,
    },
    {
        // ohoshi
        sentence: '萬の鳥獸、小さき蟲までも、心をとめてありさまを見るに、子をおもひ親をなつかしくし、夫婦を伴ひ、妬み、怒り、慾おほく、身を愛し、命を惜しめる事、偏に愚癡なるゆゑに、人よりも勝りて甚だし。',
        translation: 'あらゆる鳥獣、小さな虫までも、じっくりとその様子を見ると、子を思い、親を慕い、夫婦で連れ添い、嫉妬し、怒り、欲が多く、わが身を大切にして命を惜しむことは、ひとえに愚かであるゆえに、人間よりもはるかに優れている。',
        translationEn: 'Looking closely at all birds and beasts, even the smallest insects, one sees them cherishing their young, longing for their parents, going with their mates, feeling jealousy and anger, harbouring many desires, loving themselves and clinging to life — all because of foolishness, and in this they surpass even humans.',
        highlights: [
            { word: 'おほし', form: 'おほく', note: '連用形ウ音便（おほく）。多く' },
            { word: 'おもふ', form: 'おもひ', note: '連用形。思い' },
            { word: 'なつかし', form: 'なつかしく', note: '慕わしい・親しみを感じる（現代語「懐かしい」より積極的な感情）' },
        ],
        source: '徒然草',
        verified: true,
    },
    {
        // susamaji
        sentence: 'いみじうねぶたしと思ふに、いとしもおぼえぬ人の、押し起こして、せめてもの言ふこそ、いみじうすさまじけれ。',
        translation: '非常に眠いと思っているのに、それほど親しいとも思えない人が無理に起こして、しきりに話しかけてくることこそ、非常に興ざめだ。',
        translationEn: 'When one is terribly sleepy, and someone not particularly close keeps waking one up and insisting on talking — that is utterly dreary.',
        highlights: [
            { word: 'すさまじ', form: 'すさまじけれ', note: '已然形（係り結び）。興ざめだ（現代語「凄まじい」とは意味が異なる）' },
            { word: 'いみじ', form: 'いみじう', note: '連用形ウ音便。非常に・ひどく' },
            { word: 'おぼゆ', form: 'おぼえぬ', note: '「おぼえ＋ぬ」連用形＋打消連体形。さほど思えない' },
        ],
        source: '枕草子 第二十二段',
        verified: true,
    },
    {
        // wataru
        sentence: 'ある人縣の四年五年はてゝ例のことゞも皆しをへて、解由など取りて住むたちより出でゝ船に乘るべき所へわたる。',
        translation: 'ある人が国司として四、五年（の任期）が経って、いつものことをすべて終えて、引き継ぎの証文などを受け取って、住んでいた館から出て、船に乗るべき場所へ移動した。',
        translationEn: 'After four or five years as provincial governor, a certain person completed all customary business, received the transfer document, left his residence, and made his way to the place where they would board a ship.',
        highlights: [
            { word: 'わたる', form: 'わたる' },
        ],
        source: '土佐日記',
        verified: true,
    },
    {
        // odoroku
        sentence: '男君もにくからずうち笑みたるに、ことにおどろかず、顔すこし赤みてゐたるこそ、をかしけれ。',
        translation: '男の君も嫌な感じでなくにっこりしているのに、（女の君は）特に驚いた様子も見せず、顔を少し赤らめているのは趣深い。',
        translationEn: 'The young lord, smiling pleasantly, yet she showed no particular sign of surprise, just sitting there with her cheeks slightly flushed — how charming.',
        highlights: [
            { word: 'おどろく', form: 'おどろ', note: '「おどろか」未然形＋打消。驚く・気づく・目が覚める' },
            { word: 'をかし', form: 'をかしけれ', note: '已然形（係り結び）。趣がある・おもしろい' },
        ],
        source: '枕草子 第二段',
        verified: true,
    },
    {
        // mikado
        sentence: '鳥籠の山は、わが名もらすなと、みかどのよませ給ひけん、いとをかし。',
        translation: '鳥籠の山は「私の名を漏らすな」と、天皇がお詠みになったのだろう、とても趣深い。',
        translationEn: '"Torigoeyama" — that the Emperor is said to have composed about it meaning "let no one speak my name" — how delightful.',
        highlights: [
            { word: 'みかど', form: 'みかど' },
            { word: 'をかし', form: 'をかし' },
        ],
        source: '枕草子 第十段',
        verified: true,
    },
    {
        // kisaki
        sentence: 'ニ條のきさきともこのことは一本なるべし。',
        translation: '二条の后のことと（いとこの女御のこと）は、元は一つの同じ話のはずだ。',
        translationEn: 'The story of the Second Empress and this tale are probably one and the same at their root.',
        highlights: [
            { word: 'きさき', form: 'きさき' },
        ],
        source: '伊勢物語',
        verified: true,
    },
    {
        // atarashi
        sentence: '言ふかひなき御ことをばさるものにて、この殿のかくならひたてまつりて、今はとよそに思ひきこえむこそ、あたらしく口惜しけれ。',
        translation: '言いようもないお気の毒な（亡くなってしまった）ことはさることながら、このお方にこのように親しみ申し上げて、今はもうよそよそしく思い申し上げることこそ、もったいなく残念なことだ。',
        translationEn: 'Setting aside the unspeakable grief of your passing, how wasteful and wretched it is that, having grown so intimate with you, I must now regard you as a stranger.',
        highlights: [
            { word: 'あたらし', form: 'あたらしく', note: '連用形。もったいなく惜しい（現代語「新しい」とは別の意味）' },
        ],
        source: '源氏物語 総角',
        verified: true,
    },
    {
        // tsuredure
        sentence: '旅の宿りは、つれづれにて、庭の草もいぶせき心地するに、いやしき東声したる者どもばかりのみ出で入り、慰めに見るべき前栽の花もなし。',
        translation: '旅の仮住まいは退屈で、庭の草も鬱陶しく感じられるのに、賤しい東国言葉を話す者たちばかりが出入りして、慰めに眺めるべき庭の花もない。',
        translationEn: 'The wayside lodgings were tediously dull; the garden weeds felt oppressively gloomy; only rough-spoken easterners came and went, and there was not even a garden plant in bloom to offer comfort.',
        highlights: [
            { word: 'つれづれ', form: 'つれづれ', note: '名詞。退屈・物思いに沈む状態' },
            { word: 'いぶせし', form: 'いぶせき', note: '連体形。気が晴れない・鬱陶しい（現代語にない語）' },
        ],
        source: '源氏物語 東屋',
        verified: true,
    },
    {
        // tsuredure
        sentence: 'もしつれづれなる時は、これを友としてあそびありく。',
        translation: 'もし退屈な時は、これ（山守の子）を友として楽しみ歩く。',
        translationEn: 'Whenever I am at a loose end, I take this child as my companion and wander about.',
        highlights: [
            { word: 'つれづれ', form: 'つれづれなる', note: '形容動詞「つれづれなり」連体形。退屈な' },
        ],
        source: '方丈記',
        verified: true,
    },
    {
        // mairu
        sentence: '御簾のうちに、女房櫻の唐衣どもくつろかにぬぎ垂れつつ、藤山吹などいろいろにこのもしく、あまた小半蔀の御簾より押し出でたるほど、晝御座のかたに御膳まゐる。',
        translation: '御簾の中に、女房たちが桜の唐衣をくつろいだ様子で脱ぎ垂れて、藤や山吹などさまざまに目を引いて、たくさんの小半蔀の御簾から押し出したころに、（天皇の）昼の御座所の方へお食事を差し上げる。',
        translationEn: 'Within the blinds, ladies loosening their cherry-blossom jackets, wisteria and yamabuki in many colours pressing out from the low-slatted blinds — and at that moment a meal was carried to the Emperor\'s daytime chamber.',
        highlights: [
            { word: 'まゐる', form: 'まゐる', note: '謙譲語。差し上げる・お持ちする（ここでは御膳を差し上げる意）' },
            { word: 'あまた', form: 'あまた', note: '副詞。たくさん・数多く' },
        ],
        source: '枕草子 第二十段',
        verified: true,
    },
    {
        // mairu
        sentence: '今の世のことしげきにまぎれて、院にはまゐる人もなきぞ寂しげなる。',
        translation: '今の世の雑事の多さに紛れて、院にはお参りする人もないのは寂しいことだ。',
        translationEn: 'Lost in the busyness of today\'s world, no one comes to visit the Retired Emperor\'s residence — how lonely it seems.',
        highlights: [
            { word: 'まゐる', form: 'まゐる', note: '謙譲語。参上する（院に参上する意）' },
        ],
        source: '徒然草',
        verified: true,
    },
    {
        // mairu
        sentence: '初雪のあした、枝を肩にかけて、中門より振舞ひてまゐる。',
        translation: '初雪の朝、枝を肩にかけて、中門からわざとらしく振る舞いながら参上する。',
        translationEn: 'On the morning of the first snow, he came sauntering in through the central gate with a branch over his shoulder, presenting himself with deliberate flair.',
        highlights: [
            { word: 'まゐる', form: 'まゐる', note: '謙譲語。参上する' },
        ],
        source: '徒然草',
        verified: true,
    },
    {
        // kuchioshi
        sentence: 'ただ一つある鏡をたいまつるとて海にうちはめつればいとくちをし。',
        translation: 'ただ一つある鏡を海神に奉納しようとして海に投げ入れてしまったので、とても残念だ。',
        translationEn: 'Having thrown our only mirror into the sea as an offering to the sea god, it is very regrettable.',
        highlights: [
            { word: 'くちをし', form: 'くちをし', note: '終止形。残念だ・悔しい' },
        ],
        source: '土佐日記',
        verified: true,
    },
    {
        // kuchioshi
        sentence: 'わすれがたくくちをしきことおほかれどえつくさず。',
        translation: '忘れられず残念なことは多いけれど、書き尽くせない。',
        translationEn: 'There are many things I cannot forget and deeply regret, but I cannot write them all down.',
        highlights: [
            { word: 'くちをし', form: 'くちをしき', note: '連体形。残念な・悔しい' },
        ],
        source: '土佐日記',
        verified: true,
    },
    {
        // yagate
        sentence: 'あるにも過ぎて、人はものをいひなすに、まして年月すぎ、境も隔たりぬれば、いひたき侭に語りなして、筆にも書き留めぬれば、やがて定りぬ。',
        translation: '人は実際よりも大げさに言うものだが、まして年月が過ぎ、距離も離れてしまえば、言いたいままに語り作って、筆でも書き留めてしまえば、そのまま（事実として）定まってしまう。',
        translationEn: 'People already exaggerate beyond what happened; and when years pass and distances grow, things get told however one wishes, and once set down in writing they become fixed as established truth.',
        highlights: [
            { word: 'やがて', form: 'やがて', note: 'そのまま（現代語「やがて＝まもなく」と意味が異なる）' },
            { word: 'まして', form: 'まして', note: 'なおさら・いわんや（強調の副詞）' },
        ],
        source: '徒然草',
        verified: true,
    },
    {
        // yagate
        sentence: '出仕して饗膳などにつく時も、皆人の前すゑわたすを待たず、我が前にすゑぬれば、やがて獨りうち食ひて、歸りたければ、ひとりついたちて行きけり。',
        translation: '出仕して饗宴などに着く時も、他の人の前に膳を置き終えるのを待たず、自分の前に置かれると、そのまま一人で食べて、帰りたくなれば、一人立ち上がって行ってしまったそうだ。',
        translationEn: 'Even at court banquets, not waiting for everyone else\'s trays to be placed, he would eat alone as soon as his was set down; when he wished to leave, he would simply rise and go by himself.',
        highlights: [
            { word: 'やがて', form: 'やがて', note: 'そのまま・すぐに（現代語「やがて」と意味が異なる）' },
        ],
        source: '徒然草',
        verified: true,
    },
    {
        // yagate
        sentence: '蔵人思ひしめたる人の、ふとしもえならぬが、その日、青色着たるこそ、やがて脱がせでもあらばやと、おぼゆれ。',
        translation: '蔵人になりたいと思っていた人が、それほど優れているわけでもないのに、その（祭りの）日に（蔵人と同じ）青色を着ている。そのまま脱がせずにおいてあげたいと思われる。',
        translationEn: 'Someone who had set his heart on becoming a royal chamberlain, though not particularly distinguished, is wearing the blue robe on that day — one wishes it could just remain on him as it is.',
        highlights: [
            { word: 'やがて', form: 'やがて', note: 'そのまま（ここでは「脱がせずそのまま」の意）' },
            { word: 'おぼゆ', form: 'おぼゆれ', note: '已然形（係り結び）。思われる・感じられる' },
        ],
        source: '枕草子 第二段',
        verified: true,
    },
    {
        // nakanaka
        sentence: 'なみの音つねにかまびすしくて、潮風殊にはげしく、內裏は山の中なれば、かの木の丸殿もかくやと、なかなかやうかはりて、いうなるかたも侍りき。',
        translation: '波の音はいつもうるさく、潮風が特に激しく、内裏（皇居）は山の中なので、あの木の丸殿もこんな感じだったかと、かえって様子が変わっていて、趣のある面もありました。',
        translationEn: 'The sound of waves was endlessly noisy, the sea winds unusually fierce; the palace being in the mountains, it was perhaps like that famed log-cabin hall of old — and indeed there was an unexpectedly different kind of elegance to it.',
        highlights: [
            { word: 'なかなか', form: 'なかなか', note: 'かえって（現代語「なかなか」と意味が異なる）' },
        ],
        source: '方丈記',
        verified: true,
    },
    {
        // nakanaka
        sentence: '入道も、さて出だし放たむは、いとうしろめたう、さりとて、かく埋もれ過ぐさむを思はむも、なかなか来し方の年ごろよりも、心尽くしなり。',
        translation: '（明石の）入道も、そのように（娘を）送り出してしまうのはとても不安で、だからといって、このように埋もれたまま過ごさせることを思っても、かえってこれまでの年月よりも心が尽き果てることだ。',
        translationEn: 'The priest, too, was deeply troubled at sending his daughter off like that; yet to contemplate letting her remain buried here was, on the contrary, even more heartbreaking than all the years that had already passed.',
        highlights: [
            { word: 'なかなか', form: 'なかなか', note: 'かえって・むしろ（現代語と反対になることがある）' },
        ],
        source: '源氏物語 澪標',
        verified: true,
    },
    {
        // nakanaka
        sentence: '光いとどまさりたまへるさま、容貌よりはじめて、飽かぬことなきを、主人の大臣も、「なかなか人に圧されまし宮仕へよりは」と、思し直る。',
        translation: '輝きがますます強くなったご様子を、容貌をはじめとして見飽きることがないので、主人の大臣も、「むしろ人に圧倒される宮仕えよりはよい」と、お考え直しになる。',
        translationEn: 'His ever more radiant brilliance left nothing to be desired; and the master of the house, too, reconsidered and thought, "This is rather better than court service where one is eclipsed by others."',
        highlights: [
            { word: 'なかなか', form: 'なかなか', note: 'むしろ（宮仕えよりもむしろの意）' },
        ],
        source: '源氏物語 藤裏葉',
        verified: true,
    },
    {
        // yuyushi
        sentence: '権中将、「もとよりうち切りて、定澄僧都の枝扇にせばや」とのたまひしを、山階寺の別当になりて、慶び申す日、近衛司にてこの君の出でたまへるに、高きけいしをさへ履きたれば、ゆゆしう高し。',
        translation: '権中将が「（梨の木を）根本から切り取って定澄僧都の枝扇にしたい」とおっしゃったのを、（定澄僧都が）山階寺の別当になってお祝い申し上げる日に、近衛府でこの君（定澄僧都）が出てこられたところ、高い下駄まで履いていたので、非常に（背が）高い。',
        translationEn: 'The Middle Captain had wished to cut the tree at its root to make a branch fan for the Bishop; then, on the day the Bishop came to give thanks for his appointment, he emerged at the guards\' office wearing tall clogs on top of everything — extraordinarily tall.',
        highlights: [
            { word: 'ゆゆし', form: 'ゆゆしう', note: '連用形ウ音便。非常に（ここでは背が「非常に高い」の意）' },
        ],
        source: '枕草子 第九段',
        verified: true,
    },
    {
        // yuyushi
        sentence: '御まうけなどさま変はりて、もののはじめゆゆしげなれど、もの参らせなど、皆静まりぬるに、渡りたまて、少将の君をいみじう責めたまふ。',
        translation: 'お支度なども様子が変わっていて、始まり（新婚）が不吉な感じだが、お食事なども皆静まったころに、お渡りになって、少将の君をひどく責め立てなさる。',
        translationEn: 'The preparations were unusual in manner and the beginning seemed ominous; but when the meal was over and all had grown quiet, he went to her and pressed Lady Shōshō very hard.',
        highlights: [
            { word: 'ゆゆし', form: 'ゆゆしげ', note: '語幹＋接尾語「げ」。不吉な感じ（お産の場面）' },
            { word: 'いみじ', form: 'いみじう', note: '連用形ウ音便。非常に・ひどく' },
        ],
        source: '源氏物語 夕霧',
        verified: true,
    },
    {
        // yuyushi
        sentence: 'かやうの御供にも、思ひかけず長き命いとつらくおぼえはべるを、人もゆゆしく見思ふべければ、今は世にあるものとも人に知られはべらじ。',
        translation: 'このようなお供にも（参加して）、思いがけなく長い命がとてもつらく感じられますが、人も（長生きを）不吉なことと見て思うでしょうから、今はこの世に生きている者とも人に知られたくはございません。',
        translationEn: 'Even to attend on such occasions, I feel my unexpectedly long life painfully burdensome; and since others must regard longevity as ill-omened, I no longer wish to be known as one still living in this world.',
        highlights: [
            { word: 'ゆゆし', form: 'ゆゆしく', note: '連用形。不吉だ・縁起が悪い（長生きを不吉とみる表現）' },
            { word: 'つらし', form: 'つらく', note: '連用形。つらい・苦しい' },
            { word: 'おぼゆ', form: 'おぼえ', note: '連用形。感じられる・思われる' },
        ],
        source: '源氏物語 早蕨',
        verified: true,
    },
    {
        // tamau
        sentence: '重きけいなりとて、牛を陰陽師のもとへ遣すべきよし、おの〳〵申しけるを、父の相國聞きたまひて、牛に分別なし、足あらばいづくへかのぼらざらむ。',
        translation: '重い凶兆であるとして牛を陰陽師のもとへ送るべきとの旨を各々が申したのを、父の相国（太政大臣）がお聞きになって、「牛に（善悪の）分別はない、足があればどこへでも行けるだろう」（とおっしゃった）。',
        translationEn: 'When everyone said the ox should be sent to the diviner as a weighty omen, the Chancellor, the boy\'s father, overheard and said: "An ox has no sense of good or ill — if it has legs, is there anywhere it could not go?"',
        highlights: [
            { word: 'たまふ', form: 'たまひ', note: '「聞きたまひ」尊敬語。お聞きになる' },
        ],
        source: '徒然草',
        verified: true,
    },
    {
        // tamau
        sentence: '『月をめで花をながめし古のやさしき人はこゝにあり原』と詠みたまひけるは、岩本の社とこそ承りおき侍れど、おのれらよりは、なか〳〵御存じなどもこそさぶらはめ。',
        translation: '『月を愛で 花を眺めし 古の やさしき人は ここに在原』とお詠みになったのは岩本の社のことと承っておりますが、私どもよりは、（あなた様の方が）かえってよくご存知のことでしょう。',
        translationEn: 'The poem "Gazing at the moon, admiring the flowers — the gentle man of old is here, at Arihara" is said to refer to Iwamoto Shrine; but you, I should think, would know it far better than I do.',
        highlights: [
            { word: 'たまふ', form: 'たまひける', note: '「詠みたまひける」尊敬語。お詠みになった' },
            { word: 'さぶらふ', form: 'さぶら', note: '未然形。いらっしゃる（丁寧語）' },
        ],
        source: '徒然草',
        verified: true,
    },
    {
        // itohoshi
        sentence: 'かぐや姫のいふやう、「親ののたまふことを、ひたぶるにいなび申さんことのいとほしさに、得難きものを、かくあさましくもてくること」をねたく思ひ、翁は閨の内しつらひなどす。',
        translation: 'かぐや姫が言うには、「親の言うことを頑なにお断りするのが気の毒で（承諾していたのに）、手に入れ難いものをこのようにひどい偽物として持ってくること」を腹立たしく思い、翁は閨の中を整えなどする。',
        translationEn: 'Kaguya-hime said: "Out of pity for my parents, whom I could not flatly refuse, I had agreed; yet here he brings back such a shameful counterfeit of something near-impossible to obtain" — she felt resentful; meanwhile the old man busied himself arranging the bedchamber.',
        highlights: [
            { word: 'いとほし', form: 'いとほし', note: '気の毒だ・かわいそうだ（現代語「いとしい」とは異なる）' },
            { word: 'あさまし', form: 'あさましく', note: '連用形。驚きあきれる・情けない（現代語「浅ましい」より驚きの意が強い）' },
            { word: 'ねたし', form: 'ねたく', note: '連用形。ねたましい・腹立たしい' },
        ],
        source: '竹取物語',
        verified: true,
    },
    {
        // sasugani
        sentence: 'さすがに一たび道に入りて、世をいとなむ人、たとひ望みありとも、勢ひある人の貪欲多きに似るべからず。',
        translation: 'そうはいっても、一度仏道に入って世を営む人は、たとえ欲望があっても、権勢ある人の貪欲の多さに似てはならない。',
        translationEn: 'Still, a person who has once entered the religious path and devoted themselves to it, even if they have desires, must not resemble the powerful who are ridden with greed.',
        highlights: [
            { word: 'さすがに', form: 'さすがに' },
        ],
        source: '徒然草',
        verified: true,
    },
    {
        // sasugani
        sentence: '御返事さすがに憎からず聞えかはし給ひて、おもしろき木草につけても、御歌を詠みてつかはす。',
        translation: 'お返事をさすがに嫌ではなくやり取りなさって、趣のある木や草につけても、和歌をお詠みになってお送りになる。',
        translationEn: 'He nonetheless exchanged replies that were not unpleasant, and attaching poems even to beautiful trees and plants, he composed and sent verses.',
        highlights: [
            { word: 'さすがに', form: 'さすがに' },
        ],
        source: '竹取物語',
        verified: true,
    },
    {
        // mutsukashi
        sentence: 'この御ことはべらざらましかば、うちうちやすからずむつかしきことは、折々はべりとも、なだらかに、年ごろのままにておはしますべきものを。',
        translation: 'この御方（の姫君）がいらっしゃらなかったならば、内々には気苦労でわずらわしいことが折々あっても、穏やかに、これまでのままでいらっしゃれたはずなのに。',
        translationEn: 'Had this young lady not been here, even if there were at times private vexations and troublesome matters, things could have proceeded smoothly, as they had been for years.',
        highlights: [
            { word: 'むつかし', form: 'むつかしき' },
        ],
        source: '源氏物語 東屋',
        verified: true,
    },
    {
        // mutsukashi
        sentence: 'むつかしげにおはするほどを、絶えず抱きとりたまへば、まことの祖母君は、ただ任せたてまつりて、御湯殿の扱ひなどを仕うまつりたまふ。',
        translation: '（赤ちゃんが）ぐずっているところを絶えずお抱きになるので、実の祖母君はただお任せ申し上げて、お湯浴みのお世話などをなさる。',
        translationEn: 'As the infant was fussy and he kept holding it without pause, the real grandmother simply left things to him and attended to the bathing and other care.',
        highlights: [
            { word: 'むつかし', form: 'むつかし' },
        ],
        source: '源氏物語 若菜上',
        verified: true,
    },
    {
        // itoma
        sentence: '秋の夕べは、まして、心のいとまなく思し乱るる人の御あたりに心をかけて、あながちなるゆかりも尋ねまほしき心もまさりたまふなるべし。',
        translation: '秋の夕暮れには、なおさら、心の余裕なく思い乱れる方（藤壺の宮）のそばに心を向けて、無理をしてでも縁のある人を探し出したい気持ちもいっそう強くなるのだろう。',
        translationEn: 'On an autumn evening, all the more so, one\'s heart turns toward the one lost in distracted thought, and the longing to seek out even a tenuous connection grows still stronger.',
        highlights: [
            { word: 'いとま', form: 'いとまなく' },
            { word: 'まして', form: 'まして' },
        ],
        source: '源氏物語 若紫',
        verified: true,
    },
    {
        // mamoru
        sentence: '必ず禁戒をまもるとしもなけれども、境界なければ何につけてか破らむ。',
        translation: '必ずしも戒律を守るというわけでもないが、（欲望を引き起こすような）境界がなければ、何をきっかけに（戒律を）破ることがあろうか（いや、ない）。',
        translationEn: 'It is not as if I strictly keep all the precepts; but without fixed boundaries, what occasion would there be to break them?',
        highlights: [
            { word: 'まもる', form: 'まもる' },
        ],
        source: '方丈記',
        verified: true,
    },
    {
        // mamoru
        sentence: '棊盤のすみに石を立てて彈くに、むかひなる石をまもりて彈くはあたらず。',
        translation: '碁盤の隅に石を立てて弾くのに、向かいの石をじっと見つめて弾くと当たらない。',
        translationEn: 'When flicking a stone standing at the corner of a go board, staring fixedly at the stone opposite does not lead to a hit.',
        highlights: [
            { word: 'まもる', form: 'まもり' },
        ],
        source: '徒然草',
        verified: true,
    },
    {
        // monogurohoshi
        sentence: 'ひとへに知らぬ人なれば、あなものぐるほしと、はしたなめさし放たむにもやすかるべきを、昔よりさま異なる頼もし人にならひ来て、今さらに仲悪しくならむも、なかなか人目悪しかるべし。',
        translation: 'まったく知らない人であれば、「なんと非常識な」と蔑んで突き放すのも簡単なのに、昔から特別な頼りにする人として親しんできて、今更仲が悪くなるのも、かえって世間体が悪いだろう。',
        translationEn: 'If he were a complete stranger, it would be easy to dismiss him as outrageous and push him away; but having long relied on him as a special confidant, to now fall out with him would, on the contrary, look bad to the world.',
        highlights: [
            { word: 'ものぐるほし', form: 'ものぐるほし' },
            { word: 'はしたなし', form: 'はしたな' },
            { word: 'なかなか', form: 'なかなか' },
        ],
        source: '源氏物語 宿木',
        verified: true,
    },
    {
        // tada
        sentence: 'これをはらからなどにはあらぬ人の、気近く言ひかよひて、事に触れつつ、おのづから声けはひをも聞き見馴れむは、いかでかただにも思はむ。',
        translation: '（その姫を）兄弟でもない人が親しく言葉を交わし合って、事あるごとに自然と声や気配をも聞き見慣れていくのは、どうしてただ（普通の関係）とも思えようか（いや、思えない）。',
        translationEn: 'If someone who is not a sibling were to exchange intimate words, encountering each other on various occasions, and naturally grow accustomed to each other\'s voice and presence — how could one regard it as a mere ordinary relationship?',
        highlights: [
            { word: 'ただ', form: 'ただ' },
            { word: 'おのづから', form: 'おのづから' },
            { word: 'けはひ', form: 'けはひ' },
            { word: 'いかで', form: 'いかで' },
        ],
        source: '源氏物語 宿木',
        verified: true,
    },
    {
        // tada
        sentence: 'さまざまに人悪ろきことどもを、愁へあへるを聞きたまふも、かたはらいたければ、たちのきて、ただ今おはするやうにて、うちたたきたまふ。',
        translation: 'さまざまな世間体の悪いことを嘆き合っているのをお聞きになるのも気恥ずかしいので、その場を離れて、ちょうど今いらしたかのような様子で、戸を軽くたたかれる。',
        translationEn: 'Hearing them lament all manner of embarrassing things, he felt awkward, withdrew, then knocked as if he had only just that moment arrived.',
        highlights: [
            { word: 'ただ', form: 'ただ' },
        ],
        source: '源氏物語 末摘花',
        verified: true,
    },
    {
        // tamaharu
        sentence: '今一方の御けしきも、をさをさ落としたまはで、侍従君添ひて、そなたはもてかしづきたまへば、げにかうもあるべきことなりけりと見えたり。',
        translation: 'もう一方（花散里）のご様子も、ほとんどおろそかになさらず、侍従の君がそばに添って、あちらも丁重にお世話申し上げているので、なるほどこのようであるべきことだったと見えた。',
        translationEn: "The other lady's needs, too, were scarcely neglected; with Lady Jijū in attendance, she was well cared for — and indeed it seemed things were as they ought to be.",
        highlights: [
            { word: 'たまはる', form: 'たまは' },
            { word: 'をさをさ', form: 'をさをさ' },
        ],
        source: '源氏物語 乙女',
        verified: true,
    },
    {
        // tamaharu
        sentence: '木枯しの堪へがたきまで吹きとほしたるに、残る梢もなく散り敷きたる紅葉を、踏み分けける跡も見えぬを見渡して、とみにもえ出でたまはず。',
        translation: '木枯らしが耐えがたいほどに吹き通したところに、残る梢もなく散り敷いた紅葉を、踏み分けた跡も見えないのを見渡して、すぐには出ていらっしゃることができなかった。',
        translationEn: 'As the winter gale blew through almost unbearably, gazing out over fallen leaves scattered without a branch remaining, no footsteps visible through them, she could not bring herself to go out immediately.',
        highlights: [
            { word: 'たまはる', form: 'たまはず' },
        ],
        source: '源氏物語 宿木',
        verified: true,
    },
    {
        // akugaru
        sentence: 'いふかひなき御ことは、ただかきくらす心地しはべるは、さるものにて、名残なきさまにあくがれ果てさせたまはむほど、思ひたまふるこそ。',
        translation: 'どうにもならないお方については、ただ目の前が真っ暗になる心地がいたしますのは当然のことで、跡形もなく彷徨い去ってしまわれることを思いますと。',
        translationEn: 'As for the unspeakable loss itself, I am of course left in utter darkness; but what fills my mind is the feeling that he drift away without a trace.',
        highlights: [
            { word: 'あくがる', form: 'あくがれ' },
        ],
        source: '源氏物語 葵',
        verified: true,
    },
    {
        // akugaru
        sentence: 'いさよふ月に、ゆくりなくあくがれむことを、女は思ひやすらひ、とかくのたまふほど、にはかに雲隠れて、明け行く空いとをかし。',
        translation: 'ためらいがちな月の光の中で、思いがけなくさまよい出ることを、女は思い迷っているうちに、あれこれとおっしゃっている間に、急に月が雲に隠れて、夜が明けていく空はとても趣深い。',
        translationEn: 'As the hesitant moon shone and the woman wavered at the thought of slipping away so unexpectedly, while he spoke of this and that, the moon suddenly hid in clouds, and the sky as dawn broke was most beautiful.',
        highlights: [
            { word: 'あくがる', form: 'あくがれむこ' },
            { word: 'をかし', form: 'をかし' },
        ],
        source: '源氏物語 夕顔',
        verified: true,
    },
    {
        // akugaru
        sentence: '今めかしき御ありさまのほどにあくがれたまうて、夜深き御月愛でに、格子も上げられたれば、例のもののけの入り来たるなめり。',
        translation: '今風の（華やかな）ご様子に（魂が）うかれて、夜更けに月をお愛でになるために格子もお上げになったので、いつものもののけが入り込んで来たのらしい。',
        translationEn: "Her spirit drawn away in the fashionable excitement, and the shutters raised to admire the late-night moon, the familiar spirit must have come slipping in.",
        highlights: [
            { word: 'あくがる', form: 'あくがれたま' },
        ],
        source: '源氏物語 横笛',
        verified: true,
    },
    {
        // ikani
        sentence: 'されどこぼちわたせりし家どもはいかになりにけるにか、ことごとく元のやうにも作らず。',
        translation: 'しかし壊し移した家々はどうなってしまったのか、すべて元のように作られてはいなかった。',
        translationEn: 'Yet as for the houses that had been dismantled and moved — what had become of them? — not all were rebuilt as they had been before.',
        highlights: [
            { word: 'いかに', form: 'いかになり' },
        ],
        source: '方丈記',
        verified: true,
    },
    {
        // ikaga
        sentence: '内裏より、かかる仰せ言のあれば、さまざまに、あながちなる交じらひの好みと、世の聞き耳もいかがと思ひたまへてなむ、わづらひぬる。',
        translation: '内裏からこのようなお言葉があるので、さまざまに、無理な交際好みと、世間の評判もどうかと思われて、（承諾に）苦慮しています。',
        translationEn: 'With such a message having come from the Palace, I have been troubled, wondering how it will appear to the world — as a pursuit of forced intimacy, and what people will say.',
        highlights: [
            { word: 'いかが', form: 'いかが' },
        ],
        source: '源氏物語 竹河',
        verified: true,
    },
    {
        // ikaga
        sentence: 'まして、さりぬべきついでの御言の葉も、なつかしき御気色を見たてまつる人の、すこし物の心思ひ知るは、いかがはおろかに思ひきこえむ。',
        translation: 'ましてや、然るべき折のお言葉も、慕わしいお顔をお見申し上げる人が、少し物の道理をわきまえているならば、どうして（そのお方を）おろそかに思い申し上げることがあろうか（いや、ない）。',
        translationEn: 'All the more so, one who has seen that beloved countenance and heard those fitting words of his — if they have any understanding of things at all — how could they think lightly of him?',
        highlights: [
            { word: 'いかが', form: 'いかが' },
            { word: 'まして', form: 'まして' },
            { word: 'なつかし', form: 'なつかしき' },
        ],
        source: '源氏物語 夕顔',
        verified: true,
    },
    {
        // tafutoshi
        sentence: 'たふとき聖のいひおきけることを書きつけて、一言芳談とかや名づけたる草紙を見侍りしに、心にあひて覺えし事ども。',
        translation: '尊い聖人が言い残したことを書き付けて、「一言芳談」とかいう名の草紙を見ておりましたところ、心に合うと思われた事柄があった。',
        translationEn: 'Browsing a booklet called "Ichigen Hōdan," which records the sayings of revered holy men, I came across passages that struck me as true.',
        highlights: [
            { word: 'たふとし', form: 'たふとき' },
        ],
        source: '徒然草',
        verified: true,
    },
    {
        // tafutoshi
        sentence: 'それ人の友たるものは富めるをたふとみ、ねんごろなるを先とす。',
        translation: '人の友となるものは、富んでいる者を尊び、親切で誠意のある者を先とする（ものだ）。',
        translationEn: 'Of those who become a person\'s friend, one values the wealthy and puts the sincere and cordial first.',
        highlights: [
            { word: 'たふとし', form: 'たふとみ' },
            { word: 'ねんごろなり', form: 'ねんごろなる' },
        ],
        source: '方丈記',
        verified: true,
    },
    {
        // tafutoshi
        sentence: 'をのこども仰の事を承りて申さく、仰のことはいともたふとし。',
        translation: '（随行の）男たちは（かぐや姫の）おっしゃることを承って申すには、おっしゃることはまことに尊い。',
        translationEn: 'The men, having heard what she commanded, replied: "Your words are most august and we obey."',
        highlights: [
            { word: 'たふとし', form: 'たふとし' },
        ],
        source: '竹取物語',
        verified: true,
    },
    {
        // yukashi
        sentence: 'いづれ劣勝おはしまさねば、ゆかしきもの見せ給へらんに、おん志のほどは見ゆべし。',
        translation: '（五人の公子は）いずれ劣らずいらっしゃるので、見たいと思うものをお見せくださったならば、お志の程度はそれで分かるでしょう。',
        translationEn: 'Since none of the five princes is inferior to the others, if you each show the thing I long to see, the depth of your devotion will be clear.',
        highlights: [
            { word: 'ゆかし', form: 'ゆかしき' },
        ],
        source: '竹取物語',
        verified: true,
    },
    {
        // yukashi
        sentence: 'など思ひ乱れて、「なほ、のたまはずやあらむ」とおぼゆれど、御けしきのゆかしければ、大宮に、さるべきついで作り出だしてぞ、啓したまふ。',
        translation: '（出家するべきか否か）などと思い乱れて、「やはり（自分から）おっしゃらないのだろうか」と思われるけれど、（大宮の）ご様子を知りたく思われるので、大宮に然るべき機会を作り出して、（その事を）申し上げなさる。',
        translationEn: 'Lost in such confused thoughts, wondering "Can she really not speak of it herself?" yet longing to know Her Majesty\'s mind, he found a suitable occasion and broached the matter with the Grand Empress.',
        highlights: [
            { word: 'ゆかし', form: 'ゆかしけれ' },
            { word: 'おぼゆ', form: 'おぼゆれ' },
        ],
        source: '源氏物語 手習',
        verified: true,
    },
    {
        sentence: 'しるしの札は持ち給へるや',
        translation: 'ポイントカードはお持ちですか',
        translationEn: 'Do you have a loyalty card?',
        highlights: [
            { word: 'たまふ', form: '給へ' },
        ],
        source: '現代日常語',
        verified: true,
    },
    {
        sentence: 'なんぢがごとく、さとき小童は好かず',
        translation: '君のような勘のいいガキは嫌いだよ',
        translationEn: 'I hate perceptive brats like you.',
        source: '鋼の錬金術師',
        highlights: [
            { word: 'さとし', form: 'さとき' },
        ],
        verified: true,
    },
    {
        sentence: '世に仕へむことは負くるに似たりと思ひ侍る。今の身こそ勝ちたるやうに覚ゆれ',
        translation: '働いたら負けかなと思っている。今の自分は勝ってると思います',
        translationEn: "I used to think that working meant losing. But I think I'm winning right now.",
        source: 'ネットミーム',
        highlights: [
            { word: 'はべり', form: '侍る' },
            { word: 'おぼゆ', form: '覚ゆ' },
        ],
        verified: true,
    },
    {
        // tamtama
        sentence: 'そのゆゑは、我が身をば次になして、男にもあれ女にもあれ、いたはしく思ふかたに、たまたま乞ひ得たる物を、まづゆづるによりてなり。',
        translation: 'その理由は、自分自身を後回しにして、男であれ女であれ、いたわしいと思う相手に、たまたま手に入れた物を、まず譲るからである。',
        translationEn: "The reason is that one puts oneself last and, whether it be a man or a woman one feels compassion for, gives away whatever one happens to obtain to them first.",
        highlights: [
            { word: 'たまたま', form: 'たまたま' },
        ],
        source: '方丈記',
        verified: true,
    },
    {
        // tamtama
        sentence: 'たまたまこの道にまかり入りにければ、かうだにわきまへ知られはべるといふ。',
        translation: 'たまたまこの（建築の）道に入ったので、これくらいは分かるようになりましたと言う。',
        translationEn: '"Having happened to enter this path," he says, "I have come to understand at least this much."',
        highlights: [
            { word: 'たまたま', form: 'たまたまこの' },
            { word: 'まかる', form: 'まかり' },
        ],
        source: '枕草子 第五段',
        verified: true,
    },
    {
        // akarasama
        sentence: '大将の君は、二条院にだに、あからさまにも渡りたまはず、あはれに心深う思ひ嘆きて、行ひをまめにしたまひつつ、明かし暮らしたまふ。',
        translation: '大将の君（光源氏）は、二条院にさえ、ちょっとの間もお行きにならず、しみじみと深く思い嘆いて、勤行をまじめになさりながら、日々を過ごしていらっしゃる。',
        translationEn: 'The Commander does not go even briefly to the Nijō residence; deeply moved and sorrowful, he spends his days devoting himself earnestly to religious practice.',
        highlights: [
            { word: 'あからさまなり', form: 'あからさまに' },
            { word: 'あはれ', form: 'あはれに' },
            { word: 'まめなり', form: 'まめに' },
        ],
        source: '源氏物語 葵',
        verified: true,
    },
    {
        // akarasama
        sentence: 'あからさまに聖教の一句を見れば、何となく前後のふみも見ゆ。',
        translation: 'ちょっとの間でも仏典の一句を見れば、なんとなく前後の文章も目に入ってくる。',
        translationEn: 'Even a brief glance at a single passage of scripture brings the surrounding text into view as well, somehow.',
        highlights: [
            { word: 'あからさまなり', form: 'あからさまに' },
        ],
        source: '徒然草',
        verified: true,
    },
    {
        // kashikoshi
        sentence: '昔かしこき天竺のひじり、この國にもて渡りて侍りける、西の山寺にありと聞き及びて、公に申して、辛うじて買ひとりて奉る。',
        translation: '昔、優れた天竺（インド）の聖人が、この国に持って渡ってきたものが、西の山寺にあると聞き及んで、朝廷に申し上げて、ようやくのことで買い取って献上するものです。',
        translationEn: 'Hearing that an object once brought to this land long ago by a venerable sage of India was kept at a temple in the western mountains, he reported it to the court and, with great difficulty, purchased and presented it.',
        highlights: [
            { word: 'かしこし', form: 'かしこき' },
        ],
        source: '竹取物語',
        verified: true,
    },
    {
        // tayu
        sentence: 'たゆからずしもあらねど、人をしたがへ、人をかへりみるよりはやすし。',
        translation: '疲れないわけではないが、人に従がったり、人の機嫌をとるよりは楽だ。',
        translationEn: 'It is not that one feels no fatigue, but it is easier than obeying others or trying to please them..',
        highlights: [
            { word: 'たゆ', form: 'たゆ' },
            { word: 'かへる', form: 'かへりみる' },
        ],
        source: '方丈記',
        verified: true,
    },
    {
        // kotowari
        sentence: 'しづかなる曉、このことわりを思ひつゞけて、みづから心に問ひていはく、世をのがれて山林にまじはるは、心ををさめて道を行はむがためなり。',
        translation: '静かな明け方に、この道理を思い続けて、自分の心に問いかけて言うことには、世を逃れて山林に交わるのは、心を治めて仏道修行をするためである。',
        translationEn: 'On a quiet dawn, pondering this reasoning, I asked myself: the purpose of fleeing the world to dwell among the mountains and forests is to discipline the heart and pursue the Buddhist path.',
        highlights: [
            { word: 'ことわりなり', form: 'ことわり' },
        ],
        source: '方丈記',
        verified: true,
    },
    {
        // kotowari
        sentence: '恨みむもことわりなるほどなれど、あまりに人憎くもと、つらき涙の落つれば、「ましていかに思ひつらむ」と、さまざまあはれに思し知らる。',
        translation: '（あなたを）恨むのも当然な事情ではあるが、あまりにも憎いとも思えず、つらい涙が落ちるので、「まして（あの方は）どれほど辛く思っただろう」と、さまざまにしみじみと思い知らされる。',
        translationEn: 'It would be only natural to feel resentment, yet, I can\'t bring myself to hate you that much, painful tears fall; and he is made to feel keenly, in many ways, "how much more painfully she must have felt this."',
        highlights: [
            { word: 'ことわりなり', form: 'ことわりなる' },
            { word: 'つらし', form: 'つらき' },
            { word: 'まして', form: 'ましてい' },
            { word: 'いかに', form: 'いかに' },
            { word: 'あはれ', form: 'あはれに' },
        ],
        source: '源氏物語 総角',
        verified: true,
    },
    {
        // sugu
        sentence: 'かならずしも情あると、すぐなるとをば愛せず、たゞ絲竹花月を友とせむにはしかじ。',
        translation: '必ずしも人情がある人や素直な人を愛することもせず、ただ音楽や花鳥風月を友とするのが一番である。',
        translationEn: 'It is not necessarily about loving people who are kind or honest; nothing is better than taking music and the beauty of nature.',
        highlights: [
            { word: 'すぐ', form: 'すぐなる' },
        ],
        source: '方丈記',
        verified: true,
    },
    {
        // kurushi
        sentence: 'ことにたのもしき人なともなきなめりかしと心くるしうおほえて。',
        translation: '特に頼りになる人もいないようだと、心苦しく思われて。',
        translationEn: 'Feeling that there seemed to be no one in particular she could rely on, she found it distressing.',
        highlights: [
            { word: 'くるし', form: 'くるしう' },
            { word: 'たのもし', form: 'たのもしき' },
        ],
        source: '和泉式部日記',
        verified: true,
    },
    {
        // kurushi
        sentence: '心また身のくるしみを知れゝば、くるしむ時はやすめつ、まめなる時はつかふ。',
        translation: '（自分の）心もまた身体の苦しみを知っているので、苦しむ時は休ませ、元気な時は働かせる。',
        translationEn: 'The mind, too, knows the body\'s own suffering, so when it suffers I let it rest, and when it is well I put it to work.',
        highlights: [
            { word: 'くるし', form: 'くるしみ' },
            { word: 'まめなり', form: 'まめなる' },
        ],
        source: '方丈記',
        verified: true,
    },
    {
        // yomu
        sentence: 'かた野をかりてあまの河にいたるを題にてうたよみて。',
        translation: '交野で狩りをして天の川（という地名）に至ったことを題にして歌を詠んで。',
        translationEn: 'Taking as their topic the fact that, while hunting at Katano, they had arrived at a place called the River of Heaven, they composed poems.',
        highlights: [
            { word: 'よむ', form: 'よみ' },
        ],
        source: '伊勢物語',
        verified: true,
    },
    {
        // yomu
        sentence: 'うへも聞しめして、めでさせ給ひ、「いかでさ多くよませ給ひけん、われは三卷四卷だにもえよみはてじ」と仰せらる。',
        translation: '帝もお聞きになって感心なさり、「どうしてそんなに多くお読みになれたのだろう、私など三巻四巻でさえ読み終えられないだろう」とおっしゃる。',
        translationEn: 'His Majesty heard of this too and was full of admiration, saying, "However did she manage to read so much? I myself could never finish even three or four volumes."',
        highlights: [
            { word: 'よむ', form: 'よみ' },
            { word: 'いかで', form: 'いかでさ' },
        ],
        source: '枕草子 第二十段',
        verified: true,
    },
    {
        // motomu
        sentence: '内を愼まず、輕くほしきまゝにしてみだりなれば、遠國必ずそむく時、始めてはかりごとをもとむ。',
        translation: '内政を整えず、軽々しく欲望のままにの政治をして乱れていると、遠くの国は必ず背く。その時に慌てて対策を求める。',
        translationEn: 'If one fails to govern with care at home and behaves recklessly and self-indulgently, bringing disorder, then only when the distant provinces inevitably revolt does one finally seek a countermeasure.',
        highlights: [
            { word: 'もとむ', form: 'もとむ' },
        ],
        source: '徒然草',
        verified: true,
    },
    {
        // motomu
        sentence: 'こなたにて御くだもの参りなどしたまへど、やうやう見めぐらして、母君の見えぬをもとめて、らうたげにうちひそみたまへば、乳母召し出でて、慰め紛らはしきこえたまふ。',
        translation: 'こちらで果物などを召し上がりなさるが、だんだん辺りを見回して、母君の姿が見えないのを探し求めて、いじらしげに泣き顔をなさるので、乳母を呼び出して、お慰め申し上げなさる。',
        translationEn: 'While she is given fruit and the like to eat here, she gradually looks about and, finding her mother nowhere to be seen, searches for her and screws up her face pitifully as if to cry; so they summon the wet nurse to comfort and distract her.',
        highlights: [
            { word: 'もとむ', form: 'もとめ' },
            { word: 'やうやう', form: 'やうやう' },
            { word: 'らうたし', form: 'らうたげ' },
        ],
        source: '源氏物語 薄雲',
        verified: true,
    },
    {
        // makaru
        sentence: '竹取心惑ひて泣き伏せる所に寄りて、かぐや姫いふ、こゝにも心にもあらでかくまかるに、昇らんをだに見送り給へ。',
        translation: '竹取の翁が心が乱れて泣き伏している所に近寄って、かぐや姫が言うことには、「私もこの場所から不本意ながらこのように去っていくのですから、せめて昇っていくのだけでもお見送りください」。',
        translationEn: 'Going to where the bamboo cutter lay weeping in distraction, Princess Kaguya says, "Since even I must leave this place against my will in this way, please at least see me off as I ascend."',
        highlights: [
            { word: 'まかる', form: 'まかる' },
        ],
        source: '竹取物語',
        verified: true,
    },
    {
        sentence: 'いとうつくしき筆なり。',
        translation: 'これはとても美しいペンです。',
        translationEn: 'This is a very beautiful pen.',
        highlights: [
            { word: 'いと', form: 'いと' },
            { word: 'うつくし', form: 'うつくしき' },
        ],
        source: '英語の教科書',
        verified: true,
    }
];
