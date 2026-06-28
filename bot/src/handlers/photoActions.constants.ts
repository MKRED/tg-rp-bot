/** callback_data кнопки «Закрыть» под фото из лайтбокса Mini App. Разделяется хендлером
 *  (регистрирует обработчик) и server/media/photoToChat (строит кнопку) — отдельным константным
 *  файлом, чтобы серверу не импортировать модуль grammY-хендлера. */
export const PHOTO_CLOSE_CALLBACK = "photo:close";
