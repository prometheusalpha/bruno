import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import themes from 'themes/index';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import CollectionItemRow from './index';
import { newHttpRequest } from 'providers/ReduxStore/slices/collections/actions';

jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn()
}));

jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
  useStore: jest.fn(() => ({ getState: jest.fn(() => ({})) }))
}));

jest.mock('react-dnd', () => ({
  useDrag: () => [{ isDragging: false }, jest.fn(), jest.fn()],
  useDrop: () => [{ isOver: false, canDrop: true }, jest.fn()]
}));

jest.mock('react-dnd-html5-backend', () => ({
  getEmptyImage: jest.fn()
}));

jest.mock('components/Sidebar/SidebarAccordionContext', () => ({
  useSidebarAccordion: () => ({ dropdownContainerRef: { current: null } })
}));

jest.mock('providers/ReduxStore/slices/collections/actions', () => ({
  newHttpRequest: jest.fn((payload) => ({ type: 'newHttpRequest', payload })),
  handleMultipleCollectionItemsDrop: jest.fn(),
  sendRequest: jest.fn(),
  showInFolder: jest.fn(),
  pasteItem: jest.fn(),
  saveRequest: jest.fn(),
  cloneItem: jest.fn()
}));

jest.mock('hooks/useCopyAsCurl', () => jest.fn(() => jest.fn()));
jest.mock('hooks/useKeybinding', () => jest.fn());
jest.mock('hooks/useSidebarSelectionClick', () => jest.fn(() => jest.fn()));

jest.mock(
  'src/selectors/tab',
  () => ({
    getTabUidForItem: () => () => null,
    isTabForItemActive: () => () => false,
    isTabForItemPresent: () => () => false
  }),
  { virtual: true }
);

// Render the menu items inline so they can be asserted on
jest.mock('ui/MenuDropdown', () => {
  const { forwardRef, useImperativeHandle, useState } = require('react');
  return forwardRef(({ items }, ref) => {
    const [opened, setOpened] = useState(false);
    useImperativeHandle(ref, () => ({ show: () => setOpened(true), hide: () => setOpened(false) }));
    if (!opened) return null;
    return (
      <div data-testid="menu">
        {items.map((item) =>
          item.type === 'divider' ? (
            <hr key={item.id} />
          ) : (
            <button key={item.id} data-testid={`menu-${item.id}`} onClick={item.onClick}>
              {item.label}
            </button>
          )
        )}
      </div>
    );
  });
});

jest.mock('components/Sidebar/Collections/Collection/CollectionItem/GenerateCodeItem', () => () => null);
jest.mock('components/ResponseExample/CreateExampleModal', () => () => null);
jest.mock('components/Sidebar/Collections/Collection/CollectionItem/CollectionItemInfo', () => () => null);
jest.mock('components/Sidebar/NewRequest', () => () => <div data-testid="new-request-modal" />);
jest.mock('components/Sidebar/NewFolder', () => () => null);
jest.mock('components/Sidebar/NewApp', () => () => null);
jest.mock('components/Sidebar/Collections/Collection/CollectionItem/RunCollectionItem', () => () => null);
jest.mock('components/Sidebar/Collections/Collection/CollectionItem/IgnoreCollectionItem', () => () => null);
jest.mock('components/Sidebar/Collections/Collection/CollectionItem/DeleteCollectionItems', () => () => null);
jest.mock('components/Sidebar/Collections/Collection/CollectionItem/RenameCollectionItem', () => () => null);
jest.mock('components/ResponsePane/NetworkError', () => () => null);

const buildFolderItem = (overrides = {}) => ({
  uid: 'f1',
  name: 'My Folder',
  type: 'folder',
  pathname: '/c1/f1',
  items: [],
  ...overrides
});

const buildRequestItem = (overrides = {}) => ({
  uid: 'r1',
  name: 'Get Users',
  type: 'http-request',
  pathname: '/c1/r1.bru',
  filename: 'Get Users.bru',
  request: { method: 'GET', url: 'https://example.test', headers: [], params: [], body: { mode: 'none' } },
  ...overrides
});

const renderRow = (item) => {
  const collection = {
    uid: 'c1',
    name: 'My Collection',
    pathname: '/c1',
    format: 'bru',
    items: [item]
  };
  useSelector.mockImplementation((selector) =>
    selector({
      app: { isDragging: false, clipboard: { hasCopiedItems: false } },
      collections: {
        collections: [collection],
        selectedSidebarUids: [],
        collectionSortOrder: null
      },
      workspaces: { workspaces: [], activeWorkspaceUid: null }
    })
  );
  return render(
    <ThemeProvider theme={themes.light}>
      <CollectionItemRow
        item={item}
        depth={0}
        collectionUid="c1"
        collectionPathname="/c1"
        openBulkMenu={jest.fn()}
      />
    </ThemeProvider>
  );
};

const openMenu = () => {
  fireEvent.contextMenu(screen.getByTestId('sidebar-collection-item-row'));
};

describe('CollectionItemRow folder context menu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDispatch.mockImplementation(() => (action) => (typeof action === 'function' ? action(() => {}) : action));
  });

  it('offers a New HTTP Request entry for folders', () => {
    renderRow(buildFolderItem());
    openMenu();

    expect(screen.getByTestId('menu-new-http-request')).toHaveTextContent('New HTTP Request');
  });

  it('does not offer New HTTP Request for request rows', () => {
    renderRow(buildRequestItem());
    openMenu();

    expect(screen.queryByTestId('menu-new-http-request')).not.toBeInTheDocument();
  });

  it('creates an http request with the default Untitled name, without opening the New Request modal', async () => {
    renderRow(buildFolderItem());
    openMenu();

    fireEvent.click(screen.getByTestId('menu-new-http-request'));

    await waitFor(() => expect(newHttpRequest).toHaveBeenCalledTimes(1));
    expect(newHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requestName: 'Untitled',
        filename: 'Untitled',
        requestType: 'http-request',
        requestMethod: 'GET',
        collectionUid: 'c1',
        itemUid: 'f1'
      })
    );
    expect(screen.queryByTestId('new-request-modal')).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('picks the next free Untitled name when one already exists in the folder', async () => {
    renderRow(
      buildFolderItem({
        items: [
          { uid: 'r1', name: 'Untitled', type: 'http-request', filename: 'Untitled.bru', pathname: '/c1/f1/Untitled.bru' },
          { uid: 'r2', name: 'Untitled1', type: 'http-request', filename: 'Untitled1.bru', pathname: '/c1/f1/Untitled1.bru' }
        ]
      })
    );
    openMenu();

    fireEvent.click(screen.getByTestId('menu-new-http-request'));

    await waitFor(() => expect(newHttpRequest).toHaveBeenCalledTimes(1));
    expect(newHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({ requestName: 'Untitled2', filename: 'Untitled2' })
    );
  });
});
