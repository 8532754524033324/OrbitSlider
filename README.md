# JavaScriptで作る無限スライダー

## 3本のtrackを再利用してDOMを増やさない設計

今回は、JavaScriptで**無限に左右へ移動できるスライダー**を作ります。

ただし、画像を無限に複製するわけではありません。

今回のポイントは、

> **3本のtrackだけを使い回す**

ことです。

HTMLには最初から3つの`.track`だけを用意します。

```html
<div class="slider">
  <ul class="track"></ul>
  <ul class="track"></ul>
  <ul class="track"></ul>
</div>
```

この3本を、

```text
prev
current
next
```

という役割で管理します。

さらにスライド完了後はDOMそのものを作り直すのではなく、JavaScript側の`tracks`配列を並び替えます。

元コードでも、DOM順そのものは変更せず、3つのtrackを固定したまま配列を`shift()` / `push()`などで循環させる設計になっています。

---

# 1. 今回作る仕組み

まず全体像です。

```text
初期状態

[ prev    ][ current ][ next    ]
   -1           0          +1
```

`NEXT`を押すと、

```text
[ prev    ][ current ][ next    ]
      ←          ←          ←

移動後

             [ current ][ next ][ prev ]
```

ここで重要なのは、

```text
prevを削除して
新しいnextを作る
```

のではなく、

```text
prevだったtrackを右端へ再利用する
```

ことです。

つまり3本のDOMを永久に使い回します。

---

# 2. HTMLを用意する

HTMLは非常にシンプルです。

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

3本の`.track`は、

```text
0番目 → prev
1番目 → current
2番目 → next
```

として扱います。

画像をHTML側に直接書かないのもポイントです。

画像はJavaScriptから必要な5枚だけ描画します。

---

# 3. sliderとtrackを重ねる

CSSでは3本のtrackをすべて同じ位置へ配置します。

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
```

3本とも、

```css
position: absolute;
inset: 0;
```

なので、CSS上では同じ位置に存在します。

実際に

```text
左
中央
右
```

のどこへ置くかは、JavaScriptの`translateX()`で決定します。

元コードでも、trackの実際の位置はすべてJS側の`translateX()`で管理し、CSS transitionは使用せずWeb Animations APIを使う設計になっています。

---

# 4. 1画面に5枚表示する

今回は5枚表示します。

JavaScript側で、

```js
const VIEW_COUNT = 5;
```

と定義します。

CSSにも同じ数字を直接書くのではなく、

```js
slider.style.setProperty(
  "--view-count",
  VIEW_COUNT
);
```

としてCSS変数へ渡します。

CSS側は、

```css
.track li {
  flex: 0 0 calc(
    100% / var(--view-count)
  );

  height: 100%;
  padding: 5px;

  list-style: none;
  border: 1px solid #000;
}
```

とします。

これで、

```text
slider幅 ÷ 5
```

が1枚の幅になります。

重要な値である`VIEW_COUNT`はJavaScriptを情報源とし、CSSにはその値を注入する設計です。

---

# 5. 画像データを配列で管理する

画像一覧を配列にします。

```js
const imagePool = [
  "image01.png",
  "image02.png",
  "image03.png",
  "image04.png",
  "image05.png",
  "image06.png",
  "image07.png",
  "image08.png",
  "image09.png",
  "image10.png"
];
```

ここから、

```text
5枚ずつ
```

取り出して各trackへ描画します。

---

# 6. indexを循環させる

無限スライダーなので、最後の画像まで行ったら最初へ戻る必要があります。

逆方向も同様です。

そこでindexを正規化します。

```js
function normalizeIndex(index) {
  return (
    (index % imagePool.length)
    + imagePool.length
  ) % imagePool.length;
}
```

例えば画像が10枚なら、

```js
normalizeIndex(10);
// 0

normalizeIndex(11);
// 1

normalizeIndex(-1);
// 9
```

になります。

特に重要なのが負数です。

単純に、

```js
-1 % 10
```

とするとJavaScriptでは`-1`になります。

そこで、

```js
(index % length + length) % length
```

という形にしています。

---

# 7. 指定位置から5枚取得する

次に、

```js
getItems(startIndex)
```

を作ります。

```js
function getItems(startIndex) {
  return Array.from(
    { length: VIEW_COUNT },
    (_, i) => {
      const index =
        normalizeIndex(startIndex + i);

      return imagePool[index];
    }
  );
}
```

例えば、

```js
getItems(0);
```

なら、

```text
0
1
2
3
4
```

の5枚。

```js
getItems(5);
```

なら、

```text
5
6
7
8
9
```

です。

最後を超えても`normalizeIndex()`があるので、

```text
8
9
0
1
2
```

のように循環できます。

---

# 8. 3本のtrackを配列で持つ

DOMを取得します。

```js
const tracks = [
  ...document.querySelectorAll(".track")
].map(el => ({ el }));
```

概念的には、

```text
tracks

