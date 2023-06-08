import { OnRpcRequestHandler, OnCronjobHandler } from '@metamask/snaps-types';
<<<<<<< Updated upstream
import { panel, text, heading } from '@metamask/snaps-ui'; //might not need these long term
=======
import { panel, text, heading } from '@metamask/snaps-ui'; 
import * as LitJsSdk from '@lit-protocol/lit-node-client'
import * as Types from '@lit-protocol/types'

type AuthSig = Types.AuthSig
const chain = 'ethereum'

class Lit {
  litNodeClient: LitJsSdk.LitNodeClient | null = null

  authSig: AuthSig | undefined = undefined

  setAuthSig(authSig: AuthSig) {
    this.authSig = authSig
  }

  async connect() {
    this.litNodeClient = new LitJsSdk.LitNodeClient({ debug: false })
    await this.litNodeClient.connect()
  }

  async connectManual() {
    if (!this.litNodeClient) {
      await this.connect()
    }
  }

  async disconnect() {
    LitJsSdk.ethConnect.disconnectWeb3()
    this.litNodeClient = null
    this.authSig = undefined
  }

  async encryptString(
    account: string,
    str: string,
    unifiedAccessControlConditions: any
  ) {
    if (!this.litNodeClient) {
      await this.connectManual()
    }

    if (!this.authSig) {
      this.setAuthSig(account)
    }

    const { encryptedString, symmetricKey } = await LitJsSdk.encryptString(str)

    const encryptedSymmetricKey = await this.litNodeClient?.saveEncryptionKey({
      unifiedAccessControlConditions,
      symmetricKey,
      authSig: this.authSig,
      chain,
    })

    return {
      encryptedFile: encryptedString,
      encryptedSymmetricKey: LitJsSdk.uint8arrayToString(
        encryptedSymmetricKey,
        'base16'
      ),
    }
  }

  async decryptString(
    account: string,
    encryptedStr: Blob,
    encryptedSymmetricKey: string,
    // when delegate.cash was added, the contract call condition changed the access control condition type
    // this is here to support legacy messages
    accessControlConditions:
      | { accessControlConditions: any }
      | { unifiedAccessControlConditions: any }
  ) {
    if (!this.litNodeClient) {
      await this.connectManual()
    }

    const symmetricKey = await this.litNodeClient?.getEncryptionKey({
      ...accessControlConditions,
      toDecrypt: encryptedSymmetricKey,
      chain,
      authSig: this.authSig,
    })

    if (symmetricKey) {
      const decryptedFile = await LitJsSdk.decryptString(
        encryptedStr,
        symmetricKey
      )

      return { decryptedFile }
    }
  }

  /**
   * This function encodes into base 64.
   * it's useful for storing symkeys and files in ceramic
   */
  encodeb64(uintarray: Uint8Array) {
    const b64 = Buffer.from(uintarray).toString('base64')
    return b64
  }

  /**
   * This function converts blobs to base 64.
   * for easier storage in ceramic
   */
  blobToB64(blob: Blob) {
    return LitJsSdk.blobToBase64String(blob)
  }

  b64toBlob(b64Data: string) {
    return LitJsSdk.base64StringToBlob(b64Data)
  }

  /**
   * This function decodes from base 64.
   * it's useful for decrypting symkeys and files in ceramic
   */
  decodeb64(b64String: string) {
    return new Uint8Array(Buffer.from(b64String, 'base64'))
  }
}

function getAccessControlConditions(fromaddr: string, toaddr: string) {
  const accessControlConditions = [
    {
      conditionType: 'evmBasic',
      contractAddress: '',
      standardContractType: '',
      chain: 'ethereum',
      method: '',
      parameters: [':userAddress'],
      returnValueTest: {
        comparator: '=',
        value: toaddr,
      },
    },
    { operator: 'or' },
    {
      conditionType: 'evmBasic',
      contractAddress: '',
      standardContractType: '',
      chain: 'ethereum',
      method: '',
      parameters: [':userAddress'],
      returnValueTest: {
        comparator: '=',
        value: fromaddr,
      },
    },
    { operator: 'or' }, // delegate.cash full wallet delegation
    {
      conditionType: 'evmContract',
      contractAddress: '0x00000000000076A84feF008CDAbe6409d2FE638B',
      functionName: 'checkDelegateForAll',
      functionParams: [':userAddress', toaddr],
      functionAbi: {
        inputs: [
          {
            name: 'delegate',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'vault',
            type: 'address',
            internalType: 'address',
          },
        ],
        name: 'checkDelegateForAll',
        outputs: [
          {
            name: '',
            type: 'bool',
          },
        ],
        payable: false,
        stateMutability: 'view',
        type: 'function',
      },
      chain: 'ethereum',
      returnValueTest: {
        key: '',
        comparator: '=',
        value: 'true',
      },
    },
    { operator: 'or' }, // delegate.cash full wallet delegation
    {
      conditionType: 'evmContract',
      contractAddress: '0x00000000000076A84feF008CDAbe6409d2FE638B',
      functionName: 'checkDelegateForAll',
      functionParams: [':userAddress', fromaddr],
      functionAbi: {
        inputs: [
          {
            name: 'delegate',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'vault',
            type: 'address',
            internalType: 'address',
          },
        ],
        name: 'checkDelegateForAll',
        outputs: [
          {
            name: '',
            type: 'bool',
          },
        ],
        payable: false,
        stateMutability: 'view',
        type: 'function',
      },
      chain: 'ethereum',
      returnValueTest: {
        key: '',
        comparator: '=',
        value: 'true',
      },
    },
  ]

  return accessControlConditions
}
>>>>>>> Stashed changes

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

