// glTF/GLB Loader for Babylon.js
// Based on the LoaderBase from 3d-tiles-renderer/core

import { LoaderBase } from '3d-tiles-renderer/core';
import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';

let _fileId = 0;
export class GLTFLoader extends LoaderBase {

	constructor( scene ) {

		super();
		this.scene = scene;
		this.adjustmentTransform = BABYLON.Matrix.Identity();

	}

	async parse( buffer ) {

		const scene = this.scene;

		// Ensure working path ends in a slash for proper resource resolution
		let rootUrl = this.workingPath;
		if ( rootUrl.length && ! /[\\/]$/.test( rootUrl ) ) {

			rootUrl += '/';

		}

		// Load the GLB using Babylon's SceneLoader.LoadAssetContainerAsync
		// Signature: LoadAssetContainerAsync(rootUrl, sceneFilename, scene, onProgress, pluginExtension)
		// Use unique filename to prevent texture caching issues
		// TODO: What is the correct method for loading gltf files in babylon?
		// TODO: We should pass the original URL to the loader so we can use a correct file
		// name for loading from a cache
		const container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
			rootUrl,
			new File( [ buffer ], `tile_${ _fileId ++ }.glb` ),
			scene,
			null,
			'.glb',
		);

		// Babylon's glTF loader always creates a root mesh (named "__root__") as the first
		// mesh in the container. This root parents all loaded content and handles the
		// coordinate system conversion (glTF is right-handed, Babylon is left-handed).
		// This is analogous to Three.js GLTFLoader's model.scene.
		const root = container.meshes[ 0 ];

		// Add the container's contents to the scene but start disabled
		// The tile will be enabled when setTileVisible is called
		root.setEnabled( false );
		container.addAllToScene();

		// Apply adjustment transform
		const currentMatrix = root.computeWorldMatrix( true );
		const newMatrix = currentMatrix.multiply( this.adjustmentTransform );
		newMatrix.decompose( root.scaling, root.rotationQuaternion, root.position );

		return {
			scene: root,
			container,
		};

	}

}
