// Keyboard / mouse input with pointer lock support.
const LOOK_VERTICAL_DEAD_ZONE = 0.16;
const KEYBOARD_LOOK_SPEED = 700; // Mouse-equivalent units per second (about 88 degrees/s on foot).
const LOOK_KEYS = new Set( [ 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown' ] );
const ownsKeyboard = target => Boolean( target && (
	[ 'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A', 'SUMMARY' ].includes( target.tagName ) ||
	target.isContentEditable || target.closest?.( '.tw-interactive, [role="dialog"]' )
) );

export class Input {

	constructor( dom, { keyboardLookBlocked = () => false, touchRoot = null } = {} ) {

		this.dom = dom;
		this.keys = new Set();
		this.pressed = new Set();
		this._touchHeld = new Map();
		this._touchActionHeld = new Map();
		this._touchActionResetters = [];
		this.touchRoot = touchRoot;
		this._helicopterTouchMode = false;
		this._touchFlightResetters = [];
		this.look = { x: 0, y: 0 };
		this.moveStick = { x: 0, y: 0 };
		this.lookStick = { x: 0, y: 0 };
		this.wheel = 0;
		this.mouseDown = false;
		this.rightDown = false;
		this.locked = false;
		this.enabled = true;
		this.keyboardDetected = Boolean( window.matchMedia?.( '(any-pointer: fine)' ).matches );
		this.keyboardLookBlocked = keyboardLookBlocked;

		// Capture releases even when a menu consumes the corresponding key event.
		window.addEventListener( 'keyup', ( e ) => this.keys.delete( e.code ), true );
		window.addEventListener( 'keydown', ( e ) => {

			if ( e.isTrusted && e.code && e.code !== 'Unidentified' ) this.keyboardDetected = true;

			if ( e.ctrlKey || e.metaKey || e.altKey ) this.clearKeyboardLook();

		}, true );
		document.addEventListener( 'focusin', ( e ) => {

			if ( ownsKeyboard( e.target ) ) this.clearKeyboardLook();

		}, true );

		window.addEventListener( 'keydown', ( e ) => {

			if ( LOOK_KEYS.has( e.code ) && ( e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || ! this._keyboardLookAllowed( e.target ) ) ) {

				this.clearKeyboardLook();
				return;

			}
			// Focus/modal changes require a fresh press, not the tail of an old hold.
			if ( LOOK_KEYS.has( e.code ) && e.repeat && ! this.keys.has( e.code ) ) return;
			if ( e.target && ( e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' ) ) return;
			if ( ! this.keys.has( e.code ) ) this.pressed.add( e.code );
			this.keys.add( e.code );
			if ( [ 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab' ].includes( e.code ) ) e.preventDefault();

		} );
		window.addEventListener( 'blur', () => this._clearTransientInput() );
		document.addEventListener( 'visibilitychange', () => {

			if ( document.hidden ) this._clearTransientInput();

		} );
		this._createTouchSticks();

		dom.addEventListener( 'mousedown', ( e ) => {

			if ( e.button === 0 ) this.mouseDown = true;
			if ( e.button === 2 ) this.rightDown = true;

		} );
		window.addEventListener( 'mouseup', ( e ) => {

			if ( e.button === 0 ) this.mouseDown = false;
			if ( e.button === 2 ) this.rightDown = false;

		} );
		dom.addEventListener( 'contextmenu', ( e ) => e.preventDefault() );
		window.addEventListener( 'mousemove', ( e ) => {

			if ( this.locked || this.mouseDown || this.rightDown ) {

				this.look.x += e.movementX;
				this.look.y += e.movementY;

			}

		} );
		dom.addEventListener( 'wheel', ( e ) => {

			this.wheel += Math.sign( e.deltaY );
			e.preventDefault();

		}, { passive: false } );

		document.addEventListener( 'pointerlockchange', () => {

			this.locked = document.pointerLockElement === dom;

		} );

	}

	requestLock() {

		if ( window.matchMedia?.( '(pointer: coarse)' ).matches ) return;
		if ( ! this.locked ) this.dom.requestPointerLock?.()?.catch?.( () => {} );

	}

	suspend() {
		this.enabled = false;
		this._clearTransientInput();
	}

	resume() {
		this._clearTransientInput();
		this.enabled = true;
	}

	_keyboardLookAllowed( target ) {

		return this.enabled && ! document.hidden && ! this.keyboardLookBlocked() &&
			! ownsKeyboard( target ) && ! ownsKeyboard( document.activeElement );

	}

	clearKeyboardLook() {

		for ( const code of LOOK_KEYS ) {

			this.keys.delete( code );
			this.pressed.delete( code );

		}

	}

	get touchInterface() {

		return ! this.keyboardDetected && Boolean( window.matchMedia?.( '(pointer: coarse)' ).matches );

	}

	setHelicopterTouchMode( active ) {

		active = Boolean( active );
		if ( active === this._helicopterTouchMode ) return;
		this._helicopterTouchMode = active;
		if ( this._touchFlight ) this._touchFlight.hidden = ! active;
		if ( ! active ) for ( const reset of this._touchFlightResetters ) reset();

	}

	_createTouchSticks() {

		const root = this.touchRoot || document.querySelector( '.tw-root' );
		if ( ! root ) return;

		const controls = document.createElement( 'div' );
		controls.className = 'tw-touch-controls';
		controls.setAttribute( 'aria-label', 'Touch controls' );
		this._touchStickResetters = [];
		for ( const [ name, label, state ] of [
			[ 'move', 'Move', this.moveStick ],
			[ 'look', 'Look', this.lookStick ],
		] ) {

			const stick = document.createElement( 'button' );
			stick.className = `tw-touch-stick tw-touch-stick-${ name } tw-interactive`;
			stick.type = 'button';
			stick.setAttribute( 'aria-label', `${ label } joystick` );
			stick.tabIndex = -1;
			stick.innerHTML = '<span class="tw-touch-stick-label">' + label + '</span><span class="tw-touch-stick-knob" aria-hidden="true"></span>';
			const knob = stick.querySelector( '.tw-touch-stick-knob' );
			let pointerId = null;

			const reset = () => {

				const captured = pointerId;
				pointerId = null;
				state.x = state.y = 0;
				stick.classList.remove( 'is-active' );
				knob.style.transform = 'translate( -50%, -50% )';
				if ( captured !== null && stick.hasPointerCapture?.( captured ) ) stick.releasePointerCapture( captured );

			};
			this._touchStickResetters.push( reset );
			const update = ( e ) => {

				const rect = stick.getBoundingClientRect();
				const radius = rect.width * 0.29;
				let x = e.clientX - ( rect.left + rect.width / 2 );
				let y = e.clientY - ( rect.top + rect.height / 2 );
				state.x = x / radius;
				state.y = - y / radius;
				knob.style.transform = `translate( calc( -50% + ${ x }px ), calc( -50% + ${ y }px ) )`;

			};

			stick.addEventListener( 'pointerdown', ( e ) => {

				e.preventDefault();
				e.stopPropagation();
				if ( ! this.enabled || pointerId !== null ) return;
				try { stick.setPointerCapture( e.pointerId ); } catch { return; }
				pointerId = e.pointerId;
				stick.classList.add( 'is-active' );
				update( e );

			} );
			stick.addEventListener( 'pointermove', ( e ) => {

				if ( e.pointerId !== pointerId ) return;
				e.preventDefault();
				if ( ! this.enabled ) { reset(); return; }
				update( e );

			} );
			stick.addEventListener( 'pointerup', ( e ) => {

				if ( e.pointerId === pointerId ) reset();

			} );
			stick.addEventListener( 'pointercancel', e => { if ( e.pointerId === pointerId ) reset(); } );
			stick.addEventListener( 'lostpointercapture', e => { if ( e.pointerId === pointerId ) reset(); } );
			controls.append( stick );

		}

		const flight = this._touchFlight = document.createElement( 'div' );
		flight.className = 'tw-touch-flight';
		flight.hidden = true;
		flight.setAttribute( 'aria-label', 'Helicopter altitude controls' );
		for ( const [ label, code ] of [ [ 'Up', 'Space' ], [ 'Down', 'KeyC' ] ] ) {

			const button = document.createElement( 'button' );
			button.type = 'button';
			button.className = 'tw-touch-flight-button tw-interactive';
			button.textContent = label;
			button.setAttribute( 'aria-label', `Helicopter ${ label.toLowerCase() } — hold` );
			button.tabIndex = -1;
			const pointers = new Set();
			this._touchHeld.set( code, pointers );
			const stop = e => { e.preventDefault(); e.stopPropagation(); };
			const release = e => {

				stop( e );
				pointers.delete( e.pointerId );
				if ( button.hasPointerCapture?.( e.pointerId ) ) button.releasePointerCapture( e.pointerId );
				button.classList.toggle( 'is-active', pointers.size > 0 );

			};
			this._touchFlightResetters.push( () => {

				const captured = [ ...pointers ];
				pointers.clear();
				for ( const id of captured ) if ( button.hasPointerCapture?.( id ) ) button.releasePointerCapture( id );
				button.classList.remove( 'is-active' );

			} );
			button.addEventListener( 'pointerdown', e => {

				stop( e );
				if ( ! this.enabled || ! this._helicopterTouchMode ) return;
				try { button.setPointerCapture( e.pointerId ); } catch { return; }
				pointers.add( e.pointerId );
				button.classList.add( 'is-active' );

			} );
			button.addEventListener( 'pointermove', stop );
			for ( const event of [ 'pointerup', 'pointercancel', 'lostpointercapture' ] ) button.addEventListener( event, release );
			button.addEventListener( 'click', stop );
			flight.append( button );

		}
		controls.append( flight );
		root.append( controls );

	}

	bindTouchAction( button, { code = null, hold = false, onPress = () => {}, allowed = () => true } = {} ) {

		if ( ! button ) return () => {};
		const pointers = new Set();
		const held = hold && code ? ( this._touchActionHeld.get( code ) || new Set() ) : null;
		if ( held ) this._touchActionHeld.set( code, held );
		const reset = () => {

			const captured = [ ...pointers ];
			pointers.clear();
			if ( held ) held.clear();
			button.classList.remove( 'is-active' );
			for ( const id of captured ) if ( button.hasPointerCapture?.( id ) ) button.releasePointerCapture( id );

		};
		this._touchActionResetters.push( reset );
		const stop = e => { e.preventDefault(); e.stopPropagation(); };
		button.addEventListener( 'pointerdown', e => {

			stop( e );
			if ( ! this.enabled || ! allowed() || pointers.size ) return;
			try { button.setPointerCapture( e.pointerId ); } catch { return; }
			pointers.add( e.pointerId );
			if ( held ) held.add( e.pointerId );
			button.classList.add( 'is-active' );
			if ( code ) this.press( code );
			onPress();

		} );
		button.addEventListener( 'pointermove', e => { if ( pointers.has( e.pointerId ) ) stop( e ); } );
		for ( const event of [ 'pointerup', 'pointercancel', 'lostpointercapture' ] ) button.addEventListener( event, e => {

			if ( ! pointers.has( e.pointerId ) ) return;
			stop( e );
			pointers.delete( e.pointerId );
			if ( held ) held.delete( e.pointerId );
			if ( event !== 'lostpointercapture' && button.hasPointerCapture?.( e.pointerId ) ) button.releasePointerCapture( e.pointerId );
			button.classList.toggle( 'is-active', pointers.size > 0 );

		} );
		button.addEventListener( 'click', stop );
		return reset;

	}

	_clearTransientInput() {

		this.keys.clear();
		this.pressed.clear();
		this.mouseDown = false;
		this.rightDown = false;
		this.look.x = this.look.y = 0;
		this.moveStick.x = this.moveStick.y = 0;
		this.lookStick.x = this.lookStick.y = 0;
		for ( const reset of this._touchStickResetters || [] ) reset();
		for ( const reset of this._touchFlightResetters ) reset();
		for ( const reset of this._touchActionResetters ) reset();

	}

	_moveAxis( negative, positive, value ) {

		if ( ! this.enabled ) return 0;
		if ( this.keys.has( negative ) || this.keys.has( positive ) ) {
			return Number( this.keys.has( positive ) ) - Number( this.keys.has( negative ) );
		}
		return value;

	}

	_shapeAxis( value, deadZone ) {

		const magnitude = Math.abs( value );
		if ( magnitude <= deadZone ) return 0;
		return Math.sign( value ) * ( ( magnitude - deadZone ) / ( 1 - deadZone ) ) ** 1.7;

	}

	moveAxes() {

		const { x, y } = this.moveStick;
		const length = Math.hypot( x, y );
		let sx = 0, sy = 0;
		if ( length > 1 ) {

			// Beyond the ring, preserve the stick direction; its extra travel becomes sprint.
			sx = x / length;
			sy = y / length;

		} else if ( length > 0.08 ) {

			const magnitude = Math.min( ( length - 0.08 ) / 0.92, 1 );
			const shaped = magnitude ** 1.7 / length;
			sx = this._shapeAxis( x, 0.22 );
			sy = y * shaped;
			const axisLength = Math.hypot( sx, sy );
			if ( axisLength > 0 ) {
				const response = magnitude ** 1.7 / axisLength;
				sx *= response;
				sy *= response;
			}
		}
		return {
			x: this._moveAxis( 'KeyA', 'KeyD', sx ),
			y: this._moveAxis( 'KeyS', 'KeyW', sy ),
			sprint: Math.max( 0, Math.min( length - 1, 1 ) ),
		};

	}

	down( code ) {

		if ( ! this.enabled ) return false;
		if ( this.keys.has( code ) ) return true;
		if ( this._touchHeld.get( code )?.size || this._touchActionHeld.get( code )?.size ) return true;
		const { x, y } = this.moveStick;
		if ( code === 'KeyW' ) return y > 0.18;
		if ( code === 'KeyS' ) return y < - 0.18;
		if ( code === 'KeyD' ) return x > 0.18;
		if ( code === 'KeyA' ) return x < - 0.18;
		return false;

	}

	// true once per physical key press
	hit( code ) {

		return this.enabled && this.pressed.has( code );

	}

	press( code ) {

		if ( this.enabled ) this.pressed.add( code );

	}

	consumeLook( dt = 1 / 60 ) {
		if ( ! this._keyboardLookAllowed() ) this.clearKeyboardLook();
		if ( ! this.enabled ) { this.look.x = this.look.y = 0; return { x: 0, y: 0 }; }

		const { x, y } = this.lookStick;
		const length = Math.hypot( x, y );
		let sx = 0, sy = 0;
		if ( length > 0.04 ) {

			const magnitude = Math.min( ( length - 0.04 ) / 0.96, 1 );
			const shaped = magnitude ** 1.7 / length;
			const outsideScale = Math.max( length, 1 );
			sx = x * shaped * outsideScale;
			sy = this._shapeAxis( Math.max( - 1, Math.min( y, 1 ) ), LOOK_VERTICAL_DEAD_ZONE ) * outsideScale;

		}
		const l = {
			x: this.look.x + sx * 420 * dt + ( Number( this.keys.has( 'ArrowRight' ) ) - Number( this.keys.has( 'ArrowLeft' ) ) ) * KEYBOARD_LOOK_SPEED * dt,
			y: this.look.y - sy * 420 * dt + ( Number( this.keys.has( 'ArrowDown' ) ) - Number( this.keys.has( 'ArrowUp' ) ) ) * KEYBOARD_LOOK_SPEED * dt,
		};
		this.look.x = 0;
		this.look.y = 0;
		return l;

	}

	consumeWheel() {

		const w = this.wheel;
		this.wheel = 0;
		return w;

	}

	endFrame() {

		if ( ! this._keyboardLookAllowed() ) this.clearKeyboardLook();
		this.pressed.clear();

	}

}
