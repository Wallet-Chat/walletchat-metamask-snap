import { OnRpcRequestHandler } from '@metamask/snaps-types';

const getSnapState = async () => {
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

const setSnapState = (apiKey: string | null, address: string | null) => {
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

const makeRequestWithApiKey = async (apiKey: string, address: string) => {
  console.log('Making authenticated API call from snap...', address);
  let retVal = 1
  // simulate API call with latency
  await fetch(
    ` https://api.v2.walletchat.fun/v1/get_unread_cnt/${address}`,
    {
      method: 'GET',
      //credentials: 'include',  //had to remove for Metamask Snaps
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
      await setSnapState(null, null);
      return true;
    case 'set_snap_state':
      console.log('attempting setting API Key...', request.params);
      if (
        (request.params &&
        'apiKey' in request.params &&
        typeof request.params.apiKey === 'string') &&
        request.params &&
        'address' in request.params &&
        typeof request.params.address === 'string'
      ) {
        await setSnapState(request.params.apiKey, request.params.address);
        console.log('setting API Key...', request.params.apiKey);
        return true;
      }

      throw new Error('Must provide params.apiKey.');
  
    case 'is_signed_in':
      try {
        const state = await getSnapState();
        return Boolean(state?.apiKey);
      } catch (error) {
        return false;
      }

    case 'make_authenticated_request':
      // eslint-disable-next-line no-case-declarations
      const state = await getSnapState();
      const apiKey = state?.apiKey as string
      const address = state?.address as string
      if (apiKey) {
        return makeRequestWithApiKey(apiKey, address);
      }

      throw new Error('Must SIWE before making request.');


      case 'inAppNotify':
        return snap.request({
          method: 'snap_notify',
          params: {
            type: 'inApp',
            message: `Message Waiting at WalletChat.fun`,
          },
        });
        
      case 'nativeNotify':
        return snap.request({
          method: 'snap_notify',
          params: {
            type: 'native',
            message: `New Message Waiting at WalletChat.fun`,
          },
        });

    default:
      throw new Error('Method not found.');
  }
};
