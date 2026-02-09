import type { AnswersById, ElementAttachment, FormElementModel } from "@/form/types";

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
    if (element.id in answers) {
      const value = answers[element.id];
      if (element.widgetType === "file_upload") {
        const attachments = Array.isArray(value) ? (value as ElementAttachment[]) : [];
        payload[element.id] = {
          file_ids: attachments.map((item) => item.file_id).filter((id) => Number.isFinite(id) && id > 0),
        } as unknown as AnswersById[string];
      } else {
        payload[element.id] = value;
      }
    }
  });
  return { answers: payload };
};
