import { SiweMessage } from 'siwe';
import { getAddress } from 'ethers/lib/utils';
import { defaultSnapOrigin } from '../config';
import { GetSnapsResponse, Snap } from '../types';

/**
 * Get the installed snaps in MetaMask.
 *
 * @returns The snaps installed in MetaMask.
 */
export const getSnaps = async (): Promise<GetSnapsResponse> => {
  return (await window.ethereum.request({
    method: 'wallet_getSnaps',
  })) as unknown as GetSnapsResponse;
};

/**
 * Connect a snap to MetaMask.
 *
 * @param snapId - The ID of the snap.
 * @param params - The params to pass with the snap to connect.
 */
export const connectSnap = async (
  snapId: string = defaultSnapOrigin,
  params: Record<'version' | string, unknown> = {},
) => {
  await window.ethereum.request({
    method: 'wallet_requestSnaps',
    params: {
      [snapId]: params,
    },
  });
};

/**
 * Get the snap from MetaMask.
 *
 * @param version - The version of the snap to install (optional).
 * @returns The snap object returned by the extension.
 */
export const getSnap = async (version?: string): Promise<Snap | undefined> => {
  try {
    const snaps = await getSnaps();

    return Object.values(snaps).find(
      (snap) =>
        snap.id === defaultSnapOrigin && (!version || snap.version === version),
    );
  } catch (e) {
    console.log('Failed to obtain installed snap', e);
    return undefined;
  }
};

const mockRetrieveApiKeyFromServer = async (
  chain: string,
  address: string,
  nonce: string,
  message: string,
  signature: string,
): Promise<string> => {
  console.log('Calling server to retrieve JWT...', message, signature);

  let retVal = '';

  await fetch(`https://api.v2.walletchat.fun/signin`, {
    body: JSON.stringify({
      name: chain,
      address: address,
      nonce,
      msg: message,
      sig: signature,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  .then((response) => response.json())
  .then(async (signInData) => {
    console.log('Got JWT !');
    retVal = signInData.access;
  })

  return retVal;
};

export const signInWithEthereum = async () => {
  const accounts = await window.ethereum.request<string[]>({
    method: 'eth_requestAccounts',
  });

  const account = accounts?.[0];
  if (!account) {
    throw new Error('Must accept wallet connection request.');
  }

  const address = getAddress(account);

  //get Nonce for WalletChat
  let nonce = ''
  await fetch(` https://api.v2.walletchat.fun/users/${address}/nonce`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
    .then((response) => response.json())
    .then(async (usersData: { Nonce: string }) => {
      console.log('✅[GET][Nonce]:', usersData)
      nonce = usersData.Nonce
    })
    .catch((error) => {
      console.log('🚨[GET][Nonce]:', error)
    })

  const statement =
          'You are signing a plain-text message to prove you own this wallet address. No gas fees or transactions will occur.'
  const siweMessage = new SiweMessage({
    domain: window.location.hostname,
    uri: window.location.origin,
    version: '1',
    nonce: nonce,
    chainId: 1,
    address,
    statement,
  });

  const signature = await window.ethereum.request<string>({
    method: 'personal_sign',
    params: [siweMessage.prepareMessage(), address],
  });

  if (!signature) {
    throw new Error('Must accept sign-in with ethereum request.');
  }

  const apiKey = await mockRetrieveApiKeyFromServer(
    "1",
    address,
    nonce,
    siweMessage.toMessage(),
    signature,
  );

  await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'set_api_key', params: { apiKey, address } },
    },
  });
};

export const signOut = async () => {
  await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      request: { method: 'remove_api_key' },
    },
  });
};

/**
 * Invoke the "is_signed_in" method from the siwe snap.
 */

export const checkIsSignedIn = async (): Promise<boolean> => {
  return Boolean(
    await window.ethereum.request({
      method: 'wallet_invokeSnap',
      params: {
        snapId: defaultSnapOrigin,
        request: { method: 'is_signed_in' },
      },
    }),
  );
};

/**
 * Invoke the "make_authenticated_request" method from the siwe snap.
 */

export const makeAuthenticatedRequest = async (): Promise<number> => {
  const accounts = await window.ethereum.request<string[]>({
    method: 'eth_requestAccounts',
  });

  const account = accounts?.[0];
  if (!account) {
    throw new Error('Must accept wallet connection request.');
  }

  const address = getAddress(account);

  const result = await window.ethereum.request<{
    secretResult: number;
  }>({
    method: 'wallet_invokeSnap',
    params: {
      snapId: defaultSnapOrigin,
      address: address,
      request: { method: 'make_authenticated_request' },
    },
  });

  if (typeof result?.secretResult !== 'number') {
    throw new Error(
      `Unexpected result from request: ${JSON.stringify(result)}`,
    );
  }

  return result.secretResult;
};

export const isLocalSnap = (snapId: string) => snapId.startsWith('local:');
