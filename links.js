'use strict';

const voterAppUrl = document.querySelector('meta[name="voter-app-url"]').content.trim();
const webAppUrl = /^https:\/\/script\.google\.com\/(?:macros|a\/macros\/[A-Za-z0-9._-]+)\/s\/[A-Za-z0-9_-]+\/exec$/;

if (webAppUrl.test(voterAppUrl)) {
  for (const link of document.querySelectorAll('[data-election-page]')) {
    const url = new URL(voterAppUrl);
    url.searchParams.set('page', link.dataset.electionPage);
    link.href = url.href;
    link.hidden = false;
  }
  document.querySelector('#election-links').hidden = false;
} else {
  document.querySelector('#availability').hidden = false;
}
