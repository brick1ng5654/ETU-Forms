import type { AnswersById, FormElementModel } from "@/form/types";

export const buildAnswersPayload = (elements: FormElementModel[], answers: AnswersById) => {
  const payload: AnswersById = {};
  elements.forEach((element) => {
    if (element.id in answers) {
      payload[element.id] = answers[element.id];
    }
  });
  return { answers: payload };
};
