import { useCallback } from 'react';
import { useStore } from 'react-redux';
import { cloneDeep, get } from 'lodash';
import toast from 'react-hot-toast';
import { resolveInheritedAuth } from 'utils/auth';
import {
  findCollectionByItemUid,
  getGlobalEnvironmentVariables,
  getGlobalEnvironmentVariablesMasked
} from 'utils/collections/index';
import { generateSnippet } from
  'components/Sidebar/Collections/Collection/CollectionItem/GenerateCodeItem/utils/snippet-generator';

const CURL_LANGUAGE = { target: 'shell', client: 'curl' };
const SNIPPET_ERROR = 'Error generating code snippet';

// Click-time action, not render state: the store is read on click so unsaved
// drafts and the latest environment/preference values are always used.
const useCopyAsCurl = () => {
  const store = useStore();

  return useCallback(
    async (item, collectionOverride = null) => {
      const state = store.getState();
      const { globalEnvironments, activeGlobalEnvironmentUid } = state.globalEnvironments;
      const { shouldInterpolate } = state.app.generateCode;

      // Draft-first, matching GenerateCodeItem's getNormalRequestData()
      const requestUrl
        = get(item, 'draft.request.url') !== undefined ? get(item, 'draft.request.url') : get(item, 'request.url');
      if (!requestUrl) {
        toast.error('URL is required');
        return;
      }

      const collectionOriginal
        = collectionOverride || findCollectionByItemUid(state.collections.collections, item.uid);
      if (!collectionOriginal) {
        toast.error('Request not found in any open collection');
        return;
      }

      // Same enrichment CodeView performs before handing the collection to buildHar
      const collection = cloneDeep(collectionOriginal);
      collection.globalEnvironmentVariables = getGlobalEnvironmentVariables({
        globalEnvironments,
        activeGlobalEnvironmentUid
      });
      collection.globalEnvSecrets = getGlobalEnvironmentVariablesMasked({
        globalEnvironments,
        activeGlobalEnvironmentUid
      });
      collection.globalEnvironments = globalEnvironments;
      collection.activeGlobalEnvironmentUid = activeGlobalEnvironmentUid;

      const request = get(item, 'draft.request') !== undefined ? get(item, 'draft.request') : get(item, 'request');
      const resolvedRequest = resolveInheritedAuth(item, collection);
      const finalItem = {
        ...item,
        request: {
          ...request,
          auth: resolvedRequest.auth
        }
      };

      const snippet = await generateSnippet({
        language: CURL_LANGUAGE,
        item: finalItem,
        collection,
        shouldInterpolate
      });

      if (!snippet || snippet === SNIPPET_ERROR) {
        toast.error('Failed to generate cURL command');
        return;
      }

      try {
        await navigator.clipboard.writeText(snippet);
        toast.success('cURL copied to clipboard');
      } catch (err) {
        toast.error('Failed to copy cURL to clipboard');
      }
    },
    [store]
  );
};

export default useCopyAsCurl;
