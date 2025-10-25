// Polyfills for React Native performance issues

// Fix for RawPerformanceEntry undefined error
if (typeof global.performance === 'undefined') {
  global.performance = {};
}

if (typeof global.performance.now === 'undefined') {
  global.performance.now = () => Date.now();
}

// Fix for PerformanceObserver if needed
if (typeof global.PerformanceObserver === 'undefined') {
  global.PerformanceObserver = class PerformanceObserver {
    constructor() {}
    observe() {}
    disconnect() {}
  };
}

// Suppress RawPerformanceEntry warnings
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && args[0].includes && args[0].includes('RawPerformanceEntry')) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};
