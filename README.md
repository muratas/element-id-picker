# element-id-picker

ページ上の任意の要素をクリックして、その要素を特定するための情報（CSSセレクタ、タグ/ID/class一覧、属性、テキスト抜粋、DOM階層パス、可能ならReactコンポーネント名）をまとめてクリップボードにコピーするChrome拡張です。

「このボタンの話をしている」ということをAIに伝えたいときに、class名だけをコピーするのではなく、CSS Modulesやstyled-componentsのようなハッシュ化されたクラス名でも意味が通る情報一式をコピーします。

## 使い方

1. `chrome://extensions` を開き、右上の「デベロッパーモード」をON
2. 「パッケージ化されていない拡張機能を読み込む」からこのディレクトリを選択
3. 対象ページでツールバーのアイコンをクリックしてピッカーを有効化（アイコンに `ON` バッジが出ます）
4. コピーしたい要素をクリック（ページ本来のクリック動作は発生しません）
5. トーストで「コピーしました」と表示されたらクリップボードに情報が入っています
6. 再度アイコンをクリック、または `Esc` キーでピッカーを終了

## コピーされる内容の例

```
## Element picked (Element ID Picker)

Selector: `button.Btn_primary__f8sd:nth-of-type(2)`
Tag: button
Classes: Btn_primary__f8sd, is-active
Attributes: type="submit" data-testid="submit-btn"
React component: SubmitButton
Text: "送信する"
DOM path: html > body > div#root.App > main > div.Card_root__x1a2b > button
Open tag: <button class="Btn_primary__f8sd is-active" type="submit" data-testid="submit-btn">
```

## 仕組み

- `content.js` がホバー中の要素をハイライトし、クリックをキャプチャして情報を組み立てます
- Reactコンポーネント名は、DOMノードに付与される内部プロパティ（`__reactFiber$...`）を辿って推測しています（開発用ビルドに限らず動作しますが、コンポーネント名が縮小されているプロダクションビルドでは取得できない場合があります）
- `background.js` はツールバーアイコンのクリックでタブごとにON/OFFを切り替えます
