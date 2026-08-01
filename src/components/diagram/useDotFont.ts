/**
 * DotGothic16(OFL / 自前ホスト)を最初に図が出たときだけ読み込む。
 * Google が配る unicode-range 分割そのままなので、実際に使った字の
 * サブセット(1つ10KB前後)しかダウンロードされない。
 * CSS の @import だと vite の base ('/takken-story/') を解決できないためここで貼る。
 */
const ID = 'dg-dotgothic16'

export function useDotFont(): void {
  if (typeof document === 'undefined' || document.getElementById(ID) !== null) return
  const link = document.createElement('link')
  link.id = ID
  link.rel = 'stylesheet'
  link.href = `${import.meta.env.BASE_URL}assets/fonts/dotgothic16.css`
  document.head.append(link)
}
