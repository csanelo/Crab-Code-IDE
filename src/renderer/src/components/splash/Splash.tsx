import { useEffect, useState } from 'react'
import { asset } from '../../lib/asset'
import './Splash.css'

export function Splash(): JSX.Element | null {
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const fade = setTimeout(() => setLeaving(true), 3000)
    const remove = setTimeout(() => setGone(true), 3400)
    return () => {
      clearTimeout(fade)
      clearTimeout(remove)
    }
  }, [])

  if (gone) return null

  return (
    <div className={`splash${leaving ? ' splash--leaving' : ''}`}>
      <img src={asset('icon.png')} alt="CrabCode" className="splash__icon" />
      <span className="splash__tagline">Let&apos;s Build</span>
    </div>
  )
}
