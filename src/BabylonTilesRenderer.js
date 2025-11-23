import { TilesRendererBase, LoaderUtils } from '3d-tiles-renderer/core';
import * as BABYLON from 'babylonjs';
import { B3DMLoader } from './B3DMLoader.js';
import { GLTFLoader } from './GLTFLoader.js';
import { TileBoundingVolume } from './TileBoundingVolume.js';

export class BabylonTilesRenderer extends TilesRendererBase {

	constructor( url, scene ) {

		super( url );

		this.scene = scene;
		this.group = new BABYLON.TransformNode( 'tiles-root', scene );

		// Up-axis correction rotation matrix for glTF files
		this._upRotationMatrix = BABYLON.Matrix.Identity();

	}

	loadRootTileSet( ...args ) {

		return super.loadRootTileSet( ...args )
			.then( root => {

				// Cache the gltf tile set rotation matrix based on the up-axis
				// 3D Tiles spec allows specifying the up-axis in asset.gltfUpAxis
				const { asset } = root;
				const upAxis = asset && asset.gltfUpAxis || 'y';

				// gltfUpAxis specifies the up-axis in the glTF content (default is Y-up).
				// 3D Tiles uses Z-up convention, so we rotate glTF content to align
				// its up-axis with Z-up. This matches Three.js behavior.
				switch ( upAxis.toLowerCase() ) {

					case 'x':
						// X-up to Z-up: rotate around Y axis by -90 degrees
						BABYLON.Matrix.RotationYToRef( - Math.PI / 2, this._upRotationMatrix );
						break;

					case 'z':
						// Z-up already matches 3D Tiles convention, no rotation needed
						// (legacy/deprecated flag for old tilesets)
						this._upRotationMatrix = BABYLON.Matrix.Identity();
						break;

					case 'y':
					default:
						// Y-up to Z-up: rotate around X axis by +90 degrees
						BABYLON.Matrix.RotationXToRef( Math.PI / 2, this._upRotationMatrix );
						break;

				}

				return root;

			} );

	}

	preprocessNode( tile, tileSetDir, parentTile = null ) {

		super.preprocessNode( tile, tileSetDir, parentTile );

		// Build the transform matrix for this tile
		const transform = BABYLON.Matrix.Identity();
		if ( tile.transform ) {

			// 3D Tiles uses column-major order, same as Babylon.js
			BABYLON.Matrix.FromArrayToRef( tile.transform, 0, transform );

		}

		if ( parentTile ) {

			// Premultiply: result = parent * this
			const parent = parentTile.cached.transform;
			parent.multiplyToRef( transform, transform );

		}

		const transformInverse = BABYLON.Matrix.Invert( transform );

		// Parse bounding volume
		const boundingVolume = new TileBoundingVolume();
		if ( 'sphere' in tile.boundingVolume ) {

			boundingVolume.setSphereData( ...tile.boundingVolume.sphere, transform );

		}

		if ( 'box' in tile.boundingVolume ) {

			boundingVolume.setObbData( tile.boundingVolume.box, transform );

		}

		tile.cached = {
			transform,
			transformInverse,
			boundingVolume,
			active: false,
			group: null,
			container: null,
		};

	}

	async parseTile( buffer, tile, extension, uri, abortSignal ) {

		const cached = tile.cached;
		const scene = this.scene;
		const workingPath = LoaderUtils.getWorkingPath( uri );
		const fetchOptions = this.fetchOptions;

		const cachedTransform = cached.transform;
		const upRotationMatrix = this._upRotationMatrix;

		let result = null;
		const fileType = ( LoaderUtils.readMagicBytes( buffer ) || extension ).toLowerCase();

		switch ( fileType ) {

			case 'b3dm': {

				const loader = new B3DMLoader( scene );
				loader.workingPath = workingPath;
				loader.fetchOptions = fetchOptions;
				loader.adjustmentTransform = upRotationMatrix.clone();

				result = await loader.parse( buffer );
				break;

			}

			case 'gltf':
			case 'glb': {

				const loader = new GLTFLoader( scene );
				loader.workingPath = workingPath;
				loader.fetchOptions = fetchOptions;
				loader.adjustmentTransform = upRotationMatrix.clone();

				result = await loader.parse( buffer );
				break;

			}

			default:
				throw new Error( `BabylonTilesRenderer: Content type "${ fileType }" not supported.` );

		}

		// Exit early if aborted
		if ( abortSignal.aborted ) {

			// Dispose loaded content
			if ( result && result.container ) {

				result.container.dispose();

			}
			return;

		}

		const root = result.scene;

		// Apply the tile's cached transform to the loaded scene
		// Premultiply: result = cachedTransform * current
		const currentMatrix = root.computeWorldMatrix( true );
		const newMatrix = cachedTransform.multiply( currentMatrix );
		newMatrix.decompose( root.scaling, root.rotationQuaternion, root.position );

		// Store references in the cache (tile starts unparented/invisible)
		cached.group = root;
		cached.container = result.container;

	}

