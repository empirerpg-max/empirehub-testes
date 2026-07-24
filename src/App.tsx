import { PlayProvider } from '@/lib/playContext'
import { PlayHomePage } from '@/pages/PlayHomePage'
import { MiniPlayer } from '@/components/MiniPlayer'

export default function App() {
  return (
    <div className="dark min-h-screen bg-background text-foreground flex flex-col">
      <PlayProvider>
        <PlayHomePage />
        <MiniPlayer />
      </PlayProvider>
    </div>
  )
}
