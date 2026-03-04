/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      useESM: false,
    }],
  },
  moduleNameMapper: {
    '^@angular/core$': '<rootDir>/src/app/__tests__/__mocks__/angular-core.mock.ts',
    '^@angular/(.*)$': '<rootDir>/src/app/__tests__/__mocks__/angular.mock.ts',
  },
  collectCoverageFrom: [
    'src/app/services/**/*.ts',
    'src/app/components/**/*.ts',
    '!src/app/**/*.mock.ts',
    '!src/app/**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  setupFilesAfterEnv: ['<rootDir>/src/app/__tests__/setup.ts'],
};
