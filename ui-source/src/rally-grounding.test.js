import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RALLY_COURSES} from './game-mechanics.js';
import {rallyRoad,rallySample,rallyProject,rallySurfaceHeight,rallySurfacePose,newRallyRace,rallyStep} from './racing-mechanics.js';
import {rallyTerrain,rallyGroundHeight} from './rally-terrain.js';
import {rallyEmbankment,rallyRibbon,rallyCarSurfacePose,buildRallyCar} from './games-rally.js';

test('touching either road edge preserves speed instead of clamping to 11 m/s',()=>{
 const course={...RALLY_COURSES[0],heights:RALLY_COURSES[0].heights.map(()=>0)};
 for(const side of [-1,1]){
  const road=rallyRoad(course),race=newRallyRace(road),p=race.player;race.opponents=[];
  Object.assign(p,rallySample(road,120,side*(road.width/2+.15)),{speed:35,previous:120,travel:120});rallySurfacePose(road,p);
  rallyStep(race,road,{up:true},.1);assert.ok(p.speed>35.6,'edge contact does not erase momentum');
  const before=p.speed;rallyStep(race,road,{down:true},1/60);assert.ok(p.speed<before&&p.speed>before-.5,'braking remains gradual and under player control');
 }
});

test('off-road cars follow a lower sloping ground plane and return to asphalt height',()=>{
 const road=rallyRoad(RALLY_COURSES[2]);road.groundHeight=(x,z)=>-20+x*.12-z*.07;
 const p={x:300,z:300,heading:.6};rallySurfacePose(road,p);
 assert.equal(p.offRoad,true);assert.ok(Math.abs(p.y-road.groundHeight(p.x,p.z))<.0001);
 assert.ok(Math.abs(p.grade-(.12*Math.cos(p.heading)-.07*Math.sin(p.heading)))<.0001);
 assert.ok(Math.abs(p.crossGrade-(-.12*Math.sin(p.heading)-.07*Math.cos(p.heading)))<.0001);
 Object.assign(p,rallySample(road,road.length*.3));rallySurfacePose(road,p);assert.equal(p.offRoad,false);assert.ok(Math.abs(p.y-rallyProject(road,p.x,p.z).y)<.0001);
});

test('all track embankments meet the verge and reach the rendered ground in both qualities',()=>{
 for(const high of [false,true])for(const course of RALLY_COURSES){
  const road=rallyRoad(course),ground=rallyTerrain(course,road,high);road.groundHeight=(x,z)=>rallyGroundHeight(ground,x,z);
  for(const side of [-1,1]){
   const geo=rallyEmbankment(road,side),p=geo.attributes.position,ribbon=rallyRibbon(road,side*(road.width/2+3),side*(road.width/2+3)),v=ribbon.attributes.position;
   for(let i=0;i<=road.points.length;i++){
    const inner=i*7,outer=inner+6;
    assert.ok(Math.hypot(p.getX(inner)-v.getX(i*2),p.getZ(inner)-v.getZ(i*2))<.001,'no horizontal gap at the verge');
    const x=p.getX(outer),z=p.getZ(outer),nearest=rallyProject(road,x,z);
    // At tight hairpins the outer shoulder can meet the neighboring road's
    // shoulder; otherwise its outer edge must end on the ground.
    if(nearest.distance>road.width/2+8.99)assert.ok(Math.abs(p.getY(outer)-road.groundHeight(x,z))<.015,'embankment rests on terrain');
   }
   for(const value of p.array)assert.ok(Number.isFinite(value));
   const normals=geo.attributes.normal;for(let i=0;i<normals.count;i++)assert.ok(normals.getY(i)>0,'shoulder faces upward');
   ribbon.dispose();geo.dispose();
  }ground.dispose();
 }
});

test('rendered tire contacts stay on a side slope in both car models',()=>{
 const road=rallyRoad(RALLY_COURSES[0]);road.groundHeight=(x,z)=>-10+x*.15+z*.1;
 for(const high of [false,true]){
  const parent=new THREE.Group(),geometries=[],materials=[],mat=color=>{const m=new THREE.MeshStandardMaterial({color});materials.push(m);return m;},mesh=(g,m,x=0,y=0,z=0,group=parent)=>{geometries.push(g);const node=new THREE.Mesh(g,m);node.position.set(x,y,z);group.add(node);return node;};
  const car=buildRallyCar({high,paint:mat('#ff0000'),mesh,mat,parent}),p={...rallySample(road,140,60),heading:.4,speed:30};rallySurfacePose(road,p);rallyCarSurfacePose(car,p,road);parent.updateMatrixWorld(true);
  for(const wheel of car.wheels){const axle=wheel.steering,contact=parent.localToWorld(new THREE.Vector3(axle.position.x,axle.position.y-.375,axle.position.z));assert.ok(Math.abs(contact.y-rallySurfaceHeight(road,contact.x,contact.z))<.04,'tires meet the visible sloping surface');}
  for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
 }
});

test('fast off-road travel still cannot award shortcut checkpoints',()=>{
 const road=rallyRoad(RALLY_COURSES[0]),race=newRallyRace(road);race.opponents=[];
 Object.assign(race.player,rallySample(road,road.length/12,40),{speed:38,travel:road.length/12,previous:road.length/12,gates:0});
 rallyStep(race,road,{up:true},.1);assert.equal(race.player.offRoad,true);assert.equal(race.player.gates,0);
});

test('off-road top speed eases down slightly and normal acceleration returns on asphalt',()=>{
 const course={...RALLY_COURSES[0],heights:RALLY_COURSES[0].heights.map(()=>0)},road=rallyRoad(course),race=newRallyRace(road),p=race.player;race.opponents=[];road.groundHeight=()=>0;
 Object.assign(p,{x:1000,z:1000,heading:0,speed:42,grade:0});rallySurfacePose(road,p);
 rallyStep(race,road,{up:true},1/60);assert.ok(p.speed<42&&p.speed>41.7,'first contact keeps momentum');
 for(let i=1;i<120;i++)rallyStep(race,road,{up:true},1/60);
 assert.ok(p.speed>38.5&&p.speed<40,'two seconds off-road produces a small, gradual slowdown');
 for(let i=0;i<360;i++)rallyStep(race,road,{up:true},1/60);
 assert.ok(p.speed>=37.4&&p.speed<=37.6,'full-throttle off-road speed stays only a little lower');
 Object.assign(p,rallySample(road,120));rallySurfacePose(road,p);
 for(let i=0;i<30;i++)rallyStep(race,road,{up:true},1/60);
 assert.ok(p.speed>41,'returning to asphalt restores normal acceleration');
});

test('off-road coasting has a mild extra resistance in forward and reverse',()=>{
 const course={...RALLY_COURSES[0],heights:RALLY_COURSES[0].heights.map(()=>0)};
 for(const speed of [30,-8]){
  const speeds=[];
  for(const offRoad of [false,true]){
   const road=rallyRoad(course),race=newRallyRace(road),p=race.player;race.opponents=[];road.groundHeight=()=>0;
   Object.assign(p,offRoad?{x:1000,z:1000,heading:0,grade:0}:rallySample(road,120),{speed});rallySurfacePose(road,p);
   for(let i=0;i<60;i++)rallyStep(race,road,{},1/60);
   speeds.push(Math.abs(p.speed));
  }
  assert.ok(speeds[1]<speeds[0],'grass adds some rolling resistance');
  assert.ok(speeds[0]-speeds[1]<2,'the extra slowdown remains gentle');
 }
});
