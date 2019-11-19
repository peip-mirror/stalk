import tippy, { createSingleton, Instance as TippyInstance } from 'tippy.js';
import { ToolbarMenu, ToolbarMenuItemOptions } from './menu';
import './toolbar.css';

export interface ToolbarOptions {
  element: HTMLDivElement;
  onLeftPaneButtonClick: (isExpanded: boolean) => void;
  onBottomPaneButtonClick: (isExpanded: boolean) => void;
}

export type ToolbarButtonType =
  | 'dataSources'
  | 'search'
  | 'traces'
  | 'groupLayoutMode'
  | 'groupingMode'
  | 'spanLabelling'
  | 'spanColoring'
  | 'leftPaneToggle'
  | 'bottomPaneToggle'
  | 'settings';

export type ToolbarButtonState = 'selected' | 'disabled';

export class Toolbar {
  private elements: {
    btn: {
      dataSources: HTMLDivElement;
      search: HTMLDivElement;
      traces: HTMLDivElement;
      groupLayoutMode: HTMLDivElement;
      groupingMode: HTMLDivElement;
      spanLabellingMode: HTMLDivElement;
      spanColoringMode: HTMLDivElement;
      leftPaneToggle: HTMLDivElement;
      bottomPaneToggle: HTMLDivElement;
      settings: HTMLDivElement;
    };
    tracesBadgeCount: HTMLDivElement;
  };
  private tooltips: {
    singleton: TippyInstance;
    dataSources: TippyInstance;
    search: TippyInstance;
    traces: TippyInstance;
    groupLayoutMode: TippyInstance;
    groupingMode: TippyInstance;
    spanLabellingMode: TippyInstance;
    spanColoringMode: TippyInstance;
    leftPaneToggle: TippyInstance;
    bottomPaneToggle: TippyInstance;
    settings: TippyInstance;
  };
  private dropdowns: {
    traces: TippyInstance;
    groupLayoutMode: TippyInstance;
    groupingMode: TippyInstance;
    spanLabellingMode: TippyInstance;
    spanColoringMode: TippyInstance;
  };

  private isLeftPanelExpanded = false;
  private isBottomPanelExpanded = true;

  private binded = {
    onLeftPaneToggleClick: this.onLeftPaneToggleClick.bind(this),
    onBottomPaneToggleClick: this.onBottomPaneToggleClick.bind(this),
    onGroupingModeMenuItemClick: this.onGroupingModeMenuItemClick.bind(this),
    onSpanLabellingMenuItemClick: this.onSpanLabellingMenuItemClick.bind(this),
    onSpanColoringMenuItemClick: this.onSpanColoringMenuItemClick.bind(this),
    onGroupLayoutMenuItemClick: this.onGroupLayoutMenuItemClick.bind(this)
  };

  private groupingModeMenu = new ToolbarMenu({
    // width: 150,
    items: [
      { type: 'item', text: 'Trace' },
      { type: 'item', text: 'Process' },
      { type: 'item', text: 'Service' },
      { type: 'divider' },
      { type: 'item', text: 'Custom', icon: '' },
      { type: 'item', text: 'Manage All', icon: '', disabled: true }
    ],
    onClick: this.binded.onGroupingModeMenuItemClick
  });
  private spanLabellingMenu = new ToolbarMenu({
    // width: 150,
    items: [
      { type: 'item', text: 'Operation' },
      { type: 'item', text: 'Service + Operation' },
      { type: 'divider' },
      { type: 'item', text: 'Custom', icon: '' },
      { type: 'item', text: 'Manage All', icon: '', disabled: true }
    ],
    onClick: this.binded.onSpanLabellingMenuItemClick
  });
  private spanColoringMenu = new ToolbarMenu({
    // width: 150,
    items: [
      { type: 'item', text: 'Operation' },
      { type: 'item', text: 'Service' },
      { type: 'divider' },
      { type: 'item', text: 'Custom', icon: '' },
      { type: 'item', text: 'Manage All', icon: '', disabled: true }
    ],
    onClick: this.binded.onSpanColoringMenuItemClick
  });
  private groupLayoutModeMenu = new ToolbarMenu({
    // width: 150,
    items: [
      { type: 'item', text: 'Fill' },
      { type: 'item', text: 'Compact' },
      { type: 'item', text: 'Waterfall' }
    ],
    onClick: this.binded.onGroupLayoutMenuItemClick
  });

