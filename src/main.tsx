import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DebugScreen } from './debug/DebugScreen'

// /takken-story/debug はイベント確認用のデバッグ画面。本編とは完全に別画面。
// ponytail: ルーターは要らない。パスを見て出し分けるだけ
const isDebug = /\/debug\/?$/.test(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isDebug ? <DebugScreen /> : <App />}</StrictMode>,
)
