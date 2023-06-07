import { OnRpcRequestHandler, OnCronjobHandler } from '@metamask/snaps-types';
import { panel, text, heading } from '@metamask/snaps-ui'; 

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

const setSnapState = async (apiKey: string | null, address: string | null) => {
  const state = await getSnapState();
  const hasNotified = state?.hasNotified || false
  const unreadCount = state?.unreadCount || 0
  
  return snap.request({
    method: 'snap_manageState',
    params: {
      operation: 'update',
      newState: {
        apiKey,
        address,
        hasNotified,
        unreadCount
      },
    },
  });
};

const setSnapStateHasNotified = async (hasNotified: boolean) => {
  const state = await getSnapState();
  const apiKey = state?.apiKey as string
  const address = state?.address as string
  const unreadCount = state?.unreadCount as number

  return snap.request({
    method: 'snap_manageState',
    params: {
      operation: 'update',
      newState: {
        apiKey,
        address,
        hasNotified,
        unreadCount
      },
    },
  });
};

const setSnapStateUnreadCount = async (unreadCount: number) => {
  const state = await getSnapState();
  const apiKey = state?.apiKey as string
  const address = state?.address as string
  const hasNotified = state?.hasNotified as boolean

  return snap.request({
    method: 'snap_manageState',
    params: {
      operation: 'update',
      newState: {
        apiKey,
        address,
        hasNotified,
        unreadCount
      },
    },
  });
};

const getUnreadCountFromAPI = async (apiKey: string, address: string) => {
  //console.log('Making authenticated API call from snap...', address);
  let retVal = 0

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

const getLastUnreadMessage = async (apiKey: string, address: string) => {
  //console.log('Making authenticated API call from snap...', address);
  let chatData = ''

  await fetch(
    ` http://localhost:8088/v1/get_last_unread/${address}`,
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
    .then((chatItem) => {
      if (chatItem?.message) {
        console.log('✅ [GET][Unread Msg] UNREAD MSG DATA:', chatItem)
        chatData = chatItem
      }
    })
    .catch((error) => {
      console.log('🚨🚨[GET][Unread Count] Error:', error)
    })

    return chatData
};

export const onCronjob: OnCronjobHandler = async ({ request }) => {
  switch (request.method) {
    case 'fireCronjob':
      const state = await getSnapState();
      const apiKey = state?.apiKey as string
      const address = state?.address as string
      const hasNotified = state?.hasNotified 
      const unreadCount = state?.unreadCount

      let newMessages = 0
      if (apiKey) {
        newMessages = await getUnreadCountFromAPI(apiKey, address);
      }

      if(newMessages > 0) {
        //if (!hasNotified){
          //don't alert the user again 
          //await setSnapStateHasNotified(true)

          // return snap.request({
          //   method: 'snap_dialog',
          //   params: {
          //     type: 'alert',
          //     content: panel([heading('New Message at WalletChat.fun'), 
          //     text('Unread Count: ' + newMessages.toString() + 
          //     '\n\n Future unread message notifications can be found in the Notifications tab!')]),
          //   },
          // });

          const lastUnreadMsg = await getLastUnreadMessage(apiKey, address)

          let from = lastUnreadMsg?.sender_name || lastUnreadMsg.fromaddr
          const diagResponse = await snap.request({
            method: 'snap_dialog',
            params: {
              type: 'prompt',
              content: panel([heading('New Message From: ' + from), text(lastUnreadMsg?.message + '\r\n \r\n \r\n \r\n **Respond Here or at WalletChat.fun:** ')]),
              placeholder: 'Enter response to message here...',
            },
          });

          //mark item as read
          await fetch(
            ` https://api.v2.walletchat.fun/v1/update_chatitem/${lastUnreadMsg.fromaddr}/${lastUnreadMsg.toaddr}`,
            {
              method: 'PUT',
              //credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({ fromaddr: lastUnreadMsg.fromaddr,
                                     toaddr: lastUnreadMsg.toaddr,
                                     timestamp: lastUnreadMsg.timestamp,
                                     read: true }),
            }
          )
          //end marking item as read

          if (diagResponse) {
            console.log("got response: ", diagResponse)
            const timestamp = new Date()

            //send the response message:
            await fetch(
              ` https://api.v2.walletchat.fun/v1/create_chatitem`,
              {
                method: 'POST',
                //credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({ fromaddr: lastUnreadMsg.toaddr,
                                        toaddr: lastUnreadMsg.fromaddr,
                                        message: diagResponse,
                                        nftid: '0',
                                        lit_access_conditions: '',
                                        encrypted_sym_lit_key: '',
                                        timestamp,
                                        read: false,
                                        nftaddr: ''}),
              }
            )
          }

        //} else {
          //only add a new message if unread count has changed
          if (unreadCount != newMessages) {
            await setSnapStateUnreadCount(newMessages)

            const msg = newMessages.toString() + ' unread messages at WalletChat.fun'
            return snap.request({
              method: 'snap_notify',
              params: {
                type: 'inApp',
                message: msg,
              },
            });
          }
        //}
      } else {
        return null
      }
    default:
      throw new Error('Method not found.');
  }
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
        return getUnreadCountFromAPI(apiKey, address);
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

    default:
      throw new Error('Method not found.');
  }
};

