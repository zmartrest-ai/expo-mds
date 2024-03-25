import { NativeModulesProxy, EventEmitter, Subscription } from 'expo-modules-core';

// Import the native module. On web, it will be resolved to ExpoMds.web.ts
// and on native platforms to ExpoMds.ts
import ExpoMdsModule from './ExpoMdsModule';
import ExpoMdsView from './ExpoMdsView';
import { ChangeEventPayload, ExpoMdsViewProps } from './ExpoMds.types';

// Get the native constant value.
export const PI = ExpoMdsModule.PI;

export function hello(): string {
  return ExpoMdsModule.hello();
}

export async function setValueAsync(value: string) {
  return await ExpoMdsModule.setValueAsync(value);
}

const emitter = new EventEmitter(ExpoMdsModule ?? NativeModulesProxy.ExpoMds);

export function addChangeListener(listener: (event: ChangeEventPayload) => void): Subscription {
  return emitter.addListener<ChangeEventPayload>('onChange', listener);
}

export { ExpoMdsView, ExpoMdsViewProps, ChangeEventPayload };
