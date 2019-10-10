import { Image } from '@fly/image'
import { mount } from "@fly/fetch/mount"

// templateをテキストで取得するFunction
async function getTemplate() {
  const resp = await fetch("file://src/template.html")
  return await resp.text()
}

// svgをテキストで取得しつつ中身ちょっと埋め込めるFunction
async function getSvgText(title) {
  const resp = await fetch("file://src/sample.svg")
  const text = await resp.text()
  // g4(https://www.g-g-g-g.games)ではReactでテキスト化されたsvgを吐いてるが、とりあえず単純に置換する
  return text.replace('{{content}}', title)
}

// 画像形式のレスポンス作るFunction
async function responseImage(svgText) {
  const svgResp = new Response(Buffer.from(svgText))
  const buf = await svgResp.arrayBuffer()
  const png = new Image(buf).png()
  const result = await png.toBuffer()
  return new Response(result.data, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': result.data.byteLength.toString(),
    }
  })
}

// 出力データのパターン
const TITLES = [
  'g4 is pomodoro rpg!',
  'fly.io de OGP!!',
]

// fly.ioのrouterみたいなやつ。ここに処理を書いてく。
const mounts = mount({

  // このパスでogpの画像を生成する
  '/image.png': async (req, init) => {
    const url = new URL(req.url)

    // URLからQueryStringを取得
    const index = url.searchParams.get('i')
    if (index !== '0' && index !== '1') {
      return new Response('not found', { status: 404 })
    }

    // 対応したタイトルを取得
    const title = TITLES[index]

    // タイトルをsvgに埋め込んだテキストを作る
    const svgText = await getSvgText(title)

    // svgからpng画像を生成する
    return responseImage(svgText)
  },

  // このパスをシェアする
  '/': async (req, init) => {
    const url = new URL(req.url)

    // URLからQueryStringを取得
    const index = url.searchParams.get('i')
    if (index !== '0' && index !== '1') {
      return new Response('not found', { status: 404 })
    }

    // 対応したタイトルを取得
    const title = TITLES[index]

    // テンプレートをparseして編集できるようにする
    const doc = Document.parse(await getTemplate())

    // テンプレートにOGPを埋め込む
    doc.querySelector('meta[name="description"]').setAttribute('content', title)
    doc.querySelector('meta[property="og:url"]').setAttribute('content', url.href)
    doc.querySelector('meta[property="og:title"]').setAttribute('content', title)
    doc.querySelector('meta[property="og:description"]').setAttribute('content', title)
    doc.querySelector('meta[property="og:image"]').setAttribute('content', `${url.origin}/image.png?i=${index}`)
    doc.querySelector('meta[property="og:image:alt"]').setAttribute('content', title)

    // htmlを返す
    return new Response(doc.documentElement.outerHTML, {
      headers: { 'Content-Type': 'text/html' },
      status: 200,
    })
  },
})

// リクエストをmountsの定義を使って処理するように設定する
fly.http.respondWith(mounts)
