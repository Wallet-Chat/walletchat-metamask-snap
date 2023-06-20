import { OnRpcRequestHandler, OnCronjobHandler } from '@metamask/snaps-types';
import { panel, text, heading, divider } from '@metamask/snaps-ui'; 

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
  const isDialogOn = state?.isDialogOn || true
  let unreadCount = state?.unreadCount || 0

  if (apiKey == null) {
    unreadCount = 0
  }
  
  return snap.request({
    method: 'snap_manageState',
    params: {
      operation: 'update',
      newState: {
        apiKey,
        address,
        isDialogOn,
        unreadCount
      },
    },
  });
};

const setSnapStateisDialogOn = async (isDialogOn: boolean) => {
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
        isDialogOn,
        unreadCount
      },
    },
  });
};

const setSnapStateUnreadCount = async (unreadCount: number) => {
  const state = await getSnapState();
  const apiKey = state?.apiKey as string
  const address = state?.address as string
  const isDialogOn = state?.isDialogOn as boolean

  return snap.request({
    method: 'snap_manageState',
    params: {
      operation: 'update',
      newState: {
        apiKey,
        address,
        isDialogOn,
        unreadCount
      },
    },
  });
};

const getUnreadCountFromAPI = async (apiKey: string, address: string) => {
  let retVal = 0

  await fetch(
    ` https://api.v2.walletchat.fun/v1/get_unread_cnt/${address}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    }
  )
    .then((response) => response.json())
    .then((count) => {
      retVal = count
    })
    .catch((error) => {
      console.log('🚨[GET][Unread Count] Error:', error)
    })

    return retVal
};

const getLastUnreadMessage = async (apiKey: string, address: string) => {
  let chatData = ''

  await fetch(
    ` https://api.v2.walletchat.fun/v1/get_last_unread/${address}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    }
  )
    .then((response) => response.json())
    .then((chatItem) => {
      if (chatItem?.message) {
        chatData = chatItem
      }
    })
    .catch((error) => {
      console.log('🚨🚨[GET][Unread Count] Error:', error)
    })

    return chatData
}

export const onCronjob: OnCronjobHandler = async ({ request }) => {
  switch (request.method) {
    case 'fireCronjob':
      const state = await getSnapState();
      const apiKey = state?.apiKey as string
      const address = state?.address as string
      const isDialogOn = state?.isDialogOn 
      const unreadCount = state?.unreadCount

      let newMessages = 0
      if (apiKey) {
        newMessages = await getUnreadCountFromAPI(apiKey, address);
      }

      if(newMessages > 0) {
        //user is allowed to turn off Snaps Dialog Alerts
        if (isDialogOn) {
          const lastUnreadMsg = await getLastUnreadMessage(apiKey, address)

          let chatHistory = ''
          //get most recent 6 messages
          await fetch(
            ` https://api.v2.walletchat.fun/v1/get_n_chatitems/${lastUnreadMsg.toaddr}/${lastUnreadMsg.fromaddr}/6`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
            }
          )
          .then((response) => response.json())
          .then((chatData) => {
            console.log('✅ [GET][Chat History]:', chatData)
            chatHistory = chatData
          })
          .catch((error) => {
            console.log('🚨🚨[GET][Unread Count] Error:', error)
          })

          //format messages for convo look within Snaps Dialog
          let convoBody = []
          let prevAddr = ''
          let hasDivider = false
          let lastPushWasUsername = false
          //convoBody.push(heading('New 💬 at WalletChat'))
          //for last N (currently 6) messages we need to manually format the chat data 
          Object.values(chatHistory).forEach(async val => {
            lastPushWasUsername = false
            const from = val?.sender_name || val.fromaddr
            if(prevAddr.toLowerCase() != val.fromaddr.toLowerCase()) {
              prevAddr = val.fromaddr
              lastPushWasUsername = true //just for divider logic below
              convoBody.push(text(' **' + from + ':** '))
            }
            if(!val.read && !hasDivider) {
              hasDivider = true

              //if the previous item in the body is a username header
              //then put the divider in above the name
              if(lastPushWasUsername){
                convoBody.splice(convoBody.length-1, 0, divider());
              } else {
                convoBody.push(divider())
              }
            } 
            convoBody.push(text(val.message.trim()))
            
            if(address.toLowerCase() != val.fromaddr.toLowerCase()) { 
              //only mark unread items from the other party as read
              if(!val.read) {
                await fetch(
                ` https://api.v2.walletchat.fun/v1/update_chatitem/${val.fromaddr}/${val.toaddr}`,
                {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                  },
                  body: JSON.stringify({ fromaddr: val.fromaddr,
                                         toaddr: val.toaddr,
                                         timestamp: val.timestamp,
                                         read: true }),
                }) //end marking item as read
              }
            }
          });
          //end looping through most recent N messages to build chat history for Snaps Dialog Prompt

          //Show user the Dialog Prompt
          const diagResponse = await snap.request({
            method: 'snap_dialog',
            params: {
              type: 'prompt',
              content: panel(convoBody),
              placeholder: 'Enter response to message here...',
            },
          });

          //If the user responded - post the message to WalletChat
          if (diagResponse) {
            console.log("got response: ", diagResponse)
            const timestamp = new Date()

            //send the response message to WalletChat API
            await fetch(
              ` https://api.v2.walletchat.fun/v1/create_chatitem`,
              {
                method: 'POST',
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
        }
        //end of Snaps Dialog Box Notification 
        
        //only add a new notification in Notifications Tab if unread count has changed
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
    case `set_dialog_on`:
      const retVal = await setSnapStateisDialogOn(true)
      return retVal;
    case `set_dialog_off`:
      const result = await setSnapStateisDialogOn(false)
      return result;
    case 'set_snap_state':
      if (
        (request.params &&
        'apiKey' in request.params &&
        typeof request.params.apiKey === 'string') &&
        request.params &&
        'address' in request.params &&
        typeof request.params.address === 'string'
      ) {
        await setSnapState(request.params.apiKey, request.params.address);
        return true;
      }

      throw new Error('Must provide params.apiKey.');

    case 'get_snap_state':
      try {
        const state = await getSnapState();
        return state;
      } catch (error) {
        return false;
      }

    //Currently Unused in full dApp - Reserved for Future Use/Testing
    case 'is_signed_in':
      try {
        const state = await getSnapState();
        return Boolean(state?.apiKey);
      } catch (error) {
        return false;
      }

    //Currently Unused in full dApp - Reserved for Future Use/Testing
    case 'make_authenticated_request':
      // eslint-disable-next-line no-case-declarations
      const state = await getSnapState();
      const apiKey = state?.apiKey as string
      const address = state?.address as string
      if (apiKey) {
        return getUnreadCountFromAPI(apiKey, address);
      }

      throw new Error('Must SIWE before making request.');

    //Currently Unused in full dApp - Reserved for Future Use/Testing
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

