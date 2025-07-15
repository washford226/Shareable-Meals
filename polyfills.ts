// polyfills.ts
import cloneDeep from 'lodash.clonedeep';

// Polyfill for structuredClone if it doesn't exist
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = function structuredClone(obj: any) {
    return cloneDeep(obj);
  };
}

// Export an empty object to make this a module
export {};
