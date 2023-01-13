import { EventEmitter, Subscription } from "expo-modules-core";
import {
  DeviceEventEmitter,
  EmitterSubscription,
  Platform,
} from "react-native";

import ReactMds from "./RNMds";

const URI_PREFIX = "suunto://";

type OnDeviceConnected = (serial: string) => void;
type OnDeviceDiscovered = (name: string, address: string) => void;

class MDSImpl {
  subsKey: number;
  subsKeys: unknown[];
  subsSuccessCbs: ((notification: string) => void)[];
  subsErrorCbs: ((error: Error) => void)[];
  mdsEmitter: null | EventEmitter | boolean;
  subscribedToConnectedDevices: boolean;
  connectedDevicesSubscription: number;
  onDeviceConnected: OnDeviceConnected | undefined;
  onDeviceDisconnected: OnDeviceConnected | undefined;
  onNewScannedDevice: OnDeviceDiscovered | undefined;
  scanSubscription: Subscription | undefined;
  newNotificationSubscription: Subscription | undefined;
  newNotificationErrorSubscription: Subscription | undefined;

  constructor() {
    this.subsKey = 0;
    this.subsKeys = [];
    this.subsSuccessCbs = [];
    this.subsErrorCbs = [];
    this.mdsEmitter = null;
    this.subscribedToConnectedDevices = false;
    this.connectedDevicesSubscription = -1;
  }

  getIdxFromKey(key: string) {
    let idx = -1;
    for (let i = 0; i < this.subsKeys.length; i++) {
      if (this.subsKeys[i] == key) {
        idx = i;
        break;
      }
    }
    return idx;
  }

  subscribeToConnectedDevices() {
    this.subscribedToConnectedDevices = true;
    this.connectedDevicesSubscription = this.subscribe(
      "",
      "MDS/ConnectedDevices",
      {},
      (notification) => {
        const data = JSON.parse(notification);
        if (data["Method"] == "POST") {
          if (data.hasOwnProperty("Body")) {
            if (data["Body"].hasOwnProperty("DeviceInfo")) {
              if (data["Body"]["DeviceInfo"].hasOwnProperty("Serial")) {
                this.onDeviceConnected?.(data["Body"]["DeviceInfo"]["Serial"]);
              }
            } else if (data["Body"].hasOwnProperty("Serial")) {
              this.onDeviceConnected?.(data["Body"]["Serial"]);
            }
          }
        } else if (data["Method"] == "DEL") {
          if (data["Body"].hasOwnProperty("Serial")) {
            this.onDeviceDisconnected?.(data["Body"]["Serial"]);
          }
        }
      },
      (error) => {
        console.log("MDS subscribe error");
        this.unsubscribe(this.connectedDevicesSubscription);
        this.subscribedToConnectedDevices = false;
      }
    );
  }

  initMdsEmitter() {
    if (this.mdsEmitter) {
      return;
    }

    if (Platform.OS === "android") {
      DeviceEventEmitter.addListener(
        "newScannedDevice",
        this.handleNewScannedDevice
      );
      DeviceEventEmitter.addListener(
        "newNotification",
        this.handleNewNotification
      );
      DeviceEventEmitter.addListener(
        "newNotificationError",
        this.handleNewNotificationError
      );
      this.mdsEmitter = true;
    } else {
      const mdsEmitter = new EventEmitter(ReactMds);

      this.scanSubscription = mdsEmitter.addListener(
        "newScannedDevice",
        this.handleNewScannedDevice
      );
      this.newNotificationSubscription = mdsEmitter.addListener(
        "newNotification",
        this.handleNewNotification
      );
      this.newNotificationErrorSubscription = mdsEmitter.addListener(
        "newNotificationError",
        this.handleNewNotificationError
      );
      this.mdsEmitter = mdsEmitter;
    }
  }

  handleNewScannedDevice(e: Event & { name: string; address: string }) {
    this.onNewScannedDevice?.(e.name, e.address);
  }

  handleNewNotification(e: Event & { notification: string; key: string }) {
    this.subsSuccessCbs[this.getIdxFromKey(e.key)](e.notification);
  }

  handleNewNotificationError(e: Event & { error: Error; key: string }) {
    this.subsErrorCbs[this.getIdxFromKey(e.key)](e.error);
  }

  scan(scanHandler: OnDeviceDiscovered) {
    this.onNewScannedDevice = scanHandler;
    this.initMdsEmitter();
    ReactMds.scan();
  }

  stopScan() {
    ReactMds.stopScan();
  }

  setHandlers(
    deviceConnected: OnDeviceConnected,
    deviceDisconnected: OnDeviceConnected
  ) {
    this.onDeviceConnected = deviceConnected;
    this.onDeviceDisconnected = deviceDisconnected;
    if (!this.subscribedToConnectedDevices) {
      this.subscribedToConnectedDevices = true;
      this.subscribeToConnectedDevices();
    }
  }

  connect(address: string) {
    this.initMdsEmitter();
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
      return -1;
    }

    // should probably be eventListeners for both error and success
    if (Platform.OS === "android") {
      contract["Uri"] = serial + uri;
      ReactMds.subscribe(
        "suunto://MDS/EventListener",
        JSON.stringify(contract)
      );
    } else {
      ReactMds.subscribe(URI_PREFIX + serial + uri, contract);
    }

    return this.subsKey;
  }

  unsubscribe(key: number) {
    const idx = this.subsKeys.indexOf(key);
    if (idx == -1) {
      return false;
    }

    ReactMds.unsubscribe(key.toString());
    this.subsKeys.splice(idx, 0);
    this.subsSuccessCbs.splice(idx, 0);
    this.subsErrorCbs.splice(idx, 0);
    return true;
  }
}

export default new MDSImpl();
