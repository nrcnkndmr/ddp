import React, { createContext, useState } from 'react';

export const RollingContext = createContext();

export function RollingProvider({ children }) {
  const [isRolling, setIsRolling] = useState(false);

  return (
    <RollingContext.Provider value={{ isRolling, setIsRolling }}>
      {children}
    </RollingContext.Provider>
  );
}
