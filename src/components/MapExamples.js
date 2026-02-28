// Example Usage of Real World Map Data
// This file demonstrates how to use the real geographic SVG path data

import React from 'react';
import { REAL_WORLD_REGIONS } from './RealWorldMapData';
import { getRegionName, getRegionColor, REGION_GROUPS } from './RegionHelpers';

// EXAMPLE 1: Basic Map Rendering
// ---------------------------------
export const BasicMapExample = () => {
  return (
    <Svg width="540" height="340" viewBox="0 0 540 340">
      {Object.entries(REAL_WORLD_REGIONS).map(([regionName, regionData]) => (
        <Path
          key={regionName}
          d={regionData.path}
          fill="#E0E0E0"
          stroke="#FFFFFF"
          strokeWidth="0.5"
        />
      ))}
    </Svg>
  );
};

// EXAMPLE 2: Interactive Map with Touch
// --------------------------------------
export const InteractiveMapExample = () => {
  const [selectedRegion, setSelectedRegion] = React.useState(null);

  return (
    <Svg width="540" height="340" viewBox="0 0 540 340">
      {Object.entries(REAL_WORLD_REGIONS).map(([regionName, regionData]) => (
        <Path
          key={regionName}
          d={regionData.path}
          fill={selectedRegion === regionName ? '#4CAF50' : '#E0E0E0'}
          stroke="#FFFFFF"
          strokeWidth="0.5"
          onPress={() => setSelectedRegion(regionName)}
        />
      ))}
    </Svg>
  );
};

// EXAMPLE 3: Game Map with Owned Regions
// ----------------------------------------
export const GameMapExample = ({ ownedRegions = [] }) => {
  const isOwned = (regionName) => ownedRegions.includes(regionName);

  return (
    <Svg width="540" height="340" viewBox="0 0 540 340">
      {Object.entries(REAL_WORLD_REGIONS).map(([regionName, regionData]) => (
        <Path
          key={regionName}
          d={regionData.path}
          fill={getRegionColor(regionName, isOwned(regionName))}
          stroke="#FFFFFF"
          strokeWidth="0.5"
          opacity={isOwned(regionName) ? 1.0 : 0.5}
        />
      ))}
    </Svg>
  );
};

// EXAMPLE 4: Map with Labels
// ----------------------------
export const MapWithLabelsExample = ({ language = 'en' }) => {
  return (
    <Svg width="540" height="340" viewBox="0 0 540 340">
      {/* Regions */}
      {Object.entries(REAL_WORLD_REGIONS).map(([regionName, regionData]) => (
        <Path
          key={regionName}
          d={regionData.path}
          fill="#E0E0E0"
          stroke="#FFFFFF"
          strokeWidth="0.5"
        />
      ))}
      
      {/* Labels */}
      {Object.entries(REAL_WORLD_REGIONS).map(([regionName, regionData]) => (
        <SvgText
          key={`label-${regionName}`}
          x={regionData.center.x}
          y={regionData.center.y}
          fill="#000000"
          fontSize="8"
          textAnchor="middle"
        >
          {getRegionName(regionName, language)}
        </SvgText>
      ))}
    </Svg>
  );
};

// EXAMPLE 5: Pan and Zoom Map
// -----------------------------
export const PanZoomMapExample = () => {
  const [scale, setScale] = React.useState(1);
  const [translateX, setTranslateX] = React.useState(0);
  const [translateY, setTranslateY] = React.useState(0);

  return (
    <Svg width="540" height="340" viewBox="0 0 540 340">
      <G
        transform={`translate(${translateX}, ${translateY}) scale(${scale})`}
      >
        {Object.entries(REAL_WORLD_REGIONS).map(([regionName, regionData]) => (
          <Path
            key={regionName}
            d={regionData.path}
            fill="#E0E0E0"
            stroke="#FFFFFF"
            strokeWidth={0.5 / scale} // Adjust stroke width for zoom
          />
        ))}
      </G>
    </Svg>
  );
};

