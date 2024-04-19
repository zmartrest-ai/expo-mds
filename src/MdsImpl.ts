import { EventEmitter, Subscription } from "expo-modules-core";
import { Platform } from "react-native";

import ExpoMdsModule from "./ExpoMdsModule";

const URI_PREFIX = "suunto://";

type OnDeviceConnected = (serial: string, address: string) => void;
type OnDeviceDisconnected = (serial: string) => void;

const mdsEmitter = new EventEmitter(ExpoMdsModule);
// {"Response": {"Status": 200}, "Body": {"Serial": "213330002095"}, "Uri": "suunto://MDS/ConnectedDevices", "Method": "DEL"}
interface Response {
  Body: ConnectionBody | DisconnectBody | HRBody;
  Method: "POST" | "GET" | "PUT" | "DEL";
  Uri: string;
  Response?: {
    // seemingly only sent for requests (not subscriptions)
    Status: number;
  };
}

interface HRBody {
  average: number;
  rrData: number[];
}

interface ConnectionBody {
  Connection: Connection;
  DeviceInfo: DeviceInfo;
  Serial: string;
}

interface DisconnectBody {
  Serial: string;
}

interface DeviceInfo {
  Description: string;
  Mode: number;
  Name: string;
  Serial: string;
  SwVersion: string;
  additionalVersionInfo?: any;
  addressInfo: { address: string; name: string }[];
  apiLevel: string;
  brandName?: any;
  design?: any;
  hw: string;
  hwCompatibilityId: string;
  manufacturerName: string;
  pcbaSerial: string;
  productName: string;
  serial: string;
  sw: string;
  variant: string;
}

interface Connection {
  Type: string;
  UUID: string;
}

function extractAddressFromResponseBody(body: Response["Body"]): string {
  if (Platform.OS === "ios") {
    return body["Connection"]?.["UUID"];
  }

  // Format from 00-00-00-00-00-00 to 00:00:00:00:00:00 (unable to disconnect otherwise)
  return body["DeviceInfo"]?.addressInfo[0]?.address.replaceAll("-", ":");
}

class MDSImpl {
  #subsKey: number;
  #callbacks: Record<
    string,
    {
      success: (notification: string) => void;
      error: (error: Error) => void;
      uri: string;
    }
  >;
  #mdsEmitter: null | EventEmitter | boolean;
  #subscribedToConnectedDevices: boolean;
  #connectedDevicesSubscription: string | undefined;
  #onDeviceConnected: OnDeviceConnected | undefined;
  #onDeviceDisconnected: OnDeviceDisconnected | undefined;
  #newNotificationSubscription: Subscription | undefined;
  #newNotificationErrorSubscription: Subscription | undefined;