[
  { el: prevのDOM },
  { el: currentのDOM },
  { el: nextのDOM }
]
```

という状態です。

そして役割を、

```js
const ROLES = [
  "prev",
  "current",
  "next"
];
```

と定義します。

ここで重要なのは、

```text
tracks[0] = prev
tracks[1] = current
tracks[2] = next
```

という不変条件を作ることです。

---

# 9. 位置と移動先をテーブル化する

今回の設計で特に重要なのがここです。

```js
const trackTable = {
  prev: {
    start: -1,
    prev: 0,
    next: -2
  },

  current: {
    start: 0,
    prev: 1,
    next: -1
  },

  next: {
    start: 1,
    prev: 2,
    next: 0
  }
};
```

このテーブルは、

```text
現在どこにいるか
nextを押したらどこへ行くか
prevを押したらどこへ行くか
```

を表しています。

例えば`current`なら、

```js
current: {
  start: 0,
  prev: 1,
  next: -1
}
```

です。

つまり、

```text
通常時      0
PREV時     +1
NEXT時     -1
```

となります。

図にすると、

```text
NEXT

prev       current       next
 -1           0           1
  ↓           ↓           ↓
 -2          -1           0
```

です。

PREVなら逆になります。

```text
PREV

prev       current       next
 -1           0           1
  ↓           ↓           ↓
  0           1           2
```

このテーブルを作ることで、

```js
currentIndex + VIEW_COUNT
currentIndex - VIEW_COUNT
```

や、

```js
from - direction * width
```

のような計算を各所に書かなくてよくなります。

---

# 10. roleから描画内容を決定する

trackへ画像を描画する関数です。

```js
function renderTrack(role) {
  const trackIndex =
    ROLES.indexOf(role);

  const trackEl =
    tracks[trackIndex].el;

  const startIndex =
    currentIndex
    + trackTable[role].start
    * VIEW_COUNT;

  const items =
    getItems(startIndex);

  trackEl.innerHTML = items
    .map(img => `
      <li>
        <img
          src="./img/${img}"
          alt=""
        >
      </li>
    `)
    .join("");
}
```

例えば、

```js
renderTrack("next");
```

と呼ぶだけで、

```text
どのtrackへ描画するか
どのindexから5枚取るか
```

の両方が決まります。

元コードではこのようにrole文字列1つから、対象DOMと描画する画像範囲の両方を導出しています。

---

# 11. 3本のtrackを配置する

sliderの横幅を取得します。

```js
function startTrackPositions() {
  const width =
    slider.clientWidth;

  ROLES.forEach((role, i) => {
    tracks[i].el.style.transform =
      `translateX(${
        trackTable[role].start
        * width
      }px)`;
  });
}
```

例えばsliderが500pxなら、

```text
prev
translateX(-500px)

current
translateX(0)

next
translateX(500px)
```

となります。

つまり、

```text
┌─────────┬─────────┬─────────┐
│  prev   │ current │  next   │
└─────────┴─────────┴─────────┘
   -500       0         +500
```

という状態になります。

ただし`.slider`には、

```css
overflow: hidden;
```

があるので、画面に見えるのは中央の`current`だけです。

---

# 12. 初期描画

初期状態では3本すべて描画します。

```js
ROLES.forEach(role => {
  renderTrack(role);
});

startTrackPositions();
```

`currentIndex = 0`なら、

```text
prev
→ 最後側の5枚

current
→ 0〜4

next
→ 5〜9
```

となります。

---

# 13. NEXT後にtrackを使い回す

ここからが無限スライダーの核心です。

NEXTが完了したとします。

移動前は、

```text
tracks