const setSnapState = async (apiKey: string | null, address: string | null, authSig: string | null) => {
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
        authSig,
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
  const authSig = state?.authSig as string

  return snap.request({
    method: 'snap_manageState',
    params: {
      operation: 'update',
      newState: {
        apiKey,
        address,
        authSig,
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
  const authSig = state?.authSig as string

  return snap.request({
    method: 'snap_manageState',
    params: {
      operation: 'update',
      newState: {
        apiKey,
        address,
        authSig,
        hasNotified,
        unreadCount
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
        newMessages = await makeRequestWithApiKey(apiKey, address);
      }

      if(newMessages > 0) {
        if (!hasNotified){
          //don't alert the user again 
          await setSnapStateHasNotified(true)

<<<<<<< Updated upstream
          return snap.request({
=======
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

          if (
            lastUnreadMsg.encrypted_sym_lit_key &&
            !lastUnreadMsg.toaddr.includes('.eth') &&
            !lastUnreadMsg.fromaddr.includes('.eth')
          ) {
            // only needed for mixed DB with plain and encrypted data
            const accessControlConditions = JSON.parse(
              lastUnreadMsg.lit_access_conditions
            )

            const lit = new Lit()
            lit.setAuthSig(authSig)
            const blob = lit.b64toBlob(lastUnreadMsg.message)
            //after change to include SC conditions, we had to change LIT accessControlConditions to UnifiedAccessControlConditions
            //this is done to support legacy messages (new databases wouldn't need this)
            lastUnreadMsg.message = await Lit.decryptString(
              address,
              lit.b64toBlob(lastUnreadMsg.message),
              lastUnreadMsg.encrypted_sym_lit_key,
              // after change to include SC conditions, we had to change LIT accessControlConditions to UnifiedAccessControlConditions
              // this is done to support legacy messages (new databases wouldn't need this)
              !String(lastUnreadMsg.lit_access_conditions).includes('evmBasic')
                ? { accessControlConditions }
                : { unifiedAccessControlConditions: accessControlConditions }
            )
          }
          console.log("last unread MSG: ", lastUnreadMsg)

          let chatHistory = ''
          await fetch(
            ` https://api.v2.walletchat.fun/v1/getall_chatitems/${lastUnreadMsg.toaddr}/${lastUnreadMsg.fromaddr}`,
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
          .then((chatData) => {
            console.log('✅ [GET][Chat History]:', chatData)
            chatHistory = chatData
          })
          .catch((error) => {
            console.log('🚨🚨[GET][Unread Count] Error:', error)
          })

          let from = lastUnreadMsg?.sender_name || lastUnreadMsg.fromaddr
          let convoBody = ''
          // for chatHistory
          Object.values(chatHistory).forEach(val => {
            if(address.toLowerCase() === val.fromaddr.toLowerCase()) { 
              convoBody += ' **' + from + ':** ' + val.message + '  \r\n  '
            } else {
              convoBody += ' **me:** ' + val.message + '  \r\n  '
            }
          });
          // chatHistoryPrintable = {...
          //   text('**Respond Here or at WalletChat.fun:** '))
          // }

          const diagResponse = await snap.request({
>>>>>>> Stashed changes
            method: 'snap_dialog',
            params: {
              type: 'alert',
              content: panel([heading('New Message at WalletChat.fun'), 
              text('Unread Count: ' + newMessages.toString() + 
              '\n\n Future unread message notifications can be found in the Notifications tab!')]),
            },
          });
        } else {
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
      await setSnapState(null, null, null);
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
        
      // case 'nativeNotify':
      //   return snap.request({
      //     method: 'snap_notify',
      //     params: {
      //       type: 'native',
      //       message: `New Message Waiting at WalletChat.fun`,
      //     },
      //   });

    default:
      throw new Error('Method not found.');
  }
};
