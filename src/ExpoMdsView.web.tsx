import * as React from 'react';

import { ExpoMdsViewProps } from './ExpoMds.types';

export default function ExpoMdsView(props: ExpoMdsViewProps) {
  return (
    <div>
      <span>{props.name}</span>
    </div>
  );
}
