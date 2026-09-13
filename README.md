# ポジション管理で作る無限スライダー ハンズオン

今回は「配列を並べ替えない」「position（-1, 0, 1）だけで無限ループを表現する」スライダーを、
少しずつ手を動かしながら作っていきます。

要所要所で「ちょっと深掘り」を挟みます。今は仕組みが気にならなければ読み飛ばして、後で戻ってきてもOKです。

## どのような場面で応用できるか

このコードがやっていることを一言でいうと、**Reactのような仮想DOMを使わずに、「必要な部分だけを再利用・再描画する」を手書きで実現している**ということです。

Reactなどの仮想DOMを使ったフレームワークでは、「状態（state）が変わったら、変更があった部分だけを差分検出（diff）して、DOMを最小限だけ書き換える」という仕事をライブラリが肩代わりしてくれます。今回のコードは、それをフレームワークなしで、**手作業で同じ効果を作っている**と捉えると分かりやすいです。

- **DOMを毎回作り直さない** → `tracks` 配列は最初に作った3つの `<ul>` を最後まで使い回す。仮想DOMでいう「keyが同じ要素は再利用する」動きと同じです。
- **本当に変わった部分だけ再描画する** → `updatePosition()` が `true` を返した（＝反対端に回った）Trackだけ `renderTrack()` する。仮想DOMの「差分だけDOM更新する」を、`position` という1つの値の変化だけを見て自前で判定しています。
- **見た目の更新とデータの確定を分離する** → `commit()` で「アニメーションが終わってから状態を書き換える」のは、Reactの「レンダー結果が確定してからDOMにコミットする」という考え方に近いものです。

このテクニックが向いているのは、「Reactなどを持ち込むほどではないけれど、**DOM要素をむやみに作り直したくない・アニメーションを自分で細かく制御したい**」という場面です。カルーセルやタブ切り替え、ステップフォームのように、**表示候補は多いが画面上に必要な要素数は一定**なUIに応用できます。

## 目次

| Step | 内容 |
|---|---|
| Step 1 | 土台のHTML/CSSを作る |
| Step 2 | 画像データとDOM取得 |
| Step 3 | インデックスを循環させる |
| Step 4 | SLIDE で表示範囲を管理する |
| Step 5 | Trackクラスで位置を管理する |
| Step 6 | 初期描画 |
| Step 7 | アニメーションを作る |
| Step 8 | positionの循環処理 |
| Step 9 | move() で全部をつなげる |
| Step 10 | ロックとコントローラー |
| Step 11 | リサイズ対応 |

### ちょっと深掘り 一覧

| # | タイトル | 登場する場所 |
|---|---|---|
| 1 | normalizeIndex() で配列を循環させる仕組み | Step 3 |
| 2 | currentIndex と position の違い | Step 4 |
| 3 | Web Animations API の基礎（finishedプロミスとfill: "forwards"） | Step 7 |
| 4 | commit() とクロージャ | Step 7 |
| 5 | アニメーション中に position を更新しない理由 | Step 7 |
| 6 | -Math.sign(position) で反対側に回せる理由 | Step 8 |
| 7 | なぜ再利用されたTrackだけ再描画するのか | Step 9 |

---

## Step 1. 土台のHTML/CSSを作る

### 実装する

```html
<div class="slider">
  <ul class="track"></ul>
  <ul class="track"></ul>
  <ul class="track"></ul>
</div>

<div class="controller">
  <button id="prev">prev</button>
  <button id="next">next</button>
</div>
```

