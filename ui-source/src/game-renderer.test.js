import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createGameRenderer} from './game-renderer.js';

test('software graphics keeps colored ground visible when its triangles cross behind the camera',()=>{
 const paints=[],ctx={fillRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){paints.push(this.fillStyle);}},canvas={getContext:type=>type==='2d'?ctx:null};
 const renderer=createGameRenderer(canvas,'light'),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(65,1.6,.1,100);
 camera.position.set(0,2,0);camera.lookAt(0,0,-5);
 const geometry=new THREE.PlaneGeometry(40,40);geometry.rotateX(-Math.PI/2);
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(Array.from({length:4},()=>[.1,.6,.2]).flat(),3));
 const material=new THREE.MeshBasicMaterial({color:'#ffffff',vertexColors:true});scene.add(new THREE.Mesh(geometry,material));
 renderer.render(scene,camera);assert.ok(paints.length>0,'ground reaches the foreground instead of disappearing');
 for(const paint of paints){const values=paint.match(/\d+/g).map(Number);assert.ok(values[1]>values[0]&&values[1]>values[2],'terrain retains its green vertex colors');}
 geometry.dispose();material.dispose();renderer.dispose();
});
