# Position Infinite Sliderを作る

## Item自身がpositionを持つ無限スライダー

今回は、画像を横方向へスライドさせながら、端まで進んでも途切れず循環する**無限スライダー**を作ります。

今回の特徴は、

* Trackは1本だけ
* 画像1枚につき1つの `Item`
* 各Itemが自分の `position` を持つ
* DOMの並び順は変更しない
* `transform: translateX()` だけで移動する
* 画面外へ出たItemだけ反対側へ再配置する

という設計です。

元コードでも、Item生成後は `appendChild()` などによるDOMの並べ替えを行わず、各Itemの `position` と `transform` によって表示位置を管理しています。

---

# チュートリアル項目

## 第1部：スライダーの土台を作る

### STEP 1. HTMLでスライダーの骨組みを作る

* `.slider`
* `.track`
* prev / next ボタン

### STEP 2. CSSで「5枚見える領域」を作る

* `overflow: hidden`
* `--view-count`
* `.item` を絶対配置する
* Item1枚の幅を計算する

---

# 第2部：画像1枚をItemとして管理する

### STEP 3. `Item` クラスを作る

* DOM要素
* `position`
* `Slider`
* `imgEl`

### STEP 4. positionから画像を表示する

* `render()`
* `slider.getImage(position)`

### STEP 5. positionからItemを配置する

* `setPosition()`
* `translateX(position * itemWidth)`

---

# 第3部：Slider全体を管理する

### STEP 6. `Slider` クラスを作る

* `viewCount`
* `moveCount`
* `currentStep`
* `itemWidth`

### STEP 7. 必要なItemだけ生成する

* 表示Item
* 左バッファ
* 右バッファ
* `VIEW_COUNT + MOVE_COUNT * 2`

### STEP 8. positionと画像番号を分離する

* `position`
* `currentStep`
* `normalizeIndex()`
* `getImage()`

---

# 第4部：Itemを動かす

### STEP 9. Web Animations APIでItemを移動する

* `Item.animate()`
* `from`
* `to`
* `positionStep`

### STEP 10. NEXT / PREVを実装する

* NEXT → `-MOVE_COUNT`
* PREV → `+MOVE_COUNT`
* 全Itemを同時に動かす

---

# 第5部：無限ループを作る

### STEP 11. 画面外へ出たItemを反対側へ送る

* `min`
* `max`
* `itemTotal`
* positionの正規化

### STEP 12. 移動後に画像を更新する

* `currentStep`
* `commit()`
* `render()`

---

# 第6部：Sliderとして完成させる

### STEP 13. 全Animationの終了を待つ

* `Promise.all()`
* `animation.finished`

### STEP 14. 移動中の連打を防ぐ

* `#isMoving`

### STEP 15. resizeに対応する

* `itemWidth` の再計算
* `setItemPositions()`

### STEP 16. Sliderを生成して完成

* `VIEW_COUNT`
* `MOVE_COUNT`

---

# 第1部：スライダーの土台を作る

# STEP 1. HTMLでスライダーの骨組みを作ろう

まずは、JavaScriptを考えずにHTMLだけ作ります。

```html
<div class="slider" data-slider>
  <ul class="track"></ul>
</div>

<div class="controller">
  <button data-prev>prev</button>
  <button data-next>next</button>
</div>
```

構造は非常にシンプルです。

```text
slider
└── track
    ├── item
    ├── item
    ├── item
    └── ...

controller
├── prev
└── next
```

ただし、この時点では `.track` の中にItemはありません。

ItemはJavaScriptから生成します。

元コードもこのHTML構造を使用しています。

---

## ポイント

今回、Trackは**1本だけ**です。

以前のように、

```text
track -1
track  0
track  1
```

という3ページを動かすのではありません。

今回は、

```text
track
├── item position=-5
├── item position=-4
├── ...
├── item position=0
├── item position=1
├── ...
```

のように、**Item自身が位置を持ちます。**

---

# STEP 2. CSSで表示領域を作ろう

まずSliderです。

```css
.slider {
  position: relative;

  width: min(500px, 100%);
  aspect-ratio: 5 / 1;

  margin: 50px auto;

  overflow: hidden;

  border: 1px solid #aaa;
}
```

重要なのは、