```css
.slider {
  position: relative;
  width: min(500px, 100%);
  aspect-ratio: 5 / 1;
  margin: 50px auto;
  overflow: hidden;
  border: 1px solid #aaa;
}

.track {
  position: absolute;
  inset: 0;
  display: flex;
  width: 100%;
  height: 100%;
  will-change: transform;
}

.track li {
  flex: 0 0 calc(100% / var(--view-count));
  height: 100%;
  padding: 5px;
  list-style: none;
  border: 1px solid #000;
}

.track img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

ポイントは `.track` を **3つ重ねて配置する** ことです。`position: absolute; inset: 0;` で3つの `<ul>` が完全に重なります。この3枚を横にずらして並べることで、「今見えている枚」「その前」「その後」を同時に用意しておきます。

### 動かす

この時点では `<ul>` の中身が空なので、枠線だけの箱が表示されるはずです。まだ画像は出ません。

### 次へ進む

次は表示する画像のデータと、DOM要素の取得をやります。

---

## Step 2. 画像データとDOM取得

### 実装する

```js
const imagePool = [
  "onepiece01_luffy2.png",
  "onepiece02_zoro_bandana.png",
  "onepiece03_nami.png",
  // ...省略
  "onepiece17_doflamingo.png"
];

const slider = document.querySelector(".slider");
const trackElements = document.querySelectorAll(".track");
const prevButton = document.getElementById("prev");
const nextButton = document.getElementById("next");
```

`imagePool` が全画像を持つ「元データ」です。この配列自体は**最後まで並べ替えません**。表示するときに「どこから何枚切り出すか」で見た目を変えていきます。

### 動かす

まだ描画処理がないので画面は変わりません。コンソールで `imagePool.length` などを確認しておくと後の計算がイメージしやすくなります。

### 次へ進む

配列から「循環して」画像を取り出すための、一番小さな部品（`normalizeIndex`）を作ります。

---

## Step 3. インデックスを循環させる

### 実装する

```js
function normalizeIndex(index) {
  return ((index % imagePool.length) + imagePool.length) % imagePool.length;
}
```

### 動かす

コンソールで試してみましょう。

```js
normalizeIndex(-1);              // → imagePool.length - 1（配列の最後）
normalizeIndex(imagePool.length); // → 0（配列の最初）
```

負の数を渡しても、配列をはみ出す数を渡しても、必ず `0 〜 length-1` の範囲に収まります。

> 💡 **ちょっと深掘り：normalizeIndex() で配列を循環させる仕組み**
>
> JavaScriptの `%` は「負の数を渡すと負の値を返す」という、直感に反する挙動をします。
>
> ```js
> -1 % 16; // → -1 （0〜15ではなく -1 になる）
> ```
>
> これだと配列の添字としてそのまま使えません。そこで、
>
> ```js
> ((index % length) + length) % length
> ```
>
> という2段構えにします。
>
> 1. `index % length` … まず範囲を `-length+1 〜 length-1` に縮める
> 2. `+ length` … 全体を正の方向にずらして、負の値を消す
> 3. `% length` … ずらしすぎた分（例えば `length` ちょうど）をもう一度丸める
>
> この形は「循環インデックス」を扱うときの定番パターンなので、覚えておくと他の場面でも使えます。
>
> ここで大事なのは、**この関数は「今どこを見ているか」という状態を一切持たない**ということです。渡された数値を丸めて返すだけの純粋な計算です。状態を持つ部分（どこから何枚見せるか）は、次のステップで作る `SLIDE` に任せます。

### 次へ進む

`normalizeIndex` を使って、実際に「今何枚目から表示するか」を管理する仕組み（`SLIDE`）を作ります。

---

## Step 4. SLIDE で表示範囲を管理する

### 実装する

```js
const SLIDE = (() => {
  const VIEW_COUNT = 5;
  let currentStep = 0;

  const NEXT = {
    positionStep: -1,
    updateCurrentStep() { currentStep++; }
  };

  const PREV = {
    positionStep: 1,
    updateCurrentStep() { currentStep--; }
  };

  function cycleIndex(step) {
    return normalizeIndex(step * VIEW_COUNT);
  }

  function getSlicedImgPool(position) {
    const start = cycleIndex(currentStep + position);
    return Array.from({ length: VIEW_COUNT }, (_, i) => {
      const index = normalizeIndex(start + i);
      return imagePool[index];
    });
  }

  function setup(slider) {
    slider.style.setProperty("--view-count", VIEW_COUNT);
  }

  return { NEXT, PREV, cycleIndex, getSlicedImgPool, setup };
})();
```

`SLIDE` がこのスライダー全体の「現在地」を管理する唯一の場所です。`VIEW_COUNT`（一度に何枚見せるか）と `currentStep`（何ステップ進んだか）は、この即時関数の中に閉じ込めて外から直接触れないようにしています。

### 動かす

```js
SLIDE.getSlicedImgPool(0);  // 現在表示すべき5枚
SLIDE.getSlicedImgPool(1);  // 1つ右（次）にあたる5枚
SLIDE.getSlicedImgPool(-1); // 1つ左（前）にあたる5枚
```

コンソールでこれを試すと、`position` に応じて配列の中身が変わることが確認できます。

> 💡 **ちょっと深掘り：currentIndex と position の違い**
>
> 「今どこを表示しているか」を管理する方法は、実は2種類あります。
>
> **方式A：currentIndexで管理する（よくあるやり方）**
> 画像配列の中の「今何番目を表示しているか」という添字を1つだけ持つ方式です。次へ進むたびに `currentIndex++` して、表示する `<li>` の中身を毎回全部作り直します。実装はシンプルですが、DOM要素そのものを都度使い捨てにするので、アニメーションを丁寧に作ろうとすると途端に難しくなります（「今動いている要素」と「次に表示する要素」が同じDOMなので、動いている最中に中身を変えられない）。
>
> **方式B：position（このコードの方式）**
> 一方このコードでは、**3枚のDOM（`<ul class="track">`）を最初から用意しておいて**、それぞれに `-1 / 0 / 1` という「相対的な位置」だけを持たせます。「今どの画像を表示しているか」という情報そのものは `SLIDE.currentStep` に集約し、各Trackは「自分は真ん中から見て何番目にいるか」しか知りません。
>
> この分離のおかげで、
>
> - **アニメーションは「位置」だけを動かせばいい**（`position × width` の分だけ `translateX` する）
> - **どの画像を表示するかは「位置」から逆算すればいい**（`SLIDE.getSlicedImgPool(position)`）
>
> という風に、「見た目の動き」と「データの中身」を完全に切り離して考えられます。次のStepで作るTrackクラスが、まさにこの「position」だけを持つ存在になります。

### 次へ進む

`SLIDE` の `position` を実際に受け取って、DOM要素を動かす `Track` クラスを作ります。

---

## Step 5. Trackクラスで位置を管理する

### 実装する

```js
class Track {
  constructor(el, position) {
    this.el = el;
    this.position = position; // -1 = prev, 0 = current, 1 = next
  }

