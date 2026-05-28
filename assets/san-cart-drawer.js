/* ==========================================================================
   Sana Al Natural — Custom Cart Drawer
   Self-contained <san-cart-drawer> custom element. Owns its own state, talks
   directly to the Shopify cart API. Does NOT depend on Dawn's cart-drawer.js
   or cart.js — those are intentionally bypassed.
   ========================================================================== */

(function () {
  'use strict';

  const CART_URL = (window.routes && window.routes.cart_url) || '/cart';
  const CART_ADD_URL = (window.routes && window.routes.cart_add_url) || '/cart/add';
  const CART_CHANGE_URL = (window.routes && window.routes.cart_change_url) || '/cart/change';

  // -----------------------------------------------------------------------
  // Money formatting — uses Shopify.money_format if present, falls back to Q
  // -----------------------------------------------------------------------
  function formatMoney(cents) {
    if (cents == null || isNaN(cents)) return '';
    const amount = (cents / 100).toFixed(2);
    const withCommas = amount.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const fmt = window.Shopify && window.Shopify.money_format;
    if (fmt && /\{\{\s*amount\s*\}\}/.test(fmt)) {
      return fmt.replace(/\{\{\s*amount\s*\}\}/, withCommas);
    }
    if (fmt && /\{\{\s*amount_no_decimals\s*\}\}/.test(fmt)) {
      return fmt.replace(/\{\{\s*amount_no_decimals\s*\}\}/, withCommas.split('.')[0]);
    }
    return 'Q' + withCommas;
  }

  // Resize a Shopify CDN image URL by adding a width param
  function sizedImage(url, width) {
    if (!url) return '';
    try {
      const u = new URL(url, window.location.origin);
      u.searchParams.set('width', String(width));
      return u.toString();
    } catch (e) {
      return url;
    }
  }

  // -----------------------------------------------------------------------
  // <san-cart-drawer>
  // -----------------------------------------------------------------------
  class SanCartDrawer extends HTMLElement {
    constructor() {
      super();
      this.cart = null;
      this.isOpen = false;
      this.lastFocus = null;
      this._submitting = false;
    }

    connectedCallback() {
      // Cache DOM
      this.panel = this.querySelector('[data-panel]');
      this.overlay = this.querySelector('[data-overlay]');
      this.itemsList = this.querySelector('[data-items]');
      this.itemTemplate = this.querySelector('#san-cart-item-template');
      this.subtotalEl = this.querySelector('[data-subtotal]');
      this.countEl = this.querySelector('[data-count]');
      this.errorsEl = this.querySelector('[data-errors]');
      this.cartDiscountsEl = this.querySelector('[data-cart-discounts]');

      // Parse initial cart state passed in via data-cart attribute
      try {
        const raw = this.getAttribute('data-cart');
        if (raw) this.cart = JSON.parse(raw);
      } catch (e) {
        console.warn('[san-cart-drawer] could not parse initial cart', e);
      }

      this.render(this.cart);
      this.bindEvents();
    }

    // ---------------------------------------------------------------------
    // Event wiring
    // ---------------------------------------------------------------------
    bindEvents() {
      // Close: overlay, close buttons, Escape
      this.overlay.addEventListener('click', () => this.close());
      this.querySelectorAll('[data-close]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.close();
        });
      });
      document.addEventListener('keydown', (e) => {
        if (this.isOpen && e.key === 'Escape') this.close();
      });

      // Cart icon — delegated so it survives section reloads in editor
      document.addEventListener('click', (e) => {
        const trigger = e.target.closest('#cart-icon-bubble, [data-san-cart-trigger]');
        if (!trigger) return;
        e.preventDefault();
        this.openWithRefresh();
      });

      // Item interactions (qty +/-, remove)
      this.itemsList.addEventListener('click', (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;
        const itemEl = actionEl.closest('[data-line]');
        if (!itemEl) return;
        const line = parseInt(itemEl.getAttribute('data-line'), 10);
        const action = actionEl.getAttribute('data-action');
        const item = this.cart && this.cart.items && this.cart.items[line - 1];
        if (!item) return;

        e.preventDefault();
        if (action === 'remove') {
          this.changeLine(line, 0, itemEl);
        } else if (action === 'qty-minus') {
          this.changeLine(line, Math.max(0, item.quantity - 1), itemEl);
        } else if (action === 'qty-plus') {
          this.changeLine(line, item.quantity + 1, itemEl);
        }
      });

      // Intercept ALL product-form submits across the site (capture phase →
      // we run before <product-form>'s own listener)
      document.addEventListener(
        'submit',
        (e) => {
          const form = e.target;
          if (!form || form.tagName !== 'FORM') return;
          const action = form.getAttribute('action') || '';
          if (!/\/cart\/add(\.|$|\?)/.test(action)) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          this.addFromForm(form);
        },
        true
      );
    }

    // ---------------------------------------------------------------------
    // Network
    // ---------------------------------------------------------------------
    async openWithRefresh() {
      this.open();
      try {
        const res = await fetch(CART_URL + '.js', {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        });
        if (!res.ok) throw new Error('cart fetch ' + res.status);
        const cart = await res.json();
        this.render(cart);
      } catch (e) {
        console.error('[san-cart-drawer] refresh failed', e);
      }
    }

    async addFromForm(form) {
      if (this._submitting) return;
      this._submitting = true;

      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) {
        submitBtn.classList.add('loading');
        submitBtn.setAttribute('aria-busy', 'true');
        submitBtn.disabled = true;
      }

      const formData = new FormData(form);
      try {
        const addRes = await fetch(CART_ADD_URL + '.js', {
          method: 'POST',
          headers: {
            Accept: 'application/javascript',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: formData,
          credentials: 'same-origin',
        });
        const addData = await addRes.json();
        if (addData.status && addData.status >= 400) {
          this.showError(addData.description || addData.message || 'No pudimos agregar este producto.');
          return;
        }

        // Refresh full cart state then open
        const cartRes = await fetch(CART_URL + '.js', {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        });
        const cart = await cartRes.json();
        this.render(cart);
        this.open();

        // Let the rest of the theme know
        this.dispatchEvent(
          new CustomEvent('san-cart:updated', {
            bubbles: true,
            detail: { cart, source: 'add' },
          })
        );
      } catch (e) {
        console.error('[san-cart-drawer] add failed', e);
        this.showError('No pudimos agregar este producto. Intenta de nuevo.');
      } finally {
        if (submitBtn) {
          submitBtn.classList.remove('loading');
          submitBtn.removeAttribute('aria-busy');
          submitBtn.disabled = false;
        }
        this._submitting = false;
      }
    }

    async changeLine(line, quantity, itemEl) {
      if (itemEl) itemEl.setAttribute('data-loading', '');
      this.errorsEl.textContent = '';

      try {
        const res = await fetch(CART_CHANGE_URL + '.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ line, quantity }),
          credentials: 'same-origin',
        });
        if (!res.ok) throw new Error('change ' + res.status);
        const cart = await res.json();
        this.render(cart);
        this.dispatchEvent(
          new CustomEvent('san-cart:updated', {
            bubbles: true,
            detail: { cart, source: 'change' },
          })
        );
      } catch (e) {
        console.error('[san-cart-drawer] change failed', e);
        this.showError('No pudimos actualizar el carrito.');
        if (itemEl) itemEl.removeAttribute('data-loading');
      }
    }

    // ---------------------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------------------
    render(cart) {
      this.cart = cart;
      const isEmpty = !cart || !cart.items || cart.items.length === 0;
      this.panel.setAttribute('data-state', isEmpty ? 'empty' : 'items');
      this.errorsEl.textContent = '';
      this.updateBubble(cart ? cart.item_count : 0);

      if (isEmpty) {
        this.itemsList.innerHTML = '';
        if (this.cartDiscountsEl) this.cartDiscountsEl.innerHTML = '';
        return;
      }

      this.renderItems(cart.items);
      this.renderCartDiscounts(cart.cart_level_discount_applications || []);
      this.subtotalEl.textContent = formatMoney(cart.total_price);
      this.countEl.textContent = '(' + cart.item_count + ')';
    }

    renderItems(items) {
      const frag = document.createDocumentFragment();
      items.forEach((item, i) => {
        const line = i + 1;
        const node = this.itemTemplate.content.firstElementChild.cloneNode(true);
        node.setAttribute('data-line', String(line));

        // Image
        const img = node.querySelector('[data-image]');
        const mediaWrap = node.querySelector('[data-media]');
        if (item.image) {
          img.src = sizedImage(item.image, 240);
          img.alt = item.product_title || item.title || '';
        } else {
          img.remove();
          mediaWrap.classList.add('san-cart-drawer__item-media--placeholder');
        }

        // Vendor
        const vendorEl = node.querySelector('[data-vendor]');
        if (item.vendor) {
          vendorEl.textContent = item.vendor;
        } else {
          vendorEl.remove();
        }

        // Name + link
        const nameEl = node.querySelector('[data-name]');
        nameEl.textContent = item.product_title || item.title || '';
        nameEl.setAttribute('href', item.url || '#');

        // Options
        const optionsEl = node.querySelector('[data-options]');
        const hasOptions =
          item.options_with_values &&
          item.options_with_values.length &&
          !item.product_has_only_default_variant;
        if (hasOptions) {
          item.options_with_values.forEach((opt) => {
            const div = document.createElement('div');
            div.className = 'san-cart-drawer__item-option';
            const dt = document.createElement('dt');
            dt.textContent = opt.name + ':';
            const dd = document.createElement('dd');
            dd.textContent = opt.value;
            div.appendChild(dt);
            div.appendChild(dd);
            optionsEl.appendChild(div);
          });
        } else {
          optionsEl.remove();
        }

        // Properties (custom line item props)
        if (item.properties) {
          const propsRoot = optionsEl && optionsEl.parentNode ? optionsEl : node.querySelector('[data-options-root]');
          Object.keys(item.properties).forEach((key) => {
            if (key.charAt(0) === '_') return;
            const value = item.properties[key];
            if (!value) return;
            const div = document.createElement('div');
            div.className = 'san-cart-drawer__item-option';
            const dt = document.createElement('dt');
            dt.textContent = key + ':';
            const dd = document.createElement('dd');
            dd.textContent = value;
            div.appendChild(dt);
            div.appendChild(dd);
            if (propsRoot && propsRoot.parentNode) {
              propsRoot.parentNode.insertBefore(div, propsRoot.nextSibling);
            }
          });
        }

        // Selling plan
        const planEl = node.querySelector('[data-selling-plan]');
        if (item.selling_plan_allocation && item.selling_plan_allocation.selling_plan) {
          planEl.textContent = item.selling_plan_allocation.selling_plan.name;
        } else if (planEl) {
          planEl.remove();
        }

        // Quantity stepper value
        const qtyValueEl = node.querySelector('[data-qty-value]');
        qtyValueEl.textContent = String(item.quantity);

        // Disable minus when qty is 1 (next click is "remove" via the link)
        // We let user keep clicking minus to reach 0 — server handles it.

        // Price
        const priceFinalEl = node.querySelector('[data-price-final]');
        priceFinalEl.textContent = formatMoney(item.final_line_price);

        const priceOldEl = node.querySelector('[data-price-old]');
        if (item.original_line_price !== item.final_line_price) {
          priceOldEl.textContent = formatMoney(item.original_line_price);
        } else {
          priceOldEl.remove();
        }

        // Unit price (per ml/g/etc.)
        const unitPriceEl = node.querySelector('[data-unit-price]');
        if (item.unit_price && item.unit_price_measurement) {
          const ref = item.unit_price_measurement.reference_value || 1;
          const refUnit = item.unit_price_measurement.reference_unit || '';
          const prefix = ref === 1 ? '' : ref + ' ';
          unitPriceEl.textContent = formatMoney(item.unit_price) + ' / ' + prefix + refUnit;
        } else {
          unitPriceEl.remove();
        }

        // Line discounts
        const discountsEl = node.querySelector('[data-line-discounts]');
        if (item.line_level_discount_allocations && item.line_level_discount_allocations.length) {
          item.line_level_discount_allocations.forEach((d) => {
            const li = document.createElement('li');
            li.className = 'san-cart-drawer__item-discount';
            li.textContent = d.discount_application.title + ' · −' + formatMoney(d.amount);
            discountsEl.appendChild(li);
          });
        } else {
          discountsEl.remove();
        }

        frag.appendChild(node);
      });

      this.itemsList.replaceChildren(frag);
    }

    renderCartDiscounts(discounts) {
      if (!this.cartDiscountsEl) return;
      this.cartDiscountsEl.innerHTML = '';
      if (!discounts.length) return;
      discounts.forEach((d) => {
        const li = document.createElement('li');
        li.className = 'san-cart-drawer__cart-discount';
        li.textContent = d.title + ' · −' + formatMoney(d.total_allocated_amount);
        this.cartDiscountsEl.appendChild(li);
      });
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

    showError(msg) {
      this.errorsEl.textContent = msg;
      clearTimeout(this._errorTimer);
      this._errorTimer = setTimeout(() => {
        if (this.errorsEl.textContent === msg) this.errorsEl.textContent = '';
      }, 6000);
    }

    // ---------------------------------------------------------------------
    // Open / close
    // ---------------------------------------------------------------------
    open() {
      if (this.isOpen) return;
      this.lastFocus = document.activeElement;
      this.classList.add('is-open');
      this.setAttribute('aria-hidden', 'false');
      document.body.classList.add('overflow-hidden');
      this.isOpen = true;

      // Focus close button after the slide-in animation begins
      requestAnimationFrame(() => {
        const focusable = this.querySelector('[data-close]');
        if (focusable) focusable.focus({ preventScroll: true });
      });
    }

    close() {
      if (!this.isOpen) return;
      this.classList.remove('is-open');
      this.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('overflow-hidden');
      this.isOpen = false;
      if (this.lastFocus && typeof this.lastFocus.focus === 'function') {
        try {
          this.lastFocus.focus({ preventScroll: true });
        } catch (e) {
          /* noop */
        }
      }
    }
  }

  if (!customElements.get('san-cart-drawer')) {
    customElements.define('san-cart-drawer', SanCartDrawer);
  }
})();
