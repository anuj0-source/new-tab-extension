const fs = require('fs');
const buf = fs.readFileSync('dog.glb');
// GLB Header: magic (4), version (4), length (4)
// Chunk 0: length (4), type (4)
const chunk0Length = buf.readUInt32LE(12);
const chunk0Type = buf.toString('utf8', 16, 20);
if (chunk0Type === 'JSON') {
  const jsonStr = buf.toString('utf8', 20, 20 + chunk0Length);
  const json = JSON.parse(jsonStr);
  const anims = json.animations || [];
  console.log('Animations:', anims.map(a => a.name));
} else {
  console.log('No JSON chunk found.');
}