  constructor(private options: ToolbarOptions) {
    const el = options.element;

    // Get dom references of required children components
    const dataSources = el.querySelector(
      '.toolbar-button.data-sources'
    ) as HTMLDivElement;
    const search = el.querySelector('.toolbar-button.search') as HTMLDivElement;
    const traces = el.querySelector('.toolbar-button.traces') as HTMLDivElement;
    const groupLayoutMode = el.querySelector(
      '.toolbar-button.group-layout-mode'
    ) as HTMLDivElement;
    const groupingMode = el.querySelector(
      '.toolbar-button.grouping-mode'
    ) as HTMLDivElement;
    const spanLabellingMode = el.querySelector(
      '.toolbar-button.span-labelling'
    ) as HTMLDivElement;
    const spanColoringMode = el.querySelector(
      '.toolbar-button.span-coloring'
    ) as HTMLDivElement;
    const leftPaneToggle = el.querySelector(
      '.toolbar-button.left-pane'
    ) as HTMLDivElement;
    const bottomPaneToggle = el.querySelector(
      '.toolbar-button.bottom-pane'
    ) as HTMLDivElement;
    const settings = el.querySelector(
      '.toolbar-button.settings'
    ) as HTMLDivElement;

    this.elements = {
      btn: {
        dataSources,
        search,
        traces,
        groupLayoutMode,
        groupingMode,
        spanLabellingMode,
        spanColoringMode,
        leftPaneToggle,
        bottomPaneToggle,
        settings
      },
      tracesBadgeCount: document.createElement('div')
    };

    for (let key in this.elements.btn) {
      const el = this.elements.btn[key];
      if (!el) throw new Error(`Expected button element: .${key}`);
    }
  }

  async init() {
    this.initTooltips();
    this.initDropdowns();
    this.initTracesBadgeCount();

    this.updateButtonSelection(
      'leftPaneToggle',
      this.isLeftPanelExpanded,
      'svg-fill'
    );
    this.updateButtonSelection(
      'bottomPaneToggle',
      this.isBottomPanelExpanded,
      'svg-fill'
    );

    this.bindEvents();
  }

  private initTooltips() {
    const tooltips = {
      dataSources: tippy(this.elements.btn.dataSources, {
        content: 'Data Sources'
      }),
      search: tippy(this.elements.btn.search, { content: 'Search Traces' }),
      traces: tippy(this.elements.btn.traces, {
        content: 'Traces in the Stage',
        multiple: true
      }),
      groupLayoutMode: tippy(this.elements.btn.groupLayoutMode, {
        content: 'Group Layout Mode',
        multiple: true
      }),
      groupingMode: tippy(this.elements.btn.groupingMode, {
        content: 'Grouping Mode',
        multiple: true
      }),
      spanLabellingMode: tippy(this.elements.btn.spanLabellingMode, {
        content: 'Span Labelling',
        multiple: true
      }),
      spanColoringMode: tippy(this.elements.btn.spanColoringMode, {
        content: 'Span Coloring',
        multiple: true
      }),
      leftPaneToggle: tippy(this.elements.btn.leftPaneToggle, {
        content: 'Toggle Left Pane'
      }),
      bottomPaneToggle: tippy(this.elements.btn.bottomPaneToggle, {
        content: 'Toggle Bottom Pane'
      }),
      settings: tippy(this.elements.btn.settings, { content: 'Settings' })
    };

    const singleton = createSingleton(Object.values(tooltips), {
      delay: 1000,
      updateDuration: 500,
      theme: 'toolbar-tooltip'
    });

    this.tooltips = { ...tooltips, singleton };
  }

  private initDropdowns() {
    this.dropdowns = {
      traces: tippy(this.elements.btn.traces, {
        content: 'Traces',
        multiple: true,
        appendTo: document.body,
        placement: 'bottom',
        updateDuration: 500,
        theme: 'toolbar-menu',
        trigger: 'click',
        interactive: true
      }),
      groupLayoutMode: tippy(this.elements.btn.groupLayoutMode, {
        content: this.groupLayoutModeMenu.element,
        multiple: true,
        appendTo: document.body,
        placement: 'bottom',
        updateDuration: 500,
        theme: 'toolbar-menu',
        trigger: 'click',
        interactive: true
      }),
      groupingMode: tippy(this.elements.btn.groupingMode, {
        content: this.groupingModeMenu.element,
        multiple: true,
        appendTo: document.body,
        placement: 'bottom',
        updateDuration: 500,
        theme: 'toolbar-menu',
        trigger: 'click',
        interactive: true
      }),
      spanLabellingMode: tippy(this.elements.btn.spanLabellingMode, {
        content: this.spanLabellingMenu.element,
        multiple: true,
        appendTo: document.body,
        placement: 'bottom',
        updateDuration: 500,
        theme: 'toolbar-menu',
        trigger: 'click',
        interactive: true
      }),
      spanColoringMode: tippy(this.elements.btn.spanColoringMode, {
        content: this.spanColoringMenu.element,
        multiple: true,
        appendTo: document.body,
        placement: 'bottom',
        updateDuration: 500,
        theme: 'toolbar-menu',
        trigger: 'click',
        interactive: true
      })
    };
  }

