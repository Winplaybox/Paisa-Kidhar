import { Platform } from 'react-native';

import { config } from './config';

export function canUseExternalBilling() {
  return Platform.OS !== 'android' || config.androidExternalBilling;
}
