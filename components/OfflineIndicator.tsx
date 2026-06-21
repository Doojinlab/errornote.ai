'use client'

import { useEffect, useSyncExternalStore } from 'react'

// 온라인/오프라인은 외부 스토어(navigator + online/offline 이벤트)이므로
// useSyncExternalStore 로 구독한다 — effect 내 setState 를 피하고 hydration 안전.
function subscribeOnline(callback: () => void): () => void {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

export default function OfflineIndicator() {
  const isOffline = useSyncExternalStore(
    subscribeOnline,
    () => !navigator.onLine, // client snapshot
    () => false // server snapshot: SSR 에서는 온라인으로 가정
  )

  // 서비스워커 등록은 표시 상태와 무관한 1회성 부수효과 — 별도 effect 로 유지.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-gray-800 px-4 py-2 text-sm font-medium text-white shadow-lg">
      <span className="h-2 w-2 rounded-full bg-red-400" />
      오프라인
    </div>
  )
}
