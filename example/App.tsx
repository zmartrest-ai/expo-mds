import AsyncStorage from "@react-native-async-storage/async-storage";
import MDS from "expo-mds";
import React, { useCallback, useEffect, useState } from "react";
import {
  Button,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  useColorScheme,
  PermissionsAndroid,
  Platform,
} from "react-native";
import { BleManager } from "react-native-ble-plx";
import type { Device } from "react-native-ble-plx";

const bleManager = new BleManager();

/**
 * android  {"address": "0C:8C:DC:3C:EB:07", "serial": "213330002219"}
 * ios      {"address": "586AE521-5B62-147E-7EBC-EE37355CFBB5", "serial": "213330002219"}
 */
type ConnectedDevice = { serial: string; address: string };

let liveSince: Date | null = null;
let liveLast: Date | null = null;
let dataPoints = 0;

const App = () => {
  const isDarkMode = useColorScheme() === "dark";
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanning, setScanning] = useState<boolean>(false);
  const [error, setError] = useState<string>();
  const [deviceConnected, setDeviceConnected] =
    useState<ConnectedDevice | null>(null);
  const [lastSession, setLastSession] = useState<{
    liveSince?: string;
    liveLast?: string;
    dataPoints: number;
    error?: string;
  }>();

  useEffect(() => {
    if (Platform.OS === "android") {
      PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ).then((granted) => {
        if (!granted) {
          PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );
        }
      });
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("LAST_SESSION").then((v) => {
      if (v) {
        const parsed = JSON.parse(v);

        const liveSince = parsed.liveSince ? new Date(parsed.liveSince) : null;
        const liveLast = parsed.liveLast ? new Date(parsed.liveLast) : null;
        const dataPoints = parsed.dataPoints;
        setLastSession({
          liveSince: liveSince?.toLocaleString(),
          liveLast: liveLast?.toLocaleString(),
          dataPoints,
          error,
        });
        setError(parsed.error);
      }
    });
  }, []);

  const [value, setValue] = useState<{
    Uri: string;
    Method: string;
    Body?: { rrData: number[]; average: number };
  } | null>(null);

  const backgroundStyle = {
    backgroundColor: "white",
    flex: 1,
  };

  const startScan = useCallback(() => {
    console.log("start scan");
    setScanning(true);
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error(error);
        return;
      }

      if (device == null) return;

      console.log("HELLO", device.name, device.id);

      if (device?.name?.includes("Movesense")) {
        console.log("Movesense device found", device.name, device.id);
        /* 
        android:
          "id": "0C:8C:DC:3C:EB:07"
          "name": "Movesense 213330002219",
        
        ios:
          "id": "586AE521-5B62-147E-7EBC-EE37355CFBB5",
          "name": "Movesense 213330002219"
        */
        setDevices((prev) => {
          if (prev.find((d) => d.id === device.id)) {
            return prev;
          }
          return [...prev, device];
        });
      }
    });
  }, []);

  const stopScan = useCallback(() => {
    console.log("stop scan");
    setScanning((prev) => {
      if (prev) {
        bleManager.stopDeviceScan();
      }
      return false;
    });
  }, []);

  useEffect(() => {
    MDS.setHandlers(
      (serial: string, address: string) => {
        console.log("setDeviceConnected", { serial, address });
        setDeviceConnected({ serial, address });
      },
      (serial: string) => {
        console.log("disconnected", serial);
        setDeviceConnected(null);
      },
    );
  }, []);

  useEffect(() => {
    if (deviceConnected) {
      stopScan();
      console.log("subscribing");
      const key = MDS.subscribe(
        deviceConnected.serial,
        "/Meas/HR",
        {},
        (notification: string) => {
          console.log("notification", notification);
          if (!liveSince) {
            liveSince = new Date();
          }
          liveLast = new Date();
          dataPoints++;
          setValue(JSON.parse(notification));
          AsyncStorage.setItem(
            "LAST_SESSION",
            JSON.stringify({
              liveSince: liveSince?.valueOf(),
              liveLast: liveLast?.valueOf(),
              dataPoints,
            }),
          );
        },
        (e: Error) => {
          console.error(e);
          setError("message" in e ? e.message : e);
          AsyncStorage.setItem(
            "LAST_SESSION",
            JSON.stringify({
              liveSince: liveSince?.valueOf(),
              liveLast: liveLast?.valueOf(),
              dataPoints,
              error,
            }),
          );
        },
      );

      return () => {
        if (key) {
          MDS.unsubscribe(key);
        }
      };
    }
  }, [deviceConnected, stopScan]);

  console.log("value", value);

  return (
    <SafeAreaView style={{ ...backgroundStyle, margin: 20 }}>
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={backgroundStyle}
      >
        <Text style={{ color: "black" }}>
          {value?.Body ? Math.round(value.Body.average) : "-"} bpm
        </Text>
        {liveSince ? (
          <Text style={{ color: "black" }}>
            {"First value received at " + liveSince.toLocaleString()}
          </Text>
        ) : null}

        {liveSince ? (
          <Text style={{ color: "black" }}>
            {"Last value received at " + liveLast?.toLocaleString()}
          </Text>
        ) : null}
        {liveSince && liveLast ? (
          <Text style={{ color: "black" }}>
            {"Minutes alive " +
              (liveLast.valueOf() - liveSince.valueOf()) / (1000 * 60)}
          </Text>
        ) : null}
        {liveSince && liveLast ? (
          <Text style={{ color: "black" }}>
            {"Number of datapoints " + dataPoints}
          </Text>
        ) : null}

        {error ? <Text style={{ color: "black" }}>{error}</Text> : null}
        {!deviceConnected ? (
          <Button
            title={scanning ? "Stop scan" : "Start scan"}
            onPress={scanning ? stopScan : startScan}
          />
        ) : null}
        {deviceConnected ? (
          <Button
            title="Disconnect"
            onPress={() => {
              console.log("disconnect", deviceConnected);
              MDS.disconnect(deviceConnected.address);
            }}
          />
        ) : (
          devices.map((d) => {
            return (
              <Button
                key={d.id}
                title={"Connect to " + d.name}
                onPress={() => {
                  if (deviceConnected === null) {
                    console.log("connecting", d.name, d.id);
                    MDS.connect(d.id);
                  }
                }}
              />
            );
          })
        )}
        {lastSession ? (
          <Text style={{ color: "black" }}>
            {"Last session: " + JSON.stringify(lastSession, null, 2)}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

export default App;