[
  prev,
  current,
  next
]
```

です。

NEXT後は、

```js
tracks.push(
  tracks.shift()
);
```

とします。

すると、

```text
[
  current,
  next,
  prev
]
```

になります。

しかし重要なのは、

```text
配列の0番目 = prev
配列の1番目 = current
配列の2番目 = next
```

というルールです。

つまり元`current`のDOMが、

```text
新しいprev
```

になります。

元`next`が、

```text
新しいcurrent
```

になります。

そして元`prev`が、

```text
新しいnext
```

として使い回されます。

そのため新しく画像を描画する必要があるのは、

```text
新しいnextだけ
```

です。

```js
function recycleNext() {
  tracks.push(
    tracks.shift()
  );

  currentIndex += VIEW_COUNT;

  renderTrack("next");
}
```

元コードも同じく、NEXTでは`shift()`したtrackを`push()`し、新しい右端だけを再描画します。

---

# 14. PREVも同じ考え方

PREVでは逆方向です。

```js
function recyclePrev() {
  tracks.unshift(
    tracks.pop()
  );

  currentIndex -= VIEW_COUNT;

  renderTrack("prev");
}
```

配列は、

```text
[
  prev,
  current,
  next
]
```

から、

```text
[
  next,
  prev,
  current
]
```

になります。

今度は左端へ再利用されたtrackだけ描き直せばよいわけです。

---

# 15. Web Animations APIで移動する

今回はCSSの`transition`ではなく、

```js
element.animate()
```

を使います。

```js
const animation =
  element.animate(
    [
      {
        transform:
          `translateX(${from}px)`
      },
      {
        transform:
          `translateX(${to}px)`
      }
    ],
    {
      duration: 300,
      easing: "ease",
      fill: "forwards"
    }
  );
```

`animate()`は`Animation`オブジェクトを返します。

さらに、

```js
animation.finished
```

はPromiseです。

そのため、

```js
await animation.finished;
```

と書けます。

---

# 16. 3本同時にアニメーションする

3本すべてについて、

```js
ROLES.map(...)
```

でAnimationを作ります。

```js
const animations =
  ROLES.map((role, i) => {

    const {
      start,
      [direction]: to
    } = trackTable[role];

    return tracks[i].el.animate(
      [
        {
          transform:
            `translateX(${
              start * width
            }px)`
        },
        {
          transform:
            `translateX(${
              to * width
            }px)`
        }
      ],
      {
        duration:
          ANIMATION_DURATION,

        easing:
          ANIMATION_EASING,

        fill: "forwards"
      }
    );
  });
```

ここが`trackTable`の強みです。

例えば、

```js
direction === "next"
```

なら、

```js
trackTable[role].next
```

が自動的に取得されます。

```js
const {
  start,
  [direction]: to
} = trackTable[role];
```

というcomputed propertyを利用しています。

---

# 17. Promise.all()ですべての終了を待つ

3本同時に動いているので、

```js
await Promise.all(
  animations.map(
    animation =>
      animation.finished
  )
);
```

とします。

これで、

```text
prev
current
next
```

の3本すべてが終了するまで次の処理へ進みません。

その後、

```js
if (
  direction === DIRECTION.NEXT
) {
  recycleNext();
} else {
  recyclePrev();
}
```

として論理状態を更新します。

---

# 18. fill: forwardsとcancel()の関係

Animationには、

```js
fill: "forwards"
```

を指定しています。

これによってアニメーション終了後も、

```text
アニメーション終了地点
```

が維持されます。

しかし、この状態をずっと残しておくわけではありません。

スライド完了後、

```js
startTrackPositions();
```

で通常の`style.transform`へ正しい位置を書き込みます。

そのあと、

```js
animations.forEach(
  animation => animation.cancel()
);
```

とします。

つまり、

```text
Animation側の位置
        ↓
style.transform側へ引き継ぐ
        ↓
