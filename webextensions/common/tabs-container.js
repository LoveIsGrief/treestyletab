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
  configs
} from './common.js';

import * as Tabs from './tabs.js';

// eslint-disable-next-line no-unused-vars
function log(...args) {
  internalLogger('common/tabs-container', ...args);
}


export function buildFor(windowId) {
  const container = document.createElement('ul');
  container.dataset.windowId = windowId;
  container.setAttribute('id', `window-${windowId}`);
  container.classList.add('tabs');

  container.dataset.internalMovingCount =
    container.dataset.internalClosingCount =
    container.dataset.alreadyMovedTabsCount =
    container.dataset.subTreeMovingCount =
    container.dataset.subTreeChildrenMovingCount =
    container.dataset.doingIntelligentlyCollapseExpandCount =
    container.dataset.internalFocusCount =
    container.dataset.internalSilentlyFocusCount =
    container.dataset.tryingReforcusForClosingCurrentTabCount = // used only on Firefox 64 and older
    container.dataset.duplicatingTabsCount = 0;

  container.dataset.preventAutoGroupNewTabsUntil = Date.now() + configs.autoGroupNewTabsDelayOnNewWindow;

  container.dataset.openingCount  = 0;
  container.dataset.openedNewTabs = '';
  container.dataset.openedNewTabsOpeners = '';

  container.dataset.toBeOpenedTabsWithPositions = 0;
  container.dataset.toBeOpenedOrphanTabs        = 0;
  container.dataset.toBeAttachedTabs            = 0;
  container.dataset.toBeDetachedTabs            = 0;

  return container;
}

export function incrementCounter(container, name, delta) {
  const count = parseInt(container.dataset[name]) + (delta || 1);
  container.dataset[name] = count;
  return count;
}

export function decrementCounter(container, name, delta) {
  const count = parseInt(container.dataset[name]) - (delta || 1);
  container.dataset[name] = count;
  return count;
}

export function clearAll() {
  const range = document.createRange();
  range.selectNodeContents(Tabs.allTabsContainer);
  range.deleteContents();
  range.detach();
}
