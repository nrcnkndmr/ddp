import React, { createContext, useState } from 'react';

export const PhotoContext = createContext();

export function PhotoProvider({ children }) {
  const [latestPhoto, setLatestPhoto] = useState(null);
  return (
    <PhotoContext.Provider value={{ latestPhoto, setLatestPhoto }}>
      {children}
    </PhotoContext.Provider>
  );
}

export default PhotoProvider;
