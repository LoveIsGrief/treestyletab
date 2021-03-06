/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Tree Style Tab.
 *
 * The Initial Developer of the Original Code is YUKI "Piro" Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2011-2018
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 wanabe <https://github.com/wanabe>
 *                 Tetsuharu OHZEKI <https://github.com/saneyuki>
 *                 Xidorn Quan <https://github.com/upsuper> (Firefox 40+ support)
 *                 lv7777 (https://github.com/lv7777)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ******/
'use strict';

import {
  log as internalLogger,
  wait,
  configs
} from './common.js';

import * as Constants from './constants.js';
import * as Tabs from './tabs.js';
import * as ContextualIdentities from './contextual-identities.js';

function log(...args) {
  internalLogger('common/tabs-update', ...args);
}

export function updateTab(tab, newState = {}, options = {}) {
  if ('url' in newState) {
    tab.setAttribute(Constants.kCURRENT_URI, newState.url);
  }

  if ('url' in newState &&
      newState.url.indexOf(Constants.kGROUP_TAB_URI) == 0) {
    tab.classList.add(Constants.kTAB_STATE_GROUP_TAB);
    Tabs.addSpecialTabState(tab, Constants.kTAB_STATE_GROUP_TAB);
    Tabs.onGroupTabDetected.dispatch(tab);
  }

  if (options.forceApply ||
      'title' in newState) {
    let visibleLabel = newState.title;
    if (newState && newState.cookieStoreId) {
      const identity = ContextualIdentities.get(newState.cookieStoreId);
      if (identity)
        visibleLabel = `${newState.title} - ${identity.name}`;
    }
    if (options.forceApply && tab.apiTab) {
      browser.sessions.getTabValue(tab.apiTab.id, Constants.kTAB_STATE_UNREAD)
        .then(unread => {
          if (unread)
            tab.classList.add(Constants.kTAB_STATE_UNREAD);
          else
            tab.classList.remove(Constants.kTAB_STATE_UNREAD);
        });
    }
    else if (!Tabs.isActive(tab) && tab.apiTab) {
      tab.classList.add(Constants.kTAB_STATE_UNREAD);
      browser.sessions.setTabValue(tab.apiTab.id, Constants.kTAB_STATE_UNREAD, true);
    }
    Tabs.getTabLabelContent(tab).textContent = newState.title;
    tab.dataset.label = visibleLabel;
    Tabs.onLabelUpdated.dispatch(tab);
  }

  const openerOfGroupTab = Tabs.isGroupTab(tab) && Tabs.getOpenerFromGroupTab(tab);
  if (openerOfGroupTab &&
      openerOfGroupTab.apiTab.favIconUrl) {
    Tabs.onFaviconUpdated.dispatch(tab,
                                   openerOfGroupTab.apiTab.favIconUrl);
  }
  else if (options.forceApply ||
           'favIconUrl' in newState) {
    Tabs.onFaviconUpdated.dispatch(tab);
  }
  else if (Tabs.isGroupTab(tab)) {
    // "about:treestyletab-group" can set error icon for the favicon and
    // reloading doesn't cloear that, so we need to clear favIconUrl manually.
    tab.apiTab.favIconUrl = null;
    Tabs.onFaviconUpdated.dispatch(tab, null);
  }

  if ('status' in newState) {
    const reallyChanged = !tab.classList.contains(newState.status);
    tab.classList.remove(newState.status == 'loading' ? 'complete' : 'loading');
    tab.classList.add(newState.status);
    if (newState.status == 'loading') {
      tab.classList.remove(Constants.kTAB_STATE_BURSTING);
    }
    else if (!options.forceApply && reallyChanged) {
      tab.classList.add(Constants.kTAB_STATE_BURSTING);
      if (tab.delayedBurstEnd)
        clearTimeout(tab.delayedBurstEnd);
      tab.delayedBurstEnd = setTimeout(() => {
        delete tab.delayedBurstEnd;
        tab.classList.remove(Constants.kTAB_STATE_BURSTING);
        if (!Tabs.isActive(tab))
          tab.classList.add(Constants.kTAB_STATE_NOT_ACTIVATED_SINCE_LOAD);
      }, configs.burstDuration);
    }
    Tabs.onStateChanged.dispatch(tab);
  }

  if ((options.forceApply ||
       'pinned' in newState) &&
      newState.pinned != tab.classList.contains(Constants.kTAB_STATE_PINNED)) {
    if (newState.pinned) {
      tab.classList.add(Constants.kTAB_STATE_PINNED);
      tab.removeAttribute(Constants.kLEVEL); // don't indent pinned tabs!
      Tabs.onPinned.dispatch(tab);
    }
    else {
      tab.classList.remove(Constants.kTAB_STATE_PINNED);
      Tabs.onUnpinned.dispatch(tab);
    }
  }

  if (options.forceApply ||
      'audible' in newState) {
    if (newState.audible)
      tab.classList.add(Constants.kTAB_STATE_AUDIBLE);
    else
      tab.classList.remove(Constants.kTAB_STATE_AUDIBLE);
  }

  if (options.forceApply ||
      'mutedInfo' in newState) {
    if (newState.mutedInfo && newState.mutedInfo.muted)
      tab.classList.add(Constants.kTAB_STATE_MUTED);
    else
      tab.classList.remove(Constants.kTAB_STATE_MUTED);
  }

  if (tab.apiTab &&
      tab.apiTab.audible &&
      !tab.apiTab.mutedInfo.muted)
    tab.classList.add(Constants.kTAB_STATE_SOUND_PLAYING);
  else
    tab.classList.remove(Constants.kTAB_STATE_SOUND_PLAYING);

  if (options.forceApply ||
      'cookieStoreId' in newState) {
    for (const className of tab.classList) {
      if (className.indexOf('contextual-identity-') == 0)
        tab.classList.remove(className);
    }
    if (newState.cookieStoreId)
      tab.classList.add(`contextual-identity-${newState.cookieStoreId}`);
  }

  if (options.forceApply ||
      'incognito' in newState) {
    if (newState.incognito)
      tab.classList.add(Constants.kTAB_STATE_PRIVATE_BROWSING);
    else
      tab.classList.remove(Constants.kTAB_STATE_PRIVATE_BROWSING);
  }

  if (options.forceApply ||
      'hidden' in newState) {
    if (newState.hidden) {
      if (!tab.classList.contains(Constants.kTAB_STATE_HIDDEN)) {
        tab.classList.add(Constants.kTAB_STATE_HIDDEN);
        Tabs.onHidden.dispatch(tab);
      }
    }
    else if (tab.classList.contains(Constants.kTAB_STATE_HIDDEN)) {
      tab.classList.remove(Constants.kTAB_STATE_HIDDEN);
      Tabs.onShown.dispatch(tab);
    }
  }

  if (options.forceApply ||
      'highlighted' in newState) {
    if (newState.highlighted)
      tab.classList.add(Constants.kTAB_STATE_HIGHLIGHTED);
    else
      tab.classList.remove(Constants.kTAB_STATE_HIGHLIGHTED);

    updateMultipleHighlighted(tab);
  }

  if (options.forceApply ||
      'attention' in newState) {
    if (newState.attention)
      tab.classList.add(Constants.kTAB_STATE_ATTENTION);
    else
      tab.classList.remove(Constants.kTAB_STATE_ATTENTION);
  }

  if (options.forceApply ||
      'discarded' in newState) {
    wait(0).then(() => {
      // Don't set this class immediately, because we need to know
      // the newly focused tab *was* discarded on onTabClosed handler.
      if (newState.discarded)
        tab.classList.add(Constants.kTAB_STATE_DISCARDED);
      else
        tab.classList.remove(Constants.kTAB_STATE_DISCARDED);
    });
  }
}

export async function updateTabsHighlighted(highlightInfo) {
  if (Tabs.hasCreatingTab())
    await Tabs.waitUntilAllTabsAreCreated();
  const container = Tabs.getTabsContainer(highlightInfo.windowId);
  if (!container)
    return;

  //const startAt = Date.now();

  const idSelectors = [];
  for (const id of highlightInfo.tabIds) {
    idSelectors.push(`#tab-${highlightInfo.windowId}-${id}`);
  }
  const unhighlightedTabs = container.querySelectorAll(`.${Constants.kTAB_STATE_HIGHLIGHTED}:not(:-moz-any(${idSelectors.join(', ')}))`);
  const highlightedTabs = container.querySelectorAll(`:-moz-any(${idSelectors.join(',')}):not(.${Constants.kTAB_STATE_HIGHLIGHTED})`);
  log('updateTabsHighlighted ', { updateTabsHighlighted, highlightedTabs, unhighlightedTabs});
  for (const tab of unhighlightedTabs) {
    updateTabHighlighted(tab, false);
  }
  for (const tab of highlightedTabs) {
    updateTabHighlighted(tab, true);
  }
  if (unhighlightedTabs.length > 0 ||
      highlightedTabs.length > 0)
    updateMultipleHighlighted(highlightInfo.windowId);

  /*
  let changed = false;
  const highlightedTabs   = [];
  const unhighlightedTabs = [];
  for (const tab of container.children) {
    if (highlightInfo.tabIds.includes(tab.apiTab.id))
      highlightedTabs.push(tab);
    else
      unhighlightedTabs.push(tab);
  }
  // unhighlight all at first.
  for (const tab of unhighlightedTabs.concat(highlightedTabs)) {
    const highlighted = highlightedTabs.includes(tab);
    changed = updateTabHighlighted(tab, highlighted) || changed;
  }
  if (changed)
    updateMultipleHighlighted(highlightInfo.windowId);
  */

  //console.log(`updateTabsHighlighted: ${Date.now() - startAt}ms`);
}
async function updateTabHighlighted(tab, highlighted) {
  log(`highlighted status of ${tab.id}: `, { old: Tabs.isHighlighted(tab), new: highlighted });
  //if (Tabs.isHighlighted(tab) == highlighted)
  //  return false;
  if (highlighted)
    tab.classList.add(Constants.kTAB_STATE_HIGHLIGHTED);
  else
    tab.classList.remove(Constants.kTAB_STATE_HIGHLIGHTED);
  tab.apiTab.highlighted = highlighted;
  Tabs.onUpdated.dispatch(tab, { highlighted });
  return true;
}

function updateMultipleHighlighted(hint) {
  const container = Tabs.getTabsContainer(hint);
  if (!container)
    return;
  if (container.querySelector(`${Tabs.kSELECTOR_LIVE_TAB}.${Constants.kTAB_STATE_HIGHLIGHTED} ~ ${Tabs.kSELECTOR_LIVE_TAB}.${Constants.kTAB_STATE_HIGHLIGHTED}`))
    container.classList.add(Constants.kTABBAR_STATE_MULTIPLE_HIGHLIGHTED);
  else
    container.classList.remove(Constants.kTABBAR_STATE_MULTIPLE_HIGHLIGHTED);
}

export function updateParentTab(parent) {
  if (!Tabs.ensureLivingTab(parent))
    return;

  const children = Tabs.getChildTabs(parent);

  if (children.some(Tabs.maybeSoundPlaying))
    parent.classList.add(Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER);
  else
    parent.classList.remove(Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER);

  if (children.some(Tabs.maybeMuted))
    parent.classList.add(Constants.kTAB_STATE_HAS_MUTED_MEMBER);
  else
    parent.classList.remove(Constants.kTAB_STATE_HAS_MUTED_MEMBER);

  updateParentTab(Tabs.getParentTab(parent));

  Tabs.onParentTabUpdated.dispatch(parent);
}
