export interface SendPhotoOptions {
  /** Фото как data:image/*;base64,… (некадрированный оригинал из лайтбокса). */
  dataUrl: string;
  /** Текст кнопки-ссылки = имя персонажа/персоны. */
  label: string;
  /** Внутренний путь Mini App для кнопки-ссылки: "/characters/:id" | "/personas/:id". */
  deepLink: string;
}