  constructor() {
    this.#subsKey = 0;
    this.#callbacks = {};
    this.#mdsEmitter = null;
    this.#subscribedToConnectedDevices = false;
    this.#connectedDevicesSubscription = undefined;

    this.#newNotificationSubscription = mdsEmitter.addListener(
      "newNotification",
      this.#handleNewNotification.bind(this),
    );
    this.#newNotificationErrorSubscription = mdsEmitter.addListener(
      "newNotificationError",
      this.#handleNewNotificationError.bind(this),
    );
    this.#mdsEmitter = mdsEmitter;
  }

  #subscribeToConnectedDevices() {
    this.#subscribedToConnectedDevices = true;
    this.#connectedDevicesSubscription = this.subscribe(
      "MDS/ConnectedDevices",
      (notification) => {
        const data = JSON.parse(notification) as Response;

        if (data["Method"] === "POST") {
          if (data.hasOwnProperty("Body")) {
            const address = extractAddressFromResponseBody(data["Body"]);
            if (data["Body"].hasOwnProperty("DeviceInfo")) {
              if (data["Body"]["DeviceInfo"].hasOwnProperty("Serial")) {
                const serial = data["Body"]["DeviceInfo"]["Serial"];
                this.#connectedDevice = { serial, address };
                this.#onDeviceConnected?.(serial, address);
              }
            } else if (data["Body"].hasOwnProperty("Serial")) {
              const serial = data["Body"]["Serial"];
              this.#connectedDevice = { serial, address };
              this.#onDeviceConnected?.(serial, address);
            }
          }
        } else if (data["Method"] === "DEL") {
          if (data["Body"].hasOwnProperty("Serial")) {
            this.#connectedDevice = undefined;
            this.#onDeviceDisconnected?.(data["Body"]["Serial"]);
          }
        }
      },
      (error) => {
        console.error("MDS subscribe error", error);
        if (this.#connectedDevicesSubscription) {
          this.unsubscribe(this.#connectedDevicesSubscription);
        }
        this.#subscribedToConnectedDevices = false;
      },
    );
  }

  #handleNewNotification(e: Event & { notification: string; key: string }) {
    this.#callbacks[e.key]?.success?.(e.notification);
  }

  /**
   * Cannot put an Error in WritableMap on Android so sending the message instead
   */
  #handleNewNotificationError(
    e: Event & { error?: Error; message?: string; key: string },
  ) {
    console.error("handleNewNotificationError", e);
    this.#callbacks[e.key]?.error?.(e.error ?? new Error(e.message));
  }

  #connectedDevice:
    | {
        serial: string;
        address: string;
      }
    | undefined;

  setHandlers(
    deviceConnected: OnDeviceConnected,
    deviceDisconnected: OnDeviceDisconnected,
  ) {
    this.#onDeviceConnected = deviceConnected;
    if (this.#connectedDevice) {
      deviceConnected(
        this.#connectedDevice.serial,
        this.#connectedDevice.address,
      );
    }
    this.#onDeviceDisconnected = deviceDisconnected;
    if (!this.#subscribedToConnectedDevices) {
      this.#subscribedToConnectedDevices = true;
      this.#subscribeToConnectedDevices();
    }
  }

  connect(address: string) {
    ExpoMdsModule.connect(address);
  }

  disconnect(address: string) {
    ExpoMdsModule.disconnect(address);
  }

  get(uri: string, contract: Record<string, unknown> = {}): Promise<string> {
    return ExpoMdsModule.get(
      URI_PREFIX + uri,
      Platform.OS === "android" ? JSON.stringify(contract) : contract,
    );
  }

  put(uri: string, contract: Record<string, unknown> = {}): Promise<string> {
    return ExpoMdsModule.put(
      URI_PREFIX + uri,
      Platform.OS === "android" ? JSON.stringify(contract) : contract,
    );
  }

  post(uri: string, contract: Record<string, unknown> = {}): Promise<string> {
    return ExpoMdsModule.post(
      URI_PREFIX + uri,
      Platform.OS === "android" ? JSON.stringify(contract) : contract,
    );
  }

  delete(uri: string, contract: Record<string, unknown> = {}): Promise<string> {
    return ExpoMdsModule.delete(
      URI_PREFIX + uri,
      Platform.OS === "android" ? JSON.stringify(contract) : contract,
    );
  }

  subscribe(
    uri: string,
    responseCb: (response: string) => void,
    errorCb: (error: Error) => void,
    contract: Record<string, unknown> = {},
  ) {
    this.#subsKey++;
    const subsKeyStr = this.#subsKey.toString();
    this.#callbacks[subsKeyStr] = {
      success: responseCb,
      error: errorCb,
      uri,
    };

    // should probably be eventListeners for both error and success
    if (Platform.OS === "android") {
      contract["Uri"] = uri;
      ExpoMdsModule.subscribe(
        "suunto://MDS/EventListener",
        JSON.stringify(contract),
        subsKeyStr,
      );
    } else {
      ExpoMdsModule.subscribe(URI_PREFIX + uri, contract, subsKeyStr);
    }

    return subsKeyStr;
  }

  unsubscribe(key: string) {
    if (Platform.OS === "ios") {
      const uri = this.#callbacks[key].uri;
      delete this.#callbacks[key];

      const stillHasCallbacks = Object.values(this.#callbacks).some((k) => {
        return k.uri === uri;
      });

      if (!stillHasCallbacks) {
        ExpoMdsModule.unsubscribe(uri);
      }

      return true;
    } else {
      ExpoMdsModule.unsubscribe(key);
      delete this.#callbacks[key];
      return true;
    }
  }
}

export default new MDSImpl();
