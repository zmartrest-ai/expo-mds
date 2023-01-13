import MDS from "expo-mds";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
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
  const [error, setError] = useState<string>(null);
  const [deviceConnected, setDeviceConnected] =
    useState<ConnectedDevice | null>(null);
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
      console.log({ name, address });
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
      (serial: string) => {
        setDeviceConnected({
          serial,
          address: connectingToDevice.current!.address,
          name: connectingToDevice.current!.name,
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
        },
        (e: Error) => {
          console.error(e);
          setError("message" in e ? e.message : e);
        }
      );

      return () => {
        MDS.unsubscribe(key);
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
            {"First value received at " + liveSince}
          </Text>
        ) : null}
        {liveSince ? (
          <Text style={{ color: "black" }}>
            {"Last value received at " + liveLast}
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
      </ScrollView>
    </SafeAreaView>
  );
};

export default App;
