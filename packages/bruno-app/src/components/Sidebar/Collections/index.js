import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Virtuoso } from 'react-virtuoso';
import StyledWrapper from './StyledWrapper';
import CreateOrOpenCollection from './CreateOrOpenCollection';
import CollectionSearch from './CollectionSearch/index';
import InlineCollectionCreator from './InlineCollectionCreator';
import SidebarRow from './SidebarRow';
import { clearSidebarSelection, expandCollection, expandItem } from 'providers/ReduxStore/slices/collections';
import { buildSidebarEntries, getSelectionInfo, findCollectionByUid, findCollectionByItemUid, getTreePathFromCollectionToItem } from 'utils/collections/index';
import { flattenSidebarTree, buildIndexes } from 'utils/collections/flattenSidebarTree';
import { CollectionItemDragPreview } from './Collection/CollectionItem/CollectionItemDragPreview';
import useBulkActionsMenu from 'hooks/useBulkActionsMenu';
import useDebounce from 'hooks/useDebounce';
import BulkActionsMenu from 'components/Sidebar/Collections/BulkActionsMenu';

const isEmptyQuery = (value) => typeof value === 'string' && value.trim() === '';

const Collections = ({ showSearch, isCreatingCollection, onCreateClick, onDismissCreate, onOpenAdvancedCreate }) => {
  const [searchText, setSearchText] = useState('');
  const trimmedSearchText = searchText.trim();
  const debouncedSearchText = useDebounce(trimmedSearchText, 300, { shouldSkipDebounce: isEmptyQuery });
  const { collections, collectionSortOrder, selectedSidebarUids } = useSelector((state) => state.collections);
  const { workspaces, activeWorkspaceUid } = useSelector((state) => state.workspaces);
  const activeTabUid = useSelector((state) => state.tabs.activeTabUid);
  const dispatch = useDispatch();
  const virtuosoRef = useRef(null);
  const lastScrolledTabUidRef = useRef(null);
  const focusRequestToken = useSelector((state) => state.app.focusSidebarRequestToken);
  const [flashRowUid, setFlashRowUid] = useState(null);
  // Separate refs: the expand effect and the scroll effect both watch the same token and
  // must each run exactly once per click. A single shared ref would make one of them skip.
  const expandTokenRef = useRef(0);
  const scrollTokenRef = useRef(0);

  const { openBulkMenu, menuProps } = useBulkActionsMenu();

  const activeWorkspace = workspaces.find((w) => w.uid === activeWorkspaceUid) || workspaces.find((w) => w.type === 'default');

  // Build the sidebar list in workspace.yml order. Each entry is either a fully
  // loaded collection (rendered via <Collection />) or, for non-default workspaces,
  // a "ghost" git-backed entry whose local folder is missing (rendered via
  // <GitRemoteCollectionRow /> so the user can click to clone it).
  const sidebarEntries = useMemo(
    () => buildSidebarEntries({ collections, workspaces, activeWorkspace, collectionSortOrder }),
    [activeWorkspace, collections, workspaces, collectionSortOrder]
  );

  // Flatten the tree into ordered rows. itemsByUid / collectionsByUid resolve a row's live object.
  const { rows, itemsByUid, collectionsByUid } = useMemo(
    () => flattenSidebarTree(sidebarEntries, { searchText: debouncedSearchText }),
    [sidebarEntries, debouncedSearchText]
  );

  // Ghost rows carry only path/name. GitRemoteCollectionRow needs the full entry (for `remote`).
  const ghostsByPath = useMemo(() => {
    const map = new Map();
    for (const entry of sidebarEntries) {
      if (entry.kind === 'ghost' && entry.entry?.path) map.set(entry.entry.path, entry.entry);
    }
    return map;
  }, [sidebarEntries]);

  // Multi-select drag context, computed once for the whole list and threaded to rows via SidebarRow.
  const selectionInfo = useMemo(
    () => (selectedSidebarUids.length > 1 ? getSelectionInfo({ collections, selectedUids: selectedSidebarUids }) : null),
    [collections, selectedSidebarUids]
  );

  // A collection can't be dragged together with folders/requests/apps from inside it.
  const hasMixedCollectionSelection = Boolean(
    selectionInfo?.hasCollection
    && (selectionInfo.hasFolder || selectionInfo.hasRequest || selectionInfo.hasApp)
  );

  // Whether a selected collection row can be dragged as part of the multi-selection.
  const isCollectionMultiDragDisabled = !!selectionInfo && (selectionInfo.hasExample || hasMixedCollectionSelection);

  // Whether a selected folder/request/app row can be dragged as part of the multi-selection.
  const isItemMultiDragDisabled = !!selectionInfo && (selectionInfo.hasExample || selectionInfo.hasCollection);

  const multiDragCollections = useMemo(() => {
    if (!selectionInfo || selectionInfo.hasFolder || selectionInfo.hasRequest || selectionInfo.hasApp || selectionInfo.hasExample) return null;
    return selectionInfo.effectiveSelection.filter((entry) => entry.type === 'collection').map((entry) => entry.collection);
  }, [selectionInfo]);

  const multiDragItems = useMemo(() => {
    if (!selectionInfo || selectionInfo.hasCollection || selectionInfo.hasExample) return null;
    return selectionInfo.effectiveSelection.map((entry) => ({ ...entry.item, sourceCollectionUid: entry.collectionUid }));
  }, [selectionInfo]);

  const { rowIndexByItemUid, rowIndexByCollectionUid } = useMemo(() => buildIndexes(rows), [rows]);

  // Resolve the active tab's row index (item rows first, then collection headers).
  const rowIndex = rowIndexByItemUid.get(activeTabUid);
  const activeRowIndex = activeTabUid !== null
    ? (rowIndex ?? rowIndexByCollectionUid.get(activeTabUid) ?? null)
    : null;

  // "Focus active request" click: make the target row exist by clearing the sidebar search
  // filter and expanding every collapsed ancestor (collection + parent folders).
  useEffect(() => {
    if (focusRequestToken === expandTokenRef.current) return;
    expandTokenRef.current = focusRequestToken;
    if (!activeTabUid) return;

    if (debouncedSearchText) setSearchText('');

    // Active tab is a collection header (collection settings tab).
    if (findCollectionByUid(collections, activeTabUid)) {
      dispatch(expandCollection(activeTabUid));
      return;
    }

    const collection = findCollectionByItemUid(collections, activeTabUid);
    // Transient request / response example: no sidebar row exists, so nothing to focus.
    if (!collection) return;

    if (collection.collapsed) dispatch(expandCollection(collection.uid));

    // Chain root -> item; expand the ancestors only, never the target request itself.
    const treePath = getTreePathFromCollectionToItem(collection, { uid: activeTabUid });
    treePath.forEach((node) => {
      if (node.uid === activeTabUid) return;
      if (node.collapsed) dispatch(expandItem({ collectionUid: collection.uid, itemUid: node.uid }));
    });
  }, [focusRequestToken]);

  useEffect(() => {
    if (activeRowIndex === null) return;
    if (lastScrolledTabUidRef.current === activeTabUid) return;
    virtuosoRef.current?.scrollIntoView({ index: activeRowIndex, behavior: 'smooth' });
    lastScrolledTabUidRef.current = activeTabUid;
  }, [activeTabUid, activeRowIndex]);

  // Runs after the expand effect above: `rows` rebuild on the render that follows those
  // dispatches, so `activeRowIndex` only becomes resolvable then.
  useEffect(() => {
    if (focusRequestToken === 0 || focusRequestToken === scrollTokenRef.current) return;
    if (activeRowIndex === null) return;

    virtuosoRef.current?.scrollIntoView({ index: activeRowIndex, behavior: 'smooth' });
    // Claim the scroll so the auto-scroll effect above does not fight over the next render.
    lastScrolledTabUidRef.current = activeTabUid;
    scrollTokenRef.current = focusRequestToken;
    setFlashRowUid(activeTabUid);
  }, [focusRequestToken, activeRowIndex]);

  useEffect(() => {
    if (!flashRowUid) return;
    const timer = setTimeout(() => setFlashRowUid(null), 1200);
    return () => clearTimeout(timer);
  }, [flashRowUid]);

  // Clear multi-selection only when clicking the bare scroller background.
  // The `contains` guard ignores events propagated from portaled menus/modals in <body>.
  // The `[data-sidebar-row]` check covers all row types and inline menus/modals rendered within a row.
  const handleContainerClick = (e) => {
    if (!e.currentTarget.contains(e.target)) return;
    if (e.target.closest('[data-sidebar-row]')) return;
    dispatch(clearSidebarSelection());
  };

  if (!sidebarEntries.length) {
    return (
      <StyledWrapper>
        {isCreatingCollection && (
          <InlineCollectionCreator
            onComplete={onDismissCreate}
            onCancel={onDismissCreate}
            onOpenAdvanced={onOpenAdvancedCreate}
          />
        )}
        {!isCreatingCollection && <CreateOrOpenCollection onCreateClick={onCreateClick} />}
      </StyledWrapper>
    );
  }

  return (
    <StyledWrapper data-testid="collections">
      {showSearch && (
        <CollectionSearch searchText={searchText} setSearchText={setSearchText} />
      )}

      {isCreatingCollection && (
        <InlineCollectionCreator
          onComplete={onDismissCreate}
          onCancel={onDismissCreate}
          onOpenAdvanced={onOpenAdvancedCreate}
        />
      )}

      <div
        className="collections-list flex flex-col flex-1 overflow-hidden"
        onClick={handleContainerClick}
      >
        <Virtuoso
          ref={virtuosoRef}
          data-testid="sidebar-collections-scroller"
          style={{ height: '100%' }}
          data={rows}
          computeItemKey={(_, row) => row.id}
          defaultItemHeight={26}
          increaseViewportBy={{ top: 400, bottom: 600 }}
          itemContent={(_, row) => (
            <SidebarRow
              row={row}
              searchText={debouncedSearchText}
              openBulkMenu={openBulkMenu}
              itemsByUid={itemsByUid}
              collectionsByUid={collectionsByUid}
              ghostsByPath={ghostsByPath}
              isCollectionMultiDragDisabled={isCollectionMultiDragDisabled}
              isItemMultiDragDisabled={isItemMultiDragDisabled}
              multiDragCollections={multiDragCollections}
              multiDragItems={multiDragItems}
              flashRowUid={flashRowUid}
            />
          )}
        />
      </div>
      <CollectionItemDragPreview />
      <BulkActionsMenu menuProps={menuProps} />
    </StyledWrapper>
  );
};

export default Collections;
