import * as BABYLON from 'babylonjs';
import { BabylonTilesRenderer } from '../src/BabylonTilesRenderer.js';
import GUI from 'lil-gui';

const TILESET_URL = 'https://raw.githubusercontent.com/NASA-AMMOS/3DTilesSampleData/master/msl-dingo-gap/0528_0260184_to_s64o256_colorize/0528_0260184_to_s64o256_colorize/0528_0260184_to_s64o256_colorize_tileset.json';

const canvas = document.getElementById( 'renderCanvas' );
const engine = new BABYLON.Engine( canvas, true );
engine.setHardwareScalingLevel( 1 / window.devicePixelRatio );

let tilesRenderer = null;

// GUI state
const params = {
	enableUpdate: true,
	visibleTiles: 0,
};

// Setup GUI
const gui = new GUI();
gui.add( params, 'enableUpdate' ).name( 'Enable Update' );
gui.add( params, 'visibleTiles' ).name( 'Visible Tiles' ).listen().disable();

async function createScene() {

	const scene = new BABYLON.Scene( engine );

	// Camera
	const camera = new BABYLON.ArcRotateCamera(
		'camera',
		- Math.PI / 2,
		Math.PI / 2.5,
		50,
		new BABYLON.Vector3( 0, 0, 0 ),
		scene,
	);
	camera.attachControl( canvas, true );
	camera.minZ = 0.1;
	camera.maxZ = 10000;

	// Lights
	const hemiLight = new BABYLON.HemisphericLight(
		'hemiLight',
		new BABYLON.Vector3( 0, 1, 0 ),
		scene,
	);
	hemiLight.intensity = 0.6;

	const dirLight = new BABYLON.DirectionalLight(
		'dirLight',
		new BABYLON.Vector3( - 1, - 2, - 1 ),
		scene,
	);
	dirLight.intensity = 0.8;

	// Load 3D Tiles
	tilesRenderer = new BabylonTilesRenderer( TILESET_URL, scene );

	// Rotate tileset so Z+ points up (tileset has Z+ as down)
	// tilesRenderer.group.rotation.x = Math.PI / 2;

	try {

		console.log( 'Loading tileset from:', TILESET_URL );
		await tilesRenderer.loadRootTileSet();
		console.log( 'Tileset loaded' );

		// Position camera to view the tileset
		camera.radius = 20;
		camera.target = BABYLON.Vector3.Zero();

	} catch ( error ) {

		console.error( 'Failed to load tileset:', error );

	}

	return scene;

}

// Create scene and start render loop
createScene().then( scene => {

	scene.onBeforeRenderObservable.add( () => {

		// Update tiles renderer each frame
		if ( tilesRenderer ) {

			if ( params.enableUpdate ) {

				tilesRenderer.update();

			}

			window.TILES = tilesRenderer;
			params.visibleTiles = tilesRenderer.visibleTiles.size;

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
