import test from 'node:test';
import assert from 'node:assert/strict';
import { blocksCityView } from '../src/bangkok/cityVisibility.ts';

test('the Sukhumvit foreground shop is cut away, while buildings behind the party remain',()=>{
 const camera={x:-35,y:8,z:28.5},hero={x:-41,y:1.4,z:16.5};
 assert(blocksCityView({min:{x:-39,y:0,z:20},max:{x:-33,y:9,z:23}},camera,hero));
 assert(!blocksCityView({min:{x:-43,y:0,z:6},max:{x:-38,y:9,z:9}},camera,hero));
 assert(!blocksCityView({min:{x:-39,y:0,z:31},max:{x:-33,y:9,z:35}},camera,hero));
});
test('a park roof blocks the view but a low floor and a tree beside the sightline do not',()=>{
 const camera={x:-18,y:8,z:36},hero={x:-25,y:1.4,z:25};
 assert(blocksCityView({min:{x:-27,y:2.3,z:22.5},max:{x:-22,y:3.5,z:27.5}},camera,hero));
 assert(!blocksCityView({min:{x:-27,y:0,z:22.5},max:{x:-22,y:.2,z:27.5}},camera,hero));
 assert(!blocksCityView({min:{x:-30,y:0,z:24},max:{x:-28,y:7,z:26}},camera,hero));
});
