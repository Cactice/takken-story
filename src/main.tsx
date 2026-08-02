import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// /takken-story/debug はイベント確認用のデバッグ画面。本編とは完全に別画面。
// ponytail: ルーターは要らない。パスを見て出し分けるだけ。
// lazy にしてあるのは本編のバンドルにデバッグ用のコードを混ぜないため
const isDebug = /\/debug\/?$/.test(window.location.pathname)
const DebugScreen = lazy(() =>
  import('./debug/DebugScreen').then((m) => ({ default: m.DebugScreen })),
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDebug ? (
      <Suspense fallback={null}>
        <DebugScreen />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
