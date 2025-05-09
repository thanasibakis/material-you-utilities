import { html, LitElement } from 'lit';
import { elements } from '../css';
import {
	DEFAULT_STYLES,
	DEFAULT_STYLES_INPUT,
} from '../models/constants/inputs';
import { HassElement, HomeAssistant } from '../models/interfaces';
import { getAsync } from './async';

// Theme check variables
let theme = '';
let shouldSetStyles = true;

/**
 * Check if theme is a "Material You" variant and set should set styles flag
 */
async function checkTheme(hass?: HomeAssistant) {
	if (!theme) {
		if (!hass) {
			const ha = document.querySelector('home-assistant') as HassElement;
			hass = ha.hass;
		}
		theme = hass?.themes?.theme;
		shouldSetStyles =
			theme?.includes('Material You') &&
			(hass.states[`${DEFAULT_STYLES_INPUT}_${hass.user?.id}`]?.state ??
				hass.states[DEFAULT_STYLES_INPUT]?.state ??
				DEFAULT_STYLES) == 'on';
	}
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
 * @param {HassElement} element
 */
async function applyStyles(element: HTMLElement) {
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
				// Most coverage
				constructor(...args: any[]) {
					// @ts-ignore
					super(...args);

					checkTheme((this as unknown as HassElement).hass);
					const observer = new MutationObserver(async () => {
						if (this.shadowRoot) {
							await applyStyles(this);
							observer.disconnect();
						}
					});
					observer.observe(this, {
						childList: true,
						subtree: true,
						characterData: true,
						attributes: true,
					});
				}

				// Most efficient
				render() {
					checkTheme((this as unknown as HassElement).hass);
					return html`
						${super.render()}
						${shouldSetStyles
							? html`<style id="material-you">
									${loadStyles(elements[name])}
								</style>`
							: ''}
					`;
				}
			}

			constructor = PatchedElement;
		}

		return define.call(this, name, constructor, options);
	};
}
