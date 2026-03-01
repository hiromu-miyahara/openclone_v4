import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './app/App'
import './styles/index.css'
import { Toaster } from 'sonner'
import { env } from './app/lib/utils/env'

// Register Service Worker for PWA
// 一時的に無効化（キャッシュ問題のため）
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/sw.js').catch((error) => {
//       console.log('Service Worker registration failed:', error);
//     });
//   });
// }

const googleClientId = env.VITE_GOOGLE_CLIENT_ID;

function AppShell() {
  const inner = (
    <>
      <App />
      <Toaster position="top-center" richColors closeButton />
    </>
  );

  // clientId未設定時はProviderをスキップ（ローカル開発・テスト用）
  if (!googleClientId) {
    return inner;
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      {inner}
    </GoogleOAuthProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="crt-scanlines crt-vignette">
      <AppShell />
    </div>
  </StrictMode>,
)
