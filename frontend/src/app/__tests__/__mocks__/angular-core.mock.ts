/**
 * Mock Angular core module for Jest testing
 * Provides minimal implementations of Angular decorators and utilities
 */

export function Injectable(options?: any): ClassDecorator {
  return (target: any) => target;
}

export function Component(options?: any): ClassDecorator {
  return (target: any) => target;
}

export function Input(): PropertyDecorator {
  return () => {};
}

export function Output(): PropertyDecorator {
  return () => {};
}

export function NgModule(options?: any): ClassDecorator {
  return (target: any) => target;
}

export function Directive(options?: any): ClassDecorator {
  return (target: any) => target;
}

export function Pipe(options?: any): ClassDecorator {
  return (target: any) => target;
}

export class EventEmitter<T = any> {
  private listeners: Array<(value: T) => void> = [];
  
  emit(value: T): void {
    this.listeners.forEach(fn => fn(value));
  }
  
  subscribe(fn: (value: T) => void): { unsubscribe: () => void } {
    this.listeners.push(fn);
    return {
      unsubscribe: () => {
        const index = this.listeners.indexOf(fn);
        if (index > -1) this.listeners.splice(index, 1);
      }
    };
  }
}

export function signal<T>(initialValue: T): () => T {
  let value = initialValue;
  const signalFn = () => value;
  (signalFn as any).set = (newValue: T) => { value = newValue; };
  (signalFn as any).update = (updateFn: (v: T) => T) => { value = updateFn(value); };
  return signalFn;
}

export class NgZone {
  runOutsideAngular<T>(fn: () => T): T {
    return fn();
  }
  run<T>(fn: () => T): T {
    return fn();
  }
}

export class ChangeDetectorRef {
  detectChanges(): void {}
  markForCheck(): void {}
}

export const ViewChild = () => () => {};
export const ViewChildren = () => () => {};
export const ContentChild = () => () => {};
export const ContentChildren = () => () => {};
export const HostBinding = () => () => {};
export const HostListener = () => () => {};