Animationを破棄
```

という流れです。

元コードも、`fill: "forwards"`による一時的なtransformを保持したあと、新しい配列順に基づく位置をstyleへ反映してからAnimationを解除しています。

---

# 19. 連打を防止する

アニメーション中にボタンを連打されると、

```text
trackの並び替え
currentIndexの変更
再描画
```

が重なってしまいます。

そこで、

```js
let isMoving = false;
```

を用意します。

```js
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
```

そして、

```js
async function move(direction) {
  if (isMoving) return;

  lock();

  try {
    // animation
  } finally {
    unlock();
  }
}
```

とします。

`finally`にすることで、途中でエラーが発生しても必ずロックを解除できます。

---

# 20. move()全体

最終的なスライド処理はこうなります。

```js
async function move(direction) {
  if (isMoving) return;

  lock();

  try {
    const width =
      slider.clientWidth;

    const animations =
      ROLES.map((role, i) => {

        const {
          start,
          [direction]: to
        } = trackTable[role];

        return tracks[i].el.animate(
          [
            {
              transform:
                `translateX(${
                  start * width
                }px)`
            },
            {
              transform:
                `translateX(${
                  to * width
                }px)`
            }
          ],
          {
            duration:
              ANIMATION_DURATION,

            easing:
              ANIMATION_EASING,

            fill: "forwards"
          }
        );
      });

    await Promise.all(
      animations.map(
        animation =>
          animation.finished
      )
    );

    if (
      direction === DIRECTION.NEXT
    ) {
      recycleNext();
    } else {
      recyclePrev();
    }

    startTrackPositions();

    animations.forEach(
      animation =>
        animation.cancel()
    );

  } catch (error) {

    startTrackPositions();

  } finally {

    unlock();
  }
}
```

元コードでは`Animation.finished`がキャンセル時にrejectする可能性も考慮し、`try / catch / finally`で位置の復元とロック解除まで保証しています。

---

# 21. ボタンからmove()を呼ぶ

方向もマジックナンバーではなく文字列で管理します。

```js
const DIRECTION = {
  NEXT: "next",
  PREV: "prev"
};
```

イベントは、

```js
nextButton.addEventListener(
  "click",
  () => {
    move(DIRECTION.NEXT);
  }
);

prevButton.addEventListener(
  "click",
  () => {
    move(DIRECTION.PREV);
  }
);
```

とします。

`"next"`と`"prev"`はそのまま、

```js
trackTable[role][direction]
```

のキーとして利用できます。

---

# 22. リサイズにも対応する

スライド位置には、

```js
slider.clientWidth
```

を使っています。

そのためウィンドウ幅が変わった場合は位置を再計算します。

```js
window.addEventListener(
  "resize",
  () => {
    if (isMoving) return;

    startTrackPositions();
  }
);
```

`startTrackPositions()`内部で毎回`slider.clientWidth`を取得しているので、レスポンシブにも対応できます。

---

# 23. この設計の重要ポイント

今回の実装では次の考え方が中心になっています。

1. **DOMは3本だけ用意する**
2. **prev / current / nextというroleで考える**
3. **位置関係をtrackTableへ集約する**
4. **tracks配列を回転させてDOMを再利用する**
5. **新しく必要になった端のtrackだけ再描画する**
6. **Web Animations APIでアニメーションする**
7. **Animation.finishedをPromiseとして待つ**
8. **try / finallyで操作ロックを確実に解除する**

特に重要なのは、

```js
tracks.push(tracks.shift());
```

や、

```js
tracks.unshift(tracks.pop());
```

そのものではありません。

本質は、

```text
DOMの実体
```

と、

```text
prev / current / nextという役割
```

を分離して考えているところです。

---

# 24. 3本のDOMが役割を交代している

NEXTするたびに、

```text
DOM A
DOM B
DOM C
```

そのものは残り続けます。

最初は、

```text
A = prev
B = current
C = next
```

ですが、NEXT後は、

```text
B = prev
C = current
A = next
```

になります。

さらにNEXTすると、

```text
C = prev
A = current
B = next
```

です。

つまり、

```text
A → B → C → A → B → C...
```

とDOMを新しく生成しているのではなく、

```text
3つのDOMが役割を交代し続けている
```

と考えると理解しやすくなります。

---

# 25. まとめ

無限スライダーというと、

```text
画像を複製する
大量にDOMを並べる
最後まで行ったら先頭へワープする
```

と考えがちです。

しかし今回の実装では、

```text
prev
current
next
```

という3つの表示領域だけを用意し、

```text
表示
↓
アニメーション
↓
配列を回転
↓
端だけ再描画
↓
位置をリセット
```

という処理を繰り返しています。

特に、

```js
const trackTable = {
  prev: {
    start: -1,
    prev: 0,
    next: -2
  },

  current: {
    start: 0,
    prev: 1,
    next: -1
  },

  next: {
    start: 1,
    prev: 2,
    next: 0
  }
};
```

のように、

> **状態と移動ルールをデータとして表現する**

ことで、スライダーの計算ロジックをかなり整理できます。

さらに、

```js
const {
  start,
  [direction]: to
} = trackTable[role];
```

とすることで、

```text
nextならどう動く
prevならどう動く
```

という分岐をアニメーション処理の中へ大量に書く必要もありません。

この実装は単なるスライダーの作り方だけでなく、

```text
DOMの再利用
状態とDOMの分離
配列による役割管理
テーブル駆動
Web Animations API
Promise
async / await
```

をまとめて学べるサンプルになっています。
