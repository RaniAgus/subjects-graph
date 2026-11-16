// Keep native selects as the app's source of truth and as a no-enhancement fallback.
// The visible controls only translate user input into their standard change event.
let openedControl;

for (const select of document.querySelectorAll('.header-controls select')) {
  const field = select.closest('.select-field');
  const label = field.querySelector('label');
  const wrapper = document.createElement('div');
  wrapper.className = 'select-control';
  wrapper.hidden = true;
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'select-trigger';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-labelledby', `${label.id} ${select.id}-value`);
  const value = document.createElement('span');
  value.id = `${select.id}-value`;
  const chevron = document.createElement('span');
  chevron.className = 'select-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  trigger.append(value, chevron);
  const list = document.createElement('div');
  list.id = `${select.id}-options`;
  list.className = 'select-menu';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-labelledby', label.id);
  list.hidden = true;
  trigger.setAttribute('aria-controls', list.id);
  wrapper.append(trigger, list);
  field.append(wrapper);
  select.classList.add('select-native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  let active = -1;
  let query = '';
  let lastTyped = 0;
  const options = () => [...select.options];
  const available = () => options().map((option, index) => index).filter(index => !select.disabled && !options()[index].disabled);

  function highlight(index) {
    active = index;
    [...list.children].forEach((row, i) => row.classList.toggle('highlighted', i === active));
    if (active < 0) trigger.removeAttribute('aria-activedescendant');
    else {
      trigger.setAttribute('aria-activedescendant', `${select.id}-option-${active}`);
      list.children[active]?.scrollIntoView({ block: 'nearest' });
    }
  }

  function close() {
    list.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    if (openedControl === close) openedControl = undefined;
    query = '';
  }

  function open() {
    if (trigger.disabled) return;
    openedControl?.();
    openedControl = close;
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    highlight(available().includes(select.selectedIndex) ? select.selectedIndex : available()[0] ?? -1);
  }

  function commit(index) {
    if (!available().includes(index)) return;
    select.selectedIndex = index;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    close();
    trigger.focus();
  }

  function sync() {
    close();
    wrapper.hidden = select.style.display === 'none';
    trigger.disabled = select.disabled;
    value.textContent = select.selectedOptions[0]?.textContent ?? 'Seleccionar…';
    trigger.title = value.textContent;
    list.replaceChildren();
    options().forEach((option, index) => {
      const row = document.createElement('div');
      row.id = `${select.id}-option-${index}`;
      row.className = 'select-option';
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(index === select.selectedIndex));
      if (option.disabled) row.setAttribute('aria-disabled', 'true');
      const text = document.createElement('span');
      text.textContent = option.textContent;
      const check = document.createElement('span');
      check.className = 'select-check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = index === select.selectedIndex ? '✓' : '';
      row.append(text, check);
      row.addEventListener('pointermove', () => { if (!option.disabled) highlight(index); });
      row.addEventListener('click', () => commit(index));
      list.append(row);
    });
  }

  trigger.addEventListener('click', () => list.hidden ? open() : close());
  trigger.addEventListener('blur', close);
  // Keep keyboard focus on the combobox when selecting with a pointer.
  list.addEventListener('pointerdown', event => event.preventDefault());
  label.addEventListener('click', event => { event.preventDefault(); trigger.focus(); });
  document.addEventListener('pointerdown', event => { if (!wrapper.contains(event.target)) close(); });
  trigger.addEventListener('keydown', event => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ', 'Escape'];
    if (event.key === 'Tab') { close(); return; }
    if (keys.includes(event.key)) {
      event.preventDefault();
      if (event.key === 'Escape') { close(); return; }
      if (event.key === 'Enter' || event.key === ' ') {
        if (list.hidden) open(); else commit(active);
        return;
      }
      if (list.hidden) { open(); if (event.key.startsWith('Arrow')) return; }
      const indices = available();
      if (event.key === 'Home') highlight(indices[0] ?? -1);
      else if (event.key === 'End') highlight(indices.at(-1) ?? -1);
      else {
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const next = Math.max(0, Math.min(indices.length - 1, indices.indexOf(active) + direction));
        highlight(indices[next] ?? -1);
      }
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (list.hidden) open();
      const now = Date.now();
      query = (now - lastTyped > 700 ? '' : query) + event.key.toLocaleLowerCase();
      lastTyped = now;
      const index = available().find(i => options()[i].textContent.toLocaleLowerCase().startsWith(query));
      if (index !== undefined) highlight(index);
    }
  });
  select.addEventListener('change', sync);
  new MutationObserver(sync).observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'selected', 'label', 'style'] });
  sync();
}