  setPosition(width) {
    this.el.style.transform = `translateX(${this.position * width}px)`;
  }
}

const tracks = [
  new Track(trackElements[0], -1),
  new Track(trackElements[1], 0),
  new Track(trackElements[2], 1)
];
```

`tracks` 配列は**最後まで並べ替えません**。`tracks[0]` は常に同じDOM要素を指し続けます。変わるのは各Trackが持つ `position` の値だけです。

### 動かす

```js
function setTrackPositions() {
  const width = slider.clientWidth;
  tracks.forEach(track => track.setPosition(width));
}

setTrackPositions();
```

これを呼ぶと、3つの `<ul>` が横に「前・現在・次」の順で並びます（中身はまだ空なので枠だけ動いて見えます）。

### 次へ進む

各Trackの中身（画像）を実際に描画する処理を作ります。

---

## Step 6. 初期描画

### 実装する

```js
function renderTrack(track) {
  const slicedImgs = SLIDE.getSlicedImgPool(track.position);

  track.el.innerHTML = slicedImgs
    .map(img => `<li><img src="./img/${img}" alt=""></li>`)
    .join("");
}

SLIDE.setup(slider);

tracks.forEach(track => renderTrack(track));
setTrackPositions();
```

`renderTrack` がやっているのは「このTrackの `position` を `SLIDE` に渡して、表示すべき画像を教えてもらい、その通りに描画する」だけです。`renderTrack` 自身は `currentStep` も `VIEW_COUNT` も知りません。

### 動かす

ここまでで、画面には5枚ずつの画像が3セット横並びで表示され、`overflow: hidden` によって真ん中の1セットだけが見えている状態になります。ブラウザの開発者ツールで `.slider` の `overflow` を一時的に `visible` にしてみると、両隣にも画像が準備されているのが見えて面白いです。

### 次へ進む

いよいよ「次へ」「前へ」ボタンでスライドを動かすアニメーション部分に入ります。

---

## Step 7. アニメーションを作る

### 実装する

```js
const ANIMATION_DURATION = 300;
const ANIMATION_EASING = "ease";
```

`Track` クラスに `animate` メソッドを追加します。

```js
animate(slide, width) {
  const from = this.position;
  const to = this.position + slide.positionStep;

  const animation = this.el.animate(
    [
      { transform: `translateX(${from * width}px)` },
      { transform: `translateX(${to * width}px)` }
    ],
    { duration: ANIMATION_DURATION, easing: ANIMATION_EASING, fill: "forwards" }
  );

  animation.commit = () => {
    const positionUpdated = this.updatePosition(to);
    return positionUpdated ? this : null;
  };

  return animation;
}
```

（`updatePosition` は次のStepで作ります。ここでは仮にそのまま `this.position = to` する版で動かしてもOKです。）

### 動かす

`slide` に `SLIDE.NEXT` を渡して `animate` を呼ぶと、Web Animations APIの `element.animate()` によって、CSSの `transform` がなめらかに `from` から `to` へアニメーションします。`fill: "forwards"` により、アニメーション終了後も見た目は `to` の位置に留まります。

> 💡 **ちょっと深掘り：Web Animations API の基礎（finishedプロミスとfill: "forwards"）**
>
> `element.animate()` は、CSSアニメーションやCSSトランジションをJavaScriptから直接組み立てられるAPIです。このコードでは3箇所、この仕組みの上に成り立っています。
>
> **① `element.animate()` は `Animation` オブジェクトを返す**
>
> ```js
> const animation = this.el.animate(
>   [
>     { transform: `translateX(${from * width}px)` }, // 開始状態（キーフレーム）
>     { transform: `translateX(${to * width}px)` }    // 終了状態（キーフレーム）
>   ],
>   { duration: 300, easing: "ease", fill: "forwards" } // オプション
> );
> ```
>
> 第1引数はキーフレームの配列（「最初はこう、最後はこう」という状態のリスト）、第2引数はアニメーションの設定です。呼び出した瞬間にアニメーションは**再生が始まり**、戻り値の `animation` を使って、後から一時停止したり、途中で止めたり、終了を待ったりできます。
>
> **② `animation.finished` は「再生完了で解決するPromise」**
>
> ```js
> await Promise.all(
>   animations.map(animation => animation.finished)
> );
> ```
>
> `animation.finished` はプロパティですが、中身はPromiseです。アニメーションが最後まで再生されると、このPromiseが解決（resolve）します。逆に、途中で `animation.cancel()` が呼ばれるなどして中断されると、このPromiseは**拒否（reject）**されます。
>
> このコードで `try/catch` を使っているのは、まさにここが理由です。3つのアニメーションのうち1つでも中断されれば `Promise.all` 全体がrejectされ、`catch` ブロックに処理が移って `setTrackPositions()` による巻き戻しが行われます。「アニメーションの完了」を待つ処理として、Promiseの仕組みにそのまま乗っている設計です。
>
> **③ `fill: "forwards"` は「終了後も最後のキーフレームの見た目を保持する」設定**
>
> Web Animations APIのアニメーションは、デフォルトでは**再生が終わると同時に見た目が「アニメーションを適用する前」の状態に戻ります**。CSSの `transform` プロパティ自体は書き換わっていないので、見た目上は元の位置にリセットされてしまうのです（`display: none` になった要素がまた見えるようになる、と考えるとイメージしやすいかもしれません）。
>
> `fill: "forwards"` を指定すると、この「終了後に元へ戻る」挙動を止め、**最後のキーフレームの見た目のまま止まってくれます**。このコードでは、
>
> - `animate()` の間は `fill: "forwards"` によって `to * width` の位置に見た目を保持
> - アニメーション終了後、`setTrackPositions()` で改めて `this.el.style.transform` に確定した位置をCSSとして直接書き込む
> - 役目を終えたアニメーションは `animation.cancel()` で明示的に破棄する
>
> という3段階の受け渡しが行われています。`fill: "forwards"` がないと、アニメーションが終わった瞬間に一瞬「元の位置に戻る→`setTrackPositions()`で正しい位置に上書きされる」というチラつきが起きる可能性があるため、地味ですが見た目の滑らかさを支える重要な設定です。

### 次へ進む

`animation.commit` という見慣れない仕組みが出てきました。ここで少し深掘りします。

> 💡 **ちょっと深掘り：commit() とクロージャ**
>
> `animation.commit = () => { ... }` は、標準の `Animation` オブジェクトには存在しないプロパティです。ここでは「後で実行したい処理」を、アニメーションオブジェクトにくっつけて持ち運ぶために自作しています。
>
> 注目してほしいのは、この矢印関数が **`to` という、`animate` メソッドのローカル変数を参照している** ことです。
>
> ```js
> animate(slide, width) {
>   const to = this.position + slide.positionStep; // ローカル変数
>
>   const animation = this.el.animate(/* ... */);
>
>   animation.commit = () => {
>     this.updatePosition(to); // ← ここで to を使っている
>   };
>
>   return animation;
> }
> ```
>
> `animate` メソッドの実行が終わっても、`to` という変数は消えません。`commit` という関数が `to` を参照し続けている限り、JavaScriptのガベージコレクションは `to` を回収せず、メモリ上に残しておきます。これが**クロージャ**です。
>
> なぜこんな回りくどいことをするかというと、「`to` の値をどこかにまとめて保存しておいて、後で `commit` を呼ぶときに引数として渡す」よりも、「`animate` を呼んだその場で `to` を計算し、その計算結果を持った関数を返す」ほうが、**どのTrackの `to` がどの値だったかを取り違える心配がない**からです。3つのTrackを同時に動かすこのコードでは、この「値を関数に閉じ込めて渡す」やり方がバグを防ぐ効果を持ちます。

> 💡 **ちょっと深掘り：アニメーション中に position を更新しない理由**
>
> `animate` メソッドの中では、`this.position` を直接書き換えていません。アニメーションの見た目は `to * width` を使って動かしていますが、`this.position` はまだ古い値（`from` の値）のままです。position の更新は、`commit()` が呼ばれるまで**保留**されています。
>
> なぜ保留するのでしょうか。理由は、**アニメーションが完了する保証がない**からです。
>
> 例えば、アニメーション中にウィンドウがリサイズされたり、何らかのエラーで処理が中断されたりすると、`move()` 関数は `catch` ブロックに入り、`animation.cancel()` を呼んで元の位置に戻そうとします（Step 9で詳しく作ります）。このとき、もし `this.position` をアニメーション開始と同時に書き換えてしまっていたら、「見た目は元の位置に巻き戻ったのに、データ上の `position` は新しい値のまま」という**見た目とデータの不一致**が起きてしまいます。
>
> `commit()` を「アニメーションが正常に終わったことが確認できてから」明示的に呼ぶ設計にすることで、
>
> - 正常終了 → `commit()` を呼んで `position` を確定させる
> - 異常終了 → `commit()` を呼ばずに済ませ、`position` は元のまま
>
> という分岐が自然に書けます。これは「実際にやったことをそのまま記録する」のではなく、「やろうとしたことが確かに成功してから記録する」という、状態管理の基本的な考え方です。

---

## Step 8. positionの循環処理

### 実装する

`Track` クラスに `updatePosition` を追加します。

```js
updatePosition(position) {
  this.position = position;

  if (Math.abs(this.position) <= 1) {
    return false;
  }

  this.position = -Math.sign(this.position);

  return true;
}
```

### 動かす

コンソールで手動テストしてみます。

```js
const t = new Track(null, 1);
t.updatePosition(2);  // → true、t.position は -1 になる
t.updatePosition(0);  // → false、t.position は 0 のまま
```

`position` が `-1, 0, 1` の範囲を超えたときだけ、反対側の端に巻き戻り、戻り値が `true` になります。

> 💡 **ちょっと深掘り：-Math.sign(position) で反対側に回せる理由**
>
> 3枚のTrackは常に `-1, 0, 1` のいずれかの位置にいる必要があります。「次へ」を押し続けると、あるTrackの `position` は `1 → 2` のように範囲外へ出てしまいます。このとき、`2` を `-1` に、`-2` を `1` に変換したいわけです。
>
> `Math.sign(x)` は `x` の符号（`1` か `-1` か `0`）だけを返す関数です。
>
> ```js
> Math.sign(2);  // → 1
> Math.sign(-2); // → -1
> ```
>
> ここに `-` を1つ付けるだけで、符号が反転します。
>
> ```js
> -Math.sign(2);  // → -1
> -Math.sign(-2); // → 1
> ```
>
> つまり「符号だけを取り出して、反転する」という2ステップで、**元の数値の大きさ（2でも3でも）に関係なく**、必ず `1` か `-1` に丸め込めます。`position` は理屈の上では `2` を超えることはない設計（1ステップにつき1しか動かないため）なので、「符号を反転する」だけで正しく反対側の端に対応させられる、というわけです。
>
> 図にすると：
>
> ```
> NEXTを押し続けた場合
> -1 → -2 → 1    （-2 は符号反転で 1 になる）
>
> PREVを押し続けた場合
>  1 →  2 → -1   （2 は符号反転で -1 になる）
> ```

### 次へ進む

「反対側に回った」Trackだけ、`renderTrack` で中身を作り直す必要があります。この判定にどう使うかを、実際の `move()` 関数の中で見ていきます。

---

## Step 9. move() で全部をつなげる

### 実装する

```js
async function move(slide) {
  if (isMoving) return;

  lock();

  let animations = [];

  try {
    const width = slider.clientWidth;

    animations = tracks.map(track => track.animate(slide, width));

    await Promise.all(animations.map(animation => animation.finished));

    slide.updateCurrentStep();

    animations.forEach(animation => {
      const updatedTrack = animation.commit();
      if (updatedTrack) {
        renderTrack(updatedTrack);
      }
    });

    setTrackPositions();

    animations.forEach(animation => animation.cancel());

  } catch (error) {
    setTrackPositions();
    animations.forEach(animation => animation.cancel());
  } finally {
    unlock();
  }
}
```

### 動かす

`prev` / `next` ボタンにこの `move` を紐付ければ、実際にスライダーが動きます（ボタンの配線はStep 10でやります）。

流れを整理すると：

1. 3つのTrackを同時にアニメーションさせる
2. 全部終わるのを待つ（`Promise.all`）
3. `SLIDE.currentStep` を更新する
4. 各Trackの `commit()` を呼び、`position` を確定させる
5. `commit()` が `true`（＝端まで回った）を返したTrackだけ `renderTrack` で中身を作り直す
6. 全Trackを新しい `position` に正式配置する

> 💡 **ちょっと深掘り：なぜ再利用されたTrackだけ再描画するのか**
>
> Step 8で見た `updatePosition` は、`position` が範囲を超えたときだけ `true` を返しました。この `true / false` を、`move()` は**再描画するかどうかの判定**にそのまま使っています。
>
> ```js
> const updatedTrack = animation.commit();
> if (updatedTrack) {
>   renderTrack(updatedTrack);
> }
> ```
>
> なぜ「毎回全部のTrackを再描画」しないのでしょうか。
>
> 3枚のTrackのうち、次へ進んだときに動くのは全部ですが、**役割が入れ替わる（＝反対の端に回る）のはそのうち1枚だけ**です。例えば「次へ」を押すと：
>
> - `position: -1` だったTrackは `0` になる（前 → 現在）→ 中身はすでに正しい（元々「現在の1つ前」を表示していたが、それはそのまま「新しい現在」の中身と一致する）
> - `position: 0` だったTrackは `1` になる（現在 → 次）→ 同様に中身はすでに正しい
> - `position: 1` だったTrackは `2` になり、範囲外なので `-1` に巻き戻る（次 → 前）→ **このTrackだけ、表示すべき画像がまるっきり変わる**
>
> つまり、3枚のうち2枚は「たまたま」正しい中身のまま位置だけスライドすればよく、巻き戻った1枚だけが中身の更新を必要とします。これを判定なしで「常に3枚とも再描画」してしまうと、無駄なDOM更新が増えるだけでなく、アニメーション中の要素の中身を不用意に書き換えてしまうリスクも生まれます。`updatePosition` の戻り値をそのまま再描画の合図に使うことで、**「本当に描き直す必要がある1枚」だけを正確に狙い撃ち**できるわけです。

### 次へ進む

最後に、ロック処理とボタン・リサイズの配線をして完成させます。

---

## Step 10. ロックとコントローラー

### 実装する

```js
let isMoving = false;

