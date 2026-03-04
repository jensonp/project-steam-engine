/**
 * Jest test setup file
 * Configures the test environment before each test suite runs
 */

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  },
  setItem(key: string, value: string): void {
    this.store[key] = value;
  },
  removeItem(key: string): void {
    delete this.store[key];
  },
  clear(): void {
    this.store = {};
  },
  get length(): number {
    return Object.keys(this.store).length;
  },
  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] ?? null;
  }
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Reset localStorage before each test
beforeEach(() => {
  localStorageMock.clear();
});

// Mock console methods to reduce noise in test output (optional)
// Uncomment if you want to suppress console output during tests
// global.console = {
//   ...console,
//   log: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };
