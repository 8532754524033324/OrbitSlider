
    // ========================================
    // 1. Data
    //
    // この配列は最後まで並べ替えない。
    // 「どこから何枚切り出して見せるか」を
    // 表示側（SLIDE）で計算することで
    // 無限ループを表現する。
    // ========================================

    const imagePool = [
      "onepiece01_luffy2.png",
      "onepiece02_zoro_bandana.png",
      "onepiece03_nami.png",
      "onepiece04_usopp_sogeking.png",
      "onepiece05_sanji.png",
      "onepiece07_robin.png",
      "onepiece08_franky.png",
      "onepiece09_brook.png",
      "onepiece10_jinbe.png",
      "onepiece11_arlong.png",
      "onepiece12_buggy.png",
      "onepiece13_crocodile.png",
      "onepiece14_enel.png",
      "onepiece15_lucci.png",
      "onepiece16_moria.png",
      "onepiece17_doflamingo.png"
    ];


    // ========================================
    // 2. DOM
    // ========================================

    const slider =
      document.querySelector(".slider");


    // 3つの .track 要素。
    // trackElements[0] / [1] / [2] は
    // 最後まで同じDOM要素を指し続ける
    // （並べ替えたり作り直したりしない）。
    const trackElements =
      document.querySelectorAll(".track");


    const prevButton =
      document.getElementById("prev");


    const nextButton =
      document.getElementById("next");


    // ========================================
    // 3. Animation Settings
    // ========================================

    const ANIMATION_DURATION =
      300;


    const ANIMATION_EASING =
      "ease";


    // ========================================
    // 4. Index normalize
    //
    // 配列の範囲(0 〜 length-1)からはみ出た
    // 添字を、循環させて範囲内に丸め込む。
    //
    // JSの % は負の数を渡すと負の値を返すため
    // (-1 % 16 === -1)、そのままでは配列の添字に
    // 使えない。
    //   1. index % length         → 範囲を -length+1〜length-1 に縮める
    //   2. + length                → 全体を正方向にずらして負値を消す
    //   3. % length（再度）         → ずらしすぎた分をもう一度丸める
    // という3段階の計算で、常に 0〜length-1 に収める。
    //
    // この関数自体は「今どこを見ているか」という
    // 状態を一切持たない、ただの純粋な計算。
    // ========================================

    function normalizeIndex(index) {

      return (
        (index % imagePool.length)
        + imagePool.length
      ) % imagePool.length;

    }


    // ========================================
    // 5. Slide
    //
    // VIEW_COUNT と currentStep は
    // SLIDEの中だけで管理する。
    //
    // ここが「今何ステップ目を表示しているか」を
    // 一元管理する唯一の場所。
    // 各Trackはこの currentStep を直接知らず、
    // 自分の相対位置(position)だけを持つ
    // （方式の違いは下の getSlicedImgPool 付近を参照）。
    // ========================================

    const SLIDE = (() => {

      // 1画面に同時に表示する画像の枚数
      const VIEW_COUNT =
        5;


      // 「今何ステップ進んだか」を表す唯一のカウンタ。
      // 1ステップ = VIEW_COUNT枚分のスライド。
      let currentStep =
        0;


      // ----------------------------------------
      // NEXT
      //
      // positionStep: このアクションで各Trackの
      // position をどれだけ動かすか
      //（"次へ"なので画像は左へ、
      //   つまりTrackは -1 方向へ動く）
      // ----------------------------------------

      const NEXT = {

        positionStep: -1,


        updateCurrentStep() {

          currentStep++;

        }

      };


      // ----------------------------------------
      // PREV
      // ----------------------------------------

      const PREV = {

        positionStep: 1,


        updateCurrentStep() {

          currentStep--;

        }

      };


      // ----------------------------------------
      // stepから画像開始indexを循環取得
      //
      // 例: VIEW_COUNT=5 のとき
      //   step=0 → 開始index 0
      //   step=1 → 開始index 5
      //   step=-1 → 開始index -5 → normalizeIndexで循環
      // ----------------------------------------

      function cycleIndex(step) {

        return normalizeIndex(
          step * VIEW_COUNT
        );

      }


      // ----------------------------------------
      // positionから表示画像を切り出す
      //
      // position(-1/0/1)を受け取り、
      // 「currentStepから見てpositionだけ
      //   ずれた位置のVIEW_COUNT枚」を
      // imagePoolから切り出して返す。
      //
      // ★ここが「currentIndexで1枚ずつ管理する方式」
      //   ではなく「positionで相対管理する方式」の
      //   中心部分。currentStep(絶対位置)は
      //   SLIDEだけが知っていて、
      //   Track側は自分の相対位置(position)を
      //   渡すだけで良い設計になっている。
      // ----------------------------------------

      function getSlicedImgPool(position) {

        const start =
          cycleIndex(
            currentStep + position
          );


        return Array.from(
          {
            length: VIEW_COUNT
          },

          (_, i) => {

            const index =
              normalizeIndex(
                start + i
              );


            return imagePool[index];

          }
        );

      }


      // ----------------------------------------
      // CSSへ表示枚数を渡す
      // ----------------------------------------

      function setup(slider) {

        slider.style.setProperty(
          "--view-count",
          VIEW_COUNT
        );

      }


      return {
        NEXT,
        PREV,
        cycleIndex,
        getSlicedImgPool,
        setup
      };

    })();


    // ========================================
    // 6. Track
    //
    // Trackが保持する状態は
    //
    //   el
    //   position
    //
    // だけ。
    //
    // 「今どの画像を表示しているか」という
    // データ的な情報は一切持たず、
    // 「自分は真ん中から見て何番目にいるか」という
    // 相対位置だけを持つ。
    // ========================================

    class Track {

      constructor(el, position) {

        this.el =
          el;


        /*
          -1 = prev
           0 = current
           1 = next
        */

        this.position =
          position;

      }


      // ----------------------------------------
      // Animation
      //
      // このメソッドの中では this.position を
      // まだ書き換えない。
      //
      // アニメーションが正常に終わるかどうかは
      // この時点ではわからない（リサイズや
      // エラーで中断される可能性がある）ため、
      // 見た目(transform)だけを先に動かし、
      // データ(position)の確定は commit() まで
      // 保留する。
      // ----------------------------------------

      animate(slide, width) {

        const from =
          this.position;


        const to =
          this.position
          + slide.positionStep;


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
              duration:
                ANIMATION_DURATION,

              easing:
                ANIMATION_EASING,

              fill:
                "forwards"
            }
          );


        /*
          to はローカル変数だが、
          commit() がクロージャとして保持する。

          animate()の実行自体はここで終わっても、
          commit()がtoを参照し続ける限り
          toはメモリ上に残り続ける（クロージャ）。

          こうしてTrackごとに「確定すべき値」を
          関数の中に閉じ込めて持ち運ぶことで、
          3つのTrackを同時に動かしても
          どのTrackのtoがどの値だったかを
          取り違えずに済む。

          Animation終了後に
          positionを正式に更新する。
        */

        animation.commit = () => {

          const positionUpdated =
            this.updatePosition(
              to
            );


          return positionUpdated
            ? this
            : null;

        };


        return animation;

      }


      // ----------------------------------------
      // Position Update
      //
      // positionを更新する。
      //
      // -1 / 0 / 1 を超えた場合は
      // 反対側の端へ回す。
      //
      // 補正が発生した場合だけ true。
      //
      // ★呼び出し側(move())は、この戻り値を
      //   そのまま「再描画が必要かどうか」の
      //   判定に使っている。3枚のうち
      //   反対端に回ったTrackだけが
      //   表示すべき画像の中身が変わるため、
      //   そのTrackだけをrenderTrackし直せば済む。
      // ----------------------------------------

      updatePosition(position) {

        this.position =
          position;


        /*
          -1 / 0 / 1 の範囲なら
          そのままでよい。
        */

        if (
          Math.abs(this.position) <= 1
        ) {

          return false;

        }


        /*
          NEXT

          -1
           ↓
          -2
           ↓
           1


          PREV

           1
           ↓
           2
           ↓
          -1


          Math.sign(-2)
          → -1

          -Math.sign(-2)
          → 1


          Math.sign(2)
          → 1

          -Math.sign(2)
          → -1

          「符号だけを取り出して反転する」ことで、
          範囲を超えた数値の大きさに関係なく
          必ず -1 か 1 に丸め込める
          （1ステップにつき1しか動かない設計なので
            2を超えることはない前提）。
        */

        this.position =
          -Math.sign(
            this.position
          );


        /*
          positionが反対端へ回ったので、
          このTrackは内容の再描画が必要。
        */

        return true;

      }


      // ----------------------------------------
      // 現在のpositionへ配置
      //
      // アニメーションを使わず、
      // 即座にその位置へ配置し直すためのメソッド。
      // 初期表示・リサイズ時・エラー時の
      // 巻き戻しに使う。
      // ----------------------------------------

      setPosition(width) {

        this.el.style.transform =
          `translateX(${this.position * width}px)`;

      }

    }


    // ========================================
    // 7. Track生成
    // ========================================

    const tracks = [

      new Track(
        trackElements[0],
        -1
      ),

      new Track(
        trackElements[1],
        0
      ),

      new Track(
        trackElements[2],
        1
      )

    ];


    /*
      tracks配列は並べ替えない。


      tracks[0]
      tracks[1]
      tracks[2]


      は最初から最後まで
      同じDOM。


      変化するのは、

      track.position

      だけ。
    */


    // ========================================
    // 8. Track Render
    //
    // currentStep や VIEW_COUNT は
    // renderTrackでは扱わない。
    //
    // positionだけSLIDEへ渡す。
    //
    // ★このTrackが「今どの画像を表示すべきか」を
    //   知っているのはSLIDE側だけで、
    //   renderTrackはそれを教えてもらって
    //   そのままDOMに反映するだけ、という
    //   役割分担になっている。
    // ========================================

    function renderTrack(track) {

      const slicedImgs =
        SLIDE.getSlicedImgPool(
          track.position
        );


      track.el.innerHTML =
        slicedImgs
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


    // ========================================
    // 9. Track Position
    // ========================================

    function setTrackPositions() {

      const width =
        slider.clientWidth;


      tracks.forEach(track => {

        track.setPosition(
          width
        );

      });

    }


    // ========================================
    // 10. Initial Render
    // ========================================

    SLIDE.setup(
      slider
    );


    tracks.forEach(track => {

      renderTrack(
        track
      );

    });


    setTrackPositions();


    // ========================================
    // 11. Lock
    //
    // isMoving は「今アニメーション中かどうか」を
    // 表すだけのシンプルなフラグ。
    // これによりアニメーション中の連打を無視し、
    // Trackの状態が壊れるのを防ぐ。
    // ========================================

    let isMoving =
      false;


    function lock() {

      isMoving =
        true;


      prevButton.disabled =
        true;

      nextButton.disabled =
        true;

    }


    function unlock() {

      isMoving =
        false;


      prevButton.disabled =
        false;

      nextButton.disabled =
        false;

    }


    // ========================================
    // 12. Move
    //
    // slideには
    //
    //   SLIDE.NEXT
    //
    // または
    //
    //   SLIDE.PREV
    //
    // が渡される。
    // ========================================

    async function move(slide) {

      if (isMoving) {
        return;
      }


      lock();


      let animations = [];


      try {

        const width =
          slider.clientWidth;


        // --------------------------------------
        // Animation開始
        //
        // まだpositionは変更しない。
        // 見た目(transform)だけを先に動かす。
        // --------------------------------------

        animations =
          tracks.map(track => {

            return track.animate(
              slide,
              width
            );

          });


        // --------------------------------------
        // 全Animation終了待ち
        //
        // 3つのTrackが同時に動くので、
        // 全部が終わるまでPromise.allで待つ。
        // --------------------------------------

        await Promise.all(

          animations.map(
            animation =>
              animation.finished
          )

        );


        // --------------------------------------
        // currentStep更新
        //
        // アニメーションが正常に終わったことが
        // 確認できた、このタイミングで初めて
        // SLIDEの「現在地」を進める。
        // --------------------------------------

        slide.updateCurrentStep();


        // --------------------------------------
        // Position Update
        //
        // animate()時に登録した
        // commit()をここで遅延実行。
        //
        // positionが反対端へ回ったTrackだけ
        // Track自身が返る
        // （updatePosition()がtrueを返した場合のみ）。
        // --------------------------------------

        animations.forEach(animation => {

          const updatedTrack =
            animation.commit();


          if (updatedTrack) {

            // 反対端に回ったTrackだけ、
            // 表示すべき画像の中身が変わっているので
            // ここで初めて再描画する。
            // それ以外の2枚は位置が変わっただけで
            // 中身はすでに正しいため触らない。
            renderTrack(
              updatedTrack
            );

          }

        });


        // --------------------------------------
        // 新しいpositionへ正式配置
        //
        // Web Animations APIのアニメーションは
        // 一時的なものなので、確定した position を
        // 元にCSSのtransformとして正式に上書きする。
        // --------------------------------------

        setTrackPositions();


        // --------------------------------------
        // Animation解除
        //
        // fill:"forwards"で残っていた
        // アニメーションの効果を解除する
        // （setTrackPositionsで上書き済みのため
        //   このタイミングで消してよい）。
        // --------------------------------------

        animations.forEach(animation => {

          animation.cancel();

        });

      }


      catch (error) {

        /*
          commit()実行前であれば
          track.positionは変更されていない。

          元のpositionへ戻す。
        */

        setTrackPositions();


        animations.forEach(animation => {

          animation.cancel();

        });

      }


      finally {

        unlock();

      }

    }


    // ========================================
    // 13. Controller
    // ========================================

    nextButton.addEventListener(
      "click",
      () => {

        move(
          SLIDE.NEXT
        );

      }
    );


    prevButton.addEventListener(
      "click",
      () => {

        move(
          SLIDE.PREV
        );

      }
    );


    // ========================================
    // 14. Resize
    //
    // アニメーション中(isMoving)は
    // リサイズによる位置の再計算をスキップする。
    // アニメーション中にtransformを上書きすると
    // 見た目が一瞬崩れてしまうため。
    // ========================================

    window.addEventListener(
      "resize",
      () => {

        if (isMoving) {
          return;
        }


        setTrackPositions();

      }
    );