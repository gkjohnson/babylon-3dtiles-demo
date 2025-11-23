// B3DM Loader for Babylon.js
// Based on the B3DMLoaderBase from 3d-tiles-renderer/core

import { B3DMLoaderBase } from '3d-tiles-renderer/core';
import { GLTFLoader } from './GLTFLoader.js';

export class B3DMLoader extends B3DMLoaderBase {

	constructor( scene ) {

		super();
		this.scene = scene;
		this.adjustmentTransform = null;

	}

	async parse( buffer ) {

		const b3dm = super.parse( buffer );
		const { batchTable, featureTable } = b3dm;

		// Use GLTFLoader to parse the embedded glTF
		const gltfLoader = new GLTFLoader( this.scene );
		gltfLoader.workingPath = this.workingPath;
		gltfLoader.fetchOptions = this.fetchOptions;
		if ( this.adjustmentTransform ) {

			gltfLoader.adjustmentTransform = this.adjustmentTransform;

		}

		const result = await gltfLoader.parse( b3dm.glbBytes );
		const root = result.scene;

		// Apply RTC_CENTER offset if present
		const rtcCenter = featureTable.getData( 'RTC_CENTER', 1, 'FLOAT', 'VEC3' );
		if ( rtcCenter ) {

			root.position.x += rtcCenter[ 0 ];
			root.position.y += rtcCenter[ 1 ];
			root.position.z += rtcCenter[ 2 ];

		}

		// Attach metadata to the root node
		root.metadata = {
			batchTable,
			featureTable,
		};

		return {
			scene: root,
			batchTable,
			featureTable,
			container: result.container,
		};

	}

}