```css
overflow: hidden;
```

です。

Sliderの外へ移動したItemを見えなくします。

---

## Trackを作る

```css
.track {
  position: relative;

  width: 100%;
  height: 100%;
}
```

今回はTrack自体を横移動させません。

そのため、

```css
display: flex;
```

も必要ありません。

**Item一つひとつを絶対配置して動かします。**

元コードでもTrackは単なるItemの配置基準で、各Itemが自分自身で `translateX()` する設計になっています。

---

## Itemを作る

```css
.item {
  position: absolute;
  top: 0;
  left: 0;

  width: calc(100% / var(--view-count));
  height: 100%;

  padding: 5px;

  will-change: transform;
}
```

ここが重要です。

すべてのItemは、

```css
left: 0;
```

からスタートします。

では、横並びにするにはどうするのでしょう？

JavaScriptから、

```css
transform: translateX(...);
```

を設定します。

たとえばItem1枚の幅が100pxなら、

```text
position = 0 → translateX(0px)
position = 1 → translateX(100px)
position = 2 → translateX(200px)
position = 3 → translateX(300px)
position = 4 → translateX(400px)
```

となります。

つまり、

```text
position × itemWidth
```

だけで位置を計算できます。

---

# 第2部：画像1枚をItemとして管理する

# STEP 3. Itemクラスを作ろう

ここからJavaScriptです。

まず画像1枚を表す `Item` クラスを作ります。

```js
class Item {

  constructor(el, position, slider) {

    this.el = el;
    this.position = position;
    this.slider = slider;

  }

}
```

Itemには3つの情報を持たせます。

```text
Item
├── el
│   └── 自分のDOM
│
├── position
│   └── 自分がどこにいるか
│
└── slider
    └── Slider本体
```

この設計が今回の中心です。

---

## DOMも最初に作ってしまう

constructorを少し追加します。

```js
class Item {

  constructor(el, position, slider) {

    this.el = el;
    this.position = position;
    this.slider = slider;

    this.el.innerHTML =
      `<div class="frame"><img alt=""></div>`;

    this.imgEl =
      this.el.querySelector("img");

  }

}
```

ここでは、

```html
<div class="frame">
  <img>
</div>
```

を一度だけ生成します。

その後は、

```js
this.imgEl.src = ...
```

だけを書き換えます。

毎回 `innerHTML` でDOM全体を作り直すわけではありません。元コードでもこの方針がコメント付きで採用されています。

---

# STEP 4. positionから画像を表示しよう

Itemに `render()` を追加します。

```js
render() {

  const img =
    this.slider.getImage(
      this.position
    );

  this.imgEl.src =
    `./img/${img}`;

}
```

Item自身は、

> position 3なら何の画像？

ということを知りません。

Sliderへ、

```js
this.slider.getImage(this.position)
```

と問い合わせます。

役割を分けると、

```text
Item
「私はposition=3です」

        ↓

Slider
「position=3ならこの画像です」

        ↓

Item
「ではimg.srcに設定します」
```

となります。

Itemは**表示担当**、

Sliderは**データ管理担当**です。

元コードの `render()` もこの構造です。

---

# STEP 5. positionからItemを配置しよう

Itemにもう一つメソッドを追加します。

```js
setPosition() {

  this.el.style.transform =
    `translateX(${this.position * this.slider.itemWidth}px)`;

}
```

たとえば、

```js
itemWidth = 100;
position = 3;
```

なら、

```js
3 * 100
```

なので、

```css
transform: translateX(300px);
```

になります。

---

## positionがマイナスなら？

```js
position = -1;
```

なら、

```css
translateX(-100px);
```

になります。

つまりSliderの左側です。

```text
            Slider
              ↓

-2      -1      0      1      2      3      4      5
[ ]     [ ]    [■]    [■]    [■]    [■]    [■]    [ ]
 左バッファ       ← 画面に見える5枚 →       右バッファ
```

これだけで、

* 負数 → 左側
* 0〜4 → 表示中
* 5以上 → 右側

という位置関係を作れます。

---

# 第3部：Slider全体を管理する

# STEP 6. Sliderクラスを作ろう

次はSlider本体です。

