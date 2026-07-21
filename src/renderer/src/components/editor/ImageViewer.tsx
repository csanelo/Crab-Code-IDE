import { useEffect, useRef, useState } from 'react'
import { emit as emitAppEvent } from '../../lib/appEvents'
import { toastError, toastSuccess } from '../../lib/toast'
import { useT } from '../../i18n'
import './ImageViewer.css'

export const IMAGE_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg', 'avif'
])

export function isImagePath(name: string): boolean {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return false
  return IMAGE_EXTS.has(name.slice(dot + 1).toLowerCase())
}

const CONVERT_TARGETS: { ext: string; mime: string; label: string }[] = [
  { ext: 'png', mime: 'image/png', label: 'PNG' },
  { ext: 'jpg', mime: 'image/jpeg', label: 'JPEG' },
  { ext: 'webp', mime: 'image/webp', label: 'WebP' },
  { ext: 'bmp', mime: 'image/bmp', label: 'BMP' }
]

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  avif: 'image/avif'
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

function baseName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

function dirOf(p: string): string {
  const norm = p.replace(/\\/g, '/')
  const i = norm.lastIndexOf('/')
  return i >= 0 ? p.slice(0, i) : ''
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

interface Props {
  path: string
  name: string
}

export function ImageViewer({ path, name }: Props): JSX.Element {
  const t = useT()
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [size, setSize] = useState(0)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [convertOpen, setConvertOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const ext = extOf(name)

  useEffect(() => {
    let cancelled = false
    setDataUrl(null)
    setDims(null)
    void window.api.fs.readBinary(path).then((res) => {
      if (cancelled || !res) return
      const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream'
      setDataUrl(`data:${mime};base64,${res.base64}`)
      setSize(res.size)
    })
    return () => {
      cancelled = true
    }
  }, [path, ext])

  async function convertTo(target: { ext: string; mime: string }): Promise<void> {
    setConvertOpen(false)
    if (!imgRef.current || busy) return
    setBusy(true)
    try {
      const img = imgRef.current
      const w = img.naturalWidth
      const h = img.naturalHeight
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      if (target.ext === 'jpg' || target.ext === 'bmp') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
      }
      ctx.drawImage(img, 0, 0)
      const dataUrlOut = canvas.toDataURL(target.mime, 0.95)
      const base64 = dataUrlOut.split(',')[1] ?? ''
      if (!base64 || !dataUrlOut.startsWith(`data:${target.mime}`)) {
        throw new Error('unsupported')
      }
      const stem = name.slice(0, name.length - (ext.length ? ext.length + 1 : 0))
      const outName = `${stem}.${target.ext}`
      const outPath = `${dirOf(path)}/${outName}`
      const res = await window.api.fs.writeBinary({ path: outPath, base64 })
      if ('error' in res) throw new Error(res.error)
      emitAppEvent('fs:changed', undefined)
      emitAppEvent('editor:open', { path: res.path })
      toastSuccess(t('image.converted', { name: outName }))
    } catch {
      toastError(t('image.convertFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="imgview">
      <div className="imgview__canvas">
        {dataUrl && (
          <img
            ref={imgRef}
            src={dataUrl}
            alt={name}
            className="imgview__img"
            onLoad={(e) =>
              setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
            }
          />
        )}
      </div>
      <div className="imgview__status">
        <span className="imgview__status-item">{ext.toUpperCase()}</span>
        {dims && (
          <span className="imgview__status-item">
            {dims.w} × {dims.h} px
          </span>
        )}
        <span className="imgview__status-item">{formatBytes(size)}</span>
        <div className="imgview__spacer" />
        <div className="imgview__convert">
          <button
            type="button"
            className="imgview__status-btn"
            disabled={busy}
            onClick={() => setConvertOpen((v) => !v)}
            title={t('image.convertTo')}
          >
            {busy ? t('image.converting') : t('image.convertTo')}
          </button>
          {convertOpen && (
            <>
              <div className="imgview__backdrop" onClick={() => setConvertOpen(false)} />
              <div className="imgview__menu" role="listbox">
                {CONVERT_TARGETS.map((target) => (
                  <button
                    key={target.ext}
                    type="button"
                    role="option"
                    aria-selected={target.ext === ext}
                    className="imgview__menu-item"
                    onClick={() => void convertTo(target)}
                  >
                    {target.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
