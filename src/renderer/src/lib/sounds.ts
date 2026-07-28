import { asset } from './asset'

const SOUND_PATHS = {
  stopped: asset('stopped.mp3'),
  success: asset('success.mp3')
} as const

type SoundName = keyof typeof SOUND_PATHS

const ENABLED_KEY = 'sreda.soundsEnabled'
let soundsEnabled = (() => {
  try {
    return localStorage.getItem(ENABLED_KEY) !== 'false'
  } catch {
    return true
  }
})()

export function getSoundsEnabled(): boolean {
  return soundsEnabled
}

export function setSoundsEnabled(enabled: boolean): void {
  soundsEnabled = enabled
  try {
    localStorage.setItem(ENABLED_KEY, String(enabled))
  } catch {
    return
  }
}

export async function playSound(name: SoundName): Promise<void> {
  if (!soundsEnabled) return
  try {
    const audio = new Audio(SOUND_PATHS[name])
    await audio.play()
  } catch {
    return
  }
}