	disposeTile( tile ) {

		const cached = tile.cached;

		// Dispose the AssetContainer which cleans up all associated resources
		// (meshes, materials, textures, geometries, etc.)
		if ( cached.container ) {

			cached.container.dispose();
			cached.container = null;

		}

		cached.group = null;

	}

	setTileVisible( tile, visible ) {

		const group = tile.cached.group;
		if ( ! group ) {

			return;

		}

		if ( visible ) {

			group.parent = this.group;
			group.setEnabled( true );

		} else {

			group.parent = null;
			group.setEnabled( false );

		}

		super.setTileVisible( tile, visible );

	}

	calculateBytesUsed( tile ) {

		const cached = tile.cached;
		if ( ! cached.container ) {

			return 0;

		}

		const dedupeSet = new Set();
		let totalBytes = 0;

		// Sum geometry bytes from all meshes
		for ( const mesh of cached.container.meshes ) {

			const geometry = mesh.geometry;
			if ( ! geometry || dedupeSet.has( geometry ) ) {

				continue;

			}

			dedupeSet.add( geometry );

			// Sum all vertex buffer sizes
			const vertexBuffers = geometry.getVertexBuffers();
			if ( vertexBuffers ) {

				for ( const kind in vertexBuffers ) {

					const buffer = vertexBuffers[ kind ];
					if ( buffer && ! dedupeSet.has( buffer._buffer ) ) {

						dedupeSet.add( buffer._buffer );
						totalBytes += buffer._buffer.getData().byteLength;

					}

				}

			}

			// Add index buffer size
			const indices = geometry.getIndices();
			if ( indices ) {

				totalBytes += indices.byteLength || indices.length * 4;

			}

		}

		// Sum texture bytes from all materials
		for ( const material of cached.container.materials ) {

			const textures = material.getActiveTextures();
			for ( const texture of textures ) {

				if ( dedupeSet.has( texture ) ) {

					continue;

				}

				dedupeSet.add( texture );

				const size = texture.getSize();
				if ( size.width && size.height ) {

					// Estimate 4 bytes per pixel (RGBA), ignoring actual texture format
					let bytes = size.width * size.height * 4;

					// Account for mipmaps (~1.33x)
					if ( texture.generateMipMaps ) {

						bytes *= 4 / 3;

					}

					totalBytes += bytes;

				}

			}

		}

		return totalBytes;

	}

	calculateTileViewError( tile, target ) {

		const cached = tile.cached;
		const boundingVolume = cached.boundingVolume;
		const camera = this.scene.activeCamera;

		if ( ! camera ) {

			target.inView = false;
			target.error = Infinity;
			target.distanceFromCamera = Infinity;
			return;

		}

		// Get resolution from engine
		const engine = this.scene.getEngine();
		const width = engine.getRenderWidth();
		const height = engine.getRenderHeight();

		// Get camera info
		const projection = camera.getProjectionMatrix();
		const p = projection.m;
		const isOrthographic = p[ 15 ] === 1;

		// Calculate SSE denominator or pixel size
		let sseDenominator;
		let pixelSize;
		if ( isOrthographic ) {

			const w = 2 / p[ 0 ];
			const h = 2 / p[ 5 ];
			pixelSize = Math.max( h / height, w / width );

		} else {

			sseDenominator = ( 2 / p[ 5 ] ) / height;

		}

		// TODO:
		// - check if the bounding boxes are correctly formed in the local coordinate frame of the root
		// - transform the frustum matrices into the local frame frame of the root for checking
		// - ensure scaling is accounted for
		// - confirm transforms / visibility using wire bounding boxes for the box bounds

		// Get camera position
		const cameraPosition = camera.globalPosition.clone();

		// Get frustum planes from view-projection matrix
		const viewMatrix = camera.getViewMatrix();
		const viewProjection = viewMatrix.multiply( projection );
		const frustumPlanes = BABYLON.Frustum.GetPlanes( viewProjection );

		// Calculate distance and error
		const distance = boundingVolume.distanceToPoint( cameraPosition );

		let error;
		if ( isOrthographic ) {

			error = tile.geometricError / pixelSize;

		} else {

			// Avoid dividing by 0
			error = distance === 0 ? Infinity : tile.geometricError / ( distance * sseDenominator );

		}

		// Check frustum intersection
		const inView = boundingVolume.intersectsFrustum( frustumPlanes );

		target.inView = inView;
		target.error = error;
		target.distanceFromCamera = distance;

	}

	dispose() {

		super.dispose();
		this.group.dispose();

	}

}
