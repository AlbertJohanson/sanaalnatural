/* ==========================================================================
   Sana Al Natural — Cart page
   Self-contained <san-cart-page> custom element. Talks directly to the
   Shopify cart API and re-renders its [data-swap] regions via the Section
   Rendering API, so Liquid stays the single source of truth for markup.
   Does NOT depend on Dawn's cart.js. Companion of san-cart-drawer.js:
   listens for its `san-cart:updated` events to stay in sync with the drawer.
   ========================================================================== */

(function () {
  'use strict';

  const CART_URL = (window.routes && window.routes.cart_url) || '/cart';
  const CART_CHANGE_URL = (window.routes && window.routes.cart_change_url) || '/cart/change';
  const CART_UPDATE_URL = (window.routes && window.routes.cart_update_url) || '/cart/update';

  class SanCartPage extends HTMLElement {
    connectedCallback() {
      this.sectionId = this.getAttribute('data-section-id');
      this.errorsEl = this.querySelector('[data-errors]');
      this.liveRegion = this.querySelector('[data-live-region]');
      this._busy = false;

      // Qty +/- and remove — delegated so it survives region swaps
      this.addEventListener('click', (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;
        const itemEl = actionEl.closest('[data-line]');
        if (!itemEl) return;

        e.preventDefault();
        const line = parseInt(itemEl.getAttribute('data-line'), 10);
        const qty = parseInt(itemEl.getAttribute('data-quantity'), 10) || 1;
        const action = actionEl.getAttribute('data-action');

        if (action === 'remove') {
          this.changeLine(line, 0, itemEl, action);
        } else if (action === 'qty-minus') {
          this.changeLine(line, Math.max(0, qty - 1), itemEl, action);
        } else if (action === 'qty-plus') {
          this.changeLine(line, qty + 1, itemEl, action);
        }
      });

      // Cart note — saved on change (blur), like Dawn's cart-note
      this.addEventListener('change', (e) => {
        if (!e.target.matches('[data-cart-note]')) return;
        this.saveNote(e.target.value);
      });

      // Stay in sync when the drawer changes the cart on this page
      this._onExternalUpdate = (e) => {
        if (e.detail && e.detail.source === 'san-cart-page') return;
        this.refresh();
      };
      document.addEventListener('san-cart:updated', this._onExternalUpdate);
    }

    disconnectedCallback() {
      document.removeEventListener('san-cart:updated', this._onExternalUpdate);
    }

    // ---------------------------------------------------------------------
    // Network
    // ---------------------------------------------------------------------
    async changeLine(line, quantity, itemEl, action) {
      if (this._busy) return;
      this._busy = true;
      itemEl.setAttribute('data-loading', '');
      this.clearError();

      try {
        const res = await fetch(CART_CHANGE_URL + '.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ line, quantity, sections: this.sectionId }),
          credentials: 'same-origin',
        });
        if (!res.ok) throw new Error('change ' + res.status);
        const data = await res.json();

        this.renderSection(data.sections && data.sections[this.sectionId]);
        this.announce();
        this.restoreFocus(line, action);

        document.dispatchEvent(
          new CustomEvent('san-cart:updated', {
            detail: { cart: data, source: 'san-cart-page' },
          })
        );
      } catch (e) {
        console.error('[san-cart] change failed', e);
        this.showError();
        itemEl.removeAttribute('data-loading');
      } finally {
        this._busy = false;
      }
    }

    async saveNote(note) {
      try {
        await fetch(CART_UPDATE_URL + '.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ note }),
          credentials: 'same-origin',
        });
      } catch (e) {
        console.error('[san-cart] note save failed', e);
      }
    }

    async refresh() {
      try {
        const res = await fetch(CART_URL + '?sections=' + encodeURIComponent(this.sectionId), {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        });
        if (!res.ok) throw new Error('refresh ' + res.status);
        const sections = await res.json();
        this.renderSection(sections[this.sectionId]);
      } catch (e) {
        console.error('[san-cart] refresh failed', e);
      }
    }

    // ---------------------------------------------------------------------
    // Rendering — swap [data-swap] regions from freshly rendered section HTML
    // ---------------------------------------------------------------------
    renderSection(html) {
      if (!html) return;
      const doc = new DOMParser().parseFromString(html, 'text/html');

      this.querySelectorAll('[data-swap]').forEach((region) => {
        const name = region.getAttribute('data-swap');
        const next = doc.querySelector('[data-swap="' + name + '"]');
        if (next) region.replaceWith(next);
      });

      const head = this.querySelector('[data-swap="head"]');
      const count = head ? parseInt(head.getAttribute('data-item-count'), 10) || 0 : 0;

      this.classList.toggle('is-empty', count === 0);
      const checkout = this.querySelector('[data-checkout-button]');
      if (checkout) checkout.disabled = count === 0;
      this.updateBubble(count);
    }

    updateBubble(count) {
      const bubble = document.getElementById('cart-icon-bubble');
      if (!bubble) return;
      let badge = bubble.querySelector('.san-header__cart-count');
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'san-header__cart-count';
          bubble.appendChild(badge);
        }
        badge.textContent = String(count);
      } else if (badge) {
        badge.remove();
      }
    }

    restoreFocus(line, action) {
      if (action !== 'qty-minus' && action !== 'qty-plus') return;
      const target = this.querySelector('[data-line="' + line + '"] [data-action="' + action + '"]');
      if (target) target.focus({ preventScroll: true });
    }

    announce() {
      if (!this.liveRegion) return;
      const totals = this.querySelector('[data-swap="totals"]');
      this.liveRegion.textContent = totals ? totals.textContent.replace(/\s+/g, ' ').trim() : '';
    }

    showError() {
      if (!this.errorsEl) return;
      const msg = this.getAttribute('data-error-text') || 'Error';
      this.errorsEl.textContent = msg;
      clearTimeout(this._errorTimer);
      this._errorTimer = setTimeout(() => {
        if (this.errorsEl.textContent === msg) this.errorsEl.textContent = '';
      }, 6000);
    }

    clearError() {
      if (this.errorsEl) this.errorsEl.textContent = '';
    }
  }

  if (!customElements.get('san-cart-page')) {
    customElements.define('san-cart-page', SanCartPage);
  }
})();