```js
class Slider {

  #el;
  #imagePool;
  #viewCount;
  #moveCount;
  #currentStep = 0;
  #itemWidth;
  #items;

  constructor(
    el,
    imagePool,
    viewCount = 5,
    moveCount = 2
  ) {

    this.#el = el;
    this.#imagePool = imagePool;
    this.#viewCount = viewCount;
    this.#moveCount = moveCount;

  }

}
```

ここでは、

```text
viewCount
```

と

```text
moveCount
```

を分けます。

---

## viewCountとは

```js
viewCount = 5;
```

なら、

```text
画面に5枚表示
```

です。

---

## moveCountとは

```js
moveCount = 2;
```

なら、

```text
nextを1回押す
↓
2枚分移動
```

です。

元コードでは `VIEW_COUNT` が表示枚数、`MOVE_COUNT` が1回の操作で動かす枚数として定義されています。さらに左右のバッファ枚数にも `MOVE_COUNT` を利用しています。

---

# STEP 7. 必要なItemだけ生成しよう

Itemは何個必要でしょう？

たとえば、

```js
viewCount = 5;
moveCount = 2;
```

の場合です。

表示する5枚に加えて、

```text
左側に2枚
右側に2枚
```

必要です。

したがって、

```js
5 + 2 * 2
```

で、

```text
9個
```

です。

一般化すると、

```js
viewCount + moveCount * 2
```

になります。

---

## Itemを生成する

```js
this.#items =
  Array.from(
    {
      length:
        viewCount + moveCount * 2
    },

    (_, i) => {

      const position =
        i - moveCount;

      const itemEl =
        document.createElement("li");

      itemEl.classList.add("item");

      track.appendChild(itemEl);

      return new Item(
        itemEl,
        position,
        this
      );

    }
  );
```

重要なのが、

```js
const position =
  i - moveCount;
```

です。

---

## positionを確認する

`moveCount = 2` の場合、

```text
i = 0 → -2
i = 1 → -1
i = 2 →  0
i = 3 →  1
i = 4 →  2
i = 5 →  3
i = 6 →  4
i = 7 →  5
i = 8 →  6
```

となります。

つまり、

```text
-2 -1 | 0 1 2 3 4 | 5 6
```

です。

きれいに、

```text
左バッファ | 表示範囲 | 右バッファ
```

へ分かれます。

元コードも `i - moveCount` をそのまま初期positionとして割り当てています。

---

# STEP 8. positionと画像番号を分離しよう

ここは、このSliderでかなり重要な部分です。

positionは、

```text
-2
-1
0
1
2
3
4
5
6
```

のような**画面上の場所**です。

一方で画像には、

```text
0
1
2
3
4
5
...
```

という画像配列上の番号があります。

この2つは別物です。

---

## currentStepを使う

そこでSliderに、

```js
#currentStep = 0;
```

を持たせます。

そして画像番号を、

```js
currentStep + position
```

で求めます。

---

## 最初

```text
currentStep = 0
```

なら、

```text
position 0 → image 0
position 1 → image 1
position 2 → image 2
```

です。

---

## 2枚進んだら

```text
currentStep = 2
```

なので、

```text
position 0 → image 2
position 1 → image 3
position 2 → image 4
```

になります。

つまり、

```text
position
= 画面上の場所

currentStep
= 画像データ上でどこまで進んだか
```

です。

---

# STEP 8-2. 配列の端を循環させよう

画像が16枚しかないのに、

```js
index = 16;
```

になったら困ります。

そこで、

```js
#normalizeIndex(index) {

  const length =
    this.#imagePool.length;

  return (
    (index % length)
    + length
  ) % length;

}
```

を作ります。

これによって、

```text
16 → 0
17 → 1
18 → 2
```

となります。

さらに、

```text
-1 → 15
-2 → 14
```

のように負数も循環できます。

---

## getImageを作る

```js
getImage(position) {

  const index =
    this.#normalizeIndex(
      this.#currentStep + position
    );

  return this.#imagePool[index];

}
```

これでItemは、

```js
slider.getImage(position)
```

とするだけで正しい画像を取得できます。

元コードでも `normalizeIndex()` で剰余を使い、`currentStep + position` から画像を取得しています。

---

# 第4部：Itemを動かす

# STEP 9. Item.animate()を作ろう

いよいよItemを動かします。

