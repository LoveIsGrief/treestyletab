/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  wait,
  configs
} from '/common/common.js';

import * as Constants from '/common/constants.js';
import * as Tabs from '/common/tabs.js';
import * as TabsUpdate from '/common/tabs-update.js';
import * as Tree from '/common/tree.js';
import TabFavIconHelper from '/extlib/TabFavIconHelper.js';

// eslint-disable-next-line no-unused-vars
function log(...args) {
  internalLogger('sidebar/sidebar-tabs', ...args);
}

let mInitialized = false;

export function init() {
  mInitialized = true;
  document.querySelector('#sync-throbber').addEventListener('animationiteration', synchronizeThrobberAnimation);

  const tabbar = document.querySelector('#tabbar');
  tabbar.addEventListener('overflow', onOverflow);
  tabbar.addEventListener('underflow', onUnderflow);
}

function getTwisty(tab) {
  return tab && tab.querySelector(`.${Constants.kTWISTY}`);
}

function getFavIcon(tab) {
  return tab && tab.querySelector(`.${Constants.kFAVICON}`);
}

function getSoundButton(tab) {
  return tab && tab.querySelector(`.${Constants.kSOUND_BUTTON}`);
}

function getDescendantsCounter(tab) {
  return tab && tab.querySelector(`.${Constants.kCOUNTER}`);
}

export function getClosebox(tab) {
  return tab && tab.querySelector(`.${Constants.kCLOSEBOX}`);
}


export function reserveToUpdateTwistyTooltip(tab) {
  if (tab.reservedUpdateTwistyTooltip)
    return;
  tab.reservedUpdateTwistyTooltip = () => {
    delete tab.reservedUpdateTwistyTooltip;
    updateTwistyTooltip(tab);
  };
  tab.addEventListener('mouseover', tab.reservedUpdateTwistyTooltip, { once: true });
}

function updateTwistyTooltip(tab) {
  let tooltip;
  if (Tabs.isSubtreeCollapsed(tab))
    tooltip = browser.i18n.getMessage('tab_twisty_collapsed_tooltip');
  else
    tooltip = browser.i18n.getMessage('tab_twisty_expanded_tooltip');
  getTwisty(tab).setAttribute('title', tooltip);
}

export function reserveToUpdateCloseboxTooltip(tab) {
  if (tab.reservedUpdateCloseboxTooltip)
    return;
  tab.reservedUpdateCloseboxTooltip = () => {
    delete tab.reservedUpdateCloseboxTooltip;
    updateCloseboxTooltip(tab);
  };
  tab.addEventListener('mouseover', tab.reservedUpdateCloseboxTooltip, { once: true });
}

function updateCloseboxTooltip(tab) {
  let tooltip;
  if (Tabs.isMultiselected(tab))
    tooltip = browser.i18n.getMessage('tab_closebox_tab_tooltip_multiselected');
  else if (Tabs.hasChildTabs(tab) && Tabs.isSubtreeCollapsed(tab))
    tooltip = browser.i18n.getMessage('tab_closebox_tree_tooltip');
  else
    tooltip = browser.i18n.getMessage('tab_closebox_tab_tooltip');
  getClosebox(tab).setAttribute('title', tooltip);
}

function updateDescendantsCount(tab) {
  const counter = getDescendantsCounter(tab);
  if (!counter)
    return;
  const descendants = Tabs.getDescendantTabs(tab);
  let count = descendants.length;
  if (configs.counterRole == Constants.kCOUNTER_ROLE_ALL_TABS)
    count += 1;
  counter.textContent = count;
}


export function reserveToUpdateTooltip(tab) {
  if (!mInitialized ||
      !Tabs.ensureLivingTab(tab) ||
      tab.reservedUpdateTabTooltip)
    return;
  tab.reservedUpdateTabTooltip = () => {
    delete tab.reservedUpdateTabTooltip;
    updateTabAndAncestorsTooltip(tab);
  };
  tab.addEventListener('mouseover', tab.reservedUpdateTabTooltip, { once: true });
}

function updateTabAndAncestorsTooltip(tab) {
  if (!Tabs.ensureLivingTab(tab))
    return;
  for (const updateTab of [tab].concat(Tabs.getAncestorTabs(tab))) {
    updateTooltip(updateTab);
  }
}

