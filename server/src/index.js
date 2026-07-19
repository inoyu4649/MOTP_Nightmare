import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { exec } from 'node:child_process'
import { MODE_CODES } from './config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist')

const app = express()
app.use(express.json())

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})

app.post('/api/verify', (req, res) => {
  const { mode, stage, code } = req.body ?? {}
  const codes = MODE_CODES[mode]
  if (!codes || !(stage in codes)) {
    return res.status(400).json({ result: 'invalid' })
  }
  const guess = String(code ?? '').trim()
  return res.json({ result: guess === codes[stage] ? 'open' : 'fail' })
})

app.use(express.static(clientDist))

app.get('/*splat', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'))
})

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`
  exec(cmd, () => {})
}

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`
  console.log('====================================================')
  console.log('  Memories of the Past — TIMES Nightmare 방탈출 서버')
  console.log('====================================================')
  console.log(`  ${url}`)
  console.log('  (이 창을 닫으면 서버가 종료됩니다)')
  if (!process.env.NO_BROWSER) {
    setTimeout(() => openBrowser(url), 800)
  }
})
