import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'cursor-debug-logger',
      configureServer(server) {
        const logPath = path.join(process.cwd(), '.cursor', 'debug-0000b9.log')
        server.middlewares.use('/__cursor_debug', (req, res, next) => {
          if (req.method !== 'POST') return next()
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', () => {
            try {
              fs.mkdirSync(path.dirname(logPath), { recursive: true })
              // Append raw NDJSON line
              fs.appendFileSync(logPath, body.trim() + '\n', { encoding: 'utf8' })
            } catch {
              // ignore
            }
            res.statusCode = 204
            res.end()
          })
        })
      },
    },
  ],
})