function updateTooltip(tab) {
  if (!Tabs.ensureLivingTab(tab))
    return;

  tab.dataset.labelWithDescendants = Tabs.getLabelWithDescendants(tab);

  if (configs.debug) {
    tab.dataset.label = `
${tab.apiTab.title}
#${tab.id}
(${tab.className})
uniqueId = <%${Constants.kPERSISTENT_ID}%>
duplicated = <%duplicated%> / <%originalTabId%> / <%originalId%>
restored = <%restored%>
tabId = ${tab.apiTab.id}
windowId = ${tab.apiTab.windowId}
`.trim();
    tab.setAttribute('title', tab.dataset.label);
    tab.uniqueId.then(uniqueId => {
      if (!Tabs.ensureLivingTab(tab))
        return;
      tab.setAttribute('title',
                       tab.dataset.label = tab.dataset.label
                         .replace(`<%${Constants.kPERSISTENT_ID}%>`, uniqueId.id)
                         .replace(`<%originalId%>`, uniqueId.originalId)
                         .replace(`<%originalTabId%>`, uniqueId.originalTabId)
                         .replace(`<%duplicated%>`, !!uniqueId.duplicated)
                         .replace(`<%restored%>`, !!uniqueId.restored));
    });
    return;
  }

  if (configs.showCollapsedDescendantsByTooltip &&
      Tabs.isSubtreeCollapsed(tab) &&
      Tabs.hasChildTabs(tab)) {
    tab.setAttribute('title', tab.dataset.labelWithDescendants);
    return;
  }

  const label = Tabs.getTabLabel(tab);
  if (Tabs.isPinned(tab) || label.classList.contains('overflow')) {
    tab.setAttribute('title', tab.dataset.label);
  }
  else {
    tab.removeAttribute('title');
  }
}


function reserveToUpdateLoadingState() {
  if (!mInitialized)
    return;
  if (reserveToUpdateLoadingState.waiting)
    clearTimeout(reserveToUpdateLoadingState.waiting);
  reserveToUpdateLoadingState.waiting = setTimeout(() => {
    delete reserveToUpdateLoadingState.waiting;
    updateLoadingState();
  }, 0);
}

function updateLoadingState() {
  if (document.querySelector(`#tabbar ${Tabs.kSELECTOR_VISIBLE_TAB}.loading`))
    document.documentElement.classList.add(Constants.kTABBAR_STATE_HAVE_LOADING_TAB);
  else
    document.documentElement.classList.remove(Constants.kTABBAR_STATE_HAVE_LOADING_TAB);
}

async function synchronizeThrobberAnimation() {
  const toBeSynchronizedTabs = document.querySelectorAll(`${Tabs.kSELECTOR_VISIBLE_TAB}.${Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED}`);
  if (toBeSynchronizedTabs.length == 0)
    return;

  for (const tab of Array.slice(toBeSynchronizedTabs)) {
    tab.classList.remove(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);
  }

  document.documentElement.classList.add(Constants.kTABBAR_STATE_THROBBER_SYNCHRONIZING);
  void document.documentElement.offsetWidth;
  document.documentElement.classList.remove(Constants.kTABBAR_STATE_THROBBER_SYNCHRONIZING);
}


export function reserveToUpdateSoundButtonTooltip(tab) {
  if (tab.reservedUpdateSoundButtonTooltip)
    return;
  tab.reservedUpdateSoundButtonTooltip = () => {
    delete tab.reservedUpdateSoundButtonTooltip;
    updateSoundButtonTooltip(tab);
  };
  tab.addEventListener('mouseover', tab.reservedUpdateSoundButtonTooltip, { once: true });
}

function updateSoundButtonTooltip(tab) {
  let tooltip = '';
  const suffix = Tabs.isMultiselected(tab) ? '_multiselected' : '' ;
  if (Tabs.maybeMuted(tab))
    tooltip = browser.i18n.getMessage(`tab_soundButton_muted_tooltip${suffix}`);
  else if (Tabs.maybeSoundPlaying(tab))
    tooltip = browser.i18n.getMessage(`tab_soundButton_playing_tooltip${suffix}`);

  getSoundButton(tab).setAttribute('title', tooltip);
}


export function updateAll() {
  updateLoadingState();
  synchronizeThrobberAnimation();
  for (const tab of Tabs.getAllTabs()) {
    reserveToUpdateTwistyTooltip(tab);
    reserveToUpdateCloseboxTooltip(tab);
    updateDescendantsCount(tab);
    updateTooltip(tab);
  }
}


