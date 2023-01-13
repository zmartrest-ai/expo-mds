import {
  NativeModulesProxy,
  EventEmitter,
  Subscription,
} from "expo-modules-core";

// Import the native module. On web, it will be resolved to ExpoMds.web.ts
// and on native platforms to ExpoMds.ts
import { ChangeEventPayload, ExpoMdsViewProps } from "./ExpoMds.types";
import ExpoMdsModule from "./ExpoMdsModule";
import ExpoMdsView from "./ExpoMdsView";
import MDSImpl from "./MdsImpl";

// Get the native constant value.
export const PI = ExpoMdsModule.PI;

export function hello(): string {
  return ExpoMdsModule.hello();
}

export async function setValueAsync(value: string) {
  return await ExpoMdsModule.setValueAsync(value);
}

const emitter = new EventEmitter(ExpoMdsModule ?? NativeModulesProxy.ExpoMds);

export const scan = MDSImpl.scan;

export const stopScan = MDSImpl.stopScan;

export const setHandlers = MDSImpl.setHandlers;

export const connect = MDSImpl.connect;

export const disconnect = MDSImpl.disconnect;

export const get = MDSImpl.get;

export const put = MDSImpl.put;

export const post = MDSImpl.post;

export const deleteCall = MDSImpl.delete;

export const subscribe = MDSImpl.subscribe;

export const unsubscribe = MDSImpl.unsubscribe;

export function addChangeListener(
  listener: (event: ChangeEventPayload) => void
): Subscription {
  return emitter.addListener<ChangeEventPayload>("onChange", listener);
}

export { ExpoMdsView, ExpoMdsViewProps, ChangeEventPayload };

export default MDSImpl;
