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

const Sessions = {
  get () {
    return storage.get('sessions', [])
  },

  set (value) {
    storage.set('sessions', value);
  },
};

function log (message, ...values) {
  console.log('MultiFlow: ' + message, ...values);
}

function checkInstall () {
  const key = 'installed';
  const firstRun = !storage.get(key);
  if (firstRun) {
    storage.set(key, 1);
  }
  return firstRun
}

log('background initialized!');

chrome.runtime.onInstalled.addListener(function () {
  // add declarative content
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { urlContains: 'workflowy.com' },
          }),
        ],
        actions: [
          new chrome.declarativeContent.ShowPageAction(),
        ],
      },
    ]);
  });

  /*
  // inject content into existing pages
  chrome.tabs.query({}, function (tabs) {
    tabs.filter(tab => tab.url && tab.url.startsWith('https://workflowy.com'))
      .forEach(tab => {
        chrome.tabs.executeScript(tab.id, { file: 'content/content.js' }, function (frames) {
          console.log('MultiFlow content script executed in', frames)
        })
      })
  })
  */
});

chrome.runtime.onMessage.addListener(function (request = {}, _sender, sendResponse) {
  // variables
  log('command received', request);
  const { command, value } = request;

  // page loaded
  if (command === 'page_loaded') {
    const sessions = Sessions.get();
    log('available sessions:', sessions);
    const session = sessions.find(session => session.id === value);
    if (session) {
      log('loading session:', session);
      sendResponse(session);
    }
  }

  // check install
  else if (command === 'check_install') {
    sendResponse(checkInstall());
  }

  // anything else
  else {
    sendResponse();
  }

  // mark as async
  return true
});

// show instructions page on install
chrome.runtime.onInstalled.addListener(function ({ reason }) {
  if (reason === 'install') {
    window.open('https://davestewart.co.uk/products/workflowy-multiflow/?utm_source=MultiFlow');
  }
});
