// Oriented Bounding Box (OBB) for Babylon.js
// Uses an underlying AABB (min/max box) with a transform matrix

import * as BABYLON from 'babylonjs';

const _vec = new BABYLON.Vector3();

export class OBB {

	constructor() {

		// The axis-aligned box in local space (min/max)
		this.min = new BABYLON.Vector3( - 1, - 1, - 1 );
		this.max = new BABYLON.Vector3( 1, 1, 1 );

		// Transform from local OBB space to world space
		this.transform = BABYLON.Matrix.Identity();
		this.inverseTransform = BABYLON.Matrix.Identity();

		// Cached corner points in world space (for frustum tests)
		this.points = new Array( 8 ).fill( null ).map( () => new BABYLON.Vector3() );

	}

	update() {

		this.inverseTransform = BABYLON.Matrix.Invert( this.transform );
		this._updatePoints();

	}

	_updatePoints() {

		const { min, max } = this;

		let index = 0;
		for ( let x = 0; x <= 1; x ++ ) {

			for ( let y = 0; y <= 1; y ++ ) {

				for ( let z = 0; z <= 1; z ++ ) {

					this.points[ index ].set(
						x === 0 ? min.x : max.x,
						y === 0 ? min.y : max.y,
						z === 0 ? min.z : max.z,
					);
					BABYLON.Vector3.TransformCoordinatesToRef(
						this.points[ index ],
						this.transform,
						this.points[ index ],
					);
					index ++;

				}

			}

		}

	}

	clampPoint( point, result ) {

		// Transform point to local space
		BABYLON.Vector3.TransformCoordinatesToRef( point, this.inverseTransform, result );

		// Clamp to box bounds
		result.x = Math.max( this.min.x, Math.min( this.max.x, result.x ) );
		result.y = Math.max( this.min.y, Math.min( this.max.y, result.y ) );
		result.z = Math.max( this.min.z, Math.min( this.max.z, result.z ) );

		// Transform back to world space
		BABYLON.Vector3.TransformCoordinatesToRef( result, this.transform, result );

		return result;

	}

	distanceToPoint( point ) {

		this.clampPoint( point, _vec );
		return BABYLON.Vector3.Distance( _vec, point );

	}

	containsPoint( point ) {

		BABYLON.Vector3.TransformCoordinatesToRef( point, this.inverseTransform, _vec );

		return (
			_vec.x >= this.min.x && _vec.x <= this.max.x &&
			_vec.y >= this.min.y && _vec.y <= this.max.y &&
			_vec.z >= this.min.z && _vec.z <= this.max.z
		);

	}

	intersectsFrustum( frustumPlanes ) {

		// Use Babylon's built-in BoundingBox frustum test with our 8 corner points
		return BABYLON.BoundingBox.IsInFrustum( this.points, frustumPlanes );

	}

}