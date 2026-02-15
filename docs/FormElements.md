# Обмен данными об элементах формы

Ниже описано, как фронтенд, бэкенд и БД представляют сущность элемента формы, и в каком виде её передают.

## Фронтенд (UI/Builder)
**Внутренний формат:** `FormElementModel` (см. `frontend/client/src/form/types.ts`).

Ключевые поля:
- `id: string`
- `widgetType: string`
- `semanticType?: string`
- `label: string`
- `description?: string`
- `required?: boolean`
- `props: Record<string, unknown>`
- `sortIndex: number`

Фронтенд хранит элементы в camelCase и работает с ними как с плоским массивом, упорядоченным по `sortIndex`.

## Бэкенд (API)
**Контракт API по элементам** описывает те же данные, что и БД, но в JSON-формате. Рекомендуемый формат ключей - `snake_case`, как в БД, чтобы избежать неоднозначности.

Пример элемента в API:
```json
{
  "element_id": 12,
  "form_id": 34,
  "widget": "text_input",
  "semantic": "phone",
  "label": "Телефон",
  "text_hint": "Введите номер",
  "supportive_text": "",
  "required_field": true,
  "other_settings": { "inputType": "tel" },
  "position": 0
}
```

При обмене данными:
- **UI -> API:** фронтенд преобразует `FormElementModel` в JSON контракта (переименование полей и перенос `props` -> `other_settings`).
- **API -> UI:** бэкенд возвращает JSON контракта, фронтенд преобразует его в `FormElementModel`.

## База данных (PostgreSQL)
**Основная таблица:** `Form_Element` (см. `database/init/01-init.sql`).

Ключевые поля и соответствия:
- `element_id` <- `id`
- `form_id` <- связь элемента с формой
- `template_id` <- связь элемента с шаблоном (взаимоисключающие)
- `widget` <- `widgetType`
- `semantic` <- `semanticType`
- `label` <- `label`
- `text_hint` <- `text_hint`
- `supportive_text` <- `supportive_text`
- `required_field` <- `required`
- `other_settings` <- `props`
- `position` <- `sortIndex`

## Итоговый поток данных
1) Пользователь создает/редактирует элементы в UI (`FormElementModel`).
2) Фронтенд сериализует элементы в контракт API и отправляет на бэкенд.
3) Бэкенд сохраняет каждый элемент отдельной строкой в `Form_Element`.
4) При чтении формы бэкенд отдает элементы из БД, фронтенд собирает их в список и отображает.
