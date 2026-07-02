import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// vite.config.ts doesn't set test.globals, so @testing-library/react's
// automatic afterEach-based cleanup never registers; without this, each
// test's render stays mounted in document.body and leaks into later tests
// in the same file (e.g. duplicate elements from a previous test's render).
afterEach(() => {
  cleanup()
})

// jsdom doesn't implement matchMedia; Mantine's MantineProvider needs it to
// detect color-scheme preference.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}
