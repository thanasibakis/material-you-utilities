import { html, LitElement } from 'lit';
import { elements } from '../css';
import {
	DEFAULT_STYLES,
	DEFAULT_STYLES_INPUT,
} from '../models/constants/inputs';
import { HassElement } from '../models/interfaces';
import { getAsync } from './async';

// Theme check variables
let theme = '';
let shouldSetStyles = true;

/**
 * Check if theme is a "Material You" variant and set should set styles flag
 */
export function checkTheme() {
	if (!theme) {
		const ha = document.querySelector('home-assistant') as HassElement;
		theme = ha.hass?.themes?.theme;
		shouldSetStyles =
			theme?.includes('Material You') &&
			(ha.hass.states[`${DEFAULT_STYLES_INPUT}_${ha.hass.user?.id}`]
				?.state ??
				ha.hass.states[DEFAULT_STYLES_INPUT]?.state ??
				DEFAULT_STYLES) == 'on';
	}
}

/**
 * Convert imported styles to string and add !important to all styles
 * @param {string} styles CSS styles imported from file
 * @returns {string} styles converted to string and all set to !important
 */
export function loadStyles(styles: string): string {
	return styles.toString().replace(/;/g, ' !important;');
}

/**
 * Apply styles to custom elements
 * @param {HassElement} element
 */
export async function applyStyles(element: HTMLElement) {
	checkTheme();

	const shadowRoot = (await getAsync(element, 'shadowRoot')) as ShadowRoot;
	if (
		shouldSetStyles &&
		shadowRoot &&
		!shadowRoot?.querySelector('#material-you')
	) {
		const style = document.createElement('style');
		style.id = 'material-you';
		style.textContent = loadStyles(
			elements[element.nodeName.toLowerCase()],
		);
		shadowRoot.appendChild(style);
	}
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
			class PatchedElement extends (constructor as typeof LitElement) {
				// Most coverage, doesn't always work
				constructor(...args: any[]) {
					// @ts-ignore
					super(...args);
					applyStyles(this);
				}

				// Second most coverage, almost always works
				async connectedCallback() {
					await super.connectedCallback();
					applyStyles(this);
				}

				// Most efficient, doesn't always work
				render() {
					checkTheme();
					return html`
						${super.render()}
						${shouldSetStyles
							? html`<style id="material-you">
									${loadStyles(elements[name])}
								</style>`
							: ''}
					`;
				}

				// Second most efficient, doesn't always work
				async firstUpdated(changedProperties: any) {
					await super.firstUpdated(changedProperties);
					await applyStyles(this);
				}
			}

			constructor = PatchedElement;
		}

		return define.call(this, name, constructor, options);
	};
}