  private initTracesBadgeCount() {
    const el = this.elements.tracesBadgeCount;
    el.classList.add('toolbar-traces-badge-count');
  }

  updateTracesBadgeCount(count: number) {
    const el = this.elements.tracesBadgeCount;
    if (count > 0) {
      el.textContent = count + '';
      !el.parentElement && this.elements.btn.traces.appendChild(el);
    } else {
      el.parentElement && this.elements.btn.traces.removeChild(el);
    }
  }

  updateButtonSelection(
    type: ToolbarButtonType,
    isSelected: boolean,
    style: 'background-fill' | 'svg-fill'
  ) {
    const el = this.elements.btn[type];
    if (!el) return;
    const className = {
      'background-fill': 'selected',
      'svg-fill': 'selected-fill'
    }[style];
    isSelected ? el.classList.add(className) : el.classList.remove(className);
  }

  private bindEvents() {
    const { btn } = this.elements;
    btn.leftPaneToggle.addEventListener(
      'click',
      this.binded.onLeftPaneToggleClick,
      false
    );
    btn.bottomPaneToggle.addEventListener(
      'click',
      this.binded.onBottomPaneToggleClick,
      false
    );
  }

  private unbindEvents() {
    const { btn } = this.elements;
    btn.leftPaneToggle.removeEventListener(
      'click',
      this.binded.onLeftPaneToggleClick,
      false
    );
    btn.bottomPaneToggle.removeEventListener(
      'click',
      this.binded.onBottomPaneToggleClick,
      false
    );
  }

  private onGroupingModeMenuItemClick(
    item: ToolbarMenuItemOptions,
    index: number
  ) {
    this.groupingModeMenu.selectAt(index);
    this.dropdowns.groupingMode.hide();
  }

  private onSpanLabellingMenuItemClick(
    item: ToolbarMenuItemOptions,
    index: number
  ) {
    this.spanLabellingMenu.selectAt(index);
    this.dropdowns.spanLabellingMode.hide();
  }

  private onSpanColoringMenuItemClick(
    item: ToolbarMenuItemOptions,
    index: number
  ) {
    this.spanColoringMenu.selectAt(index);
    this.dropdowns.spanColoringMode.hide();
  }

  private onGroupLayoutMenuItemClick(
    item: ToolbarMenuItemOptions,
    index: number
  ) {
    this.groupLayoutModeMenu.selectAt(index);
    this.dropdowns.groupLayoutMode.hide();
  }

  private onLeftPaneToggleClick(e: MouseEvent) {
    this.isLeftPanelExpanded = !this.isLeftPanelExpanded;
    this.updateButtonSelection(
      'leftPaneToggle',
      this.isLeftPanelExpanded,
      'svg-fill'
    );
    this.options.onLeftPaneButtonClick(this.isLeftPanelExpanded);
  }

  private onBottomPaneToggleClick(e: MouseEvent) {
    this.isBottomPanelExpanded = !this.isBottomPanelExpanded;
    this.updateButtonSelection(
      'bottomPaneToggle',
      this.isBottomPanelExpanded,
      'svg-fill'
    );
    this.options.onBottomPaneButtonClick(this.isBottomPanelExpanded);
  }

  updateLeftPaneExpansion(isExpanded: boolean) {
    this.isLeftPanelExpanded = isExpanded;
    this.updateButtonSelection('leftPaneToggle', isExpanded, 'svg-fill');
  }

  updateBottomPaneExpansion(isExpanded: boolean) {
    this.isBottomPanelExpanded = isExpanded;
    this.updateButtonSelection('bottomPaneToggle', isExpanded, 'svg-fill');
  }

  dispose() {
    const tippies = [].concat(
      Object.values(this.tooltips),
      Object.values(this.dropdowns)
    );
    for (let tippyIns of tippies) {
      tippyIns.destroy();
    }
    this.tooltips = null;
    this.dropdowns = null;
    this.unbindEvents();
    this.elements = null;
    this.options = null;
  }
}
