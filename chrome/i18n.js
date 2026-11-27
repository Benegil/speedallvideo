/* SpeedAllVideo — traduction des pages (popup, options) via browser.i18n.
   Textes dans _locales/<langue>/messages.json ; la langue suit celle du navigateur.
   data-i18n="clé" → textContent, data-i18n-aria="clé" → aria-label. */
const t = (key, ...args) => browser.i18n.getMessage(key, args.map(String)) || key;
document.documentElement.lang = browser.i18n.getUILanguage();
document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
