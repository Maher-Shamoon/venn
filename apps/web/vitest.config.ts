import { mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Unit and component tests only. Playwright specs live in e2e/ and run with `npm run e2e`.
export default mergeConfig(viteConfig, { test: { include: ['src/**/*.test.{ts,tsx}'] } })