function lock() {
  isMoving = true;
  prevButton.disabled = true;
  nextButton.disabled = true;
}

function unlock() {
  isMoving = false;
  prevButton.disabled = false;
  nextButton.disabled = false;
}

nextButton.addEventListener("click", () => move(SLIDE.NEXT));
prevButton.addEventListener("click", () => move(SLIDE.PREV));
```

`isMoving` は「今アニメーション中かどうか」だけを表すシンプルなフラグです。`move()` の冒頭で `if (isMoving) return;` としているので、アニメーション中に連打してもTrackの状態が壊れません。

### 動かす

ここまでで prev / next ボタンを押すとスライドが動き、連打してもボタンが `disabled` になって安全に無視されることを確認できます。

### 次へ進む

最後にウィンドウリサイズへの対応です。

---

## Step 11. リサイズ対応

### 実装する

```js
window.addEventListener("resize", () => {
  if (isMoving) return;
  setTrackPositions();
});
```

`isMoving` 中はリサイズによる位置の再計算をスキップします。アニメーションが動いている最中に `transform` を上書きしてしまうと、見た目が一瞬崩れてしまうためです。

### 動かす

ウィンドウ幅を変えると、3枚のTrackが新しい `slider.clientWidth` に合わせて配置し直され、レイアウト崩れが起きないことを確認できます。

---

## 完成

これで、`imagePool` を並べ替えず、3枚のDOMの `position` だけを使って無限スライダーが動く実装が完成しました。全体を通して出てきた考え方を振り返ると：

- **データの「今どこか」（`SLIDE.currentStep`）** と **見た目の「相対位置」（`Track.position`）** を分離した
- 位置の計算は `normalizeIndex` / `-Math.sign` という小さな純粋関数に切り出した
- アニメーション中は状態を書き換えず、`commit()` で「確定」のタイミングを明示的に作った
- 再描画は「本当に必要な1枚」だけに絞った

どれも「アニメーションが絡む状態管理」で繰り返し使える考え方なので、他のUIを作るときにも応用できるはずです。