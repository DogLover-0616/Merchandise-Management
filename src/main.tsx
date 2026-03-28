import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// 開発者ツール（デベロッパーツール）の起動を防ぐ処理
// 右クリックメニューの禁止
document.addEventListener('contextmenu', event => event.preventDefault());

// 特定のショートカットキー無効化
document.addEventListener('keydown', (event) => {
  // F12キー
  if (event.key === 'F12') {
    event.preventDefault();
  }
  // Ctrl+Shift+I / Mac: Cmd+Option+I (開発者ツール)
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'I' || event.key === 'i')) {
    event.preventDefault();
  }
  // Ctrl+Shift+J / Mac: Cmd+Option+J (コンソール)
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'J' || event.key === 'j')) {
    event.preventDefault();
  }
  // Ctrl+U / Mac: Cmd+Option+U (ソースを表示)
  if ((event.ctrlKey || event.metaKey) && (event.key === 'U' || event.key === 'u')) {
    event.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
