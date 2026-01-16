// Test setup file for Vitest
import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock Firebase
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
}))

vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(),
}))

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless needed
  log: vi.fn(),
}