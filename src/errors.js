// Only explicitly authored messages may cross the presentation boundary.
export class UserFacingError extends Error {}
export function userMessage(error) {
  return error instanceof UserFacingError ? error.message :
    'Не удалось выполнить действие. Попробуйте ещё раз. Если ошибка повторится, сохраните демо-сессию и перезапустите приложение.';
}
