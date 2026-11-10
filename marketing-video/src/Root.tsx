import React from 'react';
import { Composition } from 'remotion';
import { AgroPlannerPromo } from './AgroPlannerPromo';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="AgroPlannerPromo"
        component={AgroPlannerPromo}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
};

