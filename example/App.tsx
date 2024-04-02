import * as IntentLauncher from "expo-intent-launcher";
import MDS from "expo-mds";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AsyncStorage,
  Button,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  useColorScheme,
} from "react-native";

type ScanDevice = { name: string; address: string };
type ConnectedDevice = { name: string; address: string; serial: string };

let liveSince: Date | null = null;
let liveLast: Date | null = null;
let dataPoints = 0;

const App = () => {
  const isDarkMode = useColorScheme() === "dark";
  const [devices, setDevices] = useState<ScanDevice[]>([]);
  const connectingToDevice = useRef<ScanDevice | null>(null);
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
    IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      { packageName: "expo.modules.mds.example" }
    );
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem("LAST_SESSION").then((v) => {
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
    MDS.scan((name: string, address: string) => {
      console.log("HELLO", { name, address });
      if (name?.includes("Movesense")) {
        setDevices((prev) => {
          if (prev.find((d) => d.address === address)) {
            return prev;
          }
          return [...prev, { name, address }];
        });
      }
    });
  }, []);

  const stopScan = useCallback(() => {
    console.log("stop scan");
    setScanning(false);
    if (!scanning) {
      MDS.stopScan();
    }
  }, [scanning]);

  useEffect(() => {
    MDS.setHandlers(
      (serial: string, address: string) => {
        console.log("setDeviceConnected", { serial, address });
        setDeviceConnected({
          serial,
          address: address ?? connectingToDevice.current?.address,
          name: address ?? connectingToDevice.current?.name,
        });
      },
      (serial: string) => {
        console.log("disconnected", serial);
        setDeviceConnected(null);
      }
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
          void AsyncStorage.setItem(
            "LAST_SESSION",
            JSON.stringify({
              liveSince: liveSince?.valueOf(),
              liveLast: liveLast?.valueOf(),
              dataPoints,
            })
          );
        },
        (e: Error) => {
          console.error(e);
          setError("message" in e ? e.message : e);
          void AsyncStorage.setItem(
            "LAST_SESSION",
            JSON.stringify({
              liveSince: liveSince?.valueOf(),
              liveLast: liveLast?.valueOf(),
              dataPoints,
              error,
            })
          );
        }
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
              if (deviceConnected) {
                const address = deviceConnected?.address?.replace(/-/g, ":");
                if (address) {
                  console.log("address", address);
                  MDS.disconnect(address);
                }
              }
            }}
          />
        ) : (
          devices.map((d) => {
            return (
              <Button
                key={d.address}
                title={"Connect to " + d.name}
                onPress={() => {
                  if (deviceConnected === null) {
                    console.log("connecting", d.address);
                    connectingToDevice.current = d;
                    MDS.connect(d.address);
                  } else {
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

        <Button
          title="Battery optimization settings"
          onPress={() =>
            IntentLauncher.startActivityAsync(
              IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
            )
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export default App;
