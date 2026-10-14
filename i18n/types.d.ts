import type en from '../messages/en.json';
import type { Locale } from './config';

// Makes t('Namespace.key') a type error when the key is missing from messages/en.json.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof en;
  }
}
