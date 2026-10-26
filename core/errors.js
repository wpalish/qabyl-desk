export const ERRORS={400:['BAD_REQUEST','Проверьте данные команды.'],401:['UNAUTHENTICATED','Войдите в кабинет.'],403:['FORBIDDEN','Действие недоступно.'],404:['NOT_FOUND','Пакет недоступен.'],405:['METHOD_NOT_ALLOWED','Метод недоступен.'],409:['CONFLICT','Команда сейчас недоступна. Обновите состояние пакета.'],413:['TOO_LARGE','Запрос превышает допустимый размер.'],429:['RATE_LIMITED','Слишком много запросов. Попробуйте позже.'],500:['INTERNAL','Не удалось обработать запрос.']};
export function problem(status=400){return Object.assign(new Error(ERRORS[status]?.[1]||ERRORS[500][1]),{status});}
export function requireThat(ok,status=400){if(!ok)throw problem(status);}
export function publicError(status){const [code,message]=ERRORS[status]||ERRORS[500];return {error:{code,message}};}
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function keys(value,expected){requireThat(value&&typeof value==='object'&&!Array.isArray(value));const got=Object.keys(value).sort();requireThat(JSON.stringify(got)===JSON.stringify([...expected].sort()));}
export function uuid(v){requireThat(typeof v==='string'&&UUID.test(v));return v;}
export function integer(v,min=1,max=Number.MAX_SAFE_INTEGER){requireThat(Number.isSafeInteger(v)&&v>=min&&v<=max);return v;}
export function text(v,max,{empty=false}={}){requireThat(typeof v==='string');v=v.trim();requireThat(v.length<=(max)&& (empty||v.length>0));return v;}
export function username(v){requireThat(typeof v==='string'&&/^[a-zA-Z0-9_.-]{3,80}$/.test(v));return v;}
