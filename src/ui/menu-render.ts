import type { BatteryLiveValueKey } from './battery-menu';
import type {
  ControlMenuItem,
  ImageLinkMenuItem,
  LetterMenuItem,
  MenuBehavior,
  MenuControlAction,
  MenuControlBinding,
  MenuName,
  SettingMenuItem,
  TextMenuItem
} from './menu-definitions';

export interface MenuRenderDeps {
  applyBehavior: (behavior: MenuBehavior, target?: MenuName, onSelect?: () => void) => void;
  formatBindingName: (value: MenuControlBinding) => string;
  startListeningForBinding: (
    action: MenuControlAction,
    slot: 0 | 1,
    element: HTMLButtonElement,
    ignoreKeyCode: string | null
  ) => void;
  liveMenuValueBindings: Map<BatteryLiveValueKey, HTMLElement>;
}

export const renderSettingItem = (item: SettingMenuItem, deps: MenuRenderDeps): HTMLElement => {
  const row = document.createElement('div');
  row.className = 'menu-setting-row';

  const label = document.createElement('div');
  label.className = 'menu-setting-label ui-label';
  label.textContent = item.label;

  const value = document.createElement('div');
  value.className = 'menu-setting-value ui-value';
  value.textContent = item.value;
  if (item.liveValueKey) {
    deps.liveMenuValueBindings.set(item.liveValueKey, value);
  }

  const actions = document.createElement('div');
  actions.className = 'menu-setting-actions';

  item.actions.forEach((action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pixel-button menu-btn-small';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      deps.applyBehavior(action.behavior, undefined, action.onSelect);
    });
    actions.appendChild(button);
  });

  row.append(label, value, actions);
  return row;
};

export const renderControlItem = (item: ControlMenuItem, deps: MenuRenderDeps): HTMLElement => {
  const row = document.createElement('div');
  row.className = 'menu-setting-row menu-control-row';

  const label = document.createElement('div');
  label.className = 'menu-setting-label ui-label';
  label.textContent = item.label;

  const slots = document.createElement('div');
  slots.className = 'menu-control-slots';

  const makeSlotButton = (slot: 0 | 1, value: MenuControlBinding) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pixel-button menu-btn-small menu-control-btn';
    button.textContent = deps.formatBindingName(value);
    button.addEventListener('click', () => {
      deps.startListeningForBinding(item.action, slot, button, null);
    });
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        deps.startListeningForBinding(item.action, slot, button, event.code);
      }
    });
    return button;
  };

  const primary = makeSlotButton(0, item.primary);
  const secondary = makeSlotButton(1, item.secondary);
  slots.append(primary, secondary);

  row.append(label, slots);
  return row;
};

export const renderTextItem = (item: TextMenuItem, deps: MenuRenderDeps): HTMLElement => {
  const row = document.createElement('div');
  row.className = 'menu-setting-row';

  const label = document.createElement('div');
  label.className = 'menu-setting-label ui-label';
  label.textContent = item.label;

  if (item.href) {
    const link = document.createElement('a');
    link.href = item.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'menu-link ui-value';
    link.textContent = item.value;
    row.append(label, link);
  } else {
    const value = document.createElement('div');
    value.className = 'menu-setting-value ui-value';
    value.textContent = item.value;
    if (item.liveValueKey) {
      deps.liveMenuValueBindings.set(item.liveValueKey, value);
    }
    row.append(label, value);
  }

  return row;
};

export const renderImageLinkItem = (item: ImageLinkMenuItem): HTMLElement => {
  const row = document.createElement('div');
  row.className = 'menu-setting-row menu-image-row';

  const label = document.createElement('div');
  label.className = 'menu-setting-label ui-label';
  label.textContent = item.label;

  const link = document.createElement('a');
  link.href = item.href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'menu-image-link';

  const image = document.createElement('img');
  image.src = item.src;
  image.alt = item.alt;
  image.className = 'menu-image';
  link.appendChild(image);

  row.append(label, link);
  return row;
};

export const renderLetterItem = (item: LetterMenuItem): HTMLElement => {
  const letter = document.createElement('article');
  letter.className = 'menu-letter';

  const header = document.createElement('header');
  header.className = 'menu-letter-header';

  const from = document.createElement('div');
  from.className = 'menu-letter-meta ui-value';
  from.textContent = `From: ${item.from}`;

  const to = document.createElement('div');
  to.className = 'menu-letter-meta ui-value';
  to.textContent = `To: ${item.to}`;

  const subject = document.createElement('div');
  subject.className = 'menu-letter-meta ui-value';
  subject.textContent = `Subject: ${item.subject}`;

  const dateUtc = document.createElement('div');
  dateUtc.className = 'menu-letter-meta ui-value';
  dateUtc.textContent = item.dateUtc;

  header.append(from, to, subject, dateUtc);

  const body = document.createElement('div');
  body.className = 'menu-letter-body';
  item.paragraphs.forEach((paragraphText) => {
    const paragraph = document.createElement('p');
    paragraph.className = 'menu-letter-paragraph';
    paragraph.textContent = paragraphText;
    body.appendChild(paragraph);
  });

  letter.append(header, body);
  return letter;
};
