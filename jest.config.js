module.exports = {
    preset: 'ts-jest',
    modulePathIgnorePatterns: ['<rootDir>/dist/'],
    testEnvironment: 'node',
    collectCoverage: false,
    collectCoverageFrom: ['src/**/*.ts'],
    coverageReporters: ['html', 'text-summary'],
    coverageDirectory: 'coverage',
    transformIgnorePatterns: ['/node_modules/', '../../node_modules/'],
    moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx', 'node'],

};
