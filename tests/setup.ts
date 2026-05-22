import 'fake-indexeddb/auto';

// Mock chrome.storage.local for testing
const storage: Record<string, unknown> = {};

const chromeStorageMock = {
  local: {
    get: vi.fn((keys: string | string[] | null): Promise<Record<string, unknown>> => {
      return new Promise((resolve) => {
        if (keys === null) {
          resolve({ ...storage });
        } else if (typeof keys === 'string') {
          resolve({ [keys]: storage[keys] });
        } else {
          const result: Record<string, unknown> = {};
          for (const key of keys) {
            result[key] = storage[key];
          }
          resolve(result);
        }
      });
    }),
    set: vi.fn((items: Record<string, unknown>): Promise<void> => {
      return new Promise((resolve) => {
        Object.assign(storage, items);
        resolve();
      });
    }),
    remove: vi.fn((keys: string | string[]): Promise<void> => {
      return new Promise((resolve) => {
        const keyArray = typeof keys === 'string' ? [keys] : keys;
        for (const key of keyArray) {
          delete storage[key];
        }
        resolve();
      });
    }),
    clear: vi.fn((): Promise<void> => {
      return new Promise((resolve) => {
        Object.keys(storage).forEach((key) => delete storage[key]);
        resolve();
      });
    }),
  },
};

// @ts-expect-error - Mocking chrome global
globalThis.chrome = {
  storage: chromeStorageMock,
};

// Reset storage between tests
beforeEach(() => {
  Object.keys(storage).forEach((key) => delete storage[key]);
  vi.clearAllMocks();
});
