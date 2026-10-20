class DetailsDisclosure extends HTMLElement {
  constructor() {
    super();
    this.mainDetailsToggle = this.querySelector('details');
    this.content = this.mainDetailsToggle.querySelector('summary').nextElementSibling;

    this.mainDetailsToggle.addEventListener('focusout', this.onFocusOut.bind(this));
    this.mainDetailsToggle.addEventListener('toggle', this.onToggle.bind(this));

    // Safari focuses <summary> on click but never focuses a plain link, so
    // pressing a link inside the open panel drops focus to <body>. onFocusOut
    // then closed the panel while the button was still down, and the click
    // never reached the link — every link in the menu was dead in Safari.
    // A press that starts inside is tracked until the button comes back up.
    this.addEventListener('pointerdown', () => {
      this.pressedInside = true;
      const release = () => setTimeout(() => (this.pressedInside = false));
      window.addEventListener('pointerup', release, { once: true });
      window.addEventListener('pointercancel', release, { once: true });
    });
  }

  onFocusOut() {
    setTimeout(() => {
      if (this.contains(document.activeElement)) return;
      if (this.pressedInside) {
        // Keep focus inside, so a later click outside still closes the panel.
        this.mainDetailsToggle.querySelector('summary').focus({ preventScroll: true });
        return;
      }
      this.close();
    });
  }

  onToggle() {
    if (!this.animations) this.animations = this.content.getAnimations();

    if (this.mainDetailsToggle.hasAttribute('open')) {
      this.animations.forEach((animation) => animation.play());
    } else {
      this.animations.forEach((animation) => animation.cancel());
    }
  }

  close() {
    this.mainDetailsToggle.removeAttribute('open');
    this.mainDetailsToggle.querySelector('summary').setAttribute('aria-expanded', false);
  }
}

customElements.define('details-disclosure', DetailsDisclosure);

class HeaderMenu extends DetailsDisclosure {
  constructor() {
    super();
    this.header = document.querySelector('.header-wrapper');
  }

  onToggle() {
    if (!this.header) return;
    this.header.preventHide = this.mainDetailsToggle.open;

    if (document.documentElement.style.getPropertyValue('--header-bottom-position-desktop') !== '') return;
    document.documentElement.style.setProperty(
      '--header-bottom-position-desktop',
      `${Math.floor(this.header.getBoundingClientRect().bottom)}px`
    );
  }
}

customElements.define('header-menu', HeaderMenu);
