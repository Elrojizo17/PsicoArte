import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const deploymentId = process.env.VERCEL_DEPLOYMENT_ID
  || process.env.VERCEL_GIT_COMMIT_SHA
  || Date.now().toString(36)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'version-service-worker-per-deployment',
    apply: 'build',
    async writeBundle(outputOptions) {
      const workerPath = resolve(outputOptions.dir || 'dist', 'sw.js')
      const workerSource = await readFile(workerPath, 'utf8')
      await writeFile(workerPath, workerSource.replace('__DEPLOYMENT_ID__', deploymentId))
    },
  }],
})
