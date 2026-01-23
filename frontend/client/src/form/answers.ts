import type { AnswersById, FormElementModel } from "@/form/types";

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
      payload[element.id] = answers[element.id];
    }
  });
  return { answers: payload };
};
