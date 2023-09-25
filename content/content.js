const storage = {
  set (key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  get (key, defaultValue) {
    const value = localStorage.getItem(key);
    return typeof value === 'string'
      ? JSON.parse(value)
      : defaultValue
  },
};

const Settings = {
  get () {
    return storage.get('settings', {
      layout: 'fit-screen',
    })
  },

  set (value) {
    storage.set('settings', value);
  },
};

function log (message, ...values) {
  console.log('MultiFlow: ' + message, ...values);
}

function stop (event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function isModifier (event) {
  return navigator.platform.startsWith('Mac')
    ? event.metaKey
    : event.ctrlKey
}

function runWhen (condition, action, interval = 500) {
  return new Promise(function (resolve) {
    let id;
    const run = function () {
      if (condition()) {
        clearInterval(id);
        resolve(action());
        return true
      }
      return false
    };
    if (!run()) {
      id = setInterval(run, interval);
    }
  })
}

const WF_WIDTH = 700;
const rxUrl = /^(https?:\/\/)?(\w+\.)?workflowy.com/;
const rxHash = /^\/?#/;

function isWfUrl (input) {
  return rxHash.test(input) || rxUrl.test(input)
}

/**
 * Ensure a valid WorkFlowy URL
 *
 * @param   {string}  input   Either a hash #xxxxxxxx or full WorkFlowy URL
 * @param   {string}  origin  Optional WorkFlowy https:// origin
 * @return  {string}          A sanitised URL
 */
function makeWfUrl (input, origin = window.location.origin) {
  // non wf urls; return as-is
  if (!isWfUrl(input)) {
    return input
  }

  // sanitize path
  let path = input
    .replace(rxUrl, '')
    .replace(rxHash, '/#');

  // ensure path ends with hash
  if (path.length < 2) {
    path = '/#';
  }

  // return url
  return origin + path
}

function checkReady (doc = document) {
  return function () {
    const app = doc.getElementById('app');
    return app && app.innerHTML !== ''
  }
}

function getDoc (window) {
  return (window.document || window.contentDocument)
}

function getPage (frame) {
  return getDoc(frame).querySelector('.pageContainer')
}

function getLink (el, selector = 'a') {
  return el.matches(selector)
    ? el
    : el.closest(selector)
}

function addListeners (window, handler, type = 'page') {
  // helper
  function handleClicks (target, selector = 'a', type = 'page') {
    target.addEventListener('click', (event) => {
      const link = getLink(event.target, selector);
      if (link && isModifier(event)) {
        handler(makeWfUrl(link.href), true, type);
        stop(event);
      }
    }, { capture: true });
  }

  // elements
  const doc = getDoc(window);
  const page = getPage(window);
  const breadcrumbs = doc.querySelector('.breadcrumbs');
  const leftBar = doc.querySelector('.leftBar');

  // areas
  handleClicks(breadcrumbs);
  handleClicks(leftBar, 'a[href^="/#/"]');
  handleClicks(page, 'a.bullet', 'bullet');
  handleClicks(page, 'a.contentLink', 'link');
}

function addScript (text) {
  const script = document.createElement('script');
  script.className = 'multiflow-script';
  script.textContent = text;
  document.head.appendChild(script);
}

function setSetting (key, value) {
  document.body.setAttribute('data-' + key, value);
}

function getSetting (key) {
  const value = document.body.getAttribute('data-' + key);
  return /^\d+$/.value
    ? parseInt(value)
    : /^(true|false)$/.test(value)
      ? value === 'true'
      : value
}

function callBackground (command, value) {
  return new Promise(function (resolve) {
    console.group('MultiFlow: sending message:', command, value);
    chrome.runtime.sendMessage({ command, value }, function (...args) {
      if (args.length && args[0] !== null) {
        console.log('received response:', ...args);
      }
      console.groupEnd();
      resolve(...args);
    });
  })
}

function slugify (text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\W+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getTitle (frame) {
  if (Array.isArray(frame)) {
    return frame
      .map(getTitle)
      .filter(title => title)
      .join(' + ')
  }

  const title = frame.title;
  return title === 'WorkFlowy - Organize your brain.'
    ? 'Home'
    : title || ''
}

function getId (frame) {
  return slugify(getTitle(frame))
}

/**
 * Frame class
 *
 * @property {Page}         page
 * @property {number}       index
 * @property {Window}       window
 * @property {HTMLElement}  element
 */
class Frame {
  get window () {
    return this.element.contentWindow
  }

  /**
   *
   * @param {Page}    parent
   * @param {number}  index
   */
  constructor (parent, index) {
    this.parent = parent;
    this.index = index;
    this.element = null;
    this.loaded = false;
  }

  // -------------------------------------------------------------------------------------------------------------------
  // setup
  // -------------------------------------------------------------------------------------------------------------------

  init (container, src) {
    // blank frames
    const isHidden = !src;
    src = src || 'about:blank';

    // create iframe
    this.element = document.createElement('iframe');
    this.element.setAttribute('src', src);
    container.appendChild(this.element);

    // set up load
    this.loaded = false;
    this.element.addEventListener('load', () => {
      if (isWfUrl(this.window.location.href)) {
        log('loaded frame:', src);
        const document = getDoc(this.window);
        return runWhen(checkReady(document), () => this.onReady())
      }
    });

    // set up focus
    this.window.addEventListener('focus', () => this.onFocus());
    this.onFocus();

    // don't show hidden frames
    if (isHidden) {
      this.hide();
    }

    // return
    return this.element
  }

  onReady () {
    // loading progress
    this.loaded = true;
    this.parent.onFrameReady(this);

    // variables
    const parent = this.parent;
    const element = this.element;
    const document = getDoc(element);
    const page = document.querySelector('.page');

    // monitor navigation changes
    const observer = new MutationObserver(() => parent.onFrameNavigated());
    observer.observe(page, { childList: true });

    // listeners
    addListeners(this.window, this.onClick.bind(this));

    // close button
    if (this.index > 0) {
      const button = document.createElement('div');
      document.body.querySelector('.header').appendChild(button);
      button.style.marginLeft = '-10px';
      button.style.marginRight = '10px';
      button.innerHTML = '<div class="iconButton _pn8v4l"><svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke-linecap="round" stroke="#b7bcbf" style="position: relative;"><line x1="1" y1="1" x2="19" y2="19"></line><line x1="19" y1="1" x2="1" y2="19"></line></svg></div>';
      button.addEventListener('click', (event) => {
        isModifier(event)
          ? parent.removeFrame(this)
          : parent.hideFrame(this);
      });
    }
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // actions
  // ---------------------------------------------------------------------------------------------------------------------

  load (href) {
    this.window.location.href = href;
    this.show();
  }

  show () {
    this.element.classList.remove('hidden');
  }

  hide () {
    this.element.classList.add('hidden');
  }

  // -------------------------------------------------------------------------------------------------------------------
  // accessors
  // -------------------------------------------------------------------------------------------------------------------

  isVisible () {
    return !this.element.classList.contains('hidden')
  }

  setOrder (index) {
    this.element.style.order = index;
    this.index = index;
  }

  getData () {
    if (this.window) {
      const doc = getDoc(this.window);
      return {
        title: doc.title.replace(' - WorkFlowy', '') || ' LOADING ',
        hash: this.window.location.hash.substr(2),
        url: this.window.location.href,
      }
    }
    return {}
  }

  // -------------------------------------------------------------------------------------------------------------------
  // handlers
  // -------------------------------------------------------------------------------------------------------------------

  onFocus () {
    this.parent.onFrameFocused(this.element);
  }

  onClick (href, hasModifier, type) {
    type === 'link'
      ? this.parent.loadFrame(this, href, hasModifier)
      : this.parent.loadNextFrame(this, href);
  }
}

/**
 * Manager class
 *
 * @property {Frame[]}      frames
 * @property {HTMLElement}  container
 * @property {HTMLElement}  workflowy
 */
class Page {
  constructor () {
    this.frames = [];
    this.container = null;
    // this.onFrameNavigated = debounce(this.onFrameNavigated)
  }

  get numVisible () {
    return this.getVisibleFrames().length
  }

  // -------------------------------------------------------------------------------------------------------------------
  // setup
  // -------------------------------------------------------------------------------------------------------------------

  init () {
    // multiflow
    const multiflow = document.createElement('div');
    multiflow.setAttribute('id', 'multiflow');
    document.body.appendChild(multiflow);

    // container
    this.container = document.createElement('main');
    multiflow.appendChild(this.container);

    // add fake frames
    // const url = chrome.runtime.getURL('content/content.html')
    /*
    const sources = ['', '', '', '']
    sources.forEach(src => {
      this.addFrame(src)
    })
    */
  }

  load (urls = []) {
    // update frames
    const max = Math.max(urls.length, this.numVisible);
    for (let i = 0; i < max; i++) {
      const frame = this.frames[i];
      const url = urls[i];
      if (url) {
        frame
          ? frame.load(url)
          : this.addFrame(url);
      }
      else {
        this.hideFrame(frame);
      }
    }

    // switch mode
    this.switchMode(urls.length > 1);
  }

  switchMode (isMultiFlow, closedFrame) {
    // if switching to workflowy, show the open frame
    if (!isMultiFlow) {
      const openFrame = this.getVisibleFrames().find(frame => frame !== closedFrame);
      window.location.href = makeWfUrl(openFrame.window.location.href);
    }

    // values
    const mode = isMultiFlow
      ? 'multiflow'
      : 'workflowy';
    const icon = isMultiFlow
      ? chrome.runtime.getURL('assets/icons/icon-16@3x.png')
      : '/media/i/favicon.ico';
    const title = isMultiFlow
      ? getTitle(this.frames)
      : document.querySelector('.page .content').innerText + ' - WorkFlowy';

    // update
    document.querySelector('[rel*="icon"]').setAttribute('href', icon);
    setSetting('mode', mode);
    this.setTitle(title);
  }

  // -------------------------------------------------------------------------------------------------------------------
  // frames
  // -------------------------------------------------------------------------------------------------------------------

  getFrameIndex (frame) {
    return this.frames.indexOf(frame)
  }

  getVisibleFrames () {
    return this.frames.filter(frame => frame.isVisible())
  }

  addFrame (src) {
    this.setLoading(true);
    const frame = new Frame(this, this.frames.length);
    this.frames.push(frame);
    frame.init(this.container, src);
    this.updateLayout();
    return frame
  }

  loadFrame (frame, href, hasModifier) {
    hasModifier
      ? this.loadNextFrame(frame, href)
      : frame.load(href);
  }

  loadNextFrame (frame, href) {
    const index = this.frames.indexOf(frame);
    if (index > -1) {
      const nextFrame = this.frames[index + 1];
      nextFrame
        ? nextFrame.load(href)
        : this.addFrame(href);
      this.updateLayout();
    }
  }

  hideFrame (frame) {
    if (this.numVisible > 2) {
      const index = this.getFrameIndex(frame);
      this.frames.splice(index, 1);
      this.frames.push(frame);
      frame.hide();
      this.updateLayout();
    }
    else {
      this.switchMode(false, frame);
    }
  }

  removeFrame (frame) {
    if (this.numVisible > 2) {
      const index = this.getFrameIndex(frame);
      this.frames.splice(index, 1);
      this.container.removeChild(frame.element);
      this.updateLayout();
    }
    else {
      this.switchMode(false, frame);
    }
  }

  // -------------------------------------------------------------------------------------------------------------------
  // state updates
  // -------------------------------------------------------------------------------------------------------------------

  updateLayout () {
    // order
    this.frames.forEach((frame, index) => frame.setOrder(index + 1));

    // count
    setSetting('frames', this.numVisible);

    // info
    this.updateSession();

    // layout
    if (this.container) {
      const layout = getSetting('layout');
      this.container.style.width = layout === 'fit-content'
        ? (WF_WIDTH * this.numVisible) + 'px'
        : 'auto';
    }
  }

  updateSession () {
    const session = this.getSession();
    this.setTitle(session.title);
  }

  getSession () {
    const frames = this.getVisibleFrames().map(frame => frame.getData());
    const title = getTitle(frames);
    const urls = frames
      .map(frame => frame.url);
    const hash = frames
      .map(frame => frame.hash)
      .join('/');
    const id = frames
      .map(frame => getId(frame))
      .join('+');
    return {
      urls,
      title,
      hash,
      id,
    }
  }

  setLoading (state) {
    setSetting('loading', state);
    callBackground('setLoading', state);
  }

  setTitle (title) {
    if (title) {
      document.title = title;
    }
  }

  // -------------------------------------------------------------------------------------------------------------------
  // handlers
  // -------------------------------------------------------------------------------------------------------------------

  onFrameReady () {
    const frames = this.getVisibleFrames();
    const numLoaded = frames.filter(frame => !!frame.loaded).length;
    const pcLoaded = Math.floor((numLoaded / frames.length) * 100);
    log(`loaded ${pcLoaded} %`);
    if (numLoaded === frames.length) {
      this.setLoading(false);
      this.updateSession();
    }
  }

  onFrameFocused (element) {
    const frames = document.querySelectorAll('#multiflow iframe');
    const index = [...frames].indexOf(element);
    setSetting('focused', index);
  }

  onFrameNavigated () {
    this.updateSession();
  }
}

/**
 * Application class
 *
 * @property {boolean}    loadState
 * @property {Page}       page
 */
class App {
  /**
   * Application class
   */
  constructor () {
    // eslint-disable-next-line no-void
    void runWhen(
      () => document.getElementById('loadingScreen').style.display === 'none',
      () => this.init(),
    );
  }

  // -------------------------------------------------------------------------------------------------------------------
  // setup
  // -------------------------------------------------------------------------------------------------------------------

  init () {
    // page
    log('updating page structure');
    this.page = new Page();
    this.page.init();

    // settings
    log('loading settings');
    setSetting('mode', 'workflowy');

    // session settings
    const settings = Settings.get();
    this.setSettings(settings);

    // session
    log('checking for session...');
    const id = location.hash.substring(2);
    callBackground('page_loaded', id).then(session => {
      if (chrome.runtime.lastError) {
        console.warn('MultiFlow:', chrome.runtime.lastError.message);
      }
      if (session) {
        this.setSession(session);
      }
    });

    // wait for ready...
    log('waiting for load...');
    return runWhen(checkReady(document), () => this.onReady())
  }

  onReady () {
    // ready
    log('page ready!');
    addListeners(window, this.onItemClick.bind(this));

    // install message
    log('checking first run...');
    callBackground('check_install').then(state => {
      // first run
      if (state) {
        addScript('WF.showMessage("MultiFlow installed! Remember to pin the extension icon to work with Layouts and Sessions.")');
      }

      // disable desktop app links
      // FIXME strangely, MultiFlow doesn't even run if desktop links are on
      const command = 'WF.showMessage(\'MultiFlow: To ensure correct functionality, the setting "Open links in desktop app" has been disabled.\')';
      addScript(`
        const links = window?.feature('open_links_in_desktop')
        if (links?.on) {
          links.toggle()
          ${!state && command}
        }
      `);
    });
  }

  // handle clicks on main workflowy page
  onItemClick (url, hasModifier, _type) {
    if (hasModifier) {
      const left = makeWfUrl(window.location.href);
      const urls = [left, url];
      this.setSession({
        id: 'multiflow',
        urls,
      });
    }

    // navigate as usual
    else {
      window.location.href = url;
    }
  }

  // -------------------------------------------------------------------------------------------------------------------
  // data
  // -------------------------------------------------------------------------------------------------------------------

  setSettings (settings = {}) {
    Object.keys(settings).forEach(key => this.setSetting(key, settings[key]));
  }

  setSetting (key, value) {
    setSetting(key, value);
    if (key === 'layout') {
      this.page.updateLayout();
    }
  }

  getSetting (key) {
    return getSetting(key)
  }

  setSession (data = {}) {
    // debug
    // log('session ' + Object.keys(data).join(', '))

    // data
    const { settings, urls } = data;

    // settings
    if (settings) {
      this.setSettings(settings);
    }

    // urls
    if (urls) {
      if (Array.isArray(urls) && urls.length > 0) {
        setTimeout(() => {
          this.page.load(urls);
        }, 100);
      }
    }
  }

  getData () {
    return {
      session: this.page.getSession(),
      settings: {
        layout: this.getSetting('layout'),
      },
      state: {
        loading: this.getSetting('loading'),
        mode: this.getSetting('mode'),
      },
    }
  }
}

// imports

// global reference
let app;

// debug
log('running!');

// only run in top frame
if (window === window.top) {
  // instances
  app = new App();

  // commands
  chrome.runtime.onMessage.addListener(function (request = {}, _sender, callback) {
    const { command, value } = request;
    switch (command) {
      case 'setSession':
        return callback(app.setSession(value))

      case 'setSetting':
        return callback(app.setSetting(value.key, value.value))

      case 'getData':
        return callback(app.getData())

      default:
        // eslint-disable-next-line node/no-callback-literal
        return callback('Unknown command')
    }
  });
}
