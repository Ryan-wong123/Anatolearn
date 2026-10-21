import test from 'node:test';
import assert from 'node:assert/strict';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { USDLoader } from 'three/addons/loaders/USDLoader.js';
import { zipSync, strToU8 } from 'three/addons/libs/fflate.module.js';
test('OBJ models produce a renderable triangle',()=>{
  const model=new OBJLoader().parse('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
  assert.equal(model.children[0].geometry.getAttribute('position').count,3);
});
test('USDZ archive loads its embedded USDA mesh without external files',()=>{
  const source=`#usda 1.0
def Xform "Root"
{
  def Mesh "Triangle"
  {
    int[] faceVertexCounts = [3]
    int[] faceVertexIndices = [0, 1, 2]
    point3f[] points = [(0, 0, 0), (1, 0, 0), (0, 1, 0)]
  }
}
`;
  const archive=zipSync({'model.usda':strToU8(source)},{level:0});
  const model=new USDLoader().parse(archive.buffer);
  const meshes=[];model.traverse((object)=>{if(object.isMesh)meshes.push(object);});
  assert.equal(meshes.length,1);
  assert.equal(meshes[0].geometry.getAttribute('position').count,3);
});
