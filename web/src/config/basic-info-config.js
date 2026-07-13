/*
 * @Description: Basic information configuration for TUIRoomKit applications
 */

import LibGenerateTestUserSig from './lib-generate-test-usersig-es.min';

/**
 * Tencent Cloud SDKAppId, which should be replaced with user's SDKAppId.
 * Enter Tencent Cloud TRTC [Console] (https://console.cloud.tencent.com/trtc ) to create an application,
 * and you will see the SDKAppId.
 * It is a unique identifier used by Tencent Cloud to identify users.
 *
 * Read from the VITE_TENCENT_SDK_APP_ID environment variable so the real value
 * never has to be committed to source control (set it in .env.local for local
 * dev, or in your hosting provider's Environment Variables settings for deploys).
 */

export const SDKAPPID = Number(import.meta.env.VITE_TENCENT_SDK_APP_ID) || 0;

/**
 * Encryption key for calculating signature, which can be obtained in the following steps:
 *
 * Step1. Enter Tencent Cloud TRTC [Console](https://console.cloud.tencent.com/rav ),
 * and create an application if you don't have one.
 * Step2. Click your application to find "Quick Start".
 * Step3. Click "View Secret Key" to see the encryption key for calculating UserSig,
 * and copy it to the following variable.
 *
 * Notes: this method is only applicable for debugging Demo. Before official launch,
 * please migrate the UserSig calculation code and key to your backend server to avoid
 * unauthorized traffic use caused by the leakage of encryption key.
 * Document: https://intl.cloud.tencent.com/document/product/647/35166#Server
 *
 * Read from the VITE_TENCENT_SDK_SECRET_KEY environment variable, same as SDKAPPID above.
 */
export const SDKSECRETKEY = import.meta.env.VITE_TENCENT_SDK_SECRET_KEY || '';

/**
 * Signature expiration time, which should not be too short
 * Time unit: second
 * Default time: 7 * 24 * 60 * 60 = 604800 = 7days
 *
 */
export const EXPIRETIME = 604800;

const generator = new LibGenerateTestUserSig(SDKAPPID, SDKSECRETKEY, EXPIRETIME);

export function genTestUserSig(userId) {
  return generator.genTestUserSig(userId);
}
