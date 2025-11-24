import * as BABYLON from 'babylonjs';
import { BabylonTilesRenderer } from '../src/index.js';
import { CesiumIonAuthPlugin } from '3d-tiles-renderer/plugins';
import GUI from 'lil-gui';

// Cesium ion default demo token from https://github.com/CesiumGS/cesium/blob/main/packages/engine/Source/Core/Ion.js
const GOOGLE_TILES_ASSET_ID = 2275207;
const ION_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhN2VkNDM5ZS1jMDk0LTQ3NDItOTM5ZS00MzU3M2M1MTc2ZTkiLCJpZCI6MjU5LCJpYXQiOjE3NjIxODg4MDB9.ZZG574sONzeHxsX8HJMaL_ZiGA3dh_HrOxL7DrKRcd4';

const params = {
	enabled: true,
	visibleTiles: 0,
	errorTarget: 20,
};

const gui = new GUI();
gui.add( params, 'enabled' );
gui.add( params, 'visibleTiles' ).name( 'Visible Tiles' ).listen().disable();
gui.add( params, 'errorTarget', 1, 100 );

const canvas = document.getElementById( 'renderCanvas' );
const engine = new BABYLON.Engine( canvas, true );
engine.setHardwareScalingLevel( 1 / window.devicePixelRatio );

let tiles = null;
let scene = null;

async function createBabylonScene() {

	// scene
	scene = new BABYLON.Scene( engine );
	scene.useRightHandedSystem = true;

	// camera
	const camera = new BABYLON.ArcRotateCamera(
		'camera',
		- Math.PI / 2,
		Math.PI / 3,
		100000,
		new BABYLON.Vector3( 0, 0, 0 ),
		scene,
	);
	camera.attachControl( canvas, true );
	camera.minZ = 1;
	camera.maxZ = 1e7;
	camera.wheelPrecision = 0.25;
	camera.setPosition( new BABYLON.Vector3( 500, 300, - 500 ) );

	// tiles
	tiles = new BabylonTilesRenderer( null, scene );
	tiles.registerPlugin( new CesiumIonAuthPlugin( {
		apiToken: ION_TOKEN,
		assetId: GOOGLE_TILES_ASSET_ID,
		autoRefreshToken: true,
	} ) );
	tiles.errorTarget = params.errorTarget;

	// position so Tokyo Tower is visible
	tiles.group.rotation.set( - 0.6223599766516501, 8.326672684688674e-17, - 0.8682210177215869 );
	tiles.group.position.set( 0, - 6370877.772522855 - 150, 20246.934953993885 );

	return scene;

}

createBabylonScene().then( () => {

	// Babylon render loop
	scene.onBeforeRenderObservable.add( () => {

		if ( params.enabled ) {

			tiles.errorTarget = params.errorTarget;
			tiles.update();
			params.visibleTiles = tiles.visibleTiles.size;

		}

	} );

	engine.runRenderLoop( () => {

		scene.render();

	} );

} );

// Handle window resize
window.addEventListener( 'resize', () => {

	engine.resize();

} );
