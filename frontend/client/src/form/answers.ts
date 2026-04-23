import type { AnswersById, ElementAttachment, FormElementModel } from "@/form/types";

const REPEATABLE_ID_SEPARATOR = "::repeatable::";

const parseRepeatableChildId = (value: string): { blockId: string; index: number; childId: string } | null => {
  const parts = value.split(REPEATABLE_ID_SEPARATOR);
  if (parts.length !== 3) return null;
  const index = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(index) || index < 0) return null;
  return { blockId: parts[0], index, childId: parts[2] };
};

const normalizeFileUploadValue = (value: unknown) => {
  const attachments = Array.isArray(value) ? (value as ElementAttachment[]) : [];
  return {
    file_ids: attachments.map((item) => item.file_id).filter((id) => Number.isFinite(id) && id > 0),
  };
};

// Example payload (canonical values):
// {
//   "answers": {
//     "field-id": "79991234567",
//     "full-name-id": { "lastName": "Ivanov", "firstName": "Ivan", "patronymic": "Ivanovich" },
//     "passport-id": {
//       "seriesNumber": "1234567890",
//       "issueDate": "2024-01-31",
//       "departmentCode": "123456",
//       "issuedBy": "UFMS",
//       "birthPlace": "Saint Petersburg"
//     }
//   }
// }
export const buildAnswersPayload = (elements: FormElementModel[], answers: AnswersById) => {
  const payload: AnswersById = {};
  elements.forEach((element) => {
    if (element.widgetType === "repeatable_block") {
      const nestedFields = Array.isArray(element.children) ? element.children : [];
      const nestedFieldById = new Map(nestedFields.map((field) => [field.id, field]));
      const instances = new Map<number, Record<string, unknown>>();

      Object.entries(answers).forEach(([answerKey, answerValue]) => {
        const parsed = parseRepeatableChildId(answerKey);
        if (!parsed || parsed.blockId !== element.id) return;
        if (!nestedFieldById.has(parsed.childId)) return;
        const bucket = instances.get(parsed.index) ?? {};
        const childField = nestedFieldById.get(parsed.childId)!;
        bucket[parsed.childId] =
          childField.widgetType === "file_upload"
            ? normalizeFileUploadValue(answerValue)
            : answerValue;
        instances.set(parsed.index, bucket);
      });

      if (instances.size > 0) {
        payload[element.id] = Array.from(instances.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([, value]) => value) as AnswersById[string];
        return;
      }

      const directValue = answers[element.id];
      if (Array.isArray(directValue)) {
        payload[element.id] = directValue as AnswersById[string];
      }
      return;
    }

    if (element.id in answers) {
      const value = answers[element.id];
      if (element.widgetType === "file_upload") {
        payload[element.id] = normalizeFileUploadValue(value) as unknown as AnswersById[string];
      } else {
        payload[element.id] = value;
      }
    }
  });
  return { answers: payload };
};
