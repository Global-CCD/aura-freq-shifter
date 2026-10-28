// @ts-check
/**
 * @fileoverview Centralized DOM Selectors Dictionary
 */
export const DOM = {
  /** @param {string} name */
  control(name) {
    return /** @type {HTMLInputElement|HTMLSelectElement|null} */ (
      document.querySelector(`[data-control="${name}"]`)
    );
  },
  /** @param {string} name */
  display(name) {
    return /** @type {HTMLElement|null} */ (
      document.querySelector(`[data-display="${name}"]`)
    );
  },
  /** @param {string} id */
  template(id) {
    return /** @type {HTMLTemplateElement|null} */ (
      document.getElementById(id)
    );
  }
};