// EXAMPLE 6: Filter by Region Group
// -----------------------------------
export const FilteredMapExample = ({ visibleGroups = ['Americas'] }) => {
  const shouldShowRegion = (regionName) => {
    return visibleGroups.some(group => 
      REGION_GROUPS[group]?.includes(regionName)
    );
  };

  return (
    <Svg width="540" height="340" viewBox="0 0 540 340">
      {Object.entries(REAL_WORLD_REGIONS).map(([regionName, regionData]) => (
        <Path
          key={regionName}
          d={regionData.path}
          fill="#E0E0E0"
          stroke="#FFFFFF"
          strokeWidth="0.5"
          opacity={shouldShowRegion(regionName) ? 1.0 : 0.2}
        />
      ))}
    </Svg>
  );
};

// EXAMPLE 7: Animated Region Highlight
// -------------------------------------
export const AnimatedMapExample = ({ highlightedRegion }) => {
  return (
    <Svg width="540" height="340" viewBox="0 0 540 340">
      {Object.entries(REAL_WORLD_REGIONS).map(([regionName, regionData]) => (
        <Path
          key={regionName}
          d={regionData.path}
          fill={highlightedRegion === regionName ? '#FF5722' : '#E0E0E0'}
          stroke="#FFFFFF"
          strokeWidth={highlightedRegion === regionName ? 2 : 0.5}
        />
      ))}
    </Svg>
  );
};

// HELPER: Get Region Statistics
// -------------------------------
export const getRegionStats = () => {
  const regions = Object.keys(REAL_WORLD_REGIONS);
  const stats = {
    totalRegions: regions.length,
    byContinent: {},
  };

  Object.entries(REGION_GROUPS).forEach(([group, groupRegions]) => {
    stats.byContinent[group] = groupRegions.length;
  });

  return stats;
};

// HELPER: Calculate Region Bounding Box
// ---------------------------------------
export const getRegionBounds = (regionName) => {
  const region = REAL_WORLD_REGIONS[regionName];
  if (!region) return null;

  // Parse the path to find min/max coordinates
  const coords = region.path
    .split(/[ML]/)
    .filter(Boolean)
    .map(coord => coord.trim().split(',').map(Number))
    .filter(coord => coord.length === 2 && !isNaN(coord[0]) && !isNaN(coord[1]));

  if (coords.length === 0) return null;

  const xs = coords.map(c => c[0]);
  const ys = coords.map(c => c[1]);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
};

// HELPER: Check if Point is in Region (simplified)
// -------------------------------------------------
export const isPointInRegion = (x, y, regionName) => {
  const bounds = getRegionBounds(regionName);
  if (!bounds) return false;

  return (
    x >= bounds.minX &&
    x <= bounds.maxX &&
    y >= bounds.minY &&
    y <= bounds.maxY
  );
};

// INTEGRATION TIPS:
// ------------------
/*
1. Import the data:
   import { REAL_WORLD_REGIONS } from './RealWorldMapData';

2. Use in your component:
   <Svg viewBox="0 0 540 340">
     {Object.entries(REAL_WORLD_REGIONS).map(([name, data]) => (
       <Path key={name} d={data.path} />
     ))}
   </Svg>

3. Add interactivity:
   - Use onPress on <Path> elements
   - Track selected/owned regions in state
   - Apply different colors/styles based on state

4. Optimize performance:
   - Use React.memo for map components
   - Memoize region calculations
   - Consider using react-native-svg's native driver

5. Enhance visuals:
   - Add gradients for depth
   - Use shadows for 3D effect
   - Animate transitions between states
   - Add glow effects for highlights

6. Accessibility:
   - Add aria labels for regions
   - Support keyboard navigation
   - Provide text alternatives
   - Ensure color contrast

7. Responsive design:
   - Scale viewBox based on screen size
   - Adjust stroke width for zoom levels
   - Use AspectRatio to maintain proportions
*/

export default {
  BasicMapExample,
  InteractiveMapExample,
  GameMapExample,
  MapWithLabelsExample,
  PanZoomMapExample,
  FilteredMapExample,
  AnimatedMapExample,
  getRegionStats,
  getRegionBounds,
  isPointInRegion,
};
