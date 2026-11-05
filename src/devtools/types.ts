/** Данные тренажёра DevTools (вкладки Network и Console браузера) */
export interface NetRequest {
  /** короткое имя в таблице (по умолчанию — последний сегмент URL) */
  name?: string;
  method: string;
  url: string;
  status: number;
  /** text для статуса, если нестандартный; 0 + error — запрос не дошёл */
  statusText?: string;
  /** (failed) net::ERR_… — для запросов без ответа */
  error?: string;
  /** document | fetch | xhr | script | stylesheet | img | font | other */
  type: string;
  /** размер ответа в байтах */
  size?: number;
  /** длительность в мс */
  timeMs: number;
  /** момент старта от начала загрузки страницы, мс (для водопада) */
  startMs?: number;
  remoteAddress?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  /** тело запроса (payload) */
  payload?: string;
  /** тело ответа (JSON красиво форматируется) */
  response?: string;
  /** разбивка времени: dns, connect, ssl, waiting (TTFB), download */
  timing?: Partial<Record<'dns' | 'connect' | 'ssl' | 'waiting' | 'download', number>>;
  /** из кэша */
  fromCache?: boolean;
}

export interface ConsoleMessage {
  level: 'log' | 'info' | 'warn' | 'error';
  text: string;
  /** файл:строка */
  source?: string;
  /** стек вызовов, по строке */
  stack?: string[];
}

export interface DevtoolsDataset {
  /** адрес страницы, которую «открыл клиент» */
  page: string;
  /** что видит пользователь на экране (описание/текст ошибки) */
  screen?: string;
  requests: NetRequest[];
  console?: ConsoleMessage[];
  /** cookies сайта */
  cookies?: { name: string; value: string; domain?: string; expires?: string; httpOnly?: boolean; secure?: boolean }[];
  /** localStorage сайта */
  storage?: Record<string, string>;
}
