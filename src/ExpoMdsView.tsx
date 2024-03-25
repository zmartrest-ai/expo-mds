import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';

import { ExpoMdsViewProps } from './ExpoMds.types';

const NativeView: React.ComponentType<ExpoMdsViewProps> =
  requireNativeViewManager('ExpoMds');

export default function ExpoMdsView(props: ExpoMdsViewProps) {
  return <NativeView {...props} />;
}
