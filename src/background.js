'use strict';
chrome.action.onClicked.addListener(function(tab) {
  chrome.tabs.create({ url: "form.html" });
});

