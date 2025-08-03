// src/components/Skeleton.js (nouveau fichier pour les skeletons)
import React from 'react';

const Skeleton = ({ className = '', width = '100%', height = '20px' }) => (
  <div className={className} style={{ background: '#ddd', width, height, borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
);

export default Skeleton;
