import { useState } from 'react'
import { GameProvider, useGame } from './state/GameProvider.jsx'
import LoadingScreen from './ui/LoadingScreen.jsx'
import IntroSplash from './ui/IntroSplash.jsx'
import ModeSelect from './ui/ModeSelect.jsx'
import TutorialModal from './ui/TutorialModal.jsx'
import GameScreen from './ui/GameScreen.jsx'
import EndingScreen from './ui/EndingScreen.jsx'

function Screens() {
  const { state } = useGame()
  const [fontsLoaded, setFontsLoaded] = useState(false)
  const [introDone, setIntroDone] = useState(false)

  return (
    <div className="app-root">
      <div className="grain" />
      <div className="flicker" />
      {!fontsLoaded ? (
        <LoadingScreen onDone={() => setFontsLoaded(true)} />
      ) : !introDone ? (
        <IntroSplash onDone={() => setIntroDone(true)} />
      ) : (
        <>
          {state.screen === 'modeSelect' && <ModeSelect />}
          {state.screen === 'tutorial' && <TutorialModal />}
          {state.screen === 'playing' && <GameScreen />}
          {state.screen === 'ending' && <EndingScreen />}
        </>
      )}
    </div>
  )
}

export default function App() {
  return (
    <GameProvider>
      <Screens />
    </GameProvider>
  )
}
