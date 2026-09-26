import React from 'react';
import { render, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import Mousetrap from 'mousetrap';
import { HotkeysProvider } from './index';
Object.defineProperty(window.navigator, 'platform', { value: 'MacIntel', configurable: true });

jest.mock('mousetrap', () => {
  const bind = jest.fn();
  const unbind = jest.fn();
  return { __esModule: true, default: { bind, unbind } };
});

jest.mock('providers/ReduxStore/slices/collections/actions', () => ({
  saveMultipleRequests: jest.fn(),
  saveMultipleCollections: jest.fn(),
  saveMultipleFolders: jest.fn(),
  saveEnvironment: jest.fn(),
  reopenClosedTab: jest.fn(),
  saveRequest: jest.fn((uid, collectionUid, silent) => ({ type: 'saveRequest', payload: { uid, collectionUid, silent } })),
  closeTabs: jest.fn(({ tabUids }) => ({ type: 'closeTabs', payload: { tabUids } }))
}));

jest.mock('providers/ReduxStore/slices/app', () => ({
  toggleSidebarCollapse: jest.fn(),
  savePreferences: jest.fn()
}));

import { saveRequest, closeTabs } from 'providers/ReduxStore/slices/collections/actions';
import { getKeyBindingsForActionAllOS } from './keyMappings';

const makeRequest = (name, dirty) => ({
  type: 'http-request',
  name,
  uid: `req-${name}`,
  request: { method: 'GET', url: `/${name}` },
  draft: { request: { method: 'GET', url: dirty ? `/${name}-edited` : `/${name}` } }
});

const buildState = () => {
  const collectionA = {
    uid: 'col-a',
    name: 'A',
    items: [makeRequest('one', true), makeRequest('two', false), makeRequest('three', true)]
  };
  const collectionB = { uid: 'col-b', name: 'B', items: [makeRequest('other', false)] };

  return {
    workspaces: { workspaces: [], activeWorkspaceUid: null },
    tabs: {
      tabs: [
        { uid: 'req-one', collectionUid: 'col-a', type: 'request' },
        { uid: 'req-two', collectionUid: 'col-a', type: 'request' },
        { uid: 'req-three', collectionUid: 'col-a', type: 'request' },
        { uid: 'req-other', collectionUid: 'col-b', type: 'request' }
      ],
      activeTabUid: 'req-two'
    },
    collections: { collections: [collectionA, collectionB] },
    app: { preferences: { keybindingsEnabled: true, keyBindings: {} } }
  };
};

const mount = (state) => {
  const dispatch = jest.fn((action) => (typeof action === 'function' ? undefined : action));
  const store = { getState: () => state, dispatch, subscribe: () => () => {} };
  render(
    <Provider store={store}>
      <HotkeysProvider />
    </Provider>
  );
  return { dispatch };
};

const getHandler = (action) => {
  const expected = getKeyBindingsForActionAllOS(action, {});
  const call = Mousetrap.bind.mock.calls.find(([combos]) => Array.isArray(combos) && combos.join('|') === expected.join('|'));
  return call && call[1];
};

describe('closeOtherTabs hotkey', () => {
  beforeEach(() => {
    Mousetrap.bind.mockClear();
    Mousetrap.unbind.mockClear();
    saveRequest.mockClear();
    closeTabs.mockClear();
  });

  it('silently saves dirty sibling tabs and closes them, keeping the active tab', async () => {
    mount(buildState());
    const handler = getHandler('closeOtherTabs');
    expect(handler).toBeDefined();

    await act(async () => {
      await handler();
    });

    expect(saveRequest).toHaveBeenCalledTimes(2);
    expect(saveRequest).toHaveBeenCalledWith('req-one', 'col-a', true);
    expect(saveRequest).toHaveBeenCalledWith('req-three', 'col-a', true);
    expect(closeTabs).toHaveBeenCalledTimes(1);
    expect(closeTabs).toHaveBeenCalledWith({ tabUids: ['req-one', 'req-three'] });
  });

  it('does nothing when the active tab is the only tab in its collection', async () => {
    const state = buildState();
    state.tabs.tabs = [state.tabs.tabs[1]];
    mount(state);
    const handler = getHandler('closeOtherTabs');

    await act(async () => {
      await handler();
    });

    expect(saveRequest).not.toHaveBeenCalled();
    expect(closeTabs).not.toHaveBeenCalled();
  });

  it('does not touch tabs in other collections', async () => {
    const state = buildState();
    state.tabs.activeTabUid = 'req-other';
    mount(state);
    const handler = getHandler('closeOtherTabs');

    await act(async () => {
      await handler();
    });

    expect(closeTabs).not.toHaveBeenCalled();
  });

  it('still closes tabs when a save throws', async () => {
    saveRequest.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    mount(buildState());
    const handler = getHandler('closeOtherTabs');

    await act(async () => {
      await handler();
    });

    expect(closeTabs).toHaveBeenCalledWith({ tabUids: ['req-one', 'req-three'] });
  });
});
