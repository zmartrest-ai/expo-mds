import { StyleSheet, Text, View } from 'react-native';

import * as ExpoMds from 'expo-mds';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>{ExpoMds.hello()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