```js
animate(positionStep) {

  const from =
    this.position;

  const to =
    this.position
    + positionStep;

  const width =
    this.slider.itemWidth;

}
```

まず、

```js
from
```

と

```js
to
```

を求めます。

---

## 例：NEXTで2枚進む

NEXTでは、

```js
positionStep = -2;
```

とします。

現在、

```js
position = 3;
```

なら、

```js
from = 3;
to = 1;
```

です。

画面上では、

```text
3 → 1
```

へ移動します。

つまり左へ2枚ぶん動きます。

---

# STEP 9-2. Web Animations APIを使おう

続けて、

```js
const animation =
  this.el.animate(
    [
      {
        transform:
          `translateX(${from * width}px)`
      },

      {
        transform:
          `translateX(${to * width}px)`
      }
    ],

    {
      duration: 300,
      easing: "ease",
      fill: "forwards"
    }
  );
```

とします。

たとえば、

```text
from = 3
to   = 1
width = 100
```

なら、

```text
translateX(300px)
        ↓
translateX(100px)
```

へアニメーションします。

元コードでも `from` と `to` をpositionから計算し、Web Animations APIで `translateX()` を補間しています。

---

# STEP 10. NEXTとPREVを実装しよう

イベントを登録します。

```js
controller
  ?.querySelector("[data-next]")
  ?.addEventListener(
    "click",
    () => this.move(-moveCount)
  );

controller
  ?.querySelector("[data-prev]")
  ?.addEventListener(
    "click",
    () => this.move(moveCount)
  );
```

一見すると、

```text
NEXTなのにマイナス？
PREVなのにプラス？
```

と思うかもしれません。

しかし、これは**Itemのpositionをどちらへ動かすか**です。

---

## NEXT

次の画像を見たい場合、

現在見えているItemは左へ移動します。

したがって、

```js
-MOVE_COUNT
```

です。

```text
position 4
   ↓
position 2
```

---

## PREV

前の画像を見たい場合、

Itemは右へ移動します。

したがって、

```js
+MOVE_COUNT
```

です。

```text
position 2
   ↓
position 4
```

元コードでもNEXTに `-moveCount`、PREVに `moveCount` を渡しています。

---

# 第5部：無限ループを作る

# STEP 11. 画面外へ出たItemを反対側へ送ろう

ここまでではItemを移動できるだけです。

何度もNEXTすると、

```text
position
4
2
0
-2
-4
-6
...
```

となって消えてしまいます。

そこで、許可するpositionの範囲を決めます。

---

## 最小値

```js
const min =
  -this.slider.moveCount;
```

`moveCount = 2` なら、

```text
min = -2
```

です。

---

## 最大値

```js
get maxPosition() {

  return (
    this.#viewCount
    - 1
    + this.#moveCount
  );

}
```

たとえば、

```text
viewCount = 5
moveCount = 2
```

なら、

```text
4 + 2 = 6
```

です。

したがってpositionの範囲は、

```text
-2 ～ 6
```

となります。

---

# STEP 11-2. 範囲外なら循環させよう

移動後に、

```js
this.position = to;
```

でpositionを確定します。

そして、

```js
if (
  this.position < min
  || this.position > max
) {

}
```

で範囲外か確認します。

---

## Item総数を求める

```js
get itemTotal() {

  return (
    this.#viewCount
    + this.#moveCount * 2
  );

}
```

今回なら、

```text
5 + 2 × 2
= 9
```

です。

positionは、

```text
-2 -1 0 1 2 3 4 5 6
```

なので、確かに9個あります。

---

# STEP 11-3. positionを正規化しよう

範囲外のpositionを、

```js
this.position =
  min
  + (
    (
      (this.position - min) % range
    )
    + range
  ) % range;
```

で範囲内へ戻します。

かなり難しく見えます。

考え方を分解しましょう。

---

## ① minを0として考える

本来の範囲は、

```text
-2 ～ 6
```

です。

これを、

```js
this.position - min
```

すると、

```text
0 ～ 8
```

として扱えます。

---

## ② `% range` で循環させる

Item総数は9なので、

```js
% 9
```

します。

すると、

```text
9 → 0
10 → 1
11 → 2
```

になります。

---

## ③ 最後にminを戻す

最後に、

```js
+ min
```

