import { OnRpcRequestHandler } from '@metamask/snaps-types';

const getApiKey = async () => {
  const state = await snap.request({
    method: 'snap_manageState',
    params: {
      operation: 'get',
    },
  });

  if (state && 'apiKey' in state && typeof state.apiKey === 'string') {
    return state;
  }

  return null;
};

const setApiKey = (apiKey: string | null, address: string | null) => {
  return snap.request({
    method: 'snap_manageState',
    params: {
      operation: 'update',
      newState: {
        apiKey,
        address
      },
    },
  });
};

const getCurrAddress = async () => {
  const state = await snap.request({
    method: 'snap_manageState',
    params: {
      operation: 'get',
    },
  });

  if (state && 'address' in state && typeof state.address === 'string') {
    return state.address;
  }

  return null;
};

const setCurrAddress = (address: string | null) => {
  return snap.request({
    method: 'snap_manageState',
    params: {
      operation: 'update',
      newState: {
        address,
      },
    },
  });
};

const makeRequestWithApiKey = async (apiKey: string, address: string) => {
  console.log('Making authenticated API call from snap...', address);
  let retVal = 1
  // simulate API call with latency
  await fetch(
    ` https://api.v2.walletchat.fun/v1/get_unread_cnt/${address}`,
    {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    }
  )
    .then((response) => response.json())
    .then((count) => {
      console.log('✅ [GET][Unread Count] UNREAD COUNT:', count)
      retVal = count
    })
    .catch((error) => {
      console.log('🚨🚨[GET][Unread Count] Error:', error)
    })

    return retVal
};

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of `snap_dialog`.
 * @throws If the request method is not valid for this snap.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({ request }) => {
  switch (request.method) {
    case 'remove_api_key':
      await setApiKey(null, null);
      return true;
    case 'set_api_key':
      console.log('attempting setting API Key...', request.params);
      if (
        (request.params &&
        'apiKey' in request.params &&
        typeof request.params.apiKey === 'string') &&
        request.params &&
        'address' in request.params &&
        typeof request.params.address === 'string'
      ) {
        await setApiKey(request.params.apiKey, request.params.address);
        console.log('setting API Key...', request.params.apiKey);
        return true;
      }

      throw new Error('Must provide params.apiKey.');
    case 'set_address':
      console.log('attempting setting address...', request.params);
      if (
        request.params &&
        'address' in request.params &&
        typeof request.params.address === 'string'
      ) {
        await setCurrAddress(request.params.address);
        console.log('setting Address...', request.params.address);
        return true;
      }

      throw new Error('Must provide params.address.');
    case 'is_signed_in':
      try {
        const apiKey = await getApiKey();
        return Boolean(apiKey);
      } catch (error) {
        return false;
      }

    case 'make_authenticated_request':
      // eslint-disable-next-line no-case-declarations
      const stateJson = await getApiKey();
      const apiKey = stateJson?.apiKey as string
      const address = stateJson?.address as string
      if (apiKey) {
        return makeRequestWithApiKey(apiKey, address);
      }

      throw new Error('Must SIWE before making request.');
    default:
      throw new Error('Method not found.');
  }
};
