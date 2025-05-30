import { elements } from '../css';
import {
	DEFAULT_STYLES,
	DEFAULT_STYLES_INPUT,
} from '../models/constants/inputs';
import { HassElement } from '../models/interfaces';

// Theme check variables
let theme = '';
let shouldSetStyles = true;

/**
 * Check if theme is a "Material You" variant and set should set styles flag
 */
function checkTheme() {
	if (!theme) {
		const ha = document.querySelector('home-assistant') as HassElement;
		theme = ha?.hass?.themes?.theme;
		if (theme) {
			shouldSetStyles =
				theme.includes('Material You') &&
				(ha?.hass.states[`${DEFAULT_STYLES_INPUT}_${ha?.hass.user?.id}`]
					?.state ??
					ha?.hass.states[DEFAULT_STYLES_INPUT]?.state ??
					DEFAULT_STYLES) == 'on';
		}
	}
}

/**
 * Check if styles exist, returning them if they do
 * @param {HTMLElement} element
 * @returns {HTMLStyleElement}
 */
function hasStyles(element: HTMLElement): HTMLStyleElement {
	return element.shadowRoot?.getElementById(
		'material-you',
	) as HTMLStyleElement;
}

/**
 * Convert imported styles to string and add !important to all styles
 * @param {string} styles CSS styles imported from file
 * @returns {string} styles converted to string and all set to !important
 */
function loadStyles(styles: string): string {
	return styles.toString().replace(/;/g, ' !important;');
}

/**
 * Apply styles to custom elements
 * @param {HTMLElement} element
 */
function applyStyles(element: HTMLElement) {
	checkTheme();
	const shadowRoot = element.shadowRoot;
	if (shouldSetStyles && shadowRoot && !hasStyles(element)) {
		const style = document.createElement('style');
		style.id = 'material-you';
		style.textContent = loadStyles(
			elements[element.nodeName.toLowerCase()],
		);
		shadowRoot.appendChild(style);
	}
}

const observeAll = {
	childList: true,
	subtree: true,
	characterData: true,
	attributes: true,
};

/**
 * Apply styles to custom elements when a mutation is observed and the shadow-root is present
 * @param {HTMLElement} element
 */
function observeThenApplyStyles(element: HTMLElement) {
	const observer = new MutationObserver(() => {
		if (hasStyles(element)) {
			// No need to continue observing
			observer.disconnect();
		} else if (element.shadowRoot) {
			if (element.shadowRoot.children.length) {
				// Shadow-root exists and is populated, apply styles
				applyStyles(element);
				observer.disconnect();
			} else {
				// Shadow-root exists but is empty, observe it
				observer.observe(element.shadowRoot, observeAll);
			}
		}
	});
	observer.observe(element, observeAll);
}

/**
 * Apply styles to custom elements on a timeout
 * @param {HTMLElement} element
 * @param {number} ms
 */
function applyStylesOnTimeout(element: HTMLElement, ms: number = 10) {
	setTimeout(() => {
		// If the shadow-root exists but styles do not, apply styles
		if (element.shadowRoot?.children.length && !hasStyles(element)) {
			applyStyles(element);
			return;
		}

		// Quit if its been more than 20 seconds
		if (ms > 20000) {
			return;
		}

		// Recall the function with a longer timeout
		applyStylesOnTimeout(element, ms * 2);
	}, ms);
}

/**
 * Modify targets custom element registry define function to intercept constructors to use custom styles
 * Style are redundantly added in multiple places to ensure speed and consistency
 * @param {typeof globalThis} target
 */
export async function setStyles(target: typeof globalThis) {
	const define = target.CustomElementRegistry.prototype.define;
	target.CustomElementRegistry.prototype.define = function (
		name,
		constructor,
		options,
	) {
		if (elements[name]) {
			class PatchedElement extends constructor {
				constructor(...args: any[]) {
					super(...args);

					// Most efficient
					observeThenApplyStyles(this);

					// Most coverage
					applyStylesOnTimeout(this);
				}
			}

			constructor = PatchedElement;
		}

		return define.call(this, name, constructor, options);
	};
}