することで、

```text
-2 ～ 6
```

へ戻します。

つまり、

```text
任意のposition
      ↓
0始まりへ変換
      ↓
剰余で循環
      ↓
元のposition範囲へ戻す
```

という処理です。

元コードでは `MOVE_COUNT >= 2` でも一度に複数の境界を越えられるよう、単純な `±itemTotal` ではなく剰余による一般化された正規化が採用されています。

---

# STEP 12. 循環したItemだけ画像を更新しよう

positionを反対側へ移したら、

```js
this.render();
```

を呼びます。

```js
if (
  this.position < min
  || this.position > max
) {

  this.position =
    /* positionを正規化 */;

  this.render();

}
```

なぜここだけrenderするのでしょう？

たとえば普通に、

```text
position 3 → position 1
```

へ移動したItemは、

**同じItemがそのまま移動しただけ**です。

画像を変更する必要はありません。

一方、

```text
position -4
```

まで出たItemを、

```text
position 5
```

へワープさせた場合、

そこには別の画像が必要です。

そのため、

```text
循環したItemだけrender()
```

します。

これは無限スライダーで重要な最適化です。

---

# STEP 12-2. commitという処理にまとめよう

今回はAnimationオブジェクトへ、

```js
animation.commit = () => {

};
```

という独自メソッドを追加しています。

```js
animation.commit = () => {

  this.position =
    to;

  const min =
    -this.slider.moveCount;

  const max =
    this.slider.maxPosition;

  if (
    this.position < min
    || this.position > max
  ) {

    // positionを循環

    this.render();

  }

};
```

これによって、

```text
アニメーションする
      ↓
終了する
      ↓
commit()
      ↓
positionを確定
      ↓
必要なら循環
      ↓
必要ならrender
```

という処理になります。

---

# 第6部：Sliderとして完成させる

# STEP 13. 全Itemを同時に動かそう

Sliderに `move()` を作ります。

```js
async move(positionStep) {

  let animations = [];

  animations =
    this.#items.map(item => {

      return item.animate(
        positionStep
      );

    });

}
```

すべてのItemに、

```js
item.animate(positionStep)
```

を実行します。

---

# STEP 13-2. 全Animationの終了を待とう

Web Animations APIには、

```js
animation.finished
```

があります。

これはPromiseです。

そこで、

```js
await Promise.all(
  animations.map(
    animation =>
      animation.finished
  )
);
```

とします。

つまり、

```text
Item1 animation ─────┐
Item2 animation ─────┤
Item3 animation ─────┤
Item4 animation ─────┤
Item5 animation ─────┘

          ↓

全部終了

          ↓

次の処理
```

です。

元コードの `move()` も、全ItemのAnimationを生成してから `Promise.all()` で終了を待っています。

---

# STEP 14. currentStepを更新しよう

Animationが終了したら、

```js
this.#currentStep +=
  positionStep;
```

します。

NEXTで、

```js
positionStep = -5;
```

なら、

```text
currentStep
0 → -5
```

となります。

この値とItemのpositionから、

```js
getImage(position)
```

が次に表示すべき画像を計算します。

---

# STEP 14-2. 各Animationをcommitしよう

続いて、

```js
animations.forEach(animation => {

  animation.commit();

});
```

です。

各Itemが、

```text
position確定
↓
範囲チェック
↓
必要なら循環
↓
必要なら画像更新
```

を行います。

---

# STEP 14-3. transformを正式な位置へ戻そう

Animationの `fill: "forwards"` は、

**アニメーション結果を見た目として維持しているだけ**です。

そこで、

```js
this.setItemPositions();
```

を実行します。

```js
setItemPositions() {

  this.#items.forEach(item => {

    item.setPosition();

  });

}
```

これで正式な、

```css
style.transform
```

へpositionを反映します。

最後に、

```js
animations.forEach(animation => {

  animation.cancel();

});
```

とします。

処理は、

```text
animation
↓
finished
↓
currentStep更新
↓
commit
↓
style.transformへ正式配置
↓
animation.cancel()
```

です。

元コードもこの順序になっています。

---

# STEP 15. ボタン連打を防ごう

アニメーション中にnextを何度も押されると、

```text
現在position
↓
Animation A
↓
Animation B
↓
Animation C
```

