import * as shortid from 'shortid';
import EventEmitter from 'events';

export interface ModalOptions {
  content: HTMLElement;
  shouldCloseOnOverlayClick?: boolean;
  shouldCloseOnEscPress?: boolean;
  contentContainerClassName?: string;
  onClose?: (triggerType: ModalCloseTriggerType, data: any) => void;
}

export enum ModalCloseTriggerType {
  ESC_KEY = 'esc-key',
  OVERLAY_CLICK = 'overlay-click',
  CLOSE_METHOD_CALL = 'close-method-call'
}

export enum ModalEvent {
  CLOSE = 'close'
}

export class Modal extends EventEmitter {
  readonly id = shortid.generate();
  readonly container = document.createElement('div');
  private overlayContainer = document.createElement('div');
  private contentContainer = document.createElement('div');
  private lastElementBlurTimeStamp = 0;

  private binded = {
    onOverlayClick: this.onOverlayClick.bind(this),
    onContentContainerKeyDown: this.onContentContainerKeyDown.bind(this),
    onBlur: this.onBlur.bind(this)
  };

  constructor(readonly options: ModalOptions) {
    super();

    // Container
    this.container.style.position = 'fixed';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.right = '0';
    this.container.style.bottom = '0';
    this.container.style.background = 'rgba(0, 0, 0, 0.6)';
    this.container.style.display = 'flex';
    this.container.style.justifyContent = 'center';
    this.container.style.alignItems = 'center';
    this.container.setAttribute('data-modal-id', this.id);

    this.overlayContainer.style.position = 'absolute';
    this.overlayContainer.style.top = '0';
    this.overlayContainer.style.left = '0';
    this.overlayContainer.style.right = '0';
    this.overlayContainer.style.bottom = '0';
    this.container.appendChild(this.overlayContainer);

    // Content container
    this.contentContainer.style.background = '#fff';
    this.contentContainer.style.borderRadius = '4px';
    this.contentContainer.style.zIndex = '1';
    if (options.contentContainerClassName) {
      this.contentContainer.classList.add(options.contentContainerClassName);
    }
    this.contentContainer.appendChild(options.content);
    this.container.appendChild(this.contentContainer);

    // Bind click event if necessary
    if (this.options.shouldCloseOnOverlayClick) {
      this.overlayContainer.addEventListener(
        'click',
        this.binded.onOverlayClick,
        false
      );
      this.contentContainer.addEventListener('blur', this.binded.onBlur, {
        capture: true
      });
    }

    if (this.options.shouldCloseOnEscPress) {
      this.contentContainer.addEventListener(
        'keydown',
        this.binded.onContentContainerKeyDown,
        false
      );
    }
  }

  mount() {
    document.body.appendChild(this.container);
  }

  unmount() {
    document.body.removeChild(this.container);
  }

  handleEscKeyPress() {
    if (!this.options.shouldCloseOnEscPress) return;
    this.close({
      triggerType: ModalCloseTriggerType.ESC_KEY
    });
  }

  private onContentContainerKeyDown(e: KeyboardEvent) {
    // Handle just ESC
    if (e.which != 27) return;

    // If user is focused on input element, stop propagation
    // so that modal manager would not catch for closeing predure
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLButtonElement
    ) {
      // This prevents modal-manager to catch
      e.stopPropagation();

      // Unfocus current item, so that user can pressed
      // ESC again to close modal.
      e.target.blur();

      return;
    }
  }

  private onOverlayClick(e: MouseEvent) {
    if (!this.options.shouldCloseOnOverlayClick) return;

    // When a user is focused on an element in the
    // modal content like input or select, the overlay can
    // be clicked for unfocusing purposes. We want to prevent
    // that. According to my trials, a `click` event is
    // dispatched ~100ms after `blur` event.
    if (e.timeStamp - this.lastElementBlurTimeStamp < 200) {
      return;
    }

    this.close({
      triggerType: ModalCloseTriggerType.OVERLAY_CLICK
    });
  }

  private onBlur(e: FocusEvent) {
    this.lastElementBlurTimeStamp = e.timeStamp;
  }

  close(options?: { triggerType?: ModalCloseTriggerType; data?: any }) {
    const { onClose } = this.options;
    if (onClose) {
      options = options || {};
      onClose(
        options.triggerType || ModalCloseTriggerType.CLOSE_METHOD_CALL,
        options.data
      );
    }
    this.emit(ModalEvent.CLOSE);
  }

  dispose() {
    this.overlayContainer.removeEventListener(
      'click',
      this.binded.onOverlayClick,
      false
    );
    this.contentContainer.removeEventListener('blur', this.binded.onBlur, {
      capture: true
    });
    this.contentContainer.removeEventListener(
      'keydown',
      this.binded.onContentContainerKeyDown,
      false
    );
    this.removeAllListeners();
  }
}
