import { EventEmitter, Subscription } from "expo-modules-core";
import { DeviceEventEmitter, Platform } from "react-native";

import ReactMds from "./RNMds";

const URI_PREFIX = "suunto://";

type OnDeviceConnected = (serial: string, address: string) => void;
type OnDeviceDiscovered = (name: string, address: string) => void;

const mdsEmitter = new EventEmitter(ReactMds);

interface Response {
  Body: ConnectionBody | HRBody;
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

interface DeviceInfo {
  Description: string;
  Mode: number;
  Name: string;
  Serial: string;
  SwVersion: string;
  additionalVersionInfo?: any;
  addressInfo: unknown[];
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

class MDSImpl {
  subsKey: number;
  callbacks: Record<
    string,
    {
      success: (notification: string) => void;
      error: (error: Error) => void;
      uri: string;
    }
  >;
  mdsEmitter: null | EventEmitter | boolean;
  subscribedToConnectedDevices: boolean;
  connectedDevicesSubscription: string | undefined;
  onDeviceConnected: OnDeviceConnected | undefined;
  onDeviceDisconnected: OnDeviceConnected | undefined;
  onNewScannedDevice: OnDeviceDiscovered | undefined;
  scanSubscription: Subscription | undefined;
  newNotificationSubscription: Subscription | undefined;
  newNotificationErrorSubscription: Subscription | undefined;

  constructor() {
    this.subsKey = 0;
    this.callbacks = {};
    this.mdsEmitter = null;
    this.subscribedToConnectedDevices = false;
    this.connectedDevicesSubscription = undefined;
    if (Platform.OS === "android") {
      DeviceEventEmitter.addListener(
        "newScannedDevice",
        this.handleNewScannedDevice.bind(this)
      );
      DeviceEventEmitter.addListener(
        "newNotification",
        this.handleNewNotification.bind(this)
      );
      DeviceEventEmitter.addListener(
        "newNotificationError",
        this.handleNewNotificationError.bind(this)
      );
      this.mdsEmitter = true;
    } else {
      this.scanSubscription = mdsEmitter.addListener(
        "newScannedDevice",
        this.handleNewScannedDevice.bind(this)
      );
      this.newNotificationSubscription = mdsEmitter.addListener(
        "newNotification",
        this.handleNewNotification.bind(this)
      );
      this.newNotificationErrorSubscription = mdsEmitter.addListener(
        "newNotificationError",
        this.handleNewNotificationError.bind(this)
      );
      this.mdsEmitter = mdsEmitter;
    }
  }

  subscribeToConnectedDevices() {
    this.subscribedToConnectedDevices = true;
    this.connectedDevicesSubscription = this.subscribe(
      "",
      "MDS/ConnectedDevices",
      {},
      (notification) => {
        // console.log("connectedDevices", notification);
        const data = JSON.parse(notification) as Response;
        const address = data["Body"]["Connection"]?.["UUID"];
        if (data["Method"] == "POST") {
          if (data.hasOwnProperty("Body")) {
            if (data["Body"].hasOwnProperty("DeviceInfo")) {
              if (data["Body"]["DeviceInfo"].hasOwnProperty("Serial")) {
                const serial = data["Body"]["DeviceInfo"]["Serial"];
                this.connectedDevice = { serial, address };
                this.onDeviceConnected?.(serial, address);
              }
            } else if (data["Body"].hasOwnProperty("Serial")) {
              const serial = data["Body"]["Serial"];
              this.connectedDevice = { serial, address };
              this.onDeviceConnected?.(serial, address);
            }
          }
        } else if (data["Method"] == "DEL") {
          if (data["Body"].hasOwnProperty("Serial")) {
            this.connectedDevice = undefined;
            this.onDeviceDisconnected?.(data["Body"]["Serial"], address);
          }
        }
      },
      (error) => {
        console.log("MDS subscribe error", error);
        if (this.connectedDevicesSubscription) {
          this.unsubscribe(this.connectedDevicesSubscription);
        }
        this.subscribedToConnectedDevices = false;
      }
    );
  }

  handleNewScannedDevice(e: Event & { name: string; address: string }) {
    console.log("handleNewScannedDevice", e);
    console.log("callback to call", this.onNewScannedDevice);
    this.onNewScannedDevice?.(e.name, e.address);
  }

  handleNewNotification(e: Event & { notification: string; key: string }) {
    console.log("handleNewNotification", e);
    this.callbacks[e.key]?.success?.(e.notification);
  }

  handleNewNotificationError(e: Event & { error: Error; key: string }) {
    console.log("handleNewNotificationError", e);
    this.callbacks[e.key]?.error?.(e.error);
  }

  scan(scanHandler: OnDeviceDiscovered) {
    this.onNewScannedDevice = scanHandler;
    ReactMds.scan();
  }

  stopScan() {
    ReactMds.stopScan();
  }

  connectedDevice:
    | {
        serial: string;
        address: string;
      }
    | undefined;