function onOverflow(event) {
  const tab = Tabs.getTabFromChild(event.target);
  const label = Tabs.getTabLabel(tab);
  if (event.target == label && !Tabs.isPinned(tab)) {
    label.classList.add('overflow');
    reserveToUpdateTooltip(tab);
  }
}

function onUnderflow(event) {
  const tab = Tabs.getTabFromChild(event.target);
  const label = Tabs.getTabLabel(tab);
  if (event.target == label && !Tabs.isPinned(tab)) {
    label.classList.remove('overflow');
    reserveToUpdateTooltip(tab);
  }
}

Tabs.onBuilt.addListener((tab, info) => {
  const label = Tabs.getTabLabel(tab);

  const twisty = document.createElement('span');
  twisty.classList.add(Constants.kTWISTY);
  twisty.setAttribute('title', browser.i18n.getMessage('tab_twisty_collapsed_tooltip'));
  tab.insertBefore(twisty, label);

  const favicon = document.createElement('span');
  favicon.classList.add(Constants.kFAVICON);
  const faviconImage = favicon.appendChild(document.createElement('img'));
  faviconImage.classList.add(Constants.kFAVICON_IMAGE);
  const defaultIcon = favicon.appendChild(document.createElement('span'));
  defaultIcon.classList.add(Constants.kFAVICON_BUILTIN);
  defaultIcon.classList.add(Constants.kFAVICON_DEFAULT); // just for backward compatibility, and this should be removed from future versions
  const throbber = favicon.appendChild(document.createElement('span'));
  throbber.classList.add(Constants.kTHROBBER);
  tab.insertBefore(favicon, label);

  const counter = document.createElement('span');
  counter.classList.add(Constants.kCOUNTER);
  tab.appendChild(counter);

  const soundButton = document.createElement('button');
  soundButton.classList.add(Constants.kSOUND_BUTTON);
  tab.appendChild(soundButton);

  const closebox = document.createElement('span');
  closebox.classList.add(Constants.kCLOSEBOX);
  closebox.setAttribute('title', browser.i18n.getMessage('tab_closebox_tab_tooltip'));
  closebox.setAttribute('draggable', true); // this is required to cancel click by dragging
  tab.appendChild(closebox);

  const burster = document.createElement('span');
  burster.classList.add(Constants.kBURSTER);
  tab.appendChild(burster);

  const activeMarker = document.createElement('span');
  activeMarker.classList.add(Constants.kACTIVE_MARKER);
  tab.appendChild(activeMarker);

  const identityMarker = document.createElement('span');
  identityMarker.classList.add(Constants.kCONTEXTUAL_IDENTITY_MARKER);
  tab.appendChild(identityMarker);

  const extraItemsContainerBehind = document.createElement('span');
  extraItemsContainerBehind.classList.add(Constants.kEXTRA_ITEMS_CONTAINER);
  extraItemsContainerBehind.classList.add('behind');
  tab.appendChild(extraItemsContainerBehind);

  tab.setAttribute('draggable', true);

  if (!info.existing && configs.animation) {
    Tree.collapseExpandTab(tab, {
      collapsed: true,
      justNow:   true
    });
  }
});

Tabs.onCreated.addListener((tab, _info) => {
  tab.classList.add(Constants.kTAB_STATE_ANIMATION_READY);
});

Tabs.onRemoving.addListener((_tab, _info) => {
  reserveToUpdateLoadingState();
});

Tabs.onRemoved.addListener((tab, _info) => {
  if (Tabs.isCollapsed(tab) ||
      !configs.animation)
    return;

  return new Promise(async (resolve, _aReject) => {
    const tabRect = tab.getBoundingClientRect();
    tab.style.marginLeft = `${tabRect.width}px`;
    await wait(configs.animation ? configs.collapseDuration : 0);
    resolve();
  });
});

const mTabWasVisibleBeforeMoving = new WeakMap();

Tabs.onMoving.addListener((tab, _info) => {
  tab.classList.add(Constants.kTAB_STATE_MOVING);
  if (!configs.animation ||
      Tabs.isPinned(tab) ||
      Tabs.isOpening(tab))
    return;
  mTabWasVisibleBeforeMoving.set(tab, !Tabs.isCollapsed(tab));
  Tree.collapseExpandTab(tab, {
    collapsed: true,
    justNow:   true
  });
});

