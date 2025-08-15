// CustomIcon.js
import L from 'leaflet';

export function generateCustomIcon(user) {
  const canvas = document.createElement('canvas');
  canvas.width = 50;
  canvas.height = 50;
  const ctx = canvas.getContext('2d');

  // Randomly decide between avatar or car for demonstration; in real use, base on user.type
  const isAvatar = Math.random() > 0.5;

  if (isAvatar) {
    // Draw simple avatar: circle with initial
    ctx.fillStyle = 'blue';
    ctx.beginPath();
    ctx.arc(25, 25, 25, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(user.name ? user.name[0].toUpperCase() : 'U', 25, 25);
  } else {
    // Draw car with different versions
    const version = Math.floor(Math.random() * 3) + 1; // Versions 1, 2, or 3
    let color = 'gray';
    if (version === 1) color = 'red';
    else if (version === 2) color = 'green';
    else color = 'blue';

    // Car body
    ctx.fillStyle = color;
    ctx.fillRect(10, 20, 30, 10);

    // Wheels
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(15, 30, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(35, 30, 5, 0, 2 * Math.PI);
    ctx.fill();

    // Version-specific additions
    if (version >= 2) {
      // Add roof for version 2+
      ctx.fillStyle = color;
      ctx.fillRect(15, 15, 20, 5);
    }
    if (version === 3) {
      // Add spoiler for version 3
      ctx.fillStyle = color;
      ctx.fillRect(40, 20, 5, 5);
    }
  }

  const url = canvas.toDataURL();
  return L.icon({
    iconUrl: url,
    iconSize: [50, 50],
    iconAnchor: [25, 50],
    popupAnchor: [0, -50],
  });
}