のように状態が競合します。

そこで、

```js
#isMoving = false;
```

を持たせます。

---

## move開始時

```js
if (this.#isMoving) {
  return;
}

this.#isMoving = true;
```

---

## move終了時

```js
finally {

  this.#isMoving = false;

}
```

これで、

```text
停止中
↓
クリック
↓
isMoving = true
↓
Animation
↓
終了
↓
isMoving = false
```

となります。

---

# STEP 16. resizeに対応しよう

Item幅は、

```js
el.clientWidth / viewCount
```

で求めています。

```js
this.#itemWidth =
  el.clientWidth / viewCount;
```

画面サイズが変われば、この値も変わります。

そこで、

```js
window.addEventListener("resize", () => {

  this.#itemWidth =
    el.clientWidth / viewCount;

  if (this.#isMoving) {
    return;
  }

  this.setItemPositions();

});
```

とします。

これでSlider幅が変わっても、

```text
itemWidth再計算
↓
position × 新しいitemWidth
↓
再配置
```

できます。

元コードでもresize時に幅を再計算し、Animation中でなければItemを再配置しています。

---

# STEP 17. Sliderを生成して完成

最後に、

```js
new Slider(
  document.querySelector("[data-slider]"),
  imagePool,
  5,
  5
);
```

とします。

ここでは、

```text
VIEW_COUNT = 5
MOVE_COUNT = 5
```

です。

つまり、

```text
画面には5枚表示

nextを1回押す
↓
5枚ぶん移動

prevを1回押す
↓
5枚ぶん戻る
```

となります。

元コードの最終インスタンスも `viewCount = 5`、`moveCount = 5` です。

---

# 最終的な処理の流れ

ここまでの処理をまとめます。

```text
nextクリック
    ↓
move(-MOVE_COUNT)
    ↓
全Item.animate()
    ↓
position
現在値 → 現在値 - MOVE_COUNT
    ↓
全Animation終了
    ↓
currentStep更新
    ↓
各Item.commit()
    ↓
positionを確定
    ↓
範囲外？
 ┌──────┴──────┐
 NO            YES
 │              │
そのまま      positionを反対側へ循環
                ↓
             render()
 └──────┬──────┘
        ↓
setItemPositions()
        ↓
animation.cancel()
        ↓
完了
```

---

# このスライダーの設計で一番重要なポイント

このコードを理解するときは、

```text
DOMの順番
```

と

```text
画面上の順番
```

を分けて考えることが重要です。

DOMは最初に、

```html
<li class="item"></li>
<li class="item"></li>
<li class="item"></li>
<li class="item"></li>
...
```

と作ったら、その後は並び替えません。

代わりに、

```js
item.position
```

だけを変更します。

そして、

```js
translateX(
  position * itemWidth
)
```

によって画面上の場所を決めます。

つまり、

```text
DOM
固定

position
変化する

transform
positionを画面上の座標へ変換する
```

という構造です。

---

# さらに重要な3つの値

最後に、このコードでは次の3つを混同しないことが重要です。

## 1. position

```js
item.position
```

Itemが**画面上のどこにいるか**。

```text
-5 -4 -3 -2 -1 | 0 1 2 3 4 | 5 6 7 8 9
```

---

## 2. currentStep

```js
#currentStep
```

Slider全体が**画像配列上でどこまで進んだか**。

```text
0
-5
-10
-15
...
```

---

## 3. image index

```js
normalizeIndex(
  currentStep + position
)
```

実際に表示する画像番号。

この3つを分離したことで、

```text
Itemの配置
```

と

```text
表示する画像
```

を独立して管理できます。

---

# 今回の完成イメージ

```text
                  slider
                     │
      ┌──────────────┴──────────────┐
      │                             │
   position                     currentStep
 Itemの場所                   データ上の進行位置
      │                             │
      └──────────────┬──────────────┘
                     ↓
               getImage()
                     ↓
             normalizeIndex()
                     ↓
                  画像
```

そして移動すると、

```text
positionを動かす
        ↓
Animation
        ↓
positionを確定
        ↓
端を越えたItemだけ循環
        ↓
そのItemだけ画像を更新
```

となります。

これが今回の**Item単位Position Infinite Slider**の基本構造です。