Tabs.onMoved.addListener(async (tab, _info) => {
  if (mInitialized)
    reserveToUpdateTooltip(Tabs.getParentTab(tab));

  const wasVisible = mTabWasVisibleBeforeMoving.get(tab);
  mTabWasVisibleBeforeMoving.delete(tab);

  if (!Tabs.ensureLivingTab(tab)) // it was removed while waiting
    return;

  if (configs.animation && wasVisible) {
    Tree.collapseExpandTab(tab, {
      collapsed: false
    });
    await wait(configs.collapseDuration);
  }
  tab.classList.remove(Constants.kTAB_STATE_MOVING);
});

Tabs.onStateChanged.addListener(tab => {
  if (tab.apiTab.status == 'loading')
    tab.classList.add(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);
  else
    tab.classList.remove(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);

  reserveToUpdateLoadingState();
});

Tabs.onLabelUpdated.addListener(tab => {
  reserveToUpdateTooltip(tab);
});

Tabs.onFaviconUpdated.addListener((tab, url) => {
  TabFavIconHelper.loadToImage({
    image: getFavIcon(tab).firstChild,
    tab:   tab.apiTab,
    url
  });
});

Tabs.onCollapsedStateChanged.addListener((tab, _info) => { reserveToUpdateLoadingState(tab); });

let mReservedUpdateActiveTab;
Tabs.onUpdated.addListener((tab, info) => {
  reserveToUpdateSoundButtonTooltip(tab);
  reserveToUpdateTooltip(tab);

  if (!('highlighted' in info))
    return;

  reserveToUpdateCloseboxTooltip(tab);

  if (mReservedUpdateActiveTab)
    clearTimeout(mReservedUpdateActiveTab);
  mReservedUpdateActiveTab = setTimeout(() => {
    mReservedUpdateActiveTab = null;
    const activeTab = Tabs.getCurrentTab();
    reserveToUpdateSoundButtonTooltip(activeTab);
    reserveToUpdateCloseboxTooltip(activeTab);
  }, 50);
});

Tabs.onParentTabUpdated.addListener(tab => { reserveToUpdateSoundButtonTooltip(tab); });

Tabs.onDetached.addListener((tab, _info) => {
  if (!mInitialized ||
      !Tabs.ensureLivingTab(tab))
    return;
  reserveToUpdateTooltip(Tabs.getParentTab(tab));
});

Tabs.onGroupTabDetected.addListener(tab => {
  // When a group tab is restored but pending, TST cannot update title of the tab itself.
  // For failsafe now we update the title based on its URL.
  const uri = tab.apiTab.url;
  const parameters = uri.replace(/^[^\?]+/, '');
  let title = parameters.match(/[&?]title=([^&;]*)/);
  if (!title)
    title = parameters.match(/^\?([^&;]*)/);
  title = title && decodeURIComponent(title[1]) ||
           browser.i18n.getMessage('groupTab_label_default');
  tab.apiTab.title = title;
  wait(0).then(() => {
    TabsUpdate.updateTab(tab, { title }, { tab: tab.apiTab });
  });
});

Tree.onAttached.addListener((tab, info = {}) => {
  if (!mInitialized)
    return;
  reserveToUpdateTwistyTooltip(info.parent);
  reserveToUpdateCloseboxTooltip(info.parent);
  if (info.newlyAttached) {
    const ancestors = [info.parent].concat(Tabs.getAncestorTabs(info.parent));
    for (const ancestor of ancestors) {
      updateDescendantsCount(ancestor);
    }
  }
  reserveToUpdateTooltip(info.parent);
});

Tree.onDetached.addListener((_aTab, detachInfo = {}) => {
  if (!mInitialized)
    return;
  const parent = detachInfo.oldParentTab;
  if (!parent)
    return;
  reserveToUpdateTwistyTooltip(parent);
  reserveToUpdateCloseboxTooltip(parent);
  reserveToUpdateTooltip(parent);
  const ancestors = [parent].concat(Tabs.getAncestorTabs(parent));
  for (const ancestor of ancestors) {
    updateDescendantsCount(ancestor);
  }
});

Tree.onSubtreeCollapsedStateChanging.addListener((tab, _info) => {
  reserveToUpdateTwistyTooltip(tab);
  reserveToUpdateCloseboxTooltip(tab);
  if (mInitialized)
    reserveToUpdateTooltip(tab);
});

configs.$addObserver(aChangedKey => {
  switch (aChangedKey) {
    case 'showCollapsedDescendantsByTooltip':
      if (mInitialized)
        for (const tab of Tabs.getAllTabs()) {
          reserveToUpdateTooltip(tab);
        }
      break;
  }
});