  setHandlers(
    deviceConnected: OnDeviceConnected,
    deviceDisconnected: OnDeviceConnected
  ) {
    this.onDeviceConnected = deviceConnected;
    if (this.connectedDevice) {
      deviceConnected(
        this.connectedDevice.serial,
        this.connectedDevice.address
      );
    }
    this.onDeviceDisconnected = deviceDisconnected;
    if (!this.subscribedToConnectedDevices) {
      this.subscribedToConnectedDevices = true;
      this.subscribeToConnectedDevices();
    }
  }

  connect(address: string) {
    ReactMds.connect(address);
  }

  disconnect(address: string) {
    ReactMds.disconnect(address);
  }

  get(
    serial: string,
    uri: string,
    contract: Record<string, unknown>,
    responseCb,
    errorCb
  ) {
    if (
      serial == undefined ||
      uri == undefined ||
      contract == undefined ||
      responseCb == undefined ||
      errorCb == undefined
    ) {
      console.log("MDS get() missing argument(s).");
      return false;
    }
    if (Platform.OS === "android") {
      ReactMds.get(
        URI_PREFIX + serial + uri,
        JSON.stringify(contract),
        responseCb,
        errorCb
      );
    } else {
      ReactMds.get(
        URI_PREFIX + serial + uri,
        contract,
        (err, r) => responseCb(r),
        (err, r) => errorCb(r)
      );
    }
    return true;
  }

  put(
    serial: string,
    uri: string,
    contract: Record<string, unknown>,
    responseCb,
    errorCb
  ) {
    if (
      serial == undefined ||
      uri == undefined ||
      contract == undefined ||
      responseCb == undefined ||
      errorCb == undefined
    ) {
      console.log("MDS put() missing argument(s).");
      return false;
    }

    if (Platform.OS === "android") {
      ReactMds.put(
        URI_PREFIX + serial + uri,
        JSON.stringify(contract),
        (err, r) => responseCb(r),
        (err, r) => errorCb(r)
      );
    } else {
      ReactMds.put(URI_PREFIX + serial + uri, contract, responseCb, errorCb);
    }
  }

  post(
    serial: string,
    uri: string,
    contract: Record<string, unknown>,
    responseCb,
    errorCb
  ) {
    if (
      serial == undefined ||
      uri == undefined ||
      contract == undefined ||
      responseCb == undefined ||
      errorCb == undefined
    ) {
      console.log("MDS post() missing argument(s).");
      return false;
    }

    if (Platform.OS === "android") {
      ReactMds.post(
        URI_PREFIX + serial + uri,
        JSON.stringify(contract),
        responseCb,
        errorCb
      );
    } else {
      ReactMds.post(URI_PREFIX + serial + uri, contract, responseCb, errorCb);
    }
  }

  delete(
    serial: string,
    uri: string,
    contract: Record<string, unknown>,
    responseCb,
    errorCb
  ) {
    if (
      serial == undefined ||
      uri == undefined ||
      contract == undefined ||
      responseCb == undefined ||
      errorCb == undefined
    ) {
      console.log("MDS delete() missing argument(s).");
      return false;
    }

    if (Platform.OS === "android") {
      ReactMds.delete(
        URI_PREFIX + serial + uri,
        JSON.stringify(contract),
        responseCb,
        errorCb
      );
    } else {
      ReactMds.delete(URI_PREFIX + serial + uri, contract, responseCb, errorCb);
    }
  }

  subscribe(
    serial: string,
    uri: string,
    contract: Record<string, unknown>,
    responseCb,
    errorCb
  ) {
    console.log("SUBSCRIBE JS SIDE");
    if (
      serial == undefined ||
      uri == undefined ||
      contract == undefined ||
      responseCb == undefined ||
      errorCb == undefined
    ) {
      console.log("MDS subscribe() missing argument(s).");
      return undefined;
    }

    this.subsKey++;
    const subsKeyStr = this.subsKey.toString();
    this.callbacks[subsKeyStr] = {
      success: responseCb,
      error: errorCb,
      uri,
    };

    // const key = serial + uri + JSON.stringify(contract);

    // should probably be eventListeners for both error and success
    if (Platform.OS === "android") {
      contract["Uri"] = serial + uri;
      ReactMds.subscribe(
        "suunto://MDS/EventListener",
        JSON.stringify(contract),
        subsKeyStr
      );
    } else {
      ReactMds.subscribe(URI_PREFIX + serial + uri, contract, subsKeyStr);
    }

    return subsKeyStr;
  }

  unsubscribe(key: string) {
    const uri = this.callbacks[key].uri;
    delete this.callbacks[key];

    const stillHasCallbacks = Object.values(this.callbacks).some((k) => {
      return k.uri === uri;
    });

    if (!stillHasCallbacks) {
      ReactMds.unsubscribe(key);
    }

    return true;
  }
}

export default new MDSImpl();
