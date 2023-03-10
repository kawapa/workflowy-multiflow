# README

This repository stores a modified Chrome/Chromium extension - [WorkFlowy MultiFlow](https://chrome.google.com/webstore/detail/workflowy-multiflow/khjdmjcmpolknpccmaaipmidphjokhdf?hl=en-GB). The only difference between the one in Chrome Web Store and the one here is the favicon at the top bar of the browser. The author of the WorkFlowy MultiFlow extension ([Dave Stewart](https://davestewart.co.uk/products/workflowy-multiflow)) decided to override the Workflowy favicon (if multi-column view is active) and introduce his own, which I find quite irritiating. So, here's what this extension mod does:

![](image.png)

## Installation

1. Clone the repo: `git clone https://github.com/kawapa/workflowy-multiflow`.
2. Open Chrome/Chromium.
3. Click Customize and Control Chrome/Chromium (three dots on the top-right).
4. Click "More Tools" -> "Extensions".
5. Enable "Developer mode".
6. Click "Load unpacked" and select the directory with the cloned repo.
7. Restart the browser.
  
**Note!** If you have been using the original WorkFlowy MultiFlow previously, it might be required also to remove cached images the browser:

1. Click Customize and Control Chrome/Chromium (three dots on the top-right).
2. Click "More Tools" -> "Clear browsing data".
3. Set "Time range" to "All time".
4. Tick the option "Cached images and files".

## Other remarks

> Manifest version 2 is deprecated, and support will be removed in 2023. See https://developer.chrome.com/blog/mv2-transition/ for more details.

The extension uses The Manifest V2 which will be discontinued in January 2023, therefore this repo will need to be adjusted accordingly.

## License

Copyright belongs to the WorkFlowy MultiFlow owner - [Dave Stewart](https://davestewart.co.uk/).