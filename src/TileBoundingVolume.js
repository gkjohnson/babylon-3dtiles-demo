// TileBoundingVolume for Babylon.js
// Supports sphere and oriented bounding box (OBB) volumes from 3D Tiles spec

import * as BABYLON from 'babylonjs';
import { OBB } from './OBB.js';

const _vecX = new BABYLON.Vector3();
const _vecY = new BABYLON.Vector3();
const _vecZ = new BABYLON.Vector3();

export class TileBoundingVolume {

	constructor() {

		this.sphere = null;
		this.obb = null;

	}

	setSphereData( x, y, z, radius, transform ) {

		// Create a BoundingSphere and transform it
		const center = new BABYLON.Vector3( x, y, z );
		BABYLON.Vector3.TransformCoordinatesToRef( center, transform, center );

		// Extract scale from transform to adjust radius
		const scale = new BABYLON.Vector3();
		transform.decompose( scale );
		const maxScale = Math.max( Math.abs( scale.x ), Math.abs( scale.y ), Math.abs( scale.z ) );

		// Create BoundingSphere with world-space values
		const sphere = new BABYLON.BoundingSphere( center, center );
		sphere.centerWorld.copyFrom( center );
		sphere.radiusWorld = radius * maxScale;

		this.sphere = sphere;

	}

	setObbData( data, transform ) {

		// 3D Tiles OBB format: [cx, cy, cz, xx, xy, xz, yx, yy, yz, zx, zy, zz]
		// center (3) + x half-axis (3) + y half-axis (3) + z half-axis (3)
		const obb = new OBB();

		// Get the extents of the bounds in each axis
		_vecX.set( data[ 3 ], data[ 4 ], data[ 5 ] );
		_vecY.set( data[ 6 ], data[ 7 ], data[ 8 ] );
		_vecZ.set( data[ 9 ], data[ 10 ], data[ 11 ] );

		const scaleX = _vecX.length();
		const scaleY = _vecY.length();
		const scaleZ = _vecZ.length();

		_vecX.normalize();
		_vecY.normalize();
		_vecZ.normalize();

		// Handle the case where the box has a dimension of 0 in one axis
		if ( scaleX === 0 ) BABYLON.Vector3.CrossToRef( _vecY, _vecZ, _vecX );
		if ( scaleY === 0 ) BABYLON.Vector3.CrossToRef( _vecX, _vecZ, _vecY );
		if ( scaleZ === 0 ) BABYLON.Vector3.CrossToRef( _vecX, _vecY, _vecZ );

		// Create the oriented frame that the box exists in
		// Note: Babylon uses row-major order, Three.js uses column-major
		const obbTransform = BABYLON.Matrix.FromValues(
			_vecX.x, _vecX.y, _vecX.z, 0,
			_vecY.x, _vecY.y, _vecY.z, 0,
			_vecZ.x, _vecZ.y, _vecZ.z, 0,
			data[ 0 ], data[ 1 ], data[ 2 ], 1,
		);
		// Premultiply: result = transform * obbTransform
		obb.transform = transform.multiply( obbTransform );

		// Scale the box by the extents
		obb.min.set( - scaleX, - scaleY, - scaleZ );
		obb.max.set( scaleX, scaleY, scaleZ );
		obb.update();

		this.obb = obb;

	}

	distanceToPoint( point ) {

		let sphereDistance = - Infinity;
		let obbDistance = - Infinity;

		if ( this.sphere ) {

			const dist = BABYLON.Vector3.Distance( point, this.sphere.centerWorld ) - this.sphere.radiusWorld;
			// Clamp to 0 if inside the sphere
			sphereDistance = Math.max( dist, 0 );

		}

		if ( this.obb ) {

			obbDistance = this.obb.distanceToPoint( point );

		}

		// Return the larger distance (more conservative)
		return Math.max( sphereDistance, obbDistance );

	}

	intersectsFrustum( frustumPlanes ) {

		if ( this.sphere ) {

			if ( ! this.sphere.isInFrustum( frustumPlanes ) ) {

				return false;

			}

		}

		if ( this.obb ) {

			if ( ! this.obb.intersectsFrustum( frustumPlanes ) ) {

				return false;

			}

		}

		// Return true if we have at least one volume and it passed the test
		return Boolean( this.sphere || this.obb );

	}

}